# v1.12.0 Fix Plan — 6 Remaining Issues

These are the remaining issues found during post-implementation verification of v1.12.0.
Each task is self-contained with exact file paths, line numbers, before/after code, and acceptance criteria.

**Previous**: v1.12.0 fixed TASK 4 (LinkLayer ground params). Tasks 1, 2, 3, 5 still open. Two new issues found.

---

## TASK 1: Fix server.py double rx_height crash (CRITICAL)

**Severity**: CRITICAL — the `/calculate-link` API endpoint crashes on every call
**File**: `rf-engine/server.py`
**Line**: 74

### Problem

`req.rx_height` is passed twice as a positional argument to `calculate_path_loss()`.
The 5th positional arg fills `rx_h` (correct), then the 6th positional arg fills `model`
with a float (wrong). Then `model=req.model` is also passed as a keyword argument for
the same parameter. Python raises:
`TypeError: calculate_path_loss() got multiple values for argument 'model'`

This crashes the Bullington, Hata, and FSPL models. Only the WASM ITM path works because
it skips the Python backend entirely.

### Function signature (rf_physics.py line 130)
```python
def calculate_path_loss(dist_m, elevs, freq_mhz, tx_h, rx_h, model='bullington', environment='suburban', k_factor=1.333, clutter_height=0.0):
```

### Current code (server.py lines 68-79)
```python
path_loss_db = rf_physics.calculate_path_loss(
    dist_m,
    elevs,
    req.frequency_mhz,
    req.tx_height,
    req.rx_height,
    req.rx_height,          # ← DELETE THIS LINE (duplicate — fills 'model' positionally)
    model=req.model,
    environment=req.environment,
    k_factor=req.k_factor,
    clutter_height=req.clutter_height
)
```

### Fix
Delete the duplicate `req.rx_height,` at line 74. The corrected call should be:
```python
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
```

### Acceptance
- The `/calculate-link` endpoint returns valid JSON with `path_loss_db` instead of crashing
- All three Python models (bullington, hata, fspl) return numeric results
- No change to the function signature in `rf_physics.py`

---

## TASK 2: Fix RF Coverage drag handler (HIGH)

**Severity**: HIGH — dragging the RF Coverage marker reverts to old hardcoded values
**File**: `src/components/Map/MapContainer.jsx`
**Lines**: 602-634 (RF Coverage marker drag handler)

### Problem

When a user drags the RF Coverage transmitter marker on the map, the `dragend` handler
at line 602 rebuilds `rfParams` with all the old hardcoded values from before v1.11.0:

- `rxGain: 2.15` — ignores Node B antenna gain (line 625)
- No `txLoss` / `rxLoss` — cable losses not subtracted
- No `epsilon` / `sigma` / `climate` — ground params not passed to WASM
- `antennaHeight || 5.0` — should use `getAntennaHeightMeters()` (line 614)

The initial click handler (`CoverageClickHandler.jsx`) and the recalc path
(`MapContainer.jsx:226-238`) are both correctly wired. Only this drag handler was missed.

### Current code (MapContainer.jsx lines 612-633)
```javascript
.then((data) => {
    const elevation = data.elevation || 0;
    const h = antennaHeight || 5.0;

    setRfObserver({ lat, lng, height: h });

    const currentSensitivity = calculateSensitivity
      ? calculateSensitivity()
      : -126;
    const rfParams = {
      freq,
      txPower: proxyTx,
      txGain: proxyGain,
      rxGain: 2.15,
      rxSensitivity: currentSensitivity,
      bw,
      sf,
      cr,
      rxHeight,
    };

    runRFAnalysis(lat, lng, h, 25000, rfParams);
  });
```

### Fix

**Step 1**: Add `groundType` and `climate` to the `useRF()` destructuring at line 120-143.
Currently it already has `getAntennaHeightMeters`, `cableLoss`, `nodeConfigs`. Just add:
```javascript
// Add to the existing useRF() destructuring block (around line 120-143):
groundType,
climate,
```

**Step 2**: Add GROUND_TYPES import. At the top of MapContainer.jsx, change the existing import:
```javascript
// Change line 16 from:
import { useRF } from "../../context/RFContext";
// To:
import { useRF, GROUND_TYPES } from "../../context/RFContext";
```

