# MeshRF ITM Integration Audit & Adoption Roadmap

## Executive Summary

MeshRF has three propagation model paths and a well-structured device parameter system. The **Link Analysis tool** is the most mature consumer — it reads per-node device parameters from the sidebar and dispatches to the correct backend model. The **RF Coverage tool** (WASM) runs the real NTIA ITM engine but has significant parameter adoption gaps: several device settings from the sidebar are either hardcoded or ignored. The **Python backend "ITM"** is actually a Bullington knife-edge diffraction approximation, not the full Longley-Rice model. The math that exists is correct against published standards, but the codebase has two different "ITM" implementations that produce different results, and the sidebar parameter flow does not reach all calculation paths equally.

---

## Part 1: Architecture Overview

### Three Propagation Paths

| Path | Engine | Model Label | Actual Algorithm | Used By |
|------|--------|-------------|------------------|---------|
| **WASM/C++** | `libmeshrf/` → NTIA `itm` vendor lib | ITM | **Real ITM/Longley-Rice P2P** | RF Coverage tool only |
| **Python Backend** | `rf-engine/rf_physics.py` | "ITM" | **FSPL + Bullington knife-edge** | Link Analysis (when model=itm) |
| **Python Backend** | `rf-engine/rf_physics.py` | Hata | **Okumura-Hata** | Link Analysis (when model=hata) |
| **Frontend JS** | `src/utils/rfMath.js` | FSPL | **Free Space Path Loss** | Link budget (fallback when no backend result) |

### Device Parameter State Flow

```
Sidebar UI
    │
    ▼
RFContext.jsx (nodeConfigs.A / nodeConfigs.B)
    │
    ├──► LinkLayer.jsx ──► Python Backend (/calculate-link)     ✅ Full adoption
    │        Uses: freq, nodeConfigs.A.antennaHeight, nodeConfigs.B.antennaHeight,
    │              propagationSettings.model, propagationSettings.environment
    │        Budget: configA.txPower, configA.antennaGain, configA.device.loss,
    │                configB.antennaGain, configB.device.loss, sf, bw
    │
    ├──► CoverageClickHandler ──► useRFCoverageTool ──► WASM   ⚠️  Partial adoption
    │        Uses: freq, txPower (proxy), antennaGain (proxy), bw, sf, cr, rxHeight
    │        Missing: Per-node configs, kFactor, clutterHeight, environment
    │
    └──► Viewshed Tool                                          ❌ No RF params
             Uses: observer height only (hardcoded 2.0m)
             No RF parameters at all (purely geometric LOS)
```

---

## Part 2: Math Verification Against Standards

### 2.1 Free Space Path Loss — CORRECT

**Your formula** (`rfMath.js:10-14`, `rf_physics.py:143`):
```
FSPL(dB) = 20·log₁₀(d_km) + 20·log₁₀(f_MHz) + 32.44
```

**Standard (Friis)**: Identical. The constant 32.44 uses c = 299,792,458 m/s. The NTIA ITM reference uses 32.45 (c ≈ 3×10⁸). The 0.01 dB difference is negligible.

**Verdict**: ✅ Correct

### 2.2 Okumura-Hata Model — CORRECT (with caveats)

**Your formula** (`rf_physics.py:87-127`):
```
L_u = 69.55 + 26.16·log₁₀(f) - 13.82·log₁₀(h_b) - a(h_m) + (44.9 - 6.55·log₁₀(h_b))·log₁₀(d)
```

Verified against ITU-R P.529 / Okumura-Hata reference:
- Urban base coefficients: ✅ Match (69.55, 26.16, 13.82, 44.9, 6.55)
- Small/medium city a(h_m): ✅ `(1.1·log₁₀(f) - 0.7)·h_m - (1.56·log₁₀(f) - 0.8)`
- Large city corrections (f≥400, f<400): ✅ Match published formulas
- Suburban correction: ✅ `L_u - 2·(log₁₀(f/28))² - 5.4`
- Rural correction: ✅ `L_u - 4.78·(log₁₀(f))² + 18.33·log₁₀(f) - 40.94`

