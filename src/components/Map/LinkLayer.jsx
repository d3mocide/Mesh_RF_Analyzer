import React, { useState, useEffect } from 'react';
import { useMapEvents, Marker, Polyline, Popup, Polygon } from 'react-leaflet';
import L from 'leaflet';
import { useRF } from '../../context/RFContext';
import { calculateLinkBudget, calculateFresnelRadius, calculateFresnelPolygon, analyzeLinkProfile } from '../../utils/rfMath';
import { fetchElevationPath } from '../../utils/elevation';
import { analyzeCoverage } from '../../utils/rfService';
import * as turf from '@turf/turf';

// Custom Icons (DivIcon for efficiency)

const txIcon = L.divIcon({
    className: 'custom-icon-tx',
    html: `<div style="background-color: #00ff41; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px black;"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
});

const rxIcon = L.divIcon({
    className: 'custom-icon-rx',
    html: `<div style="background-color: #ff0000; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px black;"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
});

const LinkLayer = ({ nodes, setNodes, linkStats, setLinkStats, setCoverageOverlay, active = true }) => {
    const { 
        txPower, antennaGain, freq, sf, bw, cableLoss, antennaHeight,
        kFactor, clutterHeight 
    } = useRF();

    useMapEvents({
        click(e) {
            if (!active) return;
            const { lat, lng } = e.latlng;
            setNodes(prev => {
                if (prev.length >= 2) return [{ lat, lng }]; // Reset if full
                return [...prev, { lat, lng }];
            });
            // Reset stats on new click sequence start
            if (nodes.length >= 2) setLinkStats({ minClearance: 0, isObstructed: false, loading: false });
        }
    });

    // Elevation & Analysis Effect
    useEffect(() => {
        if (nodes.length !== 2) return;

        const fetchData = async () => {
            setLinkStats(prev => ({ ...prev, loading: true }));
            const [p1, p2] = nodes;
            
            // Fetch Elevation Profile
            const profile = await fetchElevationPath(p1, p2, 50); // 50 samples
            
            if (profile && profile.length > 0) {
                // Analyze
                const analysis = analyzeLinkProfile(
                    profile, 
                    Number(freq), 
                    Number(antennaHeight), 
                    Number(antennaHeight),
                    Number(kFactor),
                    Number(clutterHeight)
                );

                setLinkStats({
                    loading: false,
                    isObstructed: analysis.isObstructed,
                    minClearance: analysis.minClearance,
                    linkQuality: analysis.linkQuality,
                    profileWithStats: analysis.profileWithStats
                });
            } else {
                setLinkStats(prev => ({ ...prev, loading: false }));
            }
        };

        fetchData();
    }, [nodes, freq, antennaHeight, setLinkStats, kFactor, clutterHeight]); 

    if (nodes.length < 2) {
        return (
            <>
                {nodes.map((pos, idx) => (
                    <Marker key={idx} position={pos} icon={idx === 0 ? txIcon : rxIcon}>
                         <Popup>
                             <div><strong>{idx === 0 ? "TX (Point A)" : "RX (Point B)"}</strong></div>
                             <div style={{ marginTop: '5px' }}>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation(); // Prevent map click? React Leaflet handles it.
                                        analyzeCoverage(pos.lat, pos.lng, freq, antennaHeight)
                                            .then(data => {
                                                if(data.map_url && data.bounds) {
                                                    // API returns bounds as [[lat, lon], [lat, lon]]
                                                    const bounds = data.bounds; 
                                                    setCoverageOverlay({ url: 'http://localhost:5001' + data.map_url, bounds });
                                                }
                                            })
                                            .catch(err => alert("Simulation failed: " + err));
                                    }}
                                    style={{
                                        background: '#0a84ff', color: 'white', border: 'none', 
                                        padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8em'
                                    }}
                                >
                                    Simulate Coverage
                                </button>
                             </div>
                         </Popup>
                    </Marker>
                ))}
            </>
        );
    }

    const [p1, p2] = nodes;
    const distance = turf.distance(
        [p1.lng, p1.lat], 
        [p2.lng, p2.lat], 
        { units: 'kilometers' }
    );

    const fresnelRadius = calculateFresnelRadius(distance, freq);
    
    // Calculate Budget
    const budget = calculateLinkBudget({
        txPower, 
        txGain: antennaGain, 
        txLoss: cableLoss,
        rxGain: antennaGain, 
        rxLoss: cableLoss,
        distanceKm: distance, 
        freqMHz: freq,
        sf, bw
    });

    // Determine Color
    let finalColor = '#00ff41'; // Green default
    if (linkStats.isObstructed) {
        finalColor = '#ff0000'; // Obstructed
    } else if (budget.margin < 0) {
        finalColor = '#ff0000'; // No Link Budget
    } else if (budget.margin < 10) {
        finalColor = '#ffbf00'; // Warning
    }

    const fresnelPolygon = calculateFresnelPolygon(p1, p2, freq);

    return (
        <>
            <Marker position={p1} icon={txIcon}>
                <Popup>
                    <div><strong>TX (Point A)</strong></div>
                    <div style={{ marginTop: '5px' }}>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                analyzeCoverage(p1.lat, p1.lng, freq, antennaHeight)
                                    .then(data => {
                                        if(data.map_url && data.bounds) {
                                            const bounds = data.bounds;
                                            setCoverageOverlay({ url: 'http://localhost:5001' + data.map_url, bounds });
                                        }
                                    })
                                    .catch(err => alert("Simulation failed: " + err));
                            }}
                            style={{
                                background: '#0a84ff', color: 'white', border: 'none', 
                                padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8em'
                            }}
                        >
                            Simulate Coverage
                        </button>
                    </div>
                </Popup>
            </Marker>
            <Marker position={p2} icon={rxIcon}>
                <Popup>RX (Point B)</Popup>
            </Marker>
            
            {/* Direct Line of Sight */}
            <Polyline 
                positions={[p1, p2]} 
                pathOptions={{ 
                    color: finalColor, 
                    weight: 3, 
                    dashArray: (budget.margin < 0 || linkStats.isObstructed) ? '10, 10' : null 
                }} 
            />

            {/* Fresnel Zone Visualization (Polygon) */}
            <Polygon 
                positions={fresnelPolygon}
                pathOptions={{ 
                    color: '#00f2ff', 
                    fillOpacity: linkStats.isObstructed ? 0.3 : 0.1, 
                    weight: 1, 
                    dashArray: '5,5',
                    fillColor: linkStats.isObstructed ? '#ff0000' : '#00f2ff'
                }}
            />

            {/* Clear Link Button */}
             <div className="leaflet-bottom leaflet-right" style={{ pointerEvents: 'none', marginBottom: '50px', marginRight: '20px', zIndex: 9999, position: 'absolute' }}>
                 <div style={{ pointerEvents: 'auto' }}> {/* Re-enable pointer events for the button */}
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            // preventDefault to stop map propagation
                            e.preventDefault();
                            setNodes([]);
                            setLinkStats({ minClearance: 0, isObstructed: false, loading: false });
                            setCoverageOverlay(null);
                        }}
                        style={{ 
                             padding: '8px 24px', 
                             background: 'rgba(0,0,0,0.6)', 
                             color: '#fff', 
                             border: '1px solid rgba(255,255,255,0.2)', 
                             borderRadius: '20px', 
                             cursor: 'pointer',
                             backdropFilter: 'blur(4px)',
                             fontSize: '0.9em',
                             transition: 'all 0.2s ease',
                             boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                             zIndex: 9999
                         }}
                         onMouseOver={(e) => e.target.style.background = 'rgba(0,0,0,0.8)'}
                         onMouseOut={(e) => e.target.style.background = 'rgba(0,0,0,0.6)'}
                     >
                        Clear Link
                     </button>
                 </div>
             </div>
        </>
    );
};

export default LinkLayer;
