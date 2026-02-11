# RF Simulator Refactor Report

## Executive Summary

The RF Simulator and Site Analysis tool share surface-level overlap — both visualize coverage from a node — but they operate on fundamentally different models and serve distinct purposes. **The RF Simulator should not be decommissioned.** Its core technology (WASM-compiled ITM/Longley-Rice propagation model) is unique in the codebase and materially more accurate than what Site Analysis produces. The recommended path is to **refactor the RF Simulator from a standalone toolbar tool into an integrated per-node propagation layer within Site Analysis**, eliminating the appearance of duplication while preserving the superior physics engine.

---

## 1. What Each Tool Actually Does

### RF Simulator (`toolMode: 'rf_coverage'`)

**Model**: WASM-compiled ITM (Irregular Terrain Model / Longley-Rice)

**Execution**: Entirely client-side. Fetches a 3×3 elevation tile grid (~768×768 pixels), stitches them via `tileStitcher.js`, allocates a WASM memory buffer, and calls `calculate_rf_coverage()` in `libmeshrf`. No backend Celery task, no Redis queue.

**Output**: A continuous `Float32Array` of raw dBm signal strength values mapped across the geographic bounds of the stitched tile, rendered as an SNR-gradient heatmap via a Deck.GL layer.

**What the ITM model accounts for**:
- Terrain diffraction (signals bending over ridges — critical for LoRa at sub-GHz)
- Atmospheric refraction via climate zone (1–7) and k-factor
- Ground dielectric constant (`epsilon`) and conductivity (`sigma`)
- TX/RX antenna heights, gains, cable losses, receiver sensitivity
- Signals that propagate *beyond line of sight* due to diffraction

**Key file**: `src/hooks/useRFCoverageTool.js:102-228`

---

### Site Analysis — Coverage Tab (`toolMode: 'optimize'`, `mode: 'auto'`)

**Model**: Heuristic site-scoring via `OptimizationService` in `optimization_service.py`

**Execution**: Python backend, synchronous API call to `/api/optimize-location`.

**Output**: Top 5 ranked candidate coordinates with composite scores based on:
- **Elevation** weight (raw ASL height)
- **Prominence** weight (local peak detection, 5 km neighborhood comparison)
- **Fresnel clearance** weight (average clearance to existing nodes, not to coverage area)

This mode answers "where is the best place to put a node?" It does **not** produce a signal strength map.

---

### Site Analysis — Multi-Site Manager (`toolMode: 'optimize'`, `mode: 'manual'`)

**Model**: Binary viewshed via `calculate_viewshed()` in `core/algorithms` + Bullington/FSPL path loss for inter-node links via `rf_physics.py`

**Execution**: Async Celery task (`calculate_batch_viewshed`) with SSE progress updates.

**Output**:
- Binary viewshed grid per node (visible = 1, not visible = 0)
- Coverage area in km²
- Unique (marginal) coverage percentage per node
- Pairwise inter-node links: path loss, Fresnel clearance ratio, status (viable/degraded/blocked)
- Composite union overlay
- Mesh topology analysis (BFS multi-hop connectivity score)

This mode answers "how does a set of nodes collectively cover an area and connect to each other?"

---

## 2. Where They Overlap

| Capability | RF Simulator | Site Analysis |
|---|---|---|
| Visualize coverage from a single point | Yes (ITM heatmap) | Yes (binary viewshed) |
| Uses shared RF parameters from `RFContext` | Yes | Yes |
| Uses same elevation tiles / `TileManager` | Yes | Yes |
| Triggered by map click | Yes | Yes (auto mode) |
| Accounts for terrain | Yes (diffraction) | Yes (LOS only) |
| Multi-node network analysis | **No** | **Yes** |
| Signal strength / SNR values | **Yes** | **No** |
| LoRa sensitivity threshold awareness | **Yes** | **No** |
| Climate / ground type modeling | **Yes** | **No** |
| Diffracted signals past terrain | **Yes** | **No** |
| Async backend processing | **No** | **Yes** |

The overlap is real but narrow: both can show "what area can a node reach." The key distinction is **model fidelity and output type**. The RF Simulator's question is "is the signal strong enough?" measured with a physics-grounded model. Site Analysis asks "can you see it at all?" measured with binary LOS.

---

## 3. The Case Against Decommissioning

Removing the RF Simulator would have the following impacts:

**Loss of the ITM propagation model entirely.** No other part of the codebase invokes the WASM `calculate_rf_coverage()` function. The WASM module (`libmeshrf`) would become dead weight. This is the only tool using the Longley-Rice model, which is the standard used by the FCC and telecommunications industry for terrain-sensitive propagation prediction.