**Caveats**:
- Hata is valid for **150–1500 MHz, 1–20 km, h_b 30–200 m, h_m 1–10 m**
- Your LoRa use (910 MHz) is within frequency range ✅
- Your typical antenna heights (2–10m TX) are **below** the 30m minimum h_b — Hata was designed for cellular towers, not ground-level mesh nodes
- Distance clamped to `max(0.1, dist_km)` — anything below 1 km is outside valid range

**Verdict**: ✅ Math correct, ⚠️ application outside designed parameter range for low-height nodes

### 2.3 Bullington Knife-Edge Diffraction — CORRECT

**Your formula** (`rf_physics.py:25-85`, `rfMath.js:283-368`):
- Fresnel diffraction parameter: `v = h · √(2D / (λ·d₁·d₂))` ✅
- Knife-edge loss (ITU-R P.526-14, Eq. 31): `J(v) = 6.9 + 20·log₁₀(√((v-0.1)² + 1) + v - 0.1)` ✅
- Earth bulge: `h = (d₁·d₂) / (2·R_eff)` with k=1.333 ✅
- Threshold: v ≤ -0.78 → 0 dB loss ✅

**Verdict**: ✅ Correct implementation of Bullington method

### 2.4 Real ITM (WASM/C++) — CORRECT (vendored NTIA reference)

**Your implementation** (`libmeshrf/vendor/itm/`):
- Vendored from NTIA/ITS reference implementation
- Calls `ITM_P2P_TLS()` directly — this is the standard point-to-point, time/location/situation variant
- PFL buffer format correct: `pfl[0]=N, pfl[1]=step_size, pfl[2..N+1]=elevations`

**Default parameters** (`meshrf_itm.h`, `meshrf_coverage.cpp`):
| Parameter | Your Value | Standard | Status |
|-----------|-----------|----------|--------|
| N₀ (refractivity) | 301.0 | 301.0 | ✅ |
| ε (permittivity) | 15.0 | 15.0 (average ground) | ✅ |
| σ (conductivity) | 0.005 S/m | 0.005 (average ground) | ✅ |
| Climate | 5 | 5 (Continental Temperate) | ✅ |
| Polarization | 1 (vertical) | Application-dependent | ✅ for LoRa |
| mdvar | 12 | Application-dependent | ⚠️ See below |
| Time/Loc/Sit | 50/50/50 | 50/50/50 (median) | ✅ |

**mdvar = 12**: This is Mobile mode (2) with eliminated location variability (+10). Reasonable for coverage mapping but should be documented and potentially configurable for different use cases.

**Verdict**: ✅ Correct use of NTIA reference implementation

### 2.5 Fresnel Zone Radius — CORRECT

**Your formula** (`rfMath.js:17-24`, `rfConstants.js`):
```
F₁ = 17.32 · √(d₁·d₂ / (f_GHz · D))    [meters, km, GHz]
```

The constant 17.32 = √(c × 10⁻³) ≈ √(299,792,458) / 1000. ✅

**Verdict**: ✅ Correct

### 2.6 LoRa Sensitivity Calculation — CORRECT

**Your formula** (`RFContext.jsx:213-228`):
```
Sensitivity = -174 + 10·log₁₀(BW_Hz) + NF + SNR_limit
```

With NF = 6 dB and SNR limits from Semtech datasheets:
| SF | SNR Limit | Your Value |
|----|-----------|-----------|
| 7 | -7.5 dB | -7.5 | ✅ |
| 8 | -10 dB | -10 | ✅ |
| 9 | -12.5 dB | -12.5 | ✅ |
| 10 | -15 dB | -15 | ✅ |
| 11 | -17.5 dB | -17.5 | ✅ |
| 12 | -20 dB | -20 | ✅ |

**Verdict**: ✅ Correct

### 2.7 Link Budget — CORRECT

