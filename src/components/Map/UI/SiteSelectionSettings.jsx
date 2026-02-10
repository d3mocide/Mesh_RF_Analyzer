
import React from 'react';
const SiteSelectionSettings = ({ weights, setWeights, active }) => {
    
    if (!active) return null;

    const handleChange = (key, val) => {
        setWeights(prev => ({ ...prev, [key]: parseFloat(val) }));
    };

    const containerStyle = {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        userSelect: 'none'
    };

    return (
        <div style={containerStyle}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                borderBottom: '1px solid rgba(0, 242, 255, 0.15)',
                paddingBottom: '8px',
                marginBottom: '4px'
            }}>
                <div style={{ 
                    width: 6, height: 6, 
                    borderRadius: '50%', 
                    backgroundColor: '#00f2ff', 
                    boxShadow: '0 0 8px #00f2ff' 
                }}></div>
                <span style={{
                    color: '#00f2ff', 
                    fontWeight: '800', 
                    fontSize: '0.8em', 
                    textTransform: 'uppercase',
                    letterSpacing: '2px'
                }}>
                    Optimization Weights
                </span>
                <div style={{ 
                    width: 6, height: 6, 
                    borderRadius: '50%', 
                    backgroundColor: '#00f2ff', 
                    boxShadow: '0 0 8px #00f2ff' 
                }}></div>
            </div>
            
            {/* Control Grid */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: '16px' 
            }}>
                {Object.entries(weights).map(([key, value]) => {
                    const colorMap = {
                        'ELEVATION': '#a855f7', // Matches Viewshed tool (Purple)
                        'PROMINENCE': '#ff6b00', // Matches RF Simulator tool (Orange)
                        'FRESNEL': '#00ff41'    // Neon Green
                    };
                    
                    const sliderColor = colorMap[key.toUpperCase()] || '#00f2ff';
                    
                    return (
                        <div key={key} style={{
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '6px'
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <label style={{
                                    color: 'rgba(255,255,255,0.7)', 
                                    fontSize: '0.65em', 
                                    textTransform: 'uppercase', 
                                    fontWeight: 'bold'
                                }}>
                                    {key}
                                </label>
                                <span style={{
                                    color: sliderColor, 
                                    fontSize: '0.825em', 
                                    fontWeight: '800', 
                                    fontFamily: 'monospace'
                                }}>
                                    {value.toFixed(1)}
                                </span>
                            </div>
                            
                            <input 
                                type="range" 
                                min="0" max="1" step="0.1" 
                                value={value} 
                                onChange={(e) => handleChange(key, e.target.value)}
                                style={{ 
                                    '--range-progress': `${value * 100}%`,
                                    '--range-color': sliderColor
                                }}
                            />
                        </div>
                    );
                })}
            </div>

            <style>{`
                @keyframes slideDown {
                    from { transform: translate(-50%, -20px); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default SiteSelectionSettings;
