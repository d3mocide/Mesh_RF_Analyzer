import React, { useState } from 'react';
import SiteSelectionSettings from './SiteSelectionSettings.jsx';
import NodeManager from './NodeManager.jsx';
import { useRF } from '../../../context/RFContext'; 

const SiteAnalysisPanel = ({ 
    active, 
    weights, 
    setWeights, 

    mode, 
    setMode,
    selectedLocation,
    isResultsVisible
}) => {
    const { isMobile } = useRF();

    if (!active) return null;

    const styles = {
        panel: {
            position: 'absolute',
            top: isMobile ? 'auto' : '20px', 
            bottom: isMobile ? '0' : 'auto',
            left: isMobile ? '0' : 'auto',
            right: isMobile ? '0' : '20px',
            transform: isResultsVisible ? 'translateY(-10px)' : 'none',
            opacity: isResultsVisible ? 0 : 1,
            pointerEvents: isResultsVisible ? 'none' : 'auto',
            width: isMobile ? '100%' : '420px', // widened from 380px
            maxHeight: isMobile ? '80vh' : 'calc(100vh - 160px)',
            borderRadius: isMobile ? '16px 16px 0 0' : '12px',
            borderBottom: isMobile ? 'none' : '1px solid #00f2ff33',
            background: 'rgba(10, 10, 15, 0.98)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'system-ui, sans-serif',
            color: '#eee',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        },
        tabBar: {
            display: 'flex',
            borderBottom: '1px solid #333',
            background: 'rgba(0,0,0,0.2)'
        },
        tab: (isActive) => ({
            flex: 1,
            padding: '12px',
            textAlign: 'center',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: isActive ? '#00f2ff' : '#666',
            background: isActive ? 'rgba(0, 242, 255, 0.05)' : 'transparent',
            borderBottom: isActive ? '2px solid #00f2ff' : '2px solid transparent',
            transition: 'all 0.2s'
        }),
        content: {
            padding: '16px',
            overflowY: 'auto'
        }
    };

    return (
        <div 
            style={styles.panel}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onScroll={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
        >
            {/* Tabs */}
            <div style={styles.tabBar}>
                <div 
                    style={styles.tab(mode === 'auto')} 
                    onClick={() => setMode('auto')}
                >
                    Elevation Scan
                </div>
                <div 
                    style={styles.tab(mode === 'manual')} 
                    onClick={() => setMode('manual')}
                >
                    Multi-Site
                </div>
            </div>

            {/* Content Area */}
            <div style={styles.content}>
                {mode === 'auto' ? (
                    <SiteSelectionSettings 
                        weights={weights} 
                        setWeights={setWeights} 
                        active={true}
                    />
                ) : (
                    <NodeManager selectedLocation={selectedLocation} />
                )}
            </div>

            <style>{`
                @keyframes slideIn {
                    from { transform: translateY(-10px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default SiteAnalysisPanel;