**Your formula** (`rfMath.js:53-101`):
```
RSSI = P_tx + G_tx - L_tx - PathLoss - ExcessLoss - FadeMargin + G_rx - L_rx
```

This follows the standard link budget equation. Antenna gains are correctly applied in the budget (not inside path loss), which is the right approach.

**Verdict**: ✅ Correct

### 2.8 Earth Radius — ACCEPTABLE

| Context | Your Value | Standard |
|---------|-----------|----------|
| JS/Python | 6,371 km | 6,371 km (WGS84 mean) |
| ITM vendor C++ | 6,370 km | NTIA reference value |

The 1 km difference (0.016%) is negligible. ✅

---

## Part 3: Critical Findings

### FINDING 1: Two Different "ITM" Engines Producing Different Results

**Severity: HIGH**

The codebase has two fundamentally different algorithms both labeled "ITM":

| | Python Backend (`rf_physics.py`) | WASM/C++ (`libmeshrf/`) |
|---|---|---|
| Algorithm | FSPL + Bullington knife-edge | Full NTIA ITM/Longley-Rice |
| Physics modeled | Single knife-edge diffraction | Diffraction + troposcatter + surface wave |
| Ground parameters | None (ignores conductivity, permittivity) | σ=0.005, ε=15, climate=5 |
| Used by | Link Analysis tool | RF Coverage tool |
| Accuracy | Approximation only | Reference-grade |

**Impact**: A user running the Link Analysis tool with "Longley-Rice (Terrain)" selected gets Bullington diffraction, not actual Longley-Rice. The RF Coverage tool uses real ITM but the user has no way to know they're getting different algorithms for the same model label.

**Location**: `rf-engine/rf_physics.py:148-152` vs `libmeshrf/src/meshrf_itm.cpp:70-86`

### FINDING 2: RF Coverage Tool Hardcodes Parameters the Sidebar Controls

**Severity: HIGH**

The RF Coverage WASM path has several parameters that don't flow from the sidebar:

