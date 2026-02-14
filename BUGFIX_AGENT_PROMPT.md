# MeshRF Comprehensive Bugfix Agent Prompt

You are fixing all verified bugs in the MeshRF codebase — a React frontend + Python (FastAPI/Celery) backend for RF mesh network planning. Work through every fix below in order. After each fix, verify the change doesn't break imports or syntax. Do NOT add features, refactor style, or touch code outside the scope of each fix.

---

## PHASE 1: CRITICAL BACKEND FIXES

### Fix 1 — SSE endpoint infinite loop (server.py)

**File:** `/home/user/MeshRF/rf-engine/server.py` — `task_status_endpoint()` (~line 281)

**Problem:** The `event_generator()` async generator loops `while True` polling a Celery task with `await asyncio.sleep(0.5)`. If the task ID doesn't exist or the worker dies, this loops forever, holding an open HTTP connection indefinitely.

**Fix:** Add a max iteration count (e.g. 600 iterations = 5 minutes at 0.5s interval). After exceeding it, yield a timeout error event and break.

```python
async def event_generator():
    task = AsyncResult(task_id, app=celery_app)
    max_polls = 600  # 5 minutes at 0.5s
    polls = 0
    while polls < max_polls:
        polls += 1
        if task.state == 'PENDING':
            yield json.dumps({"event": "progress", "data": {"progress": 0}})
        elif task.state == 'PROGRESS':
            meta = task.info or {}
            yield json.dumps({"event": "progress", "data": meta})
        elif task.state == 'SUCCESS':
            yield json.dumps({"event": "complete", "data": task.result})
            return
        elif task.state == 'FAILURE':
            yield json.dumps({"event": "error", "data": str(task.info)})
            return
        await asyncio.sleep(0.5)
    yield json.dumps({"event": "error", "data": "Task timed out after 5 minutes"})
```

---

### Fix 2 — Silent exception swallowing in viewshed loop (core/algorithms.py)

**File:** `/home/user/MeshRF/rf-engine/core/algorithms.py` — `calculate_viewshed()` (~line 76)

**Problem:** The inner grid loop catches `Exception` and silently `continue`s. A broken tile server, network failure, or bad data produces an empty-looking viewshed with zero indication of failure.

**Fix:** Add a logger import and log warnings. Also track error count and log a summary after the loop.

```python
# At top of file, add:
import logging
logger = logging.getLogger(__name__)

# Replace the bare except block (lines 76-78):
except Exception as e:
    error_count += 1
    if error_count <= 3:
        logger.warning(f"Viewshed cell ({r},{c}) failed: {e}")
    continue
```

Add `error_count = 0` before the loop, and after the loop:

```python
if error_count > 0:
    logger.warning(f"Viewshed completed with {error_count} failed cells out of {rows * cols}")
```

Also remove the `print()` statement on line 27 and replace it with `logger.warning(...)`.

---

### Fix 3 — `analyze_link()` false-positive on empty loops (rf_physics.py)

**File:** `/home/user/MeshRF/rf-engine/rf_physics.py` — `analyze_link()` (~line 179)

**Problem:** `min_clearance_ratio` initializes to `100.0`. If all loop iterations are skipped by `if d1 < 1 or d2 < 1: continue`, the function returns 100.0 — reporting a perfect link when no points could actually be evaluated.

**Fix:** Track whether any point was evaluated. If not, set `min_clearance_ratio` to `0.0` (unknown/unverifiable):

```python
min_clearance_ratio = 100.0
evaluated = False

for i in range(num_points):
    d1 = dists[i]
    d2 = dist_m - d1
    if d1 < 1 or d2 < 1: continue
    evaluated = True
    f1 = calculate_fresnel_zone(dist_m, freq_mhz, d1, d2)
    ratio = clearance[i] / f1
    if ratio < min_clearance_ratio:
        min_clearance_ratio = ratio

if not evaluated:
    min_clearance_ratio = 0.0
```

---

### Fix 4 — ThreadPoolExecutors never shut down (tile_manager.py)

**File:** `/home/user/MeshRF/rf-engine/tile_manager.py` (~line 27)

**Problem:** Two `ThreadPoolExecutor` instances (10 + 30 workers) created in `__init__` but never shut down. On app restart/hot-reload, threads leak.

