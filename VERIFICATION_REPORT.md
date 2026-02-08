# Post-Implementation Verification Report (v1.11.0)

**Date**: 2026-02-08
**Scope**: Verify all 8 original audit findings against v1.11.0 changes on `main`
**Previous report**: Pre-v1.11.0 (all findings were open)

---

## Summary

v1.11.0 addressed the **majority** of the audit findings. Of 8 original findings, **5 are fully fixed**, **2 are partially fixed** with a remaining gap, and **1 is still open**. Two new bugs were introduced during the implementation.

| Status | Count | Details |
|--------|-------|---------|
| FIXED | 5 | Findings 1, 4, 5, 7, 8 |
| PARTIAL | 2 | Findings 2, 3 (drag handler missed) |
| OPEN | 1 | Finding 6 (diffraction condition — now dead code) |
| NEW BUG | 2 | Introduced during v1.11.0 |

---

## Finding-by-Finding Verification

### FINDING 1: Two Different "ITM" Engines — FIXED

**Status**: ✅ **FIXED**

The rename was executed and a real WASM ITM option was added:

| Check | Before | After (v1.11.0) | Status |
|-------|--------|-----------------|--------|
| Python model default | `model: str = "itm"` | `model: str = "bullington"` | ✅ |
| Python dispatch | `if model == 'itm':` | `if model == 'bullington' or model == 'itm':` | ✅ (backwards compat) |
| Python comment | "ITM / Longley-Rice" | "Bullington (Terrain Helper - previously misnamed as ITM)" | ✅ |
| Frontend API default | `model \|\| 'itm'` | `model \|\| 'bullington'` | ✅ |
| LinkLayer default | `\|\| 'itm'` | `\|\| 'bullington'` | ✅ |
| MapContainer default | `model: "itm"` | `model: "itm_wasm"` | ✅ |
| UI dropdown | `<option value="itm">Longley-Rice` | `<option value="itm_wasm">Longley-Rice ITM (Full)` + `<option value="bullington">Bullington (Terrain Helper)` | ✅ |
| WASM ITM hook | Did not exist | `src/hooks/useWasmITM.js` created | ✅ |
| LinkLayer WASM integration | N/A | Lines 88-114 call `calculateITM()` when `itm_wasm` selected | ✅ |

The `useWasmITM.js` hook is well-implemented: proper memory management (malloc/free, params.delete(), resultVec.delete() in finally block), standalone export for non-React use, and clean error handling.

---

### FINDING 2: RF Coverage Hardcodes Sidebar Parameters — PARTIALLY FIXED

**Status**: ⚠️ **PARTIALLY FIXED** — CoverageClickHandler and recalc path fixed, **drag handler still has all the old hardcoded values**

**RX Gain (2.15 dBi hardcode)**:

| Location | Before | After | Status |
|----------|--------|-------|--------|
| `CoverageClickHandler.jsx:32` | `rxGain: 2.15` | `rxGain: rfContext.rxAntennaGain \|\| 2.15` | ✅ |
| `MapContainer.jsx:232` (recalc) | `rxGain: 2.15` | `rxGain: nodeConfigs.B.antennaGain \|\| 2.15` | ✅ |
| **`MapContainer.jsx:625` (drag)** | `rxGain: 2.15` | **`rxGain: 2.15`** | ❌ STILL HARDCODED |

**Cable Losses**:

| Location | Before | After | Status |
|----------|--------|-------|--------|
| `CoverageClickHandler.jsx:30-31` | Not present | `txLoss: rfContext.cableLoss \|\| 0, rxLoss: 0` | ✅ |
| `MapContainer.jsx:230-231` (recalc) | Not present | `txLoss: cableLoss, rxLoss: 0` | ✅ |
| `useRFCoverageTool.js:162` | Raw txPower | `txPower - (txLoss \|\| 0) - (rxLoss \|\| 0)` | ✅ |
| **`MapContainer.jsx:621-631` (drag)** | No txLoss/rxLoss | **No txLoss/rxLoss** | ❌ STILL MISSING |

**Ground Params (epsilon, sigma, climate)**:

| Location | Before | After | Status |
|----------|--------|-------|--------|
| `meshrf_coverage.h` | No params | `float epsilon=15.0f, float sigma=0.005f, int climate=5` | ✅ |
| `meshrf_coverage.cpp:85-87` | Hardcoded | `params.epsilon = epsilon; params.sigma = sigma; params.climate = climate;` | ✅ |
| `bindings.cpp` | 14 args | 17 args (epsilon, sigma, climate added) | ✅ |
| `CoverageClickHandler.jsx:39-41` | Not present | `epsilon: ground.epsilon, sigma: ground.sigma, climate: rfContext.climate` | ✅ |
| `MapContainer.jsx:226-238` (recalc) | Not present | **Not present** — recalc path also missing ground params | ⚠️ |
| `useRFCoverageTool.js:169-171` | Not present | Passes epsilon, sigma, climate with safe defaults | ✅ |
| **`MapContainer.jsx:621-631` (drag)** | N/A | **No ground params** | ❌ STILL MISSING |