| Parameter | Sidebar Control | RF Coverage Actual Value | Source |
|-----------|----------------|-------------------------|--------|
| **RX Gain** | Node B antenna selection | **Hardcoded 2.15 dBi** | `CoverageClickHandler.jsx:24` |
| **RX Height** | rxHeight slider (default 2.0m) | **Fallback 5.0m if missing** | `useRFCoverageTool.js:160` |
| **K-Factor** | kFactor slider (default 1.33) | **Not passed at all** | N/A — WASM ITM computes its own from N₀ |
| **Clutter Height** | clutterHeight slider | **Not passed at all** | N/A — WASM ITM has no clutter parameter |
| **Cable Loss (TX)** | Derived from device preset | **Not subtracted** | `meshrf_coverage.cpp:100` uses raw txPower |
| **Cable Loss (RX)** | Derived from device preset | **Not subtracted** | Same |
| **Ground type** | Not in sidebar | **Hardcoded: σ=0.005, ε=15** | `meshrf_coverage.cpp:84-86` |
| **Climate** | Not in sidebar | **Hardcoded: 5 (Continental Temperate)** | `meshrf_coverage.cpp:87` |
| **Environment** | Dropdown (urban, suburban, rural) | **Not passed** (ITM doesn't use it) | N/A |

**Key issues**:
- `CoverageClickHandler.jsx:24`: `rxGain: 2.15` is hardcoded to stubby antenna gain. If user selects an 8 dBi omni or 11 dBi Yagi for Node B, the coverage map ignores it.
- `useRFCoverageTool.js:160`: `rfParams.rxHeight || 5.0` — the fallback is 5.0m, but the context default is 2.0m. These should match.
- `meshrf_coverage.cpp:100`: `rssi_dbm = tx_power_dbm + tx_gain_dbi + rx_gain_dbi - path_loss_db` does not subtract cable losses for TX or RX.

**Location**: `src/components/Map/Controls/CoverageClickHandler.jsx:20-29`, `src/hooks/useRFCoverageTool.js:153-168`

### FINDING 3: RF Coverage Recalculation Also Hardcodes RX Gain

**Severity: MEDIUM**

When the user hits "Update Calculation" after changing parameters, `MapContainer.jsx:225-235` rebuilds rfParams:

```javascript
const rfParams = {
    freq,
    txPower: proxyTx,
    txGain: proxyGain,
    rxGain: 2.15,              // ← Hardcoded again
    rxSensitivity: currentSensitivity,
    bw, sf, cr, rxHeight,
};
```

This means even the recalc path ignores Node B's antenna gain.

**Location**: `src/components/Map/MapContainer.jsx:229`

### FINDING 4: Environment Selector Misleads When ITM Is Selected

**Severity: LOW**

The Environment dropdown (urban_small, suburban, rural) in LinkAnalysisPanel is always visible, but:
- When **Hata** is selected: Environment is used ✅
- When **ITM** is selected: Environment is passed to backend but **completely ignored** — Bullington uses terrain only
- When **FSPL** is selected: Environment is ignored

The UI should disable or hide the environment selector when ITM or FSPL is active.

**Location**: `src/components/Map/LinkAnalysisPanel.jsx:398-407`, `rf-engine/rf_physics.py:130-155`

### FINDING 5: Fade Margin Is Hardcoded, Not Configurable

**Severity: LOW**

`rfMath.js:66`: `fadeMargin = 10` dB is baked into every link budget calculation. There's no sidebar control to adjust it. While 10 dB is a reasonable default, power users may want to adjust this for different reliability requirements.

**Location**: `src/utils/rfMath.js:66`

### FINDING 6: Diffraction Loss Display Condition Is Inverted

**Severity: LOW**

In `LinkLayer.jsx:249`:
```javascript
if (propagationSettings?.model === 'Hata' && linkStats.profileWithStats) {
    diffractionLoss = calculateBullingtonDiffraction(...);
}
```

Diffraction loss visualization is only calculated when **Hata** is selected, which is the model that *doesn't* use terrain. When ITM/Bullington is selected (the model that *does* compute diffraction), this code doesn't run. The condition appears inverted or the intent is unclear.

**Location**: `src/components/Map/LinkLayer.jsx:249`

### FINDING 7: Viewshed Observer Height Is Hardcoded

**Severity: LOW**

`CoverageClickHandler.jsx:10-12`:
```javascript
setViewshedObserver({ lat, lng, height: 2.0 });
runViewshed(lat, lng, 2.0, 25000);
```

The viewshed always uses 2.0m observer height regardless of the antenna height set in the sidebar. The viewshed re-drag in `MapContainer.jsx:565` also hardcodes `elevation + 2.0`.

**Location**: `src/components/Map/Controls/CoverageClickHandler.jsx:10-12`, `src/components/Map/MapContainer.jsx:565`

### FINDING 8: Python analyze_link Uses Hardcoded K-Factor

**Severity: LOW**

`rf_physics.py:164`: `k = 1.333` is hardcoded in `analyze_link()`. The frontend passes `kFactor` from context to `analyzeLinkProfile()` (frontend), but the backend's `analyze_link()` doesn't accept it as a parameter. Since both frontend and backend analyze the link independently, this could cause minor discrepancies if the user changes k-factor.

**Location**: `rf-engine/rf_physics.py:164`

---

## Part 4: Parameter Adoption Matrix

| Parameter | Sidebar Control | Link Analysis | RF Coverage (WASM) | Viewshed | Site Optimization |
|-----------|:-:|:-:|:-:|:-:|:-:|
| **TX Power** | ✅ | ✅ nodeConfigs.A | ✅ proxyTx | N/A | N/A |
| **TX Antenna Gain** | ✅ | ✅ nodeConfigs.A | ✅ proxyGain | N/A | N/A |
| **TX Antenna Height** | ✅ | ✅ nodeConfigs.A | ✅ getAntennaHeightMeters() | ❌ hardcoded 2.0m | ❌ hardcoded 10m |
| **TX Device Loss** | ✅ (derived) | ✅ DEVICE_PRESETS[].loss | ❌ not subtracted | N/A | N/A |
| **RX Antenna Gain** | ✅ | ✅ nodeConfigs.B | ❌ hardcoded 2.15 dBi | N/A | N/A |
| **RX Antenna Height** | ✅ | ✅ nodeConfigs.B | ⚠️ passed but 5.0m fallback | N/A | N/A |
| **RX Device Loss** | ✅ (derived) | ✅ DEVICE_PRESETS[].loss | ❌ not subtracted | N/A | N/A |
| **Frequency** | ✅ | ✅ | ✅ | N/A | ✅ |
| **Bandwidth** | ✅ | ✅ | ✅ | N/A | N/A |
| **Spreading Factor** | ✅ | ✅ | ✅ | N/A | N/A |
| **K-Factor** | ✅ | ✅ (frontend) / ❌ (backend hardcoded) | ❌ ITM uses N₀ internally | N/A | N/A |
| **Clutter Height** | ✅ | ✅ (frontend only) | ❌ not passed | N/A | N/A |
| **RX Height** | ✅ | ✅ | ⚠️ | N/A | N/A |
| **Propagation Model** | ✅ | ✅ | ❌ always ITM | N/A | N/A |
| **Environment** | ✅ | ⚠️ ignored by ITM | N/A | N/A | N/A |
| **RX Sensitivity** | ✅ (calculated) | ✅ | ✅ | N/A | N/A |
| **Ground Conductivity** | ❌ no control | N/A | ❌ hardcoded 0.005 | N/A | N/A |
| **Ground Permittivity** | ❌ no control | N/A | ❌ hardcoded 15.0 | N/A | N/A |
| **Climate Zone** | ❌ no control | N/A | ❌ hardcoded 5 | N/A | N/A |
| **Fade Margin** | ❌ no control | ❌ hardcoded 10 dB | N/A | N/A | N/A |

**Legend**: ✅ = Fully adopted | ⚠️ = Partially adopted | ❌ = Not adopted / hardcoded | N/A = Not applicable

---

## Part 5: Adoption Roadmap

### Phase 1: Fix Parameter Flow (Critical Path)

These changes ensure the sidebar parameters actually reach the calculations.

#### 1.1 Wire cable losses into RF Coverage RSSI calculation

**Files**: `src/components/Map/Controls/CoverageClickHandler.jsx`, `src/components/Map/MapContainer.jsx`

Pass `txLoss` and `rxLoss` from device presets into rfParams. Subtract them in either the JS call site or the C++ engine.

#### 1.2 Wire RX antenna gain from Node B config into RF Coverage

**Files**: `src/components/Map/Controls/CoverageClickHandler.jsx:24`, `src/components/Map/MapContainer.jsx:229`

Replace `rxGain: 2.15` with dynamic value from nodeConfigs.B.antennaGain. For RF Coverage (which is a single-TX tool without a specific "Node B"), consider using a new "RX Assumptions" section or defaulting to a configurable value.

#### 1.3 Fix RX height fallback mismatch

**Files**: `src/hooks/useRFCoverageTool.js:160`

Change `rfParams.rxHeight || 5.0` to `rfParams.rxHeight || 2.0` to match the context default, or ensure rxHeight is always passed.

#### 1.4 Wire antenna height into Viewshed tool

**Files**: `src/components/Map/Controls/CoverageClickHandler.jsx:10-12`, `src/components/Map/MapContainer.jsx:565,573`

Use `getAntennaHeightMeters()` instead of hardcoded 2.0m for the viewshed observer height.

### Phase 2: Unify the ITM Implementation

#### 2.1 Route Link Analysis through the WASM ITM engine

**Current state**: Link Analysis uses Python Bullington (labeled "ITM"). RF Coverage uses real NTIA ITM (WASM).

**Target**: Both tools should use the same ITM engine for consistency.

**Option A — Frontend WASM for both**: Create a JS wrapper that calls the WASM module for a single point-to-point calculation (not full coverage map). Link Analysis would call this instead of the Python backend when model=itm.

**Option B — Python bindings for NTIA ITM**: Compile the NTIA ITM C code as a Python extension (via ctypes or pybind11) and call it from `rf_physics.py` instead of Bullington.

**Recommended**: Option A, since the WASM module is already loaded and the `calculate_radial_loss` function in `meshrf_itm.cpp` already does single-path P2P calculations.

#### 2.2 Rename Python Bullington to avoid confusion

If keeping the Python fallback, rename the model label from "itm" to "bullington" or "terrain_approx" in `rf_physics.py:148` and the UI selector. Reserve "ITM" for the real Longley-Rice implementation.

### Phase 3: Expose Advanced ITM Parameters

#### 3.1 Add ground type selector to sidebar

Add a dropdown or preset selector for ground conductivity/permittivity:

| Ground Type | σ (S/m) | ε |
|-------------|---------|---|
| Average Ground | 0.005 | 15 |
| Poor Ground | 0.001 | 4 |
| Good Ground | 0.020 | 25 |
| Fresh Water | 0.010 | 80 |
| Salt Water | 5.000 | 80 |
| City/Industrial | 0.001 | 5 |

Pass these through rfParams to the WASM engine.

#### 3.2 Add climate zone selector

Map the 7 ITM climate zones to a dropdown. Default to Continental Temperate (5) but allow Maritime Temperate Over Land (6) for PNW coastal users.

#### 3.3 Make fade margin configurable

Add a fade margin slider (0–20 dB) to the sidebar settings section. Pass it to `calculateLinkBudget()`.

### Phase 4: Model Switching Consistency

#### 4.1 Enable model switching for RF Coverage tool

Currently RF Coverage always uses ITM. Allow the propagation model dropdown to affect the coverage tool:
- **ITM**: Current behavior (WASM ITM)
- **Hata**: Would need a WASM or Python-based Hata coverage sweep
- **FSPL**: Simple distance-based calculation, useful for comparison

#### 4.2 Disable environment selector when not applicable

When ITM or FSPL is selected, gray out or hide the environment dropdown in LinkAnalysisPanel. Show a tooltip explaining that ITM uses terrain data directly.

#### 4.3 Add model validity warnings

When Hata is selected:
- Warn if distance < 1 km or > 20 km
- Warn if TX height < 30 m (outside Hata's designed range)
- Warn on mountainous terrain that Hata ignores elevation profile

### Phase 5: Quality of Life

#### 5.1 Pass K-Factor to Python backend

Add `k_factor` to the `LinkRequest` model and use it in `analyze_link()` and `calculate_bullington_loss()` instead of the hardcoded 1.333.

#### 5.2 Pass clutter height to both backends

Add clutter height to both the Python Bullington calculation (add to effective terrain) and the WASM ITM path (add to RX ground elevation).

#### 5.3 Document the mdvar parameter

Add a comment or config option explaining that `mdvar=12` means "Mobile mode, no location variability." Consider making it configurable for advanced users.

---

## Part 6: Verification Checklist

### Constants Verified Against Standards

| Constant | Your Value | Reference Value | Source | Status |
|----------|-----------|----------------|--------|--------|
| Earth Radius | 6,371 km | 6,371 km (WGS84) | WGS84 | ✅ |
| FSPL constant | 32.44 | 32.44 (exact c) / 32.45 (NTIA) | Friis equation | ✅ |
| K-factor default | 1.33 | 4/3 = 1.333... | ITU-R | ✅ |
| N₀ (refractivity) | 301.0 | 301.0 | NTIA ITM reference | ✅ |
| ε (avg ground) | 15.0 | 15.0 | ITU-R P.527-3 | ✅ |
| σ (avg ground) | 0.005 | 0.005 S/m | ITU-R P.527-3 | ✅ |
| Climate (continental temperate) | 5 | 5 | NTIA ITM enums | ✅ |
| Fresnel constant | 17.32 | 17.32 | √(c)/1000 | ✅ |
| Knife-edge threshold (v) | -0.78 | -0.78 | ITU-R P.526-14 | ✅ |
| Hata: 69.55 | 69.55 | 69.55 | Okumura-Hata | ✅ |
| Hata: 26.16 | 26.16 | 26.16 | Okumura-Hata | ✅ |
| Hata: 13.82 | 13.82 | 13.82 | Okumura-Hata | ✅ |
| Hata: 44.9, 6.55 | 44.9, 6.55 | 44.9, 6.55 | Okumura-Hata | ✅ |
| LoRa NF | 6 dB | 6 dB typical | Semtech SX1276 datasheet | ✅ |
| LoRa SNR limits | -7.5 to -20 | -7.5 to -20 | Semtech SX1276 datasheet | ✅ |
| Speed of light | 2.99792×10⁸ | 299,792,458 m/s | NIST | ✅ |

### Formulas Verified

| Formula | File | Status |
|---------|------|--------|
| FSPL | rfMath.js:10-14, rf_physics.py:143 | ✅ Matches Friis |
| Hata (urban base) | rf_physics.py:116 | ✅ Matches ITU |
| Hata (suburban correction) | rf_physics.py:121-122 | ✅ |
| Hata (rural correction) | rf_physics.py:125 | ✅ |
| Hata (large city a(h_m)) | rf_physics.py:108-112 | ✅ |
| Bullington v parameter | rf_physics.py:70, rfMath.js:341 | ✅ Matches ITU-R P.526 |
| Bullington knife-edge loss | rf_physics.py:81-83 | ✅ Matches ITU-R P.526-14 Eq.31 |
| Earth bulge | rf_physics.py:52 | ✅ h=(d₁·d₂)/(2·R_eff) |
| Fresnel zone radius | rf_physics.py:19-22, rfMath.js:17-24 | ✅ |
| Link budget (RSSI) | rfMath.js:69 | ✅ Standard link budget |
| LoRa sensitivity | RFContext.jsx:213-227 | ✅ Matches Semtech reference |
| ITM P2P call | meshrf_itm.cpp:70-86 | ✅ NTIA reference API |
| Haversine distance | rf_physics.py:8-16 | ✅ Standard haversine |

---

## Part 7: Priority Summary

| Priority | Issue | Impact | Effort |
|----------|-------|--------|--------|
| **P0** | RF Coverage hardcodes rxGain=2.15 | Coverage map ignores RX antenna | Small (wire through) |
| **P0** | RF Coverage doesn't subtract cable losses | RSSI is optimistic by 0.5–3 dB | Small (wire through) |
| **P1** | Two different "ITM" algorithms labeled the same | User confusion, inconsistent results | Medium (WASM P2P wrapper) |
| **P1** | Viewshed hardcodes 2.0m height | Ignores sidebar antenna height | Small |
| **P2** | Environment selector misleading for ITM | UI suggests terrain-independent config affects ITM | Small (conditional disable) |
| **P2** | K-factor not passed to Python backend | Minor discrepancy if user changes kFactor | Small |
| **P2** | Clutter height not in WASM path | Forest/urban clutter ignored in coverage | Medium |
| **P3** | No ground type/climate controls | Always assumes "average ground" | Medium (new UI + params) |
| **P3** | Fade margin hardcoded 10 dB | Can't tune reliability margin | Small |
| **P3** | Model switching only works for Link Analysis | RF Coverage always ITM | Large |

---

## References

- NTIA/ITS ITM Reference: https://github.com/NTIA/itm
- ITU-R P.526-14: Propagation by diffraction
- ITU-R P.527-3: Electrical characteristics of the surface of the Earth
- Okumura-Hata Model: ITU-R P.529
- Semtech SX1276 Datasheet: LoRa sensitivity and SNR limits
- SPLAT! RF Signal Propagation Tool: https://www.qsl.net/kd2bd/splat.html
