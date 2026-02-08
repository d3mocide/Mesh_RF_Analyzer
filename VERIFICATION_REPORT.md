# Post-Plan Verification Report

**Date**: 2026-02-08
**Scope**: Verify all 8 audit findings and 13 implementation plan tasks against current codebase state

---

## Status: NONE of the findings have been fixed yet

The audit (`ITM_INTEGRATION_AUDIT.md`) and implementation plan (`IMPLEMENTATION_PLAN.md`) have been written and committed, but **zero code changes have been made**. Every finding from the original audit is still present in the codebase. This is expected — the plan was just drafted, not executed.

Below is a line-by-line confirmation of each issue against the current code.

---

## Finding-by-Finding Verification

### FINDING 1: Two Different "ITM" Engines — STILL PRESENT

| Check | File:Line | Current Value | Expected After Fix |
|-------|-----------|---------------|-------------------|
| Python model dispatch | `rf_physics.py:149` | `if model == 'itm':` → runs Bullington | Should be `if model == 'bullington':` |
| Python comment | `rf_physics.py:148` | `# 3. ITM / Longley-Rice (Bullington Fallback for now)` | Should say Bullington |
| API default | `server.py:42` | `model: str = "itm"` | Should be `"bullington"` |
| Frontend default | `rfService.js:45` | `model: model \|\| 'itm'` | Should be `'bullington'` |
| UI dropdown | `LinkAnalysisPanel.jsx:406` | `<option value="itm">Longley-Rice (Terrain)</option>` | Should say Bullington |
| LinkLayer default | `LinkLayer.jsx:76` | `\|\| 'itm'` | Should be `'bullington'` |
| MapContainer default | `MapContainer.jsx:114` | `model: "itm"` | Should be `"bullington"` |
| Backend model check | `LinkLayer.jsx:82` | `currentModel === 'itm'` | Should be `'bullington'` |

**Implementation Plan coverage**: Task 2.1 covers all of these. **Adequate.**

---

### FINDING 2: RF Coverage Hardcodes Sidebar Parameters — STILL PRESENT

**RX Gain hardcoded to 2.15 dBi — 3 locations (not 2 as originally reported)**

| # | File:Line | Current Code | Plan Task |
|---|-----------|-------------|-----------|
| 1 | `CoverageClickHandler.jsx:24` | `rxGain: 2.15, // Default RX (dipole)` | Task 1.2 |
| 2 | `MapContainer.jsx:229` | `rxGain: 2.15,` (recalc path) | Task 1.2 |
| 3 | `MapContainer.jsx:615` | `rxGain: 2.15,` (RF Coverage drag handler) | **NOT COVERED** |

**GAP FOUND**: The original audit (Finding 3) only mentions `MapContainer.jsx:229` (recalc). The search found a **third instance at line 615** — the RF Coverage marker drag handler. This builds rfParams when the user drags the RF Coverage transmitter marker. Task 1.2 in the implementation plan references lines 229 only, **missing line 615**.

**Cable losses not subtracted**

| Check | File:Line | Status | Plan Task |
|-------|-----------|--------|-----------|
| C++ RSSI formula | `meshrf_coverage.cpp:100` | `rssi = txPower + txGain + rxGain - pathLoss` (no cable loss) | Task 1.1 |
| CoverageClickHandler rfParams | `CoverageClickHandler.jsx:20-29` | No txLoss/rxLoss fields | Task 1.1 |
| MapContainer recalc rfParams | `MapContainer.jsx:225-235` | No txLoss/rxLoss fields | Task 1.1 |
| MapContainer drag rfParams | `MapContainer.jsx:611-621` | No txLoss/rxLoss fields | **NOT COVERED** |

**GAP FOUND**: Same issue — `MapContainer.jsx:611-621` (the drag handler rfParams) is not mentioned in Task 1.1.

**Ground params hardcoded in C++**

