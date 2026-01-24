# Release Notes

## v1.7.5 - UI Polish

Quick follow-up patch to improve the usability of the restored guidance system.

### 🎨 UI Improvements

- **Tooltip Positioning**: Moved all context-aware help banners to the **bottom-center** of the screen. This prevents them from obscuring the top toolbar and ensures a consistent experience across desktop and mobile.

---

## v1.7.4 - Bug Fix: Tooltip Restoration

This patch restores the Context-Aware Guidance tooltips ("Green/Purple" banners) which were inadvertently hidden during the refactoring process. The UI is now fully functional with all help systems active.

### 🐛 Bug Fixes

- **Missing Overlays**: Fixed an issue where `GuidanceOverlays` and `MapToolbar` were not rendering in the map view.
- **Legacy Code Cleanup**: Removed residual inline code from `MapContainer.jsx` to prevent future conflicts.

---

## v1.7.3 - Codebase Health & UI Standardization

This "Sprint 1" release focuses on establishing a rock-solid foundation for future growth. It includes a major architectural refactor of the core map component, the introduction of Geolocation features, and a comprehensive audit of all guidance and visualization overlays to ensure they are consistent, accurate, and user-friendly.

### 🏗️ Architecture & Refactoring

- **Decomposed MapMonolith**: The 1300-line `MapContainer.jsx` has been successfully refactored into modular sub-components:
  - `LocateControl`: Dedicated geolocation logic.
  - `MapToolbar`: Independent scrollable toolbar UI.
  - `GuidanceOverlays`: Standardized help banner system.
  - `CoverageClickHandler`: Separated event logic for RF tools.
- **Result**: Reduced main file size by **~40%**, significantly improving readability and maintainability.

### 📍 Geolocation

- **"Locate Me" Feature**: Added a new control button that uses the browser's Geolocation API to instantly fly the map to the user's current physical location.
- **Smart Feedback**: Includes loading states and error handling for permission denials.

### 🎨 UI/UX Standardization

- **Viewshed Overlay Fix**: Corrected the WebGL shader to display **Green (LOS)** and **Purple (Obstructed)**, matching the legend exactly.
- **Guidance Unification**:
  - All tool banners (Link, Elevation, Viewshed, RF) now use a consistent layout, color scheme, and dismissal logic.
  - **Mobile Polish**: Increased toolbar padding and softened scroll gradients to ensure button labels are fully visible on small screens.
  - **Terminology**: Standardized "Purple Area" naming in Viewshed guides.
- **Dynamic Hardware Cues**: Added tips to the Link Analysis banner highlighting real-time hardware reconfiguration capabilities.

---

## v1.7.2 - Selection Logic & UI Polish

This release unifies the node selection behavior, resolves critical event propagation bugs, and polishes the import notification UI for a more professional experience.

### 📡 Selection Logic & Architecture

- **Unified Selection Flow**: Consolidated map clicks and batch node selections into a single, high-reliability handler.
- **Predictable Roles**: Selecting a 3rd node now consistently resets the sequence, making the new node the **TX** point.
- **Double-Selection Prevention**:
  - Blocked event propagation from UI panels to the map to prevent accidental "double-selection".
  - Implemented a 100ms temporal guard to ignore rapid-fire duplicate events.
- **React Performance**: Fixed a "Cannot update a component while rendering another" state warning by refactoring state update sequences.

### 🎨 UI & UX Refinements

- **Centered Notifications**: The "IMPORT SUCCESSFUL" popup is now visually centered over the map area, intelligently adjusting for sidebar state.
- **Streamlined Feedback**: Removed the redundant "CLOSE" button from the import notification, relying on its auto-dismiss behavior for a zero-click workflow.
- **Bug Fixes**: Resolved a `ReferenceError` in `BatchProcessing.jsx` related to inconsistent state access.

---

## v1.7.1 - Mobile UX & HUD Refinement

This update focuses on polishing the HUD layout and significantly improving the mobile user experience for multi-step workflows like Batch Node analysis.

### 🎨 HUD Layout & Aesthetics

- **Off-Center Toolbar**: Relocated the main toolbar to `left: 20px` to create a modern, asymmetrical layout.
- **Action Button Alignment**: Standardized action buttons (Lock, Clear Link, etc.) to `left: 60px`, maintaining clear separation from the sidebar toggle.
- **Sidebar Toggle Centering**: Vertically aligned the sidebar toggle button with other HUD action elements for a balanced visual center at `top: 76px`.
- **Global Zoom Standard**: Zoom controls are now consistently located in the `bottom-right` corner across all devices, eliminating toolbar overlap.

