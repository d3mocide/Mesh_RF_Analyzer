# Site Analyzer Tools

The **Site Analyzer** suite is a powerful set of tools designed to identify, evaluate, and manage potential network node locations. It combines automated terrain scanning with manual site management.

## 🛠️ Components

### 1. Site Finder (Automated Grid Scan)

A rapid optimization engine that scans a user-defined area to find the best potential transmitter spots based on weighted criteria.

**Features:**

- **Grid-Based Optimization**: Scans a 10x10 grid within your bounding box.
- **Weighted Scoring**: algorithms rank sites based on:
  - **Elevation**: Height above sea level.
  - **Prominence**: Local height relative to surrounding terrain.
  - **fresnel**: Line-of-sight clearance probability.
- **Visual Feedback**: Top 5 candidates are marked with ranked "Ghost Nodes" (Neo-Cyan markers).

### 2. Multi-Site Manager (Manual Mode)

A dedicated interface for managing a list of candidate sites.

**Features:**

- **Candidate List**: Add/Remove potential sites manually.
- **Coverage Preview**: Instantly view potential coverage stats (Area, Points Reachable).
- **Comparison**: Toggle between different candidates to compare viewsheds.

## 🚀 How to Use

### Mode 1: Site Finder (Auto)

1. Select **Site Analyzer** from the toolbar.
2. Ensure the "Elevation Scan" tab is active.
3. **Draw Area**: Click two opposite corners on the map to define the scan box.
4. **Adjust Weights**: Use the sliders in the panel to prioritize Elevation vs. Prominence vs. Fresnel.
5. **Analyze**: The system will rank the top 5 spots. Click any "Ghost Node" to make it your temporary Primary Node.

### Mode 2: Multi-Site Manager (Manual)

1. Switch to the **Multi-Site** tab in the panel.
2. **Add Site**: Click "Add" (or the map directly if prompted) to place a candidate marker.
3. **Manage**:
   - Click a site in the list to fly to it.
   - Toggle visibility of its viewshed.
   - Convert a candidate to a permanent Network Node.

## 📊 Optimization Weights

- **Elevation (0.0 - 1.0)**: Prioritizes raw height. Good for regional coverage.
- **Prominence (0.0 - 1.0)**: Prioritizes local peaks. Good for overcoming immediate obstacles.
- **Fresnel (0.0 - 1.0)**: Prioritizes clearance from terrain obstructions.

> [!TIP]
> Use **Site Finder** to discover unknown high points, then switch to **Multi-Site Manager** to refine and compare specific candidates.

> [!NOTE]  
> "Ghost Nodes" are temporary. To save a location, convert it to a node or add it to your Multi-Site list.
