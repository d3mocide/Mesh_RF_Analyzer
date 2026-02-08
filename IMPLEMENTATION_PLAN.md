# MeshRF ITM Adoption — Agent Implementation Plan

> Each task below is a self-contained unit of work designed to be executed by an AI coding agent. Tasks are ordered by dependency. Parallel tasks are marked. Every prompt includes the exact files, the exact lines, the acceptance criteria, and what NOT to touch.

---

## How to Read This Document

```
TASK [ID]  — Short title
Role:       The agent persona / system prompt framing
Depends on: Which tasks must be complete first (or "None")
Files:      Exact files to read and modify
Prompt:     The full prompt to give the agent
Acceptance: How to verify the task is done correctly
```

---

## Phase 1: Wire Device Parameters Into RF Coverage Tool

These are the highest-priority fixes. The sidebar controls exist but the RF Coverage WASM path ignores them.

---

### TASK 1.1 — Wire cable losses into RF Coverage RSSI

**Role**: Frontend React developer working on an RF propagation mapping tool. You understand link budgets and dBm math. You are careful not to break existing functionality.

**Depends on**: None

**Files to READ first**:
- `src/context/RFContext.jsx` (understand nodeConfigs, editMode, DEVICE_PRESETS import)
- `src/data/presets.js` (understand DEVICE_PRESETS[device].loss structure)
- `src/components/Map/Controls/CoverageClickHandler.jsx` (current rfParams construction)
- `src/components/Map/MapContainer.jsx` lines 210-242 (recalc rfParams construction)
- `src/hooks/useRFCoverageTool.js` lines 102-168 (how rfParams are consumed and passed to WASM)
- `libmeshrf/src/meshrf_coverage.cpp` line 100 (RSSI formula)

**Prompt**:
```
You are modifying the MeshRF RF Coverage tool to account for cable/connector
losses from device presets. Currently the RSSI calculation in the WASM engine
is: rssi = txPower + txGain + rxGain - pathLoss. Cable losses are NOT subtracted.

The Link Analysis tool already handles this correctly — look at how LinkLayer.jsx
(lines 235-245) uses DEVICE_PRESETS[configA.device].loss and
DEVICE_PRESETS[configB.device].loss.

Your task:
1. In CoverageClickHandler.jsx, add txLoss and rxLoss to the rfParams object.
   - txLoss should come from the device preset loss for the current device.
   - The rfContext object is passed as a prop. You will need to also pass
     nodeConfigs (or just the loss values) through rfContext from MapContainer.jsx.
   - rxLoss should default to 0 for now (coverage tool doesn't have a specific
     RX device).

2. In MapContainer.jsx (the CoverageClickHandler props at lines 505-515),
   add the needed values to the rfContext object so CoverageClickHandler can
   access device loss.

3. In MapContainer.jsx (the recalc useEffect at lines 225-235), add the same
   txLoss/rxLoss fields to the rfParams object.

4. In useRFCoverageTool.js, subtract txLoss and rxLoss from the txPower BEFORE
   passing it to the WASM call. Specifically, at line 158, change:
     rfParams.txPower  →  (rfParams.txPower - (rfParams.txLoss || 0))
   Do NOT modify the C++ code. Apply cable losses on the JS side.

Do NOT:
- Modify any C++ files or the WASM build
- Change LinkLayer.jsx or the link analysis path
- Add new UI controls
- Change the sidebar
```

**Acceptance**:
- `CoverageClickHandler.jsx` rfParams includes `txLoss` and `rxLoss`
- `MapContainer.jsx` recalc rfParams includes `txLoss` and `rxLoss`
- `MapContainer.jsx` CoverageClickHandler rfContext includes device loss data
- `useRFCoverageTool.js` subtracts losses before WASM call
- Existing link analysis and viewshed tools are unaffected
- No C++ changes

---

### TASK 1.2 — Wire RX antenna gain from sidebar into RF Coverage

**Role**: Frontend React developer. You understand that the RF Coverage tool simulates what a receiver at each pixel would see. The RX gain should come from user configuration, not a hardcoded value.

**Depends on**: None (can run parallel with 1.1)

**Files to READ first**:
- `src/context/RFContext.jsx` (understand nodeConfigs.B.antennaGain, ANTENNA_PRESETS)
- `src/components/Map/Controls/CoverageClickHandler.jsx` line 24 (`rxGain: 2.15` hardcoded)
- `src/components/Map/MapContainer.jsx` line 229 (`rxGain: 2.15` hardcoded again)
- `src/components/Map/MapContainer.jsx` lines 505-515 (rfContext prop construction)