**Degraded accuracy for LoRa specifically.** LoRa operates at 915 MHz (US) / 868 MHz (EU), frequencies where diffraction around terrain is a real phenomenon. A viewshed says "blocked" but Longley-Rice says "−5 dB margin" — which for LoRa SF12 may still be a viable link. Users planning real deployments lose this nuance.

**SNR visualization disappears.** The color gradient from excellent to marginal to below-sensitivity is only produced by the RF Simulator. Site Analysis viewsheds are binary (cyan / transparent). There is no other tool that tells a user "this area has a fair signal but this ridge will cut you off."

**No substitute for quick single-node previews.** The RF Simulator runs entirely in the browser in under a second after tiles load. Site Analysis always goes through the Celery queue. For rapid iteration when exploring a new site, the client-side tool is the right UX.

---

## 4. Recommended Refactor: Integrate, Don't Decommission

The RF Simulator's standalone nature is the problem, not the tool itself. Currently it exists as a separate toolbar mode that a user must remember to use, and it produces a result that disappears when switching tools. The fix is to make its output part of the Site Analysis workflow.

### Proposed Architecture

**Phase 1 — Per-Node Propagation Preview in Multi-Site Manager**

Add a "Show RF Coverage" action to each site row in the `SiteAnalysisResultsPanel` Sites tab. When clicked:
1. The `useRFCoverageTool` hook runs `runAnalysis()` for that node's lat/lon using the parameters already in `RFContext`
2. The resulting ITM heatmap overlays the map alongside the existing viewshed composite
3. A toggle allows switching between the binary viewshed and the ITM heatmap per-node

This replaces the need for a user to manually switch to the RF Simulator toolbar button and re-click the same site.

**Phase 2 — RF Coverage in Coverage Analysis Auto Mode**

After the optimization scan returns its top 5 candidates, automatically run `runAnalysis()` for the top-ranked candidate and display its ITM heatmap. The heatmap then updates as the user clicks through the ranked candidates. This removes the current situation where the Coverage Analysis tab shows a scored list but no actual signal map.

**Phase 3 — Retire the Standalone Toolbar Button**

Once Phase 1 and Phase 2 are complete, the standalone `rf_coverage` toolbar mode becomes redundant. Remove it from `MapToolbar.jsx` and clean up the `toolMode === 'rf_coverage'` conditional branches in `MapContainer.jsx`. The `useRFCoverageTool` hook and `RFCoverageLayer.js` are retained but called from within the Site Analysis flow rather than from a top-level toolbar mode.

---

## 5. Files Affected by the Refactor

| File | Change |
|---|---|
| `src/components/Map/UI/MapToolbar.jsx` | Remove RF Simulator toolbar button |
| `src/components/Map/MapContainer.jsx` | Remove `toolMode === 'rf_coverage'` branches; wire `useRFCoverageTool` into Site Analysis context |
| `src/components/Map/Controls/CoverageClickHandler.jsx` | Remove `runRFCoverage` handler path |
| `src/components/Map/UI/SiteAnalysisResultsPanel.jsx` | Add "Show RF Coverage" action per site; wire toggle |
| `src/hooks/useRFCoverageTool.js` | No change to logic; remove `active` gate if no longer toolbar-driven |
| `src/components/Map/RFCoverageLayer.js` | No change; used as rendering primitive |
| `src/context/RFContext.jsx` | Remove `rf_coverage` from `toolMode` type |
| `Documentation/rf-simulator.md` | Update to reflect new integration location |

**No backend changes are required.** The ITM model runs entirely in the browser via WASM.

---

## 6. Summary

| Question | Answer |
|---|---|
| Should RF Simulator be decommissioned? | No |
| Is there meaningful overlap with Site Analysis? | Partial — both visualize single-node coverage, but with different models and outputs |
| What is unique about RF Simulator? | WASM ITM/Longley-Rice propagation model, client-side speed, SNR gradient, diffraction modeling |
| What is the refactor path? | Integrate ITM heatmap rendering into Site Analysis as a per-node visualization action; retire the standalone toolbar mode |
| What is the impact of doing nothing? | Two tools that feel redundant to users, with the more powerful one (RF Simulator) being less discoverable |
| What is the impact of decommissioning? | Loss of the application's only physics-accurate RF propagation model and the only SNR visualization |

The WASM ITM engine is one of the most technically sophisticated pieces of the codebase. The right move is to bring it front and center inside the workflow where users are already doing propagation planning — not to remove it or leave it stranded as a standalone mode.