**Fix:** Add a `shutdown()` method and a `__del__` fallback:

```python
def shutdown(self):
    """Shutdown thread pools gracefully."""
    self.tile_executor.shutdown(wait=False)
    self.batch_executor.shutdown(wait=False)

def __del__(self):
    try:
        self.shutdown()
    except Exception:
        pass
```

---

### Fix 5 — `future.result()` called without timeout (tile_manager.py)

**File:** `/home/user/MeshRF/rf-engine/tile_manager.py` — all `future.result()` calls

**Problem:** If a thread hangs fetching a tile, the caller blocks indefinitely.

**Fix:** Add a 30-second timeout to every `future.result()` call:

```python
# Find every occurrence of:
batch_result = future.result()
# Replace with:
batch_result = future.result(timeout=30)
```

Wrap these in try/except to handle `TimeoutError` and `concurrent.futures.TimeoutError`:

```python
try:
    batch_result = future.result(timeout=30)
except Exception as e:
    logger.error(f"Tile fetch timed out or failed: {e}")
    continue  # or handle appropriately based on context
```

---

### Fix 6 — Unbounded tile_locks dictionary (tile_manager.py)

**File:** `/home/user/MeshRF/rf-engine/tile_manager.py` (~line 31)

**Problem:** `self.tile_locks` grows forever — every unique tile key creates a `threading.Lock()` that's never removed.

**Fix:** Replace the plain dict with an `OrderedDict` acting as an LRU, capped at 1000 entries:

```python
from collections import OrderedDict

# In __init__:
self.tile_locks = OrderedDict()
self._max_locks = 1000

# In get_tile_data(), replace the lock acquisition block:
with self.global_lock:
    if tile_key not in self.tile_locks:
        if len(self.tile_locks) >= self._max_locks:
            self.tile_locks.popitem(last=False)  # Remove oldest
        self.tile_locks[tile_key] = threading.Lock()
    else:
        self.tile_locks.move_to_end(tile_key)  # Mark as recently used
    lock = self.tile_locks[tile_key]
```

---

### Fix 7 — Catch-all returns 400 for server errors (server.py)

**File:** `/home/user/MeshRF/rf-engine/server.py` (~line 182-187)

**Problem:** The except block returns HTTP 400 for ALL exceptions, including genuine server errors.

**Fix:** Differentiate between ValueError (client error) and other exceptions (server error):

```python
except ValueError as e:
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=400,
        content={"status": "INVALID_REQUEST", "error": str(e)}
    )
except Exception as e:
    from fastapi.responses import JSONResponse
    import logging
    logging.getLogger(__name__).error(f"Internal error: {e}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"status": "SERVER_ERROR", "error": "Internal server error"}
    )
```

---

## PHASE 2: CRITICAL FRONTEND FIXES

### Fix 8 — Stale/duplicate message listeners on worker (useViewshedTool.js)

**File:** `/home/user/MeshRF/src/hooks/useViewshedTool.js` (~lines 51-94)

**Problem:** The `message` event handler is added to the web worker inside a useEffect, but if the hook remounts (parent re-render), multiple listeners accumulate. The cleanup only removes the last one added.

**Fix:** Store the handler in a ref and ensure the cleanup removes exactly what was added:

```javascript
useEffect(() => {
    if (!worker) return;

    const handler = (e) => {
        // ... existing message handling logic
    };

    worker.addEventListener('message', handler);
    return () => {
        worker.removeEventListener('message', handler);
    };
}, [worker]);  // Only depend on worker instance
```

Make sure the handler is defined inline inside the useEffect so it's a stable reference per effect invocation. Move any state reads inside the handler to use refs if they need current values.

---

### Fix 9 — RF recalculation race condition (MapContainer.jsx)

**File:** `/home/user/MeshRF/src/components/Map/MapContainer.jsx` (~lines 223-261)

**Problem:** When parameters change rapidly, `runRFAnalysis` is called multiple times without cancelling previous work. Overlapping WASM calculations produce wrong results.

**Fix:** Add a generation counter ref to discard stale results:

