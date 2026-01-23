/**
 * Utility for stitching adjacent elevation tiles into a single grid.
 * Handles 3x3 grid stitching for viewshed analysis.
 */

// Stitches a 3x3 grid of tiles (256x256 each) into a single 768x768 grid
export function stitchElevationGrids(tiles, centerTile, tileSize = 256) {
    const gridSize = 3; // 3x3 grid
    const stitchedWidth = gridSize * tileSize;
    const stitchedHeight = gridSize * tileSize;
    const stitchedData = new Float32Array(stitchedWidth * stitchedHeight);

    // Fill with "nodata" value (-10000 or similar, but for viewshed 0 or -1 might be safer if algorithm doesn't handle holes)
    // Viewshed usually treats 0 as sea level. Let's default to a low value if needed, but 0 is fine.
    
    // Create a map for quick lookup: "z/x/y" -> tileData
    const tileMap = new Map();
    tiles.forEach(t => {
        tileMap.set(`${t.tile.z}/${t.tile.x}/${t.tile.y}`, t);
    });

    // Iterate relative grid positions: -1 to +1
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
        for (let colOffset = -1; colOffset <= 1; colOffset++) {
            // Target tile coords
            let tx = centerTile.x + colOffset;
            const ty = centerTile.y + rowOffset;
            const tz = centerTile.z;

            // Normalize tx for map lookup (handle wrapping)
            const maxTile = Math.pow(2, tz);
            const normalizedTx = ((tx % maxTile) + maxTile) % maxTile;

            // The tileMap keys are based on the fetched tiles, which were wrapped in getAdjacentTiles
            const tile = tileMap.get(`${tz}/${normalizedTx}/${ty}`);
            
            // Destination origin in stitched grid
            // rowOffset -1 -> index 0 (0 * 256)
            // rowOffset  0 -> index 1 (1 * 256)
            // rowOffset +1 -> index 2 (2 * 256)
            const destOffsetX = (colOffset + 1) * tileSize;
            const destOffsetY = (rowOffset + 1) * tileSize;

            if (tile) {
                // Copy row by row to ensure correct memory layout
                for (let r = 0; r < tileSize; r++) {
                    // Source range: r * tileSize to (r+1) * tileSize
                    const srcStart = r * tileSize;
                    const srcEnd = srcStart + tileSize;
                    const rowData = tile.elevation.subarray(srcStart, srcEnd);
                    
                    // Destination start: (destOffsetY + r) * stitchedWidth + destOffsetX
                    const destStart = (destOffsetY + r) * stitchedWidth + destOffsetX;
                    
                    stitchedData.set(rowData, destStart);
                }
            } else {
                // Tile missing (edge of map or failed load)
                // Leave as 0.0 or could fill with edge values if we wanted to be fancy
            }
        }
    }

    return {
        data: stitchedData,
        width: stitchedWidth,
        height: stitchedHeight
    };
}

// Transforms observer lat/lon to pixel coordinates within the stitched grid
export function transformObserverCoords(observerLat, observerLon, centerTile, stitchedWidth, stitchedHeight, tileSize = 256) {
    // 1. Get bounds of the CENTER tile
    const centerBounds = getTileBounds(centerTile.x, centerTile.y, centerTile.z);
    
    // 2. Determine pixels per degree (using the center tile as reference scale)
    // Note: Mercator pixels are not perfectly linear, but within a tile it's close enough for 3x3
    const latSpan = centerBounds.north - centerBounds.south;
    const lonSpan = centerBounds.east - centerBounds.west;
    
    const pixelsPerLon = tileSize / lonSpan;
    const pixelsPerLat = tileSize / latSpan;

    // 3. Calculate offset from Center Tile's North-West corner
    const lonDelta = observerLon - centerBounds.west;
    const latDelta = centerBounds.north - observerLat; // Latitude inverted (North is Up, Pixel 0 is Top)

    const localX = lonDelta * pixelsPerLon;
    const localY = latDelta * pixelsPerLat;

    // 4. Add offset to move to the center of the stitched grid
    // The center tile starts at (256, 256) in the 768x768 grid
    const stitchedX = tileSize + localX;
    const stitchedY = tileSize + localY;

    return {
        x: Math.floor(stitchedX),
        y: Math.floor(stitchedY)
    };
}

// Helper re-implemented here to avoid circular dependencies or need to import from hook
function getTileBounds(x, y, z) {
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
}

export function calculateStitchedBounds(centerTile) {
    // Top-Left tile: (-1, -1)
    const tl = { x: centerTile.x - 1, y: centerTile.y - 1, z: centerTile.z };
    // Bottom-Right tile: (+1, +1)
    const br = { x: centerTile.x + 1, y: centerTile.y + 1, z: centerTile.z };

    const tlBounds = getTileBounds(tl.x, tl.y, tl.z);
    const brBounds = getTileBounds(br.x, br.y, br.z);

    return {
        west: tlBounds.west,
        north: tlBounds.north,
        east: brBounds.east,
        south: brBounds.south
    };
}