| Check | File:Line | Current Value | Plan Task |
|-------|-----------|---------------|-----------|
| N_0 | `meshrf_coverage.cpp:84` | `params.N_0 = 301.0;` | Task 3.1 |
| epsilon | `meshrf_coverage.cpp:85` | `params.epsilon = 15.0;` | Task 3.1 |
| sigma | `meshrf_coverage.cpp:86` | `params.sigma = 0.005;` | Task 3.1 |
| climate | `meshrf_coverage.cpp:87` | `params.climate = 5;` | Task 3.1 |

**Coverage**: Task 3.1 covers all four. **Adequate.**

---

### FINDING 3: Recalc Path Hardcodes — STILL PRESENT

Verified at `MapContainer.jsx:229`: `rxGain: 2.15` in the recalc useEffect.

**Coverage**: Task 1.2 covers this. But see gap above for the drag handler at line 615.

---

### FINDING 4: Environment Selector Misleading — STILL PRESENT

Verified at `LinkAnalysisPanel.jsx:440-451`: Environment dropdown is always visible and enabled regardless of selected model.

**Coverage**: Task 5.1 covers this. **Adequate.**

---

### FINDING 5: Fade Margin Hardcoded — STILL PRESENT

Verified at `rfMath.js:66`: `fadeMargin = 10` as default parameter. LinkLayer.jsx:235-245 and MapContainer.jsx:260-271 both call `calculateLinkBudget()` without passing fadeMargin, so the default is always used.

**Coverage**: Task 5.3 covers this. **Adequate.**

---

### FINDING 6: Diffraction Loss Condition — STILL PRESENT

Verified at `LinkLayer.jsx:249`:
```javascript
if (propagationSettings?.model === 'Hata' && linkStats.profileWithStats) {
```

Bullington diffraction is only calculated for the Hata model — the one model that doesn't use terrain. When "ITM" (actually Bullington) is selected, this visualization code doesn't run.

**Coverage**: **NOT COVERED by any task in the implementation plan.** This is a logic bug that affects the link color/margin calculation on the map. When Hata is selected, diffraction loss is subtracted from margin (line 273: `const m = budget.margin - diffractionLoss`), but this subtraction makes no sense for Hata since Hata's path_loss_db already accounts for its own statistical loss model. Meanwhile when "ITM"/Bullington is selected, diffractionLoss stays 0 even though the backend returns FSPL+Bullington as pathLoss, meaning the frontend double-counts nothing but also doesn't properly visualize the diffraction component.

**This needs a new task.**

---

### FINDING 7: Viewshed Height Hardcoded — STILL PRESENT

| Check | File:Line | Current Code | Plan Task |
|-------|-----------|-------------|-----------|
| Initial click | `CoverageClickHandler.jsx:10` | `height: 2.0` | Task 1.4 |
| Initial run | `CoverageClickHandler.jsx:12` | `runViewshed(lat, lng, 2.0, 25000)` | Task 1.4 |
| Drag handler observer | `MapContainer.jsx:565` | `height: elevation + 2.0` | Task 1.4 |
| Drag handler run | `MapContainer.jsx:573` | `runAnalysis(lat, lng, elevation + 2.0, 25000)` | Task 1.4 |
| Error fallback | `MapContainer.jsx:577` | `height: 2.0` | Task 1.4 |

**Coverage**: Task 1.4 covers all 5 locations. **Adequate.**

Note on the drag handler: `MapContainer.jsx:565` passes `elevation + 2.0` to the viewshed run. The viewshed C++ function expects height AGL (above ground level), not AMSL. The elevation is the ground elevation fetched from the API. So `elevation + 2.0` would be passing AMSL to a function expecting AGL. **This is actually a bug** — the viewshed should receive just the antenna height AGL (e.g., 2.0 or whatever the sidebar says), not elevation + height. The terrain data already contains elevation. Task 1.4's prompt correctly identifies this and instructs the agent to pass just the AGL height.

---

### FINDING 8: Python K-Factor Hardcoded — STILL PRESENT

Verified at `rf_physics.py:164`: `k = 1.333` hardcoded in `analyze_link()`.
Also at `rf_physics.py:47`: `k = 1.333` hardcoded in `calculate_bullington_loss()`.

