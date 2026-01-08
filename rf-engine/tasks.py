from celery_config import celery_app, REDIS_URL
import rf_worker
import redis
import json
import hashlib

# Export app for Celery CLI
app = celery_app

# Redis Client for Caching
cache = redis.Redis.from_url(REDIS_URL)

def get_cache_key(prefix, *args):
    # Create deterministic hash
    payload = json.dumps(args, sort_keys=True)
    return f"{prefix}:{hashlib.md5(payload.encode()).hexdigest()}"

@celery_app.task(name="rf.analyze", bind=True)
def analyze_task(self, lat, lon, freq, height):
    key = get_cache_key("analyze", lat, lon, freq, height)
    cached = cache.get(key)
    if cached:
        return json.loads(cached)
        
    result = rf_worker.run_analysis(lat, lon, freq, height)
    
    # Cache result for 24h
    if result.get("status") == "success":
        cache.setex(key, 86400, json.dumps(result))
        
    return result

@celery_app.task(name="rf.optimize", bind=True)
def optimize_task(self, min_lat, min_lon, max_lat, max_lon, freq, height):
    # Optimization might not be cached or maybe short term
    return rf_worker.optimize_location_task(min_lat, min_lon, max_lat, max_lon, freq, height)
