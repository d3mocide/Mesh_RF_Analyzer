# MeshRF ITM Integration Review & Adoption Roadmap

**Date:** 2026-02-09
**Scope:** Full audit of propagation model integration, device parameter flow, math accuracy, and model-switching infrastructure.

---

## Executive Summary

MeshRF has a **strong foundation** for ITM integration. The C++ WASM Longley-Rice implementation uses the actual NTIA reference source code, the math formulas are verified correct against ITU-R standards, and the sidebar UI provides comprehensive device parameter editing. However, the audit reveals **several critical gaps between the data the user configures and the data that actually reaches the calculations**. The model-switching system (ITM/Hata/Bullington/FSPL) has a broken backend path, and environment parameters (ground type, climate) are dropped in multiple recalculation paths.

**Bottom line:** The data exists. The math is sound. The wiring has gaps.

---

## Part 1: What Works Well

### 1.1 WASM ITM Integration (Link Analysis)

The primary path -- clicking two points on the map with ITM (WASM) selected -- is **fully functional and correctly wired**.

**Data flow (verified):**
```
User clicks map -> LinkLayer.runAnalysis()
  -> fetchElevationPath() for terrain profile
  -> useWasmITM.calculatePathLoss() with:
     - elevationProfile (from tile server)
     - stepSizeMeters (calculated from profile)
     - frequencyMHz (from RFContext.freq)
     - txHeightM (from nodeConfigs.A.antennaHeight)
     - rxHeightM (from nodeConfigs.B.antennaHeight)
     - groundEpsilon (from GROUND_TYPES[groundType])
     - groundSigma (from GROUND_TYPES[groundType])
     - climate (from RFContext.climate)
  -> ITM_P2P_TLS() C++ function (NTIA reference)
  -> path_loss_db returned
  -> calculateLinkBudget() with per-node A/B params
```

**File:** `src/components/Map/LinkLayer.jsx:92-118`

This path correctly uses: per-node antenna heights, per-node gains/losses, user-selected ground type, climate zone, frequency, and the full ITM terrain model.

### 1.2 WASM RF Coverage

The coverage heatmap tool also correctly invokes the full ITM model via WASM for every radial from the transmitter.

**File:** `src/hooks/useRFCoverageTool.js:153-172`

Parameters passed: tx height, rx height, frequency, tx power (with cable loss subtracted), tx gain, rx gain, rx sensitivity, epsilon, sigma, climate. The C++ coverage function (`libmeshrf/src/meshrf_coverage.cpp`) calls `calculate_radial_loss()` which invokes `ITM_P2P_TLS()` for each pixel.

### 1.3 Per-Node A/B Configuration

The dual-node system in RFContext is well-designed:
- GLOBAL mode updates both nodes simultaneously
- A/B mode updates individual nodes
- Device power caps, antenna gain sync, and cable loss are all computed correctly
- Link budget correctly pulls txPower/txGain/txLoss from Node A and rxGain/rxLoss from Node B

**File:** `src/context/RFContext.jsx:70-82`

### 1.4 Math Accuracy (Verified)

All core formulas have been verified against authoritative sources:

| Formula | Source | Status |
|---------|--------|--------|
| FSPL: `20log10(d) + 20log10(f) + 32.44` | ITU-R P.525-4 | Correct (32.45 in ITU exact; 0.01 dB immaterial) |
| Okumura-Hata (all variants) | Hata (1980) IEEE paper | Correct (all 4 environment types) |
| Knife-edge diffraction J(v) | ITU-R P.526-14 Eq. 31 | Correct |
| Fresnel zone radius (17.32 constant) | sqrt(300) derivation | Correct |
| Earth bulge h=(d1*d2)/(2*Re) | Standard microwave textbook | Correct |
| K-factor = 1.33 | Standard atmosphere (4/3 earth) | Correct |
| ITM N_0=301, mdvar=12, T/L/S=50/50/50 | NTIA reference | Correct and appropriate |

### 1.5 Model Selector UI

The LinkAnalysisPanel provides a clean dropdown with all four models:
- Longley-Rice ITM (Full) -- `itm_wasm`
- Free Space (Optimistic) -- `fspl`
- Bullington (Terrain Helper) -- `bullington`
- Okumura-Hata (Statistical) -- `hata`

Plus an environment selector for Hata (urban/suburban/rural) with validity warnings.

**File:** `src/components/Map/LinkAnalysisPanel.jsx:411-422`

---

## Part 2: Critical Issues Found

### BUG-1: Backend `/calculate-link` Endpoint is Broken (CRITICAL)

