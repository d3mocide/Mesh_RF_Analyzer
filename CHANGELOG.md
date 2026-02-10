# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.14.0] - 2026-02-10

### Added

- **Inter-Node Link Matrix**: The Multi-Site scan now runs pairwise RF link analysis between every selected site after the viewshed completes. Each pair reports:
  - **Path Loss (dB)** — Bullington terrain-diffraction model using the same RF parameters as the rest of the tool.
  - **Fresnel Clearance %** — ratio of clearance to first Fresnel zone at the worst obstruction point.
  - **Status** — `Viable` (≥60% Fresnel), `Degraded` (0–60%), or `Blocked` (<0%).
  - **Distance** — haversine distance between the two sites (metric/imperial).
- **Marginal Coverage Metric**: Each site card now shows how much *unique* area it contributes to the network — area not already covered by any other selected site. Low unique-coverage % flags redundant placements.
- **Connectivity Score**: Each site now displays how many of the other selected sites it can reach (viable + degraded links), giving an immediate indicator of network centrality.
- **Combined Coverage Total**: The results panel header now shows the total union area covered by all selected sites combined.
- **Mesh Topology Tab**: New "Topology" tab in the results panel features:
  - **Mesh Connectivity Score** — percentage of all node pairs reachable (direct or via relay).
  - Direct link breakdown by status (Viable / Degraded / Blocked).
  - **Multi-hop relay detection** — BFS pathfinding identifies pairs that cannot link directly but remain reachable through intermediate nodes, with hop counts.
  - All-pairs path table showing the shortest viable route between every combination of sites.
- **Link Lines on Map**: Colored polylines are now drawn between every site pair when results are displayed.
  - Solid cyan = viable direct link.
  - Dashed gold = degraded link (partial Fresnel obstruction).
  - Dashed red = blocked link (terrain obstruction).
- **Tab-aware Help**: The Help overlay now shows context-specific field definitions for whichever tab is active (Sites, Links, or Topology).
- **Node names in results**: Site names from CSV imports or manual entry are now preserved through the scan and displayed in all tabs.

### Changed

- **Results Panel redesigned** with three tabs replacing the single flat card list:
  - **Sites** — individual site metrics (elevation, total coverage, unique coverage %, link count).
  - **Links** — sorted link matrix (viable links first, blocked last).
  - **Topology** — mesh health overview and full path table.
- **Scan endpoint** now forwards frequency, rx height, K-factor, and clutter height into the Celery task so pairwise link analysis uses the correct RF parameters.
- **Panel width** increased to 380px to accommodate the new four-column metrics grid.

## [1.13.0] - 2026-02-09

### Added

- **Coverage Analysis Tool**: Replaced the legacy "Site Finder" with a powerful **Radial Scan** engine.
  - **Click-to-Scan**: Set a central Transmitter (TX) and drag to define a scan radius (1km - 20km).
  - **Heatmap Visualization**: Color-coded overlay showing signal quality across the entire scanned area.
  - **Best Signal Markers**: Top candidates are automatically identified and ranked.
- **Terrain Profile Modal**: Click any "Best Signal" marker to view an interactive cross-section of the terrain, including Fresnel zones and line-of-sight clearance.
- **Export Options**: Added dedicated buttons to export analysis results to **CSV** and **KML** (Google Earth).
- **Advanced Controls**: Integrated Radius Slider, Refraction (K-Factor), and Clutter Height adjustments directly into the map interface.

### Changed

- **Terminology Overhaul**: Renamed "Elevation Scan" to "**Coverage Analysis**" across the entire application to better reflect its function.
- **Metric Update**: Changed "Best Signals" to "**Best Links**" in results to emphasize connectivity.
- **Visual Feedback**: Added a dashed circle overlay during radius adjustment for precise area selection.

### Fixed

- **Map Scroll Propagation**: Resolved an issue where scrolling inside the Results Panel or Profile Modal would zoom the map.
- **Popup Clarity**: Standardized popup text to use the new terminology.

## [1.12.1] - 2026-02-09

### Added

