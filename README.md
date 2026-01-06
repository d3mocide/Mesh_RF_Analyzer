# Mesh RF Analyzer

A modern, web-based RF simulation and link analysis tool designed for LoRa Mesh networks (Meshtastic, Reticulum, etc.). Built with React, Leaflet, and standard geospatial libraries.

![Link Analysis Demo](./public/mesh-analyzer-preview.png)

## Features

### 📡 Link Analysis

- **Point-to-Point Analysis**: Click any two points on the map to instantly calculate link feasibility.
- **Link Budget Calculator**: Real-time RSSI, SNR, and Link Margin calculations based on TX power, antenna gain, and frequency.
- **Fresnel Zone Visualization**: Visualizes the 1st Fresnel Zone to help identify obstructions.
- **Line of Sight (LOS)**: Draws direct LOS paths with color-coding (Green/Yellow/Red) based on link quality.

### 🏔️ Terrain Awareness

- **Elevation Profiles**: Fetches global elevation data (via Open-Meteo) to generate accurate path profiles.
- **Obstruction Detection**: Automatically detects terrain that blocks the LOS or encroaches on the Fresnel zone.
- **3D-Like Topography**: "Google Terrain" style maps for intuitive planning.

### 🛠️ Configurable Hardware

- **Device Presets**: Pre-configured profiles for popular hardware (Heltec V3, T-Beam, RAK4631, etc.).
- **Antenna Options**: Select from standard antennas (Stubby, Dipole, Yagi) or enter custom gain.
- **Radio Settings**: Adjust Spreading Factor (SF), Bandwidth (BW), and Coding Rate (CR) to simulate different LoRa config (LongFast, ShortFast, etc.).

### 🌍 Application Features metrics

- **Unit Toggle**: Seamlessly switch between **Metric** (km/m) and **Imperial** (mi/ft).
- **Map Themes**: One-click switching between Dark Mode, Light Mode, Topography, and Satellite layers.
- **Responsive Design**: Clean, glassmorphism-inspired UI that works on desktop and tablets.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- **OR**
- [Docker](https://www.docker.com/)

### Running Locally (Node.js)

1.  Clone the repository:

    ```bash
    git clone https://github.com/d3mocide/mesh_analyzer.git
    cd mesh_analyzer
    ```

2.  Install dependencies:

    ```bash
    npm install
    ```

3.  Start the development server:

    ```bash
    npm run dev
    ```

4.  Open `http://localhost:5173` in your browser.

### Running with Docker (No Install)

**Option 1: Docker CLI**

```bash
docker run -d -p 5173:5173 ghcr.io/d3mocide/mesh_analyzer:latest
```

**Option 2: Docker Compose**

```bash
docker-compose up -d
```

_Note: You can configure `ALLOWED_HOSTS` in `docker-compose.yml` if accessing via a custom domain._

2.  Open `http://localhost:5173` in your browser.

## Usage Guide

1.  **Place Nodes**: Click anywhere on the map to place your **TX** (Transmitter) node. Click again to place your **RX** (Receiver) node.
2.  **Adjust Hardware**: Use the Sidebar to select your device (e.g., _Heltec V3_) and antenna height.
3.  **Analyze**:
    - **Green Line**: Clear Line of Sight with good signal margin.
    - **Yellow Line**: Marginal connection or partial Fresnel obstruction.
    - **Red Line**: Obstructed path or insufficient signal power.
4.  **Check Profile**: Look at the top-right overlay to see the terrain cross-section and exact clearance values.

## Technologies Used

- **Vite + React**: Fast, modern frontend framework.
- **Leaflet + React-Leaflet**: robust mapping library.
- **Turf.js**: Advanced geospatial analysis.
- **Open-Meteo API**: Free, open-source global elevation data.

## Project Structure

- `src/components`: UI blocks (Map, Sidebar, Panels).
- `src/context`: Global state management (RF settings).
- `src/utils`: Math engines for RF propagation and Elevation processing.
- `src/data`: Config files for device and antenna presets.

## License

MIT License. Free to use and modify.

## Disclaimer

This tool is provided as-is for educational and planning purposes only. This tool was created with Gemini 3.5 so results are not guaranteed to be accurate.
