# RF Simulator Integration — Implementation Plan

**Branch:** `claude/rf-simulator-refactor-plan-fUm7d`
**Scope:** Integrate the RF Simulator's WASM ITM engine into the Site Analysis tool and retire the standalone toolbar mode.
**Approach:** Three sequential phases. Complete and verify each phase before starting the next. No backend changes are required — the ITM engine runs entirely in the browser.

---

## Reference: Key Files

| File | Role |
|---|---|
| `src/hooks/useRFCoverageTool.js` | WASM ITM hook — owns `runAnalysis`, `resultLayer`, `clear` |
| `src/components/Map/MapContainer.jsx` | Orchestrator — wires hooks, state, and rendering |
| `src/components/Map/UI/SiteAnalysisResultsPanel.jsx` | Multi-site results panel (Sites / Links / Topology tabs) |
| `src/components/Map/OptimizationLayer.jsx` | Auto-mode (Coverage Analysis) — manages ghost nodes |
| `src/components/Map/OptimizationResultsPanel.jsx` | Panel rendered inside `OptimizationLayer` for ghost node list |
| `src/components/Map/UI/MapToolbar.jsx` | Toolbar buttons |
| `src/components/Map/Controls/CoverageClickHandler.jsx` | Map click handler for viewshed and rf_coverage modes |
| `src/context/RFContext.jsx` | Global RF state; exports `GROUND_TYPES` |

---

## Phase 1 — Per-Node RF Coverage Preview in Multi-Site Manager