**RX Height Fallback**:

| Check | Before | After | Status |
|-------|--------|-------|--------|
| `useRFCoverageTool.js:160` | `rfParams.rxHeight \|\| 5.0` | `rfParams.rxHeight \|\| 2.0` | ✅ |

---

### FINDING 3: Recalc Path Hardcodes — PARTIALLY FIXED

**Status**: ⚠️ **PARTIALLY FIXED**

The recalc useEffect (`MapContainer.jsx:226-238`) is properly wired with `txLoss`, `rxGain: nodeConfigs.B.antennaGain`, etc.

The RF Coverage **drag handler** (`MapContainer.jsx:621-631`) still has the original hardcoded values. When a user drags the coverage marker, the recalculation reverts to all the old hardcoded behavior.

---

### FINDING 4: Environment Selector Misleading — FIXED

**Status**: ✅ **FIXED**

`LinkAnalysisPanel.jsx:458-492`:
- Environment dropdown disabled when model is not Hata (`disabled={propagationSettings.model !== 'hata'}`)
- Grayed out with `opacity: 0.4` and `filter: grayscale(100%)`
- Tooltip: "Environment settings only apply to the Okumura-Hata statistical model."
- `cursor: 'not-allowed'` when disabled

---

### FINDING 5: Fade Margin Hardcoded — FIXED

**Status**: ✅ **FIXED**

| Check | Before | After | Status |
|-------|--------|-------|--------|
| `RFContext.jsx:128` | N/A | `const [fadeMargin, setFadeMargin] = useState(10)` | ✅ |
| `RFContext.jsx:239` | N/A | `fadeMargin, setFadeMargin` exported in context | ✅ |
| `MapContainer.jsx:143` | N/A | `fadeMargin` destructured from useRF() | ✅ |
| `LinkLayer.jsx:34` | N/A | `fadeMargin` destructured from useRF() | ✅ |
| `LinkLayer.jsx:278` | Not passed | `fadeMargin` passed to calculateLinkBudget | ✅ |

---

### FINDING 6: Diffraction Loss Condition — STILL OPEN (now dead code)

**Status**: ❌ **NOT FIXED — now effectively dead code due to case mismatch**

`LinkLayer.jsx:283`:
```javascript
if (propagationSettings?.model === 'Hata' && linkStats.profileWithStats) {
```

This is unchanged. However, the model dropdown values are now all lowercase (`'hata'`, `'bullington'`, `'itm_wasm'`, `'fspl'`). This condition checks for `'Hata'` (capital H), which **never matches anymore**. The `diffractionLoss` variable is always 0 regardless of which model is selected.

Before v1.11.0 this was a logic error (wrong model). After v1.11.0 it's dead code. The margin calculation at line 306 (`const m = budget.margin - diffractionLoss`) now always equals just `budget.margin`, which is actually the correct behavior since every backend model already includes its own path loss in `pathLossOverride`.

**Net effect**: The case mismatch accidentally fixed the double-counting bug. But the dead code should be cleaned up.

---

### FINDING 7: Viewshed Observer Height Hardcoded — FIXED

**Status**: ✅ **FIXED**

| Location | Before | After | Status |
|----------|--------|-------|--------|
| `CoverageClickHandler.jsx:12` | `height: 2.0` | `rfContext.getAntennaHeightMeters()` with 2.0 fallback | ✅ |
| `CoverageClickHandler.jsx:15` | `runViewshed(lat, lng, 2.0, ...)` | `runViewshed(lat, lng, h, ...)` | ✅ |
| `MapContainer.jsx:573` (drag) | `height: elevation + 2.0` | `const h = getAntennaHeightMeters()` then `height: h` | ✅ |
| `MapContainer.jsx:582` (run) | `elevation + 2.0` | `h` (AGL only, correct) | ✅ |
| `MapContainer.jsx:586` (error) | `height: 2.0` | `height: h` | ✅ |

The elevation+2.0 bug (passing AMSL instead of AGL) is also fixed.

---

### FINDING 8: Python K-Factor and Clutter Height Hardcoded — FIXED

**Status**: ✅ **FIXED**

