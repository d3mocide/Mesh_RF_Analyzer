import React, { useState, useEffect, useCallback, memo } from 'react';
import { useMapEvents, Marker, Polyline, Popup, Polygon } from 'react-leaflet';
import L from 'leaflet';
import { useRF } from '../../context/RFContext';
import { calculateLinkBudget, calculateFresnelRadius, calculateFresnelPolygon, analyzeLinkProfile } from '../../utils/rfMath';
import { fetchElevationPath } from '../../utils/elevation';
import useThrottledCalculation from '../../hooks/useThrottledCalculation';
import * as turf from '@turf/turf';

// Custom Icons (DivIcon for efficiency)

const txIcon = L.divIcon({
    className: 'custom-icon-tx',
    html: `<div style="background-color: #00ff41; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0, 255, 65, 0.8);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
});

const rxIcon = L.divIcon({
    className: 'custom-icon-rx',
    html: `<div style="background-color: #ff0000; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(255, 0, 0, 0.8);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
});

const LinkLayer = ({ nodes, setNodes, linkStats, setLinkStats, setCoverageOverlay, active = true }) => {
    const { 
        txPower, antennaGain, freq, sf, bw, cableLoss, antennaHeight,
        kFactor, clutterHeight, recalcTimestamp
    } = useRF();

    // Throttled analysis function to avoid API spam during drag
    // We explicitly invoke this instead of relying on useEffect on [nodes]
    // to prevent rapid-fire execution.
    const runAnalysis = useThrottledCalculation(async (currentNodes) => {
        if (currentNodes.length !== 2) return;
        
        setLinkStats(prev => ({ ...prev, loading: true }));
        const [p1, p2] = currentNodes;
        
        try {
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
        } catch (error) {
            console.error("Analysis failed:", error);
            setLinkStats(prev => ({ ...prev, loading: false }));
        }
    }, 50); // 50ms throttle

    // Initial analysis when nodes are first added (not by drag)
    useEffect(() => {
        if (nodes.length === 2) {
             runAnalysis(nodes);
        }
    }, [nodes.length, recalcTimestamp]); // Dependencies that require re-calculation

    useMapEvents({
        click(e) {
            if (!active) return;
            
            // Ignore clicks on UI panels and controls
            if (e.originalEvent && e.originalEvent.target) {
                const target = e.originalEvent.target;
                // Check if click is within a leaflet-control element or batch panel
                if (target.closest('.leaflet-control') || target.closest('[data-batch-panel="true"]')) {
                    return;
                }
            }
            
            const { lat, lng } = e.latlng;
            setNodes(prev => {
                if (prev.length >= 2) return [{ lat, lng, locked: false }]; // Reset if full
                
                const newNodes = [...prev, { lat, lng, locked: false }];
                if (newNodes.length === 2) {
                     // Trigger immediate analysis on click completion
                     runAnalysis(newNodes);
                }
                return newNodes;
            });
            // Reset stats on new click sequence start
            if (nodes.length >= 2) setLinkStats({ minClearance: 0, isObstructed: false, loading: false });
        }
    });

    // Handle Drag (Visual Update Only)
    const handleDrag = useCallback((idx, e) => {
        const marker = e.target;
        const position = marker.getLatLng();
        
        // Optimistic UI Update: Update state immediately for visual feedback
        setNodes(prev => {
            const newNodes = [...prev];
            if (newNodes[idx].locked) return prev; // Guardrail for locked nodes

            newNodes[idx] = { ...newNodes[idx], lat: position.lat, lng: position.lng };
            return newNodes;
        });
    }, [setNodes]);

    // Handle Drag End (Trigger API Analysis)
    const handleDragEnd = useCallback((idx, e) => {
        const marker = e.target;
        const position = marker.getLatLng();
        
        setNodes(prev => {
            const newNodes = [...prev];
             if (newNodes[idx].locked) return prev;

            newNodes[idx] = { ...newNodes[idx], lat: position.lat, lng: position.lng };
            
            // Trigger analysis ONLY here
            if (newNodes.length === 2) {
                runAnalysis(newNodes);
            }
            return newNodes;
        });
    }, [runAnalysis, setNodes]);

    if (nodes.length < 2) {
        return (
            <>
                {nodes.map((pos, idx) => (
                    <Marker 
                        key={idx} 
                        position={pos} 
                        icon={idx === 0 ? txIcon : rxIcon}
                        draggable={!pos.locked && active}
                        eventHandlers={{
                            drag: (e) => handleDrag(idx, e),
                            dragend: (e) => handleDragEnd(idx, e)
                        }}
                     >
                         <Popup>
                             <div><strong>{idx === 0 ? "TX (Point A)" : "RX (Point B)"}</strong></div>
                             {pos.locked && <div><small>(Locked)</small></div>}
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
            {/* Markers and Lines code... */}
            <Marker 
                position={p1} 
                icon={txIcon}
                draggable={!p1.locked && active}
                eventHandlers={{
                    drag: (e) => handleDrag(0, e),
                    dragend: (e) => handleDragEnd(0, e)
                }}
            >
                <Popup>
                    <div><strong>TX (Point A)</strong></div>
                    {p1.locked && <div><small>(Locked)</small></div>}
                </Popup>
            </Marker>
            <Marker 
                position={p2} 
                icon={rxIcon}
                draggable={!p2.locked && active}
                eventHandlers={{
                    drag: (e) => handleDrag(1, e),
                    dragend: (e) => handleDragEnd(1, e)
                }}
            >
                <Popup>
                    <div><strong>RX (Point B)</strong></div>
                    {p2.locked && <div><small>(Locked)</small></div>}
                </Popup>
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

        </>
    );
};

export default memo(LinkLayer);