**Coverage**: Task 5.4 covers both. **Adequate.**

---

### RX Height Fallback Mismatch — STILL PRESENT

Verified at `useRFCoverageTool.js:160`: `rfParams.rxHeight || 5.0`
Context default at `RFContext.jsx:100`: `const [rxHeight, setRxHeight] = useState(2.0)`

**Coverage**: Task 1.3 covers this. **Adequate.**

---

## Implementation Plan Gap Analysis

### Gaps Found

| # | Gap | Severity | Recommendation |
|---|-----|----------|----------------|
| **GAP-1** | Task 1.2 misses `MapContainer.jsx:615` — third `rxGain: 2.15` in RF Coverage drag handler | HIGH | Add line 615 to Task 1.2 prompt. Same fix pattern. |
| **GAP-2** | Task 1.1 misses `MapContainer.jsx:611-621` — cable loss not in drag handler rfParams | HIGH | Add drag handler to Task 1.1 prompt. Same fix pattern. |
| **GAP-3** | Finding 6 (diffraction condition logic) has no implementation task | LOW | Create new Task 5.5 or fold into Task 2.1 to fix the condition on `LinkLayer.jsx:249`. After rename, condition should check model !== 'hata' && model !== 'fspl' to apply Bullington viz. |
| **GAP-4** | Viewshed drag handler has an elevation+height bug at `MapContainer.jsx:565,573` | MEDIUM | Task 1.4 prompt already addresses this correctly — just needs to be executed. Not a plan gap per se, but confirming the prompt is right. |

### Coverage Summary

| Plan Task | Findings Covered | Status |
|-----------|-----------------|--------|
| 1.1 Cable losses | Finding 2 (partial — misses drag handler) | **Needs amendment** |
| 1.2 RX gain | Finding 2, 3 (partial — misses drag handler) | **Needs amendment** |
| 1.3 RX height fallback | Finding 2 (rxHeight mismatch) | Complete |
| 1.4 Viewshed height | Finding 7 | Complete |
| 2.1 Rename ITM→Bullington | Finding 1 | Complete |
| 3.1 C++ ground params | Finding 2 (ground/climate hardcodes) | Complete |
| 3.2 Sidebar UI | Finding 2 (no controls for ground/climate) | Complete |
| 3.3 Wire through | Finding 2 (wire ground/climate to WASM) | Complete |
| 4.1 WASM P2P hook | Finding 1 (unify ITM) | Complete |
| 4.2 Integrate WASM ITM | Finding 1 (unify ITM) | Complete |
| 5.1 Environment selector | Finding 4 | Complete |
| 5.2 Hata warnings | Finding 4 (extended) | Complete |
| 5.3 Fade margin | Finding 5 | Complete |
| 5.4 K-Factor/Clutter to Python | Finding 8 | Complete |
| **No task** | **Finding 6 (diffraction condition)** | **MISSING** |

---

## Recommended Amendments to Implementation Plan

### Amendment A: Update Task 1.1 — Add drag handler location

Add to the Task 1.1 prompt:

> Also update `MapContainer.jsx` lines 611-621 (the RF Coverage marker drag
> handler). This builds rfParams identically to the recalc path. Add txLoss
> and rxLoss here too.

### Amendment B: Update Task 1.2 — Add third rxGain location

Add to the Task 1.2 prompt:

> There are THREE locations where rxGain is hardcoded to 2.15:
> 1. CoverageClickHandler.jsx:24
> 2. MapContainer.jsx:229 (recalc useEffect)
> 3. MapContainer.jsx:615 (RF Coverage drag handler)
>
> Fix all three.

### Amendment C: Add Task 5.5 — Fix diffraction loss visualization condition

