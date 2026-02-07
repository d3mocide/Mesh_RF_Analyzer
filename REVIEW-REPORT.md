# MeshRF Multi-Site Analyzer — Functionality Review Report

## Executive Summary

MeshRF is a well-structured RF propagation and mesh network planning tool with a React frontend, Python/FastAPI backend, and C++/WASM engine. The multi-site analyzer specifically provides automated site finding (elevation scan) and manual multi-site management with viewshed analysis. After a thorough review of every layer of the codebase, this report identifies **15 concrete improvements** organized by impact and effort.

---

## 1. Greedy Optimizer Uses Individual Area Instead of Marginal Gain

**File:** `rf-engine/tasks/viewshed.py:104-134`

The greedy site-selection algorithm (used when "Greedy Optimization" is enabled in the NodeManager) is supposed to pick the subset of N nodes that maximizes total coverage. However, it currently selects nodes by their **individual** `coverage_area_km2` rather than by **marginal gain** — i.e., how much *new, uncovered* area each additional node adds.

```python
# Current (line 126): picks by raw individual area
gain = res['coverage_area_km2']
```

This means it simply picks the N nodes with the largest individual footprints, ignoring overlap. Two nodes on the same hilltop with nearly identical viewsheds would both get selected over a node in a different valley that covers entirely new terrain.

**Recommendation:** Project individual viewshed grids onto the shared master grid coordinate system. Track a `covered_points` set. On each greedy iteration, count how many *new* pixels each candidate adds and pick the one with the highest marginal gain. The infrastructure for this already exists — the master grid, `lat_to_y`/`lon_to_x` mappings, and the individual `grid`/`grid_lats`/`grid_lons` are all computed. The comment at line 122 even acknowledges this shortcut.

---

## 2. NSGA-II Optimization Is a Stub

**File:** `rf-engine/tasks/optimize.py`

The entire file is a placeholder that sleeps for 2 seconds and returns an empty Pareto front:

```python
def run_optimization(self, params):
    self.update_state(state='PROGRESS', meta={'progress': 0})
    time.sleep(2)
    return {"status": "completed", "pareto_front": []}
```

**Recommendation:** Implement multi-objective optimization using `pymoo` or `scipy.optimize`. Useful objective pairs for mesh networks:
- **Maximize total coverage area** vs. **Minimize number of sites** (cost)
- **Maximize minimum inter-node link margin** vs. **Minimize total cable/power cost**
- **Maximize worst-case link redundancy (k-connectivity)** vs. **Minimize site count**

Return a Pareto front the UI can display, letting users pick their preferred trade-off point.

---

## 3. Score Normalization Is Incomplete in OptimizationService

**File:** `rf-engine/optimization_service.py:85-132`

`score_candidate()` returns raw elevation, prominence, and Fresnel values but never computes an actual score. The comments in the code explicitly call this out:

```python
# This is arbitrary. Better approach: Return the Components, let Caller normalize & rank.
```

The caller (`server.py:293-297`) does normalize against batch max, but the scoring function's `weights` parameter goes unused within `score_candidate` itself — the function signature accepts weights but never applies them.

**Recommendation:** Either remove the `weights` parameter from `score_candidate` (since the caller handles weighting) to avoid confusion, or consolidate the normalization + weighting into the service so `server.py` just calls `rank_candidates(candidates, weights)`. Additionally, consider min-max normalization instead of dividing by max alone — a candidate batch where all elevations are between 900m and 1000m would get scores from 0.9 to 1.0, making elevation differences nearly invisible.

---

## 4. No Connectivity / Link-Budget Awareness in Site Optimizer

**File:** `rf-engine/server.py:247-321` (optimize-location endpoint)

The current site finder scores candidates on elevation, topographic prominence, and Fresnel clearance — all geometric/terrain metrics. It has no awareness of the actual RF link budget: TX power, antenna gain, receiver sensitivity, LoRa spreading factor, or bandwidth.

A candidate site might score high on prominence and Fresnel but be at a distance where the path loss exceeds the link margin for the user's configured radio.

**Recommendation:** Add an optional `radio_config` to the `OptimizeRequest` model (tx_power, antenna gains, SF, BW, sensitivity). After geometric scoring, run `calculate_path_loss` for each candidate against the existing network nodes and filter out or penalize candidates where the predicted RSSI falls below sensitivity. This turns the tool from a terrain finder into a true network planner.

---

## 5. Batch Processing Has No Mesh-Wide Metrics

**File:** `src/components/Map/BatchNodesPanel.jsx`, `src/components/Map/BatchProcessing.jsx`

The batch tool imports nodes and supports pair-wise link analysis (selecting TX/RX pairs), but it doesn't compute any mesh-wide metrics after analysis:

- No **network graph** visualization (which nodes can reach which)
- No **k-connectivity** analysis (how many node failures before the mesh fragments)
- No **bottleneck detection** (links with the lowest margin that constrain the network)
- No **coverage gap** identification (areas not reachable by any node)

