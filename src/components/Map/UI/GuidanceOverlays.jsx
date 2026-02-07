import React from 'react';

const GuidanceOverlays = ({ 
    toolMode, 
    nodes, 
    optimizeState, 
    isMobile,
    viewshedObserver,
    rfObserver,
    siteAnalysisMode,
    // Help Toggles
    linkHelp, setLinkHelp,
    elevationHelp, setElevationHelp,
    viewshedHelp, setViewshedHelp,
    rfHelp, setRFHelp,
    isResultsVisible
}) => {
    if (isResultsVisible) return null;

    const overlayStyle = {
        position: 'absolute',
        top: isMobile ? '80px' : 'auto', // Mobile: Top to avoid panel collision
        bottom: isMobile ? 'auto' : 'calc(40px + env(safe-area-inset-bottom))', // Desktop: Bottom
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        background: 'rgba(10, 10, 15, 0.95)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid #00f2ff88',
        borderRadius: '12px',
        padding: '12px 24px',
        color: '#fff',
        boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        animation: 'fadeIn 0.5s ease-out',
        minWidth: '280px',
        maxWidth: '90vw'
    };

    return (
        <>
        {/* Contextual Guidance Overlays */}
        {toolMode === 'link' && nodes.length < 2 && (
            <div style={{ ...overlayStyle, border: '1px solid #00ff4188' }}>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#00ff41' }}>
                        Link Analysis Active
                    </div>
                    <div 
                      onClick={() => setLinkHelp(!linkHelp)}
                      style={{ 
                          cursor: 'pointer', 
                          color: '#00ff41', 
                          fontSize: '14px', 
                          padding: '4px 8px',
                          background: 'rgba(255,255,255,0.05)',
                          borderRadius: '4px',
                          fontWeight: 'bold',
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
                        <span>{linkHelp ? 'Hide' : 'Help'}</span>
                    </div>
                </div>
                
                {!linkHelp && (
                  <div style={{ fontSize: '14px', color: '#ccc' }}>
                      {nodes.length === 0 ? "Click on the map to set Node A (Transmitter)" : "Click on the map to set Node B (Receiver)"}
                  </div>
                )}
    
                {linkHelp && (
                    <div style={{ 
                        marginTop: '12px', 
                        fontSize: '0.85em', 
                        color: '#ddd', 
                        borderTop: '1px solid rgba(255,255,255,0.1)', 
                        paddingTop: '12px',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        width: '100%'
                    }}>
                        <div style={{ fontWeight: 'bold', color: '#00ff41', marginBottom: '4px' }}>Point-to-Point Analysis</div>
                        <div style={{ marginBottom: '8px' }}>Simulate a direct radio link between two physical locations.</div>
                        <ul style={{ paddingLeft: '18px', margin: 0, color: '#bbb' }}>
                            <li><strong>Step 1:</strong> Select a starting point (Transmitter).</li>
                            <li><strong>Step 2:</strong> Select an end point (Receiver).</li>
                            <li><strong>Analysis:</strong> The engine calculates path loss, Fresnel obstruction, and RSSI.</li>
                            <li style={{ marginTop: '4px', color: '#00ff41' }}><strong>Dynamic:</strong> Adjust Node A/B height, gain, or power in the sidebar to update the link live!</li>
                        </ul>
                    </div>
                )}
            </div>
        )}
    
        {/* Elevation Scan (Auto Mode) */}
        {toolMode === 'optimize' && siteAnalysisMode === 'auto' && !optimizeState.loading && optimizeState.ghostNodes?.length === 0 && (
            <div style={overlayStyle}>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#00f2ff' }}>
                        Elevation Scan Active
                    </div>
                    <div 
                        onClick={() => setElevationHelp(!elevationHelp)}
                        style={{ 
                            cursor: 'pointer', 
                            color: '#00f2ff', 
                            fontSize: '14px', 
                            padding: '4px 8px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '4px',
                            fontWeight: 'bold',
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
                        <span>{elevationHelp ? 'Hide' : 'Help'}</span>
                    </div>
                </div>
                
                {!elevationHelp && (
                    <div style={{ fontSize: '14px', color: '#ccc', textAlign: 'center' }}>
                        {!optimizeState.startPoint ? "Click to set first corner" : "Set opposite corner | Drag cyan dots to adjust"}
                    </div>
                )}
    
                {elevationHelp && (
                    <div style={{ 
                        marginTop: '12px', 
                        fontSize: '0.85em', 
                        color: '#ddd', 
                        borderTop: '1px solid rgba(255,255,255,0.1)', 
                        paddingTop: '12px',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        width: '100%'
                    }}>
                        <div style={{ fontWeight: 'bold', color: '#00f2ff', marginBottom: '4px' }}>How to Scan</div>
                        <div style={{ marginBottom: '8px' }}>This tool identifies the top high-ground locations within a defined area.</div>
                        <ul style={{ paddingLeft: '18px', margin: 0, color: '#bbb' }}>
                            <li><strong>Area:</strong> Set two corners on the map to define the scan region.</li>
                            <li><strong>Analysis:</strong> The engine queries elevation data for points across the entire grid.</li>
                            <li><strong>Result:</strong> Top 5 highest spots are marked for potential transmitter sites.</li>
                        </ul>
                    </div>
                )}
            </div>
        )}

        {/* Multi-Site Manager (Manual Mode) */}
        {toolMode === 'optimize' && siteAnalysisMode === 'manual' && (
            <div style={overlayStyle}>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#00f2ff' }}>
                        Multi-Site Manager Active
                    </div>
                    <div 
                        onClick={() => setElevationHelp(!elevationHelp)} // Reuse elevationHelp state for simplicity or add specific state
                        style={{ 
                            cursor: 'pointer', 
                            color: '#00f2ff', 
                            fontSize: '14px', 
                            padding: '4px 8px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '4px',
                            fontWeight: 'bold',
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
                        <span>{elevationHelp ? 'Hide' : 'Help'}</span>
                    </div>
                </div>
                
                {!elevationHelp && (
                    <div style={{ fontSize: '14px', color: '#ccc', textAlign: 'center' }}>
                         Click map to add candidate sites.
                    </div>
                )}
    
                {elevationHelp && (
                    <div style={{ 
                        marginTop: '12px', 
                        fontSize: '0.85em', 
                        color: '#ddd', 
                        borderTop: '1px solid rgba(255,255,255,0.1)', 
                        paddingTop: '12px',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        width: '100%'
                    }}>
                        <div style={{ fontWeight: 'bold', color: '#00f2ff', marginBottom: '4px' }}>Multi-Site Management</div>
                        <div style={{ marginBottom: '8px' }}>Manually place and compare multiple potential locations.</div>
                        <ul style={{ paddingLeft: '18px', margin: 0, color: '#bbb' }}>
                            <li><strong>Add:</strong> Click "Add" in the panel or click the map to place a candidate marker.</li>
                            <li><strong>Compare:</strong> Toggle candidates in the list to view their coverage stats.</li>
                            <li><strong>Convert:</strong> Promote a candidate to a permanent primary node.</li>
                        </ul>
                    </div>
                )}
            </div>
        )}
    
        {((toolMode === 'viewshed' && !viewshedObserver) || (toolMode === 'rf_coverage' && !rfObserver)) && (
            <div style={{
                position: 'absolute',
                top: 'auto',
                bottom: 'calc(40px + env(safe-area-inset-bottom))',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
                background: 'rgba(10, 10, 15, 0.95)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: toolMode === 'viewshed' ? '1px solid #a855f788' : '1px solid #ff6b0088',
                borderRadius: '12px',
                padding: '12px 24px',
                color: '#fff',
                boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                animation: 'fadeIn 0.5s ease-out',
                minWidth: '280px',
                maxWidth: '90vw'
            }}>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
                    <div style={{ 
                        fontSize: '14px', 
                        fontWeight: 'bold', 
                        color: toolMode === 'viewshed' ? '#a855f7' : '#ff6b00',
                        whiteSpace: 'nowrap'
                    }}>
                        {toolMode === 'viewshed' ? 'Viewshed Active' : 'RF Simulator Active'}
                    </div>
                    <div 
                      onClick={() => {
                          const stateKey = toolMode === 'viewshed' ? 'showViewshedHelp' : 'showRFHelp';
                          if (toolMode === 'viewshed') setViewshedHelp(!viewshedHelp);
                          else setRFHelp(!rfHelp);
                      }}
                      style={{ 
                          cursor: 'pointer', 
                          color: toolMode === 'viewshed' ? '#a855f7' : '#ff6b00', 
                          fontSize: '14px', 
                          padding: '4px 8px',
                          background: 'rgba(255,255,255,0.05)',
                          borderRadius: '4px',
                          fontWeight: 'bold',
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
                        <span>{(toolMode === 'viewshed' ? viewshedHelp : rfHelp) ? 'Hide' : 'Help'}</span>
                    </div>
                </div>
                
                {!((toolMode === 'viewshed' ? viewshedHelp : rfHelp)) && (
                  <div style={{ fontSize: '14px', color: '#ccc' }}>
                      Click anywhere on the map to set the observer/transmitter point.
                  </div>
                )}
    
                {(toolMode === 'viewshed' ? viewshedHelp : rfHelp) && (
                    <div style={{ 
                        marginTop: '12px', 
                        fontSize: '0.85em', 
                        color: '#ddd', 
                        borderTop: '1px solid rgba(255,255,255,0.1)', 
                        paddingTop: '12px',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        width: '100%'
                    }}>
                        {toolMode === 'viewshed' ? (
                            <>
                                <div style={{ fontWeight: 'bold', color: '#a855f7', marginBottom: '4px' }}>Optical Line-of-Sight</div>
                                <div style={{ marginBottom: '8px' }}>Shows what is physically visible from the chosen point based on 10m-30m terrain data.</div>
                                <ul style={{ paddingLeft: '18px', margin: 0, color: '#bbb' }}>
                                    <li><strong>Green Area:</strong> Visible (LOS)</li>
                                    <li><strong>Purple Area:</strong> Obstructed by terrain</li>
                                    <li><strong>Draggable:</strong> Move the marker to instantly re-calculate.</li>
                                </ul>
                            </>
                        ) : (
                            <>
                                <div style={{ fontWeight: 'bold', color: '#ff6b00', marginBottom: '4px' }}>RF Propagation Simulation</div>
                                <div style={{ marginBottom: '8px' }}>Uses ITM / Geodetic physics to model radio coverage across terrain.</div>
                                <ul style={{ paddingLeft: '18px', margin: 0, color: '#bbb' }}>
                                    <li><strong>Colors:</strong> Hotter (Green/Yellow) is stronger signal. Purple is weak.</li>
                                    <li><strong>Params:</strong> Uses TX Power, Gain, and Height from sidebar.</li>
                                    <li><strong>Receiver:</strong> Adjust <strong>Receiver Height</strong> in the sidebar to simulate ground vs. mast reception.</li>
                                    <li><strong>Updates:</strong> If you change hardware settings, click <strong>Update Calculation</strong> in the sidebar to refresh the map.</li>
                                    <li><strong>Sensitivity:</strong> Dotted area shows coverage above your radio's floor.</li>
                                </ul>
                            </>
                        )}
                    </div>
                )}
            </div>
        )}
        </>
    );
};

export default GuidanceOverlays;
