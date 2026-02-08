# Release v1.12.0: The "Precision Engine" Update 🎯🏔️

This release unifies our propagation modeling suite, bringing the high-precision Longley-Rice ITM WebAssembly engine to our point-to-point link analysis tool. We've also finalized our environmental physics engine, making the entire application fully "ground-aware."

## 🌟 Key Changes

### 1. 🏔️ Unified high-precision ITM (WASM)

- **Engine Parity**: Point-to-point link analysis now uses the exact same C++ ITM implementation as our coverage maps. No more discrepancies between "The Map" and "The Link."
- **WASM Default**: The simulation defaults to the highest fidelity model (`itm_wasm`) out of the box, ensuring professionals get the most accurate results immediately.

### 🌊 2. Full Environmental Awareness

- **Ground Constants**: We've expanded our ground type library. You can now model links over **Sea Water, Fresh Water, Farmland,** and **Industrial** areas with accurate Dielectric Constant ($\epsilon$) and Conductivity ($\sigma$) values.
- **Climate Integration**: Select your local climate zone (from Equatorial to Desert) to adjust the propagation physics for regional atmospheric conditions.

### 🔍 3. Refined Guidance & Logic

- **Interactive Model Guide**: We've re-written our propagation guide to help you choose the right model for the job.
- **Intelligent Fallbacks**: The Python backend now understands `itm_wasm` requests and automatically provides the best terrain-aware alternative for server-side operations.
- **Calibrated Default Mode**: All Site Finder and Optimization tools now default to the ITM engine for a consistent "Physics First" experience.

## 🚀 How to Upgrade

1. Pull the latest: `git pull origin main`
2. Update dependencies: `docker exec meshrf_dev npm install`
3. Restart containers: `docker compose -f docker-compose.dev.yml restart`

---

_The future of mesh RF analysis is about precision. Thank you for building it with us!_
