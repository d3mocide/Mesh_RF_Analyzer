# Release v1.12.1: The "Neon Precision" Update �⚡

This release focuses on UI polish and functional aesthetics, synchronizing our analysis parameters with the visual language of our toolset. We've introduced dynamic progress tracking and color-coded logic to make the interface feel as precise as the physics driving it.

## 🌟 Key Changes

### 1. � Logic-Linked Colors

- **Visual Grouping**: Optimization sliders now share the exact colors of the tools they represent.
  - Elevation settings now glow with the same **Purple** as the Viewshed tool.
  - Prominence tracks with the **Orange** of the RF Simulator.
- **Cohesive Antenna Mapping**: The Antenna Height slider also adopts the Viewshed purple, creating a unified visual theme for all height-based parameters.

### 2. ⚡ Dynamic Progress Sliders

- **Instant Feedback**: Sliders now feature a "thick neon" fill that provides immediate visual tracking of your settings.
- **Refined Glow**: We've tuned the neon intensity. The UI maintains its cyberpunk energy but with a cleaner, more professional balance.

### 3. 🧹 System Consolidation

- **Unified Styling**: Removed fragmented inline styles in favor of a robust, global range-input system.
- **Bug Fixes**: Resolved case-sensitivity issues in weight mapping to ensure the right colors always show up on the right tools.

## 🚀 How to Upgrade

1. Pull the latest: `git pull origin main`
2. Update dependencies: `docker exec meshrf_dev npm install`
3. Restart containers: `docker compose -f docker-compose.dev.yml restart`

---

_Precision isn't just in the numbers; it's in how we see them. Thank you for building meshRF!_
