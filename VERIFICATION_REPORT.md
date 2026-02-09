# Post-Implementation Verification Report (v1.12.0)

**Date**: 2026-02-09
**Scope**: Verify the 5 remaining issues from the FIXPLAN against v1.12.0 on `main`
**Previous**: v1.11.0 report found 5 of 8 original findings fixed + 2 new bugs

---

## Summary

v1.12.0 fixed **2 of 5** issues from the fix plan. The WASM ITM ground params in LinkLayer (TASK 4) was fully fixed. The rfService.js default was changed (partial TASK 5). **3 issues remain open**, including the critical server.py crash.

| TASK | Status | Detail |
|------|--------|--------|
| TASK 1: server.py crash | ❌ **NOT FIXED** | Duplicate `req.rx_height` still at line 74 |
| TASK 2: Drag handler | ❌ **NOT FIXED** | Still has hardcoded rxGain=2.15, no cable loss, no ground params |
| TASK 3: Diffraction dead code | ❌ **NOT FIXED** | `'Hata'` (capital H) still at line 283 |
| TASK 4: LinkLayer ground params | ✅ **FIXED** | Now reads from context via GROUND_TYPES lookup |
| TASK 5: Dropdown fallback | ❌ **NOT FIXED** | Still says `"itm"` at line 414 |

---

## TASK 1: server.py double rx_height — NOT FIXED

**Status**: ❌ **Still crashes**

`rf-engine/server.py:68-74`:
```python
path_loss_db = rf_physics.calculate_path_loss(
    dist_m,
    elevs,
    req.frequency_mhz,
    req.tx_height,
    req.rx_height,     # ← arg 5: rx_h (correct)
    req.rx_height,     # ← arg 6: model (WRONG — duplicate rx_height)
    model=req.model,   # ← keyword: model (CONFLICT)
    ...
)
```

The duplicate `req.rx_height` on line 74 is still there. This causes `TypeError: calculate_path_loss() got multiple values for argument 'model'` on every `/calculate-link` call.

**Impact**: The Bullington, Hata, and FSPL models via the Python backend all crash. Only the WASM ITM path works because LinkLayer line 86 skips the backend call for `itm_wasm`.

**Note**: v1.12.0 also added `model == 'itm_wasm'` to the Python dispatch at `rf_physics.py:149`, which maps it to Bullington. And `rfService.js:45` now defaults to `model: model || 'itm_wasm'`. This means if any code path calls `calculateLink()` without specifying a model, `itm_wasm` gets sent to the Python backend. This doesn't crash (it would hit the Bullington branch), but it's semantically wrong — the name implies WASM ITM but the backend runs Bullington.

---

## TASK 2: RF Coverage drag handler — NOT FIXED

**Status**: ❌ **All old hardcoded values remain**

`MapContainer.jsx:612-633` is unchanged from v1.11.0:

| Issue | Line | Current Value | Expected |
|-------|------|--------------|----------|
| RX Gain hardcoded | 625 | `rxGain: 2.15` | `nodeConfigs.B.antennaGain \|\| 2.15` |
| No cable losses | 621-631 | No txLoss/rxLoss fields | `txLoss: cableLoss, rxLoss: 0` |
| No ground params | 621-631 | No epsilon/sigma/climate | Should mirror CoverageClickHandler |
| Wrong height fallback | 614 | `antennaHeight \|\| 5.0` | `getAntennaHeightMeters()` |

Dragging the RF Coverage marker still reverts to pre-v1.11.0 behavior.

---

## TASK 3: Diffraction dead code — NOT FIXED

**Status**: ❌ **Dead code still present**

`LinkLayer.jsx:283`:
```javascript
if (propagationSettings?.model === 'Hata' && linkStats.profileWithStats) {
```

Still checks `'Hata'` (capital H). All model values are lowercase. Block never executes. No functional impact but it's dead code that should be cleaned up.

---

## TASK 4: LinkLayer WASM ITM ground params — FIXED

**Status**: ✅ **FIXED**

v1.12.0 changes:

1. `LinkLayer.jsx:5` — `GROUND_TYPES` imported:
   ```javascript
   import { useRF, GROUND_TYPES } from '../../context/RFContext';
   ```

2. `LinkLayer.jsx:36` — `groundType` and `climate` destructured from useRF():
   ```javascript
   groundType, climate
   ```