**File:** `rf-engine/server.py:68-79`

```python
path_loss_db = rf_physics.calculate_path_loss(
    dist_m,
    elevs,
    req.frequency_mhz,
    req.tx_height,
    req.rx_height,
    req.rx_height,         # <-- BUG: duplicate positional arg
    model=req.model,       # <-- conflicts with positional
    environment=req.environment,
    k_factor=req.k_factor,
    clutter_height=req.clutter_height
)
```

`req.rx_height` is passed twice. The second instance occupies the `model` positional parameter slot, then `model=req.model` is also passed as a keyword argument. Python raises `TypeError: calculate_path_loss() got multiple values for argument 'model'`.

**Impact:** Any model that routes through the backend (Hata, Bullington, ITM non-WASM) will **crash with a 500 error**. Only `itm_wasm` works because it bypasses the backend entirely and runs client-side WASM.

**Fix:** Remove the duplicate `req.rx_height` on line 74.

### BUG-2: Environment Params Not Passed to CoverageClickHandler (HIGH)

**File:** `src/components/Map/MapContainer.jsx:509-522`

The `rfContext` prop passed to `CoverageClickHandler` is **missing** `groundType`, `climate`, and `calculateSensitivity`:

```javascript
rfContext={{
    freq, txPower: proxyTx, antennaGain: proxyGain,
    bw, sf, cr, antennaHeight, getAntennaHeightMeters,
    rxHeight, txLoss: cableLoss, rxLoss: 0,
    rxAntennaGain: nodeConfigs.B.antennaGain,
    // MISSING: groundType, climate, calculateSensitivity
}}
```

**Impact:** `CoverageClickHandler` (line 24) falls back to `GROUND_TYPES['Average Ground']` for epsilon/sigma and `undefined` for climate (which defaults to 5 in WASM). The user's ground type and climate zone selections in the sidebar are **silently ignored** on initial RF coverage clicks.

### BUG-3: RF Coverage Recalculation Drops Environment Params (HIGH)

**File:** `src/components/Map/MapContainer.jsx:226-238`

When the "Update Calculation" button triggers a recalculation, the `rfParams` object is rebuilt **without** `epsilon`, `sigma`, or `climate`:

```javascript
const rfParams = {
    freq, txPower: proxyTx, txGain: proxyGain,
    txLoss: cableLoss, rxLoss: 0,
    rxGain: nodeConfigs.B.antennaGain || 2.15,
    rxSensitivity: currentSensitivity,
    bw, sf, cr, rxHeight,
    // MISSING: epsilon, sigma, climate
};
```

**Impact:** After parameter updates, the coverage map recalculates using hardcoded WASM defaults (Average Ground, Continental Temperate) instead of user selections.

### BUG-4: RF Observer Drag Drops Multiple Params (MEDIUM)

**File:** `src/components/Map/MapContainer.jsx:621-631`

When dragging the RF coverage transmitter marker, the recalc builds rfParams missing: `txLoss`, `epsilon`, `sigma`, `climate`. Also hardcodes `rxGain: 2.15` instead of using `nodeConfigs.B.antennaGain`.

### BUG-5: Backend Hata/Bullington Falls Back to Bullington for ITM (LOW)

**File:** `rf-engine/rf_physics.py:149`

```python
if model == 'bullington' or model == 'itm' or model == 'itm_wasm':
    diffraction = calculate_bullington_loss(...)
    return fspl + diffraction
```

When the backend model is set to `itm` or `itm_wasm`, it silently falls back to FSPL + Bullington diffraction instead of running actual ITM. There is no server-side ITM implementation (the `itmlogic` Python package is listed in requirements.txt but never imported). This is only relevant if BUG-1 is fixed, since the backend currently crashes before reaching this code.

### BUG-6: Batch Processing Uses FSPL Only (MEDIUM)

**File:** `src/components/Map/BatchProcessing.jsx:213-222`

Batch mesh report uses `calculateLinkBudget()` without `pathLossOverride`, meaning it always falls back to FSPL. It never calls the backend or WASM for terrain-aware propagation. For a mesh planning tool, this means batch reports can be overly optimistic.

Additionally, batch processing uses the proxy `antennaHeight` and `antennaGain` (GLOBAL mode values) for both TX and RX instead of per-node configs, and doesn't apply `fadeMargin`.

---

## Part 3: Parameter Flow Gaps

### What the User Can Configure (Sidebar)

