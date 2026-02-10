from fastapi import FastAPI
from pydantic import BaseModel
import io
from starlette.responses import Response
from PIL import Image
import numpy as np
import mercantile
import os
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="MeshRF Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for dev, or specify ["http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Dependencies ---
import redis
from tile_manager import TileManager
import rf_physics
from optimization_service import OptimizationService

# --- Initialization ---
REDIS_HOST = os.environ.get("REDIS_HOST", "redis")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0)
tile_manager = TileManager(redis_client)
optimization_service = OptimizationService(tile_manager)

class LinkRequest(BaseModel):
    tx_lat: float
    tx_lon: float
    rx_lat: float
    rx_lon: float
    frequency_mhz: float
    tx_height: float
    rx_height: float
    model: str = "bullington" # bullington, fspl
    environment: str = "suburban"
    k_factor: float = 1.333
    clutter_height: float = 0.0

@app.post("/calculate-link")
def calculate_link_endpoint(req: LinkRequest):
    """
    Synchronous endpoint for real-time link analysis.
    Uses cached TileManager to fetch elevation profile.
    """
    # Calculate distance between points
    dist_m = rf_physics.haversine_distance(
        req.tx_lat, req.tx_lon,
        req.rx_lat, req.rx_lon
    )
    
    # Get elevation profile along path
    elevs = tile_manager.get_elevation_profile(
        req.tx_lat, req.tx_lon,
        req.rx_lat, req.rx_lon,
        samples=100 # Increased samples for ITM accuracy
    )
    
    # Calculate Path Loss (ITM or FSPL)
    # Calculate Path Loss (Generic Dispatcher)
    path_loss_db = rf_physics.calculate_path_loss(
        dist_m,
        elevs,
        req.frequency_mhz,
        req.tx_height,
        req.rx_height,
        model=req.model,
        environment=req.environment,
        k_factor=req.k_factor,
        clutter_height=req.clutter_height
    )
    
    # Analyze link with correct signature
    result = rf_physics.analyze_link(
        elevs,
        dist_m,
        req.frequency_mhz,
        req.tx_height,
        req.rx_height,
        k_factor=req.k_factor,
        clutter_height=req.clutter_height
    )
    
    result['path_loss_db'] = float(path_loss_db)
    result['model_used'] = req.model
    
    return result

class ElevationRequest(BaseModel):
    lat: float
    lon: float

@app.post("/get-elevation")
def get_elevation_endpoint(req: ElevationRequest):
    """
    Get elevation for a single point.
    """
    elevation = tile_manager.get_elevation(req.lat, req.lon)
    return {"elevation": elevation}


class BatchElevationRequest(BaseModel):
    locations: str  # Pipe-separated "lat,lng|lat,lng|..."
    dataset: str = "ned10m"

@app.post("/elevation-batch")
def get_batch_elevation(req: BatchElevationRequest):
    """
    Batch elevation lookup for frontend path profiles.
    Used for optimized path profiles.
    """
    try:
        # Parse locations
        coords = []
        for loc in req.locations.split('|'):
            if not loc.strip(): continue
            parts = loc.split(',')
            if len(parts) == 2:
                lat, lng = map(float, parts)
                coords.append((lat, lng))
        
        # Fetch elevations in parallel
        elevs = tile_manager.get_elevations_batch(coords)
        
        results = []
        for i, (lat, lon) in enumerate(coords):
            results.append({
                "elevation": elevs[i],
                "location": {"lat": lat, "lng": lon}
            })
        
        return {
            "status": "OK",
            "results": results
        }
    except Exception as e:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=400,
            content={"status": "INVALID_REQUEST", "error": str(e)}
        )


@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/tiles/{z}/{x}/{y}.png")
def get_elevation_tile(z: int, x: int, y: int):
    """
    Serve elevation data as Terrain-RGB tiles.
    Format: height = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
    """
    grid = tile_manager.get_interpolated_grid(x, y, z, size=256)
    
    # Encode to Terrain-RGB format
    # h = -10000 + (v * 0.1) => v = (h + 10000) * 10
    h_scaled = (grid + 10000) * 10
    h_scaled = np.clip(h_scaled, 0, 16777215) # Clip to 24-bit max
    h_scaled = h_scaled.astype(np.uint32)
    
    r = (h_scaled >> 16) & 0xFF
    g = (h_scaled >> 8) & 0xFF
    b = h_scaled & 0xFF
    
    rgb = np.stack((r, g, b), axis=-1).astype(np.uint8)
    
    img = Image.fromarray(rgb, mode='RGB')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    
    return Response(content=buf.getvalue(), media_type="image/png")



# --- Async Task Endpoints ---

@app.post("/scan/start")
def start_scan_endpoint(req: dict):
    """
    Start asynchronous batch viewshed scan (Celery).
    """
    from tasks.viewshed import calculate_batch_viewshed
    
    nodes = req.get("nodes", [])
    optimize_n = req.get("optimize_n", None)
    
    if not nodes:
        return {"status": "error", "message": "No nodes provided"}

    # Start Celery Task
    task = calculate_batch_viewshed.delay({
        "nodes": nodes,
        "options": {
            "radius": req.get("radius", 5000),
            "optimize_n": optimize_n,
            "frequency_mhz": req.get("frequency_mhz", 915.0),
            "rx_height": req.get("rx_height", 2.0),
            "k_factor": req.get("k_factor", 1.333),
            "clutter_height": req.get("clutter_height", 0.0)
        }
    })
    
    return {"status": "started", "task_id": task.id}


