# MeshRF Propagation Engine Roadmap

**Last Updated:** 2026-02-09

---

## Completed

### Phase 1: Critical Bug Fixes

- [x] **P1-1** Fixed backend `/calculate-link` crash -- removed duplicate `req.rx_height` positional argument in `server.py:68-78` that caused `TypeError` on every call. Hata, Bullington, and FSPL models via the backend now work.
- [x] **P1-2** Wired `groundType`, `climate`, and `calculateSensitivity` to `CoverageClickHandler` via the `rfContext` prop in `MapContainer.jsx`. User's ground type and climate zone selections now flow to initial RF coverage calculations.
- [x] **P1-3** Added `epsilon`, `sigma`, and `climate` to the RF coverage recalculation path (`MapContainer.jsx` recalcTimestamp effect). The "Update Calculation" button now respects environment settings.
- [x] **P1-4** Fixed RF observer drag handler to include `txLoss` (cable loss), `epsilon`, `sigma`, `climate`, and use `nodeConfigs.B.antennaGain` instead of hardcoded `2.15` for rxGain.

### Phase 2: Consistency & Accuracy

- [x] **P2-1** Unified sensitivity calculation -- created canonical `calculateLoRaSensitivity(sf, bw)` in `rfMath.js` using SX1262 per-SF lookup table. Both `calculateLinkBudget` and `RFContext.calculateSensitivity` now delegate to this single function. Eliminated the 1.5 dB discrepancy between link analysis and coverage tools.
- [x] **P2-2** Updated LoRa sensitivity to SX1262 datasheet values. Per-SF lookup table at 125kHz: SF7=-124, SF8=-127, SF9=-130, SF10=-133, SF11=-135.5, SF12=-137 dBm. Replaces the old `-123 + 2.5*step` approximation.
- [x] **P2-3** Harmonized FSPL constant to `32.45` across `rfMath.js` and `rf_physics.py`, matching ITU-R P.525-4 (exact speed of light) and the C++ ITM vendor code.
- [x] **P2-4** Batch processing now uses per-node A/B configs (antenna height, gain, device loss) instead of GLOBAL proxy values. Fade margin is now included in batch link budgets. Bullington diffraction is applied for terrain-aware path loss instead of pure FSPL.

---

## Phase 3: Full Model Switching (Medium-term)

### P3-1: Client-Side Hata/FSPL Models
Move Okumura-Hata and explicit FSPL calculations to JavaScript so model switching works without the Python backend. The Bullington diffraction model is already in `rfMath.js`. Adding Hata eliminates the backend dependency for non-ITM models.

**Files:** `src/utils/rfMath.js`, `src/components/Map/LinkLayer.jsx`

### P3-2: Model Selection for RF Coverage
Currently the RF coverage tool is hardwired to WASM ITM. Add a model dispatch in `useRFCoverageTool.js` that supports FSPL-only or Hata for faster coverage maps when full ITM precision isn't needed. ITM remains the default.

**Files:** `src/hooks/useRFCoverageTool.js`, `src/components/Map/Controls/CoverageClickHandler.jsx`

### P3-3: WASM ITM for Batch Processing
Batch mesh reports currently use FSPL + Bullington (frontend-only). Integrate the WASM ITM path (same as link analysis) for full terrain-aware batch reports. Requires fetching elevation profiles for each node pair.

**Files:** `src/components/Map/BatchProcessing.jsx`, `src/hooks/useWasmITM.js`

### P3-4: Per-Node Configs in Batch CSV
Allow CSV import to include optional per-node columns: antenna height, device type, antenna type. Currently all batch nodes use the global A/B config. Per-node overrides would enable realistic multi-device mesh planning.

**Files:** `src/components/Map/BatchProcessing.jsx`

---

## Phase 4: Advanced Integration (Long-term)

### P4-1: Server-Side ITM via itmlogic
`itmlogic` is listed in `requirements.txt` but never imported. Implement as a true Python ITM fallback for server-side batch processing and environments where WASM isn't available. Enables Celery workers to run ITM asynchronously.

**Files:** `rf-engine/rf_physics.py`, `rf-engine/tasks/`

### P4-2: COST 231 Hata Extension
Current Hata model covers 150-1500 MHz. The COST 231 extension covers 1500-2000 MHz for future higher-frequency deployments (e.g., 2.4 GHz ISM). Straightforward formula addition.

**Files:** `rf-engine/rf_physics.py`, `src/utils/rfMath.js` (if client-side Hata is added in P3-1)

### P4-3: Clutter / Land-Use Integration
Current clutter model applies a uniform height everywhere. Integrating land cover data (NLCD for US, Corine for EU) would enable per-pixel clutter classification: forest canopy height, urban building density, open field. This would significantly improve coverage accuracy in mixed environments.

**Dependencies:** Land cover tile server, clutter height lookup table

### P4-4: Antenna Pattern Support
All models currently assume omnidirectional antennas. The Yagi preset has 11 dBi gain but no directional pattern. Adding azimuth/elevation radiation patterns would enable:
- Directional link predictions
- Coverage maps with beam patterns
- Tilt optimization for hilltop sites

**Data needed:** Antenna pattern files (CSV or NEC2 format)

### P4-5: Multi-Hop Mesh Analysis
Current tools analyze point-to-point links only. A mesh planner would:
- Calculate end-to-end connectivity through relay chains
- Identify single points of failure
- Suggest optimal relay placement
- Estimate end-to-end latency and throughput

Could build on the batch processing infrastructure with graph analysis (Dijkstra/Floyd-Warshall for optimal paths).

### P4-6: Probabilistic / Variability Modes
The ITM supports time/location/situation variability percentages (currently fixed at 50/50/50). Exposing these as user controls would enable:
- Worst-case planning (90/90/90 for reliability)
- Best-case estimation (10/10/10 for maximum range)
- Statistical coverage contours showing probability of reception