**Recommendation:** After batch link analysis, build an adjacency graph where edges exist between nodes whose link margin > 0. Compute and display:
1. **Connected components** — are all nodes reachable?
2. **Minimum cut / vertex connectivity** — how resilient is the mesh?
3. **Weakest links** — sorted by margin, flagged on the map
4. **Network diameter** — maximum hop count between any two nodes

Libraries like `graphology` (JS) would handle this without heavy dependencies.

---

## 6. No Multi-Hop / Relay Path Analysis

The link analysis tool only evaluates direct point-to-point links. For mesh networks, the critical question is often: "Can Node A reach Node C *through* Node B?" There's no relay or multi-hop path analysis.

**Recommendation:** Given the batch node list and the all-pairs link matrix, implement shortest-path routing (Dijkstra on the link-margin graph) and display:
- Optimal relay paths between any two selected nodes
- Per-hop link budget breakdown
- Total end-to-end latency estimate (hop count x airtime per hop)
- Visual path overlay on the map

---

## 7. Elevation Profile Resolution Is Fixed

**File:** `rf-engine/server.py:58-62`

The elevation profile always uses 100 samples regardless of link distance:

```python
elevs = tile_manager.get_elevation_profile(
    req.tx_lat, req.tx_lon, req.rx_lat, req.rx_lon,
    samples=100
)
```

For a 500m link, that's a sample every 5m (oversampling for 30m DEM data). For a 50km link, that's a sample every 500m (severe undersampling — missing ridgelines and valleys).

**Recommendation:** Make the sample count adaptive based on distance and DEM resolution. For NED10M data at ~10m resolution: `samples = max(50, min(500, int(dist_m / 10)))`. This ensures short links aren't wasteful and long links don't miss terrain features.

---

## 8. No Environment/Clutter Model in Backend

**File:** `rf-engine/rf_physics.py`

The Hata model accepts an `environment` parameter (urban, suburban, rural), but the ITM/Bullington model has no concept of land-use clutter. There's no foliage loss, no building penetration loss, and no rain/atmospheric attenuation.

The frontend's `analyzeLinkProfile` in `rfMath.js` accepts a `clutterHeight` parameter but it defaults to 0 and there's no UI to set it.

**Recommendation:**
- Add a `clutter_height_m` parameter to the `/calculate-link` endpoint
- Apply clutter as additional terrain height in `calculate_bullington_loss`
- Add a dropdown in LinkAnalysisPanel for environment type (Open, Light Forest, Dense Forest, Suburban, Urban) that maps to standard clutter heights (0, 8, 15, 10, 20m)
- For longer-term: integrate NLCD or similar land-cover data to vary clutter along the path

---

## 9. Frontend/Backend Propagation Model Divergence

**Files:** `src/utils/rfMath.js` and `rf-engine/rf_physics.py`

Both the frontend and backend independently implement Bullington diffraction, FSPL, Fresnel zone calculations, and link analysis. The implementations are functionally similar but have subtle differences:
- The frontend's `calculateBullingtonDiffraction` uses `wavelength = 300 / freqMHz` while the backend uses `wavelength = 2.99792e8 / (freq_mhz * 1e6)` (trivially different constant)
- The frontend uses `maxV <= -1` as the clear-LOS threshold; the backend uses `maxV <= -0.78`
- The frontend applies Earth bulge locally in Bullington; the backend pre-computes it as part of the profile

These discrepancies mean a link shown as "Good" in the frontend profile chart might show different path loss from the backend.

**Recommendation:** Designate the backend as the single source of truth for all RF calculations. Have the frontend only handle visualization and UI state. Remove or deprecate the frontend's Bullington implementation in favor of always using backend results. If offline capability is needed, ensure the WASM engine mirrors the backend exactly.

---

## 10. Viewshed Scan Radius Is Hardcoded

**File:** `rf-engine/server.py:196-199`, `rf-engine/tasks/viewshed.py:38`

The viewshed scan radius is hardcoded to 5000m in the backend and not configurable from the UI:

```python
"options": { "radius": 5000, "optimize_n": optimize_n }
```

**Recommendation:** Expose the radius as a user-configurable slider in the NodeManager component (e.g., 1km to 25km). Pass it through the store action to the API call. For LoRa networks, useful ranges span 1-50km depending on terrain and radio config.

---

## 11. No Export from Multi-Site Analysis Results

**File:** `src/components/Map/UI/NodeManager.jsx`

The batch tools in BatchProcessing.jsx have CSV export for link analysis, but the Multi-Site Analysis tab (NodeManager + viewshed scan) has no export capability. Users can't save:
- The ranked site list with scores
- The composite viewshed overlay as GeoTIFF/KML
- The analysis parameters for reproducibility

**Recommendation:** Add export buttons to the results panel:
- **CSV**: site name, lat, lon, elevation, coverage_area_km2, score
- **KML/KMZ**: site markers + viewshed polygons for import into Google Earth or other GIS tools
- **GeoJSON**: for integration with other mapping tools
- **PNG/PDF**: rendered map screenshot with analysis overlay

