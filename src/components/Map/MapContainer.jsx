import React, { useState } from 'react';
import { MapContainer, TileLayer, ImageOverlay } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import LinkLayer from './LinkLayer';
import LinkAnalysisPanel from './LinkAnalysisPanel';
import OptimizationLayer from './OptimizationLayer';
import { useRF } from '../../context/RFContext';
import { calculateLinkBudget } from '../../utils/rfMath';
import * as turf from '@turf/turf';

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

const MapComponent = () => {
  // Default Map Center (Portland, OR)
  const defaultLat = parseFloat(import.meta.env.VITE_MAP_LAT) || 45.5152;
  const defaultLng = parseFloat(import.meta.env.VITE_MAP_LNG) || -122.6784;
  const position = [defaultLat, defaultLng];

  // Lifted State
  const [nodes, setNodes] = useState([]); 
  const [linkStats, setLinkStats] = useState({ minClearance: 0, isObstructed: false, loading: false });
  const [coverageOverlay, setCoverageOverlay] = useState(null); // { url, bounds }
  const [toolMode, setToolMode] = useState('link'); // 'link', 'optimize', 'none'
  
  // Calculate Budget at container level for Panel
  const { txPower, antennaGain, freq, sf, bw, cableLoss, units, mapStyle, batchNodes } = useRF();
  
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

  return (
    <div style={{ flex: 1, height: '100%', position: 'relative' }}>
      <MapContainer 
        center={position} 
        zoom={13} 
        style={{ height: '100%', width: '100%', background: '#0a0a0f' }}
      >
        <TileLayer
          attribution={currentStyle.attribution}
          url={currentStyle.url} 
        />
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
        <OptimizationLayer active={toolMode === 'optimize'} setActive={(active) => setToolMode(active ? 'optimize' : 'none')} />
      </MapContainer>

      {/* Tool Toggles */}
      <div style={{ position: 'absolute', top: 20, left: 60, zIndex: 1000, display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => {
                if (toolMode === 'link') {
                    // Toggling OFF
                    setToolMode('none');
                    setNodes([]);
                    setLinkStats({ minClearance: 0, isObstructed: false, loading: false });
                    setCoverageOverlay(null);
                } else {
                    // Toggling ON
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
            onClick={() => setToolMode(toolMode === 'optimize' ? 'none' : 'optimize')}
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
            {toolMode === 'optimize' ? 'Cancel Find' : 'Find Ideal Spot'}
          </button>
      </div>

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
      
      {/* Batch Nodes Rendering */}
      {batchNodes.length > 0 && batchNodes.map((node) => (
          <L.Marker 
              key={`batch-${node.id}`} 
              position={[node.lat, node.lng]} 
              icon={L.divIcon({
                  className: 'batch-node-icon',
                  html: `<div style="background-color: #aaa; width: 8px; height: 8px; border-radius: 50%; opacity: 0.7; border: 1px solid #000;"></div>`,
                  iconSize: [8, 8],
                  iconAnchor: [4, 4]
              })}
          >
              <L.Popup>{node.name}</L.Popup>
          </L.Marker>
      ))}
    </div>
  );
};

export default MapComponent;
