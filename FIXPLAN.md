# v1.11.0 Fix Plan — 5 Remaining Issues

These are the remaining issues found during post-implementation verification of v1.11.0.
Each task is self-contained with exact file paths, line numbers, before/after code, and acceptance criteria.

---

## TASK 1: Fix server.py double rx_height crash (CRITICAL)

**Severity**: CRITICAL — the `/calculate-link` API endpoint crashes on every call
**File**: `rf-engine/server.py`
**Line**: 74

### Problem

`req.rx_height` is passed twice as a positional argument to `calculate_path_loss()`.
The 6th positional arg fills `rx_h` (correct), then the 7th positional arg fills `model`
with a float (wrong). Then `model=req.model` is also passed as a keyword argument for
the same parameter. Python raises:
`TypeError: calculate_path_loss() got multiple values for argument 'model'`

This crashes the Bullington, Hata, and FSPL models. Only the WASM ITM path works because
it skips the Python backend entirely.

### Current code (server.py lines 68-79)
```python
path_loss_db = rf_physics.calculate_path_loss(
    dist_m,
    elevs,
    req.frequency_mhz,
    req.tx_height,
    req.rx_height,
    req.rx_height,          # ← DELETE THIS LINE (duplicate)
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
- All three Python models (bullington, hata, fspl) return results
- No change to the function signature in `rf_physics.py`

---

## TASK 2: Fix RF Coverage drag handler (HIGH)

**Severity**: HIGH — dragging the RF Coverage marker reverts to old hardcoded values
**File**: `src/components/Map/MapContainer.jsx`
**Lines**: 596-640 (RF Coverage marker drag handler)

### Problem

When a user drags the RF Coverage transmitter marker on the map, the `dragend` handler
at line 602 rebuilds `rfParams` with all the old hardcoded values from before v1.11.0:

- `rxGain: 2.15` — ignores Node B antenna gain (line 625)
- No `txLoss` / `rxLoss` — cable losses not subtracted
- No `epsilon` / `sigma` / `climate` — ground params not passed
- `antennaHeight || 5.0` — should use `getAntennaHeightMeters()` (line 614)

The initial click handler (`CoverageClickHandler.jsx`) and the recalc path
(`MapContainer.jsx:226-238`) are both correctly wired. This drag handler was missed.

### Current code (MapContainer.jsx lines 612-633)
```javascript
.then((data) => {
    const elevation = data.elevation || 0;
    const h = antennaHeight || 5.0; // Keep relative height from ground

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

First, add `groundType`, `climate`, and `GROUND_TYPES` to MapContainer's imports and
context destructuring. MapContainer already destructures from `useRF()` at line 120.
Add these to the existing destructuring:

```javascript
// Add to the useRF() destructuring (around line 120-143):
groundType,
climate,
```

Add at the top of MapContainer.jsx (with the other imports):
```javascript
import { GROUND_TYPES } from '../../context/RFContext';
```

Then replace the drag handler's `.then((data) => { ... })` block with code that mirrors
the recalc path. The fixed version:

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

Also add `groundType`, `climate` to the recalc path rfParams (lines 226-238) since
it's also missing ground params:

```javascript
// Add to the existing recalc rfParams block at line 226:
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
- Dragging the RF Coverage marker produces the same results as clicking "Update Calculation"
- `rxGain` reflects Node B antenna setting, not hardcoded 2.15
- Cable loss is subtracted via `txLoss`
- Ground type and climate are passed through to WASM
- Antenna height uses `getAntennaHeightMeters()` not raw `antennaHeight || 5.0`
- The recalc path also includes ground params

---

## TASK 3: Remove diffraction dead code in LinkLayer (LOW)

**Severity**: LOW — dead code, no functional impact
**File**: `src/components/Map/LinkLayer.jsx`
**Lines**: 281-289

### Problem

The diffraction loss block checks `propagationSettings?.model === 'Hata'` (capital H),
but all model values are now lowercase (`'hata'`, `'bullington'`, `'itm_wasm'`, `'fspl'`).
This condition **never matches**, so `diffractionLoss` is always 0.

This is actually correct behavior — every backend model already includes its own loss
in `pathLossOverride`, so subtracting a separate diffraction value would double-count.
But the dead code should be cleaned up.

### Current code (LinkLayer.jsx lines 281-289)
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

### Fix
Remove the entire block (lines 281-289) and the reference to `diffractionLoss` in
the margin calculation. Replace lines 281-289 with just:
```javascript
let diffractionLoss = 0;
```

Keep the variable declaration since it's used at line 306:
`const m = budget.margin - diffractionLoss;`

With `diffractionLoss` always being 0, this simplifies to `budget.margin`, which is correct.

Alternatively, for a cleaner fix, also simplify line 306 from:
```javascript
const m = budget.margin - diffractionLoss;
```
to:
```javascript
const m = budget.margin;
```
and remove the `let diffractionLoss = 0;` line entirely. Also remove the unused
`calculateBullingtonDiffraction` import if it's no longer used anywhere in the file.

Check if `calculateBullingtonDiffraction` is used elsewhere in the file before removing
the import. If it's only used in this dead block, remove it from the import at line 7.

### Acceptance
- Dead `if ('Hata')` block removed
- Margin calculation uses `budget.margin` directly
- No functional change in behavior (it was already dead code)
- Unused imports cleaned up if applicable

---

## TASK 4: Wire ground params into LinkLayer WASM ITM path (LOW)

**Severity**: LOW — WASM ITM in Link Analysis uses default ground params instead of sidebar values
**File**: `src/components/Map/LinkLayer.jsx`
**Lines**: 31-48 (context destructuring and configRef), 96-106 (WASM ITM call)

### Problem

The WASM ITM calculation in LinkLayer hardcodes `groundEpsilon: 15.0`, `groundSigma: 0.005`,
`climate: 5` instead of reading from the sidebar's Ground Type and Climate Zone controls.

The RF Coverage tool correctly reads these from `rfContext`, but the Link Analysis WASM
path doesn't have access to `groundType` or `climate` because they aren't destructured
from `useRF()` or tracked in `configRef.current`.

### Current code

At line 31-35:
```javascript
const {
    txPower: proxyTx, antennaGain: proxyGain,
    freq, sf, bw, cableLoss, antennaHeight,
    kFactor, clutterHeight, recalcTimestamp,
    editMode, setEditMode, nodeConfigs, fadeMargin
} = useRF();
```

At line 38-48 (configRef):
```javascript
const configRef = useRef({ nodeConfigs, freq, kFactor, clutterHeight });
// ...
useEffect(() => {
    configRef.current = { nodeConfigs, freq, kFactor, clutterHeight };
}, [nodeConfigs, freq, kFactor, clutterHeight]);
```

At lines 96-106 (WASM ITM call):
```javascript
const loss = await calculateITM({
    elevationProfile: elevationData,
    stepSizeMeters: stepSize,
    frequencyMHz: currentFreq,
    txHeightM: h1,
    rxHeightM: h2,
    groundEpsilon: 15.0,    // hardcoded
    groundSigma: 0.005,     // hardcoded
    climate: 5              // hardcoded
});
```

### Fix

1. Add `groundType` and `climate` to the `useRF()` destructuring at line 31:
```javascript
const {
    txPower: proxyTx, antennaGain: proxyGain,
    freq, sf, bw, cableLoss, antennaHeight,
    kFactor, clutterHeight, recalcTimestamp,
    editMode, setEditMode, nodeConfigs, fadeMargin,
    groundType, climate
} = useRF();
```

2. Add `GROUND_TYPES` import at the top of the file (line 5, after the existing RFContext import):
```javascript
import { useRF } from '../../context/RFContext';
import { GROUND_TYPES } from '../../context/RFContext';
```
Or combine into one import:
```javascript
import { useRF, GROUND_TYPES } from '../../context/RFContext';
```

3. Add `groundType` and `climate` to `configRef` at line 38 and 47-48:
```javascript
const configRef = useRef({ nodeConfigs, freq, kFactor, clutterHeight, groundType, climate });

useEffect(() => {
    configRef.current = { nodeConfigs, freq, kFactor, clutterHeight, groundType, climate };
}, [nodeConfigs, freq, kFactor, clutterHeight, groundType, climate]);
```

4. Update the WASM ITM call at lines 96-106 to use the config values:
```javascript
const ground = GROUND_TYPES[currentConfig.groundType] || GROUND_TYPES['Average Ground'];

const loss = await calculateITM({
    elevationProfile: elevationData,
    stepSizeMeters: stepSize,
    frequencyMHz: currentFreq,
    txHeightM: h1,
    rxHeightM: h2,
    groundEpsilon: ground.epsilon,
    groundSigma: ground.sigma,
    climate: currentConfig.climate || 5
});
```

### Acceptance
- Changing Ground Type dropdown in sidebar affects WASM ITM Link Analysis results
- Changing Climate Zone dropdown affects WASM ITM Link Analysis results
- Default behavior (Average Ground, Continental Temperate) produces same results as before
- RF Coverage tool is unaffected

---

## TASK 5: Fix dropdown fallback value (COSMETIC)

**Severity**: COSMETIC
**File**: `src/components/Map/LinkAnalysisPanel.jsx`
**Line**: 414

### Problem
The model dropdown fallback still references the old `"itm"` value.

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

## Task Dependency Graph

```
TASK 1 (server.py crash)          — independent, do first (CRITICAL)
TASK 2 (drag handler)             — independent (needs GROUND_TYPES import)
TASK 3 (diffraction dead code)    — independent
TASK 4 (LinkLayer ground params)  — independent (needs GROUND_TYPES import)
TASK 5 (dropdown fallback)        — independent
```

All 5 tasks are independent and can be done in parallel or any order.
**Task 1 should be done first** since it's a runtime crash affecting the API.
