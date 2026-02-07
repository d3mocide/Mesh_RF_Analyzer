import React from 'react';
import PropTypes from 'prop-types';
import LinkProfileChart from './LinkProfileChart';
import { calculateBullingtonDiffraction } from '../../utils/rfMath';

import { useRF } from '../../context/RFContext';

const LinkAnalysisPanel = ({ nodes, linkStats, budget, distance, units, propagationSettings, setPropagationSettings }) => { 


    const { nodeConfigs, freq } = useRF();
    const h1 = parseFloat(nodeConfigs.A.antennaHeight);
    const h2 = parseFloat(nodeConfigs.B.antennaHeight);

    // Conversions
    const isImperial = units === 'imperial';
    const distDisplay = isImperial ? (distance * 0.621371).toFixed(2) + ' mi' : distance.toFixed(2) + ' km';
    const clearanceVal = linkStats.minClearance;
    const clearanceDisplay = isImperial ? (clearanceVal * 3.28084).toFixed(1) + ' ft' : clearanceVal + ' m';

    // Colors
    const isObstructed = linkStats.isObstructed;
    
    // Calculate Diffraction Loss if using Hata and we have a profile
    let diffractionLoss = 0;
    if (linkStats.profileWithStats) {
        diffractionLoss = calculateBullingtonDiffraction(
            linkStats.profileWithStats, 
            freq, 
            h1, 
            h2
        );
    }
    let margin = budget ? budget.margin : 0;
    
    // WISP Ratings
    const quality = linkStats.linkQuality || 'Obstructed (-)';
    
    // Determine RF Status based on calibrated LoRa thresholds
    let rfColor = '#ff0000';
    let rfText = 'NO SIGNAL';

    if (margin >= 10) {
        rfColor = '#00ff41'; 
        rfText = 'EXCELLENT +++';
    } else if (margin >= 5) {
        rfColor = '#00ff41'; 
        rfText = 'GOOD ++';
    } else if (margin >= 0) {
        rfColor = '#eeff00ff'; 
        rfText = 'FAIR +';
    } else if (margin >= -10) {
        rfColor = '#ffbf00'; 
        rfText = 'MARGINAL -+';
    } else if (margin < -10) {
        rfColor = '#ff0000'; 
        rfText = 'NO SIGNAL -';
    }

    let statusColor = rfColor;
    let statusText = rfText;

    // Apply Model Constraints
    // Fixed: Always report obstruction if physically obstructed, regardless of model
    if (quality.includes('Obstructed')) {
        statusColor = '#ff0000';
        statusText = 'OBSTRUCTED (LOS)';
    } else if (diffractionLoss > 10) {
        // If loss is huge (NLOS), override status even if LOS is technically valid (grazing)
        statusColor = '#ff0000';
        statusText = 'Diffraction Limited';
    }

    // Responsive Chart Logic
    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
    const [panelSize, setPanelSize] = React.useState({ 
        width: isMobile ? window.innerWidth : 400, 
        height: isMobile ? 480 : 650 
    });

    React.useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) {
                setPanelSize({ width: window.innerWidth, height: 480 });
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const panelRef = React.useRef(null);
    const draggingRef = React.useRef(false);
    const [isResizing, setIsResizing] = React.useState(false); // Used to disable transition during drag
    const [isMinimized, setIsMinimized] = React.useState(false);
    const [showModelHelp, setShowModelHelp] = React.useState(false);
    const lastPosRef = React.useRef({ x: 0, y: 0 });

    if (nodes.length !== 2) return null;

    // Calculate Dimensions directly (Derived State)
    let layoutOffset = 380; // Recalibrated to eliminate dead space
    if (diffractionLoss > 0) {
        layoutOffset += 70; // Extra room for obstruction box
    }
    
    const dimensions = {
        width: Math.max(270, panelSize.width - 48),
        height: Math.max(100, panelSize.height - layoutOffset)
    };

    // Resize Handler
    const handleMouseDown = (e) => {
        draggingRef.current = true;
        setIsResizing(true);
        lastPosRef.current = { x: e.clientX, y: e.clientY };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        e.preventDefault(); // Prevent selection
    };

    const handleMouseMove = (e) => {
        if (!draggingRef.current) return;
        
        const dx = e.clientX - lastPosRef.current.x;
        const dy = e.clientY - lastPosRef.current.y;
        
        lastPosRef.current = { x: e.clientX, y: e.clientY };

        setPanelSize(prev => {
            const newWidth = prev.width - dx; 
            const newHeight = prev.height + dy;

            return {
                width: Math.max(400, newWidth),
                height: Math.max(500, newHeight)
            };
        });
    };

    const handleMouseUp = () => {
        draggingRef.current = false;
        setIsResizing(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    return (
        <div ref={panelRef} style={{
            position: 'absolute',
            top: isMobile ? 'auto' : '20px',
            bottom: isMobile ? '0' : 'auto',
            right: isMobile ? '0' : '20px',
            left: isMobile ? '0' : 'auto',
            width: isMobile ? '100%' : `${panelSize.width}px`,
            height: isMobile ? 'auto' : `${panelSize.height}px`,
            maxHeight: isMobile ? (isMinimized ? '72px' : '85dvh') : 'none',
            background: 'rgba(10, 10, 15, 0.98)',
            backdropFilter: 'blur(16px)',
            border: isMobile ? 'none' : '1px solid #00f2ff33',
            borderTop: isMobile ? '1px solid #00f2ff55' : '1px solid #00f2ff33',
            borderRadius: isMobile ? '20px 20px 0 0' : '12px',
            padding: '24px',
            paddingBottom: isMobile ? 'calc(24px + env(safe-area-inset-bottom))' : '24px',
            color: '#eee',
            zIndex: 1000, 
            boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            overflowX: 'hidden',
            transition: isResizing ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
            {/* help slide-down - RE-INTEGRATED INTO PANEL AT ROOT LEVEL */}
            {showModelHelp && (
                <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    right: '0',
                    bottom: '0',
                    background: 'rgba(10, 10, 15, 0.98)',
                    backdropFilter: 'blur(15px)',
                    border: '1px solid #00f2ff44',
                    borderRadius: '8px',
                    padding: '24px',
                    zIndex: 3000, 
                    boxShadow: '0 12px 48px rgba(0,0,0,0.8)',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                    <div style={{ color: '#00f2ff', fontWeight: 'bold', marginBottom: '16px', fontSize: '1.2em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                        Propagation Model Guide
                    </div>
                    <div style={{ color: '#ccc', marginBottom: '16px' }}>
                        The engine uses physical models to predict signal strength across the terrain.
                    </div>
                    <div style={{ flexGrow: 1 }}>
                        <div style={{ marginBottom: '16px', fontSize: '0.9em' }}>
                            <div style={{ marginBottom: '8px' }}>
                                <strong style={{ color: '#00f2ff' }}>FSPL:</strong> Idealized "Line of Sight" calculation. Best for very short distances or space-to-earth links.
                            </div>
                            <div style={{ marginBottom: '8px' }}>
                                <strong style={{ color: '#00f2ff' }}>Okumura-Hata:</strong> Statistical model based on city measurements. Accounts for clutter and building density.
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <strong style={{ color: '#00f2ff' }}>ITM (Longley-Rice):</strong> High-precision terrain model. Accounts for diffraction over hills and earth curvature.
                            </div>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: '#bbb' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #333', textAlign: 'left' }}>
                                    <th style={{ padding: '8px 4px' }}>Model</th>
                                    <th style={{ padding: '8px 4px' }}>Recommended Use Case</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ borderBottom: '1px solid #222' }}>
                                    <td style={{ padding: '8px 4px', fontWeight: 'bold' }}>FSPL</td>
                                    <td style={{ padding: '8px 4px' }}>Bench tests & Space links</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #222' }}>
                                    <td style={{ padding: '8px 4px', fontWeight: 'bold', color: '#fff' }}>Hata</td>
                                    <td style={{ padding: '8px 4px' }}>City-wide Mesh Planning</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '8px 4px', fontWeight: 'bold', color: '#00ff41' }}>ITM</td>
                                    <td style={{ padding: '8px 4px' }}>Long-range Rural / Hills</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <button 
                        onClick={() => setShowModelHelp(false)}
                        style={{ 
                            marginTop: 'auto', 
                            width: '100%', 
                            background: 'rgba(0, 242, 255, 0.1)', 
                            border: '1px solid #00f2ff66', 
                            color: '#00f2ff', 
                            padding: '12px', 
                            borderRadius: '8px', 
                            cursor: 'pointer', 
                            fontWeight: 'bold', 
                            fontSize: '14px',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseOver={e => e.target.style.background = 'rgba(0, 242, 255, 0.2)'}
                        onMouseOut={e => e.target.style.background = 'rgba(0, 242, 255, 0.1)'}
                    >
                        Got it
                    </button>
                </div>
            )}

            {/* Mobile Grab Handle & Clickable Header Area */}
            {isMobile && (
                <div 
                    onClick={() => setIsMinimized(!isMinimized)}
                    style={{
                        padding: '12px 0 8px 0',
                        cursor: 'pointer',
                        width: '100%',
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                    title={isMinimized ? "Expand" : "Minimize"}
                >
                    <div style={{
                        width: '36px',
                        height: '4px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '2px',
                    }} />
                    
                    {isMinimized && (
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '12px',
                            animation: 'fadeIn 0.3s ease-out'
                        }}>
                             <span style={{ fontSize: '0.85em', fontWeight: 700, color: statusColor }}>
                                {statusText}
                            </span>
                            <span style={{ fontSize: '0.85em', color: '#888' }}>|</span>
                            <span style={{ fontSize: '0.9em', fontWeight: 600 }}>
                                {margin} dB Margin
                            </span>
                        </div>
                    )}
                </div>
            )}
            {/* Custom Bottom-Left Resize Handle - Only on Desktop */}
            {!isMobile && (
                <div 
                    onMouseDown={handleMouseDown}
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        width: '24px',
                        height: '24px',
                        cursor: 'sw-resize',
                        zIndex: 1001,
                        // Light background for "tab" feel + distinct grip lines
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        backgroundImage: `repeating-linear-gradient(
                            45deg,
                            transparent,
                            transparent 4px,
                            rgba(255, 255, 255, 0.5) 4px,
                            rgba(255, 255, 255, 0.5) 5px
                        )`,
                        // Triangle shape
                        clipPath: 'polygon(0 100%, 100% 100%, 0 0)',
                        borderBottomLeftRadius: '8px',
                        transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
                    title="Resize Panel"
                ></div>
            )}

            {/* Header - Also clickable on mobile to toggle */}
            <div 
                onClick={isMobile ? () => setIsMinimized(!isMinimized) : undefined}
                style={{ 
                    display: isMinimized && isMobile ? 'none' : 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: '12px',
                    cursor: isMobile ? 'pointer' : 'default',
                    flexShrink: 0
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2em', fontWeight: 600, color: '#00f2ff' }}>Link Analysis</h3>
                    {isMobile && (
                        <span style={{ fontSize: '0.8em', color: '#666', transform: isMinimized ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.3s' }}>
                            ▼
                        </span>
                    )}
                </div>
                <span style={{ 
                    fontSize: '0.8em', 
                    fontWeight: 800, 
                    color: '#000', 
                    background: statusColor, 
                    padding: '2px 8px', 
                    borderRadius: '4px' 
                }}>
                    {statusText}
                </span>
            </div>

            {/* Propagation Configuration */}
            {propagationSettings && (
                <div style={{ mb: '12px', padding: '12px', background: 'rgba(0, 242, 255, 0.03)', border: '1px solid rgba(0, 242, 255, 0.15)', borderRadius: '8px', marginBottom: '16px', position: 'relative' }}>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                         {/* Row 1: Model & Help */}
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                 <label style={{ fontSize: '0.75em', color: '#888', minWidth: '40px' }} htmlFor="prop-model">Model:</label>
                                 <select 
                                    id="prop-model"
                                    name="prop-model"
                                    value={propagationSettings.model || "fspl"}
                                    onChange={(e) => setPropagationSettings(prev => ({ ...prev, model: e.target.value }))}
                                    style={{ background: '#222', color: '#00f2ff', border: '1px solid #444', padding: '4px', borderRadius: '4px', fontSize: '0.8em', fontWeight: 'bold' }}
                                 >
                                    <option value="fspl">Free Space (Optimistic)</option>
                                    <option value="itm">Longley-Rice (Terrain)</option>
                                    <option value="hata">Okumura-Hata (Statistical)</option>
                                 </select>
                             </div>

                             {/* Model Info Tooltip moved here */}
                             <div 
                                onClick={() => setShowModelHelp(!showModelHelp)}
                                style={{ 
                                    position: 'relative', 
                                    cursor: 'pointer',
                                    color: '#00f2ff',
                                    fontSize: '0.85em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '4px',
                                    background: showModelHelp ? 'rgba(0, 242, 255, 0.1)' : 'transparent',
                                    borderRadius: '4px',
                                    gap: '4px'
                                }} title="Click for Model Comparison Guide">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                     <circle cx="12" cy="12" r="10"></circle>
                                     <line x1="12" y1="16" x2="12" y2="12"></line>
                                     <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                  </svg>
                                  <span style={{ fontSize: '0.8em', whiteSpace: 'nowrap' }}>
                                    {showModelHelp ? 'Hide Info' : (propagationSettings.model === 'itm' ? 'ITM' : (propagationSettings.model === 'hata' ? 'Hata' : 'Model'))} Info
                                  </span>
                              </div>
                         </div>

                         {/* Row 2: Env Selector */}
                         <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.75em', color: '#888', minWidth: '40px' }} htmlFor="prop-env">Env:</label>
                            <select 
                                id="prop-env"
                                name="prop-env"
                                value={propagationSettings.environment}
                                onChange={(e) => setPropagationSettings(prev => ({ ...prev, environment: e.target.value }))}
                                style={{ background: '#222', color: '#fff', border: '1px solid #444', padding: '4px', borderRadius: '4px', fontSize: '0.8em', flexGrow: 1 }}
                            >
                                <option value="urban_small">Urban (Small/Medium)</option>
                                <option value="urban_large">Urban (Large)</option>
                                <option value="suburban">Suburban</option>
                                <option value="rural">Rural / Open</option>
                            </select>
                         </div>
                     </div>
                         

                     
                </div>
            )}

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.9em', marginBottom: '16px', flexShrink: 0 }}>
                <div>
                    <div style={{ color: '#888', fontSize: '0.85em', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Distance</div>
                    <div style={{ fontSize: '1.2em', fontWeight: 600, color: '#fff' }}>{distDisplay}</div>
                </div>
                <div>
                    <div style={{ color: '#888', fontSize: '0.85em', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Margin</div>
                    <div style={{ fontSize: '1.2em', fontWeight: 600, color: statusColor }}>{margin} dB</div>
                </div>
                <div>
                    <div style={{ color: '#888', fontSize: '0.85em', textTransform: 'uppercase', letterSpacing: '0.5px' }}>RSSI</div>
                    <div style={{ fontSize: '1.1em', color: '#00f2ff', fontWeight: 600 }}>{budget ? budget.rssi : '--'} dBm</div>
                </div>
                <div>
                    <div style={{ color: '#888', fontSize: '0.85em', textTransform: 'uppercase', letterSpacing: '0.5px' }}>First Fresnel</div>
                    <div style={{ fontSize: '1.1em', color: '#fff', fontWeight: 600 }}>{clearanceDisplay}</div>
                </div>
                {diffractionLoss > 0 && (
                     <div style={{ gridColumn: 'span 2', marginTop: '4px', padding: '4px', background: 'rgba(255, 0, 0, 0.2)', borderRadius: '4px' }}>
                        <div style={{ color: '#ffaaaa', fontSize: '0.85em' }}>Obstruction Loss</div>
                        <div style={{ fontSize: '1.1em', fontWeight: 600, color: '#ff4444' }}>-{diffractionLoss} dB</div>
                    </div>
                )}
            </div>

            {/* Profile Chart - Flexible Height */}
            <div style={{ borderTop: '1px solid #333', paddingTop: '12px', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ color: '#888', fontSize: '0.85em', marginBottom: '4px' }}>Terrain & Path Profile</div>
                {linkStats.loading ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontStyle: 'italic' }}>
                        Loading Elevation Data...
                    </div>
                ) : (
                    <div style={{flexGrow: 1, minHeight: '160px'}}>
                        <LinkProfileChart 
                            profileWithStats={linkStats.profileWithStats} 
                            width={dimensions.width}
                            height={dimensions.height}
                            units={units}
                            margin={margin}
                            losColor={statusColor}
                        />
                    </div>
                )}
            </div>

            {/* Legend / Info */}
            <div style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', gap: '10px', fontSize: '0.75em', color: '#666', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff41' }}></div>
                    <span>LOS</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#5d4037' }}></div>
                    <span>Terrain</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', border: '1px dashed #00f2ff' }}></div>
                    <span>Fresnel</span>
                </div>
            </div>
        </div>
    );
};

LinkAnalysisPanel.propTypes = {
    nodes: PropTypes.arrayOf(PropTypes.shape({
        lat: PropTypes.number.isRequired,
        lng: PropTypes.number.isRequired
    })).isRequired,
    linkStats: PropTypes.shape({
        isObstructed: PropTypes.bool,
        minClearance: PropTypes.number,
        linkQuality: PropTypes.string,
        profileWithStats: PropTypes.array,
        loading: PropTypes.bool
    }).isRequired,
    budget: PropTypes.object,
    distance: PropTypes.number.isRequired,
    units: PropTypes.oneOf(['metric', 'imperial']),
    propagationSettings: PropTypes.shape({
        model: PropTypes.string,
        environment: PropTypes.string
    }),
    setPropagationSettings: PropTypes.func
};

export default LinkAnalysisPanel;
