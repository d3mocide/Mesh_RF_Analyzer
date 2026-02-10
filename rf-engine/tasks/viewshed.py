from worker import celery_app
import time
import numpy as np

import os
import redis
import json
from celery.utils.log import get_task_logger
from core.algorithms import calculate_viewshed
from tile_manager import TileManager
from models import NodeConfig
import rf_physics

logger = get_task_logger(__name__)

# Re-init redis/tile_manager here for worker context
# Or use the one from worker.py if we move it there.
# Better to init fresh to avoid fork safety issues with connections.
REDIS_HOST = os.environ.get("REDIS_HOST", "redis")
redis_client = redis.Redis(host=REDIS_HOST, port=6379, db=0)
tile_manager = TileManager(redis_client)

@celery_app.task(bind=True)
def calculate_batch_viewshed(self, params):
    """
    Calculate viewsheds for a list of nodes.
    params: { "nodes": [ {lat, lon, height, ...} ], "options": {"radius": 5000, "optimize_n": 3} }
    """
    from core.algorithms import calculate_viewshed
    import base64
    from io import BytesIO
    from PIL import Image

    logger.info(f"Starting batch viewshed for {len(params.get('nodes', []))} nodes")
    self.update_state(state='PROGRESS', meta={'progress': 0, 'message': 'Initializing...'})
    
    nodes_data = params.get('nodes', [])
    options = params.get('options', {})
    radius = options.get('radius', 5000)
    optimize_n = options.get('optimize_n')
    rx_height = options.get('rx_height', 2.0)
    freq = options.get('frequency_mhz', 915.0)
    
    # 1. Determine Bounding Box for Composite
    if not nodes_data:
        return {"status": "completed", "results": []}

    # Helper to convert deg to m approx
    # 1 deg lat = 111,320m
    buffer_deg = (radius + 1000) / 111320.0 
    
    min_lat = min(n['lat'] for n in nodes_data) - buffer_deg
    max_lat = max(n['lat'] for n in nodes_data) + buffer_deg
    min_lon = min(n['lon'] for n in nodes_data) - buffer_deg
    max_lon = max(n['lon'] for n in nodes_data) + buffer_deg
    
    # Define Global Master Grid (e.g. 100m resolution)
    res_m = 100
    rows = int((max_lat - min_lat) / (res_m / 111320.0))
    cols = int((max_lon - min_lon) / (res_m / 111320.0))
    
    # Cap size to prevent OOM
    rows = min(rows, 1024)
    cols = min(cols, 1024)
    
    master_grid = np.zeros((rows, cols), dtype=np.uint8)
    
    # Coordinate mapping functions
    def lat_to_y(lat):
        return int((max_lat - lat) / (max_lat - min_lat) * (rows - 1))
    def lon_to_x(lon):
        return int((lon - min_lon) / (max_lon - min_lon) * (cols - 1))

    # Pre-calculate individual viewsheds if we need to optimize
    # Or just calculate all and keep track of visibility
    all_node_results = []
    
    total = len(nodes_data)
    for i, node_data in enumerate(nodes_data):
        try:
            lat = node_data.get('lat')
            lon = node_data.get('lon')
            height = node_data.get('height', 10)
            
            # Simple viewshed
            grid, grid_lats, grid_lons = calculate_viewshed(
                tile_manager, lat, lon, height, radius, 
                rx_h=rx_height, freq_mhz=freq, resolution_m=res_m
            )
            
            coverage_count = int(np.sum(grid))
            source_elev = tile_manager.get_elevation(lat, lon)
            
            node_res = {
                "lat": lat, "lon": lon,
                "name": node_data.get('name', f'Site {i + 1}'),
                "height": height,
                "elevation": round(float(source_elev), 1),
                "coverage_area_km2": round((coverage_count * (res_m * res_m)) / 1_000_000.0, 2),
                "grid": grid,
                "grid_lats": grid_lats,
                "grid_lons": grid_lons
            }
            all_node_results.append(node_res)
            
            progress = int((i + 1) / total * 50) # First 50% for individual calcs
            self.update_state(state='PROGRESS', meta={'progress': progress, 'message': f'Analyzed candidates {i+1}/{total}'})
            
        except Exception as e:
            logger.error(f"Error processing node {i}: {e}")

    # 2. Greedy Optimization (Marginal Gain)
    selected_results = all_node_results
    if optimize_n and 0 < optimize_n < len(all_node_results):
        selected_results = []
        covered_points = set() # Set of (y, x) tuples on master_grid
        
        # Pre-compute pixel sets for all candidates
        candidate_sets = []
        for res in all_node_results:
            pixels = set()
            g = res['grid']
            lats = res['grid_lats']
            lons = res['grid_lons']
            
            # Optimization: Vectorize or iterate fast
            # Since grids are small (local viewshed), iteration is okay-ish
            # But let's try to be efficient.
            # Grid indices to lat/lon -> master y/x
            
            # Get indices where grid > 0
            visible_indices = np.argwhere(g > 0)
            
            for r, c in visible_indices:
                # Map local grid lat/lon to master grid y/x
                # Note: lat/lon arrays in res might be 1D 
                pixel_lat = lats[r]
                pixel_lon = lons[c]
                
                y = lat_to_y(pixel_lat)
                x = lon_to_x(pixel_lon)
                
                if 0 <= y < rows and 0 <= x < cols:
                    pixels.add((y, x))
            
            candidate_sets.append(pixels)

        # Greedy Loop
        remaining_indices = list(range(len(all_node_results)))
        
        for _ in range(optimize_n):
            best_idx = -1
            best_marginal_gain = -1
            
            for idx in remaining_indices:
                cand_pixels = candidate_sets[idx]
                # Calculate new pixels that are NOT in covered_points
                # len(cand_pixels - covered_points)
                # Set difference is fast
                new_coverage = len(cand_pixels.difference(covered_points))
                
                if new_coverage > best_marginal_gain:
                    best_marginal_gain = new_coverage
                    best_idx = idx
            
            if best_idx != -1 and best_marginal_gain > 0:
                selected_results.append(all_node_results[best_idx])
                covered_points.update(candidate_sets[best_idx])
                remaining_indices.remove(best_idx)
            else:
                # No more gain to be had (or empty)
                break

    # 3. Compute marginal coverage for each selected node (in selection order)
    covered_so_far = set()
    for res in selected_results:
        g = res['grid']
        lats_g = res['grid_lats']
        lons_g = res['grid_lons']
        visible_indices = np.argwhere(g > 0)
        node_pixels = set()
        for r, c in visible_indices:
            y = lat_to_y(lats_g[r])
            x = lon_to_x(lons_g[c])
            if 0 <= y < rows and 0 <= x < cols:
                node_pixels.add((y, x))
        marginal_pixels = len(node_pixels - covered_so_far)
        covered_so_far.update(node_pixels)
        res['marginal_coverage_km2'] = round((marginal_pixels * (res_m * res_m)) / 1_000_000.0, 2)

    total_unique_km2 = round((len(covered_so_far) * (res_m * res_m)) / 1_000_000.0, 2)
    for res in selected_results:
        total_cov = res['coverage_area_km2']
        res['unique_coverage_pct'] = round(
            (res['marginal_coverage_km2'] / total_cov * 100) if total_cov > 0 else 0.0, 1
        )

    # 3a. Compute pairwise inter-node link quality
    self.update_state(state='PROGRESS', meta={'progress': 55, 'message': 'Analyzing inter-node links...'})
    inter_node_links = []
    n_selected = len(selected_results)
    for i in range(n_selected):
        for j in range(i + 1, n_selected):
            node_a = selected_results[i]
            node_b = selected_results[j]
            try:
                dist_m = rf_physics.haversine_distance(
                    node_a['lat'], node_a['lon'],
                    node_b['lat'], node_b['lon']
                )
                elevs = tile_manager.get_elevation_profile(
                    node_a['lat'], node_a['lon'],
                    node_b['lat'], node_b['lon'],
                    samples=50
                )
                h_a = node_a.get('height', 10.0)
                h_b = node_b.get('height', 10.0)
                link_result = rf_physics.analyze_link(
                    elevs, dist_m, freq, h_a, h_b,
                    k_factor=options.get('k_factor', 1.333),
                    clutter_height=options.get('clutter_height', 0.0)
                )
                path_loss_db = rf_physics.calculate_path_loss(
                    dist_m, elevs, freq, h_a, h_b,
                    model='bullington',
                    k_factor=options.get('k_factor', 1.333),
                    clutter_height=options.get('clutter_height', 0.0)
                )
                inter_node_links.append({
                    "node_a_idx": i,
                    "node_b_idx": j,
                    "node_a_name": node_a.get('name', f'Site {i + 1}'),
                    "node_b_name": node_b.get('name', f'Site {j + 1}'),
                    "dist_km": round(dist_m / 1000, 2),
                    "status": link_result['status'],
                    "path_loss_db": round(float(path_loss_db), 1),
                    "min_clearance_ratio": round(float(link_result['min_clearance_ratio']), 2)
                })
            except Exception as e:
                logger.error(f"Link analysis failed for nodes {i}-{j}: {e}")
                inter_node_links.append({
                    "node_a_idx": i,
                    "node_b_idx": j,
                    "node_a_name": selected_results[i].get('name', f'Site {i + 1}'),
                    "node_b_name": selected_results[j].get('name', f'Site {j + 1}'),
                    "dist_km": 0,
                    "status": "unknown",
                    "path_loss_db": 0,
                    "min_clearance_ratio": 0
                })

    # 4. Blit to Master Grid and generate Composite
    for res in selected_results:
        g = res['grid']
        lats = res['grid_lats']
        lons = res['grid_lons']
        
        for r in range(g.shape[0]):
            for c in range(g.shape[1]):
                if g[r, c] > 0:
                    y = lat_to_y(lats[r])
                    x = lon_to_x(lons[c])
                    if 0 <= y < rows and 0 <= x < cols:
                        master_grid[y, x] = 255 # Visible
                        
    # 4. Generate PNG Base64
    img = Image.fromarray(master_grid, mode='L')
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    # 5. Build Final Output
    final_results = []
    for idx, res in enumerate(selected_results):
        final_results.append({
            "lat": res["lat"],
            "lon": res["lon"],
            "name": res.get("name", f"Site {idx + 1}"),
            "elevation": res["elevation"],
            "coverage_area_km2": res["coverage_area_km2"],
            "marginal_coverage_km2": res.get("marginal_coverage_km2", res["coverage_area_km2"]),
            "unique_coverage_pct": res.get("unique_coverage_pct", 100.0)
        })

    # Compute connectivity score per node (# of viable/degraded links)
    connectivity = [0] * len(final_results)
    for link in inter_node_links:
        if link["status"] in ("viable", "degraded"):
            connectivity[link["node_a_idx"]] += 1
            connectivity[link["node_b_idx"]] += 1
    for idx, res in enumerate(final_results):
        res["connectivity_score"] = connectivity[idx]

    return {
        "status": "completed",
        "results": final_results,
        "inter_node_links": inter_node_links,
        "total_unique_coverage_km2": total_unique_km2,
        "composite": {
            "image": f"data:image/png;base64,{img_str}",
            "bounds": [min_lat, min_lon, max_lat, max_lon]
        }
    }

