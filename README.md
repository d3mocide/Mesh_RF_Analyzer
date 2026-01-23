# meshRF 📡 v1.7.0

A professional-grade RF propagation and link analysis tool designed for LoRa Mesh networks (Meshtastic, Reticulum, Sidewinder). Built with **React**, **Leaflet**, and a high-fidelity **Geodetic Physics Engine**.

meshRF is designed for **mission-critical availability**. It operates with **zero external API dependencies** for elevation data, serving high-resolution terrain data directly from self-hosted containers. Currently we do rely on exteranl API's for map tiles but that will be updated soon as well for full offline use. (optional)

![Link Analysis Demo](./public/meshrf-preview-1.5.png)

## ✨ Core Pillars

### 1. 📡 High-Fidelity RF Analysis

- **Geodetic Physics**: Calculates Earth Bulge and effective terrain height based on link distance and configurable **K-Factor**.
- **Empirical Modeling**: Includes **Okumura-Hata** for realistic urban/suburban path loss (150-1500MHz).
- **Asymmetric Links**: Configure unique hardware (power, gain, height) for Node A and Node B independently.
- **Dynamic Fresnel visualization**: Real-time 2D profiles showing LOS and Fresnel zone clearance.

### 2. 📍 Advanced Site Surveying

- **Parallel Location Optimization**: Rapidly scan bounding boxes for optimal node placement using high-concurrency grid searches.
- **RF Coverage Simulator** (In Test): Optimized Wasm-powered ITM propagation modeling for wide-area coverage visualization.
- **Viewshed Analysis**: Desktop-grade viewshed calculations served via high-resolution Terrain-RGB tiles.

### 3. ⚡ Batch Operations & reporting

- **Bulk Link Matrix**: Import CSVs (`Name, Lat, Lon`) to instantly compute link budgets for entire networks.
- **Automated Reporting**: Export detailed CSV reports containing RSSI, Signal Margin, and Clearance values.

---

## 🚀 Getting Started

### 🐳 Running with Docker (Recommended)

meshRF is fully containerized and easy to deploy:

1. **Clone and Run**:

   ```bash
   git clone https://github.com/d3mocide/meshrf.git
   cd meshrf
   docker compose up -d
   ```

2. **Access the App**:
   - Frontend: `http://localhost` (Port 80)
   - RF Engine API: `http://localhost:5001/docs` (Swagger UI)

3. **Elevation Data**:
   By default, meshRF uses a local **OpenTopoData** instance. You must download elevation files (HGT/TIF) to the `./data/opentopodata` directory.
   👉 **[See Setup Guide](./OPENTOPO_GUIDE.md)** for data download instructions.

### ⚙️ Configuration (Docker)

You can customize the application behavior by setting environment variables in `docker-compose.yml`:

| Variable            | Description                                                                                    | Default      |
| ------------------- | ---------------------------------------------------------------------------------------------- | ------------ |
| `DEFAULT_MAP_STYLE` | Initial map theme (options: `dark`, `light`, `dark_matter`, `dark_green`, `topo`, `satellite`) | `dark_green` |
| `DEFAULT_UNITS`     | Measurement system (`imperial` or `metric`)                                                    | `imperial`   |
| `VITE_MAP_LAT`      | Initial map center latitude                                                                    | `45.5152`    |
| `VITE_MAP_LNG`      | Initial map center longitude                                                                   | `-122.6784`  |

---

## 🏗️ Architecture

- **Frontend**: React + Leaflet + Vite. Heavy RF math handled via **C++/Wasm** for near-native performance.
- **RF Engine**: FastAPI Python service. Features connection pooling and parallelized tile fetching for near-instant elevation profiles.
- **OpenTopoData**: Self-hosted elevation API providing geodetic data without external requests or rate limits.
- **Redis**: High-speed caching layer for terrain and analysis results.

## 📄 License

MIT License. Free to use and modify.

## ⚠️ Disclaimer

This tool is a simulation. Real-world RF propagation is affected by complex factors (interference, buildings, weather) not fully modeled here. Always verify with field testing.
