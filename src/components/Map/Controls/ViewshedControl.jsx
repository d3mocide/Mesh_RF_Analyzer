import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';

const ViewshedControl = ({ maxDist, setMaxDist, isCalculating, progress, onRecalculate, isMobile }) => {
    const controlRef = useRef(null);
    // Local state for smooth slider dragging
    const [localDist, setLocalDist] = useState(maxDist);

    useEffect(() => {
        setLocalDist(maxDist);
    }, [maxDist]);

    // Disable map click propagation
    useEffect(() => {
        if (controlRef.current) {
            L.DomEvent.disableClickPropagation(controlRef.current);
            L.DomEvent.disableScrollPropagation(controlRef.current);
        }
    }, []);

    const handleChange = (e) => {
        setLocalDist(Number(e.target.value));
    };

    const handleCommit = () => {
        setMaxDist(localDist);
    };

    return (
        <div ref={controlRef} style={{
            position: 'absolute',
            top: isMobile ? 'auto' : '20px',
            bottom: isMobile ? 'calc(40px + env(safe-area-inset-bottom))' : 'auto',
            right: isMobile ? 'auto' : '20px',
            left: isMobile ? '50%' : 'auto',
            transform: isMobile ? 'translateX(-50%)' : 'none',
            zIndex: 1000,
            background: 'rgba(10, 10, 18, 0.95)',
            backdropFilter: 'blur(8px)',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid rgba(0, 242, 255, 0.3)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
            width: isMobile ? 'min(90vw, 400px)' : '300px',
            color: '#fff',
            fontFamily: "'Inter', sans-serif"
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                paddingBottom: '8px'
            }}>
                <h3 style={{
                    margin: 0,
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    color: '#00f2ff',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                }}>
                    Calculate Viewshed
                </h3>
                {isCalculating && (
                    <div className="spinner" style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid rgba(0, 242, 255, 0.3)',
                        borderTop: '2px solid #00f2ff',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                )}
            </div>

            <div style={{ marginBottom: '8px' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px'
                }}>
                    <label style={{ fontSize: '0.8rem', color: '#888' }}>Max Distance</label>
                    <span style={{ 
                        fontSize: '0.8rem', 
                        color: '#00f2ff', 
                        fontWeight: 'bold',
                        fontFamily: "'JetBrains Mono', monospace"
                    }}>
                        {(localDist / 1609.34).toFixed(1)} mi
                    </span>
                </div>
                
                <input
                    type="range"
                    className="viewshed-slider"
                    min="1000"
                    max="100000"
                    step="1000"
                    value={localDist}
                    onChange={handleChange}
                    onMouseUp={handleCommit}
                    onTouchEnd={handleCommit}
                    style={{
                        width: '100%',
                        cursor: isCalculating ? 'wait' : 'pointer',
                        '--value': `${((localDist - 1000) / (100000 - 1000)) * 100}%`
                    }}
                    disabled={isCalculating}
                />
            </div>

            {/* Recalculate Button */}
            <button
                onClick={onRecalculate}
                disabled={isCalculating}
                style={{
                    width: '100%',
                    marginTop: '12px',
                    padding: '8px 16px',
                    background: isCalculating ? 'rgba(100, 100, 100, 0.2)' : 'rgba(0, 242, 255, 0.15)',
                    border: '1px solid rgba(0, 242, 255, 0.3)',
                    borderRadius: '6px',
                    color: '#00f2ff',
                    cursor: isCalculating ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => !isCalculating && (e.target.style.background = 'rgba(0, 242, 255, 0.25)')}
                onMouseOut={(e) => !isCalculating && (e.target.style.background = 'rgba(0, 242, 255, 0.15)')}
            >
                Recalculate Viewshed
            </button>

            {/* Progress Bar */}
            <div style={{
                height: '4px',
                width: '100%',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '2px',
                overflow: 'hidden',
                marginTop: '8px'
            }}>
                {isCalculating && (
                    <div style={{
                        height: '100%',
                        width: '100%', // Indeterminate for now
                        background: 'linear-gradient(90deg, transparent, #00f2ff, transparent)',
                        backgroundSize: '200% 100%',
                        animation: 'loading-bar 1.5s infinite linear'
                    }} />
                )}
                {!isCalculating && progress > 0 && (
                     <div style={{
                        height: '100%',
                        width: '100%', // Force full width when done
                        background: '#00ff41', // Green for success/complete
                        transition: 'width 0.3s ease, background-color 0.3s ease'
                    }} />
                )}
            </div>
            
            <style>{`
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @keyframes loading-bar { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
                
                /* Custom purple slider styling */
                input[type="range"].viewshed-slider {
                    -webkit-appearance: none;
                    appearance: none;
                    background: transparent;
                }
                
                /* Track - Webkit (Chrome, Safari) */
                input[type="range"].viewshed-slider::-webkit-slider-track {
                    width: 100%;
                    height: 6px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 3px;
                }
                
                /* Track - Firefox */
                input[type="range"].viewshed-slider::-moz-range-track {
                    width: 100%;
                    height: 6px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 3px;
                }
                
                /* Thumb - Webkit */
                input[type="range"].viewshed-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 16px;
                    height: 16px;
                    background: #a855f7;
                    border-radius: 50%;
                    cursor: pointer;
                    box-shadow: 0 0 8px rgba(168, 85, 247, 0.5);
                }
                
                /* Thumb - Firefox */
                input[type="range"].viewshed-slider::-moz-range-thumb {
                    width: 16px;
                    height: 16px;
                    background: #a855f7;
                    border: none;
                    border-radius: 50%;
                    cursor: pointer;
                    box-shadow: 0 0 8px rgba(168, 85, 247, 0.5);
                }
                
                /* Progress fill - Webkit */
                input[type="range"].viewshed-slider::-webkit-slider-runnable-track {
                    background: linear-gradient(to right, #a855f7 0%, #a855f7 var(--value), rgba(255, 255, 255, 0.1) var(--value), rgba(255, 255, 255, 0.1) 100%);
                }
            `}</style>
        </div>
    );
};

export default ViewshedControl;