---

## 12. No Terrain Profile Caching

**File:** `rf-engine/server.py:46-88`

Each `/calculate-link` call fetches a fresh 100-point elevation profile from the tile manager. While individual tile data is cached in Redis, the assembled profile (the specific 100 interpolated elevation values between two coordinates) is not. Repeated analysis of the same link (common when adjusting antenna heights or radio parameters) re-fetches the same profile.

**Recommendation:** Cache assembled profiles in Redis keyed by `(tx_lat, tx_lon, rx_lat, rx_lon, samples)` rounded to 5 decimal places. Set a 1-hour TTL. This would make iterative parameter tuning (changing height, power, SF) near-instant.

---

## 13. Prominence Calculation Is Coarse

**File:** `rf-engine/optimization_service.py:11-45`

Topographic prominence is approximated as `center_elevation - mean_neighborhood_elevation` using an 11x11 grid over a 5km radius (each cell ~1km apart). This is a rough proxy. True topographic prominence requires finding the highest contour that encloses no higher peak — a flood-fill algorithm.

Additionally, the 5km radius is hardcoded and not adjustable.

**Recommendation:**
- Implement a proper prominence algorithm using the DEM data: for each candidate peak, find the lowest saddle point on any path to a higher peak
- Make the search radius configurable
- Consider using the `scipy.ndimage` morphological operations on the elevation grid for efficient prominence computation

---

## 14. SSE Error Handling Has a Race Condition

**File:** `src/store/useSimulationStore.js:104-116`

The `onerror` handler closes the EventSource and resets `isScanning`, but it doesn't check whether a `complete` event was already processed. If the SSE connection drops *after* the task completes but *before* the client processes the complete event, the results could be lost.

```javascript
eventSource.onerror = (err) => {
    if (eventSource.readyState === 2) {
        console.log('SSE Connection closed');
    } else {
        console.error('SSE Error:', err);
        set({ isScanning: false }); // Wipes state even if results arrived
    }
    eventSource.close();
};
```

**Recommendation:** Check `get().results !== null` before resetting state in the error handler. If results are already populated, the error is a benign post-completion disconnect. Also add a fallback polling mechanism: if SSE fails, poll `/task_status/{id}` via regular HTTP every 2 seconds.

---

## 15. No Antenna Pattern Support

The current system treats all antennas as isotropic (uniform gain in all directions) modified only by a single dBi value. Real antenna patterns — especially Yagi directional antennas listed in the presets — have significant gain variation by azimuth and elevation angle.

**Recommendation:**
- Add antenna pattern data (azimuth gain tables) to the antenna presets in `src/data/`
- When computing link budget, calculate the bearing from TX to RX and look up the actual gain at that bearing angle
- For viewshed/coverage analysis, apply the directional gain pattern to produce a realistic coverage footprint (not a circle but a lobe shape)
- This would make the directional antenna presets (Yagi 3/5/7 element) produce meaningfully different results from omnidirectional antennas

---

## Priority Matrix

| # | Improvement | Impact | Effort | Priority |
|---|------------|--------|--------|----------|
| 1 | Fix greedy optimizer marginal gain | High | Low | **P0** |
| 7 | Adaptive elevation profile resolution | High | Low | **P0** |
| 9 | Fix frontend/backend model divergence | High | Medium | **P0** |
| 4 | Link-budget awareness in site optimizer | High | Medium | **P1** |
| 5 | Mesh-wide network metrics | High | Medium | **P1** |
| 8 | Environment/clutter model | High | Medium | **P1** |
| 10 | Configurable viewshed radius | Medium | Low | **P1** |
| 12 | Terrain profile caching | Medium | Low | **P1** |
| 14 | SSE race condition fix | Medium | Low | **P1** |
| 3 | Score normalization cleanup | Medium | Low | **P2** |
| 6 | Multi-hop relay path analysis | High | High | **P2** |
| 11 | Export from multi-site results | Medium | Medium | **P2** |
| 13 | Improved prominence calculation | Medium | Medium | **P2** |
| 2 | NSGA-II multi-objective optimization | High | High | **P3** |
| 15 | Antenna radiation patterns | High | High | **P3** |

---

## Summary

The three highest-impact, lowest-effort wins are:
1. **Fix the greedy optimizer** to use marginal gain — the data structures already exist, just the selection logic needs changing
2. **Make profile resolution adaptive** — a one-line change that significantly improves long-link accuracy
3. **Eliminate model divergence** — use the backend as the single RF calculation authority

The three highest-impact feature additions for mesh network planning are:
1. **Link-budget-aware site scoring** — transforms the tool from terrain analysis to actual network planning
2. **Mesh-wide connectivity metrics** — essential for understanding network resilience
3. **Antenna pattern support** — makes directional antenna presets produce realistic, differentiated results
