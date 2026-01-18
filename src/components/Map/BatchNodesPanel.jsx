import React, { useState, useEffect, useRef } from 'react';

const BatchNodesPanel = ({ nodes, selectedNodes = [], onCenter, onClear, onNodeSelect }) => {
    const [isMinimized, setIsMinimized] = useState(false);
    const panelRef = useRef(null);

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
                    bottom: '25px',
                    left: '25px',
                    background: 'rgba(10, 10, 15, 0.95)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid #444',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    color: '#eee',
                    zIndex: 1000,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
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
                bottom: '25px',
                left: '25px',
                width: '280px',
                maxHeight: '500px',
                background: 'rgba(10, 10, 15, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid #444',
                borderRadius: '8px',
                padding: '16px',
                color: '#eee',
                zIndex: 1000, 
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                display: 'flex',
                flexDirection: 'column',
            }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1em', fontWeight: 600, color: '#00f2ff' }}>
                    Batch Nodes ({nodes.length})
                </h3>
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
                    const selection = selectedNodes?.find(s => s.id === node.id);
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