| Parameter | UI Control | Location |
|-----------|-----------|----------|
| Device (preset) | Dropdown | Sidebar:305-316 |
| Antenna (preset/custom) | Dropdown + gain input | Sidebar:318-345 |
| Antenna Height | Slider 1-50m | Sidebar:347-359 |
| RX Height | Slider 1-30m | Sidebar:361-380 |
| Cable Type | Dropdown | Sidebar:385-396 |
| Cable Length | Numeric input | Sidebar:398-413 |
| TX Power | Slider 0-max | Sidebar:420-435 |
| K-Factor | Numeric input | Sidebar:537-548 |
| Clutter Height | Numeric input | Sidebar:550-562 |
| Ground Type | Dropdown | Sidebar:567-578 |
| Climate Zone | Dropdown | Sidebar:581-591 |
| Fade Margin | Slider 0-20 dB | Sidebar:595-611 |
| Radio Preset / Custom | Dropdown + fields | Sidebar:615-695 |

### Where Parameters Actually Reach Calculations

| Parameter | Link (ITM WASM) | Link (Backend) | RF Coverage (Click) | RF Coverage (Recalc) | RF Coverage (Drag) | Batch |
|-----------|:---:|:---:|:---:|:---:|:---:|:---:|
| TX Power | Y | CRASH | Y | Y | Y | Y |
| TX Antenna Gain | Y (per-node) | CRASH | Y | Y | hardcoded 2.15 | Y (global) |
| TX Antenna Height | Y (per-node) | CRASH | Y | Y | Y | Y (global) |
| TX Cable Loss | Y (device loss only) | CRASH | Y | Y | MISSING | Y |
| RX Antenna Gain | Y (per-node) | CRASH | fallback 2.15 | fallback 2.15 | hardcoded 2.15 | Y (global) |
| RX Height | N/A | CRASH | Y | Y | Y | N/A |
| Frequency | Y | CRASH | Y | Y | Y | Y |
| SF / BW | Y (sensitivity) | CRASH | Y | Y | Y | Y |
| K-Factor | Y | CRASH | N/A | N/A | N/A | Y |
| Clutter Height | Y | CRASH | N/A | N/A | N/A | Y |
| Ground Type (eps/sig) | Y | CRASH | MISSING | MISSING | MISSING | N/A |
| Climate Zone | Y | CRASH | MISSING | MISSING | MISSING | N/A |
| Fade Margin | Y | CRASH | N/A | N/A | N/A | MISSING |
| Propagation Model | Y (WASM only) | CRASH | always ITM WASM | always ITM WASM | always ITM WASM | FSPL only |

**Legend:** Y = correctly passed, MISSING = silently uses defaults, CRASH = server error, N/A = not applicable to this tool

---

## Part 4: Math Accuracy Notes

### 4.1 Minor Discrepancies (Non-Critical)

**FSPL Constant:** JavaScript and Python use `32.44`, C++ ITM uses `32.45`. The exact value per ITU-R P.525-4 (using c = 299,792,458 m/s) is 32.45. The difference is 0.01 dB -- completely immaterial for planning purposes but could be harmonized for consistency.

**LoRa Base Sensitivity:** Code uses `-123 dBm` for SF7/125kHz. The Semtech SX1262 datasheet specifies `-124 dBm` in power-saving RX mode. The code value appears to originate from the older SX1276 datasheet. For SX1262-based devices (which all MeshCore devices use), `-124 dBm` would be more accurate. This makes all link budgets **1 dB optimistic**.

**SF Gain Approximation:** Code uses a flat `2.5 dB/step`. Actual SX1262 datasheet values show ~3 dB/step for SF7-SF10 and ~1.5 dB/step for SF11-SF12. The 2.5 dB average is reasonable for planning but could be improved with a lookup table for precision.

### 4.2 Dual Sensitivity Calculation

RFContext exports two different sensitivity calculation methods:

1. **calculateLinkBudget** (rfMath.js:81-91): Uses `base + bwFactor + sfFactor` with SF_GAIN_PER_STEP=2.5
2. **calculateSensitivity** (RFContext.jsx:293-312): Uses thermal noise floor + NF + SNR lookup table

These give slightly different results. For SF7/125kHz:
- Method 1: -123 + 0 + 0 = **-123 dBm**
- Method 2: -174 + 10*log10(125000) + 6 + (-7.5) = -174 + 51 + 6 - 7.5 = **-124.5 dBm**

The 1.5 dB discrepancy means coverage maps (which use `calculateSensitivity`) are slightly more conservative than link analysis (which uses `calculateLinkBudget`). This inconsistency should be resolved by using a single canonical method.

### 4.3 Okumura-Hata Validity Bounds

