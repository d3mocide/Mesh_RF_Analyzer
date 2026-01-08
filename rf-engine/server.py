from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import rf_worker
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

from celery_config import celery_app
from rf_worker import run_analysis, optimize_location_task

# ... (AnalysisRequest model)

@app.post("/analyze-coverage")
async def analyze_coverage(req: AnalysisRequest):
    # Phase 3: Should also be queued, but kept sync for Phase 1/2 compat unless updated.
    # Let's keep sync for now as per prompt "return job_id" was for Task 2 Queue System.
    # The prompt says: "When the frontend requests a Heatmap, push the job to the queue immediately and return a job_id."
    
    # So we should convert this to async too?
    # For now, let's just queue optimize-location as requested in "Task 1: The Sieve Algorithm".
    # Wait, Task 2 says "When the frontend requests a Heatmap...".
    # I should queue both.
    
    task = celery_app.send_task('rf.analyze', args=[req.lat, req.lon, req.frequency_mhz, req.height_meters])
    return {"job_id": task.id, "status": "queued"}

@app.get("/status/{job_id}")
def get_status(job_id: str):
    from celery.result import AsyncResult
    res = AsyncResult(job_id, app=celery_app)
    if res.ready():
        return {"status": "finished", "result": res.result}
    return {"status": res.status}

class OptimizeRequest(BaseModel):
    min_lat: float
    min_lon: float
    max_lat: float
    max_lon: float
    frequency_mhz: float
    height_meters: float

@app.post("/optimize-location")
async def optimize_location(req: OptimizeRequest):
    task = celery_app.send_task('rf.optimize', args=[
        req.min_lat, req.min_lon, req.max_lat, req.max_lon,
        req.frequency_mhz, req.height_meters
    ])
    return {"job_id": task.id, "status": "queued"}


@app.get("/health")
def health_check():
    return {"status": "ok"}
