from fastapi import FastAPI, HTTPException
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

class AnalysisRequest(BaseModel):
    lat: float
    lon: float
    frequency_mhz: float
    height_meters: float

# --- Dependencies ---
import redis
from tile_manager import TileManager
import rf_physics
from rf_physics import analyze_link

# --- Initialization ---
REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
redis_client = redis.Redis.from_url(REDIS_URL)
tile_manager = TileManager(redis_client)

# Legacy Endpoints Removed (analyze-coverage, optimize-location, etc.)
# Logic moved to Wasm.

class LinkRequest(BaseModel):
    tx_lat: float
    tx_lon: float
    rx_lat: float
    rx_lon: float
    frequency_mhz: float
    tx_height: float
    rx_height: float


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
        samples=50
    )
    
    # Analyze link with correct signature
    result = rf_physics.analyze_link(
        elevs,
        dist_m,
        req.frequency_mhz,
        req.tx_height,
        req.rx_height
    )
    
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


class OptimizeRequest(BaseModel):
    min_lat: float
    min_lon: float
    max_lat: float
    max_lon: float
    frequency_mhz: float
    height_meters: float

@app.post("/optimize-location")
def optimize_location_endpoint(req: OptimizeRequest):
    """
    Find the best location (highest elevation) within the bounding box.
    Heuristic: Higher is generally better for RF coverage.
    """
    try:
        # Grid search (10x10)
        steps = 10
        lat_step = (req.max_lat - req.min_lat) / steps
        lon_step = (req.max_lon - req.min_lon) / steps
        
        coords = []
        for i in range(steps + 1):
            for j in range(steps + 1):
                lat = req.min_lat + (i * lat_step)
                lon = req.min_lon + (j * lon_step)
                coords.append((lat, lon))
                
        # Batch fetch elevations
        elevs = tile_manager.get_elevations_batch(coords)
        
        candidates = []
        for i, (lat, lon) in enumerate(coords):
            candidates.append({
                "lat": lat, 
                "lon": lon, 
                "elevation": elevs[i],
                "score": elevs[i] 
            })

        # Sort by elevation desc
        candidates.sort(key=lambda x: x["elevation"], reverse=True)
        
        # Take top 5
        top_results = candidates[:5]

        return {
            "status": "success",
            "locations": top_results
        }
    except Exception as e:
        print(f"Optimize Error: {e}")
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=500, 
            content={"status": "error", "message": f"Server Error: {str(e)}"}
        )
