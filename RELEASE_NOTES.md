# Release v1.13.0: The "Coverage Analysis" Update 📡

This major feature update transforms the old "Site Finder" into a professional-grade **Coverage Analysis** tool. We've replaced the rigid grid system with a flexible **Radial Scan** engine, allowing you to instantly visualize signal quality around any transmitter.

## 🌟 Key Features

### 1. 🎯 Radial Coverage Analysis

- **Click-to-Scan**: Simply click the map to place your Transmitter (TX), then drag to set your scan radius (up to 20km).
- **Heatmap Overlay**: See a color-coded signal quality layer that shows you exactly where reception is strongest (Green) or weakest (Red).
- **Best Links**: The system automatically identifies and ranks the top reception sites based on Line-of-Sight, Fresnel Clearance, and Signal Strength.

### 2. 🏔️ Interactive Terrain Profiles

- **Deep Dive**: Click any "Best Link" marker to open a detailed **Terrain Profile**.
- **Visual Physics**: See the actual ground elevation, the direct Line-of-Sight path, and the Fresnel Zone clearance in a beautiful, interactive chart.

### 3. 💾 Data Export

- **Take it with you**: Export your analysis results to **CSV** for spreadsheets or **KML** for 3D visualization in Google Earth.

### 4. 🎛️ Advanced RF Controls

- **Fine-Tuning**: Adjust **Refraction (K-Factor)** and **Clutter Height** directly from the map interface to model different atmospheric conditions and environments.

## 🛠️ Enhancements

- **Renamed**: "Elevation Scan" is now **Coverage Analysis** to better reflect its capabilities.
- **Polished**: Scroll propagation is now blocked in panels, preventing accidental map zooms while viewing results.
- **Clarified**: Tooltips and guidance overlays have been rewritten for clarity.

## 🚀 How to Upgrade

1. Pull the latest: `git pull origin main`
2. Update dependencies: `docker exec meshrf_dev npm install`
3. Restart containers: `docker compose -f docker-compose.dev.yml restart`

---

_See the unseen. Happy scanning!_
