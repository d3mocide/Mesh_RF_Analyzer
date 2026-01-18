import React, { useState } from 'react';

const OptimizationResultsPanel = ({ results, onClose, onCenter, onReset, onRecalculate }) => {
    const [isMinimized, setIsMinimized] = useState(false);
    
    // Minimized view
    if (isMinimized) {
        return (
            <div 
                style={{
                    position: 'absolute',
                    top: '25px',
                    right: '25px',
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
                    Top {results.length} Ideal Spots
                </span>
                <span style={{ fontSize: '0.8em', color: '#666' }}>▼</span>
            </div>
        );
    }
    
    // Fixed position panel for now, standardizing with other panels
    
    return (
        <div style={{
            position: 'absolute',
            top: '25px',
            right: '25px',
            width: '320px',
            maxHeight: '600px',
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
                    Top {results.length} Ideal Spots
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
                    ▲
                </button>
            </div>

            {/* Results List */}
            <div style={{ overflowY: 'auto', flexGrow: 1, paddingRight: '4px' }}>
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
                            <div style={{ fontSize: '0.9em', color: '#ccc', marginBottom: '2px' }}>
                                Elevation: <span style={{ color: '#fff', fontWeight: 600 }}>{Math.round(node.elevation)}m</span>
                            </div>
                            <div style={{ fontSize: '0.75em', color: '#666', fontFamily: 'monospace' }}>
                                {node.lat.toFixed(5)}, {node.lon.toFixed(5)}
                            </div>
                        </div>

                        {/* Arrow */}
                        <div style={{ color: '#444' }}>›</div>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
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