### 📱 Mobile UI Enhancements

- **Smart Panel Minimization**:
  - The **Batch Nodes list** now automatically minimizes when a link is established, maximizing map visibility.
  - Relocated the minimized Batch Nodes panel to the top-left area to prevent conflict with analysis result sheets.
- **Link Analysis Summaries**:
  - Added a compact "Status & Margin" live summary to the minimized header on mobile, allowing users to see results without expanding the full sheet.
  - Refined the "Grab Handle" and minimized height (`72px`) for a more responsive feel.

---

## v1.7.0 - Pro RF Coverage & Runtime Config

This major release introduces a powerful new **RF Coverage Tool** with stitched multi-tile analysis and draggable transmitters, alongside significant DevOps improvements for runtime configuration.

### 📡 RF Coverage Tool (Beta)

- **3x3 Grid Analysis**: The tool now automatically stitches together a 9-tile grid around the observer, drastically expanding the analysis area.
- **Draggable Transmitter**: Real-time updates! Drag the "RF Transmitter" marker to instantly recalculate coverage from a new location.
- **Enhanced Heatmap**: New "SNR-based" visualization using a Scatterplot layer for high-performance rendering of signal quality (Green=Excellent to Red=Poor).
- **Auto-Recalculation**: Changing radio settings (Frequency, SF, BW) or physical parameters (Antenna Height) now automatically triggers a coverage refresh.

### 🐳 DevOps & Configuration

- **Runtime Configuration**: You can now set `DEFAULT_MAP_STYLE` and `DEFAULT_UNITS` in `docker-compose.yml` **without rebuilding the image**.
- **Docker Entrypoint**: A new `docker-entrypoint.sh` script injects these environment variables into the frontend at container startup.
- **Default Map Style**: Updated default map style to **Dark Green** (`dark_green`) for better terrain contrast.

### 🛠️ Quality of Life & Bug Fixes

- **Viewshed Reliability**: Implemented smart worker polling to completely eliminate the "Worker not ready" error when running analysis immediately after page load.
- **Link Analysis Precision**: Fixed a critically important type coercion bug where Antenna Heights were treated as strings, ensuring accurate Fresnel zone calculations.
- **Obstruction Logic**: Refined the map line coloring logic to strictly adhere to obstruction flags, ensuring "Red" means "Obstructed" without ambiguity.
- **Accessibility**: Comprehensive improvements to form labels, IDs, and ARIA attributes across the Sidebar and Analysis panels.
- **Code Cleanup**: Removed unused imports (`fetchElevationPath` etc.) and dead code in `Sidebar.jsx`, `MapContainer.jsx`, and `LinkLayer.jsx`.

---

## v1.6.3 - Docker & Config Enhancements

This update improves the development and deployment experience with optimized Docker builds and robust configuration handling for self-hosted elevation data.

### 🐳 Docker & DevOps

- **Build Speed Boost**: added `.dockerignore` to exclude `node_modules` and other heavy artifacts, reducing build context from >1.5GB to ~35MB.
- **Production Safety**: Updated `docker-compose.yml` to mount data volumes as **Read-Only** (`:ro`), preventing accidental data corruption.
- **Config Handling**: Explicitly mounted `config.yaml` for the `opentopodata` service in both dev and prod environments to ensure reliable dataset loading.
- **CI Optimization**: Updated GitHub Actions to only rebuild Docker images for components that have changed (`core`, `rf-engine`, or `opentopodata`), significantly reducing CI wait times.

### 🔧 Configuration

- **Smart Git Ignore**: Updated `.gitignore` to track the `opentopodata` directory structure and config while correctly ignoring large elevation dataset files (`.hgt`, `.tif`).
- **Redis Fix**: Fixed a corrupted image reference in the dev docker-compose file.

### Dataset Downloader Guide

