# Release v1.10.0: The "Terrain Analysis Pro" Update ⛰️📡

This major update transforms meshRF into a truly professional-grade analysis suite. We've overhauled the Link Analysis engine with a high-fidelity workspace and added critical bulk management tools.

## 🌟 Key Changes

### 1. 📂 CSV Bulk Import (Multi-Site)

- **Efficient Workflows**: You can now import entire lists of candidate sites directly from a CSV file.
- **Template Support**: Supports `name`, `lat`, `lon`, `antenna_height`, and `tx_power` fields.
- **Instant Integration**: Imported sites are immediately added to the Multi-Site manager for quick terrain scanning.

### 2. 🪐 Professional Link Analysis UI

- **"Mission-Control" Redesign**: The Link Analysis panel now features **Dark Glassmorphism** (`rgba(10, 10, 15, 0.98)`) and standardized neon cyan borders that match our Site Selection suite.
- **High-Resolution Charts**: The terrain profile chart has been widened and vertically optimized (700px height) to prevent clipping and provide superior visual detail of earth curvature and obstacles.
- **Symmetric Ergonomics**: Rebalanced padding and layout offsets ensure that legends, RX metadata, and distance labels are always perfectly framed.

### 3. 📖 Propagation Model Guide

- **Integrated Knowledge**: Added a comprehensive guide explaining the physics behind **FSPL**, **Okumura-Hata**, and **ITM (Longley-Rice)**.
- **Actionable Advice**: Includes a recommended use-case table to help engineers choose the right mathematical model for their environment.

### 4. 🎨 Global UI Polish

- **Cyberpunk Scrollbars**: Implemented a global, custom neon-cyan scrollbar style (`4px`) across the entire app.
- **Breathing Room**: Added specialized padding to sidebars and lists to ensure scrollbars never overlap content or controls.

## 🚀 How to Upgrade

1. Pull the latest: `git pull origin dev`
2. Update dependencies: `docker exec meshrf_dev npm install`
3. Restart containers: `docker compose -f docker-compose.dev.yml restart`

---

_Found a bug? Use the built-in feedback tool or open an issue on GitHub!_