**Step 3**: Replace the drag handler `.then((data) => { ... })` block (lines 612-633) with:
```javascript
.then((data) => {
    const elevation = data.elevation || 0;
    const h = getAntennaHeightMeters
      ? getAntennaHeightMeters()
      : (antennaHeight || 5.0);

    setRfObserver({ lat, lng, height: h });

    const currentSensitivity = calculateSensitivity
      ? calculateSensitivity()
      : -126;

    const ground = GROUND_TYPES[groundType] || GROUND_TYPES['Average Ground'];

    const rfParams = {
      freq,
      txPower: proxyTx,
      txGain: proxyGain,
      txLoss: cableLoss || 0,
      rxLoss: 0,
      rxGain: nodeConfigs.B.antennaGain || 2.15,
      rxSensitivity: currentSensitivity,
      bw,
      sf,
      cr,
      rxHeight,
      epsilon: ground.epsilon,
      sigma: ground.sigma,
      climate: climate || 5,
    };

    runRFAnalysis(lat, lng, h, 25000, rfParams);
  });
```

**Step 4**: Also add ground params to the recalc path (lines 226-238) since it's also missing
them. Before the `rfParams` declaration at line 226, add the ground lookup. The recalc block
should become:
```javascript
const ground = GROUND_TYPES[groundType] || GROUND_TYPES['Average Ground'];

const rfParams = {
    freq,
    txPower: proxyTx,
    txGain: proxyGain,
    txLoss: cableLoss,
    rxLoss: 0,
    rxGain: nodeConfigs.B.antennaGain || 2.15,
    rxSensitivity: currentSensitivity,
    bw,
    sf,
    cr,
    rxHeight,
    epsilon: ground.epsilon,
    sigma: ground.sigma,
    climate: climate || 5,
};
```

### Acceptance
- Dragging the RF Coverage marker produces the same results as clicking a fresh point
- `rxGain` reflects Node B antenna setting, not hardcoded 2.15
- Cable loss is subtracted via `txLoss`
- Ground type and climate are passed through to WASM
- Antenna height uses `getAntennaHeightMeters()` not raw `antennaHeight || 5.0`
- The recalc path also includes ground params

---

## TASK 3: Remove diffraction dead code in LinkLayer (LOW)

**Severity**: LOW — dead code, no functional impact
**File**: `src/components/Map/LinkLayer.jsx`
**Lines**: 281-290

### Problem

The diffraction loss block checks `propagationSettings?.model === 'Hata'` (capital H),
but all model values are lowercase (`'hata'`, `'bullington'`, `'itm_wasm'`, `'fspl'`).
This condition **never matches**, so `diffractionLoss` is always 0.

This is correct behavior — the path loss models already include terrain effects in their
`pathLossOverride`, so a separate diffraction subtraction would double-count. The dead code
should be removed for clarity.

### Current code (LinkLayer.jsx lines 281-290)
```javascript
// Calculate Diffraction Loss (Bullington) for visualization
let diffractionLoss = 0;
if (propagationSettings?.model === 'Hata' && linkStats.profileWithStats) {
     diffractionLoss = calculateBullingtonDiffraction(
        linkStats.profileWithStats,
        freq,
        configA.antennaHeight,
        configB.antennaHeight
    );
}
```

And at line ~306:
```javascript
const m = budget.margin - diffractionLoss;
```

### Fix
Remove the entire block (lines 281-290). Simplify the margin calculation:

Replace lines 281-290 and the margin line with:
```javascript
// diffractionLoss block removed — all models include terrain effects in pathLossOverride
```

And change the margin line from:
```javascript
const m = budget.margin - diffractionLoss;
```
to:
```javascript
const m = budget.margin;
```

Also check if `calculateBullingtonDiffraction` is imported at the top of the file. If it's
only used in this dead block, remove the import too.

### Acceptance
- Dead `if ('Hata')` block removed
- Margin calculation uses `budget.margin` directly
- No functional change in behavior (it was already dead code)
- Unused imports cleaned up if applicable

---

## TASK 4: Add groundType/climate to LinkLayer configRef (LOW)

**Severity**: LOW — stale closure risk, minor correctness issue
**File**: `src/components/Map/LinkLayer.jsx`
**Lines**: 39, 47-48

### Problem

v1.12.0 correctly added `groundType` and `climate` to the `useRF()` destructuring (line 36)
and uses them in the WASM ITM call (lines 100-109). However, they read from the closure
instead of from `configRef.current`.

The established pattern for `kFactor` and `clutterHeight` uses a `configRef` + `useEffect`
to avoid stale closures in the `runAnalysis` useCallback. `groundType` and `climate` should
follow the same pattern for consistency and correctness.