**Goal:** Each site row in the `SiteAnalysisResultsPanel` Sites tab gets a "Show RF Coverage" toggle. Clicking it runs the ITM heatmap for that node on the map. Clicking a second time (or clicking another node's button) clears it. The heatmap overlays the existing viewshed composite.

### Step 1.1 — Extend `useRFCoverageTool` activation in `MapContainer.jsx`

**File:** `src/components/Map/MapContainer.jsx`
**Line:** 175

Change:
```js
} = useRFCoverageTool(toolMode === "rf_coverage");
```
To:
```js
} = useRFCoverageTool(toolMode === "rf_coverage" || toolMode === "optimize");
```

**Why:** The hook clears `resultLayer` when `active` is false. By including `optimize`, the WASM result is preserved while the user is in Site Analysis mode.

---

### Step 1.2 — Add `siteRFCoverageIndex` state to `MapContainer.jsx`

**File:** `src/components/Map/MapContainer.jsx`
**Location:** After line 117 (the `showAnalysisResults` state declaration)

Add:
```js
const [siteRFCoverageIndex, setSiteRFCoverageIndex] = useState(null);
```

---

### Step 1.3 — Add `handleSiteRFCoverage` handler in `MapContainer.jsx`

**File:** `src/components/Map/MapContainer.jsx`
**Location:** After the `handleOptimizationStateUpdate` callback (after line 319)

Add this new callback:
```js
const handleSiteRFCoverage = React.useCallback((res, index) => {
    // Toggle off if the same site is clicked again
    if (siteRFCoverageIndex === index) {
        setSiteRFCoverageIndex(null);
        clearRFCoverage();
        return;
    }
    setSiteRFCoverageIndex(index);

    const h = getAntennaHeightMeters ? getAntennaHeightMeters() : 10.0;
    const ground = GROUND_TYPES[groundType] || GROUND_TYPES['Average Ground'];
    const currentSensitivity = calculateSensitivity ? calculateSensitivity() : -126;

    const rfParams = {
        freq,
        txPower: proxyTx,
        txGain: proxyGain,
        txLoss: cableLoss,
        rxLoss: 0,
        rxGain: nodeConfigs.B.antennaGain || 2.15,
        rxSensitivity: currentSensitivity,
        bw,
        sf,
        cr,
        rxHeight,
        epsilon: ground.epsilon,
        sigma: ground.sigma,
        climate,
    };

    runRFAnalysis(res.lat, res.lon, h, 25000, rfParams);
}, [siteRFCoverageIndex, freq, proxyTx, proxyGain, cableLoss, nodeConfigs, calculateSensitivity,
    bw, sf, cr, rxHeight, groundType, climate, getAntennaHeightMeters, runRFAnalysis, clearRFCoverage]);
```

---

### Step 1.4 — Clear `siteRFCoverageIndex` in `resetToolState` in `MapContainer.jsx`

**File:** `src/components/Map/MapContainer.jsx`
**Location:** Inside the `resetToolState` function body (after line 311, the `setShowAnalysisResults(false)` line)

Add:
```js
setSiteRFCoverageIndex(null);
```

---

### Step 1.5 — Extend the RF coverage DeckGL layer condition in `MapContainer.jsx`

**File:** `src/components/Map/MapContainer.jsx`
**Line:** 415

Change:
```js
if (toolMode === "rf_coverage" && rfResultLayer && rfResultLayer.data) {
```
To:
```js
if ((toolMode === "rf_coverage" || (toolMode === "optimize" && siteRFCoverageIndex !== null)) && rfResultLayer && rfResultLayer.data) {
```

This allows the ITM heatmap ScatterplotLayer to render while in optimize mode when a site's RF coverage is active.

---

### Step 1.6 — Pass new props to `SiteAnalysisResultsPanel` in `MapContainer.jsx`

**File:** `src/components/Map/MapContainer.jsx`
**Location:** Lines 1067–1088 (the `SiteAnalysisResultsPanel` JSX block)

Change the opening tag from:
```jsx
<SiteAnalysisResultsPanel
    results={simResults}
    interNodeLinks={interNodeLinks}
    totalUniqueCoverageKm2={totalUniqueCoverageKm2}
    units={units}
    onCenter={(res) => {
```
To:
```jsx
<SiteAnalysisResultsPanel
    results={simResults}
    interNodeLinks={interNodeLinks}
    totalUniqueCoverageKm2={totalUniqueCoverageKm2}
    units={units}
    onShowRFCoverage={handleSiteRFCoverage}
    activeRFSiteIndex={siteRFCoverageIndex}
    onCenter={(res) => {
```

---

### Step 1.7 — Accept new props in `SiteAnalysisResultsPanel.jsx`

**File:** `src/components/Map/UI/SiteAnalysisResultsPanel.jsx`
**Line:** 365 (the `SiteAnalysisResultsPanel` component declaration)

Change:
```js
const SiteAnalysisResultsPanel = ({
    results,
    interNodeLinks,
    totalUniqueCoverageKm2,
    onClose,
    onCenter,
    onClear,
    onRunNew,
    units
}) => {
```
To:
```js
const SiteAnalysisResultsPanel = ({
    results,
    interNodeLinks,
    totalUniqueCoverageKm2,
    onClose,
    onCenter,
    onClear,
    onRunNew,
    units,
    onShowRFCoverage,
    activeRFSiteIndex
}) => {
```

---

### Step 1.8 — Pass new props into `SitesTab` in `SiteAnalysisResultsPanel.jsx`

**File:** `src/components/Map/UI/SiteAnalysisResultsPanel.jsx`
**Line:** 557 (the `SitesTab` render)

Change:
```jsx
{activeTab === 'Sites' && (
    <SitesTab results={results} units={units} onCenter={onCenter} />
)}
```
To:
```jsx
{activeTab === 'Sites' && (
    <SitesTab
        results={results}
        units={units}
        onCenter={onCenter}
        onShowRFCoverage={onShowRFCoverage}
        activeRFSiteIndex={activeRFSiteIndex}
    />
)}
```

---

### Step 1.9 — Update `SitesTab` signature and add RF Coverage button in `SiteAnalysisResultsPanel.jsx`

**File:** `src/components/Map/UI/SiteAnalysisResultsPanel.jsx`
**Line:** 93 (the `SitesTab` function declaration)

Change:
```js
function SitesTab({ results, units, onCenter }) {
```
To:
```js
function SitesTab({ results, units, onCenter, onShowRFCoverage, activeRFSiteIndex }) {
```

Then, inside the `.map()` callback, locate the closing `</div>` of the metrics grid (the `</div>` that closes the `gridTemplateColumns: '1fr 1fr'` div, around line 173). After that closing tag and before the outer card's closing `</div>`, insert the RF Coverage toggle button:

```jsx
{onShowRFCoverage && (
    <button
        onClick={(e) => { e.stopPropagation(); onShowRFCoverage(res, index); }}
        style={{
            marginTop: '10px',
            width: '100%',
            padding: '6px 8px',
            background: activeRFSiteIndex === index
                ? 'rgba(255, 107, 0, 0.15)'
                : 'rgba(255, 255, 255, 0.04)',
            border: `1px solid ${activeRFSiteIndex === index
                ? 'rgba(255, 107, 0, 0.35)'
                : 'rgba(255, 255, 255, 0.08)'}`,
            borderRadius: '6px',
            color: activeRFSiteIndex === index ? '#ff6b00' : '#666',
            fontSize: '0.75em',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            transition: 'all 0.15s'
        }}
    >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>
        </svg>
        {activeRFSiteIndex === index ? 'RF Coverage Active' : 'Show RF Coverage'}
    </button>
)}
```

**Verification:** After these steps, run the app, switch to Site Analysis, run a Multi-Site scan, and confirm: (1) each site card shows the RF Coverage button, (2) clicking it renders the orange ITM heatmap, (3) clicking again clears it, (4) clicking a different site's button switches the heatmap to the new site.

---

## Phase 2 — Auto-Select RF Coverage from Coverage Analysis Results

**Goal:** When a user clicks a ranked candidate in the `OptimizationResultsPanel` (Coverage Analysis auto mode), the ITM heatmap fires automatically for that candidate. Clicking a different candidate updates the heatmap to the new location.

### Step 2.1 — Add `onSelectNode` prop to `OptimizationResultsPanel.jsx`

**File:** `src/components/Map/OptimizationResultsPanel.jsx`
**Line:** 5 (the component declaration)

Change:
```js
const OptimizationResultsPanel = ({ results, weights, onClose, onCenter, onReset, onRecalculate }) => {
```
To:
```js
const OptimizationResultsPanel = ({ results, weights, onClose, onCenter, onReset, onRecalculate, onSelectNode }) => {
```

---

### Step 2.2 — Call `onSelectNode` on result row click in `OptimizationResultsPanel.jsx`

**File:** `src/components/Map/OptimizationResultsPanel.jsx`
**Line:** 275 (the `onClick` on the result row `<div>`)

Change:
```js
onClick={() => onCenter(node)}
```
To:
```js
onClick={() => { onCenter(node); onSelectNode?.(node); }}
```

---

### Step 2.3 — Add `onSelectGhostNode` prop to `OptimizationLayer.jsx` and wire it through

**File:** `src/components/Map/OptimizationLayer.jsx`
**Line:** 24 (the `OptimizationLayer` component declaration)

Change:
```js
const OptimizationLayer = ({ active, setActive, onStateUpdate, weights }) => {
```
To:
```js
const OptimizationLayer = ({ active, setActive, onStateUpdate, weights, onSelectGhostNode }) => {
```

---

### Step 2.4 — Call `onSelectGhostNode` on ghost marker click in `OptimizationLayer.jsx`

**File:** `src/components/Map/OptimizationLayer.jsx`
**Line:** 276 (the ghost node `Marker` `eventHandlers`)

Change:
```js
eventHandlers={{ click: () => setSelectedNode(node) }}
```
To:
```js
eventHandlers={{ click: () => { setSelectedNode(node); onSelectGhostNode?.(node); } }}
```

---

### Step 2.5 — Pass `onSelectNode` to `OptimizationResultsPanel` inside `OptimizationLayer.jsx`

**File:** `src/components/Map/OptimizationLayer.jsx`
**Line:** 419–428 (the `OptimizationResultsPanel` JSX)

Change:
```jsx
<OptimizationResultsPanel
    results={ghostNodes}
    weights={weights}
    onClose={() => setShowResults(false)}
    onCenter={(node) => {
        if (map) map.flyTo([node.lat, node.lon], 16, { duration: 1.5 });
    }}
    onReset={reset}
    onRecalculate={handleRecalculate}
/>
```
To:
```jsx
<OptimizationResultsPanel
    results={ghostNodes}
    weights={weights}
    onClose={() => setShowResults(false)}
    onCenter={(node) => {
        if (map) map.flyTo([node.lat, node.lon], 16, { duration: 1.5 });
    }}
    onReset={reset}
    onRecalculate={handleRecalculate}
    onSelectNode={onSelectGhostNode}
/>
```

---

### Step 2.6 — Add `selectedAutoNodeIndex` state and handler in `MapContainer.jsx`

**File:** `src/components/Map/MapContainer.jsx`
**Location:** After the `siteRFCoverageIndex` state declaration added in Phase 1 Step 1.2

Add:
```js
const [selectedAutoNodeIndex, setSelectedAutoNodeIndex] = useState(null);
```

Then add a handler directly below (after the `handleSiteRFCoverage` callback from Phase 1):
```js
const handleAutoNodeSelect = React.useCallback((node) => {
    const h = getAntennaHeightMeters ? getAntennaHeightMeters() : 10.0;
    const ground = GROUND_TYPES[groundType] || GROUND_TYPES['Average Ground'];
    const currentSensitivity = calculateSensitivity ? calculateSensitivity() : -126;

    const rfParams = {
        freq,
        txPower: proxyTx,
        txGain: proxyGain,
        txLoss: cableLoss,
        rxLoss: 0,
        rxGain: nodeConfigs.B.antennaGain || 2.15,
        rxSensitivity: currentSensitivity,
        bw,
        sf,
        cr,
        rxHeight,
        epsilon: ground.epsilon,
        sigma: ground.sigma,
        climate,
    };

    runRFAnalysis(node.lat, node.lon, h, 25000, rfParams);
}, [freq, proxyTx, proxyGain, cableLoss, nodeConfigs, calculateSensitivity,
    bw, sf, cr, rxHeight, groundType, climate, getAntennaHeightMeters, runRFAnalysis]);
```

Also clear `selectedAutoNodeIndex` inside `resetToolState` (add `setSelectedAutoNodeIndex(null);` alongside the other clears).

---

### Step 2.7 — Pass `onSelectGhostNode` to `OptimizationLayer` in `MapContainer.jsx`

**File:** `src/components/Map/MapContainer.jsx`
**Lines:** 691–699 (the `OptimizationLayer` JSX)

Change:
```jsx
<OptimizationLayer
    active={toolMode === "optimize" && siteAnalysisMode === 'auto'}
    setActive={React.useCallback(
        (active) => setToolMode(active ? "optimize" : "none"),
        [setToolMode],
    )}
    onStateUpdate={handleOptimizationStateUpdate}
    weights={siteSelectionWeights}
/>
```
To:
```jsx
<OptimizationLayer
    active={toolMode === "optimize" && siteAnalysisMode === 'auto'}
    setActive={React.useCallback(
        (active) => setToolMode(active ? "optimize" : "none"),
        [setToolMode],
    )}
    onStateUpdate={handleOptimizationStateUpdate}
    weights={siteSelectionWeights}
    onSelectGhostNode={handleAutoNodeSelect}
/>
```

**Verification:** Switch to Site Analysis → Coverage tab, run a scan, and confirm: (1) clicking any ranked candidate in the results panel fires the orange ITM heatmap at that location, (2) clicking a different candidate replaces the heatmap, (3) the heatmap uses the same RF params as the rest of the app.

---

## Phase 3 — Retire the Standalone RF Simulator Toolbar Button

**Goal:** Remove `rf_coverage` as a top-level tool mode. The `useRFCoverageTool` hook and `RFCoverageLayer.js` are kept unchanged — they are now called exclusively from within the Site Analysis flow.

**Prerequisite:** Phase 1 and Phase 2 must be complete and verified.

### Step 3.1 — Remove RF Simulator button from `MapToolbar.jsx`

**File:** `src/components/Map/UI/MapToolbar.jsx`

1. Remove `Radio` from the lucide-react import on line 2:
   ```js
   import { Locate, Mountain, Share2 } from 'lucide-react';
   ```

2. Remove the entire `ToolbarButton` block for RF Simulator (lines 95–102):
   ```jsx
   <ToolbarButton
       active={toolMode === 'rf_coverage'}
       onClick={() => toggleMode('rf_coverage')}
       color="#ff6b00"
       icon={Radio}
   >
       RF Simulator
   </ToolbarButton>
   ```

---

### Step 3.2 — Remove `rfObserver`, `rfHelp` state from `MapContainer.jsx`

**File:** `src/components/Map/MapContainer.jsx`

Remove line 97:
```js
const [rfObserver, setRfObserver] = useState(null);
```

Remove line 100:
```js
const [rfHelp, setRFHelp] = useState(false);
```

---

### Step 3.3 — Update `useRFCoverageTool` activation in `MapContainer.jsx`

**File:** `src/components/Map/MapContainer.jsx`
**Line:** 175 (updated in Phase 1 Step 1.1)

Change:
```js
} = useRFCoverageTool(toolMode === "rf_coverage" || toolMode === "optimize");
```
To:
```js
} = useRFCoverageTool(toolMode === "optimize");
```

---

### Step 3.4 — Remove the `recalcTimestamp` effect in `MapContainer.jsx`

**File:** `src/components/Map/MapContainer.jsx`
**Lines:** 226–264

Delete the entire `useEffect` block that starts with:
```js
useEffect(() => {
    if (recalcTimestamp && toolMode === "rf_coverage" && rfObserver) {
```
And ends with its closing `}, [recalcTimestamp]);`.

---

### Step 3.5 — Remove RF Coverage click handling from `CoverageClickHandler.jsx`

**File:** `src/components/Map/Controls/CoverageClickHandler.jsx`

1. Change the component signature — remove `runRFCoverage` and `setRfObserver`:
   ```js
   const CoverageClickHandler = ({ mode, runViewshed, setViewshedObserver, rfContext }) => {
   ```

2. Change the `useMapEvents` click guard condition on line 7:
   ```js
   if (mode === 'viewshed') {
   ```
   (Remove the `|| mode === 'rf_coverage'` condition from the outer `if`.)

3. Remove the entire `else if (mode === 'rf_coverage')` block (lines 18–48).

The final file should contain only the viewshed click path:
```js
const CoverageClickHandler = ({ mode, runViewshed, setViewshedObserver, rfContext }) => {
    useMapEvents({
        click(e) {
            if (mode === 'viewshed') {
                const { lat, lng } = e.latlng;
                const h = rfContext.getAntennaHeightMeters ? rfContext.getAntennaHeightMeters() : 2.0;
                const dist = rfContext.viewshedMaxDist || 25000;
                setViewshedObserver({ lat, lng, height: h });
                runViewshed(lat, lng, h, dist);
            }
        }
    });
    return null;
};
```

---

### Step 3.6 — Remove `runRFCoverage` and `setRfObserver` from `CoverageClickHandler` props in `MapContainer.jsx`

**File:** `src/components/Map/MapContainer.jsx`
**Lines:** 511–534 (the `CoverageClickHandler` JSX)

Change:
```jsx
<CoverageClickHandler
    mode={toolMode}
    runViewshed={runViewshedAnalysis}
    runRFCoverage={runRFAnalysis}
    setViewshedObserver={setViewshedObserver}
    setRfObserver={setRfObserver}
    rfContext={{
        ...
    }}
/>
```
To:
```jsx
<CoverageClickHandler
    mode={toolMode}
    runViewshed={runViewshedAnalysis}
    setViewshedObserver={setViewshedObserver}
    rfContext={{
        freq,
        bw,
        sf,
        cr,
        antennaHeight,
        getAntennaHeightMeters,
        calculateSensitivity,
        rxHeight,
        viewshedMaxDist,
    }}
/>
```

Note: The `rfContext` object can now be trimmed to only the viewshed-relevant fields. All the RF-specific fields (txPower, antennaGain, cableLoss, rxAntennaGain, groundType, climate) can be removed from this object.

---

### Step 3.7 — Remove the RF Coverage Transmitter marker in `MapContainer.jsx`

**File:** `src/components/Map/MapContainer.jsx`
**Lines:** 595–645

Delete the entire block:
```jsx
{/* Visual Marker for RF Coverage Transmitter */}
{toolMode === "rf_coverage" && rfObserver && (
    <Marker
        position={rfObserver}
        draggable={true}
        eventHandlers={{
            dragend: (e) => {
                ...
            },
        }}
    >
        <Popup>RF Transmitter</Popup>
    </Marker>
)}
```

---

### Step 3.8 — Remove the RF Coverage bounds rectangle in `MapContainer.jsx`

**File:** `src/components/Map/MapContainer.jsx`
**Lines:** 413–414 and 662–673

Remove the `rfBounds` variable declaration:
```js
let rfBounds = null;
```

Remove the `rfBounds` JSX block:
```jsx
{/* RF Coverage Bounds Rectangle */}
{rfBounds && (
    <Rectangle ... />
)}
```

---

### Step 3.9 — Remove the "Clear RF Coverage" button in `MapContainer.jsx`

**File:** `src/components/Map/MapContainer.jsx`
**Lines:** 1018–1051

Delete the entire block:
```jsx
{/* Clear RF Coverage Button */}
{toolMode === "rf_coverage" && rfObserver && (
    <div style={{ position: "absolute", top: 72, left: 60, zIndex: 1000 }}>
        <button onClick={() => { setRfObserver(null); clearRFCoverage(); }} ...>
            Clear RF Coverage
        </button>
    </div>
)}
```

---

### Step 3.10 — Update the RF Coverage loading overlay in `MapContainer.jsx`

**File:** `src/components/Map/MapContainer.jsx`
**Lines:** 1092–1147 (the `isRFCalculating` loading overlay)

The loading overlay currently reads "CALCULATING RF COVERAGE". Since the overlay is still useful (ITM analysis takes ~1 second), keep it but make it visible in optimize mode too. No change needed to the conditional since `isRFCalculating` is a boolean — it will still show correctly regardless of which flow triggered `runRFAnalysis`. No changes needed.

---

### Step 3.11 — Remove rf_coverage-related props from `GuidanceOverlays` in `MapContainer.jsx`

**File:** `src/components/Map/MapContainer.jsx`
**Lines:** 879–896 (the `GuidanceOverlays` JSX)

Remove these two props from the `GuidanceOverlays` tag:
```jsx
rfObserver={rfObserver}
rfHelp={rfHelp}
setRFHelp={setRFHelp}
```

---

### Step 3.12 — Remove rf_coverage handling from `GuidanceOverlays.jsx`

**File:** `src/components/Map/UI/GuidanceOverlays.jsx`
**Action:** Read this file first, then remove any JSX blocks that are conditionally rendered on `toolMode === 'rf_coverage'`, `rfObserver`, `rfHelp`, or `setRFHelp`. Also remove those from the function's prop signature.

---

### Step 3.13 — Update `RFContext.jsx` toolMode initial value comment

**File:** `src/context/RFContext.jsx`
**Line:** 42

Change:
```js
const [toolMode, setToolMode] = useState("link"); // 'link', 'optimize', 'viewshed', 'rf_coverage', 'none'
```
To:
```js
const [toolMode, setToolMode] = useState("link"); // 'link', 'optimize', 'viewshed', 'none'
```

---

### Step 3.14 — Update documentation

**File:** `Documentation/rf-simulator.md`

Replace the content with a redirect note:
```markdown
# RF Coverage (formerly RF Simulator)

RF coverage analysis using the WASM ITM (Longley-Rice) propagation model is now integrated
directly into the **Site Analysis** tool.

## How to Access

### From Multi-Site Manager Results
1. Run a Multi-Site scan (Site Analysis → Multi-Site tab)
2. In the results panel, open the **Sites** tab
3. Click **Show RF Coverage** on any site row
4. The ITM heatmap renders on the map for that site
5. Click the button again to dismiss, or click another site to switch

### From Coverage Analysis (Auto Mode)
1. Use Site Analysis → Coverage tab to run an automated scan
2. Click any ranked candidate in the results panel
3. The ITM heatmap fires automatically for the selected candidate

## Signal Quality Legend

| Color | Quality | Margin |
|---|---|---|
| Dark Green | Excellent | > 20 dB |
| Light Green | Good | 10–20 dB |
| Yellow | Fair | 5–10 dB |
| Orange | Marginal | 0–5 dB |
| Purple | Below Sensitivity | < 0 dB |
```

---

## Final Verification Checklist

After all three phases:

- [ ] No `rf_coverage` references remain in `MapToolbar.jsx`
- [ ] No `rfObserver` state references remain in `MapContainer.jsx`
- [ ] `CoverageClickHandler` only handles viewshed clicks
- [ ] `useRFCoverageTool` is activated only when `toolMode === 'optimize'`
- [ ] The ITM heatmap appears when clicking "Show RF Coverage" in Multi-Site results
- [ ] The ITM heatmap appears when clicking a ghost node candidate in Coverage Analysis
- [ ] The heatmap clears when switching away from `optimize` mode
- [ ] The heatmap loading overlay still shows during ITM calculation
- [ ] The viewshed tool is unaffected
- [ ] The link analysis tool is unaffected
- [ ] No TypeScript/prop-types errors in the removed component signatures

## Files Modified Summary

| File | Phase | Type of Change |
|---|---|---|
| `src/components/Map/MapContainer.jsx` | 1, 2, 3 | State additions, hook rewire, JSX removals |
| `src/components/Map/UI/SiteAnalysisResultsPanel.jsx` | 1 | New props + RF toggle button in SitesTab |
| `src/components/Map/OptimizationResultsPanel.jsx` | 2 | New `onSelectNode` prop + onClick wiring |
| `src/components/Map/OptimizationLayer.jsx` | 2 | New `onSelectGhostNode` prop + marker click wiring |
| `src/components/Map/UI/MapToolbar.jsx` | 3 | Remove RF Simulator button + Radio import |
| `src/components/Map/Controls/CoverageClickHandler.jsx` | 3 | Remove rf_coverage branch |
| `src/components/Map/UI/GuidanceOverlays.jsx` | 3 | Remove rf_coverage guidance |
| `src/context/RFContext.jsx` | 3 | Update toolMode comment |
| `Documentation/rf-simulator.md` | 3 | Rewrite as redirect |

## Files Unchanged (retained as-is)

| File | Reason |
|---|---|
| `src/hooks/useRFCoverageTool.js` | No logic changes needed; `active` prop controls clearing |
| `src/components/Map/RFCoverageLayer.js` | Not used directly; rendering is via inline ScatterplotLayer in MapContainer |
| `src/utils/rfMath.js` | Shared utility; untouched |
| All backend files | ITM is WASM client-side; zero backend changes |
