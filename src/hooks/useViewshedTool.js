import { useState, useCallback, useEffect, useRef } from 'react';


// Initialize Worker
// Vite handles 'new Worker' with URL import
const worker = new Worker(new URL('../../libmeshrf/js/Worker.ts', import.meta.url), { type: 'module' });

export function useViewshedTool(active) {
    const [resultLayer, setResultLayer] = useState(null); // { data: Uint8Array, width, height, bounds }
    const [isCalculating, setIsCalculating] = useState(false);
    const [error, setError] = useState(null);
    const workerInitialized = useRef(false);

    useEffect(() => {
        worker.onmessage = (e) => {
            const { type, id, result, error: workerError } = e.data;
            
            if (type === 'INIT_COMPLETE') {
                workerInitialized.current = true;
                console.log("MeshRF Worker Initialized");
                return;
            }

            if (workerError) {
                console.error("Worker Error:", workerError);
                setIsCalculating(false);
                setError(workerError);
                return;
            }

            if (type === 'CALCULATE_VIEWSHED_RESULT' || (id && id.startsWith('vs-'))) {
                console.log("Viewshed Calculation Complete");
                // Result is Uint8Array
                // We need to store it to pass to the Map Layer
                setResultLayer((prev) => ({
                    ...prev, // Keep bounds from request
                    data: result,
                }));
                setIsCalculating(false);
            }
        };

        return () => {
            // worker.terminate(); // Don't terminate, keep alive
        };
    }, []);

    // Helper: Lat/Lon to Tile Coordinates
    const getTile = (lat, lon, zoom) => {
        const d2r = Math.PI / 180;
        const n = Math.pow(2, zoom);
        const x = Math.floor(n * ((lon + 180) / 360));
        const y = Math.floor(n * (1 - Math.log(Math.tan(lat * d2r) + 1 / Math.cos(lat * d2r)) / Math.PI) / 2);
        return { x, y, z: zoom };
    };

    // Helper: Tile bounds
    const getTileBounds = (x, y, z) => {
        const tile2long = (x, z) => (x / Math.pow(2, z)) * 360 - 180;
        const tile2lat = (y, z) => {
            const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
            return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
        };
        return {
            west: tile2long(x, z),
            north: tile2lat(y, z),
            east: tile2long(x + 1, z),
            south: tile2lat(y + 1, z)
        };
    };

    const runAnalysis = useCallback(async (lat, lon, height = 2.0, maxDist = 3000) => {
        if (!workerInitialized.current) {
            console.warn("Worker not ready");
            return;
        }
        
        setIsCalculating(true);
        setError(null);

        try {
            // 1. Fetch Elevation Data from Backend Tile Server (Terrain-RGB)
            const zoom = 12; // Matches backend default
            const tile = getTile(lat, lon, zoom);
            const tileUrl = `/api/tiles/${tile.z}/${tile.x}/${tile.y}.png`;
            
            // Load and decode Image
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = tileUrl;
            
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });

            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, img.width, img.height);
            const pixels = imageData.data; // RGBA
            const floatData = new Float32Array(img.width * img.height);
            
            // Decode Terrain-RGB: h = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
            for (let i = 0; i < pixels.length; i += 4) {
                const r = pixels[i];
                const g = pixels[i + 1];
                const b = pixels[i + 2];
                // index = i / 4
                floatData[i / 4] = -10000 + ((r * 256 * 256 + g * 256 + b) * 0.1);
            }

            const width = img.width;
            const demHeight = img.height;
            const bbox = getTileBounds(tile.x, tile.y, tile.z);

            // 2. Find specific TX index in the DEM (Tile)
            const pixelW = (bbox.east - bbox.west) / width;
            const pixelH = (bbox.north - bbox.south) / demHeight;
            
            // Relative position in tile
            const tx_x = Math.floor((lon - bbox.west) / pixelW);
            const tx_y = Math.floor((bbox.north - lat) / pixelH); 

            console.log(`Analyzing at Tile ${tile.x}/${tile.y} (z${tile.z}), Local Grid: ${tx_x}, ${tx_y}`);

            // 3. Dispatch to Worker
            const id = `vs-${Date.now()}`;
            
            setResultLayer({ 
                width, 
                height: demHeight, 
                bounds: bbox,
                data: null 
            });

            worker.postMessage({
                id,
                type: 'CALCULATE_VIEWSHED',
                payload: {
                    elevation: floatData, 
                    width,
                    height: demHeight,
                    tx_x,
                    tx_y,
                    tx_h: height,
                    max_dist: Math.floor(maxDist / 30.0) // Approx pixels
                }
            }, [floatData.buffer]); 

        } catch (err) {
            console.error("Analysis Failed:", err);
            setError(err.message);
            setIsCalculating(false);
        }

    }, []);

    return { runAnalysis, resultLayer, isCalculating, error };
}