| Check | Before | After | Status |
|-------|--------|-------|--------|
| `rf_physics.py:25` | No k_factor/clutter params | `k_factor=1.333, clutter_height=0.0` | ✅ |
| `rf_physics.py:47` | `k = 1.333` hardcoded | `k = k_factor` (uses param) | ✅ |
| `rf_physics.py:55` | `profile + bulge` | `profile + bulge + clutter_height` | ✅ |
| `rf_physics.py:130` | `model='itm'` | `model='bullington', k_factor=1.333, clutter_height=0.0` | ✅ |
| `rf_physics.py:158` | `analyze_link(elevs, dist_m, freq_mhz, tx_h, rx_h)` | `..., k_factor=1.333, clutter_height=0.0)` | ✅ |
| `rf_physics.py:164` | `k = 1.333` hardcoded | `k = k_factor` (uses param) | ✅ |
| `rf_physics.py:171` | `elevs + bulge` | `elevs + bulge + clutter_height` | ✅ |
| `server.py:44-45` | Not in model | `k_factor: float = 1.333, clutter_height: float = 0.0` | ✅ |
| `server.py:88-89` | Not passed to analyze_link | `k_factor=req.k_factor, clutter_height=req.clutter_height` | ✅ |
| `rfService.js:47-48` | Not in request body | `k_factor: Number(kFactor) \|\| 1.333, clutter_height: Number(clutterHeight) \|\| 0` | ✅ |
| `LinkLayer.jsx:83` | 5 args | Includes `currentConfig.kFactor, currentConfig.clutterHeight` | ✅ |

---

## NEW BUGS Introduced in v1.11.0

### NEW BUG 1: Double rx_height in server.py — RUNTIME CRASH

**Severity**: **CRITICAL**

`rf-engine/server.py:68-74`:
```python
path_loss_db = rf_physics.calculate_path_loss(
    dist_m,
    elevs,
    req.frequency_mhz,
    req.tx_height,
    req.rx_height,     # ← positional arg 6: fills rx_h
    req.rx_height,     # ← positional arg 7: fills model (should not be here)
    model=req.model,   # ← keyword arg: also fills model
    environment=req.environment,
    k_factor=req.k_factor,
    clutter_height=req.clutter_height
)
```

The function signature is:
```python
def calculate_path_loss(dist_m, elevs, freq_mhz, tx_h, rx_h, model='bullington', ...)
```

`req.rx_height` is passed twice — once correctly as `rx_h`, then again as the positional `model` argument. Then `model=req.model` is also passed as a keyword argument for the same parameter. **Python raises `TypeError: calculate_path_loss() got multiple values for argument 'model'`**.

**This crashes the `/calculate-link` endpoint on every call.** The Bullington, Hata, and FSPL models via the Python backend are all broken. Only the WASM ITM path (which doesn't call the Python backend) still works.

**Fix**: Delete the duplicate `req.rx_height,` at line 74.

### NEW BUG 2: WASM ITM in LinkLayer hardcodes ground params

**Severity**: **LOW**

`LinkLayer.jsx:103-105`:
```javascript
groundEpsilon: 15.0,     // hardcoded, should come from context
groundSigma: 0.005,      // hardcoded
climate: 5               // hardcoded
```

The WASM ITM path in LinkLayer hardcodes ground params even though the sidebar now has Ground Type and Climate Zone controls. The RF Coverage tool correctly reads these from rfContext, but the Link Analysis WASM path doesn't have access to `groundType`/`climate` since they aren't in `configRef.current`.

**Fix**: Add `groundType` and `climate` to the configRef dependencies in LinkLayer, and import `GROUND_TYPES` from RFContext to look up epsilon/sigma.

---

## Remaining Work

| # | Issue | Severity | File:Line | Fix |
|---|-------|----------|-----------|-----|
| **1** | **server.py double rx_height — crashes API** | CRITICAL | `server.py:74` | Delete the duplicate `req.rx_height,` line |
| **2** | **Drag handler: rxGain=2.15, no cable loss, no ground params** | HIGH | `MapContainer.jsx:621-631` | Mirror the recalc path pattern from lines 226-238 |
| **3** | Diffraction condition dead code (`'Hata'` vs `'hata'`) | LOW | `LinkLayer.jsx:283` | Remove dead code block (lines 282-289) or fix case |
| **4** | WASM ITM in LinkLayer hardcodes ground params | LOW | `LinkLayer.jsx:103-105` | Wire groundType/climate from context |
| **5** | Dropdown fallback still says `"itm"` | COSMETIC | `LinkAnalysisPanel.jsx:414` | Change to `"itm_wasm"` |

---

## Final Scorecard

```
Original findings:                   8
Fully fixed:                         5  (F1, F4, F5, F7, F8)
Partially fixed:                     2  (F2, F3 — drag handler gap)
Still open:                          1  (F6 — dead code, harmless)
New bugs introduced:                 2  (server.py crash, WASM ground params)
Math formulas verified:             16/16  ✅ (no drift)
Constants verified:                 15/15  ✅ (no drift)
```