The Hata model is designed for:
- **Frequency:** 150-1500 MHz (LoRa 915 MHz is within range)
- **Distance:** 1-20 km (code allows < 1 km by clamping to 0.1 km)
- **Base station height:** 30-200 m (most LoRa deployments are 2-15 m -- well below minimum)
- **Mobile height:** 1-10 m

The UI correctly warns when parameters are outside Hata bounds, but the model still runs with potentially unreliable results for typical LoRa antenna heights.

---

## Part 5: Model Switching Architecture

### Current State

The model selector in LinkAnalysisPanel sets `propagationSettings.model` which flows to LinkLayer. The routing logic:

```
itm_wasm (default) -> Client-side WASM ITM (works correctly)
hata               -> Backend API call (CRASHES - BUG-1)
bullington         -> Backend API call (CRASHES - BUG-1)
fspl               -> Backend API call (CRASHES - BUG-1)
```

**Only the WASM ITM path is functional.** The model selector appears to work but the three non-WASM options silently fail (the frontend catches the error and falls back to no backend path loss, which means FSPL-only via calculateLinkBudget).

### RF Coverage Tool

The RF coverage tool **always** uses WASM ITM regardless of the model selector. There is no model switching for coverage maps -- they are hardwired to the C++ ITM implementation. This is actually a reasonable design choice since ITM is the most accurate model, but users may expect the model selector to affect coverage maps too.

### Viewshed Tool

The viewshed tool is pure line-of-sight geometry and doesn't use any propagation model. This is correct behavior.

---

## Part 6: Adoption Roadmap

### Phase 1: Critical Bug Fixes (Immediate)

**P1-1. Fix Backend Double-Parameter Bug**
- File: `rf-engine/server.py:74`
- Fix: Remove duplicate `req.rx_height` positional argument
- Impact: Unblocks Hata, Bullington, and FSPL models via backend

**P1-2. Wire Environment Params to CoverageClickHandler**
- File: `src/components/Map/MapContainer.jsx:509-522`
- Fix: Add `groundType`, `climate`, `calculateSensitivity` to rfContext prop
- Impact: User's ground type and climate selections will affect RF coverage

**P1-3. Wire Environment Params to Recalculation Path**
- File: `src/components/Map/MapContainer.jsx:226-238`
- Fix: Import GROUND_TYPES, look up current groundType, add epsilon/sigma/climate to rfParams
- Impact: "Update Calculation" button respects environment settings

**P1-4. Wire Full Params to RF Observer Drag Handler**
- File: `src/components/Map/MapContainer.jsx:621-631`
- Fix: Add txLoss, epsilon, sigma, climate, use nodeConfigs.B.antennaGain for rxGain
- Impact: Dragging the RF transmitter marker produces correct recalculations

### Phase 2: Consistency & Accuracy (Short-term)

**P2-1. Unify Sensitivity Calculation**
- Choose one canonical method (recommend the thermal noise floor approach from RFContext)
- Update calculateLinkBudget to use the same method or accept sensitivity as a parameter
- Eliminates the 1.5 dB discrepancy between link analysis and coverage tools

**P2-2. Update LoRa Base Sensitivity to SX1262 Spec**
- Change `BASE_SENSITIVITY_SF7_125KHZ` from -123 to -124 in rfConstants.js
- Or better: replace flat 2.5 dB/step with per-SF lookup table matching SX1262 datasheet
- Impact: 1 dB more conservative (realistic) link budgets

**P2-3. Harmonize FSPL Constant**
- Update rfMath.js and rf_physics.py to use 32.45 (matching ITU-R P.525-4 and C++ ITM code)
- Impact: Cosmetic consistency (0.01 dB)

**P2-4. Add Fade Margin to Batch Processing**
- File: `src/components/Map/BatchProcessing.jsx:213-222`
- Pass `fadeMargin` to calculateLinkBudget call
- Impact: Batch reports include the safety margin users configured

### Phase 3: Full Model Switching (Medium-term)

**P3-1. Implement Client-Side Bullington/Hata/FSPL**
- Move Bullington diffraction and Hata calculations to JavaScript (already partially done in rfMath.js for Bullington)
- This eliminates the dependency on the Python backend for non-ITM models
- The backend can still serve as a fallback but the primary path should be client-side

**P3-2. Apply Model Selection to RF Coverage Tool**
- Currently hardwired to WASM ITM
- Add model dispatch in useRFCoverageTool.js that uses FSPL-only or Hata for faster coverage maps
- ITM remains the default but users could choose faster/simpler models for quick surveys

