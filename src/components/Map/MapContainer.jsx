import React, { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  ImageOverlay,
  Marker,
  Popup,
  Rectangle,
  ZoomControl,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import LinkLayer from "./LinkLayer";
import LinkAnalysisPanel from "./LinkAnalysisPanel";
import OptimizationLayer from "./OptimizationLayer";
import { useRF } from "../../context/RFContext";
import { calculateLinkBudget } from "../../utils/rfMath";
import { DEVICE_PRESETS } from "../../data/presets";
import * as turf from "@turf/turf";
import DeckGLOverlay from "./DeckGLOverlay";
import WasmViewshedLayer from "./WasmViewshedLayer";
import { ScatterplotLayer } from "@deck.gl/layers";
import RFCoverageLayer from "./RFCoverageLayer";
import { useViewshedTool } from "../../hooks/useViewshedTool";
import { useRFCoverageTool } from "../../hooks/useRFCoverageTool";
import BatchNodesPanel from "./BatchNodesPanel";
import useSimulationStore from "../../store/useSimulationStore";

// Refactored Sub-Components
import LocateControl from "./Controls/LocateControl";
import CoverageClickHandler from "./Controls/CoverageClickHandler";
import BatchNodesPanelWrapper from "./Controls/BatchNodesPanelWrapper";
import MapToolbar from "./UI/MapToolbar";
import GuidanceOverlays from "./UI/GuidanceOverlays";
import SiteAnalysisPanel from "./UI/SiteAnalysisPanel";
import SiteAnalysisResultsPanel from "./UI/SiteAnalysisResultsPanel";

// Fix for default marker icon issues in React Leaflet
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

import { useMapEvents, useMap } from "react-leaflet";

// Helper component to capture map clicks
const MultiSiteClickHandler = ({ onLocationSelect }) => {
    useMapEvents({
        click(e) {
            onLocationSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
    });
    return null;
};

// Helper component to capture map instance
const MapInstanceTracker = ({ setMap }) => {
    const map = useMap();
    React.useEffect(() => {
        if (map) setMap(map);
    }, [map, setMap]);
    return null;
};

// MapComponent
const MapComponent = () => {
  // Default Map Center (Portland, OR) stabile ref
  const defaultLat = 45.5152;
  const defaultLng = -122.6784;
  const position = React.useMemo(() => [defaultLat, defaultLng], []);

  // Lifted State
  const [nodes, setNodes] = useState([]);
  const [linkStats, setLinkStats] = useState({
    minClearance: 0,
    isObstructed: false,
    loading: false,
  });
  const [coverageOverlay, setCoverageOverlay] = useState(null); // { url, bounds }
  // const [toolMode, setToolMode] = useState('link'); // Lifted to Context
  const [viewshedObserver, setViewshedObserver] = useState(null); // Single Point for Viewshed Tool
  const [rfObserver, setRfObserver] = useState(null); // Single Point for RF Coverage Tool
  const [isLinkLocked, setIsLinkLocked] = useState(false); // Default unlocked
  const [viewshedHelp, setViewshedHelp] = useState(false);
  const [rfHelp, setRFHelp] = useState(false);
  const [linkHelp, setLinkHelp] = useState(false);
  const [elevationHelp, setElevationHelp] = useState(false);
  const [optimizeState, setOptimizeState] = useState({
    startPoint: null,
    endPoint: null,
    ghostNodes: [],
    loading: false,
  });
  const [selectedBatchNodes, setSelectedBatchNodes] = useState([null, null]); // Track selected batch nodes: [TX_node, RX_node]
  const [siteAnalysisMode, setSiteAnalysisMode] = useState('auto'); // 'auto' | 'manual'
  const [lastClickedLocation, setLastClickedLocation] = useState(null); // click {lat, lng} for manual mode
  const [siteSelectionWeights, setSiteSelectionWeights] = useState({
    elevation: 0.5,
    prominence: 0.3,
    fresnel: 0.2
  });
  const [showAnalysisResults, setShowAnalysisResults] = useState(false);
  const [map, setMap] = useState(null);

  // Propagation Model State
  const [propagationSettings, setPropagationSettings] = useState({
    model: "itm_wasm", // Default to WASM ITM (most accurate)
    environment: "suburban", // Default to Suburban
  });
  const selectionRef = React.useRef(0); // Track last selection time to prevent identical double-clicks

  // Calculate Budget at container level for Panel
  const {
    toolMode,
    setToolMode,
    txPower: proxyTx,
    antennaGain: proxyGain,
    freq,
    sf,
    cr,
    bw,
    antennaHeight,
    cableLoss,
    units,
    mapStyle,
    batchNodes,
    showBatchPanel,
    setShowBatchPanel,
    setBatchNodes,
    setEditMode,
    nodeConfigs,
    recalcTimestamp,
    getAntennaHeightMeters,
    calculateSensitivity,
    rxHeight,
    fadeMargin
  } = useRF();

  // Wasm Viewshed Tool Hook
  const {
    runAnalysis,
    resultLayer,
    isCalculating,
    clear: clearViewshed,
  } = useViewshedTool(toolMode === "viewshed");

  // RF Coverage Tool Hook
  const {
    runAnalysis: runRFAnalysis,
    resultLayer: rfResultLayer,
    isCalculating: isRFCalculating,
    clear: clearRFCoverage,
  } = useRFCoverageTool(toolMode === "rf_coverage");

  // Verify sensitivity or default to a reasonable LoRa value
  const sensitivity = calculateSensitivity ? calculateSensitivity() : -126; // Default SF7/BW125
  // Map Configs
  const MAP_STYLES = {
    dark: {
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    dark_green: {
      // Use Light map (Voyager) + CSS Filter to get "Dark with Colors" (Green Parks)
      url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      className: "dark-mode-tiles",
    },
    light: {
      url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    topo: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      attribution:
        "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community",
    },
    topo_dark: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      attribution:
        "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community",
      className: "dark-mode-tiles",
    },
    satellite: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution:
        "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
    },
  };

  const currentStyle = MAP_STYLES[mapStyle] || MAP_STYLES.dark_green;
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Trigger RF Recalculation on Parameter Change (via 'Update Calculation' button)
  useEffect(() => {
    if (recalcTimestamp && toolMode === "rf_coverage" && rfObserver) {
      const { lat, lng } = rfObserver;
      console.log("Triggering RF Recalculation due to param update");

      // Recalculate height from current context (in case user changed height/units)
      const currentHeight = getAntennaHeightMeters
        ? getAntennaHeightMeters()
        : rfObserver.height;

      // Recalculate sensitivity
      const currentSensitivity = calculateSensitivity
        ? calculateSensitivity()
        : -126;

      const rfParams = {
        freq,
        txPower: proxyTx,
        txGain: proxyGain,
        txLoss: cableLoss, // Task 1.1: Use calculated cable loss
        rxLoss: 0, // Default 0 for coverage map until Cable Calculator (Task 1.5)
        rxGain: nodeConfigs.B.antennaGain || 2.15,
        rxSensitivity: currentSensitivity,
        bw,
        sf,
        cr,
        rxHeight,
      };
      console.log(
        `[RF Recalc] Height: ${currentHeight.toFixed(2)}m, Params:`,
        rfParams,
      );
      runRFAnalysis(lat, lng, currentHeight, 25000, rfParams);
    }
  }, [recalcTimestamp]);

  let budget = null;
  let distance = 0;

  if (nodes.length === 2) {
    const [p1, p2] = nodes;
    distance = turf.distance([p1.lng, p1.lat], [p2.lng, p2.lat], {
      units: "kilometers",
    });

    // Determine Path Loss logic
    const configA = nodeConfigs.A;
    const configB = nodeConfigs.B;

    // Use backend path loss if available (calculated by LinkLayer), otherwise null (FSPL)
    let pathLossVal = linkStats.backendPathLoss || null;

    budget = calculateLinkBudget({
      txPower: configA.txPower,
      txGain: configA.antennaGain,
      txLoss: DEVICE_PRESETS[configA.device]?.loss || 0,
      rxGain: configB.antennaGain,
      rxLoss: DEVICE_PRESETS[configB.device]?.loss || 0,
      distanceKm: distance,
      freqMHz: freq,
      sf,
      bw,
      pathLossOverride: pathLossVal,
      fadeMargin
    });
  }

  // Helper to reset all tool states (Clear View)
  const resetToolState = () => {
    setNodes([]);
    setIsLinkLocked(false);
    setLinkStats({ minClearance: 0, isObstructed: false, loading: false });
    setCoverageOverlay(null);
    setViewshedObserver(null);
    setRfObserver(null);
    setSelectedBatchNodes([null, null]); // Reset to initial state
    setEditMode("GLOBAL"); // Clear node editing state
    
    // Clear Site Analysis states
    useSimulationStore.getState().reset();
    setShowAnalysisResults(false);
    setLastClickedLocation(null);
  };

  const handleOptimizationStateUpdate = React.useCallback((state) => {
    setOptimizeState(state);
    if (state.showResults !== undefined) {
      setShowAnalysisResults(state.showResults);
    }
  }, []);

  const handleNodeSelect = (node, isBatch = false) => {
    // Only allow selection in link mode
    if (toolMode !== "link" || isLinkLocked) return;

    // Temporal guard: Ignore calls within 100ms (prevents double-activation from event bubbling)
    const now = Date.now();
    if (now - selectionRef.current < 100) return;
    selectionRef.current = now;

    // Use sequential updates (React will batch these)
    const isNewLink = nodes.length === 0 || nodes.length >= 2;
    const nodeData = {
      lat: node.lat,
      lng: node.lng,
      isBatch,
      batchId: isBatch ? node.id : null,
    };

    if (isNewLink) {
      setNodes([nodeData]);
      setEditMode("A");
      setSelectedBatchNodes([
        isBatch
          ? { id: node.id, name: node.name, role: "TX" }
          : { id: "manual-tx", role: "TX" },
        null,
      ]);
    } else {
      setNodes((prev) => [...prev, nodeData]);
      setEditMode("B");
      setSelectedBatchNodes((prev) => [
        prev[0],
        isBatch
          ? { id: node.id, name: node.name, role: "RX" }
          : { id: "manual-rx", role: "RX" },
      ]);
    }
  };


  // Simulation Store integration
  const { nodes: simNodes, results: simResults, compositeOverlay } = useSimulationStore();

  // Automatically show results panel when scan finishes
  useEffect(() => {
    if (simResults && simResults.length > 0) {
      setShowAnalysisResults(true);
    }
  }, [simResults]);

  // Prepare DeckGL Layers
  const deckLayers = [];

  // Composite coverage from Site Analysis
  if (compositeOverlay && compositeOverlay.image) {
      const { image, bounds } = compositeOverlay;
      // image is base64 data url from backend
      deckLayers.push(
          new WasmViewshedLayer({
              id: 'site-analysis-composite',
              image: image,
              bounds: [bounds[1], bounds[0], bounds[3], bounds[2]], // [minLon, minLat, maxLon, maxLat]
              opacity: 0.6,
              pickable: false
          })
      );
  }

  // Viewshed Layer (Only active in 'viewshed' mode)
  if (toolMode === "viewshed" && resultLayer && resultLayer.data) {
    // resultLayer is now the single stitched viewshed (768x768 or similar)
    const { width, height, data, bounds } = resultLayer;

    const rgbaData = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const val = data[i];
      rgbaData[i * 4] = val; // R
      rgbaData[i * 4 + 1] = 0; // G
      rgbaData[i * 4 + 2] = 0; // B
      rgbaData[i * 4 + 3] = 255; // A
    }
    const imageData = new ImageData(rgbaData, width, height);

    deckLayers.push(
      new WasmViewshedLayer({
        id: "wasm-viewshed-layer-stitched",
        image: imageData,
        bounds: [bounds.west, bounds.south, bounds.east, bounds.north],
        opacity: 0.6,
      }),
    );
  }

  // Viewshed Bounding Box (Visual debugging)
  let viewshedBounds = null;
  if (toolMode === "viewshed" && resultLayer && resultLayer.bounds) {
    const { west, south, east, north } = resultLayer.bounds;
    viewshedBounds = [
      [north, west],
      [south, east],
    ];
  }

  // RF Coverage Layer (Only active in 'rf_coverage' mode)
  let rfBounds = null;
  if (toolMode === "rf_coverage" && rfResultLayer && rfResultLayer.data) {
    const { width, height, data, rfParams, bounds } = rfResultLayer;

    console.log(
      `[MapContainer] Processing ${data.length} pixels for RF visualization`,
    );

    console.log(
      `[MapContainer] Processing ${data.length} pixels for RF visualization`,
    );

    const { west, south, east, north } = bounds;

    // Generate points for Scatterplot visualization
    const points = [];

    // Calculate step sizes in degrees
    const latStep = (north - south) / height;
    const lonStep = (east - west) / width;

    // Noise floor for SNR calc
    const bwHz = (rfParams?.bw || 125) * 1000;
    const noiseFloor = -174 + 10 * Math.log10(bwHz);
    const sensitivity = rfParams?.rxSensitivity || -120;

    const NO_DATA = -999.0;

    // Iterate ALL pixels
    for (let i = 0; i < data.length; i++) {
      const rssi = data[i]; // Raw dBm value

      let snr = -999;

      // Separate valid signals from background
      const isBackground = rssi <= NO_DATA + 1;

      // Skip background/no-data pixels (User requested to drop the grid)
      if (isBackground) continue;

      snr = rssi - noiseFloor;

      // Calculate x, y from index
      const y = Math.floor(i / width);
      const x = i % width;

      // Calculate Lat/Lon
      const pLat = north - (y + 0.5) * latStep;
      const pLon = west + (x + 0.5) * lonStep;

      points.push({
        position: [pLon, pLat],
        rssi,
        snr,
        isBackground,
      });
    }

    deckLayers.push(
      new ScatterplotLayer({
        id: "rf-coverage-dots",
        data: points,
        pickable: true,
        opacity: 0.6,
        stroked: false,
        filled: true,
        radiusScale: 1,
        radiusMinPixels: 2,
        radiusMaxPixels: 6,
        getPosition: (d) => d.position,
        getFillColor: (d) => {
          if (d.isBackground) return [30, 30, 40, 40]; // Faint dark grid for background

          // Color based on SNR/RSSI
          const relativeStrength = d.rssi - sensitivity;

          if (relativeStrength > 20) return [0, 255, 65, 200]; // Excellent (>20dB margin)
          if (relativeStrength > 10) return [100, 255, 0, 200]; // Good (>10dB margin)
          if (relativeStrength > 5) return [255, 255, 0, 200]; // Fair (>5dB margin)
          if (relativeStrength > 0) return [255, 120, 0, 180]; // Marginal (0-5dB margin)
          return [100, 0, 255, 120]; // Very Weak (Near floor) - Purple
        },
      }),
    );
  }

  return (
    <div style={{ flex: 1, height: "100%", position: "relative" }}>
      <MapContainer
        center={position}
        zoom={13}
        style={{ height: "100%", width: "100%", background: "#0a0a0f" }}
        zoomControl={false}
      >
        <MapInstanceTracker setMap={setMap} />
        <ZoomControl position={isMobile ? "topright" : "bottomright"} />
        <LocateControl />
        <CoverageClickHandler
          mode={toolMode}
          runViewshed={runAnalysis}
          runRFCoverage={runRFAnalysis}
          setViewshedObserver={setViewshedObserver}
          setRfObserver={setRfObserver}
          rfContext={{
            freq,
            txPower: proxyTx,
            antennaGain: proxyGain,
            bw,
            sf,
            cr,
            antennaHeight,
            getAntennaHeightMeters,
            rxHeight,
            txLoss: cableLoss, // Task 1.1
            rxLoss: 0,
            rxAntennaGain: nodeConfigs.B.antennaGain,
          }}
        />
        <TileLayer
          key={mapStyle} // Force re-mount on style change to clear classes
          attribution={currentStyle.attribution}
          url={currentStyle.url}
          className={currentStyle.className}
        />
        <DeckGLOverlay layers={deckLayers} />

        <LinkLayer
          nodes={nodes}
          setNodes={setNodes}
          linkStats={linkStats}
          setLinkStats={setLinkStats}
          setCoverageOverlay={setCoverageOverlay}
          active={toolMode === "link"}
          locked={isLinkLocked}
          propagationSettings={propagationSettings}
          onManualClick={(e) => {
            // When user clicks map manually, we treat it as a non-batch node selection
            handleNodeSelect({ lat: e.latlng.lat, lng: e.latlng.lng }, false);
          }}
        />
        {coverageOverlay && (
          <ImageOverlay
            url={coverageOverlay.url}
            bounds={coverageOverlay.bounds}
            opacity={0.6}
          />
        )}

        {/* Visual Marker for Viewshed Observer */}
        {toolMode === "viewshed" && viewshedObserver && (
          <Marker
            position={viewshedObserver}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng();
                // Fetch Elevation again on drag end
                fetch("/api/get-elevation", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ lat, lon: lng }),
                })
                  .then((res) => res.json())
                  .then((data) => {
                    console.log("Viewshed Debug - Fetched Elevation:", data);
                    const elevation = data.elevation || 0;
                    // Task 1.4: Use antenna height for viewshed observer from context if available, else 2.0
                    const h = getAntennaHeightMeters ? getAntennaHeightMeters() : 2.0; 
                    const newObserver = { lat, lng, height: h };
                    console.log(
                      "Viewshed Debug - Setting Observer:",
                      newObserver,
                    );
                    setViewshedObserver(newObserver);

                    // Trigger Recalculation
                    runAnalysis(lat, lng, h, 25000);
                  })
                  .catch((err) => {
                    console.error("Failed to fetch height", err);
                    const h = getAntennaHeightMeters ? getAntennaHeightMeters() : 2.0;    
                    setViewshedObserver({ lat, lng, height: h });
                  });
              },
            }}
          >
            <Popup>Allowed Observer Location</Popup>
          </Marker>
        )}

        {/* Visual Marker for RF Coverage Transmitter */}
        {toolMode === "rf_coverage" && rfObserver && (
          <Marker
            position={rfObserver}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng();

                // Update position and recalculate
                fetch("/api/get-elevation", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ lat, lon: lng }),
                })
                  .then((res) => res.json())
                  .then((data) => {
                    const elevation = data.elevation || 0;
                    const h = antennaHeight || 5.0; // Keep relative height from ground

                    setRfObserver({ lat, lng, height: h });

                    const currentSensitivity = calculateSensitivity
                      ? calculateSensitivity()
                      : -126;
                    const rfParams = {
                      freq,
                      txPower: proxyTx,
                      txGain: proxyGain,
                      rxGain: 2.15,
                      rxSensitivity: currentSensitivity,
                      bw,
                      sf,
                      cr,
                      rxHeight,
                    };

                    runRFAnalysis(lat, lng, h, 25000, rfParams);
                  });
              },
            }}
          >
            <Popup>RF Transmitter</Popup>
          </Marker>
        )}

        {/* Viewshed Bounds Rectangle */}
        {viewshedBounds && (
          <Rectangle
            bounds={viewshedBounds}
            pathOptions={{
              color: "#a855f7",
              dashArray: "10, 10",
              fill: false,
              weight: 2,
            }}
          />
        )}

        {/* RF Coverage Bounds Rectangle */}
        {rfBounds && (
          <Rectangle
            bounds={rfBounds}
            pathOptions={{
              color: "orange",
              dashArray: "5, 5",
              fill: false,
              weight: 2,
            }}
          />
        )}

        {/* Multi-Site Click Handler */}
        {toolMode === 'optimize' && siteAnalysisMode === 'manual' && (
            <MultiSiteClickHandler 
                onLocationSelect={(loc) => {
                    setLastClickedLocation(loc);
                    // Proactive addition: Add node to store directly on click
                    useSimulationStore.getState().addNode({
                        lat: loc.lat,
                        lon: loc.lng,
                        height: 10,
                        name: `Node ${simNodes.length + 1}`
                    });
                }} 
            />
        )}

        <OptimizationLayer
          active={toolMode === "optimize" && siteAnalysisMode === 'auto'}
          setActive={React.useCallback(
            (active) => setToolMode(active ? "optimize" : "none"),
            [setToolMode],
          )}
          onStateUpdate={handleOptimizationStateUpdate}
          weights={siteSelectionWeights}
        />
        
        {/* SiteAnalysisPanel moved outside to prevent click-through */}

        {/* Batch Nodes Rendering */}
        {batchNodes.length > 0 &&
          batchNodes.map((node) => {
            // Check if this node is selected by looking at indices 0 and 1
            const selectionTX = selectedBatchNodes[0];
            const selectionRX = selectedBatchNodes[1];
            const isTX = selectionTX?.id === node.id;
            const isRX = selectionRX?.id === node.id;
            const isSelected = isTX || isRX;
            const role = isTX ? "TX" : isRX ? "RX" : null;

            // Determine styling based on selection
            let className = "batch-node-icon";
            let bgColor = "#00f2ff";
            let boxShadow = "0 0 8px rgba(0, 242, 255, 0.6)";

            if (isSelected) {
              if (role === "TX") {
                // Don't add animation class - it causes ghost elements
                bgColor = "#00ff41";
                boxShadow = "0 0 12px rgba(0, 255, 65, 0.8)";
              } else if (role === "RX") {
                // Don't add animation class - it causes ghost elements
                bgColor = "#ff0000";
                boxShadow = "0 0 12px rgba(255, 0, 0, 0.8)";
              }
            }

            return (
              <Marker
                key={`batch-${node.id}`}
                position={[node.lat, node.lng]}
                icon={L.divIcon({
                  className: className,
                  html: `<div style="background-color: ${bgColor}; width: 12px; height: 12px; border-radius: 50%; opacity: 0.9; border: 2px solid white; box-shadow: ${boxShadow};"></div>`,
                  iconSize: [12, 12],
                  iconAnchor: [6, 6],
                })}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
                    handleNodeSelect(node, true);
                  },
                }}
              >
                <Popup>{node.name}</Popup>
              </Marker>
            );
          })}

        {/* Temporary Node Marker (Before "Add" is clicked) */}
        {toolMode === 'optimize' && siteAnalysisMode === 'manual' && lastClickedLocation && (
            <Marker
                key="temp-candidate"
                position={[lastClickedLocation.lat, lastClickedLocation.lng]}
                icon={L.divIcon({
                    className: 'temp-node-icon',
                    html: `<div style="
                        background-color: transparent; 
                        width: 16px; height: 16px; 
                        border-radius: 50%; opacity: 0.8; 
                        border: 2px dashed #00f2ff; 
                        box-shadow: 0 0 5px rgba(0, 242, 255, 0.5);
                    "></div>`,
                    iconSize: [16, 16],
                    iconAnchor: [8, 8],
                })}
            >
                <Popup>New Site Candidate</Popup>
            </Marker>
        )}

        {/* Simulation Nodes Rendering (Multi-Site Analysis) */}
        {toolMode === 'optimize' && siteAnalysisMode === 'manual' && simNodes.map((node) => (
            <Marker
                key={`sim-${node.id}`}
                position={[node.lat, node.lon]}
                icon={L.divIcon({
                    className: 'sim-node-icon',
                    html: `<div style="
                        background-color: #00f2ff; 
                        width: 14px; height: 14px; 
                        border-radius: 50%; opacity: 1; 
                        border: 2px solid white; 
                        box-shadow: 0 0 10px #00f2ff;
                        display: flex; align-items: center; justify-content: center;
                        font-size: 10px; font-weight: bold; color: black;
                    ">${simResults ? '✓' : ''}</div>`,
                    iconSize: [14, 14],
                    iconAnchor: [7, 7],
                })}
            >
                <Popup>
                    <strong>{node.name}</strong><br/>
                    Lat: {node.lat.toFixed(5)}<br/>
                    Lon: {node.lon.toFixed(5)}<br/>
                    {simResults && Array.isArray(simResults) && (() => {
                        const res = simResults.find(r => Math.abs(r.lat - node.lat) < 0.0001 && Math.abs(r.lon - node.lon) < 0.0001);
                        if (!res) return null;
                        return (
                            <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#888' }}>Elevation:</span>
                                    <span style={{ color: '#00f2ff', fontWeight: 'bold' }}>
                                        {units === 'imperial' 
                                            ? `${(res.elevation * 3.28084).toFixed(1)} ft` 
                                            : `${res.elevation} m`}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#888' }}>Coverage:</span>
                                    <span style={{ color: '#00f2ff', fontWeight: 'bold' }}>
                                        {units === 'imperial' 
                                            ? `${(res.coverage_area_km2 * 0.386102).toFixed(2)} mi²` 
                                            : `${res.coverage_area_km2} km²`}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.8em', color: '#666', marginTop: '4px' }}>
                                    ({res.coverage_points} visible points)
                                </div>
                            </div>
                        );
                    })()}
                </Popup>
            </Marker>
        ))}

        {/* Batch Nodes Panel - Must be inside MapContainer to use useMap hook */}
        {showBatchPanel && batchNodes.length > 0 && (
          <BatchNodesPanelWrapper
            nodes={batchNodes}
            selectedNodes={selectedBatchNodes}
            onClear={() => {
              setBatchNodes([]);
              setShowBatchPanel(false);
              resetToolState(); // Reset active link/markers when clearing batch panel
            }}
            onNodeSelect={(node) => handleNodeSelect(node, true)}
            forceMinimized={isMobile && nodes.length === 2}
          />
        )}
      </MapContainer>

      <SiteAnalysisPanel 
          active={toolMode === 'optimize'}
          isResultsVisible={showAnalysisResults}
          mode={siteAnalysisMode}
          setMode={setSiteAnalysisMode}
          weights={siteSelectionWeights}
          setWeights={setSiteSelectionWeights}
          selectedLocation={lastClickedLocation}
      />

      {/* Tool Toggles */}
      <MapToolbar
        toolMode={toolMode}
        setToolMode={setToolMode}
        resetToolState={resetToolState}
      />
        <GuidanceOverlays 
          toolMode={toolMode}
          siteAnalysisMode={siteAnalysisMode}
          nodes={nodes}
          optimizeState={optimizeState}
          isResultsVisible={showAnalysisResults}
          isMobile={isMobile}
          viewshedObserver={viewshedObserver}
          rfObserver={rfObserver}
          linkHelp={linkHelp}
          setLinkHelp={setLinkHelp}
          elevationHelp={elevationHelp}
          setElevationHelp={setElevationHelp}
          viewshedHelp={viewshedHelp}
          setViewshedHelp={setViewshedHelp}
          rfHelp={rfHelp}
          setRFHelp={setRFHelp}
        />

      {/* Clear Link Button - Shows when link nodes exist */}
      {nodes.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 72,
            left: 60,
            zIndex: 1000,
            display: "flex",
            gap: "12px",
          }}
        >
          <button
            onClick={() => setIsLinkLocked(!isLinkLocked)}
            style={{
              background: isLinkLocked ? "#00f2ff" : "rgba(0, 0, 0, 0.6)",
              color: isLinkLocked ? "#000" : "#fff",
              border: "1px solid #00f2ff",
              padding: "0 12px",
              height: "36px",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "14px",
              boxShadow: "0 2px 5px rgba(0,0,0,0.5)",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {isLinkLocked ? (
              <>
                <span style={{ fontSize: "1em" }}>🔒</span> Locked
              </>
            ) : (
              <>
                <span style={{ fontSize: "1em" }}>🔓</span> Lock
              </>
            )}
          </button>

          <button
            onClick={() => {
              setNodes([]);
              setIsLinkLocked(false); // Reset lock on clear
              setEditMode("GLOBAL"); // Reset edit mode
              setLinkStats({
                minClearance: 0,
                isObstructed: false,
                loading: false,
              });
              setCoverageOverlay(null);
              setSelectedBatchNodes([null, null]); // Reset to initial state
            }}
            style={{
              background: "rgba(255, 50, 50, 0.9)",
              color: "#fff",
              border: "1px solid rgba(255, 100, 100, 0.5)",
              padding: "0 12px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "14px",
              boxShadow: "0 2px 5px rgba(0,0,0,0.5)",
              transition: "all 0.2s ease",
            }}
            onMouseOver={(e) =>
              (e.target.style.background = "rgba(255, 50, 50, 1)")
            }
            onMouseOut={(e) =>
              (e.target.style.background = "rgba(255, 50, 50, 0.9)")
            }
          >
            Clear Link
          </button>
        </div>
      )}

      {/* Clear Viewshed Button */}
      {toolMode === "viewshed" && viewshedObserver && (
        <div style={{ position: "absolute", top: 72, left: 60, zIndex: 1000 }}>
          <button
            onClick={() => {
              setViewshedObserver(null);
              clearViewshed();
            }}
            style={{
              background: "rgba(255, 50, 50, 0.9)",
              color: "#fff",
              border: "1px solid rgba(255, 100, 100, 0.5)",
              padding: "0 12px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "14px",
              boxShadow: "0 2px 5px rgba(0,0,0,0.5)",
              transition: "all 0.2s ease",
            }}
            onMouseOver={(e) =>
              (e.target.style.background = "rgba(255, 50, 50, 1)")
            }
            onMouseOut={(e) =>
              (e.target.style.background = "rgba(255, 50, 50, 0.9)")
            }
          >
            Clear Viewshed
          </button>
        </div>
      )}

      {/* Clear RF Coverage Button */}
      {toolMode === "rf_coverage" && rfObserver && (
        <div style={{ position: "absolute", top: 72, left: 60, zIndex: 1000 }}>
          <button
            onClick={() => {
              setRfObserver(null);
              clearRFCoverage();
            }}
            style={{
              background: "rgba(255, 50, 50, 0.9)",
              color: "#fff",
              border: "1px solid rgba(255, 100, 100, 0.5)",
              padding: "0 12px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "14px",
              boxShadow: "0 2px 5px rgba(0,0,0,0.5)",
              transition: "all 0.2s ease",
            }}
            onMouseOver={(e) =>
              (e.target.style.background = "rgba(255, 50, 50, 1)")
            }
            onMouseOut={(e) =>
              (e.target.style.background = "rgba(255, 50, 50, 0.9)")
            }
          >
            Clear RF Coverage
          </button>
        </div>
      )}

      {/* Overlay Panel */}
      {nodes.length === 2 && (
        <LinkAnalysisPanel
          nodes={nodes}
          linkStats={linkStats}
          budget={budget}
          distance={distance}
          units={units}
          propagationSettings={propagationSettings}
          setPropagationSettings={setPropagationSettings}
        />
      )}

      {/* Site Analysis Results Panel moved outside to prevent click-through */}
      {showAnalysisResults && simResults && simResults.length > 0 && (
        <SiteAnalysisResultsPanel 
          results={simResults}
          units={units}
          onCenter={(res) => {
              if (map) {
                  map.flyTo([res.lat, res.lon], 15);
              }
          }}
          onClear={() => {
              setShowAnalysisResults(false);
              // Fully reset store (nodes, results, overlay)
              useSimulationStore.getState().reset();
          }}
          onRunNew={() => {
              setShowAnalysisResults(false);
              setToolMode('optimize'); 
              setSiteAnalysisMode('manual');
          }}
        />
      )}

      {/* RF Coverage Loading Status */}
      {isRFCalculating && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "rgba(10, 10, 15, 0.75)",
            color: "#ff6b00",
            padding: "40px 60px",
            borderRadius: "24px",
            border: "1px solid rgba(255, 107, 0, 0.2)",
            boxShadow:
              "0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 107, 0, 0.1)",
            zIndex: 2000,
            textAlign: "center",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
            minWidth: "300px",
          }}
        >
          <div
            className="spinner"
            style={{
              width: "48px",
              height: "48px",
              border: "3px solid rgba(255, 107, 0, 0.1)",
              borderTop: "3px solid #ff6b00",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              boxShadow: "0 0 15px rgba(255, 107, 0, 0.3)",
            }}
          ></div>
          <style>{`
                  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                  @keyframes pulse-text { 0%, 100% { opacity: 1; } 50% { opacity: 0.7); } }
              `}</style>
          <div
            style={{
              fontSize: "1.2em",
              fontWeight: "600",
              letterSpacing: "1px",
              animation: "pulse-text 2s ease-in-out infinite",
            }}
          >
            CALCULATING RF COVERAGE
          </div>
          <div style={{ fontSize: "0.9em", color: "rgba(255, 255, 255, 0.6)" }}>
            Running ITM propagation model...
          </div>
        </div>
      )}
    </div>
  );
};

export default MapComponent;
