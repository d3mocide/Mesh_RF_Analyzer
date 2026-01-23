import { useState, useCallback, useEffect, useRef } from 'react';


// Initialize Worker
// Vite handles 'new Worker' with URL import
const worker = new Worker(new URL('../../libmeshrf/js/Worker.ts', import.meta.url), { type: 'module' });

import { stitchElevationGrids, transformObserverCoords, calculateStitchedBounds } from '../utils/tileStitcher';

export function useViewshedTool(active) {
    const [resultLayer, setResultLayer] = useState(null); // { data, width, height, bounds }
    const [isCalculating, setIsCalculating] = useState(false);
    const [error, setError] = useState(null);
    const workerInitialized = useRef(false);
    
    // Track analysis state
    const analysisIdRef = useRef(null);

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
                if (analysisIdRef.current && id === analysisIdRef.current) {
                    setIsCalculating(false);
                    setError(workerError);
                }
                return;
            }

            if (type === 'CALCULATE_VIEWSHED_RESULT') {
                if (analysisIdRef.current && id === analysisIdRef.current) {
                   console.log("Stitched Viewshed Calculation Complete");
                   
                   // result is Uint8Array of the stitched grid
                   // DEBUG: Check visibility
                   let visibleCount = 0;
                   for(let k=0; k<result.length; k++) { if(result[k] > 0) visibleCount++; }
                   console.log(`[ViewshedWorker] Result received. Size: ${result.length}. Visible pixels: ${visibleCount}`);
                   
                   // We need to retrieve the bounds we calculated earlier.
                   // Since this is a single async flow, we can't easily access the local vars of runAnalysis from here
                   // unless we store them in a ref or if we pass them back from worker (by adding to payload).
                   // A simple Ref for "currentBounds" works since we only run one analysis at a time usually.
                   if (currentBoundsRef.current) {
                       setResultLayer({
                           data: result,
                           width: currentBoundsRef.current.width,
                           height: currentBoundsRef.current.height,
                           bounds: currentBoundsRef.current.bounds
                       });
                   }
                   setIsCalculating(false);
                }
            }
        };
    }, []);
    
    const currentBoundsRef = useRef(null);
    
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
    
    // Helper: Get adjacent 3x3 tiles
    const getAdjacentTiles = (centerTile) => {
      const offsets = [
        [-1, -1], [0, -1], [1, -1],
        [-1,  0], [0,  0], [1,  0],
        [-1,  1], [0,  1], [1,  1]
      ];
      // Max tile index for zoom
      const maxTile = Math.pow(2, centerTile.z) - 1;
      
      return offsets.map(([dx, dy]) => {
          const x = centerTile.x + dx;
          const y = centerTile.y + dy;
          // Validate world bounds
          if (y < 0 || y > maxTile) return null; // Y bounds hard
           let wrappedX = x;
           if (x < 0) wrappedX = maxTile + x + 1;
           if (x > maxTile) wrappedX = x - maxTile - 1;
           
           return { x: wrappedX, y, z: centerTile.z };
      }).filter(t => t !== null);
    };

    const fetchAndDecodeTile = async (tile) => {
        const tileUrl = `/api/tiles/${tile.z}/${tile.x}/${tile.y}.png`;
        try {
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
            const pixels = imageData.data;
            const floatData = new Float32Array(img.width * img.height);
            
            for (let i = 0; i < pixels.length; i += 4) {
                const r = pixels[i];
                const g = pixels[i + 1];
                const b = pixels[i + 2];
                floatData[i / 4] = -10000 + ((r * 256 * 256 + g * 256 + b) * 0.1);
            }
            
            // We don't necessarily need bounds here for stitching, just data and indices
            return {
                elevation: floatData,
                width: img.width,
                height: img.height,
                tile
            };
        } catch (err) {
            console.warn(`Failed to fetch tile ${tile.x}/${tile.y}`, err);
            return null; // Return null on failure
        }
    };

    const runAnalysis = useCallback(async (lat, lon, height = 2.0, maxDist = 3000) => {
        // Wait for worker to initialize if needed
        if (!workerInitialized.current) {
            console.log("Worker not ready, waiting...");
            let attempts = 0;
            while (!workerInitialized.current && attempts < 20) {
                await new Promise(r => setTimeout(r, 200));
                attempts++;
            }
            if (!workerInitialized.current) {
                console.error("Worker failed to initialize in time");
                setError("Engine failed to start. Please reload.");
                return;
            }
        }
        
        setIsCalculating(true);
        setError(null);
        setResultLayer(null);
        
        const currentAnalysisId = `vs-stitch-${Date.now()}`;
        analysisIdRef.current = currentAnalysisId;
        
        try {
            const zoom = maxDist > 8000 ? 10 : 12; 
            const centerTile = getTile(lat, lon, zoom);
            
            // 1. Get Tiles
            const targetTiles = getAdjacentTiles(centerTile);
            console.log(`Analyzing ${targetTiles.length} tiles around ${lat}, ${lon} (Stitched)`);
            
            // 2. Fetch all in parallel
            const loadedTiles = await Promise.all(targetTiles.map(fetchAndDecodeTile));
            const validTiles = loadedTiles.filter(t => t !== null);
            
            if (validTiles.length === 0) {
                setError("Failed to load any elevation data");
                setIsCalculating(false);
                return;
            }
            
            // 3. Stitch Tiles
            const stitched = stitchElevationGrids(validTiles, centerTile, 256);
            console.log(`[Viewshed] Stitched Grid: ${stitched.width}x${stitched.height}. Data Len: ${stitched.data.length}`);
            console.log(`[Viewshed] Center Elev Sample: ${stitched.data[Math.floor(stitched.data.length/2)]}`);
            
            // 4. Calculate Observer Position in Stitched Grid
            const observerCoords = transformObserverCoords(lat, lon, centerTile, stitched.width, stitched.height, 256);
            
            // 5. Calculate Stitched Geographic Bounds
            const bounds = calculateStitchedBounds(centerTile);
            
            // Store context for callback
            currentBoundsRef.current = {
                width: stitched.width,
                height: stitched.height,
                bounds: bounds
            };
            
            // 6. Dispatch Single Job to Worker
            worker.postMessage({
                id: currentAnalysisId,
                type: 'CALCULATE_VIEWSHED',
                payload: {
                    elevation: stitched.data, // Single 768x768 grid
                    width: stitched.width,
                    height: stitched.height,
                    tx_x: observerCoords.x,
                    tx_y: observerCoords.y,
                    tx_h: height,
                    max_dist: Math.floor(maxDist / 30.0)
                }
            }, [stitched.data.buffer]); 

        } catch (err) {
            console.error("Analysis Failed:", err);
            setError(err.message);
            setIsCalculating(false);
        }

    }, []);

    const clear = useCallback(() => {
        setResultLayer(null);
        setError(null);
    }, []);

    return { runAnalysis, resultLayer, isCalculating, error, clear };
}
