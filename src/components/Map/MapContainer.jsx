import React, { useState } from 'react';
import { MapContainer, TileLayer, ImageOverlay, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import LinkLayer from './LinkLayer';
import LinkAnalysisPanel from './LinkAnalysisPanel';
import OptimizationLayer from './OptimizationLayer';
import { useRF } from '../../context/RFContext';
import { calculateLinkBudget } from '../../utils/rfMath';
import * as turf from '@turf/turf';
import DeckGLOverlay from './DeckGLOverlay';
import WasmViewshedLayer from './WasmViewshedLayer';
import { useViewshedTool } from '../../hooks/useViewshedTool';
import BatchNodesPanel from './BatchNodesPanel';

// Fix for default marker icon issues in React Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

import { useMapEvents, useMap } from 'react-leaflet';

const ViewshedClickHandler = ({ active, runAnalysis, setObserver }) => {
    useMapEvents({
        click(e) {
            if (active) {
                const { lat, lng } = e.latlng;
                
                // Set observer immediately for UI feedback
                setObserver({ lat, lng, height: 2.0 });

                // Run Wasm Analysis
                // Default props for now
                runAnalysis(lat, lng, 2.0, 5000); 
            }
        }
    });
    return null;
};

// Wrapper component to access map instance for BatchNodesPanel
const BatchNodesPanelWrapper = ({ nodes, selectedNodes, onClear, onNodeSelect }) => {
  const map = useMap();
  
  const handleCenter = (node) => {
    map.flyTo([node.lat, node.lng], 15, { duration: 1.5 });
  };
  
  return <BatchNodesPanel nodes={nodes} selectedNodes={selectedNodes} onCenter={handleCenter} onClear={onClear} onNodeSelect={onNodeSelect} />;
};

const MapComponent = () => {
  // Default Map Center (Portland, OR)
  const defaultLat = parseFloat(import.meta.env.VITE_MAP_LAT) || 45.5152;
  const defaultLng = parseFloat(import.meta.env.VITE_MAP_LNG) || -122.6784;
  const position = [defaultLat, defaultLng];

  // Lifted State
  const [nodes, setNodes] = useState([]); 
  const [linkStats, setLinkStats] = useState({ minClearance: 0, isObstructed: false, loading: false });
  const [coverageOverlay, setCoverageOverlay] = useState(null); // { url, bounds }
  const [toolMode, setToolMode] = useState('link'); // 'link', 'optimize', 'viewshed', 'none'
  const [viewshedObserver, setViewshedObserver] = useState(null); // Single Point for Viewshed Tool
  const [selectedBatchNodes, setSelectedBatchNodes] = useState([]); // Track selected batch nodes for linking: [{ id, role: 'TX' | 'RX' }]
  
  // Wasm Viewshed Tool Hook
  const { runAnalysis, resultLayer, isCalculating } = useViewshedTool(toolMode === 'viewshed');
  
  // Calculate Budget at container level for Panel
  const { txPower, antennaGain, freq, sf, bw, cableLoss, units, mapStyle, batchNodes, showBatchPanel, setShowBatchPanel, setBatchNodes } = useRF();
  
  // Map Configs
  const MAP_STYLES = {
      dark: {
          url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      },
      light: {
          url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      },
      topo: {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
          attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
      },
      satellite: {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
      }
  };

  const currentStyle = MAP_STYLES[mapStyle] || MAP_STYLES.dark;

  let budget = null;
  let distance = 0;

  if (nodes.length === 2) {
      const [p1, p2] = nodes;
      distance = turf.distance(
          [p1.lng, p1.lat], 
          [p2.lng, p2.lat], 
          { units: 'kilometers' }
      );

      budget = calculateLinkBudget({
          txPower, 
          txGain: antennaGain, 
          txLoss: cableLoss,
          rxGain: antennaGain, 
          rxLoss: cableLoss,
          distanceKm: distance, 
          freqMHz: freq,
          sf, bw
      });
  }

  // Helper to reset all tool states (Clear View)
  const resetToolState = () => {
      setNodes([]); 
      setLinkStats({ minClearance: 0, isObstructed: false, loading: false });
      setCoverageOverlay(null);
      setViewshedObserver(null);
      setSelectedBatchNodes([]); // Clear batch node selections
  };

  // Prepare DeckGL Layers
  const deckLayers = [];
  
  // Viewshed Layer (Only active in 'viewshed' mode)
  if (toolMode === 'viewshed' && resultLayer && resultLayer.data) {
      // Create ImageData or similar for the bitmap
      // resultLayer.data is Uint8Array
      // We need to convert it to a format deck.gl accepts.
      // Fastest: Create ImageData
      const { width, height, data } = resultLayer;
      // We need RGBA for standard ImageData? Or just passing typed array might fail if not formatted?
      // Actually, BitmapLayer supports `image` as ImageData.
      // Let's pack R channel.
      const rgbaData = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < width * height; i++) {
          const val = data[i];
          rgbaData[i * 4] = val;     // R
          rgbaData[i * 4 + 1] = 0;   // G
          rgbaData[i * 4 + 2] = 0;   // B
          rgbaData[i * 4 + 3] = 255; // A (Opacity handled in shader or here)
      }
      const imageData = new ImageData(rgbaData, width, height);
      
      deckLayers.push(new WasmViewshedLayer({
          id: 'wasm-viewshed-layer',
          image: imageData,
          bounds: [resultLayer.bounds.west, resultLayer.bounds.south, resultLayer.bounds.east, resultLayer.bounds.north],
          opacity: 0.6
      }));
  }

  return (
    <div style={{ flex: 1, height: '100%', position: 'relative' }}>
      <MapContainer 
        center={position} 
        zoom={13} 
        style={{ height: '100%', width: '100%', background: '#0a0a0f' }}
      >
        <ViewshedClickHandler 
            active={toolMode === 'viewshed'} 
            setObserver={setViewshedObserver} 
            runAnalysis={runAnalysis}
        />
        <TileLayer
          attribution={currentStyle.attribution}
          url={currentStyle.url} 
        />
        <DeckGLOverlay layers={deckLayers} />
        
        <LinkLayer 
            nodes={nodes} 
            setNodes={setNodes}
            linkStats={linkStats}
            setLinkStats={setLinkStats}
            setCoverageOverlay={setCoverageOverlay}
            active={toolMode === 'link'}
        />
        {coverageOverlay && (
             <ImageOverlay 
                url={coverageOverlay.url}
                bounds={coverageOverlay.bounds}
                opacity={0.6}
             />
        )}
        
        {/* Visual Marker for Viewshed Observer */}
        {toolMode === 'viewshed' && viewshedObserver && (
            <Marker 
                position={viewshedObserver} 
                draggable={true}
                eventHandlers={{
                    dragend: (e) => {
                         const { lat, lng } = e.target.getLatLng();
                         // Fetch Elevation again on drag end
                        fetch('http://localhost:5001/get-elevation', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ lat, lon: lng })
                        })
                        .then(res => res.json())
                        .then(data => {
                            console.log("Viewshed Debug - Fetched Elevation:", data);
                            const elevation = data.elevation || 0;
                            const newObserver = { lat, lng, height: elevation + 2.0 };
                            console.log("Viewshed Debug - Setting Observer:", newObserver);
                            setViewshedObserver(newObserver);
                        })
                        .catch(err => {
                             console.error("Failed to fetch height", err);
                             setViewshedObserver({ lat, lng, height: 2.0 });
                        });
                    }
                }}
            >
                <Popup>Allowed Observer Location</Popup>
            </Marker>
        )}
        <OptimizationLayer active={toolMode === 'optimize'} setActive={(active) => setToolMode(active ? 'optimize' : 'none')} />
        
        {/* Batch Nodes Rendering */}
        {batchNodes.length > 0 && batchNodes.map((node) => {
            // Check if this node is selected
            const selection = selectedBatchNodes.find(s => s.id === node.id);
            const isSelected = !!selection;
            const role = selection?.role;
            
            // Determine styling based on selection
            let className = 'batch-node-icon';
            let bgColor = '#00f2ff';
            let boxShadow = '0 0 8px rgba(0, 242, 255, 0.6)';
            
            if (isSelected) {
                if (role === 'TX') {
                    // Don't add animation class - it causes ghost elements
                    bgColor = '#00ff41';
                    boxShadow = '0 0 12px rgba(0, 255, 65, 0.8)';
                } else if (role === 'RX') {
                    // Don't add animation class - it causes ghost elements
                    bgColor = '#ff0000';
                    boxShadow = '0 0 12px rgba(255, 0, 0, 0.8)';
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
                        iconAnchor: [6, 6]
                    })}
                    eventHandlers={{
                        click: () => {
                            if (toolMode === 'link') {
                                // Handle selection logic
                                if (selectedBatchNodes.length === 0) {
                                    // First selection - TX
                                    setSelectedBatchNodes([{ id: node.id, role: 'TX' }]);
                                    setNodes([{ lat: node.lat, lng: node.lng }]);
                                } else if (selectedBatchNodes.length === 1) {
                                    // Second selection - RX, create link
                                    setSelectedBatchNodes([...selectedBatchNodes, { id: node.id, role: 'RX' }]);
                                    setNodes([...nodes, { lat: node.lat, lng: node.lng }]);
                                } else if (selectedBatchNodes.length === 2) {
                                    // Third click - restart selection process
                                    setSelectedBatchNodes([{ id: node.id, role: 'TX' }]);
                                    setNodes([{ lat: node.lat, lng: node.lng }]);
                                }
                            }
                        }
                    }}
                >
                    <Popup>{node.name}</Popup>
                </Marker>
            );
        })}
        
        {/* Batch Nodes Panel - Must be inside MapContainer to use useMap hook */}
        {showBatchPanel && batchNodes.length > 0 && (
            <BatchNodesPanelWrapper 
                nodes={batchNodes}
                selectedNodes={selectedBatchNodes}
                onClear={() => {
                    setBatchNodes([]);
                    setShowBatchPanel(false);
                    setSelectedBatchNodes([]); // Clear selections when clearing all nodes
                }}
                onNodeSelect={(node) => {

                    // Only allow selection in link mode
                    if (toolMode === 'link') {
                        if (selectedBatchNodes.length === 0) {
                            // First selection - TX
                            setSelectedBatchNodes([{ id: node.id, role: 'TX' }]);
                            setNodes([{ lat: node.lat, lng: node.lng }]);
                        } else if (selectedBatchNodes.length === 1) {
                            // Second selection - RX, create link
                            setSelectedBatchNodes([...selectedBatchNodes, { id: node.id, role: 'RX' }]);
                            setNodes([...nodes, { lat: node.lat, lng: node.lng }]);
                        } else if (selectedBatchNodes.length === 2) {
                            // Third click - restart selection process
                            setSelectedBatchNodes([{ id: node.id, role: 'TX' }]);
                            setNodes([{ lat: node.lat, lng: node.lng }]);
                        }
                    }
                }}
            />
        )}
      </MapContainer>

      {/* Tool Toggles */}
      <div style={{ position: 'absolute', top: 20, left: 60, zIndex: 1000, display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => {
                if (toolMode === 'link') {
                    resetToolState();
                    setToolMode('none');
                } else {
                    resetToolState();
                    setToolMode('link');
                }
            }}
            style={{
                background: toolMode === 'link' ? '#00ff41' : '#222',
                color: toolMode === 'link' ? '#000' : '#fff',
                border: '1px solid #444',
                padding: '8px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
            }}
          >
            Link Analysis
          </button>

          <button 
            onClick={() => {
                if(toolMode === 'optimize') {
                    resetToolState();
                    setToolMode('none');
                } else {
                    resetToolState();
                    setToolMode('optimize');
                }
            }}
            style={{
                background: toolMode === 'optimize' ? '#00f2ff' : '#222',
                color: toolMode === 'optimize' ? '#000' : '#fff',
                border: '1px solid #444',
                padding: '8px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
            }}
          >
            {toolMode === 'optimize' ? 'Cancel Scan' : 'Elevation Scan'}
          </button>


          
          <button 
            onClick={() => {
                if(toolMode === 'viewshed') {
                    resetToolState();
                    setToolMode('none');
                } else {
                    resetToolState();
                    setToolMode('viewshed');
                }
            }}
            style={{
                display: 'none', // Hidden - requires backend server at localhost:5001
                background: toolMode === 'viewshed' ? '#22ff00' : '#222',
                color: toolMode === 'viewshed' ? '#000' : '#fff',
                border: '1px solid #444',
                padding: '8px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
            }}
          >
            Viewshed
          </button>
      </div>
      
      {/* Clear Link Button - Shows when link nodes exist */}
      {nodes.length > 0 && (
          <div style={{ position: 'absolute', top: 65, left: 70, zIndex: 1000 }}>
              <button 
                  onClick={() => {
                      setNodes([]);
                      setLinkStats({ minClearance: 0, isObstructed: false, loading: false });
                      setCoverageOverlay(null);
                      setSelectedBatchNodes([]); // Clear batch node selections
                  }}
                  style={{
                      background: 'rgba(255, 50, 50, 0.9)',
                      color: '#fff',
                      border: '1px solid rgba(255, 100, 100, 0.5)',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.85em',
                      fontWeight: 600,
                      boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
                      transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => e.target.style.background = 'rgba(255, 50, 50, 1)'}
                  onMouseOut={(e) => e.target.style.background = 'rgba(255, 50, 50, 0.9)'}
              >
                  Clear Link
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
          />
      )}
      
    </div>
  );
};

export default MapComponent;
