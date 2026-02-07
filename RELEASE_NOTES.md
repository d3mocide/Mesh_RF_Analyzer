# Release v1.9.0: The "Pro-Max PWA" Upgrade 📱

This release transforms MeshRF into a high-fidelity Progressive Web App (PWA), specifically optimized for field use on iOS and mobile devices. We've smoothed out the rough edges of mobile browser interfaces to provide a truly native feel.

## 🌟 Key Features

### 1. iOS "Pro-Max" Experience

- **Safe-Area Aware**: All toolbars, panels, and notifications now dynamicallly adjust to bypass the iPhone notch and system home indicators.
- **Dynamic Viewport (100dvh)**: Eliminated the annoying "double scrollbar" and layout jumping typical of mobile Safari.
- **Native Touch Latency**: Implemented `touch-action: manipulation` and disabled overscroll rubber-banding for a snappy, app-like response.

### 2. Intelligent PWA Lifecycle

- **User-Prompted Updates**: MeshRF now intelligently detects updates and prompts you to refresh, ensuring you never lose active planning data unexpectedly.
- **Offline Reliability**: New **Offline Indicator** lets you know exactly when you're operating on local cached data vs. live backend physics.

### 3. Responsive Site Finder

- **Grid Redesign**: The Site Selection Weights panel has been completely overhauled with a clean, grid-based UI for effortless weight adjustment on small screens.
- **Glassmorphism Design**: Enhanced backgrounds with high-intensity blur for maximum legibility over map terrain.

## 🛠️ Technical Fixes

- **Physics Engine Handshake**: Fixed a crash in link analysis caused by legacy frontend path loss remnants.
- **SW Destructuring Fix**: Resolved a critical "Symbol.iterator" error in the Service Worker update hook.
- **High-Res Assets**: Added a high-resolution `apple-touch-icon.png` for a premium home screen presence.

## 🚀 How to Upgrade

1. Pull the latest changes: `git pull origin main`
2. **Clear Cache**: If using as a PWA, wait for the **Update Available** prompt and click **Refresh Now**.
3. Docker restart (optional but recommended): `docker compose up -d`