**P3-3. Integrate WASM ITM into Batch Processing**
- Currently FSPL-only; should use the same WASM ITM path as link analysis
- Requires fetching elevation profiles for each node pair (already done for link analysis)
- Will significantly improve batch report accuracy

**P3-4. Per-Node Configs in Batch Processing**
- Currently uses GLOBAL proxy values for both TX and RX
- Should support per-node antenna heights, gains, and cable configurations
- CSV import could include optional height/device columns

### Phase 4: Advanced Integration (Long-term)

**P4-1. Server-Side ITM via itmlogic**
- `itmlogic` is listed in requirements.txt but never imported
- Implement as a true Python fallback for environments where WASM isn't available
- Enables server-side batch processing with full ITM accuracy

**P4-2. COST 231 Hata Extension**
- Current Hata model covers 150-1500 MHz
- COST 231 extends to 2000 MHz for future higher-frequency mesh deployments
- Straightforward addition to rf_physics.py

**P4-3. Clutter/Land Use Integration**
- Current clutter model is a uniform height applied everywhere
- Could integrate land cover data (NLCD, Corine) for per-pixel clutter classification
- Would significantly improve urban/forest coverage accuracy

**P4-4. Antenna Pattern Support**
- All models currently assume omnidirectional antennas
- Yagi antenna preset has 11 dBi gain but no directional pattern
- Adding azimuth/elevation patterns would improve directional link predictions

**P4-5. Multi-Hop Mesh Analysis**
- Current tools analyze point-to-point links
- A mesh planner would calculate end-to-end connectivity through relay chains
- Could use the batch processing infrastructure as a foundation

---

## Appendix A: File Reference

| File | Role | Key Lines |
|------|------|-----------|
| `rf-engine/server.py` | Backend API | 68-79 (BUG-1) |
| `rf-engine/rf_physics.py` | Python propagation models | 25-155 |
| `src/utils/rfMath.js` | JS propagation math | 10-368 |
| `src/utils/rfConstants.js` | Constants & thresholds | 1-45 |
| `src/utils/rfService.js` | API client | 32-56 |
| `src/context/RFContext.jsx` | Global state | 54-317 |
| `src/data/presets.js` | Hardware presets | 1-122 |
| `src/hooks/useWasmITM.js` | WASM ITM hook | 1-167 |
| `src/hooks/useRFCoverageTool.js` | Coverage tool | 102-228 |
| `src/components/Map/LinkLayer.jsx` | Link analysis UI | 71-139 |
| `src/components/Map/LinkAnalysisPanel.jsx` | Results panel + model selector | 404-528 |
| `src/components/Map/MapContainer.jsx` | Main map + param wiring | 211-243, 503-523, 614-634 |
| `src/components/Map/Controls/CoverageClickHandler.jsx` | Coverage click handler | 16-46 |
| `src/components/Map/BatchProcessing.jsx` | Batch mesh report | 179-253 |
| `src/components/Layout/Sidebar.jsx` | Parameter editing UI | 299-695 |
| `libmeshrf/src/meshrf_itm.cpp` | C++ ITM wrapper | 18-98 |
| `libmeshrf/src/meshrf_coverage.cpp` | C++ coverage engine | 7-111 |
| `libmeshrf/src/bindings.cpp` | WASM bindings | 14-75 |
| `libmeshrf/vendor/itm/` | NTIA ITM reference source | (40+ files) |

## Appendix B: ITM Parameter Defaults

| Parameter | Value | Source |
|-----------|-------|--------|
| Surface Refractivity (N_0) | 301.0 N-units | Standard atmosphere |
| Mode of Variability (mdvar) | 12 | Mobile + eliminate location variability |
| Time Percentage | 50% | Median (standard planning) |
| Location Percentage | 50% | Median |
| Situation Percentage | 50% | Median |
| Polarization | 1 (Vertical) | LoRa standard |
| Default Ground (epsilon) | 15.0 | Average ground |
| Default Ground (sigma) | 0.005 S/m | Average ground |
| Default Climate | 5 | Continental Temperate |

## Appendix C: Math Verification Sources

- ITU-R P.525-4 (FSPL)
- ITU-R P.526-14 (Knife-edge diffraction)
- M. Hata, IEEE Trans. Veh. Technol., Vol. VT-29, 1980 (Okumura-Hata)
- Semtech SX1261/2 Datasheet Rev 1.2 (LoRa sensitivity)
- NTIA/ITS ITM Reference Implementation (github.com/NTIA/itm)
- COST 231 Final Report (Hata extension, future reference)