- **Dynamic Progress Sliders**: All range inputs now feature a high-visibility neon fill that tracks with the thumb.
- **Synchronized Tool Colors**: Site selection weights are now color-coded to match their corresponding analysis tools for better visual intuition:
  - **Elevation & Antenna Height**: Purple (#a855f7) - Matches Viewshed.
  - **Prominence**: Orange (#ff6b00) - Matches RF Simulator.
  - **Fresnel**: Neon Green (#00ff41).

### Changed

- **Refined Slider Glow**: Tuned down the box-shadow intensity on range sliders for a cleaner, more professional "Cyberpunk" aesthetic.
- **Theme Compliance**: Updated secondary color to Neon Green to maintain adherence to the project's color standards.

### Fixed

- **Slider Key Mapping**: Resolved a case-sensitivity bug that prevented specialized colors from applying to some optimization sliders.
- **CSS Style Conflicts**: Removed redundant inline slider styles across multiple components to rely on unified global styling.

## [1.12.0] - 2026-02-08

### Added

- **Unified WASM Link Analysis**: Point-to-point link analysis now defaults to the high-precision **Longley-Rice ITM engine** via WebAssembly, ensuring perfect parity with coverage map results.
- **Full Environmental Physics**: Both coverage maps and link analyses are now fully ground-aware.
  - Added support for **Sea Water, Fresh Water, City/Industrial, Farmland**, and various soil types.
  - Integrated **Climate Zone** selection into the sidebar for global simulation accuracy.
- **ITM Model Unification**: Set `itm_wasm` as the standard default propagation model across the entire toolset.

### Changed

- **Propagation Model Guide**: Updated descriptions to clearly distinguish between **Statistical (Hata)**, **Terrain-Aware (Bullington)**, and **Physical (ITM)** models.
- **Engine Aliasing**: Updated the Python backend to support `itm_wasm` aliases, providing high-fidelity terrain fallback when server-side processing is requested.
- **Ground Type Expansion**: `RFContext` now exports a comprehensive set of dielectric constant and conductivity value pairs for all supported ground types.

### Fixed

- **WASM Parameter Sync**: Resolved a bug where Link Analysis would use hardcoded "Average Ground" values even when specialized ground types were selected in the sidebar.
- **Model Default Inconsistency**: Ensured all tools (Site Finder, Multi-Site, Coverage) default to the ITM (WASM) engine for a "Physics First" user experience.

## [1.11.0] - 2026-02-08

### Added

- **Asymmetric Hardware Config**: You can now configure independent antennas, heights, and power settings for **Node A** and **Node B**. Global mode remains available for simultaneous updates.
- **Cable Loss Integration**: Added a dynamic cable loss calculator to the sidebar.
  - Supports presets for **LMR-400, RG-58, LMR-240, and RG-174**.
  - Calculates loss per meter/foot for accurate Estimated ERP.
- **ITM Environment Controls**: Exposed advanced physics parameters for terrain analysis:
  - **Ground Type**: Average, Poor, Good, Fresh Water, Sea Water (Dielectric & Conductivity).
  - **Climate Zones**: Equatorial, Continental, Desert, Maritime, etc.
  - Full integration with the WASM propagation engine.

### Changed

- **Sidebar Architecture Overhaul**:
  - **Hardware Config**: Renamed and reorganized for better parameter flow (Antenna -> Cable -> Power -> ERP).
  - **LoRa Band**: Renamed from "Radio Config" and set to **minimized by default** with the Radio Preset always visible in the header.
  - **Environment Section**: Moved Environment (ITM) controls to the main sidebar level for easier access.
  - **Physics Naming**: Renamed the legacy Python terrain model to **"Bullington (Diffraction)"** to differentiate it from high-fidelity ITM models.
- **UI Spacing & Ergonomics**:
  - Eliminated "dead space" between all sidebar sections.
  - Fine-tuned padding for collapsible sections (`4px` when closed) for a tighter layout.
  - Added visual "breathing room" to the Estimated ERP display.
- **Model Information**:
  - Updated tooltips in Link Analysis to accurately describe ITM vs Hata capabilities.

### Fixed

- **Sidebar Scroll Reset**: Fixed a critical bug where selecting a Radio Preset would scroll the sidebar to the top.
- **Hata Warning Layout**: Fixed overlap issues when warnings appear in the Link Analysis panel.

## [1.10.0] - 2026-02-07

### Added

- **CSV Bulk Import**: Added ability to import lists of sites via CSV templates in the Multi-Site tool (`NodeManager`).
- **Global Custom Scrollbar**: Unified the application with a 4px neon-cyan cyberpunk scrollbar consistent across all panels.
- **Propagation Model Guide**: Added an interactive, scrollable guide in the Link Analysis tool with detailed descriptions of FSPL, Hata, and ITM models, including a summarized "Analysis Note" for quick reference.
- **Default Analysis Model**: Set **ITM (Longley-Rice)** as the default propagation model for higher accuracy terrain analysis by default.

### Changed

- **Link Analysis UI/UX Overhaul**:
  - Implemented full **Glassmorphism** (`rgba(10, 10, 15, 0.98)` with `16px` blur) and standardized neon borders (`1px solid #00f2ff33`).
  - Redesigned the **Terrain & Path Profile** chart with improved landscape resolution and a 700px default panel height.
  - Optimized stats grid with high-resolution indicators, uppercase labels, and neon highlights.
- **UI Ergonomics**:
  - Added specialized padding to sidebar and node lists for improved scrollbar visibility and "breathing room".
  - Symmetric horizontal padding (24px) applied to panels to eliminate content clipping.

### Fixed

- **Label Clipping**: Fixed issues where **RX Node Elevation** and **Legend** labels were cut off in the Link Profile chart.
- **Text Spacing**: Resolved "squished" text issues in the model selection row by optimizing flex-basis and text-overflow.
- **Layout Efficiency**: Recalibrated offsets to eliminate "dead space" below charts, restoring vertical balance to the analysis suite.

## [1.9.1] - 2026-02-06

### Added

- **Unit Conversion**: `SiteAnalysisResultsPanel` and Map Popups now support **Metric (m/km²)** and **Imperial (ft/mi²)** switching based on user settings.
- **Themed UI**:
  - **Neumorphic/Dark Popups**: Leaflet popups now match the application's "Deep Space Dark" theme (`#0a0a0f`) with neon cyan borders.
  - **Cyan Markers**: Optimization "ghost nodes" and "Ideal Spots" are now Solid Neon Cyan (`#00f2ff`) for better visibility against dark maps.

### Changed

- **Code Cleanup**: Removed legacy `ViewshedLayer.js` and unused backend imports (`scipy` filters, `greedy_max_coverage`).
- **Site Analysis Tool**: Significant refactor of the **Site Finder Panel** (formerly `SiteSelectionSettings`):
  - **Grid Layout**: Optimized slider controls for mobile touch targets.
  - **Responsive Width**: Panel now expands to 380px for better readability.
  - **Architecture**: Decoupled state management from map events to prevent ghost clicks.
  - **Multi-Site Manager**: Added dedicated "Multi-Site" tab for managing candidate node lists manualy.
- **Developer Experience**:
  - Updated `GEMINI.md` with strict **Docker-First** execution rules and a new **UI Style Guide**.
  - Silenced excessive console logging in `Worker.ts` and `MapContainer.jsx`.

## [1.9.0] - 2026-02-06

### Added

- **Full PWA Native Experience**:
  - Implemented `OfflineIndicator` to notify users when network connectivity is lost.
  - Added `UpdatePrompt` for intelligent, user-controlled application updates.
  - New high-resolution `apple-touch-icon.png` for iOS Home Screen parity.
- **iOS "Pro Max" Optimizations**:
  - Full support for **safe-area-insets** (notch/pill aware) across all overlays and toolbars.
  - Adopted `100dvh` (Dynamic Viewport Height) to prevent layout shifts on mobile Safari.
  - Native gesture support: `touch-action: manipulation` for zero-latency taps and overscroll prevention.
- **Responsive Site Finder**: Clean, grid-based redesign of the Site Selection Weights panel for mobile touch targets.
- **UI Architecture Isolation**: Decoupled interactive panels (`SiteAnalysisPanel`, `LinkAnalysisPanel`) from the `MapContainer` event loop to eliminate click-through bubbling.

### Fixed

- **Map Click-through Bug**: Resolved issue where clicking UI controls (e.g., Greedy Optimization checkbox) would trigger map interactions (ghost node placement).
- **State Cleanup Logic**: Enhanced `resetToolState` to properly flush Site Analysis and Optimization store states when switching between tools.
- **Physics Engine Handshake**: Resolved `SyntaxError` caused by legacy frontend path loss imports in `LinkLayer.jsx`. Integrated backend `calculateLink` for all statistical models.
- **PWA Lifecycle Crash**: Fixed a critical destructuring error in the `useRegisterSW` hook within `UpdatePrompt`.

## [1.8.0] - 2026-02-05

### Added

- **ITM (Longley-Rice) Propagation Model**: Added the "Physics Purist" Tier-2 propagation modeling capability. Currently implemented via high-fidelity Bullington Diffraction (Knife-Edge) in the Python backend.
- **Model Selector UI**: Added a dropdown in the Link Analysis Panel to switch between "Free Space", "Okumura-Hata", and "Longley-Rice".
- **Backend Dispatcher**: `rf_physics.py` now includes a generic `calculate_path_loss` dispatcher supporting multiple models.
- **Python-Base Hata**: Ported the empirical Okumura-Hata model from client-side JS to server-side Python for consistency.
- **Improved Chart Visualization**: Link Profile Chart now visualizes backend-derived Fresnel zones and Earth Bulge geometry.

### Changed

- **Default Model**: The simulator now defaults to "Longley-Rice (Terrain)" for maximum accuracy out of the box.
- **Link Analysis Panel Layout**:
  - Increased default width (380px) and height (620px).
  - Refactored controls into a clean 2-row layout.
  - Improved responsive resizing behavior.
- **Physics Architecture**: Shifted the "Source of Truth" for RF math from the Frontend (JS/Wasm) to the Backend (Python/NumPy). The frontend is now a dumb display terminal for physics calculated on the server.
- **Performance**: Link calculations are now asynchronous, preventing UI freezes during complex terrain analysis.

### Removed

- **Client-Side RF Math**: Removed legacy `calculateOkumuraHata` and `calculateBullingtonDiffraction` (logic logic only) from `rfMath.js`. Visual obstacle loss calculation remains for tooltip usage.
- **Wasm Dependence**: Reduced strict dependency on Wasm modules for basic link analysis (Wasm still used for large-scale coverage maps).

## [1.7.6] - 2026-02-04

### Fixed

- Fixed UI bugs in map controls.
- Improved Docker container stability.