**Prompt**:
```
You are fixing the MeshRF RF Coverage tool to use the actual RX antenna gain
from the sidebar instead of a hardcoded 2.15 dBi.

Currently, CoverageClickHandler.jsx line 24 has:
    rxGain: 2.15, // Default RX (dipole)

And MapContainer.jsx line 229 has the same hardcoded value in the recalc path.

The user configures antenna gain per-node in the sidebar. For the RF Coverage
tool (which is a single-TX broadcast analysis), the RX gain represents what a
hypothetical receiver at each point would have. The Node B antenna gain from
nodeConfigs.B.antennaGain is the right source for this.

Your task:
1. In MapContainer.jsx, the rfContext passed to CoverageClickHandler (lines
   505-515) already has antennaGain (which is the proxy for the current edit
   mode node). Instead of using the proxy, add the Node B antenna gain
   explicitly:
   - Add `rxAntennaGain: nodeConfigs.B.antennaGain` to the rfContext object.

2. In CoverageClickHandler.jsx line 24, change:
     rxGain: 2.15
   to:
     rxGain: rfContext.rxAntennaGain ?? 2.15

3. In MapContainer.jsx recalc useEffect (line 229), change:
     rxGain: 2.15
   to:
     rxGain: nodeConfigs.B.antennaGain ?? 2.15

This way the 2.15 dBi is still the fallback (for safety), but when the user
selects a Yagi or omni antenna for Node B, the coverage map will reflect it.

Do NOT:
- Modify any C++ files
- Change LinkLayer.jsx
- Add new sidebar controls
- Change how the proxy antennaGain works in RFContext
```

**Acceptance**:
- `CoverageClickHandler.jsx` uses `rfContext.rxAntennaGain` with 2.15 fallback
- `MapContainer.jsx` recalc uses `nodeConfigs.B.antennaGain` with 2.15 fallback
- `MapContainer.jsx` rfContext prop includes `rxAntennaGain`
- Changing Node B antenna in sidebar now affects RF Coverage calculation
- No C++ changes, no sidebar changes

---

### TASK 1.3 — Fix RX height fallback mismatch

**Role**: Frontend bug-fix developer. Small, surgical change.

**Depends on**: None (can run parallel with 1.1 and 1.2)

**Files to READ first**:
- `src/context/RFContext.jsx` line 100 (`rxHeight` default is 2.0)
- `src/hooks/useRFCoverageTool.js` line 160 (fallback is 5.0)

**Prompt**:
```
You are fixing a default value mismatch in useRFCoverageTool.js.

At line 160:
    rfParams.rxHeight || 5.0

The fallback is 5.0m, but RFContext.jsx line 100 sets the default rxHeight
to 2.0m. These should match.

Change line 160 of useRFCoverageTool.js from:
    rfParams.rxHeight || 5.0
to:
    rfParams.rxHeight || 2.0

Add a comment: // Default matches RFContext rxHeight default (2.0m handheld)

That's it. One line change.

Do NOT modify any other files.
```

**Acceptance**:
- `useRFCoverageTool.js` line 160 fallback is 2.0, not 5.0
- No other files modified

---

### TASK 1.4 — Wire antenna height into Viewshed tool

**Role**: Frontend developer. The viewshed tool should use the antenna height from the sidebar, not a hardcoded 2.0m.

**Depends on**: None (can run parallel)

**Files to READ first**:
- `src/context/RFContext.jsx` (getAntennaHeightMeters helper)
- `src/components/Map/Controls/CoverageClickHandler.jsx` lines 9-12 (viewshed hardcodes 2.0)
- `src/components/Map/MapContainer.jsx` lines 505-515 (rfContext already includes getAntennaHeightMeters)
- `src/components/Map/MapContainer.jsx` lines 554-578 (viewshed drag handler hardcodes elevation + 2.0)

**Prompt**:
```
You are fixing the MeshRF Viewshed tool to use the antenna height from the
sidebar instead of hardcoding 2.0 meters.

Currently in CoverageClickHandler.jsx lines 10-12:
    setViewshedObserver({ lat, lng, height: 2.0 });
    runViewshed(lat, lng, 2.0, 25000);

And in MapContainer.jsx line 565 (viewshed drag handler):
    const newObserver = { lat, lng, height: elevation + 2.0 };
And line 573:
    runAnalysis(lat, lng, elevation + 2.0, 25000);

The rfContext prop already contains getAntennaHeightMeters. Use it.

Your task:
1. In CoverageClickHandler.jsx, for the viewshed branch (lines 10-12):
   - Get height: const h = rfContext.getAntennaHeightMeters
     ? rfContext.getAntennaHeightMeters() : 2.0;
   - Use h: setViewshedObserver({ lat, lng, height: h });
   - Use h: runViewshed(lat, lng, h, 25000);

2. In MapContainer.jsx viewshed drag handler (lines 564-573):
   - Replace the hardcoded 2.0 with the antenna height from context.
   - Use: const h = getAntennaHeightMeters ? getAntennaHeightMeters() : 2.0;
   - Replace: elevation + 2.0  →  h  (the viewshed height is above-ground,
     not absolute elevation + offset)

   Wait — re-read the viewshed code carefully. The viewshed C++ function
   takes tx_h_meters which is height ABOVE GROUND (AGL), not AMSL.
   The elevation is already in the terrain data. So the correct value is just
   the antenna height AGL, same as for RF coverage.

   Change line 565 to:
     const newObserver = { lat, lng, height: h };
   Change line 573 to:
     runAnalysis(lat, lng, h, 25000);

   Also fix the fallback on line 577:
     setViewshedObserver({ lat, lng, height: h });
     (instead of height: 2.0)

Do NOT:
- Modify C++ code
- Change the RF Coverage path
- Add new UI controls
```

