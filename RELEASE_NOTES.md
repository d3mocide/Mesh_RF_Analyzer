# Release v1.14.0: Mesh Link Intelligence

This release transforms the Multi-Site Analysis tool from a simple coverage area reporter into a full **mesh network planning suite**. After running a scan you can now immediately answer the questions that matter most: which sites can talk to each other, how much does each site uniquely contribute, and is the proposed network actually a connected mesh?

## What's New

### 1. Inter-Node Link Quality Matrix

Every site pair in your scan is now automatically analysed for RF link viability using the same Bullington terrain-diffraction model used elsewhere in the tool. The new **Links tab** shows:

| Field | What it tells you |
|---|---|
| **Status** | Viable / Degraded / Blocked based on Fresnel zone clearance |
| **Path Loss** | End-to-end path loss in dB — compare against your link budget |
| **Fresnel Clearance** | % of first Fresnel zone clear at the worst obstruction point |
| **Distance** | Haversine distance between the two sites |

Links are sorted viable-first so the best candidates are always at the top.

### 2. Marginal Coverage per Site

The **Sites tab** now shows how much *unique* area each node contributes — area that no other selected site covers. This catches redundant placements before you deploy:

- **High unique %** (cyan) → critical site, removing it creates a coverage gap.
- **Low unique %** (red) → redundant placement, consider relocating.

### 3. Mesh Connectivity Score & Topology Tab

The new **Topology tab** gives a network-level health summary:

- **Mesh Connectivity Score** — percentage of all node pairs that can communicate, either directly or via relay. A fully connected mesh scores 100%.
- **Multi-hop relay detection** — BFS pathfinding finds pairs that are blocked on a direct link but reachable through intermediate nodes, with the hop count shown.
- **All-pairs path table** — every combination of sites with its shortest viable path and status.

### 4. Link Lines on the Map

Coloured polylines are drawn between every site pair when results are shown, so the topology is visible directly on the terrain:

- **Solid cyan** — viable direct link
- **Dashed gold** — degraded link (partial terrain obstruction)
- **Dashed red** — blocked (no direct LOS path)

### 5. Combined Coverage Total

The results panel header now shows the total **union coverage area** of all selected sites — the actual unique terrain covered by the entire proposed network, not the sum of individual footprints.

## Improvements

- Site names from CSV imports are now preserved through the scan and appear in all three tabs and on the map polyline tooltips.
- The Help button is now context-aware — it explains the fields for whichever tab you have open.
- The `/scan/start` API endpoint now forwards RF parameters (frequency, K-factor, clutter height) into the Celery task so link analysis uses your configured settings.

## How to Upgrade

```bash
git pull origin main
docker compose -f docker-compose.dev.yml up -d --build
```

---

*Plan smarter. Know your mesh before you deploy.*