- **Dataset Downloader Guide**: Added a guide to help users download and install OpenTopoData sets for use with meshRF.
  [meshRF Datasets Tool](https://github.com/d3mocide/meshRF-datasets-tool)

---

## v1.6.2 - Visual Sync & Interaction Polish

This patch release focuses on "Quality of Life" improvements for the map interface, ensuring that visual feedback perfectly matches the underlying math and that map interactions feel buttery smooth.

### 🎨 Visual Consistency

- **Model-Synced Map Colors**: The colored link line on the map now respects your selected propagation model (e.g., **Okumura-Hata**).
  - Previously, the map line would default to "Red/Dashed" if there was a physical obstruction, ignoring the fact that Hata models might predict a strong signal in NLOS conditions.
  - Now, if Hata says the signal is "Excellent" (Green) or "Marginal" (Orange), the map line matches that status exactly, regardless of line-of-sight.
- **Granular Color Coding**: Upgraded the map line to support the full 5-tier color system used in the Analysis Panel (Green, Yellow, Solid Orange, Red), giving you distinct visual feedback for "Marginal" but working connections.

### 🖱️ Interaction Improvements

- **Smooth Node Dragging**: Rewrote the drag-and-drop logic to eliminate jitter.
  - The **Fresnel Zone** (blue polygon) now intelligently hides itself during dragging to maintain high frame rates and reappears instantly when you drop the node.
  - The **Line of Sight** (white/colored line) updates in real-time without lagging the browser.
- **Smart "Third Click"**: Clicking the map after placing a link now intuitively clears the old link and starts a new one at that location, streamlining the workflow.

### 🐛 Bug Fixes

- **"Red Dash" Glitch**: Fixed a race condition where dragging a node triggered double calculations, causing the link to sometimes get stuck in an "Obstructed" state even when clear.
- **React Hook Crash**: Resolved a "Rendered more hooks" crash that could occur when adding nodes rapidly.

---

## v1.6.1 - Hotfix: Docker Startup

### 🐛 Bug Fixes

- **OpenTopoData Submodule**: Updated the submodule reference to include critical Docker startup fixes (CRLF line endings and execution permissions) that were missed in the v1.6 tag.

---

## v1.6 - Advanced Propagation & Asymmetric Config

This release introduces professional-grade propagation modeling with the **Okumura-Hata** model and enables granular, per-node hardware configuration for asymmetric link analysis.

### 📡 Advanced Propagation Modeling

- **Okumura-Hata Model**: Added support for the Okumura-Hata empirical model (Urban, Suburban, Rural), ideal for calculating path loss in non-LOS environments (150-1500MHz).
- **Hybrid Analysis**: Automatically switches between standard Fresnel/Earth Bulge physics and Hata models based on user selection.
- **Environment Presets**: New "Urban Small", "Urban Large", "Suburban", and "Rural" presets that dynamically adjust path loss coefficients.

### 🎛️ Per-Node Hardware Configuration

- **Asymmetric Links**: You can now configure **Node A (TX)** and **Node B (RX)** independently.
- **Granular Control**: Set different device types, antenna gains, and heights for each end of the link (e.g., a high-power base station vs. a handheld mobile unit).
- **Global & Individual Modes**: Easily toggle between "Global" (sync) mode and individual node editing directly from the map or sidebar.

### 🎨 Sidebar & UX Refinement

- **Modular Layout**: Extracted **Batch Processing** into its own dedicated, persistent panel for better workflow separation.
- **Collapsible Settings**: The general settings area (Units, Map Style, Environment) is now collapsible, reducing clutter and focusing attention on radio configuration.
- **Visual Polish**: Improved divider spacing and border logic for a cleaner, "glassmorphic" aesthetic.

### 🐛 Bug Fixes & Stability

- **LinkLayer Crash**: Fixed a race condition where the map would crash if a link was analyzed before node state was fully initialized.
- **OpenTopoData Startup**: Resolved an infinite restart loop in the Docker container caused by Windows CRLF line endings in entry scripts.
- **Optimization Tool**: Fixed a 500 Error when running the "Find Ideal Spot" tool and ensured it correctly unlocks the map after failure.

---

## v1.5 - Major Feature Update: Batch UX & Interface Refinement

This version focuses on significant UX improvements for the Batch Node tool, enhanced interface controls with panel minimization, and overall system cleanup for a more responsive and professional feel.

### ⚡ Batch Node UX Overhaul

- **Persistent Selections**: TX and RX badges now remain visible on map markers after selection, providing permanent visual context during analysis.
- **Interactive Link Restart**: Selecting a third node now automatically resets the selection flow, making the new node the TX point—no more manual clearing required between links.
- **Improved Visual Feedback**: Switched from problematic CSS animations to high-intensity, color-matched glows (Green for TX, Red for RX) to eliminate visual "ghosting" artifacts.
- **Clear Link Integration**: The "Clear Link" operation now correctly resets all batch selection states, ensuring a clean map workspace.

### 🎨 Interface & Control Improvements

- **Collapsible Panels**: Both the **Batch Nodes** and **Ideal Spots** panels now support minimization to a compact top-bar state, maximizing visible map area.
- **Map Interaction Shield**: Implemented a robust "scroll-lock" for UI panels. Scrolling through long lists of nodes no longer triggers map zoom.
- **Long List Support**: Added custom scrollbar support and boundary containers for the Batch Nodes panel to handle large imports (50+ nodes) gracefully.
- **Centered Notifications**: Success/failure notifications are now correctly centered relative to the visible map area, adjusting dynamically as the sidebar opens and closes.

### 🧹 Stability & Cleanup

- **Feature Pruning**: Removed the non-functional "Simulate Coverage" buttons from node popups and disabled the "Viewshed" tool while backend dependencies are being modernized.
- **Production Hardening**: Removed 13+ debug logging statements and unused CSS classes to reduce bundle size and improve performance.
- **Code Sustainability**: Documented complex event handling logic to prevent regression in map-to-UI interaction.

---

## v1.3 - Reliability & Self-Hosting

This release brings stability to the Viewshed tool, enhances the "Find Ideal Spot" feature, and introduces a complete self-hosting solution for elevation data to eliminate API rate limits.

### 🏠 Self-Hosted OpenTopoData

- **Local Elevation Server**: Integrated `opentopodata` service directly into the Docker stack.
- **Unlimited Queries**: Bypass public API rate limits (1000 req/day) by serving data locally.
- **Custom Data Support**: Drop in standard `.hgt` or `.tif` files (SRTM, NED, etc.) to power your analysis.
- **Documentation**: easy-to-follow [Setup Guide](./OPENTOPO_GUIDE.md) included.

### 📍 Find Ideal Spot Enhancements

- **Top 5 Ranking**: The tool now identifies the top 5 highest elevation points in the search area instead of just one.
- **Ranked Markers**: Map markers now display their rank number (1-5) for immediate visual prioritization.
- **Restored Functionality**: Fixed 404 errors by restoring and modernizing the backend optimization endpoint.

### 🔭 Viewshed Tool Fixes

- **GeoTIFF Loader Fix**: Resolved critical "Invalid byte order" and fetch errors by switching to the robust Backend Tile API.
- **Backend-Driven Data**: The frontend now consumes standard Terrain-RGB tiles generated by the RF Engine, ensuring consistency with link analysis.
- **Removed Dependencies**: Eliminated `geotiff.js` frontend dependency for a lighter bundle.

### 🛠️ Infrastructure & Dev Experience

- **Multi-Architecture Support**: GitHub Actions workflow now builds separate Docker images for `amd64` (x86) and `arm64` (Apple Silicon/Raspberry Pi).
- **Service Stability**:
  - Fixed `scipy` dependency crash in backend.
  - Resolved Docker port conflicts.
- **Cleaned Codebase**: significant reduction in unused legacy code and imports.

---

## v1.2 - OpenTopoData Migration & ViewShed Layer

This release replaces the Mapbox elevation API with OpenTopoData, adds a beta ViewShed visualization tool, and includes comprehensive code cleanup and security improvements.

### 🌐 Elevation Data Overhaul

- **OpenTopoData Integration**: Switched from Mapbox to OpenTopoData API for elevation tile fetching.
  - **98.8% API Reduction**: Batch requests reduce API calls from 256 to 3 per tile.
  - **No Authentication Required**: Works out-of-the-box with public API (1000 requests/day).
  - **Configurable Sources**: Support for custom/self-hosted OpenTopoData instances via environment variables.
  - **Rate Limit Handling**: Built-in 300ms delays between batches to respect free tier limits.
- **Environment Variables**:
  ```bash
  ELEVATION_API_URL=https://api.opentopodata.org  # Custom instance URL
  ELEVATION_DATASET=srtm30m  # srtm30m, srtm90m, aster30m, ned10m
  ```

### 🔭 ViewShed Layer (Beta) ⚠️ _In Development_

- **WebGL-Powered Visualization**: Real-time terrain visibility overlay using custom shaders.
- **Terrain-RGB Decoding**: Decodes elevation tiles directly on GPU for performance.
- **Interactive Placement**: Click to place observer and instantly see viewshed calculation.
- **Visual Feedback**: Red/green overlay indicates obstructed vs. visible terrain areas.
- **Seamless Integration**: Fetches elevation tiles from the same OpenTopoData backend.

_Note: This feature is in active development. Advanced features like Fresnel zone analysis are planned for future releases._

### 📡 Link Analysis Optimizations

- **Smarter API Updates**: Link analysis now only triggers when both TX and RX points are placed, preventing unnecessary API calls.
- **Improved UX**: Moving a single marker no longer clears the previous analysis result until the second point is placed.
- **Reduced Backend Load**: Eliminated redundant API requests during marker placement workflow.
- **Cleaner State Management**: Better handling of partial link configurations.

### 🧹 Code Quality & Security

- **Code Cleanup**: Removed 80+ lines of unnecessary comments and verbose documentation.
  - Cleaned up `tile_manager.py` (meshgrid interpolation comments)
  - Updated all Mapbox-specific references to generic "Terrain-RGB" terminology
  - Removed redundant comments in `server.py` and `ViewshedLayer.js`

- **Security Audit**: Comprehensive security scan with zero critical findings.
  - ✅ No exposed API keys or credentials
  - ✅ Proper environment variable usage throughout codebase
  - ✅ `.gitignore` correctly prevents sensitive file commits
  - ⚠️ Identified CORS and Redis auth as production hardening items

### 📋 Feature Status Clarification

Features marked as **"In Development"** in documentation and UI:

- **Find Ideal Spot** - Optimal node placement search
- **Heatmap** - Coverage analysis visualization
- **ViewShed** - Terrain visibility analysis (Beta)

These features are functional but may have incomplete behavior or missing advanced features.

### 🔧 Breaking Changes

- **Removed**: Mapbox API dependency and `MAPBOX_TOKEN` environment variable
- **Migration**: Users upgrading should remove `MAPBOX_TOKEN` from their `.env` files

### 📚 Documentation Updates

- Updated README.md with OpenTopoData configuration guide
- Added ViewShed section to feature list
- Marked in-development features with warning indicators
- Removed duplicate docker-compose configuration sections

---

## v1.1 - UI Polish & Local Data

This release focuses on usability improvements and a transition to a more robust, local-first data model.

### 📍 Usability Experience (UX)

- **Optimization Tool Refinement**:
  - **Glassmorphism Overlays**: New success/failure notifications with modern styling.
  - **Persistent State**: Clearing optimization results now keeps the tool active for rapid re-testing.
  - **Visual Feedback**: Added loading spinners during terrain scans.

- **Link Analysis (LOS) Workflow**:
  - **Smart Toggles**: Disabling the Link Analysis tool now automatically clears the map to ensure a clean workspace.
  - **New "Clear Link" Button**: Added a dedicated floating action button to reset the current analysis without exiting the tool.

### 🛠️ Backend & Data

- **Local SRTM Migration**:
  - Removed dependency on external Elevation APIs (OpenTopography).
  - **Offline Capable**: The `rf-engine` now requires local `.hgt` (SRTM) files in the `./cache` directory.
  - **Efficiency**: Removed `requests` library dependency for a lighter container footprint.

- **Dev Experience**:
  - Updated `docker-compose` to support local container builds for the web app, mirroring the backend workflow.

---

## v1.0 - Professional Edition

This major release transforms **meshRF** into a professional-grade RF planning tool, introducing geodetic physics, batch processing, and a completely modernized UI.

### 🌐 Physics Engine Upgrade

- **Geodetic Earth Model**: Implemented curved-earth calculations with configurable **K-Factor**.
- **Accurate Fresnel Analysis**: Now strictly enforces the **60% Clearance Rule** (WISP Standard) for link quality ratings (Excellent/Good/Marginal/Obstructed).
- **Clutter Awareness**: Added support for **Clutter Height** (trees/urban) in obstruction analysis.

### ⚡ Batch Processing

- **CSV Import**: Analyze hundreds of nodes at once by importing a simple CSV (`Name, Lat, Lon`).
- **Matrix Analysis**: Automatically computes link feasibility for every pair of nodes (N\*(N-1)/2 links).
- **Bulk Export**: Download detailed link budget reports (RSSI, Margin, Clearance) as CSV.

### 🎨 UI Modernization

- **Responsive Sidebar**: Collapsible, glassmorphism sidebar that works perfectly on mobile devices.
- **Floating Controls**: Smart "Tab" toggle that floats independently of the sidebar.
- **Visual Polish**: Custom dark-mode scrollbars, refined typography, and new "meshRF" branding with custom iconography.
- **Link Analysis Panel**: Now fully resizable with a draggable handle for better chart visibility.

### 🛠️ Configuration & Deployment

- **Environment Variables**:
  - `VITE_ELEVATION_API_URL`: Configure your own elevation provider (e.g., self-hosted Open-Meteo).
  - `VITE_MAP_LAT` / `VITE_MAP_LNG`: Set custom default starting coordinates.
- **Refined Docker**: Optimized Docker Compose setup for easy deployment.

---

## v0.2-rc - Branding Update

### 🎨 Branding & Identity

- **New Name**: Officially renamed to **meshRF**.
- **New Icon**: Added stylized RF signal icon.
- **UI Updates**: Updated browser title and sidebar header.

### ⚙️ Configuration

- **Allowed Hosts**: Added `ALLOWED_HOSTS` support for reverse proxy deployments.
- **Docker Workflow**: Automated `latest` tag publishing.