**Acceptance**:
- `CoverageClickHandler.jsx` viewshed branch uses `rfContext.getAntennaHeightMeters()`
- `MapContainer.jsx` viewshed drag handler uses `getAntennaHeightMeters()` instead of 2.0
- Changing antenna height in sidebar now affects viewshed calculation
- RF Coverage path unchanged

---

## Phase 2: Rename Python "ITM" to Clarify It's Bullington

This is a labeling/honesty fix. The Python backend calls its model "ITM" but it's actually Bullington knife-edge. This confuses users and developers.

---

### TASK 2.1 — Rename Python model and update UI labels

**Role**: Full-stack developer doing a rename refactor across Python backend and React frontend. You understand that this is a labeling change — no algorithm changes.

**Depends on**: None (can run parallel with Phase 1)

**Files to READ first**:
- `rf-engine/rf_physics.py` lines 130-155 (model dispatch — "itm" triggers Bullington)
- `rf-engine/server.py` line 42 (LinkRequest model default)
- `src/utils/rfService.js` line 45 (frontend default model)
- `src/components/Map/LinkAnalysisPanel.jsx` (find the `<select>` with model options)
- `src/components/Map/LinkLayer.jsx` line 76 (model default)
- `src/components/Map/MapContainer.jsx` line 114 (propagationSettings default)

**Prompt**:
```
You are renaming the propagation model labels in MeshRF to be accurate.

CONTEXT: The Python backend has a model called "itm" that is actually a
Bullington knife-edge diffraction calculation (FSPL + single obstruction),
NOT the real NTIA ITM/Longley-Rice model. The real ITM only runs in the
WASM/C++ RF Coverage tool. This naming collision confuses users.

Your task — rename the Python model from "itm" to "bullington" and update
the UI to reflect this accurately:

1. rf-engine/rf_physics.py:
   - Line 149: Change `if model == 'itm':` to `if model == 'bullington':`
   - Line 148: Update the comment from "ITM / Longley-Rice" to
     "Bullington Knife-Edge (Terrain-Aware)"
   - Also support the old name for backwards compatibility:
     Add `if model == 'itm': model = 'bullington'` at the top of
     calculate_path_loss() so old API calls still work.

2. rf-engine/server.py:
   - Line 42: Change default from "itm" to "bullington"

3. src/utils/rfService.js:
   - Line 45: Change default from 'itm' to 'bullington'

4. src/components/Map/LinkAnalysisPanel.jsx:
   - Find the <select> with model options
   - Change the "itm" option:
     FROM: <option value="itm">Longley-Rice (Terrain)</option>
     TO:   <option value="bullington">Bullington (Terrain-Aware)</option>
   - Update any help text that says "Longley-Rice" for this option to say
     "Bullington knife-edge diffraction" and note it uses terrain data but
     is an approximation of full Longley-Rice.

5. src/components/Map/LinkLayer.jsx:
   - Line 76: Change default from 'itm' to 'bullington'

6. src/components/Map/MapContainer.jsx:
   - Line 114: Change default model from "itm" to "bullington"

7. In the model help/guide text in LinkAnalysisPanel.jsx, add a brief note:
   "Full ITM/Longley-Rice is available in the RF Coverage tool (WASM).
    The Link Analysis tool uses the Bullington approximation which models
    single knife-edge diffraction over terrain."

Do NOT:
- Change any math or algorithms
- Modify C++ code
- Change the RF Coverage tool (it correctly uses real ITM)
- Remove the "itm" backwards compat alias in rf_physics.py
```

**Acceptance**:
- All references to "itm" in the Link Analysis path are renamed to "bullington"
- UI dropdown shows "Bullington (Terrain-Aware)" instead of "Longley-Rice (Terrain)"
- Python backend accepts both "itm" (backwards compat) and "bullington"
- Help text clarifies the distinction between Bullington and full ITM
- RF Coverage tool is completely unaffected
- No algorithm changes

---

## Phase 3: Expose ITM Environment Parameters

These tasks add new sidebar controls for ITM parameters that are currently hardcoded in the WASM engine. Requires both C++ and JS changes.

---

### TASK 3.1 — Add ground type and climate to C++ coverage function signature

**Role**: C++ / Emscripten developer. You are adding parameters to an existing WASM function to make hardcoded values configurable. You must update the header, implementation, bindings, and verify the build compiles.

**Depends on**: None

**Files to READ first**:
- `libmeshrf/include/meshrf_coverage.h` (current function signature)
- `libmeshrf/src/meshrf_coverage.cpp` (current implementation, lines 78-87 hardcoded params)
- `libmeshrf/include/meshrf_itm.h` (LinkParameters struct)
- `libmeshrf/src/bindings.cpp` (Emscripten bindings)
- `libmeshrf/CMakeLists.txt` (build config)