### Current code (LinkLayer.jsx lines 39, 47-49)
```javascript
const configRef = useRef({ nodeConfigs, freq, kFactor, clutterHeight });
// ...
useEffect(() => {
    configRef.current = { nodeConfigs, freq, kFactor, clutterHeight };
}, [nodeConfigs, freq, kFactor, clutterHeight]);
```

And at lines 100-103 (inside runAnalysis callback):
```javascript
const ground = GROUND_TYPES[groundType] || GROUND_TYPES['Average Ground'];
// ...
    groundEpsilon: ground.epsilon,
    groundSigma: ground.sigma,
    climate: climate
```

### Fix

**Step 1**: Add `groundType` and `climate` to `configRef` initial value (line 39):
```javascript
const configRef = useRef({ nodeConfigs, freq, kFactor, clutterHeight, groundType, climate });
```

**Step 2**: Add to the `useEffect` that keeps configRef current (lines 47-49):
```javascript
useEffect(() => {
    configRef.current = { nodeConfigs, freq, kFactor, clutterHeight, groundType, climate };
}, [nodeConfigs, freq, kFactor, clutterHeight, groundType, climate]);
```

**Step 3**: Update the WASM ITM call (around line 100) to read from `currentConfig` instead
of the closure. The `runAnalysis` callback already does
`const currentConfig = configRef.current;` earlier. Change:
```javascript
const ground = GROUND_TYPES[groundType] || GROUND_TYPES['Average Ground'];
```
to:
```javascript
const ground = GROUND_TYPES[currentConfig.groundType] || GROUND_TYPES['Average Ground'];
```

And change:
```javascript
climate: climate
```
to:
```javascript
climate: currentConfig.climate
```

### Acceptance
- `groundType` and `climate` in configRef initial value and useEffect
- WASM ITM call reads from `currentConfig.groundType` and `currentConfig.climate`
- Changing ground type/climate updates link analysis correctly
- No stale values after rapid sidebar changes

---

## TASK 5: Fix dropdown fallback value (COSMETIC)

**Severity**: COSMETIC
**File**: `src/components/Map/LinkAnalysisPanel.jsx`
**Line**: 414

### Problem
The model dropdown fallback still references the old `"itm"` value. The dropdown options
use `"itm_wasm"` as the value for the ITM model (line 418), but the fallback says `"itm"`.
If `propagationSettings.model` is ever undefined, the dropdown would show no selection.

### Current code
```javascript
value={propagationSettings.model || "itm"}
```

### Fix
```javascript
value={propagationSettings.model || "itm_wasm"}
```

### Acceptance
- If `propagationSettings.model` is ever undefined/null, the dropdown defaults to
  "Longley-Rice ITM (Full)" instead of showing no selection

---

## TASK 6: Fix rfService.js misleading default (COSMETIC)

**Severity**: COSMETIC
**File**: `src/utils/rfService.js`
**Line**: 50

### Problem
v1.12.0 changed the default model from `'bullington'` to `'itm_wasm'`:
```javascript
model: model || 'itm_wasm',
```

This function (`calculateLink`) sends requests to the Python backend. When `itm_wasm` arrives
at the Python backend, `rf_physics.py:149` maps it to Bullington:
```python
if model == 'bullington' or model == 'itm' or model == 'itm_wasm':
```

So the name `itm_wasm` is misleading — the Python backend runs Bullington, not WASM ITM.
The default should honestly reflect what the backend actually executes.

Note: This code path is only hit when LinkLayer calls the Python backend for non-WASM models.
The WASM ITM path in LinkLayer (line 86) skips the backend entirely. So in practice,
`'itm_wasm'` should never be sent to the backend. But if it is, the default should be honest.

### Current code (rfService.js line 50)
```javascript
model: model || 'itm_wasm',
```

### Fix
```javascript
model: model || 'bullington',
```

### Acceptance
- Default model sent to Python backend is `'bullington'`
- No functional change (Bullington runs either way), but the name is honest

---

## Task Priority and Dependency

```
TASK 1 (server.py crash)        — CRITICAL — do first, 1 line delete
TASK 2 (drag handler)           — HIGH     — needs GROUND_TYPES import + useRF additions
TASK 3 (diffraction dead code)  — LOW      — independent, simple removal
TASK 4 (configRef closure)      — LOW      — independent, 3 small edits in LinkLayer
TASK 5 (dropdown fallback)      — COSMETIC — independent, 1 line change
TASK 6 (rfService default)      — COSMETIC — independent, 1 line change
```

All 6 tasks are independent and can be done in any order.
**Task 1 should be done first** since it's a runtime crash affecting the entire Python API.
