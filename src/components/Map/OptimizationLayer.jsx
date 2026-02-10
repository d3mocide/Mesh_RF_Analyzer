import React, { useState, useEffect, useRef } from 'react';
import { useMapEvents, useMap, Circle, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { optimizeLocation } from '../../utils/rfService';
import { useRF } from '../../context/RFContext';
import OptimizationResultsPanel from './OptimizationResultsPanel';
import ProfileModal from './ProfileModal';

const createRankedIcon = (rank) => L.divIcon({
    className: 'ghost-icon',
    html: `<div style="
        background-color: #00f2ff; 
        width: 24px; height: 24px; 
        border-radius: 50%; 
        border: 2px solid #00f2ff;
        display: flex; align-items: center; justify-content: center;
        color: #0a0a0f; font-weight: bold; font-family: monospace; font-size: 14px;
        box-shadow: 0 0 10px rgba(0, 242, 255, 0.8);
    ">${rank}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
});

const OptimizationLayer = ({ active, setActive, onStateUpdate, weights }) => {
    // Radial State
    const [center, setCenter] = useState(null);
    const [radiusMeters, setRadiusMeters] = useState(0);
    
    // Common State
    const [ghostNodes, setGhostNodes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [locked, setLocked] = useState(false);
    const [notification, setNotification] = useState(null); // { message, type }
    const [showResults, setShowResults] = useState(false);
    const [selectedNode, setSelectedNode] = useState(null);
    const [heatmapData, setHeatmapData] = useState([]);
    const [showHeatmap, setShowHeatmap] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    
    const map = useMap(); 
    const { freq, antennaHeight, rxHeight, isMobile, kFactor, setKFactor, clutterHeight, setClutterHeight } = useRF();
    const lastSyncRef = useRef({ center: null, loading: false, ghostCount: 0 }); 
    const settingsRef = useRef(null);
    
    useEffect(() => {
        if (settingsRef.current) {
            L.DomEvent.disableClickPropagation(settingsRef.current);
            L.DomEvent.disableScrollPropagation(settingsRef.current);
        }
    });

    // Manual sync helper
    const syncState = (forceState = null) => {
        if (!onStateUpdate) return;
        const stateToSync = forceState || { center, loading, ghostNodes, showResults };
        const prev = lastSyncRef.current;
        
        const centerChanged = stateToSync.center !== prev.center;
        const loadingChanged = stateToSync.loading !== prev.loading;
        const ghostCountChanged = (stateToSync.ghostNodes?.length || 0) !== prev.ghostCount;
        const resultsVisibleChanged = stateToSync.showResults !== prev.showResults;

        if (centerChanged || loadingChanged || ghostCountChanged || resultsVisibleChanged) {
            onStateUpdate(stateToSync);
            lastSyncRef.current = {
                center: stateToSync.center,
                loading: stateToSync.loading,
                ghostCount: stateToSync.ghostNodes?.length || 0,
                showResults: stateToSync.showResults
            };
        }
    };

    useMapEvents({
        click(e) {
            if (!active) return;
            if (loading) return; 
            if (locked || ghostNodes.length > 0) return; 
            
            if (!center) {
                // First Click: Set Center
                setCenter(e.latlng);
                setRadiusMeters(0);
                onStateUpdate?.({ center: e.latlng, loading: false, ghostNodes: [] });
            } else {
                // Second Click: Lock Radius & Scan
                setLocked(true);
                handleOptimize(center, radiusMeters); // pass current radius
                onStateUpdate?.({ center, loading: true, ghostNodes: [], showResults: false });
            }
        },
        mousemove(e) {
            if (active && center && !locked && !ghostNodes.length) { 
                 if(loading) return; 
                 // Update radius based on mouse position
                 const dist = center.distanceTo(e.latlng);
                 setRadiusMeters(dist);
            }
        }
    });

    const handleOptimize = async (scanCenter, scanRadius) => {
        if (!scanCenter || scanRadius < 100) return; // Min 100m radius
        
        setLoading(true);
        
        // Convert Center/Radius to Bounding Box for Backend
        // 1 deg Lat ~= 111km. 1 deg Lon ~= 111km * cos(lat)
        const r_km = scanRadius / 1000.0;
        const lat_deg = r_km / 111.0;
        const lon_deg = r_km / (111.0 * Math.cos(scanCenter.lat * (Math.PI / 180.0)));
        
        const min_lat = scanCenter.lat - lat_deg;
        const max_lat = scanCenter.lat + lat_deg;
        const min_lon = scanCenter.lng - lon_deg;
        const max_lon = scanCenter.lng + lon_deg;
        
        const bounds = L.latLngBounds([min_lat, min_lon], [max_lat, max_lon]);
        
        let finalGhostNodes = ghostNodes; 

        // Create "Home" node from center point
        const homeNode = {
            lat: scanCenter.lat,
            lon: scanCenter.lng,
            height: rxHeight
        };

        try {
            const result = await optimizeLocation(bounds, freq, antennaHeight, rxHeight, weights, kFactor, clutterHeight, [homeNode]);
            if (result.status === 'success') {
                // Filter results to actually be inside the circle? 
                // Backend returns box. We can filter here or just show all in box.
                // Let's filter for visual consistency.
                const filtered = result.locations.filter(loc => {
                    const d = map.distance([loc.lat, loc.lon], scanCenter);
                    return d <= scanRadius * 1.05; // 5% tolerance
                });
                
                setGhostNodes(filtered);
                if (result.heatmap) setHeatmapData(result.heatmap);
                finalGhostNodes = filtered; 
                setShowResults(true); 
            } else {
                setNotification({ message: result.message || "Scan failed.", type: 'error' });
                setLocked(false); 
            }
        } catch (err) {
            console.error(err);
            setNotification({ message: "Scan failed. Please try again.", type: 'error' });
            setLocked(false); 
        } finally {
            setLoading(false);
            onStateUpdate?.({ center: scanCenter, loading: false, ghostNodes: finalGhostNodes, showResults: true }); 
        }
    };
    
    // Helper to trigger rescan from UI (Slider)
    const handleRecalculate = () => {
        if(center && radiusMeters) {
            // clear old results?? or keep them until new ones come?
            // setGhostNodes([]); 
            handleOptimize(center, radiusMeters);
        }
    };

    const reset = () => {
        setCenter(null);
        setRadiusMeters(0);
        setGhostNodes([]);
        setHeatmapData([]);
        setLocked(false);
        setNotification(null);
        setShowResults(false);
        onStateUpdate?.({ center: null, loading: false, ghostNodes: [], showResults: false });
    }

    // Reset when deactivated
    useEffect(() => {
        if (!active) reset();
    }, [active]);

    // Internal auto-close for transient notifications
    useEffect(() => {
        if (notification && notification.transient) {
            const timer = setTimeout(() => { setNotification(null); }, 1000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    if (!active && !ghostNodes.length) return null;

    return (
        <>
            {/* Visuals: Center, Radius, Line */}
            {center && (
                <>
                    {/* Home/TX Marker */}
                    <Marker 
                        position={center}
                        icon={L.divIcon({ 
                            className: 'home-icon', 
                            html: `<div style="width: 20px; height: 20px; background: #00f2ff; border: 2px solid white; box-shadow: 0 0 10px #00f2ff; transform: rotate(45deg);"></div>`, 
                            iconSize: [20, 20], 
                            iconAnchor: [10, 10] 
                        })}
                    />
                    
                    {/* The Scan Circle */}
                    <Circle 
                        center={center}
                        radius={radiusMeters}
                        pathOptions={{ 
                            color: '#00f2ff', 
                            weight: 1, 
                            dashArray: locked ? null : '5,5', 
                            fillOpacity: 0.05,
                            fillColor: '#00f2ff'
                        }}
                    />
                    
                    {/* Radius Radius Line (only whilst dragging) */}
                    {!locked && radiusMeters > 0 && (
                        <div style={{
                            position: 'absolute',
                            left: '50%', top: '50%', 
                            color: 'white', 
                            background: 'rgba(0,0,0,0.5)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            pointerEvents: 'none',
                             // This is tricky to place in LatLng space without a Marker with a DivIcon.
                             // Actually, we can just use a Popup or Tooltip, but let's skip for now to keep it clean.
                        }} />
                    )}
                </>
            )}

            {/* Heatmap Overlay */}
            {heatmapData.length > 0 && showHeatmap && (
                <>
                    {heatmapData.map((pt, i) => {
                         // Optional: Filter heatmap to circle?
                         const dist = map.distance([pt.lat, pt.lon], center);
                         if (dist > radiusMeters) return null;

                         const opacity = Math.max(0.1, pt.score / 150); 
                         let color = '#ff0000';
                         if (pt.score > 80) color = '#00ff41'; 
                         else if (pt.score > 50) color = '#eeff00'; 
                         else if (pt.score > 20) color = '#ff8800'; 
                         
                         return (
                            <Circle 
                                key={`hm-${i}`}
                                center={[pt.lat, pt.lon]}
                                radius={75} 
                                pathOptions={{ 
                                    color: color, 
                                    fillColor: color, 
                                    fillOpacity: 0.3, 
                                    weight: 0 
                                }}
                            />
                         )
                    })}
                </>
            )}

            {/* Ghost Nodes */}
            {ghostNodes.map((node, i) => (
                <Marker 
                    key={i} 
                    position={[node.lat, node.lon]} 
                    icon={createRankedIcon(i + 1)}
                    eventHandlers={{ click: () => setSelectedNode(node) }}
                >
                    <Popup>
                        <strong>Best Signal #{i+1}</strong><br/>
                        Score: {node.score}<br/>
                        <span style={{ fontSize: '0.8em', color: '#00f2ff', cursor: 'pointer' }}>Click to view profile</span>
                    </Popup>
                </Marker>
            ))}
            
            {/* Loading Overlay */}
            {loading && (
                <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    background: 'rgba(10, 10, 15, 0.75)', 
                    color: '#00f2ff', 
                    padding: '40px 60px', 
                    borderRadius: '24px', 
                    border: '1px solid rgba(0, 242, 255, 0.2)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 242, 255, 0.1)',
                    zIndex: 2000,
                    textAlign: 'center',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px',
                    minWidth: '300px'
                }}>
                    <div className="spinner" style={{
                        width: '48px', height: '48px', 
                        border: '3px solid rgba(0, 242, 255, 0.1)', 
                        borderTop: '3px solid #00f2ff', 
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        boxShadow: '0 0 15px rgba(0, 242, 255, 0.3)'
                    }}></div>
                    <style>{`
                        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                        @keyframes pulse-text { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
                    `}</style>
                    <div style={{ fontSize: '1.2em', fontWeight: '600', letterSpacing: '1px', animation: 'pulse-text 2s ease-in-out infinite' }}>SCANNING COVERAGE</div>
                    <div style={{ fontSize: '0.9em', color: 'rgba(255, 255, 255, 0.6)' }}>Calculating RF propagation paths...</div>
                </div>
            )}

            {/* Success/Error Overlay */}
            {notification && !loading && (
                <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    background: 'rgba(10, 10, 15, 0.85)', 
                    color: notification.type === 'success' ? '#4ade80' : '#f87171',
                    padding: '40px 60px', 
                    borderRadius: '24px', 
                    border: notification.type === 'success' ? '1px solid rgba(50, 255, 100, 0.3)' : '1px solid rgba(255, 50, 50, 0.3)',
                    boxShadow: notification.type === 'success' 
                        ? '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 30px rgba(50, 255, 100, 0.1)' 
                        : '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 30px rgba(255, 50, 50, 0.1)',
                    zIndex: 2000,
                    textAlign: 'center',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '20px',
                    minWidth: '320px',
                    animation: 'fadeIn 0.3s ease-out'
                }}>
                    <style>{`
                        @keyframes fadeIn { from { opacity: 0; transform: translate(-50%, -40%); } to { opacity: 1; transform: translate(-50%, -50%); } }
                    `}</style>
                    
                    <div style={{
                        width: '64px', height: '64px',
                        borderRadius: '50%',
                        background: notification.type === 'success' ? 'rgba(50, 255, 100, 0.1)' : 'rgba(255, 50, 50, 0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: notification.type === 'success' ? '2px solid rgba(50, 255, 100, 0.2)' : '2px solid rgba(255, 50, 50, 0.2)',
                        marginBottom: '4px'
                    }}>
                        {notification.type === 'success' ? (
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        ) : (
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '1.4em', fontWeight: '700', letterSpacing: '0.5px', color: '#fff' }}>
                            {notification.type === 'success' ? 'SCAN COMPLETE' : 'ANALYSIS FAILED'}
                        </div>
                        <div style={{ fontSize: '1em', color: 'rgba(255, 255, 255, 0.7)', maxWidth: '280px', lineHeight: '1.5' }}>
                            {notification.message}
                        </div>
                    </div>

                    {!notification.transient && (
                        <button 
                            onClick={() => {
                                if (notification.type === 'success') {
                                    setShowResults(true);
                                    setNotification(null);
                                } else {
                                    setNotification(null);
                                }
                            }}
                            style={{
                                marginTop: '12px',
                                padding: '12px 32px',
                                background: notification.type === 'success' 
                                    ? 'linear-gradient(90deg, rgba(50, 255, 100, 0.2), rgba(50, 255, 100, 0.1))' 
                                    : 'linear-gradient(90deg, rgba(255, 50, 50, 0.2), rgba(255, 50, 50, 0.1))',
                                border: notification.type === 'success' ? '1px solid rgba(50, 255, 100, 0.4)' : '1px solid rgba(255, 50, 50, 0.4)',
                                borderRadius: '12px',
                                color: 'white',
                                fontWeight: '600',
                                cursor: 'pointer',
                                fontSize: '1em',
                                transition: 'all 0.2s ease',
                                textTransform: 'uppercase',
                                letterSpacing: '1px'
                            }}
                            onMouseOver={(e) => {
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = notification.type === 'success' 
                                    ? '0 0 15px rgba(50, 255, 100, 0.3)' 
                                    : '0 0 15px rgba(255, 50, 50, 0.3)';
                            }}
                            onMouseOut={(e) => {
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = 'none';
                            }}
                        >
                            {notification.type === 'success' ? 'VIEW RESULTS' : 'CLOSE'}
                        </button>
                    )}
                </div>
            )}
            
            {/* Results Panel */}
            {showResults && ghostNodes.length > 0 && (
                <OptimizationResultsPanel 
                    results={ghostNodes} 
                    onClose={() => setShowResults(false)}
                    onCenter={(node) => {
                        if (map) map.flyTo([node.lat, node.lon], 16, { duration: 1.5 });
                    }}
                    onReset={reset}
                    onRecalculate={handleRecalculate}
                />
            )}

             {/* Profile Modal */}
            {selectedNode && (
                <ProfileModal
                    tx={{ lat: center.lat, lon: center.lng, height: antennaHeight }}
                    rx={{ lat: selectedNode.lat, lon: selectedNode.lon, height: rxHeight }}
                    context={{ freq }}
                    onClose={() => setSelectedNode(null)}
                />
            )}
            
            {/* Advanced Settings & Legend */}
            {(active || ghostNodes.length > 0) && (
                <div className="settings-panel" 
                    ref={settingsRef}
                    style={{
                        position: 'absolute', bottom: '30px', left: '20px',
                        background: 'rgba(10, 10, 15, 0.95)', padding: '15px',
                        borderRadius: '12px', border: '1px solid #00f2ff',
                        zIndex: 9999, color: '#fff', fontSize: '0.9em',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 0 20px rgba(0,0,0,0.5)',
                        cursor: 'default'
                }}>
                    <div 
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowSettings(!showSettings);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: showSettings ? '10px' : '0' }}
                    >
                        <span style={{ color: '#00f2ff' }}>⚙️ Advanced RF</span>
                        <span style={{ fontSize: '0.8em', color: '#666' }}>{showSettings ? '▲' : '▼'}</span>
                    </div>
                    
                    {showSettings && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '200px' }}>
                             {/* Radius Slider (New) */}
                             {locked && (
                                <label style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #333', paddingBottom: '8px' }}>
                                    <span>Radius: {(radiusMeters/1000).toFixed(1)} km</span>
                                    <input 
                                        type="range" min="1000" max="20000" step="500" 
                                        value={radiusMeters} 
                                        onChange={e => {
                                            const r = parseFloat(e.target.value);
                                            setRadiusMeters(r);
                                        }}
                                        onMouseUp={handleRecalculate}
                                        onTouchEnd={handleRecalculate}
                                    />
                                </label>
                             )}

                            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Refraction (K): {kFactor}</span>
                                <input 
                                    type="range" min="0.5" max="2.0" step="0.01" 
                                    value={kFactor} onChange={e => setKFactor(parseFloat(e.target.value))}
                                />
                            </label>
                            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Clutter (m): {clutterHeight}</span>
                                <input 
                                    type="number" min="0" max="50" style={{ width: '50px', background: '#333', border: 'none', color: '#fff', padding: '2px' }}
                                    value={clutterHeight} onChange={e => setClutterHeight(parseFloat(e.target.value))}
                                />
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', borderTop: '1px solid #333', paddingTop: '5px' }}>
                                <input 
                                    type="checkbox" 
                                    checked={showHeatmap} 
                                    onChange={e => setShowHeatmap(e.target.checked)} 
                                />
                                <span>Show Heatmap Overlay</span>
                            </label>
                        </div>
                    )}
                </div>
            )}

        </>
    );
};

export default OptimizationLayer;
