# MeshRF — RF Tool Review & Improvement Report

**Date:** 2026-02-07
**Version Reviewed:** v1.10.0

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Assessment](#current-state-assessment)
3. [Competitive Landscape](#competitive-landscape)
4. [Gap Analysis](#gap-analysis)
5. [Improvement Recommendations](#improvement-recommendations)
6. [Priority Roadmap](#priority-roadmap)

---

## 1. Executive Summary

MeshRF is a professional-grade RF propagation and link analysis tool purpose-built for LoRa mesh networks (Meshtastic, Reticulum, Sidewinder). It features a multi-tier architecture (React frontend, FastAPI backend, C++/Wasm native libraries, self-hosted elevation data) and already provides solid link analysis, viewshed computation, and site optimization capabilities.

After reviewing the codebase and researching the broader RF simulation tool ecosystem — including commercial leaders (CloudRF, Infovista Planet, Forsk Atoll, ATDI HTZ), open-source tools (SPLAT!, Signal-Server, NVIDIA Sionna, ns-3), and mesh-specific planners (Meshtastic Site Planner) — this report identifies **25 concrete improvements** organized into six categories, with a prioritized roadmap.

The most impactful improvements fall into three themes:
- **Propagation model fidelity** — fully integrating the already-vendored ITM library and adding ITWOM v3.0
- **Mesh-aware network simulation** — moving beyond individual link analysis to model multi-hop routing behavior
- **Clutter and environment modeling** — incorporating land cover data to account for vegetation and buildings

---

## 2. Current State Assessment

### 2.1 Architecture Strengths

| Area | Assessment |
|---|---|
| **Self-hosted elevation** | Zero external API dependency via OpenTopoData containers. Excellent for offline/air-gapped deployments. |
| **Multi-resolution terrain** | Supports SRTM 30m (global) and NED 10m (US). Tile caching with 30-day TTL in Redis. |
| **Real-time link analysis** | Sub-500ms response with caching. Clean REST API with SSE progress streaming for batch jobs. |
| **Native performance** | C++ ITM library compiled to WebAssembly. Foundation for high-performance client-side computation. |
| **PWA support** | Service worker enables offline use. Responsive layout for desktop and mobile. |
| **Device presets** | 7 device presets (Heltec V3/V4, RAK 4631, Station G2, etc.), 6 antenna types, 3 radio configs. |
| **Visualization** | Leaflet map with Deck.GL 3D overlays, terrain profile charts with Fresnel zones. |

### 2.2 Implemented Propagation Models

| Model | Location | Status |
|---|---|---|
| Free Space Path Loss (FSPL) | `rf_physics.py:143` | Functional |
| Okumura-Hata (urban/suburban/rural) | `rf_physics.py:87-127` | Functional, limited to 150–1500 MHz |
| Bullington Knife-Edge Diffraction | `rf_physics.py:25-85` | Functional, used as ITM fallback |
| ITM / Longley-Rice | `libmeshrf/meshrf_itm.cpp` + `vendor/itm/` | Vendored but not fully integrated into backend |

### 2.3 Known Limitations & Technical Debt

These were identified through code review and explicit TODOs/comments in the source:

| Issue | Location | Impact |
|---|---|---|
| **Python backend does not call native ITM** — uses Bullington as a fallback approximation | `rf_physics.py:150-152` | Significant accuracy loss for terrain-obstructed paths |
| **Viewshed uses simplified Hata + 128 dB threshold** instead of the ITM model | `core/algorithms.py` | Coarse coverage prediction |
| **100m viewshed resolution** (50×50 grid for 5 km radius) | `core/algorithms.py:56` | Misses terrain features between sample points |
| **Greedy optimizer uses area as proxy** — no true union overlap | `tasks/viewshed.py:126` | Suboptimal multi-site placement |
| **Scoring normalization is arbitrary** — mixed units without proper scaling | `optimization_service.py:112-125` | Score comparisons may be misleading |
| **Master grid capped at 1024×1024** | `tasks/viewshed.py:60-61` | OOM risk and resolution ceiling for large areas |
| **ITM variability mode hardcoded** to `mdvar=12` | `meshrf_itm.cpp:38` | Not configurable for different analysis scenarios |
| **Hata model range not error-checked** beyond 150–1500 MHz | `rf_physics.py` | Silent incorrect results outside range |
| **NSGA-II optimization stub** — not implemented | `tasks/optimize.py` | Multi-objective optimization unavailable |
| **No clutter/land cover modeling** | Entire codebase | Vegetation and buildings not accounted for |
| **No antenna radiation patterns** | Entire codebase | All antennas treated as omnidirectional or gain-only |
| **No interference analysis** | Entire codebase | Cannot model co-channel or adjacent-channel interference |

---

## 3. Competitive Landscape

### 3.1 Commercial Tools

| Tool | Relevance to MeshRF | Key Differentiators |
|---|---|---|
| **CloudRF** | Most directly comparable. Cloud SaaS with REST API, GPU-accelerated SLEIPNIR engine, 1m LiDAR support, 3D volumetric propagation, multisite/interference APIs. Supports LoRa and mesh explicitly. | GPU acceleration (20× faster), 1m LiDAR resolution, 3D volumetric output, interference API, clutter modeling with 2m building footprints |
| **Infovista Planet** | Enterprise 5G/cellular planning. AI-powered AIM propagation model pre-calibrated on crowdsourced data. | AI/ML propagation model, crowdsource calibration |
| **Forsk Atoll** | Enterprise cellular planning. 5G massive MIMO/beamforming, scripting API. | Antenna pattern modeling, macro scripting |
| **ATDI HTZ** | Wide frequency range (10 kHz – 350 GHz). Intermodulation analysis. | HF/VHF support, interference analysis |
| **RadioPlanner 3.0** | Budget-friendly. P25/TETRA/DMR/LoRaWAN. Uses Longley-Rice and ITU-R P.1546-6. OSM integration for clutter. | LoRa support, affordable, GIS integration |

### 3.2 Open-Source Tools

| Tool | Relevance to MeshRF | Key Differentiators |
|---|---|---|
| **Signal-Server** (W3AXL fork) | Closest open-source analog. 12+ propagation models, LiDAR support, multi-threaded. C/C++, CLI-based. | ITWOM v3.0, 12 propagation models, LiDAR at 1m, mature codebase |
| **SPLAT!** | Original Longley-Rice CLI tool. KML export, terrain profiles. | Mature ITM implementation, reference standard |
| **NVIDIA Sionna** | GPU-accelerated differentiable ray tracer. 100× faster than CPU. Apache-2.0. | Ray tracing, differentiable optimization, GPU acceleration |
| **Meshtastic Site Planner** | Purpose-built for Meshtastic LoRa mesh. Terrain-aware, multi-radio overlay. | Direct competitor in the mesh planning niche |
| **ns-3** | Full network simulator with 802.11s mesh, chainable propagation models, spectrum-aware PHY. | Protocol-level mesh simulation, validated |
| **scikit-rf** | RF/microwave network analysis, S-parameter manipulation. Python. | Calibration, component-level analysis |

### 3.3 Key Competitive Insights

1. **MeshRF occupies a unique niche** — self-hosted, web-based, purpose-built for LoRa mesh, with zero external dependencies. No other tool combines all of these.
2. **Propagation model depth is the primary gap** — Signal-Server has 12+ models; MeshRF effectively has 3 (FSPL, Hata, Bullington), with ITM vendored but not integrated.
3. **CloudRF sets the commercial benchmark** — GPU acceleration, clutter modeling, LiDAR support, 3D visualization, interference analysis, and a mature REST API.
4. **Mesh-aware simulation is underserved industry-wide** — no tool truly integrates terrain-aware RF propagation with mesh routing protocol behavior. This is MeshRF's biggest opportunity.

---

## 4. Gap Analysis

### Feature Comparison Matrix

| Feature | MeshRF | CloudRF | Signal-Server | Meshtastic Planner | ns-3 |
|---|:---:|:---:|:---:|:---:|:---:|
| Web-based UI | Yes | Yes | No (CLI) | Yes | No |
| Self-hosted | Yes | No (SaaS) | Yes | No | Yes |
| ITM / Longley-Rice | Partial | Yes | Yes | No | No |
| ITWOM v3.0 | No | Yes | Yes | No | No |
| Hata / COST-Hata | Yes | Yes | Yes | No | Yes |
| Knife-edge diffraction | Yes | Yes | Yes | No | No |
| Clutter / land cover | **No** | Yes | Yes | No | Yes |
| Antenna patterns | **No** | Yes | Yes | No | Yes |
| LiDAR support (1m) | **No** | Yes | Yes | No | No |
| GPU acceleration | **No** | Yes | No | No | No |
| Interference analysis | **No** | Yes | No | No | Yes |
| Mesh routing simulation | **No** | No | No | No | Yes |
| Multi-site batch | Yes | Yes | No | Yes | Yes |
| 3D visualization | Partial | Yes | No | No | No |
| API / automation | Yes | Yes | Yes | No | Yes |
| Offline / PWA | Yes | No | N/A | No | N/A |
| Link budget analysis | Yes | Yes | Yes | Yes | Yes |
| Fresnel zone analysis | Yes | Yes | Yes | Yes | No |
| Export (KML/CSV) | CSV only | KML/KMZ/GeoTIFF | KML/PPM | No | N/A |
| Device/radio presets | Yes | No | No | Yes | No |

---

## 5. Improvement Recommendations

### Category A: Propagation Model Fidelity

#### A1. Complete ITM Integration (Backend ↔ Native Library)
**Priority: Critical**

The ITM library is already vendored in `libmeshrf/vendor/itm/` and compiled to Wasm, but the Python backend (`rf_physics.py`) uses Bullington diffraction as a fallback instead of calling the actual ITM code. This is the single highest-impact improvement available.

**Implementation approach:**
- Create Python bindings for the ITM C++ library via `ctypes` or `pybind11` (rather than going through Wasm on the server side)
- Replace the Bullington fallback in `calculate_path_loss()` with a direct ITM P2P call
- Expose ITM configuration parameters (time/location/situation variability) through the API
- The `mdvar=12` hardcoding in `meshrf_itm.cpp:38` should become a configurable parameter

**Reference:** Signal-Server's ITM integration in `models/itm.cc` is a well-tested reference implementation.

#### A2. Add ITWOM v3.0 Model
**Priority: High**

ITWOM v3.0 is a hybrid of Longley-Rice methodology with ITU-R P.1546 empirical data and physical optics (Snell's Law, Beer's Law). It is the first truly point-to-point, terrain-specific international model and produces more accurate results than ITM alone, especially for mixed inland/maritime paths.

**Implementation approach:**
- Port from Signal-Server's `models/itwom3.0.cc` (same open-source lineage as the vendored ITM)
- Add as a selectable model alongside ITM, Hata, and FSPL
- Uses same terrain profile input format as ITM, so existing elevation pipeline works unchanged

#### A3. Add ITU-R P.1812 Model
**Priority: Medium**

ITU-R P.1812 is the modern ITU recommendation for point-to-area terrestrial propagation (30 MHz – 6 GHz) and handles mixed-path scenarios (land, sea, coastal) better than Hata. It would complement ITM/ITWOM for regulatory planning use cases.

#### A4. Hata Model Frequency Validation
**Priority: Low**

The Hata model implementation in `rf_physics.py` supports 150–1500 MHz but does not error-check inputs outside this range. Add explicit validation and either return an error or automatically select an appropriate model.

---

### Category B: Environment & Terrain Modeling

#### B1. Clutter / Land Cover Integration
**Priority: High**

No propagation model can produce accurate results without accounting for surface obstacles. MeshRF currently models bare terrain only — vegetation, buildings, and other clutter are invisible.

**Implementation approach:**
- Integrate a clutter dataset (Copernicus Global Land Cover at 10m, or OpenStreetMap building footprints)
- Add per-pixel clutter height offset to terrain profiles before propagation calculation
- Support configurable clutter attenuation profiles (e.g., deciduous forest = 0.2 dB/m at 915 MHz, dense urban = 1.5 dB/m)
- CloudRF documents their approach well: assign height and attenuation per land cover class, layer atop DEM

**Data sources:**
- ESA WorldCover (10m global land cover, free): https://esa-worldcover.org/
- OpenStreetMap building footprints (free)
- NLCD (30m US land cover, free)

#### B2. Higher-Resolution Elevation Support
**Priority: Medium**

MeshRF supports SRTM 30m and NED 10m. For site-specific planning, 1–3m resolution from USGS 3DEP or LiDAR would provide substantially better accuracy, especially for Fresnel zone clearance analysis.

**Implementation approach:**
- Allow users to upload custom GeoTIFF elevation data
- Support USGS 3DEP 1m/3m tiles via the existing OpenTopoData container (it already supports custom datasets)
- LiDAR DSM data includes buildings and tree canopy, providing implicit clutter modeling

#### B3. Configurable Earth Curvature K-Factor
**Priority: Low**

Currently hardcoded to 1.333 (standard refractivity). Allow users to adjust for different atmospheric conditions (e.g., k=1.0 for worst-case, k=2.0 for super-refractive conditions). This is already supported by SPLAT! and Signal-Server.

---

### Category C: Antenna & RF Chain Modeling

#### C1. Antenna Radiation Pattern Support
**Priority: High**

MeshRF treats all antennas as simple gain values. Real antennas have directional patterns (azimuth and elevation) that dramatically affect coverage predictions. A Yagi antenna at 12 dBi focused in one direction produces a completely different coverage footprint than an omnidirectional at 2 dBi.

**Implementation approach:**
- Import industry-standard antenna pattern files (`.ant`, `.msi`, `.pla` formats — all are simple text-based azimuth/elevation gain tables)
- Apply pattern gain adjustment in the link budget calculation based on bearing from TX to RX
- For viewshed/coverage calculations, apply per-radial azimuth gain
- Include a library of common LoRa antenna patterns (stubby, dipole, collinear, Yagi)

**Reference:** Signal-Server's antenna pattern handling in `antenna.cc` is a clean implementation.

#### C2. Complete Link Budget with Receiver Sensitivity
**Priority: Medium**

MeshRF calculates path loss but doesn't produce a complete link budget with fade margin. A full link budget includes:
- TX power (dBm) → TX cable loss → TX antenna gain → propagation loss → RX antenna gain → RX cable loss → received power
- Comparison against receiver sensitivity for the configured spreading factor/bandwidth → fade margin (dB)
- This is essential for mesh planning: a node with 10 dB fade margin will maintain links under fading; one with 2 dB won't.

The device presets already contain some of this data — it just needs to be wired through the calculation pipeline.

#### C3. Cable and Connector Loss Modeling
**Priority: Low**

Add configurable cable type and length with per-frequency loss characteristics (e.g., LMR-400 = 0.068 dB/ft at 915 MHz). The Meshtastic Site Planner already models cable loss — MeshRF should match this.

---

### Category D: Mesh Network Intelligence

#### D1. Multi-Hop Path Analysis
**Priority: High**

MeshRF's most significant strategic differentiator opportunity. Currently, link analysis is point-to-point only. For mesh networks, what matters is the end-to-end path across multiple hops.

**Implementation approach:**
- Given a set of nodes, compute pairwise link quality (path loss, fade margin, SNR)
- Build a connectivity graph with edge weights derived from link quality
- Apply shortest-path (Dijkstra) or mesh routing heuristics (e.g., Meshtastic uses flooding; Reticulum uses source routing)
- Display multi-hop routes on the map with per-hop link quality indicators
- Identify network bottlenecks (single-hop failures that partition the network)

This bridges the gap between RF propagation tools (which model individual links) and network simulators like ns-3 (which model protocols). No current open-source tool does this well for LoRa mesh.

#### D2. Network Connectivity Analysis
**Priority: Medium**

Extend multi-hop analysis to answer network-level questions:
- **Coverage gaps:** Given current node placement, where are the areas without any mesh connectivity?
- **Redundancy analysis:** Which nodes are single points of failure? If node X goes down, which other nodes lose connectivity?
- **Capacity estimation:** Given LoRa duty cycle limits and spreading factor, what is the theoretical throughput per hop and end-to-end?

#### D3. NSGA-II Multi-Objective Optimization
**Priority: Medium**

The stub in `tasks/optimize.py` should be implemented. Multi-objective optimization can simultaneously optimize for:
- Coverage area maximization
- Number of nodes minimization (cost)
- Minimum fade margin maximization (reliability)
- Network redundancy (min 2-connected graph)

Python libraries like `pymoo` provide ready-to-use NSGA-II implementations.

#### D4. Interference Modeling
**Priority: Low**

For dense mesh deployments, co-channel interference becomes relevant. Model:
- C/I (carrier-to-interference) ratio for same-frequency nodes
- LoRa's capture effect (strongest signal captured if > 6 dB above interferers)
- Adjacent-channel rejection based on LoRa bandwidth settings

CloudRF's interference API is a good reference for the API design.

---

### Category E: Visualization & Export

#### E1. KML/KMZ Export
**Priority: Medium**

Currently MeshRF exports CSV only. KML/KMZ export enables visualization in Google Earth, which many RF professionals use for client presentations and field work. Signal-Server and SPLAT! both support KML output.

**Implementation approach:**
- Generate KML with coverage polygons (colored by signal strength), node placemarks, and link paths
- Use Python's `simplekml` library or raw XML generation
- Include terrain profile as a ground overlay

#### E2. GeoTIFF Coverage Export
**Priority: Medium**

GeoTIFF export enables integration with GIS tools (QGIS, ArcGIS). Coverage predictions can be loaded as raster layers for overlay with other geographic data (land use, population density, infrastructure).

#### E3. Enhanced 3D Visualization
**Priority: Low**

MeshRF has Deck.GL but could expand 3D capabilities:
- 3D terrain mesh with coverage overlay draped on surface
- 3D volumetric signal propagation (altitude-dependent, useful for drone/aviation mesh)
- Animated signal path visualization showing multipath reflections
- CloudRF outputs 3D meshes viewable in browsers and AR — aspirational target

#### E4. Terrain Profile Improvements
**Priority: Low**

- Display Earth bulge correction on the profile chart
- Show multiple Fresnel zones (F1, F2, F3) not just F1
- Add link budget annotations (TX power, RX sensitivity, margin) directly on the profile
- Show clutter heights on profile once B1 is implemented

---

### Category F: Performance & Infrastructure

#### F1. Increase Viewshed Resolution
**Priority: Medium**

The current 100m resolution (50×50 grid for 5 km radius) misses significant terrain features. Increasing to 30m resolution (167×167 grid = ~28K points) would match the SRTM data resolution and improve accuracy substantially.

**Implementation approach:**
- Use the Wasm ITM library for client-side viewshed calculation (already compiled)
- Move viewshed heavy lifting to WebAssembly running in a Web Worker
- This eliminates the 1024×1024 master grid cap and offloads computation from the server

#### F2. GPU-Accelerated Propagation (Future)
**Priority: Low**

NVIDIA Sionna demonstrates 100× speedups for ray tracing via GPU. CloudRF's GPU engine achieves 20× speedup. For MeshRF, GPU acceleration would enable:
- Real-time coverage recalculation as nodes are dragged on the map
- Higher-resolution coverage at larger radii
- Batch viewshed for hundreds of nodes in seconds

This requires either WebGPU compute shaders (emerging browser API) or server-side GPU with CUDA. Longer-term investment.

#### F3. Progressive Resolution Rendering
**Priority: Medium**

Instead of computing at a single fixed resolution, compute a coarse grid first (fast preview) then progressively refine to full resolution. This gives users immediate feedback while final results compute.

**Implementation approach:**
- Level 1: 500m grid → ~1 second → display immediately
- Level 2: 100m grid → ~5 seconds → replace L1
- Level 3: 30m grid → ~30 seconds → replace L2
- Use SSE streaming (already implemented) to push each level as it completes

---

## 6. Priority Roadmap

### Tier 1 — Critical (Highest Impact, Foundation)

| # | Improvement | Category | Rationale |
|---|---|---|---|
| A1 | Complete ITM integration | Propagation | Already vendored; biggest accuracy improvement with least new code |
| B1 | Clutter / land cover | Environment | Without clutter, all propagation models over-predict coverage |
| C1 | Antenna radiation patterns | RF chain | Directional antennas fundamentally change coverage footprint |

### Tier 2 — High (Strategic Differentiators)

| # | Improvement | Category | Rationale |
|---|---|---|---|
| D1 | Multi-hop path analysis | Mesh | Unique differentiator; no other open-source tool does this well |
| A2 | ITWOM v3.0 model | Propagation | Better than ITM for many scenarios; available from Signal-Server |
| C2 | Complete link budget | RF chain | Fade margin is critical for mesh reliability prediction |
| F1 | Viewshed resolution increase | Performance | 100m is too coarse for meaningful planning |

### Tier 3 — Medium (Competitive Parity)

| # | Improvement | Category | Rationale |
|---|---|---|---|
| D2 | Network connectivity analysis | Mesh | Natural extension of D1 |
| D3 | NSGA-II optimization | Mesh | Stub already exists; pymoo makes implementation tractable |
| E1 | KML/KMZ export | Export | Industry standard; expected by RF professionals |
| E2 | GeoTIFF export | Export | GIS integration is a baseline expectation |
| F3 | Progressive resolution | Performance | Better UX for longer computations |
| A3 | ITU-R P.1812 model | Propagation | Regulatory planning use cases |
| B2 | Higher-res elevation | Environment | 1–3m data available from USGS 3DEP |

### Tier 4 — Low (Future Enhancements)

| # | Improvement | Category | Rationale |
|---|---|---|---|
| D4 | Interference modeling | Mesh | Relevant only for dense deployments |
| A4 | Hata frequency validation | Propagation | Minor correctness fix |
| B3 | Configurable K-factor | Environment | Edge case for atmospheric analysis |
| C3 | Cable/connector loss | RF chain | Small accuracy improvement |
| E3 | Enhanced 3D visualization | Visualization | Nice-to-have, high development cost |
| E4 | Terrain profile improvements | Visualization | Polish items |
| F2 | GPU acceleration | Performance | Future technology bet (WebGPU) |

---

## Appendix: Reference Tools & Sources

### Commercial
- [CloudRF](https://cloudrf.com/) — Cloud SaaS RF planning with GPU acceleration
- [Infovista Planet](https://www.infovista.com/products/planet/rf-planning-software) — AI-powered RF planning
- [Forsk Atoll](https://www.forsk.com/atoll-overview) — Enterprise cellular planning
- [ATDI HTZ Communications](https://atdi.com/products-and-solutions/radio-network-planning/) — Wide-range RF planning
- [RadioPlanner 3.0](https://www.wireless-planning.com/radioplanner) — Budget RF planning with LoRaWAN support

### Open-Source
- [Signal-Server (W3AXL fork)](https://github.com/W3AXL/Signal-Server) — Multi-model CLI propagation engine
- [SPLAT!](https://www.qsl.net/kd2bd/splat.html) — Original Longley-Rice CLI tool
- [NVIDIA Sionna](https://developer.nvidia.com/sionna) — GPU-accelerated differentiable ray tracer
- [ns-3](https://www.nsnam.org/) — Network simulator with mesh and propagation models
- [Meshtastic Site Planner](https://meshtastic.org/blog/meshtastic-site-planner-introduction/) — LoRa mesh planning tool
- [scikit-rf](https://github.com/scikit-rf) — Python RF/microwave network analysis
- [rf-signals](https://github.com/thebracket/rf-signals) — Rust port of Signal-Server algorithms
- [Radio Gyms](https://github.com/tamsri/radio-gyms) — AI environments for RF training