**Prompt**:
```
You are adding three new parameters to the calculate_rf_coverage() C++
function: ground_epsilon, ground_sigma, and climate. These are currently
hardcoded in meshrf_coverage.cpp lines 84-87.

Your task:

1. meshrf_coverage.h — Add 3 new parameters to the function declaration:
   After gsd_meters, add:
     float ground_epsilon = 15.0f,   // Relative permittivity (default: avg ground)
     float ground_sigma = 0.005f,    // Ground conductivity S/m (default: avg ground)
     int climate = 5                 // Radio climate (default: Continental Temperate)

   Use default parameter values so existing callers don't break.

2. meshrf_coverage.cpp — Update the function signature to match the header.
   Then replace the hardcoded values at lines 84-87:
     params.epsilon = 15.0;    →  params.epsilon = ground_epsilon;
     params.sigma = 0.005;     →  params.sigma = ground_sigma;
     params.climate = 5;       →  params.climate = climate;

3. bindings.cpp — Update the calculate_rf_coverage binding to include the
   3 new parameters. The embind function() call needs the new args added
   in order.

Do NOT:
- Change LinkParameters struct
- Change calculate_radial_loss or meshrf_itm.cpp
- Change the viewshed function
- Change any JavaScript files (that's a separate task)
- Change the algorithm — only parameterize existing hardcoded values
```

**Acceptance**:
- Header, implementation, and bindings all have the 3 new parameters
- Default values match the original hardcoded values (epsilon=15.0, sigma=0.005, climate=5)
- Existing behavior is preserved when defaults are used
- Code compiles with `emcmake cmake .. -DEMSCRIPTEN=1 && emmake make`

---

### TASK 3.2 — Add ground type and climate to RFContext and sidebar UI

**Role**: React developer adding new configuration controls to an existing sidebar. You follow the existing code patterns exactly — same styling, same state management approach.

**Depends on**: TASK 3.1 (needs the C++ parameters to exist)

**Files to READ first**:
- `src/context/RFContext.jsx` (full file — understand state pattern, especially lines 97-100 for environmental params)
- `src/components/Layout/Sidebar.jsx` (full file — understand where Settings section is, how kFactor and clutterHeight are rendered)

**Prompt**:
```
You are adding ground type and climate zone controls to the MeshRF sidebar.

CONTEXT: The WASM ITM engine now accepts ground_epsilon, ground_sigma, and
climate as parameters (Task 3.1). You need to add state management and UI
controls so users can configure these.

Your task:

1. RFContext.jsx — Add new state variables near the existing environmental
   params (kFactor, clutterHeight, rxHeight around line 97-100):

   const [groundType, setGroundType] = useState('average');
   const [climateZone, setClimateZone] = useState(5);

   Add a lookup object (inside the provider, before the value object):

   const GROUND_TYPES = {
     average:    { epsilon: 15.0, sigma: 0.005, label: 'Average Ground' },
     poor:       { epsilon: 4.0,  sigma: 0.001, label: 'Poor Ground' },
     good:       { epsilon: 25.0, sigma: 0.020, label: 'Good Ground' },
     freshwater: { epsilon: 80.0, sigma: 0.010, label: 'Fresh Water' },
     saltwater:  { epsilon: 80.0, sigma: 5.000, label: 'Salt Water' },
     city:       { epsilon: 5.0,  sigma: 0.001, label: 'City / Industrial' },
     farmland:   { epsilon: 15.0, sigma: 0.010, label: 'Farmland' },
   };

   const CLIMATE_ZONES = {
     1: 'Equatorial',
     2: 'Continental Subtropical',
     3: 'Maritime Subtropical',
     4: 'Desert',
     5: 'Continental Temperate',
     6: 'Maritime Temperate (Land)',
     7: 'Maritime Temperate (Sea)',
   };

   Add a helper that returns the epsilon/sigma for the current ground type:

   getGroundParams: () => {
     const gt = GROUND_TYPES[groundType] || GROUND_TYPES.average;
     return { epsilon: gt.epsilon, sigma: gt.sigma };
   }

   Export all new values in the context value object:
     groundType, setGroundType, GROUND_TYPES,
     climateZone, setClimateZone, CLIMATE_ZONES,
     getGroundParams,

2. Sidebar.jsx — Add controls in the Settings section (near the K-Factor
   and Clutter Height controls). Follow the exact same styling pattern:

   Add a "Ground Type" dropdown:
   - Label: "Ground Type"
   - Options: map over GROUND_TYPES entries
   - Value: groundType
   - onChange: setGroundType

   Add a "Climate Zone" dropdown:
   - Label: "Climate Zone"
   - Options: map over CLIMATE_ZONES entries
   - Value: climateZone
   - onChange: (e) => setClimateZone(parseInt(e.target.value))

   Place these AFTER the K-Factor and Clutter Height controls but still
   inside the Settings collapsible section.

   Match the exact styling of existing dropdowns in the sidebar (background,
   border, color, font-size, padding, border-radius). Look at how the
   Device Preset or Antenna Type dropdowns are styled and follow that pattern.

Do NOT:
- Modify any map components
- Change the RF Coverage calculation path (that's Task 3.3)
- Change any C++ code
- Add any new npm dependencies
```

