import numpy as np
import math
import heapq
from rf_physics import haversine_distance, calculate_path_loss

def calculate_viewshed(tile_manager, tx_lat, tx_lon, tx_h, radius_m, rx_h=2.0, freq_mhz=915.0, resolution_m=30, model='bullington'):
    """
    Calculate viewshed for a single point.
    Returns: (lat_grid, lon_grid, visibility_grid)
    """
    # 1. Define Bounds
    lat_deg_per_m = 1 / 111320.0
    lon_deg_per_m = 1 / (111320.0 * math.cos(math.radians(tx_lat)))
    
    lat_radius = radius_m * lat_deg_per_m
    lon_radius = radius_m * lon_deg_per_m
    
    min_lat, max_lat = tx_lat - lat_radius, tx_lat + lat_radius
    min_lon, max_lon = tx_lon - lon_radius, tx_lon + lon_radius
    
    # 2. Define Grid Resolution
    # Use coarse grid for performance (e.g. 100m)
    eff_res_m = max(resolution_m, 100)
    
    rows = int((max_lat - min_lat) / (eff_res_m * lat_deg_per_m))
    cols = int((max_lon - min_lon) / (eff_res_m * lon_deg_per_m))
    
    # Safety Cap
    rows = min(rows, 250)
    cols = min(cols, 250)
    
    lats = np.linspace(min_lat, max_lat, rows)
    lons = np.linspace(min_lon, max_lon, cols)
    
    grid = np.zeros((rows, cols))
    
    # 3. Iterate and Check LOS
    # This is O(N*M), where N*M ~ 2500-10000. 
    # Profile fetch is expensive.
    
    # Optimization: Only check points within radius
    for r in range(rows):
        for c in range(cols):
            # Distance Check
            dist_m = haversine_distance(tx_lat, tx_lon, lats[r], lons[c])
            if dist_m > radius_m or dist_m < 10: 
                continue
            
            # Get Profile
            # Use fewer samples for speed (e.g. 15). 
            # 15 samples over 5km = ~300m resolution profile. sufficient for large obstacles.
            try:
                profile = tile_manager.get_elevation_profile(
                    tx_lat, tx_lon, lats[r], lons[c], samples=15
                )
                
                # Analyze Link
                # True LOS check via analyze_link (checks Fresnel/Clearance)
                # If we want pure Visual LOS, we check if min_clearance_ratio >= 0 (ignoring Fresnel zone size, just line)
                # analyze_link calculates clearance relative to Fresnel zone.
                # If we strictly want Visual LOS: clearance > 0.
                # analyze_link returns 'min_clearance_ratio' = clearance / fresnel_radius
                # So ratio >= 0 means clearance >= 0 means Visible.
                
                link = rf_physics.analyze_link(profile, dist_m, freq_mhz, tx_h, rx_h)
                
                if link['min_clearance_ratio'] >= 0.0:
                    grid[r, c] = 1.0 # Visible
                    
            except Exception as e:
                # Fallback or skip
                continue
            
    return grid, lats, lons

def greedy_coverage(tile_manager, candidates, n_select, radius_m=5000, rx_h=2.0, freq_mhz=915.0, model='bullington'):
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
            tile_manager, node.lat, node.lon, node.height, radius_m,
            rx_h=rx_h, freq_mhz=freq_mhz, model=model
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
