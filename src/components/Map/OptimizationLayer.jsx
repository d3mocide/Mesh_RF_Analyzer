import React, { useState, useEffect } from 'react';
import { useMapEvents, Rectangle, Marker, Popup, FeatureGroup } from 'react-leaflet';
import L from 'leaflet';
import { optimizeLocation } from '../../utils/rfService';
import { useRF } from '../../context/RFContext';

const ghostIcon = L.divIcon({
    className: 'ghost-icon',
    html: `<div style="background-color: rgba(0, 255, 255, 0.5); width: 16px; height: 16px; border-radius: 50%; border: 2px dashed white;"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
});

const OptimizationLayer = ({ active, setActive }) => {
    const [startPoint, setStartPoint] = useState(null);
    const [endPoint, setEndPoint] = useState(null);
    const [ghostNodes, setGhostNodes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [locked, setLocked] = useState(false);
    const [notification, setNotification] = useState(null); // { message, type }
    
    const { freq, antennaHeight } = useRF();

    useMapEvents({
        click(e) {
            if (!active) return;
            if (loading) return; // Prevent interaction during load
            if (locked || ghostNodes.length > 0) return; // Prevent interaction after results (user must clear)
            
            if (!startPoint) {
                setStartPoint(e.latlng);
                setEndPoint(e.latlng); // Init box
            } else {
                // Second click completes box
                setEndPoint(e.latlng);
                setLocked(true);
                handleOptimize(e.latlng);
            }
        },
        mousemove(e) {
            if (active && startPoint && !locked && !ghostNodes.length) { // Only drag if searching and not locked
                 if(loading) return; 
                 // Update endPoint to show preview box
                 setEndPoint(e.latlng);
            }
        }
    });

    const handleOptimize = async (finalEndPoint) => {
        if (!startPoint) return;
        
        setLoading(true);
        // Create bounds
        const bounds = L.latLngBounds(startPoint, finalEndPoint);
        
        try {
            const result = await optimizeLocation(bounds, freq, antennaHeight);
            if (result.status === 'success') {
                setGhostNodes(result.locations);
                setNotification({ message: `Optimization complete! Found ${result.locations.length} ideal spots.`, type: 'success' });
            } else {
                 setNotification({ message: result.message || "Optimization failed. Server returned an error.", type: 'error' });
            }
        } catch (err) {
            console.error(err);
            setNotification({ message: "Optimization failed. Please try again.", type: 'error' });
        } finally {
            setLoading(false);
        }
    };
    


    const reset = () => {
        setStartPoint(null);
        setEndPoint(null);
        setGhostNodes([]);
        setLocked(false);
        setNotification(null);
    }

    if (!active && !ghostNodes.length) return null;

    let bounds = null;
    if (startPoint && endPoint) {
        bounds = L.latLngBounds(startPoint, endPoint);
    }

    return (
        <>
            {/* Instruction Panel */}
            {active && !ghostNodes.length && (
                <div style={{
                    position: 'absolute', top: 25, left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.8)', color: 'white', padding: '10px', borderRadius: '8px', zIndex: 1000
                }}>
                    {!startPoint ? "Click to set first corner" : "Click to set opposite corner"}
                </div>
            )}

            {/* Bounding Box */}
            {bounds && (
                <Rectangle 
                    bounds={bounds} 
                    pathOptions={{ color: '#00f2ff', weight: 1, dashArray: '5,5', fillOpacity: 0.1 }} 
                />
            )}

            {/* Ghost Nodes */}
            {ghostNodes.map((node, i) => (
                <Marker key={i} position={[node.lat, node.lon]} icon={ghostIcon}>
                    <Popup>
                        <strong>Ideal Spot #{i+1}</strong><br/>
                        Score: {node.score}
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
                    <div style={{ fontSize: '1.2em', fontWeight: '600', letterSpacing: '1px', animation: 'pulse-text 2s ease-in-out infinite' }}>SCANNING TERRAIN</div>
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
                    
                    {/* Icon */}
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

                    {/* Text */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '1.4em', fontWeight: '700', letterSpacing: '0.5px', color: '#fff' }}>
                            {notification.type === 'success' ? 'OPTIMIZATION COMPLETE' : 'ANALYSIS FAILED'}
                        </div>
                        <div style={{ fontSize: '1em', color: 'rgba(255, 255, 255, 0.7)', maxWidth: '280px', lineHeight: '1.5' }}>
                            {notification.message}
                        </div>
                    </div>

                    {/* Button */}
                    <button 
                        onClick={() => setNotification(null)}
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
                </div>
            )}

             {/* Exit/Clear Button (Only show if we have results and no overlay is up) */}
            {(ghostNodes.length > 0 || active) && !loading && !notification && (
                <>
                    {/* Clear Button */}
                    <div style={{
                        position: 'absolute', top: 100, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
                    }}>
                         <button onClick={reset} style={{ 
                             padding: '8px 24px', 
                             background: 'rgba(0,0,0,0.6)', 
                             color: '#fff', 
                             border: '1px solid rgba(255,255,255,0.2)', 
                             borderRadius: '20px', 
                             cursor: 'pointer',
                             backdropFilter: 'blur(4px)',
                             fontSize: '0.9em',
                             transition: 'all 0.2s ease',
                         }}
                         onMouseOver={(e) => e.target.style.background = 'rgba(0,0,0,0.8)'}
                         onMouseOut={(e) => e.target.style.background = 'rgba(0,0,0,0.6)'}
                         >
                            Clear Optimization
                         </button>
                    </div>
                </>
            )}
        </>
    );
};

export default OptimizationLayer;