```
TASK 5.5 — Fix diffraction loss condition in LinkLayer

Role: Frontend developer fixing a logic condition.
Depends on: Task 2.1 (rename)
Files: src/components/Map/LinkLayer.jsx

Prompt:
  In LinkLayer.jsx line 249, the diffraction loss visualization has a
  wrong condition:

    if (propagationSettings?.model === 'Hata' && linkStats.profileWithStats) {

  This calculates Bullington diffraction only when Hata is selected.
  But Hata is a statistical model that doesn't use terrain — Bullington
  diffraction is meaningless for it.

  After Task 2.1 renames models, the intent should be:
  - When "bullington" is selected: the backend already returns FSPL + diffraction
    as pathLossOverride, so the budget margin already accounts for it. No need
    to calculate diffraction separately for margin adjustment.
  - When "hata" is selected: Hata returns its own loss. No diffraction needed.
  - When "itm_wasm" is selected (after Task 4.2): ITM returns total path loss.
    No separate diffraction needed.

  The correct fix is to REMOVE the diffraction subtraction from the margin
  entirely (lines 248-256 and line 273), since every backend model already
  includes its own loss in pathLossOverride. The margin calculation at line 273
  should simply be: const m = budget.margin;

  If you want to keep diffraction as a DISPLAY value (shown in the panel but
  not subtracted from margin), compute it when the model is 'bullington' and
  display it separately — but don't subtract it from margin since the backend
  path loss already includes it.

Acceptance:
  - Link color/margin no longer double-counts diffraction
  - Diffraction value can still be displayed in the panel for informational purposes
  - No change when FSPL is selected (no backend path loss, no diffraction)
```

---

## Math Re-Verification (Spot Check)

Spot-checked the following against the current code to confirm nothing has drifted:

| Formula | File:Line | Value Today | Standard | Match? |
|---------|-----------|------------|----------|--------|
| FSPL constant | `rfMath.js:13` | 32.44 | 32.44 | ✅ |
| FSPL constant (Python) | `rf_physics.py:143` | 32.44 | 32.44 | ✅ |
| Hata base: 69.55 | `rf_physics.py:116` | 69.55 | 69.55 | ✅ |
| Hata: 26.16 | `rf_physics.py:116` | 26.16 | 26.16 | ✅ |
| Earth radius | `rf_physics.py:6` | 6371.0 km | 6371 km | ✅ |
| K-factor | `RFContext.jsx:98` | 1.33 | 4/3 ≈ 1.333 | ✅ (acceptable) |
| Knife-edge threshold | `rf_physics.py:78` | -0.78 | -0.78 | ✅ |
| Knife-edge formula | `rf_physics.py:82-83` | `6.9 + 20*log10(sqrt(term**2+1)+term)` | ITU-R P.526-14 Eq.31 | ✅ |
| Sensitivity NF | `RFContext.jsx:219` | 6 dB | 6 dB (Semtech) | ✅ |
| SNR SF12 | `RFContext.jsx:224` | -20 dB | -20 dB (Semtech) | ✅ |
| Fresnel constant | `rfConstants.js` | 17.32 | 17.32 | ✅ |
| N_0 default | `meshrf_coverage.cpp:84` | 301.0 | 301.0 (NTIA) | ✅ |
| Ground sigma | `meshrf_coverage.cpp:86` | 0.005 | 0.005 S/m (ITU-R P.527) | ✅ |
| Ground epsilon | `meshrf_coverage.cpp:85` | 15.0 | 15.0 (ITU-R P.527) | ✅ |
| Climate | `meshrf_coverage.cpp:87` | 5 | 5 (Continental Temperate) | ✅ |
| mdvar | `meshrf_itm.cpp:38` | 12 | Mobile+no loc var | ✅ |
| Time/Loc/Sit | `meshrf_itm.cpp:49-51` | 50/50/50 | Median | ✅ |

**All math confirmed correct. No drift since audit.**

---

## Final Summary

```
Findings in original audit:                   8
Findings still present in code:               8  (all — no fixes applied yet)
Implementation plan tasks:                   13
Tasks with complete coverage:                11
Tasks needing amendment:                      2  (1.1, 1.2 — missing drag handler)
Missing tasks:                                1  (Finding 6 — diffraction condition)
Math formulas verified correct:              16/16
Constants verified correct:                  15/15
```

**Recommendation**: Apply the three amendments (A, B, C) to the implementation plan before executing, then proceed with Phase 1 tasks in parallel.
