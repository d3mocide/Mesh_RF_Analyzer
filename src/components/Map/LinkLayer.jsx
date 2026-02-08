import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import PropTypes from 'prop-types';
import { useMapEvents, Marker, Polyline, Popup, Polygon } from 'react-leaflet';
import L from 'leaflet';
import { useRF, GROUND_TYPES } from '../../context/RFContext';
import { DEVICE_PRESETS } from '../../data/presets';
import { calculateLinkBudget, calculateFresnelRadius, calculateFresnelPolygon, analyzeLinkProfile, calculateBullingtonDiffraction } from '../../utils/rfMath';
import { fetchElevationPath } from '../../utils/elevation';
import { calculateLink } from '../../utils/rfService';
import { useWasmITM } from '../../hooks/useWasmITM';
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

const LinkLayer = ({ nodes, setNodes, linkStats, setLinkStats, setCoverageOverlay, active = true, locked = false, propagationSettings, onManualClick }) => {
    const { 
        txPower: proxyTx, antennaGain: proxyGain, // we ignore proxies for calc
        freq, sf, bw, cableLoss, antennaHeight,
        kFactor, clutterHeight, recalcTimestamp,
        editMode, setEditMode, nodeConfigs, fadeMargin,
        groundType, climate
    } = useRF();
    // Refs for Manual Update Mode
    const configRef = useRef({ nodeConfigs, freq, kFactor, clutterHeight });

    // Refs for direct visual manipulation
    const polylineRef = useRef(null);
    const fresnelRef = useRef(null);
    const markerRefA = useRef(null);
    const markerRefB = useRef(null);

    useEffect(() => {
        configRef.current = { nodeConfigs, freq, kFactor, clutterHeight };
    }, [nodeConfigs, freq, kFactor, clutterHeight]);

    // Initialize WASM ITM Hook
    const { calculatePathLoss: calculateITM, isReady: itmReady } = useWasmITM();

    const getIcon = (type, isEditing) => {
        if (type === 'tx') {
            return L.divIcon({
                className: 'custom-icon-tx',
                html: `<div style="background-color: #00ff41; width: ${isEditing ? 24 : 20}px; height: ${isEditing ? 24 : 20}px; border-radius: 50%; border: ${isEditing ? '4px' : '3px'} solid white; box-shadow: 0 0 ${isEditing ? '15px' : '10px'} rgba(0, 255, 65, ${isEditing ? 1 : 0.8}); transition: all 0.2s ease;"></div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
        }
        return L.divIcon({
            className: 'custom-icon-rx',
            html: `<div style="background-color: #ff0000; width: ${isEditing ? 24 : 20}px; height: ${isEditing ? 24 : 20}px; border-radius: 50%; border: ${isEditing ? '4px' : '3px'} solid white; box-shadow: 0 0 ${isEditing ? '15px' : '10px'} rgba(255, 0, 0, ${isEditing ? 1 : 0.8}); transition: all 0.2s ease;"></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
    };

    const runAnalysis = useCallback((p1, p2) => {
        if (!p1 || !p2) return;
        
        setLinkStats(prev => ({ ...prev, loading: true }));
        
        const currentConfig = configRef.current;
        const h1 = parseFloat(currentConfig.nodeConfigs.A.antennaHeight);
        const h2 = parseFloat(currentConfig.nodeConfigs.B.antennaHeight);
        const currentFreq = currentConfig.freq;
        const currentModel = propagationSettings?.model?.toLowerCase() || 'itm_wasm';
        const currentEnv = propagationSettings?.environment || 'suburban';

        // Parallel fetch: Elevation for profile/chart, and Path Loss from Backend
        Promise.all([
            fetchElevationPath(p1, p2),
            (currentModel === 'hata' || currentModel === 'bullington' || currentModel === 'itm') 
                ? calculateLink(p1, p2, currentFreq, h1, h2, currentModel, currentEnv, currentConfig.kFactor, currentConfig.clutterHeight)
                : Promise.resolve(null)
        ])
        .then(async ([profile, backendResult]) => {
            // WASM ITM Calculation override
            if (currentModel === 'itm_wasm' && itmReady && profile) {
                try {
                    // Convert profile to flat array and calculate step size
                    const elevationData = new Float32Array(profile.map(p => p.elevation));
                    // Calculate step size from profile distance
                    const totalDistMeters = profile[profile.length - 1].distance * 1000;
                    const stepSize = totalDistMeters / (profile.length - 1);
                    
                    const ground = GROUND_TYPES[groundType] || GROUND_TYPES['Average Ground'];
                    const loss = await calculateITM({
                        elevationProfile: elevationData,
                        stepSizeMeters: stepSize,
                        frequencyMHz: currentFreq,
                        txHeightM: h1,
                        rxHeightM: h2,
                        groundEpsilon: ground.epsilon,
                        groundSigma: ground.sigma,
                        climate: climate
                    });
                    
                    if (loss && loss !== Infinity) {
                        backendResult = { path_loss_db: loss };
                    }
                } catch (e) {
                    console.error("WASM ITM Failed", e);
                }
            }

            const stats = analyzeLinkProfile(
                profile, 
                currentFreq, 
                h1, h2, 
                currentConfig.kFactor, 
                currentConfig.clutterHeight
            );

            // If we have a backend result, use its path loss instead of frontend FSPL
            if (backendResult && backendResult.path_loss_db) {
                stats.backendPathLoss = backendResult.path_loss_db;
            }

            setLinkStats(prev => ({ ...prev, ...stats, loading: false }));
        })
        .catch(err => {
            console.error("Link Analysis Failed", err);
            setLinkStats(prev => ({ ...prev, loading: false, isObstructed: false, minClearance: 0 }));
        });
    }, [setLinkStats, propagationSettings]);

    useEffect(() => {
        if (nodes.length === 2) {
             runAnalysis(nodes[0], nodes[1]);
        }
    }, [nodes, runAnalysis, recalcTimestamp]);

    useMapEvents({
        click(e) {
            if (!active || locked) return;
            
            // Notify parent about manual click to manage batch node highlights
            if (onManualClick) {
                onManualClick(e);
                return;
            }

            // 3rd Click Logic: Restart Link
            if (nodes.length >= 2) {
                const newNode = { 
                    lat: e.latlng.lat, 
                    lng: e.latlng.lng,
                    locked: false
                };
                setNodes([newNode]);
                setEditMode('A');
                setLinkStats({ minClearance: 0, isObstructed: false, loading: false }); // Reset stats
                return;
            }

            const newNode = { 
                lat: e.latlng.lat, 
                lng: e.latlng.lng,
                locked: false
            };

            const newNodes = [...nodes, newNode];
            setNodes(newNodes);

            if (newNodes.length === 1) {
                setEditMode('A'); // Start editing TX
            } else if (newNodes.length === 2) {
                setEditMode('B'); // Then RX
            }
        }
    });

    // We DO NOT handle 'drag' event to update state continuously. 
    // This causes re-renders that interrupt the Leaflet drag behavior.
    // Leaflet manages the drag visual natively. We only sync on dragend.

    const handleDragEnd = (index, e) => {
        const { lat, lng } = e.target.getLatLng();
        setNodes(prev => {
            const copy = [...prev];
            copy[index] = { ...copy[index], lat, lng };
            // Trigger recalculation handled by useEffect
            return copy;
        });
    };

    // Hybrid Drag Logic: Update visuals via Leaflet API (fast), update State on drop (slow)
    const handleDragVisual = (index, e) => {
        // 1. Update Line
        if (polylineRef.current) {
            const newPos = e.target.getLatLng();
            const otherPos = index === 0 ? nodes[1] : nodes[0];
            
            if (otherPos) {
                const points = index === 0 ? [newPos, otherPos] : [otherPos, newPos];
                polylineRef.current.setLatLngs(points);
            }
        }

        // 2. Hide Fresnel Zone (Too expensive to recalc real-time, so we hide it)
        if (fresnelRef.current) {
            fresnelRef.current.setStyle({ fillOpacity: 0, opacity: 0 });
        }
    };

    if (nodes.length < 2) {
        return (
            <>
                {nodes.map((pos, idx) => {
                    // Suppress LinkLayer marker if it's already rendered by the BatchNodes system
                    if (pos.isBatch) return null;

                    return (
                        <Marker 
                            key={idx} 
                            position={pos} 
                            icon={getIcon(idx === 0 ? 'tx' : 'rx', (idx === 0 && editMode === 'A') || (idx === 1 && editMode === 'B'))}
                            draggable={!pos.locked && active && !locked}
                            eventHandlers={{
                                dragend: (e) => handleDragEnd(idx, e),
                                click: (e) => {
                                    L.DomEvent.stopPropagation(e); // Prevent map click from resetting
                                    setEditMode(idx === 0 ? 'A' : 'B');
                                }
                            }}
                        >
                            <Popup>
                                <div><strong>{idx === 0 ? "TX (Point A)" : "RX (Point B)"}</strong></div>
                                {(pos.locked || locked) && <div><small>(Locked)</small></div>}
                                <div style={{marginTop: '4px', fontSize: '0.9em', color: '#888'}}>
                                    {((idx === 0 && editMode === 'A') || (idx === 1 && editMode === 'B')) ? "(Editing)" : "Click to Edit"}
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
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
    
    // Calculate Budget using explicit Node A (TX) -> Node B (RX) logic
    const configA = nodeConfigs.A;
    const configB = nodeConfigs.B;

    const budget = calculateLinkBudget({
        txPower: configA.txPower, 
        txGain: configA.antennaGain, 
        txLoss: DEVICE_PRESETS[configA.device]?.loss || 0,
        rxGain: configB.antennaGain, 
        rxLoss: DEVICE_PRESETS[configB.device]?.loss || 0,
        distanceKm: distance, 
        freqMHz: freq,
        sf, bw,
        pathLossOverride: linkStats.backendPathLoss || null,
        fadeMargin
    });
    
    // Calculate Diffraction Loss (Bullington) for visualization
    let diffractionLoss = 0;
    if (propagationSettings?.model === 'Hata' && linkStats.profileWithStats) {
         diffractionLoss = calculateBullingtonDiffraction(
            linkStats.profileWithStats, 
            freq, 
            configA.antennaHeight, 
            configB.antennaHeight
        );
    }

    // Determine Color and Style
    // We used to ignore obstruction if using Hata, but user wants consistent "Red" if physically obstructed
    // regardless of whether the signal margin is technically good via diffraction.
    
    // Default to 'Excellent' Green
    let finalColor = '#00ff41'; 
    let isBadLink = false;

    // 1. Obstruction Check (Overrides everything)
    if (linkStats.isObstructed || (linkStats.linkQuality && linkStats.linkQuality.includes('Obstructed'))) {
        finalColor = '#ff0000'; 
        isBadLink = true;
    } 
    // 2. Margin-based Coloring (Matches LinkAnalysisPanel.jsx)
    else {
        const m = budget.margin - diffractionLoss; // Adjust margin by diffraction loss
        if (m >= 10) {
            finalColor = '#00ff41'; // Excellent +++
        } else if (m >= 5) {
            finalColor = '#00ff41'; // Good ++ (Same green for simplicity, or slightly different?) config uses same
        } else if (m >= 0) {
            finalColor = '#eeff00'; // Fair + (Yellow)
        } else if (m >= -10) {
            finalColor = '#ffbf00'; // Marginal -+ (Orange)
            isBadLink = false; // It's marginal, but established. Not "broken".
        } else {
            finalColor = '#ff0000'; // No Signal - (Red)
            isBadLink = true;
        }
    }
    
    // Dash line if it's a "Bad" link (No Signal or Physical Obstruction)
    const dashStyle = isBadLink ? '10, 10' : null;

    const fresnelPolygon = calculateFresnelPolygon(p1, p2, freq);

    return (
        <>
            {/* Markers and Lines code... */}
            {!p1.isBatch && (
                <Marker 
                    ref={markerRefA}
                    position={p1} 
                    icon={getIcon('tx', editMode === 'A')}
                    draggable={!p1.locked && active && !locked}
                    eventHandlers={{
                        drag: (e) => handleDragVisual(0, e), // Visual only
                        dragend: (e) => handleDragEnd(0, e), // Commit state
                        click: (e) => {
                            L.DomEvent.stopPropagation(e);
                            setEditMode('A');
                        }
                    }}
                >
                    <Popup>
                        <div style={{ paddingRight: '24px' }}><strong>TX (Point A)</strong></div>
                        {(p1.locked || locked) && <div><small>(Locked)</small></div>}
                        <div style={{marginTop: '4px', fontSize: '0.9em', color: '#888'}}>
                            {editMode === 'A' ? "(Editing)" : "Click to Edit"}
                        </div>
                    </Popup>
                </Marker>
            )}
            {!p2.isBatch && (
                <Marker 
                    ref={markerRefB}
                    position={p2} 
                    icon={getIcon('rx', editMode === 'B')}
                    draggable={!p2.locked && active && !locked}
                    eventHandlers={{
                        drag: (e) => handleDragVisual(1, e), // Visual only
                        dragend: (e) => handleDragEnd(1, e), // Commit state
                        click: (e) => {
                            L.DomEvent.stopPropagation(e);
                            setEditMode('B');
                        }
                    }}
                >
                    <Popup>
                        <div style={{ paddingRight: '24px' }}><strong>RX (Point B)</strong></div>
                        {(p2.locked || locked) && <div><small>(Locked)</small></div>}
                        <div style={{marginTop: '4px', fontSize: '0.9em', color: '#888'}}>
                            {editMode === 'B' ? "(Editing)" : "Click to Edit"}
                        </div>
                    </Popup>
                </Marker>
            )}

            
            {/* Direct Line of Sight */}
            <Polyline 
                ref={polylineRef}
                positions={[p1, p2]} 
                pathOptions={{ 
                    color: finalColor, 
                    weight: 3, 
                    dashArray: dashStyle 
                }} 
            />

            {/* Fresnel Zone Visualization (Polygon) */}
            <Polygon 
                ref={fresnelRef}
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

LinkLayer.propTypes = {
    nodes: PropTypes.arrayOf(PropTypes.shape({
        lat: PropTypes.number.isRequired,
        lng: PropTypes.number.isRequired,
        locked: PropTypes.bool
    })).isRequired,
    setNodes: PropTypes.func.isRequired,
    linkStats: PropTypes.object.isRequired,
    setLinkStats: PropTypes.func.isRequired,
    setCoverageOverlay: PropTypes.func,
    active: PropTypes.bool,
    locked: PropTypes.bool,
    onManualClick: PropTypes.func,
    propagationSettings: PropTypes.shape({
        model: PropTypes.string,
        environment: PropTypes.string
    })
};

export default memo(LinkLayer);
