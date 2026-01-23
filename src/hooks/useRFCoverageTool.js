import { useState, useEffect, useRef, useCallback } from 'react';
import createMeshRF from '../../libmeshrf/js/meshrf.js';
import { stitchElevationGrids, transformObserverCoords, calculateStitchedBounds } from '../utils/tileStitcher';

/**
 * Hook for RF Coverage Analysis using Wasm ITM propagation model
 * @param {boolean} active - Whether the tool is currently active
 * @returns {object} - { runAnalysis, resultLayer, isCalculating }
 */
export const useRFCoverageTool = (active) => {
    const [resultLayer, setResultLayer] = useState(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const wasmModuleRef = useRef(null);

    // Initialize Wasm Module
    useEffect(() => {
        let mounted = true;
        
        createMeshRF().then(Module => {
            if (mounted) {
                wasmModuleRef.current = Module;
                console.log('RF Coverage Wasm Module Loaded');
            }
        }).catch(err => {
            console.error('Failed to load RF Coverage Wasm:', err);
        });

        return () => { mounted = false; };
    }, []);

    // Helper: Get adjacent 3x3 tiles
    const getAdjacentTiles = (centerTile) => {
      const offsets = [
        [-1, -1], [0, -1], [1, -1],
        [-1,  0], [0,  0], [1,  0],
        [-1,  1], [0,  1], [1,  1]
      ];
      const maxTile = Math.pow(2, centerTile.z);
      
      return offsets.map(([dx, dy]) => {
          let x = centerTile.x + dx;
          const y = centerTile.y + dy;
          // Validate Y bounds (world edge)
          if (y < 0 || y >= maxTile) return null;
          
          // Wrap X (International Date Line)
          if (x < 0) x = maxTile + x;
          if (x >= maxTile) x = x - maxTile;
           
           return { x, y, z: centerTile.z };
      }).filter(t => t !== null);
    };

    const fetchTile = async (tile) => {
        const tileUrl = `/api/tiles/${tile.z}/${tile.x}/${tile.y}.png`;
        try {
            const response = await fetch(tileUrl);
            if (!response.ok) return null;
            const blob = await response.blob();
            const img = await createImageBitmap(blob);
            
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, img.width, img.height);
            const pixels = imageData.data;
            
            const elevationData = new Float32Array(img.width * img.height);
            for (let i = 0; i < img.width * img.height; i++) {
                const r = pixels[i * 4];
                const g = pixels[i * 4 + 1];
                const b = pixels[i * 4 + 2];
                elevationData[i] = -10000 + ((r * 256 * 256 + g * 256 + b) * 0.1);
            }
            return { elevation: elevationData, width: img.width, height: img.height, tile };
        } catch (e) {
            console.warn("Failed fetch", tile, e);
            return null;
        }
    };

    /**
     * Run RF Coverage Analysis
     * @param {number} lat - Latitude of transmitter
     * @param {number} lng - Longitude of transmitter
     * @param {number} txHeight - Transmitter antenna height (meters)
     * @param {number} maxDist - Maximum distance (meters)
     * @param {object} rfParams - RF parameters {freq, txPower, txGain, rxGain, rxSensitivity}
     */
    const runAnalysis = async (lat, lng, txHeight, maxDist, rfParams) => {
        if (!wasmModuleRef.current) {
            console.error('Wasm module not loaded');
            return;
        }

        setIsCalculating(true);
        const Module = wasmModuleRef.current;

        try {
            // 1. Determine Zoom and Center Tile
            const zoom = maxDist > 8000 ? 10 : 12;
            const centerTile = getTile(lat, lng, zoom);
            
            // 2. Fetch 3x3 Grid
            console.log(`[RF Coverage] Analyzing 3x3 Grid around ${lat}, ${lng} (z${zoom})`);
            const targetTiles = getAdjacentTiles(centerTile);
            const loadedTiles = await Promise.all(targetTiles.map(fetchTile));
            const validTiles = loadedTiles.filter(t => t !== null);
            
            if (validTiles.length === 0) throw new Error("No elevation data loaded");

            // 3. Stitch Tiles
            // Assuming 256x256 tiles -> 768x768 grid
            const stitched = stitchElevationGrids(validTiles, centerTile, 256);
            
            // 4. Transform TX coordinates to Stitched Grid
            const txCoords = transformObserverCoords(lat, lng, centerTile, stitched.width, stitched.height, 256);
            
            // 5. Calculate GSD
            // Calculate using center tile approximation
            const tileBounds = getTileBounds(centerTile.x, centerTile.y, centerTile.z);
            const latRad = lat * Math.PI / 180;
            const metersPerDegree = 111320 * Math.cos(latRad);
            const tileWidthDegrees = tileBounds.east - tileBounds.west;
            const tileWidthMeters = tileWidthDegrees * metersPerDegree;
            const gsd = tileWidthMeters / 256; // Base tile width

            const maxDistPixels = Math.floor(maxDist / gsd);
            
            console.log(`[RF Coverage] Stitched Grid: ${stitched.width}x${stitched.height}. TX: (${txCoords.x}, ${txCoords.y}). GSD: ${gsd.toFixed(2)}m`);
            
            // 6. Allocate Wasm Memory
            const byteSize = stitched.data.length * 4;
            console.log(`[RF Coverage] Allocating ${byteSize} bytes for elevation grid`);
            const ptr = Module._malloc(byteSize);
            Module.HEAPF32.set(stitched.data, ptr / 4);
            
            // 7. Call Wasm RF Coverage Function
            console.time("RF_Coverage_WASM_Execution");
            console.log(`[RF Coverage] Calling Wasm calculate_rf_coverage with params:`, {
                width: stitched.width, height: stitched.height, tx: {x: txCoords.x, y: txCoords.y, h: txHeight}, maxDistPixels, gsd
            });

            const resultVec = Module.calculate_rf_coverage(
                ptr,
                stitched.width,
                stitched.height,
                txCoords.x,
                txCoords.y,
                txHeight,
                rfParams.freq,
                rfParams.txPower,
                rfParams.txGain,
                rfParams.rxGain,
                rfParams.rxSensitivity,
                maxDistPixels,
                gsd
            );
            console.timeEnd("RF_Coverage_WASM_Execution");
            
            // 8. Extract Results
            const resultArr = new Float32Array(resultVec.size());
            for (let i = 0; i < resultVec.size(); i++) {
                resultArr[i] = resultVec.get(i);
            }
            
            // Cleanup
            Module._free(ptr);
            resultVec.delete();
            
            console.log('[RF Coverage] Calculation Complete. Result Size:', resultArr.length);
            
            // Calculate stats
            let minVal = Infinity, maxVal = -Infinity, validCount = 0;
            for(let v of resultArr) {
                if(v > -999) { // Assuming -999 or similar is nodata
                    if(v < minVal) minVal = v;
                    if(v > maxVal) maxVal = v;
                    validCount++;
                }
            }
            console.log(`[RF Coverage] Signal Stats: Min=${minVal.toFixed(1)} dBm, Max=${maxVal.toFixed(1)} dBm, ValidPix=${validCount}`);
            
            // 9. Store Result with Stitched Bounds
            const bounds = calculateStitchedBounds(centerTile);
            
            setResultLayer({
                data: resultArr,
                width: stitched.width,
                height: stitched.height,
                bounds: bounds,
                rfParams: rfParams
            });
            
        } catch (err) {
            console.error('[RF Coverage] Error:', err);
        } finally {
            setIsCalculating(false);
        }
    };

    // Reset when tool deactivated
    useEffect(() => {
        if (!active) {
            setResultLayer(null);
        }
    }, [active]);

    const clear = useCallback(() => {
        setResultLayer(null);
    }, []);

    return { runAnalysis, resultLayer, isCalculating, clear };
};

// Helper: Convert lat/lng to tile coordinates
function getTile(lat, lon, zoom) {
    const n = Math.pow(2, zoom);
    const x = Math.floor((lon + 180) / 360 * n);
    const latRad = lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x, y, z: zoom };
}

// Helper: Get tile bounds in lat/lng
function getTileBounds(x, y, z) {
    const n = Math.pow(2, z);
    const west = x / n * 360 - 180;
    const east = (x + 1) / n * 360 - 180;
    const north = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
    const south = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * 180 / Math.PI;
    return { west, east, north, south };
}