@app.get("/task_status/{task_id}")
async def task_status_endpoint(task_id: str):
    """
    SSE Endpoint for Task Progress.
    """
    from sse_starlette.sse import EventSourceResponse
    from celery.result import AsyncResult
    from worker import celery_app
    import json
    import asyncio

    async def event_generator():
        task = AsyncResult(task_id, app=celery_app)
        while True:
            # Check status
            if task.state == 'PENDING':
                yield json.dumps({"event": "progress", "data": {"progress": 0}})
            elif task.state == 'PROGRESS':
                meta = task.info or {}
                yield json.dumps({"event": "progress", "data": meta})
            elif task.state == 'SUCCESS':
                yield json.dumps({"event": "complete", "data": task.result})
                break
            elif task.state == 'FAILURE':
                yield json.dumps({"event": "error", "data": str(task.info)})
                break
            
            await asyncio.sleep(0.5)

    return EventSourceResponse(event_generator())


class OptimizeRequest(BaseModel):
    min_lat: float
    min_lon: float
    max_lat: float
    max_lon: float
    frequency_mhz: float
    tx_height: float
    rx_height: float = 2.0
    k_factor: float = 1.333
    clutter_height: float = 0.0
    return_heatmap: bool = False
    weights: dict = {"elevation": 0.5, "prominence": 0.3, "fresnel": 0.2}
    existing_nodes: list = [] # List of {lat, lon, height}

@app.post("/optimize-location")
def optimize_location_endpoint(req: OptimizeRequest):
    """
    Find best location using multi-criteria analysis (elevation, prominence, fresnel).
    """
    try:
        # Adaptive Grid
        # Calculate dimensions in km
        dist_lat_km = rf_physics.haversine_distance(req.min_lat, req.min_lon, req.max_lat, req.min_lon) / 1000.0
        dist_lon_km = rf_physics.haversine_distance(req.min_lat, req.min_lon, req.min_lat, req.max_lon) / 1000.0
        
        # Target resolution: 150m (0.15 km)
        target_res_km = 0.15
        
        steps_lat = int(dist_lat_km / target_res_km)
        steps_lon = int(dist_lon_km / target_res_km)
        
        # Safety Caps (Min 10, Max 50 -> 2500 points max)
        steps_lat = max(10, min(50, steps_lat))
        steps_lon = max(10, min(50, steps_lon))
        
        lat_step = (req.max_lat - req.min_lat) / steps_lat
        lon_step = (req.max_lon - req.min_lon) / steps_lon
        
        coords = []
        for i in range(steps_lat + 1):
            for j in range(steps_lon + 1):
                lat = req.min_lat + (i * lat_step)
                lon = req.min_lon + (j * lon_step)
                coords.append((lat, lon))
                
        # Batch fetch elevations
        elevs = tile_manager.get_elevations_batch(coords)
        
        candidates = []
        for i, (lat, lon) in enumerate(coords):
            # Basic Candidate
            cand = {
                "lat": lat, 
                "lon": lon, 
                "elevation": elevs[i]
            }
            # Score Components
            metrics = optimization_service.score_candidate(
                cand, 
                req.weights, 
                req.existing_nodes,
                tx_height=req.tx_height,
                rx_height=req.rx_height,
                freq_mhz=req.frequency_mhz,
                k_factor=req.k_factor,
                clutter_height=req.clutter_height
            )
            cand.update(metrics) # Adds prominence, fresnel
            candidates.append(cand)

        # Normalize and Calculate Final Score
        if not candidates:
             return {"status": "success", "locations": []}
             
        max_elev = max([c['elevation'] for c in candidates]) or 1.0
        max_prom = max([c['prominence'] for c in candidates]) or 1.0
        # Fresnel is already 0-1
        
        w_elev = req.weights.get("elevation", 0.3)
        w_prom = req.weights.get("prominence", 0.4)
        w_fres = req.weights.get("fresnel", 0.3)
        
        for c in candidates:
            norm_elev = c['elevation'] / max_elev if max_elev > 0 else 0
            norm_prom = c['prominence'] / max_prom if max_prom > 0 else 0
            
            c['score'] = (norm_elev * w_elev) + (norm_prom * w_prom) + (c['fresnel'] * w_fres)
            # Scale to 0-100 for display
            c['score'] = round(c['score'] * 100, 1)

        # Sort by Score desc
        candidates.sort(key=lambda x: x["score"], reverse=True)
        
        # Take top 5 for "Ghost Nodes"
        top_results = candidates[:5]

        response = {
            "status": "success",
            "locations": top_results,
            "metadata": {
                "max_elevation": max_elev,
                "max_prominence": max_prom
            }
        }
        
        if req.return_heatmap:
            # Send simplified data for heatmap (lat, lon, score)
            # To save bandwidth, maybe round lat/lon?
            heatmap_data = [
                {"lat": round(c['lat'], 5), "lon": round(c['lon'], 5), "score": c['score']}
                for c in candidates
            ]
            response["heatmap"] = heatmap_data

        return response
    except Exception as e:
        print(f"Optimize Error: {e}")
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=500, 
            content={"status": "error", "message": f"Server Error: {str(e)}"}
        )

class ExportRequest(BaseModel):
    locations: list
    format: str = "csv" # csv, kml

@app.post("/export-results")
def export_results_endpoint(req: ExportRequest):
    """
    Generate export file for site candidates.
    """
    from api.export import generate_csv, generate_kml
    
    if req.format == "kml":
        content = generate_kml(req.locations)
        media_type = "application/vnd.google-earth.kml+xml"
        filename = "rf_scan_results.kml"
    else:
        content = generate_csv(req.locations)
        media_type = "text/csv"
        filename = "rf_scan_results.csv"
        
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
