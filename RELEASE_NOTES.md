# Release Notes

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