3. `LinkLayer.jsx:100-109` — WASM ITM call now uses dynamic values:
   ```javascript
   const ground = GROUND_TYPES[groundType] || GROUND_TYPES['Average Ground'];
   const loss = await calculateITM({
       ...
       groundEpsilon: ground.epsilon,
       groundSigma: ground.sigma,
       climate: climate
   });
   ```

**One concern**: `groundType` and `climate` are read from the closure, not from `configRef.current`. The `runAnalysis` useCallback has dependencies `[setLinkStats, propagationSettings]` (line 139) — `groundType` and `climate` are **not** in the dependency array. This means if the user changes ground type without triggering a re-render from another source, the callback may use stale values.

The existing pattern for `kFactor`/`clutterHeight` avoids this by using `configRef`. To be fully correct, `groundType` and `climate` should be added to `configRef`:

```javascript
// Line 39:
const configRef = useRef({ nodeConfigs, freq, kFactor, clutterHeight, groundType, climate });

// Line 47-48:
useEffect(() => {
    configRef.current = { nodeConfigs, freq, kFactor, clutterHeight, groundType, climate };
}, [nodeConfigs, freq, kFactor, clutterHeight, groundType, climate]);
```

Then at line 100: `GROUND_TYPES[currentConfig.groundType]` and `currentConfig.climate`.

This is a **minor correctness issue** — in practice, changing ground type or climate always triggers a re-render which recreates the callback, so stale values are unlikely. But it doesn't match the established pattern.

---

## TASK 5: Dropdown fallback — NOT FIXED

**Status**: ❌

`LinkAnalysisPanel.jsx:414`:
```javascript
value={propagationSettings.model || "itm"}
```

Still says `"itm"`. Should be `"itm_wasm"`. Low impact since `propagationSettings.model` is always set (initialized to `"itm_wasm"` in MapContainer), but the fallback is inconsistent.

**Also noted**: `rfService.js:45` was changed from `'bullington'` to `'itm_wasm'`:
```javascript
model: model || 'itm_wasm',
```
This is incorrect — the `calculateLink` function calls the Python backend, which doesn't have a real WASM ITM. When `itm_wasm` is sent to Python, `rf_physics.py:149` maps it to Bullington. The default should be `'bullington'` to be honest about what the Python backend actually runs. Or better, the LinkLayer should never send `itm_wasm` to the Python backend at all (which it currently doesn't, since line 86 only calls backend for hata/bullington/itm).

---

## Updated Scorecard (cumulative since original audit)

```
Original audit findings:              8
Fully fixed (after v1.12.0):          6  (F1, F4, F5, F7, F8 + new TASK 4)
Partially fixed:                      2  (F2, F3 — drag handler still open)
Dead code (harmless):                 1  (F6 — diffraction condition)

From FIXPLAN:
  TASK 1 (server.py crash):           ❌ NOT FIXED (CRITICAL)
  TASK 2 (drag handler):              ❌ NOT FIXED (HIGH)
  TASK 3 (dead code cleanup):         ❌ NOT FIXED (LOW)
  TASK 4 (LinkLayer ground params):   ✅ FIXED
  TASK 5 (dropdown fallback):         ❌ NOT FIXED (COSMETIC)

New concern:
  configRef stale closure:            ⚠️ Minor (groundType/climate not in configRef)
  rfService.js default 'itm_wasm':    ⚠️ Misleading (Python runs Bullington, not WASM ITM)
```

---

## Remaining Fixes Needed

| # | Issue | Severity | File:Line | Fix |
|---|-------|----------|-----------|-----|
| **1** | **server.py:74 duplicate rx_height** | **CRITICAL** | `rf-engine/server.py:74` | Delete the line `req.rx_height,` |
| **2** | **Drag handler hardcoded params** | **HIGH** | `MapContainer.jsx:612-633` | Mirror recalc path: add txLoss, rxGain from nodeConfigs, ground params, use getAntennaHeightMeters() |
| **3** | Diffraction dead code | LOW | `LinkLayer.jsx:281-290` | Remove block, simplify margin to `budget.margin` |
| **4** | configRef missing groundType/climate | LOW | `LinkLayer.jsx:39,47-48` | Add `groundType, climate` to configRef and useEffect deps |
| **5** | Dropdown fallback says "itm" | COSMETIC | `LinkAnalysisPanel.jsx:414` | Change to `"itm_wasm"` |
| **6** | rfService.js default is misleading | COSMETIC | `rfService.js:45` | Change back to `'bullington'` — Python backend should default to what it actually runs |
