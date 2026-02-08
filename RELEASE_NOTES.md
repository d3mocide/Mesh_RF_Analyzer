# Release v1.11.0: The "Physics & Hardware" Update 🚀⚡

This release marks a significant step forward in RF modeling fidelity and user control. We've introduced asymmetric hardware configurations, integrated real-world cable loss calculations, and exposed advanced environmental parameters for the ITM engine.

## 🌟 Key Changes

### 1. 📡 Asymmetric Node Configurations (Multi-Node A/B)

- **Independent Parameters**: You can now specify different antennas, heights, and power settings for **Node A** (Transmitter) and **Node B** (Receiver).
- **Targeted Analysis**: Perfect for modeling links between a high-power base station and a low-power handheld device.
- **Global Toggle**: Switch to "Global" mode to update both nodes simultaneously for rapid "what-if" scenarios.

### 2. 🔌 Cable Loss Calculator

- **Real-World Fidelity**: Added a dynamic cable loss engine. Select your cable type (**LMR-400**, **RG-58**, etc.) and length to see its impact on your **Estimated ERP** in real-time.
- **Hardware Integration**: Cable loss is now fully subtracted from TX power across the WASM and Python simulation engines.

### 3. � High-Fidelity Physics (ITM Environment)

- **Ground Parameters**: Choose your terrain type (Fresh Water, Desert, Average Ground) to fine-tune the ITM engine's dielectric and conductivity settings.
- **Climate Zones**: Model your link's behavior across different global climates, from Equatorial to Maritime Temperate.
- **Bullington Renaming**: The legacy Python-based terrain model has been renamed to **"Bullington (Diffraction)"** to better differentiate it from our upcoming high-fidelity WASM implementations.

### 4. 🎨 Sidebar & UI Polish

- **"LoRa Band" Workflow**: The radio settings have been streamlined into a sleek "LoRa Band" section, minimized by default to keep your workspace clean.
- **Improved Spacing**: Removed "dead space" and fine-tuned padding across the entire sidebar for a tighter, more professional feel.
- **Scroll Position Persistence**: Fixed the annoying sidebar scroll reset that occurred when changing radio presets.

## 🚀 How to Upgrade

1. Pull the latest: `git pull origin main`
2. Update dependencies: `docker exec meshrf_dev npm install`
3. Restart containers: `docker compose -f docker-compose.dev.yml restart`

---

_Thank you for helping us build the future of mesh RF analysis!_