**Acceptance**:
- `RFContext.jsx` exports groundType, climateZone, and helper functions
- `Sidebar.jsx` shows Ground Type and Climate Zone dropdowns in Settings section
- Dropdowns follow existing styling patterns exactly
- Default is "Average Ground" and "Continental Temperate"
- No calculation logic changed yet (that's Task 3.3)

---

### TASK 3.3 — Pass ground and climate params through to WASM RF Coverage

**Role**: Frontend integration developer. You are connecting the new sidebar controls (Task 3.2) through the call chain to the WASM function (Task 3.1).

**Depends on**: TASK 3.1, TASK 3.2

**Files to READ first**:
- `src/context/RFContext.jsx` (new getGroundParams, climateZone)
- `src/components/Map/MapContainer.jsx` lines 120-143 (context destructuring), 505-515 (rfContext), 225-240 (recalc)
- `src/components/Map/Controls/CoverageClickHandler.jsx` (rfParams construction)
- `src/hooks/useRFCoverageTool.js` lines 102-168 (WASM call)

**Prompt**:
```
You are connecting the new ground type and climate zone sidebar controls to
the WASM ITM engine for RF Coverage calculations.

The state is already in RFContext (groundType, climateZone, getGroundParams).
The C++ function already accepts ground_epsilon, ground_sigma, climate.
You need to wire the middle.

Your task:

1. MapContainer.jsx — Destructure the new values from useRF():
   Add to the existing destructuring (around line 120-143):
     groundType, climateZone, getGroundParams

2. MapContainer.jsx — Add to rfContext prop (lines 505-515):
     getGroundParams,
     climateZone,

3. MapContainer.jsx — Add to recalc rfParams (lines 225-235):
     const groundParams = getGroundParams ? getGroundParams() : { epsilon: 15.0, sigma: 0.005 };
     Then in the rfParams object:
       groundEpsilon: groundParams.epsilon,
       groundSigma: groundParams.sigma,
       climate: climateZone || 5,

4. CoverageClickHandler.jsx — Add to rfParams construction:
     const groundParams = rfContext.getGroundParams ? rfContext.getGroundParams() : { epsilon: 15.0, sigma: 0.005 };
     Then in the rfParams object:
       groundEpsilon: groundParams.epsilon,
       groundSigma: groundParams.sigma,
       climate: rfContext.climateZone || 5,

5. useRFCoverageTool.js — Pass the 3 new params to the WASM call.
   The calculate_rf_coverage call at lines 153-168 needs 3 more args at the end:
     rfParams.groundEpsilon || 15.0,
     rfParams.groundSigma || 0.005,
     rfParams.climate || 5

Do NOT:
- Change any C++ code (already done in Task 3.1)
- Change the sidebar UI (already done in Task 3.2)
- Change LinkLayer or the link analysis path
```

**Acceptance**:
- Ground type and climate from sidebar flow all the way to the WASM call
- Changing "Ground Type" dropdown triggers recalc with correct epsilon/sigma
- Changing "Climate Zone" dropdown triggers recalc with correct climate code
- Default behavior (Average Ground, Continental Temperate) matches previous hardcoded values exactly
- Link Analysis path is unaffected

---

## Phase 4: Unify ITM — Add WASM P2P Path for Link Analysis

This is the most architecturally significant change. It gives the Link Analysis tool access to the real NTIA ITM engine via WASM, instead of the Python Bullington approximation.

---

### TASK 4.1 — Create a JS wrapper for single-path WASM ITM calculation

**Role**: Frontend/WASM integration developer. You are creating a React hook that exposes a simple point-to-point ITM path loss calculation using the existing WASM module. The WASM module already has `calculate_itm()` exposed via embind.

**Depends on**: None

**Files to READ first**:
- `libmeshrf/src/bindings.cpp` (calculate_itm binding — takes pointer, count, LinkParameters)
- `libmeshrf/include/meshrf_itm.h` (LinkParameters struct, calculate_radial_loss signature)
- `libmeshrf/src/meshrf_itm.cpp` (implementation — returns loss at every profile point)
- `src/hooks/useRFCoverageTool.js` (pattern for WASM module loading and memory management)
- `src/utils/elevation.js` or `src/utils/rfService.js` (how elevation profiles are fetched)

**Prompt**:
```
You are creating a new React hook called useWasmITM that provides a simple
function to calculate point-to-point path loss using the real NTIA ITM engine
via the existing WASM module.

The WASM module already exposes calculate_itm(ptr, count, LinkParameters)
via embind (see bindings.cpp). The LinkParameters struct has fields:
frequency_mhz, tx_height_m, rx_height_m, polarization, step_size_m,
N_0, epsilon, sigma, climate.

The function returns a vector of path loss values (dB) for each point along
the profile. The LAST value is the total path loss from TX to RX.

Your task:

1. Create src/hooks/useWasmITM.js with:

   export const useWasmITM = () => {
     // Load WASM module (same pattern as useRFCoverageTool.js)
     // Return: { calculatePathLoss, isReady }
   }

   The calculatePathLoss function signature:
   async calculatePathLoss({
     elevationProfile,  // Array of elevation values (meters AMSL), equally spaced
     stepSizeMeters,    // Distance between elevation points
     frequencyMHz,
     txHeightM,         // TX antenna height above ground (meters)
     rxHeightM,         // RX antenna height above ground (meters)
     groundEpsilon,     // Optional, default 15.0
     groundSigma,       // Optional, default 0.005
     climate,           // Optional, default 5
   }) => number          // Returns total path loss in dB (the last value)

   Implementation:
   a. Allocate WASM memory for the elevation profile (Float32Array)
   b. Copy elevation data in
   c. Create a LinkParameters object via embind:
      const params = new Module.LinkParameters();
      params.frequency_mhz = frequencyMHz;
      params.tx_height_m = txHeightM;
      params.rx_height_m = rxHeightM;
      params.polarization = 1;  // Vertical (LoRa)
      params.step_size_m = stepSizeMeters;
      params.N_0 = 301.0;
      params.epsilon = groundEpsilon || 15.0;
      params.sigma = groundSigma || 0.005;
      params.climate = climate || 5;
   d. Call: const resultVec = Module.calculate_itm(ptr, count, params);
   e. Get the last value: resultVec.get(resultVec.size() - 1)
   f. Clean up: Module._free(ptr), resultVec.delete(), params.delete()
   g. Return the path loss value

   Follow the EXACT same WASM loading pattern from useRFCoverageTool.js
   (createMeshRF with locateFile, useEffect for init, ref for module).

2. Also export a standalone (non-hook) async function for use outside React:

   export const calculateITMPathLoss = async (wasmModule, params) => { ... }

   This takes an already-loaded module and params, for cases where the caller
   manages the WASM lifecycle.

Do NOT:
- Modify any C++ code or bindings
- Change useRFCoverageTool.js
- Change LinkLayer.jsx (that's Task 4.2)
- Fetch elevation data (the caller provides the profile)
```

**Acceptance**:
- New file `src/hooks/useWasmITM.js` exists
- Hook loads WASM module and exposes `calculatePathLoss` and `isReady`
- Function takes an elevation profile array and returns a single path loss number
- Memory is properly allocated and freed
- Follows the same patterns as existing WASM hooks

---

### TASK 4.2 — Integrate WASM ITM into Link Analysis flow

**Role**: Frontend integration developer. You are adding a new propagation model option ("ITM (Full)") to the Link Analysis tool that uses the real WASM ITM engine from Task 4.1, while keeping the existing Bullington option.

**Depends on**: TASK 2.1 (rename), TASK 4.1 (WASM hook)

**Files to READ first**:
- `src/hooks/useWasmITM.js` (the new hook from Task 4.1)
- `src/components/Map/LinkLayer.jsx` (full file — understand runAnalysis flow)
- `src/utils/rfService.js` (calculateLink — the Python backend call)
- `src/utils/elevation.js` (fetchElevationPath — how profiles are fetched)
- `src/components/Map/LinkAnalysisPanel.jsx` (model dropdown)

**Prompt**:
```
You are adding real NTIA ITM (via WASM) as a propagation model option in the
Link Analysis tool.

CONTEXT: After Task 2.1, the model options are:
- "fspl" — Free Space Path Loss
- "bullington" — Bullington knife-edge (Python backend)
- "hata" — Okumura-Hata (Python backend)

You are adding a 4th option:
- "itm_wasm" — Real ITM/Longley-Rice (WASM, runs in browser)

Your task:

1. LinkLayer.jsx:
   a. Import useWasmITM:
      import { useWasmITM } from '../../hooks/useWasmITM';

   b. Initialize the hook inside the component:
      const { calculatePathLoss: calculateITM, isReady: itmReady } = useWasmITM();

   c. In the runAnalysis callback (line 67), add a branch for itm_wasm:
      - If currentModel === 'itm_wasm' and itmReady:
        - Use the elevation profile (already fetched as `profile` from
          fetchElevationPath)
        - Convert the profile to equally-spaced elevation array and compute
          step size in meters
        - Call calculateITM with the profile, freq, heights
        - Use the returned path loss as backendPathLoss
      - If currentModel is 'hata' or 'bullington':
        - Keep existing Python backend call (unchanged)
      - If currentModel is 'fspl':
        - Skip backend call (unchanged)

2. LinkAnalysisPanel.jsx:
   Add the new option to the model dropdown:
     <option value="itm_wasm">Longley-Rice ITM (Full)</option>

   Place it as the FIRST option (it's the most accurate model).

   Update the help text to explain:
   "Longley-Rice ITM (Full) — Runs the NTIA reference ITM engine in your
    browser via WebAssembly. Uses actual terrain profiles with diffraction,
    troposcatter, and ground parameter modeling. Most accurate option."

3. MapContainer.jsx line 114:
   Change the default propagation model to "itm_wasm".

Do NOT:
- Modify C++ code or WASM bindings
- Remove the Bullington or Hata options
- Change the RF Coverage tool
- Change the Python backend
```

**Acceptance**:
- New "Longley-Rice ITM (Full)" option appears in the model dropdown
- Selecting it runs the real NTIA ITM via WASM in the browser
- Path loss result flows into the link budget display
- Existing Bullington, Hata, and FSPL options still work unchanged
- The elevation profile from fetchElevationPath is correctly converted to the format WASM expects

---

## Phase 5: UI Polish and Model Validity

---

### TASK 5.1 — Conditionally show/hide Environment selector

**Role**: React UI developer. Small conditional rendering fix.

**Depends on**: TASK 2.1 (model rename)

**Files to READ first**:
- `src/components/Map/LinkAnalysisPanel.jsx` (find the environment `<select>` and model `<select>`)

**Prompt**:
```
You are adding conditional visibility to the Environment selector dropdown
in LinkAnalysisPanel.jsx.

The Environment dropdown (urban, suburban, rural) only affects the Hata model.
When other models are selected, it should be hidden or disabled.

Find the environment <select> element in LinkAnalysisPanel.jsx.

Wrap it in a conditional:
  {propagationSettings.model === 'hata' && (
    <div> ... existing environment dropdown ... </div>
  )}

Or alternatively, disable and gray it out when not Hata:
  <select
    disabled={propagationSettings.model !== 'hata'}
    style={{
      ...existingStyles,
      opacity: propagationSettings.model !== 'hata' ? 0.4 : 1
    }}
  >

Use the disable+gray approach (it's less jarring than elements appearing/disappearing).

Add a title tooltip:
  title={propagationSettings.model !== 'hata' ? 'Environment only affects Hata model' : ''}

Do NOT change any other component or any calculation logic.
```

**Acceptance**:
- Environment dropdown is grayed out and disabled when model is not Hata
- Tooltip explains why it's disabled
- No layout shift when switching models

---

### TASK 5.2 — Add Hata model validity warnings

**Role**: React UI developer. Adding warning messages when Hata model is used outside its valid parameter ranges.

**Depends on**: TASK 2.1 (model rename)

**Files to READ first**:
- `src/components/Map/LinkAnalysisPanel.jsx` (where stats are displayed)
- `src/context/RFContext.jsx` (nodeConfigs for antenna heights)

**Prompt**:
```
You are adding validity warnings to the LinkAnalysisPanel when the Hata
model is selected and parameters are outside its designed range.

The Okumura-Hata model is valid for:
- Frequency: 150–1500 MHz
- Distance: 1–20 km
- Base station height (TX): 30–200 m
- Mobile height (RX): 1–10 m

In LinkAnalysisPanel.jsx, add a warnings section that appears below the
propagation model selector ONLY when model === 'hata'. Check:

1. If distance < 1 km or distance > 20 km:
   Warning: "Distance {X} km is outside Hata valid range (1-20 km)"

2. If TX height (nodeConfigs.A.antennaHeight) < 30:
   Warning: "TX height {X}m is below Hata minimum (30m). Hata was designed
   for cellular towers. Consider Bullington for low-height nodes."

3. If frequency < 150 or frequency > 1500:
   Warning: "Frequency {X} MHz is outside Hata range (150-1500 MHz)"

Style warnings as small amber/orange text with a ⚠ prefix. Use the same
font-size as other sub-text in the panel (0.75em or similar). Place them
directly below the model selector.

You'll need access to: distance (passed as prop), freq (from useRF context),
nodeConfigs (from useRF context). Check what's already available as props
vs what needs to be imported from context.

Do NOT:
- Change any calculations
- Add warnings for other models
- Modify the model selector itself
```

**Acceptance**:
- Amber warnings appear below model selector when Hata is selected AND parameters are out of range
- Warnings disappear when switching to other models
- Warning text is accurate with actual parameter values shown
- No warnings when Hata is selected and all parameters are in valid range

---

### TASK 5.3 — Make fade margin configurable

**Role**: Full-stack React developer adding a new setting.

**Depends on**: None (can run parallel)

**Files to READ first**:
- `src/utils/rfMath.js` lines 53-101 (calculateLinkBudget — fadeMargin = 10 default)
- `src/context/RFContext.jsx` (state pattern)
- `src/components/Layout/Sidebar.jsx` (settings section)
- `src/components/Map/LinkLayer.jsx` lines 235-245 (budget call)
- `src/components/Map/MapContainer.jsx` lines 260-271 (budget call)

**Prompt**:
```
You are adding a configurable fade margin to MeshRF. Currently fadeMargin
is hardcoded to 10 dB in calculateLinkBudget() (rfMath.js line 66).

Your task:

1. RFContext.jsx:
   - Add state: const [fadeMargin, setFadeMargin] = useState(10);
   - Export: fadeMargin, setFadeMargin

2. Sidebar.jsx:
   - Add a fade margin control in the Settings section (near K-Factor).
   - Use a number input or slider, range 0–20, step 1.
   - Label: "Fade Margin (dB)"
   - Style: match existing number inputs in the settings section.

3. LinkLayer.jsx:
   - Destructure fadeMargin from useRF()
   - Pass it to calculateLinkBudget: fadeMargin: fadeMargin
   (The function already accepts fadeMargin as a parameter with default 10)

4. MapContainer.jsx:
   - Destructure fadeMargin from useRF()
   - Pass it to calculateLinkBudget: fadeMargin: fadeMargin

Note: calculateLinkBudget already accepts fadeMargin as a named parameter
with default value 10. You do NOT need to change rfMath.js — just pass the
value from context.

Do NOT:
- Change rfMath.js (the parameter already exists)
- Change the RF Coverage tool
- Add fade margin to the Python backend
```

**Acceptance**:
- New "Fade Margin (dB)" control in sidebar settings
- Changing it updates link budget calculations in real time
- Default is 10 dB (matches previous hardcoded value)
- Range is 0–20 dB

---

### TASK 5.4 — Pass K-Factor and clutter height to Python backend

**Role**: Full-stack developer. Wiring existing frontend state to the Python API.

**Depends on**: None (can run parallel)

**Files to READ first**:
- `src/context/RFContext.jsx` (kFactor, clutterHeight state)
- `src/utils/rfService.js` (calculateLink function — the API call)
- `src/components/Map/LinkLayer.jsx` lines 67-106 (runAnalysis — calls calculateLink)
- `rf-engine/server.py` lines 34-43 (LinkRequest model)
- `rf-engine/rf_physics.py` lines 25-85 (calculate_bullington_loss), 130-155 (calculate_path_loss), 158-203 (analyze_link)

**Prompt**:
```
You are wiring the K-Factor and Clutter Height parameters from the frontend
sidebar through to the Python backend calculations.

Currently:
- Frontend has kFactor (default 1.33) and clutterHeight (default 0) in RFContext
- Python backend hardcodes k = 1.333 in analyze_link() and
  calculate_bullington_loss()
- The API endpoint doesn't accept these parameters

Your task:

1. rf-engine/server.py — Add to LinkRequest model:
     k_factor: float = 1.333
     clutter_height: float = 0.0

2. rf-engine/server.py — Pass to rf_physics calls:
   In calculate_link_endpoint(), pass k_factor and clutter_height to both
   calculate_path_loss() and analyze_link().

3. rf-engine/rf_physics.py — Add k_factor parameter to:
   a. calculate_bullington_loss() — replace hardcoded k = 1.333 with parameter
   b. calculate_path_loss() — pass through to calculate_bullington_loss()
   c. analyze_link() — replace hardcoded k = 1.333 with parameter

   Add clutter_height parameter to:
   a. calculate_bullington_loss() — add clutter_height to effective_terrain:
      effective_terrain = profile + bulge + clutter_height
   b. calculate_path_loss() — pass through
   c. analyze_link() — add to terrain_h:
      terrain_h = elevs + bulge + clutter_height

   All new parameters should have defaults matching current hardcoded values:
     k_factor=1.333, clutter_height=0.0

4. src/utils/rfService.js — Add to calculateLink API call body:
     k_factor: Number(kFactor) || 1.333,
     clutter_height: Number(clutterHeight) || 0.0

   Update the function signature to accept these:
     export const calculateLink = async (nodeA, nodeB, freq, h1, h2, model, env, kFactor, clutterHeight)

5. src/components/Map/LinkLayer.jsx — Pass kFactor and clutterHeight to
   calculateLink() call (line 83). These are already available from configRef:
     currentConfig.kFactor, currentConfig.clutterHeight

Do NOT:
- Change C++ code
- Change the RF Coverage tool
- Change RFContext.jsx (state already exists)
- Change the sidebar (controls already exist)
```

**Acceptance**:
- Python API accepts k_factor and clutter_height
- Python calculations use the passed values instead of hardcoded ones
- Frontend passes kFactor and clutterHeight from context to API
- Default values match originals (k=1.333, clutter=0.0)
- Changing K-Factor or Clutter Height in sidebar and recalculating updates the backend result

---

## Task Dependency Graph

```
Phase 1 (all parallel):
  1.1  Wire cable losses          ──┐
  1.2  Wire RX gain               ──┤
  1.3  Fix RX height fallback     ──┼──► Phase 1 Complete
  1.4  Wire viewshed height       ──┘

Phase 2 (parallel with Phase 1):
  2.1  Rename Python ITM → Bullington ──► Phase 2 Complete

Phase 3 (sequential):
  3.1  C++ new params             ──► 3.2  Sidebar UI  ──► 3.3  Wire through

Phase 4 (sequential, depends on 2.1):
  4.1  WASM P2P hook              ──► 4.2  Integrate into LinkLayer

Phase 5 (all parallel, 5.1/5.2 depend on 2.1):
  5.1  Hide environment selector  ──┐
  5.2  Hata validity warnings     ──┤
  5.3  Fade margin control        ──┼──► Phase 5 Complete
  5.4  K-Factor/Clutter to Python ──┘
```

**Maximum parallelism**: Tasks 1.1, 1.2, 1.3, 1.4, 2.1, 3.1, 5.3, 5.4 can all start simultaneously.

---

## WASM Rebuild Required After

- **Task 3.1** (new C++ parameters) — requires `emcmake cmake .. && emmake make`
- **No other tasks require C++ rebuild**

Copy the rebuilt files:
```bash
cp libmeshrf/build_wasm/meshrf.js libmeshrf/js/meshrf.js
cp libmeshrf/build_wasm/meshrf.js public/rf-engine/meshrf/meshrf.js
cp libmeshrf/build_wasm/meshrf.wasm public/meshrf.wasm
```