```javascript
const rfGenerationRef = useRef(0);

// In the useEffect that triggers recalculation:
useEffect(() => {
    const generation = ++rfGenerationRef.current;

    // ... setup code ...

    const runAnalysis = async () => {
        // ... existing analysis code ...
        if (rfGenerationRef.current !== generation) return; // Stale — discard
        // ... apply results ...
    };

    runAnalysis();
}, [/* existing deps */]);
```

---

### Fix 10 — Missing dependency in runAnalysis useCallback (LinkLayer.jsx)

**File:** `/home/user/MeshRF/src/components/Map/LinkLayer.jsx` (~line 71)

**Problem:** `runAnalysis` useCallback depends on `configRef` via `configRef.current`, but refs don't trigger re-renders. If config changes, the callback uses stale config values because nothing signals a new callback is needed.

**Fix:** Instead of reading `configRef.current` inside the callback, read the config values directly and include them in the dependency array:

```javascript
// Remove configRef pattern. Instead, destructure the values needed:
const runAnalysis = useCallback(async () => {
    const { txLat, txLon, rxLat, rxLon, txHeight, rxHeight, frequencyMhz } = linkConfig;
    // Use these values directly instead of configRef.current
    // ...
}, [linkConfig, setLinkStats, propagationSettings, calculateITM, climate, groundType, itmReady]);
```

Where `linkConfig` is the actual state object (not a ref). If it must stay as a ref for other reasons, add a separate state variable that mirrors the ref and use it in the deps array.

---

### Fix 11 — Render-time state updates (MapContainer.jsx & NodeManager.jsx)

**File:** `/home/user/MeshRF/src/components/Map/MapContainer.jsx` (~lines 362-368)
**File:** `/home/user/MeshRF/src/components/Map/UI/NodeManager.jsx` (~lines 74-82)

**Problem:** Both files set state directly in the component body (during render) by comparing `prevSimResults !== simResults`. This can cause infinite render loops if objects are recreated each render.

**Fix:** Move these to `useEffect`:

```javascript
// MapContainer.jsx — wrap in useEffect:
useEffect(() => {
    if (prevSimResults !== simResults) {
        setPrevSimResults(simResults);
        // ... handle change ...
    }
}, [simResults]);  // Remove prevSimResults state entirely if possible

// NodeManager.jsx — same pattern:
useEffect(() => {
    // ... state transition logic
}, [/* relevant deps */]);
```

---

### Fix 12 — Document resize listeners leak (LinkAnalysisPanel.jsx)

**File:** `/home/user/MeshRF/src/components/Map/LinkAnalysisPanel.jsx` (~lines 117-150)

**Problem:** `mousedown` adds `mousemove` and `mouseup` listeners to `document`, but if the component unmounts mid-drag, they're never removed.

**Fix:** Track listeners in a ref and clean up on unmount:

```javascript
const cleanupRef = useRef(null);

const handleMouseDown = useCallback((e) => {
    // ... existing logic ...

    const handleMouseMove = (e) => { /* ... */ };
    const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        cleanupRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    cleanupRef.current = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };
}, [/* deps */]);

// Cleanup on unmount:
useEffect(() => {
    return () => {
        if (cleanupRef.current) cleanupRef.current();
    };
}, []);
```

---

### Fix 13 — Missing .catch() / response.ok checks on fetch (rfService.js)

**File:** `/home/user/MeshRF/src/utils/rfService.js` (~lines 37-60, 63-92)

**Problem:** `fetch()` calls don't check `response.ok` before calling `.json()`. Non-200 responses and network errors produce unhandled rejections.

**Fix:** Add response checking to every fetch call:

```javascript
const response = await fetch(url, options);
if (!response.ok) {
    throw new Error(`RF service error: ${response.status} ${response.statusText}`);
}
const data = await response.json();
```

Apply this pattern to every fetch call in the file.

---

### Fix 14 — Silent WASM load failure (useRFCoverageTool.js)

**File:** `/home/user/MeshRF/src/hooks/useRFCoverageTool.js` (~lines 18-39)

**Problem:** The `.catch()` on WASM module load silently swallows the error. `wasmModuleRef.current` stays null, and later calls to `runAnalysis` fail with no user feedback.

**Fix:** Set an error state that the UI can display:

```javascript
const [wasmError, setWasmError] = useState(null);

// In the WASM load effect:
initWasm()
    .then(module => { wasmModuleRef.current = module; })
    .catch(err => {
        console.error('WASM module failed to load:', err);
        setWasmError('RF calculation engine failed to load. Try refreshing the page.');
    });
```

Return `wasmError` from the hook so the UI can display it. In `runAnalysis`, check for the error early:

```javascript
if (wasmError) {
    console.error('Cannot run analysis: WASM not loaded');
    return null;
}
```

---

### Fix 15 — Scan double-submit race condition (useSimulationStore.js)

**File:** `/home/user/MeshRF/src/store/useSimulationStore.js` (~lines 46-72)

**Problem:** If user clicks "Run Scan" twice rapidly, both jobs run and results get mixed together.

**Fix:** Guard `startScan()` with an `isScanning` check:

```javascript
startScan: async (params) => {
    if (get().isScanning) return;  // Already running
    set({ isScanning: true, scanProgress: 0, scanError: null });
    // ... rest of existing logic
},
```

---

### Fix 16 — elevation.js returns empty array on error (elevation.js)

**File:** `/home/user/MeshRF/src/utils/elevation.js` (~lines 70-73)

**Problem:** On error, returns `[]`. Callers have no way to distinguish "no elevation data available" from "fetch failed."

**Fix:** Throw the error instead of swallowing it, and let callers handle it:

```javascript
} catch (err) {
    console.error('Elevation fetch failed:', err);
    throw err;  // Let caller decide how to handle
}
```

Make sure all callers of this function have try/catch blocks.

---

## PHASE 3: MODERATE FIXES

### Fix 17 — Unused import cleanup

Remove these verified unused imports:
- **`/home/user/MeshRF/rf-engine/vulture_report.txt`** — Delete this file entirely. It's stale and references code that's already been cleaned up.

Check and remove any unused variables confirmed by reading:
- `MapContainer.jsx` line 159: If `nodeHeight` is destructured but never used, remove it from the destructuring.

---

### Fix 18 — Duplicate tile coordinate logic (frontend)

**Files:**
- `/home/user/MeshRF/src/hooks/useViewshedTool.js` (lines ~108-129)
- `/home/user/MeshRF/src/hooks/useRFCoverageTool.js` (lines ~251-267)

**Problem:** `getTile()`, `getTileBounds()`, and tile wrapping logic are duplicated across both hooks.

**Fix:** Create a shared utility file `/home/user/MeshRF/src/utils/tileUtils.js` with:

```javascript
export function getTile(lat, lon, zoom) { /* ... */ }
export function getTileBounds(x, y, zoom) { /* ... */ }
```

Import from both hooks instead of defining inline.

---

### Fix 19 — Duplicate coordinate mapping logic (backend)

**File:** `/home/user/MeshRF/rf-engine/tasks/viewshed.py`

**Problem:** `lat_to_y()` / `lon_to_x()` mapping appears 3 times (~lines 115, 182, 239) with identical logic.

**Fix:** Extract to a top-level helper:

```python
def _coord_to_pixel(val, val_min, val_max, dim):
    """Convert a coordinate to pixel index within a grid."""
    return int((val_max - val) / (val_max - val_min) * (dim - 1))
```

Replace all 3 occurrences with calls to this helper.

---

## PHASE 4: VERIFICATION

After all fixes, run:

1. `cd /home/user/MeshRF && npm run build` — Verify frontend compiles without errors
2. `cd /home/user/MeshRF/rf-engine && python -m py_compile server.py && python -m py_compile worker.py && python -m py_compile rf_physics.py && python -m py_compile tile_manager.py && python -m py_compile core/algorithms.py && python -m py_compile tasks/viewshed.py && python -m py_compile optimization_service.py` — Verify all Python files have valid syntax
3. If tests exist: `cd /home/user/MeshRF/rf-engine && python -m pytest tests/ -v`

Report any compilation or test failures and fix them before finishing.

---

## RULES

- Make the minimum change needed for each fix. Do not refactor surrounding code.
- Do not add comments beyond what's needed to explain the fix.
- Do not change formatting, whitespace, or style of untouched lines.
- Do not add type annotations, docstrings, or features.
- Read each file BEFORE editing — never edit blind.
- After each edit, re-read the changed region to verify correctness.
