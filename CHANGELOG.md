# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.10.0] - 2026-02-07

### Added

- **CSV Bulk Import**: Added ability to import lists of sites via CSV templates in the Multi-Site tool (`NodeManager`).
- **Global Custom Scrollbar**: Unified the application with a 4px neon-cyan cyberpunk scrollbar consistent across all panels.
- **Propagation Model Guide**: Added an interactive guide in the Link Analysis tool with detailed descriptions of FSPL, Hata, and ITM models.

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
