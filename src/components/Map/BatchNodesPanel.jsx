import React, { useState, useEffect, useRef } from 'react';

const BatchNodesPanel = ({ nodes, selectedNodes = [], onCenter, onClear, onNodeSelect, forceMinimized = false }) => {
    const [isMinimized, setIsMinimized] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    // Auto-minimize based on prop (e.g. when result panel opens on mobile)
    useEffect(() => {
        if (forceMinimized) {
            setIsMinimized(true);
        }
    }, [forceMinimized]);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const panelRef = useRef(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Prevent map zoom when scrolling inside the panel
    useEffect(() => {
        const panel = panelRef.current;
        if (!panel) return;

        const handleWheel = (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            // Manually handle the scroll
            const scrollableDiv = panel.querySelector('.batch-nodes-scrollable');
            if (scrollableDiv) {
                scrollableDiv.scrollTop += e.deltaY;
            }
        };

        panel.addEventListener('wheel', handleWheel, { passive: false });
        
        // Disable Leaflet propagation
        L.DomEvent.disableClickPropagation(panel);
        L.DomEvent.disableScrollPropagation(panel);
        
        return () => {
            panel.removeEventListener('wheel', handleWheel);
        };
    }, []);


    if (isMinimized) {
        return (
            <div 
                ref={panelRef}
                data-batch-panel="true"
                onWheel={(e) => e.stopPropagation()}
                style={{
                    position: 'absolute',
                    top: isMobile ? '125px' : 'auto', // Below toolbar rows
                    bottom: isMobile ? 'auto' : '25px',
                    left: '60px',
                    background: '#222',
                    backdropFilter: 'none',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    padding: '0 12px',
                    height: '36px',
                    color: '#eee',
                    zIndex: 1100, // Higher than other panels
                    boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    border: '1px solid #444'
                }}
            onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(false);
            }}
            >
                <span style={{ fontSize: '0.9em', fontWeight: 600, color: '#00f2ff' }}>
                    Batch Nodes ({nodes.length})
                </span>
                <span style={{ fontSize: '0.8em', color: '#666' }}>▲</span>
            </div>
        );
    }

    return (
        <div 
            ref={panelRef}
            data-batch-panel="true"
            onWheel={(e) => e.stopPropagation()}
            style={{
                position: 'absolute',
                top: isMobile ? '125px' : 'auto', // Move below toolbar rows
                bottom: isMobile ? 'auto' : '25px',
                left: '60px',
                width: isMobile ? 'calc(100% - 140px)' : '320px', 
                maxWidth: '340px',
                maxHeight: isMobile ? '35vh' : '500px', // Shorter on mobile
                background: 'rgba(10, 10, 15, 0.98)',
                backdropFilter: 'blur(15px)',
                border: '1px solid #444',
                borderRadius: '8px',
                padding: '16px',
                color: '#eee',
                zIndex: 1100, 
                boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
                display: 'flex',
                flexDirection: 'column',
            }}>
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
                        Batch Analysis Guide
                    </div>
                    <div style={{ color: '#ccc', marginBottom: '16px' }}>
                        Manage and visualize your imported node collection and select sites for pair-wise analysis.
                    </div>
                    <ul style={{ paddingLeft: '20px', margin: '0 0 20px 0', color: '#bbb', flexGrow: 1 }}>
                        <li style={{ marginBottom: '10px' }}><strong>Toggle:</strong> Click a node card to select it for Link Analysis.</li>
                        <li style={{ marginBottom: '10px' }}><strong>Role:</strong> First selection is TX (Green), second is RX (Red).</li>
                        <li style={{ marginBottom: '10px' }}><strong>Navigate:</strong> Click a name to center the map on that site.</li>
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

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1em', fontWeight: 600, color: '#00f2ff' }}>
                    Batch Nodes ({nodes.length})
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
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsMinimized(true);
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
                        title="Minimize"
                    >
                        ▼
                    </button>
                </div>
            </div>

            {/* Nodes List */}
            <div 
                style={{ 
                    overflowY: 'auto', 
                    maxHeight: '320px', // Roughly 5 nodes at ~64px each
                    flexGrow: 1, 
                    paddingRight: '4px', 
                    marginBottom: '12px',
                    // Custom scrollbar styling
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#00f2ff #1a1a1f'
                }}
                className="batch-nodes-scrollable"
                onWheel={(e) => {
                    // Prevent wheel events from bubbling to the map
                    e.stopPropagation();
                }}
            >
                {nodes.map((node, index) => {
                    // Check if this node is selected
                    const selection = selectedNodes?.find(s => s?.id === node.id);
                    const isSelected = !!selection;
                    const role = selection?.role;
                    
                    return (
                        <div 
                            key={node.id}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                background: isSelected ? 'rgba(0, 242, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                                border: isSelected ? '1px solid rgba(0, 242, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                                borderRadius: '6px',
                                padding: '10px',
                                marginBottom: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                position: 'relative'
                            }}
                            onClick={(e) => {
                                // Stop event from bubbling to the map underneath
                                e.stopPropagation();
                                e.preventDefault();
                                
                                // If onNodeSelect is provided, use it for link selection
                                if (onNodeSelect) {
                                    onNodeSelect(node);
                                } else {
                                    // Otherwise, just center the map
                                    onCenter(node);
                                }
                            }}
                            onMouseOver={e => {
                                e.currentTarget.style.background = 'rgba(0, 242, 255, 0.1)';
                                e.currentTarget.style.borderColor = 'rgba(0, 242, 255, 0.3)';
                            }}
                            onMouseOut={e => {
                                e.currentTarget.style.background = isSelected ? 'rgba(0, 242, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)';
                                e.currentTarget.style.borderColor = isSelected ? 'rgba(0, 242, 255, 0.3)' : 'rgba(255, 255, 255, 0.05)';
                            }}
                        >
                            {/* Selection Badge */}
                            {isSelected && (
                                <div style={{
                                    position: 'absolute',
                                    top: '8px',
                                    right: '8px',
                                    background: role === 'TX' ? 'rgba(0, 255, 65, 0.9)' : 'rgba(255, 0, 0, 0.9)',
                                    color: '#000',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.7em',
                                    fontWeight: 700,
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                }}>
                                    {role}
                                </div>
                            )}
                            
                            {/* Node Name */}
                            <div style={{ fontSize: '0.95em', color: '#fff', fontWeight: 600, marginBottom: '4px', paddingRight: isSelected ? '40px' : '0' }}>
                                {node.name}
                            </div>
                            
                            {/* Coordinates */}
                            <div style={{ fontSize: '0.75em', color: '#888', fontFamily: 'monospace' }}>
                                {node.lat.toFixed(5)}, {node.lng.toFixed(5)}
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {/* Clear All Button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onClear();
                }}
                style={{
                    background: 'rgba(255, 50, 50, 0.2)',
                    border: '1px solid rgba(255, 50, 50, 0.4)',
                    borderRadius: '6px',
                    padding: '8px',
                    color: '#ff6666',
                    cursor: 'pointer',
                    fontSize: '0.85em',
                    fontWeight: 600,
                    transition: 'all 0.2s ease'
                }}
                onMouseOver={e => {
                    e.target.style.background = 'rgba(255, 50, 50, 0.3)';
                    e.target.style.borderColor = 'rgba(255, 50, 50, 0.6)';
                }}
                onMouseOut={e => {
                    e.target.style.background = 'rgba(255, 50, 50, 0.2)';
                    e.target.style.borderColor = 'rgba(255, 50, 50, 0.4)';
                }}
            >
                Clear All Nodes
            </button>
        </div>
    );
};

export default BatchNodesPanel;
