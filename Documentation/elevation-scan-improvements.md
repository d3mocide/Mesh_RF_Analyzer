# Elevation Scan Tool - Improvement Report

## Table of Contents

1. [Current State Assessment](#current-state-assessment)
2. [Industry Landscape & Competitive Analysis](#industry-landscape--competitive-analysis)
3. [Identified Improvements](#identified-improvements)
4. [Implementation Recommendations](#implementation-recommendations)

---

## Current State Assessment

The Elevation Scan tool is part of the Site Analyzer suite and operates in two modes:

### Auto Mode (Elevation Scan)
Users draw a rectangle on the map, and the system performs a **10x10 grid search** across the bounding box, scoring each of 121 candidate points on three weighted metrics:

| Metric | Calculation | Weight Default |
|--------|-------------|----------------|
| **Elevation** | Raw height (m ASL), normalized to grid max | 0.5 |
| **Prominence** | Center elevation minus mean elevation in 5km radius (10x10 sample ring) | 0.3 |
| **Fresnel Clearance** | Average clearance ratio to existing nodes (0.0-1.0) via ITM model | 0.2 |

The top 5 candidates are returned as "Ghost Nodes" on the map with a composite score (0-100).

**Key files:** `rf-engine/server.py:247-321`, `rf-engine/optimization_service.py`

### Manual Mode (Multi-Site Manager)
Users add candidate sites manually or via CSV import, then run batch viewshed analysis. Individual viewsheds use the ITM propagation model at ~100m resolution within a 5km radius. Optional greedy optimization selects the top N sites.

**Key files:** `rf-engine/tasks/viewshed.py`, `rf-engine/core/algorithms.py`

### Current Limitations

| Area | Limitation | Impact |
|------|-----------|--------|
| **Grid Resolution** | Fixed 10x10 (121 points) | Misses terrain features between sample points |
| **Prominence Calculation** | 10-point sampling ring, simple peak-minus-mean | Not true topographic prominence; misses ridgelines |
| **Fresnel Analysis** | Only 20 profile samples per path; hardcoded 915 MHz and 10m TX height | Inaccurate for non-LoRa frequencies and varied antenna heights |
| **Viewshed Model** | Path-loss threshold (128 dB) as proxy for visibility, not true terrain LOS | Over/under-estimates coverage depending on terrain |
| **Greedy Optimization** | Uses individual coverage area as proxy, not marginal set-union gain | Selects overlapping coverage instead of maximizing unique coverage |
| **Single Frequency** | Hardcoded 915 MHz throughout scoring pipeline | Cannot evaluate for other bands (VHF, UHF, 2.4 GHz, etc.) |
| **No Terrain Profile Viz** | Raw scoring only; no visual path profile between points | Users cannot understand *why* a site scored well or poorly |
| **No Clutter/Land-Use Data** | Bare-earth elevation only | Forest, urban, water terrain effects ignored |
| **No Export** | Results exist only in session; no CSV/KML/GeoJSON export | Cannot share results with team or import into other tools |
| **No Test Coverage** | Zero automated tests for optimization or viewshed code | Regressions go undetected |

---

## Industry Landscape & Competitive Analysis

### Professional RF Planning Tools

#### CloudRF / Signal Server
- **Multi-model propagation**: ITM, Hata, COST-231, LOS models selectable per analysis
- **LiDAR support**: Up to 25cm resolution surface models including buildings and vegetation
- **Antenna pattern files**: `.az` (azimuth) and `.el` (elevation) pattern import with mechanical tilt modeling
- **Clutter/land-use data**: Integrates OSM and custom clutter layers (forest, urban, water, etc.)
- **API-first**: Full OpenAPI spec with batch operations and KMZ/PNG/GeoJSON export
- **Multi-thread**: Parallelized per-pixel propagation calculations

#### SPLAT! (Signal Propagation, Loss, And Terrain)
- **Comprehensive site engineering data**: Great circle distances, antenna elevation/depression angles, height above average terrain (HAAT), minimum antenna height for Fresnel clearance
- **Terrain profile visualization**: Detailed cross-section plots between any two points
- **Dual propagation models**: Longley-Rice ITM and ITWOM v3.0
- **Topographic map generation**: Annotated coverage maps with path-loss contours
- **Batch CLI operations**: Scriptable for large-scale automated planning

#### Atoll (Forsk)
- **Multi-RAT support**: 2G through 5G, including massive MIMO and 3D beamforming
- **Live network data integration**: KPIs, MDT traces, and crowdsourced data to validate predictions
- **Automatic frequency planning**: Interference-aware channel assignment
- **Clutter database**: Vector/raster 3D building data, vegetation, and terrain classification
- **Monte Carlo simulation**: Statistical coverage confidence levels

#### RadioPlanner 3.0
- **Built-in GIS**: Default terrain and clutter models from OpenStreetMap and Global Forest Change
- **Interference analysis**: Co-channel and adjacent-channel interference modeling
- **Export formats**: KMZ, PNG, interactive web pages for sharing

### Antenna Modeling Tools

#### 4NEC2 / EZNEC / MMANA-GAL
These tools provide features our tool currently lacks:
- **3D radiation pattern visualization**: Full spherical pattern rendering
- **Elevation slice overlays**: Arbitrary azimuth/elevation cuts superimposed on antenna models
- **Multi-pattern comparison**: Side-by-side overlay of multiple patterns on one graph
- **Parameter optimization**: Automatic optimization for gain, SWR, F/B ratio, and elevation angle

### GIS & Academic Approaches

- **Viewshed analysis best practices**: Use DEM offset values for both TX and RX heights; specify azimuth/elevation angle bounds for directional antennas
- **Heuristic site selection**: Restrict searches to topographic features (peaks, ridgelines, passes) rather than uniform grids; apply location-allocation algorithms
- **LiDAR vs. DTM**: First-return DSMs capture buildings and vegetation, providing dramatically more accurate results than bare-earth DTMs
- **Multi-viewshed optimization**: True set-union marginal gain calculation for placing N towers to maximize unique coverage area

---

## Identified Improvements

### Priority 1 - Core Accuracy (High Impact, Moderate Effort)

#### 1.1 Adaptive Grid Resolution
**Problem**: Fixed 10x10 grid (121 points) is too coarse for larger areas and wasteful for small areas.

**Solution**: Scale grid density based on bounding box size. Use a target spacing (e.g., 100-200m between points) and compute grid dimensions dynamically. For a 5km x 5km box at 150m spacing, this yields ~33x33 = 1,089 points -- much better coverage with similar per-point cost.

**Inspiration**: SPLAT! and CloudRF both use resolution-based grids rather than fixed point counts.

#### 1.2 Improved Prominence Algorithm
**Problem**: Current 10x10 ring sampling with peak-minus-mean is a rough approximation that misses ridgelines and saddle points.

**Solution**: Implement a proper topographic prominence calculation:
- Use concentric rings at multiple radii (1km, 2.5km, 5km) for multi-scale analysis
- Calculate "isolation" -- distance to nearest higher point -- as an additional metric
- Detect ridgelines by analyzing elevation gradients along cardinal/diagonal directions
- Weight prominence by terrain ruggedness index (TRI) to distinguish peaks from plateaus

**Inspiration**: GIS viewshed literature uses terrain feature extraction (peaks, pits, passes) to constrain search spaces, which is far more effective than uniform grids.

#### 1.3 True Line-of-Sight Viewshed
**Problem**: Current viewshed uses path-loss threshold as a proxy for visibility (`loss < 128 dB`), not actual terrain line-of-sight checks.

**Solution**: Implement Bresenham-based or ray-marching LOS algorithm:
- For each target cell, trace a ray from TX to RX
- Check each intermediate elevation sample against the ray height
- Mark cell as visible only if no intermediate terrain blocks the ray
- This is the standard approach used by SPLAT!, Signal Server, and all GIS viewshed tools

**Inspiration**: Every major tool (SPLAT!, CloudRF, ArcGIS, QGIS) uses true geometric LOS rather than propagation-loss proxies for viewshed analysis.

#### 1.4 Configurable Frequency and Antenna Parameters
**Problem**: Hardcoded 915 MHz, 10m TX height, and 2m RX height throughout the pipeline.

**Solution**: Pass frequency, TX height, and RX height from the frontend through to all scoring and viewshed functions. The UI already has antenna height inputs; they just need to flow through to the Fresnel and viewshed calculations.

**Inspiration**: CloudRF and RadioPlanner expose full parameter sets per analysis run. Signal Server accepts frequency, TX/RX height, TX power, and antenna pattern per request.

### Priority 2 - Scoring & Optimization (High Impact, Moderate Effort)

#### 2.1 Additional Scoring Metrics
**Problem**: Only three metrics (elevation, prominence, Fresnel) -- missing several factors critical for real-world site selection.

**Proposed new metrics:**
- **Height Above Average Terrain (HAAT)**: Standard FCC metric; measures antenna height relative to average terrain in a 3-16 km radius along 8 radials. More meaningful than raw elevation for RF coverage prediction.
- **Terrain Ruggedness Index (TRI)**: Standard deviation of elevation in a local window. Smooth terrain = better omnidirectional coverage; rugged terrain = more shadowing.
- **Slope / Aspect**: Practical buildability factor -- steep slopes are hard to build on. Also affects directional coverage patterns.
- **Access Distance**: Distance to nearest road/path (if OSM data available). Impacts installation feasibility.

**Inspiration**: SPLAT! reports HAAT as a primary metric. Atoll and RadioPlanner integrate land-use and accessibility data. The FCC uses HAAT as the basis for coverage contour estimation.

#### 2.2 Fix Greedy Optimization (True Marginal Gain)
**Problem**: The greedy optimization in `viewshed.py:104-134` uses individual coverage area as a proxy instead of computing marginal coverage gain, leading to selection of overlapping sites.

**Solution**: The `core/algorithms.py:99-149` already has a correct marginal-gain greedy implementation using set unions. The batch viewshed task should use this approach:
- Map each node's viewshed grid cells to a shared coordinate space
- At each greedy step, pick the node whose viewshed adds the most *new* unique cells to the covered set
- This is a well-known submodular maximization approach with a (1 - 1/e) approximation guarantee

#### 2.3 Multi-Objective Pareto Analysis
**Problem**: Single weighted-sum score collapses trade-offs. A site with great elevation but poor Fresnel gets the same score as one with moderate both.

**Solution**: Compute the Pareto frontier across all metrics and let users explore trade-offs:
- Identify non-dominated solutions (no other site is better on ALL metrics)
- Display the Pareto set with per-metric breakdowns
- Let users filter/sort by individual metrics
- Highlight sites that are "best in class" for each metric

**Inspiration**: Atoll and professional network planning tools present multi-dimensional analysis views rather than collapsing to a single score.

### Priority 3 - Visualization & UX (Medium Impact, Moderate Effort)

#### 3.1 Terrain Profile Visualization
**Problem**: No way to see *why* a site scored well or poorly. Users must trust an opaque score.

**Solution**: Add an interactive terrain cross-section view:
- Click any Ghost Node to see elevation profiles to all existing nodes
- Show Fresnel zone ellipse overlaid on profile
- Mark obstruction points with clearance values
- Display earth curvature correction

**Inspiration**: SPLAT! generates detailed terrain profile plots. SCADACore's RF Line of Sight tool shows interactive elevation profiles with Fresnel zones. This is a standard feature in virtually all RF planning tools.

#### 3.2 Coverage Heatmap Overlay
**Problem**: Auto mode only shows 5 point markers. No spatial visualization of how good/bad the entire search area is.

**Solution**: Render the full grid of scores as a color-gradient heatmap overlay on the map:
- Color scale from red (poor) to green (excellent)
- Opacity slider to blend with base map
- Click any point on the heatmap to see its metric breakdown
- Toggle between individual metrics (elevation only, prominence only, etc.)

**Inspiration**: CloudRF renders full-area coverage prediction heatmaps. RadioPlanner produces signal strength heat maps. This is the expected output format for any coverage analysis tool.

#### 3.3 Viewshed Boundary Visualization
**Problem**: Multi-site mode produces a low-resolution composite PNG that's hard to interpret.

**Solution**: Generate viewshed boundaries as GeoJSON polygons:
- Use marching squares or contour extraction on the visibility grid
- Render as semi-transparent colored polygons per site
- Show overlap regions in a different color
- Calculate and display coverage statistics (total area, overlap area, unique area per site)

### Priority 4 - Data & Integration (Medium Impact, Higher Effort)

#### 4.1 Clutter / Land-Use Integration
**Problem**: Bare-earth elevation only. A cell tower behind a forest canopy performs very differently than one on open ground.

**Solution**: Integrate land-use classification data:
- Use OpenStreetMap land-use polygons (forest, urban, water, industrial)
- Apply clutter loss factors per terrain type (e.g., +6 dB for light forest, +15 dB for dense urban)
- Display clutter types as a map layer so users understand terrain context
- Weight site scores by terrain accessibility (penalize sites in water/wetland/restricted areas)

**Inspiration**: RadioPlanner integrates OSM + Global Forest Change for clutter. Atoll uses vector/raster 3D building data. CloudRF's SLEIPNIR engine was built specifically for high-resolution clutter modeling.

#### 4.2 Higher-Resolution Elevation Data
**Problem**: Current NED 10m dataset is adequate for rural areas but insufficient for urban canyon effects or fine terrain features.

**Solution**: Support multiple elevation data sources:
- SRTM 30m (global, free) -- current baseline
- NED 10m (US, free) -- current default
- LiDAR DSM (1-2m, where available) -- captures buildings and vegetation
- Allow users to upload custom elevation data for their area of interest

**Inspiration**: Signal Server supports LiDAR data down to 25cm resolution. The UGRC study demonstrated that LiDAR DSMs significantly improve wireless signal modeling accuracy compared to bare-earth DTMs.

#### 4.3 Export & Reporting
**Problem**: Results exist only in the browser session with no way to export, share, or archive.

**Solution**: Add export functionality:
- **CSV**: Site list with all metrics and scores
- **KML/KMZ**: Georeferenced markers + coverage polygons for Google Earth
- **GeoJSON**: For import into GIS tools (QGIS, ArcGIS)
- **PDF Report**: Summary with map screenshot, ranked site table, metric breakdowns
- **API endpoint**: Machine-readable JSON for integration with other tools

**Inspiration**: SPLAT! generates detailed text reports. CloudRF exports KMZ/PNG/GeoJSON. RadioPlanner exports KMZ and interactive web pages.

#### 4.4 Antenna Pattern Support
**Problem**: Assumes omnidirectional radiation pattern. Real deployments use directional/sectoral antennas.

**Solution**: Support antenna pattern files:
- Import `.az` and `.el` pattern files (Signal Server format)
- Apply azimuth and elevation patterns to viewshed calculations
- Visualize the antenna pattern as a polar plot overlay
- Allow mechanical tilt specification (uptilt/downtilt)

**Inspiration**: Signal Server supports full 3D antenna pattern files with mechanical tilt. SPLAT! factors in antenna elevation patterns. This is essential for realistic coverage prediction.

### Priority 5 - Performance & Reliability (Low User-Facing Impact, Important)

#### 5.1 Elevation Data Caching & Tile Stitching
**Problem**: Auto mode makes 121+ individual elevation API requests. Each prominence calculation adds another 121 requests (10x10 ring). Total: potentially 14,000+ HTTP requests per scan.

**Solution**:
- Fetch and cache elevation tiles covering the entire bounding box upfront
- Stitch tiles into a single NumPy array
- Sample from the stitched array for all subsequent calculations (zero HTTP overhead)
- The `tile_manager` already has hints toward this approach but it's not implemented

#### 5.2 Parallel Viewshed Computation
**Problem**: Batch viewshed calculates nodes sequentially in a single Celery task.

**Solution**:
- Split into one Celery task per node
- Use a Celery chord/group to run in parallel across workers
- Aggregate results in a callback task
- This would provide near-linear speedup with worker count

#### 5.3 Automated Test Suite
**Problem**: Zero test coverage for optimization and viewshed code.

**Solution**: Add tests for:
- Prominence calculation with known terrain fixtures
- Fresnel clearance with known path profiles
- Score normalization edge cases (all-zero elevations, single candidate)
- Viewshed LOS correctness against known terrain
- Greedy optimization correctness (marginal gain > individual area sorting)
- API endpoint integration tests

---

## Implementation Recommendations

### Suggested Implementation Order

| Phase | Improvements | Rationale |
|-------|-------------|-----------|
| **Phase 1** | 1.4 (Configurable params), 2.2 (Fix greedy), 5.3 (Tests) | Low effort, high correctness impact, unblocks further work |
| **Phase 2** | 1.1 (Adaptive grid), 1.3 (True LOS viewshed), 3.1 (Terrain profiles) | Core accuracy improvements that bring the tool to parity with SPLAT! |
| **Phase 3** | 1.2 (Better prominence), 2.1 (HAAT + new metrics), 3.2 (Heatmap overlay) | Differentiation features beyond basic tools |
| **Phase 4** | 4.3 (Export), 4.1 (Clutter), 3.3 (Viewshed boundaries) | Professional workflow integration |
| **Phase 5** | 4.2 (High-res elevation), 4.4 (Antenna patterns), 2.3 (Pareto), 5.1-5.2 (Performance) | Advanced features for power users |

### Key Architectural Decisions

1. **True LOS vs. propagation-loss viewshed**: This is the single most impactful change. The current approach of using `path_loss < 128 dB` as a visibility proxy conflates two different questions (can you see it? vs. can you communicate with it?). Separating these enables both accurate viewshed mapping AND accurate coverage prediction.

2. **Shared elevation grid**: Moving from per-point API fetches to a pre-loaded stitched tile array would eliminate the primary performance bottleneck and enable all grid-based algorithms (prominence, viewshed, heatmaps) to run against local memory.

3. **Scoring extensibility**: The current `{elevation, prominence, fresnel}` weight system should be generalized to support N metrics with pluggable scoring functions, making it straightforward to add HAAT, TRI, clutter, etc.

---

## Sources

- [SPLAT! - RF Signal Propagation, Loss, And Terrain Analysis](https://www.qsl.net/kd2bd/splat.html)
- [CloudRF - Online Radio Planning Software](https://cloudrf.com/)
- [Signal Server - Multi-threaded RF Coverage Calculator (GitHub)](https://github.com/Cloud-RF/Signal-Server)
- [Atoll - Radio Frequency Planning & Optimisation (Forsk)](https://www.forsk.com/atoll-overview)
- [RadioPlanner 3.0 - Wireless Planning Software](https://www.wireless-planning.com/radioplanner)
- [CRFS - Terrain Analysis](https://www.crfs.com/blog/terrain-analysis)
- [Viewshed Analysis - Wikipedia](https://en.wikipedia.org/wiki/GIS_Viewshed_Analysis)
- [GIS-Based Cell Tower Site Selection Research](https://www.gyanvihar.org/journals/analysis-and-identification-of-potential-cell-tower-sites-using-gis/)
- [UGRC - Wireless Signals and LiDAR Derived Elevation Models](https://gis.utah.gov/wireless-signals-and-lidar-derived-elevation-models/)
- [SCADACore - RF Line of Sight Tool](https://www.scadacore.com/tools/rf-path/rf-line-of-sight/)
- [SoftWright TAP - Terrain Analysis Package](https://www.softwright.com/)
- [4NEC2 Antenna Modeling](http://ac4m.us/antenna_software.html)
- [EZNEC Antenna Software](https://www.eznec.com/)
- [MVG MiDAS Measurement Software](https://www.mvg-world.com/en/products/antenna-measurement/software/midas-measurement-software)
