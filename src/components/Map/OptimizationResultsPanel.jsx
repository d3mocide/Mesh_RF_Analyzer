import React, { useState, useEffect } from 'react';

const OptimizationResultsPanel = ({ results, onClose, onCenter, onReset, onRecalculate }) => {
    const [isMinimized, setIsMinimized] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    // Fixed position panel logic
    const panelStyle = {
        position: 'absolute',
        top: isMobile ? 'auto' : '25px',
        bottom: isMobile ? '0' : 'auto',
        right: isMobile ? '0' : '25px',
        left: isMobile ? '0' : 'auto',
        width: isMobile ? '100%' : '360px',
        maxHeight: isMinimized ? '60px' : (isMobile ? '85dvh' : '600px'),
        background: 'rgba(10, 10, 15, 0.98)',
        backdropFilter: 'blur(15px)',
        border: isMobile ? 'none' : '1px solid #444',
        borderTop: isMobile ? '1px solid #555' : '1px solid #444',
        borderRadius: isMobile ? '20px 20px 0 0' : '8px',
        padding: '16px',
        paddingBottom: isMobile ? 'calc(32px + env(safe-area-inset-bottom))' : '16px',
        color: '#eee',
        zIndex: 2500, 
        boxShadow: isMobile ? '0 -8px 32px rgba(0,0,0,0.8)' : '0 8px 32px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden'
    };
    
    return (
        <div style={{ ...panelStyle }}>
            {/* help slide-down - RE-INTEGRATED INTO PANEL */}
            {showHelp && (
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
                        Site Survey Guide
                    </div>
                    <div style={{ color: '#ccc', marginBottom: '16px' }}>
                        This tool identifies high-ground locations that maximize RF coverage potential based on the selected terrain and weights.
                    </div>
                    <ul style={{ paddingLeft: '20px', margin: '0 0 20px 0', color: '#bbb', flexGrow: 1 }}>
                        <li style={{ marginBottom: '10px' }}><strong>Advanced Scoring:</strong> Sites are ranked using a composite score of elevation, prominence, and Fresnel clearance.</li>
                        <li style={{ marginBottom: '10px' }}><strong>AMSL:</strong> Elevation is shown in meters Above Mean Sea Level (Terrain Height).</li>
                        <li style={{ marginBottom: '10px' }}><strong>Interactive Scan:</strong> Drag the cyan corners on the map to re-run the scan on a new area instantly.</li>
                    </ul>
                    <button 
                        onClick={() => setShowHelp(false)}
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
            {/* Mobile Grab Handle */}
            {isMobile && (
                <div 
                    onClick={() => setIsMinimized(!isMinimized)}
                    style={{
                        padding: '8px 0',
                        cursor: 'pointer',
                        width: '100%',
                        flexShrink: 0
                    }}
                >
                    <div style={{
                        width: '40px',
                        height: '4px',
                        background: '#666',
                        borderRadius: '2px',
                        margin: '0 auto',
                    }} />
                </div>
            )}

            {/* Header */}
            <div 
                onClick={isMobile ? () => setIsMinimized(!isMinimized) : undefined}
                style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: '16px',
                    cursor: isMobile ? 'pointer' : 'default',
                    flexShrink: 0
                }}
            >
                <h3 style={{ margin: 0, fontSize: '1.2em', fontWeight: 600, color: '#00f2ff' }}>
                    Top {results.length} Highest Points
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div 
                        onClick={(e) => { e.stopPropagation(); setShowHelp(!showHelp); }}
                        style={{ 
                            cursor: 'pointer', 
                            color: '#00f2ff', 
                            fontSize: '14px', 
                            padding: '4px 8px',
                            background: showHelp ? 'rgba(0, 242, 255, 0.15)' : 'rgba(0, 242, 255, 0.05)',
                            borderRadius: '4px',
                            border: '1px solid rgba(0, 242, 255, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                        <span>Help</span>
                    </div>
                    {!isMobile && (
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsMinimized(!isMinimized);
                            }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#666',
                                cursor: 'pointer',
                                fontSize: '1em',
                                padding: '0 4px',
                                lineHeight: 1
                            }}
                            onMouseOver={e => e.target.style.color = '#fff'}
                            onMouseOut={e => e.target.style.color = '#666'}
                            title={isMinimized ? "Expand" : "Minimize"}
                        >
                            {isMinimized ? '▼' : '▲'}
                        </button>
                    )}
                    {isMobile && (
                        <span style={{ 
                            fontSize: '0.8em', 
                            color: '#666', 
                            transform: isMinimized ? 'rotate(0deg)' : 'rotate(180deg)', 
                            transition: 'transform 0.3s' 
                        }}>
                            ▼
                        </span>
                    )}
                </div>
            </div>

            {/* Results List - Only show if not minimized or on desktop */}
            <div style={{ 
                overflowY: 'auto', 
                flexGrow: 1, 
                paddingRight: '4px',
                opacity: isMinimized ? 0 : 1,
                pointerEvents: isMinimized ? 'none' : 'auto',
                transition: 'opacity 0.2s'
            }}>
                {results.map((node, index) => (
                    <div 
                        key={index}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            borderRadius: '6px',
                            padding: '12px',
                            marginBottom: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        onClick={() => onCenter(node)}
                        onMouseOver={e => {
                            e.currentTarget.style.background = 'rgba(0, 242, 255, 0.1)';
                            e.currentTarget.style.borderColor = 'rgba(0, 242, 255, 0.3)';
                        }}
                        onMouseOut={e => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                        }}
                    >
                        {/* Rank Badge */}
                        <div style={{
                            width: '28px', height: '28px',
                            borderRadius: '50%',
                            background: 'rgba(0, 242, 255, 0.15)',
                            border: '1px solid rgba(0, 242, 255, 0.5)',
                            color: '#00f2ff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 'bold',
                            marginRight: '12px',
                            fontSize: '0.9em'
                        }}>
                            {index + 1}
                        </div>

                        {/* Info */}
                        <div style={{ flexGrow: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2px' }}>
                                <span style={{ color: '#00f2ff', fontWeight: 700, fontSize: '1.1em' }}>{node.score}</span>
                                <span style={{ color: '#bbb', fontSize: '0.9em' }}>Score</span>
                            </div>
                            <div style={{ fontSize: '0.9em', color: '#ccc' }}>
                                Elev: <span style={{ color: '#fff' }}>{Math.round(node.elevation)}m</span>
                                {node.prominence > 5 && (
                                    <span style={{ marginLeft: '8px', color: '#ffd700', fontSize: '0.85em' }}>
                                        ★ Prom: {Math.round(node.prominence)}m
                                    </span>
                                )}
                            </div>
                            <div style={{ fontSize: '0.75em', color: '#666', fontFamily: 'monospace', marginTop: '2px' }}>
                                {node.lat.toFixed(5)}, {node.lon.toFixed(5)}
                            </div>
                        </div>

                        {/* Arrow */}
                        <div style={{ color: '#444' }}>›</div>
                    </div>
                ))}
            </div>

            <div style={{ 
                marginTop: '12px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '8px', 
                alignItems: 'center',
                opacity: isMinimized ? 0 : 1,
                pointerEvents: isMinimized ? 'none' : 'auto',
                transition: 'opacity 0.2s',
                flexShrink: 0
            }}>
                 {/* Recalculate Button */}
                 <button 
                    onClick={onRecalculate}
                    style={{
                        padding: '8px 24px', 
                        background: 'rgba(0, 242, 255, 0.15)', 
                        color: '#00f2ff', 
                        border: '1px solid rgba(0, 242, 255, 0.3)', 
                        borderRadius: '20px', 
                        cursor: 'pointer',
                        fontSize: '0.9em',
                        transition: 'all 0.2s ease',
                        width: '100%',
                        fontWeight: '600'
                    }}
                    onMouseOver={(e) => {
                        e.target.style.background = 'rgba(0, 242, 255, 0.25)';
                        e.target.style.borderColor = 'rgba(0, 242, 255, 0.5)';
                    }}
                    onMouseOut={(e) => {
                        e.target.style.background = 'rgba(0, 242, 255, 0.15)';
                        e.target.style.borderColor = 'rgba(0, 242, 255, 0.3)';
                    }}
                 >
                    Recalculate Area
                 </button>

                 <button 
                    onClick={onReset}
                    style={{
                        padding: '8px 24px', 
                        background: 'rgba(255, 50, 50, 0.15)', 
                        color: '#ff4d4d', 
                        border: '1px solid rgba(255, 50, 50, 0.3)', 
                        borderRadius: '20px', 
                        cursor: 'pointer',
                        fontSize: '0.85em',
                        transition: 'all 0.2s ease',
                        width: '100%'
                    }}
                    onMouseOver={(e) => {
                        e.target.style.background = 'rgba(255, 50, 50, 0.25)';
                        e.target.style.borderColor = 'rgba(255, 50, 50, 0.5)';
                    }}
                    onMouseOut={(e) => {
                        e.target.style.background = 'rgba(255, 50, 50, 0.15)';
                        e.target.style.borderColor = 'rgba(255, 50, 50, 0.3)';
                    }}
                 >
                    Clear Results
                 </button>
            
                 <div style={{ fontSize: '0.8em', color: '#666' }}>
                    Click a spot to center map
                 </div>
            </div>
        </div>
    );
};

export default OptimizationResultsPanel;
