# v0.1-rc - Initial Release

## Features

- **Real-time Link Analysis**: Calculate link budgets for LoRa Mesh networks (915MHz).
- **Interactive Map**: Visualize nodes and links on a map with terrain data.
- **Elevation Profiling**: View elevation profiles between two points using DEM data.
- **Fresnel Zone Visualization**: Assess line-of-sight obstructions with Fresnel zone rendering.
- **Preset Configurations**: Includes presets for common hardware/antennas.

## Installation / Usage

### Docker (Recommended)

1. Run `docker run -d -p 5173:5173 ghcr.io/d3mocide/mesh-analyzer:latest`
2. Access the app at `http://localhost:5173`.

### Manual

This is a web-based tool.

1. Clone the repository.
2. Run `npm install`.
3. Run `npm run dev` to start the local server.

## Disclaimer

> [!WARNING]
> This tool is provided as-is for educational and planning purposes only. This tool was created with Gemini 3.5 so results are not guaranteed to be accurate. Digital Elevation Models may not reflect obstructions like buildings or dense vegetation.
