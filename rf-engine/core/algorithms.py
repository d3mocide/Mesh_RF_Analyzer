import numpy as np
import math
import heapq
from rf_physics import haversine_distance, calculate_path_loss

def calculate_viewshed(tile_manager, tx_lat, tx_lon, tx_h, radius_m, resolution_m=30, model='bullington'):
    """
    Calculate viewshed for a single point.
    Returns: (lat_grid, lon_grid, visibility_grid)
    Simple implementations for Phase 1.
    """
    # 1. Define Bounds
    lat_deg_per_m = 1 / 111320.0
    lon_deg_per_m = 1 / (111320.0 * math.cos(math.radians(tx_lat)))
    
    lat_radius = radius_m * lat_deg_per_m
    lon_radius = radius_m * lon_deg_per_m
    
    min_lat, max_lat = tx_lat - lat_radius, tx_lat + lat_radius
    min_lon, max_lon = tx_lon - lon_radius, tx_lon + lon_radius
    
    # 2. Create Grid
    rows = int((max_lat - min_lat) / (resolution_m * lat_deg_per_m))
    cols = int((max_lon - min_lon) / (resolution_m * lon_deg_per_m))
    
    lats = np.linspace(min_lat, max_lat, rows)
    lons = np.linspace(min_lon, max_lon, cols)
    
    # 3. Fetch Elevation for Grid Points (Batch)
    # Optimization: Chunk this if too large. For 5km radius, ~10km box, ~300x300 points = 90k points.
    # TileManager.get_elevations_batch handles logic, but 90k is a lot for HTTP even with batching.
    # Better approach: Fetch Tiles, Stitch, Interpolate locally.
    
    # For Phase 1: Use a sparse sampling or just center tile for speed if we don't have local stitching yet.
    # Wait, TileManager has get_interpolated_grid! 
    # Let's verify which tiles we need.
    
    # Identify unique tiles covering the bounds
    import mercantile
    zoom = tile_manager.zoom
    tl_tile = mercantile.tile(min_lon, max_lat, zoom)
    br_tile = mercantile.tile(max_lon, min_lat, zoom)
    
    tiles = []
    for x in range(tl_tile.x, br_tile.x + 1):
        for y in range(tl_tile.y, br_tile.y + 1):
            tiles.append((x, y, zoom))
            
    # Fetch all grids
    # This assumes we stitch them. 
    # Simpler fallback for Phase 1: Just calculate for a list of target points (Start with just checking visibility to user provided candidates? No, viewshed is area).
    
    # Use existing point-to-point physics for now on a downsampled grid (e.g. 100m resolution)
    # 5000m radius / 100m = 50x50 grid = 2500 points. Tolerable.
    
    rows_coarse = int(rows / 3) # ~100m res
    cols_coarse = int(cols / 3)
    
    lats = np.linspace(min_lat, max_lat, rows_coarse)
    lons = np.linspace(min_lon, max_lon, cols_coarse)
    
    grid = np.zeros((rows_coarse, cols_coarse))
    
    coords = []
    indices = []
    for r in range(rows_coarse):
        for c in range(cols_coarse):
            dist = haversine_distance(tx_lat, tx_lon, lats[r], lons[c])
            if dist <= radius_m:
                coords.append((lats[r], lons[c]))
                indices.append((r, c))
    
    # Batch Elevation Fetch
    elevs = tile_manager.get_elevations_batch(coords)
    
    # Source Elevation
    source_elev = tile_manager.get_elevation(tx_lat, tx_lon)
    tx_alt = source_elev + tx_h
    
    for i, (r, c) in enumerate(indices):
        rx_elev = elevs[i]
        rx_alt = rx_elev + 2.0 # Assume receiver at 2m
        
        # Simple LOS check (Line of Sight)
        # We need the profile between TX and RX to check clearance.
        # This is expensive (N^2/2 complexityish).
        # For greedy placement, we might just use "Radio Horizon" or simple FSPL + Hata first.
        
        # Phase 1: Hata Model only (Terrain Independent mostly, except for height corrections)
        dist_m = haversine_distance(tx_lat, tx_lon, lats[r], lons[c])
        loss = calculate_path_loss(dist_m, [], 915.0, tx_h, 2.0, model=model, environment='suburban')
        
        # Max Path Loss (Sensitivity) ~ 120-130 dB for LoRa
        if loss < 128.0:
            grid[r, c] = 1.0
            
    return grid, lats, lons

def greedy_coverage(tile_manager, candidates, n_select, radius_m=5000, model='bullington'):
    """
    Select N nodes that maximize coverage area.
    candidates: List of NodeConfig objects
    """
    selected_indices = []
    current_coverage = set() # Set of covered grid indices (global coordinate space?)
    
    # Pre-calculate individual viewsheds
    viewsheds = []
    for node in candidates:
        grid, grid_lats, grid_lons = calculate_viewshed(
            tile_manager, node.lat, node.lon, node.height, radius_m
        )
        # Store as set of "covered buckets" to allow union
        # Simple bucket hashing: (lat_idx, lon_idx) approx
        covered_points = set()
        rows, cols = grid.shape
        for r in range(rows):
            for c in range(cols):
                if grid[r, c] > 0:
                    # Create a unique spatially aware hash
                    # Round lat/lon to ~100m precision (3 decimal places)
                    lat_key = round(grid_lats[r], 3)
                    lon_key = round(grid_lons[c], 3)
                    covered_points.add((lat_key, lon_key))
        viewsheds.append(covered_points)
        
    # Greedy Selection
    for _ in range(num_nodes):
        best_idx = -1
        best_gain = 0
        
        for i in range(len(candidates)):
            if i in selected_indices: continue
            
            # Calculate gain (marginal coverage)
            new_points = viewsheds[i] - current_coverage
            gain = len(new_points)
            
            if gain > best_gain:
                best_gain = gain
                best_idx = i
                
        if best_idx != -1:
            selected_indices.append(best_idx)
            current_coverage.update(viewsheds[best_idx])
        else:
            break
            
    return [candidates[i] for i in selected_indices]
