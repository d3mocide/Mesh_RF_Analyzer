import React from 'react';

const ToolbarButton = ({ active, onClick, color, children }) => (
    <button 
        onClick={onClick}
        style={{
            background: active ? color : '#222',
            color: active ? '#000' : '#fff',
            border: '1px solid #444',
            padding: '0 12px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px',
            boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
            whiteSpace: 'nowrap',
            flexShrink: 0
        }}
    >
        {children}
    </button>
);

const MapToolbar = ({ toolMode, setToolMode, resetToolState }) => {
    const toggleMode = (mode) => {
        resetToolState();
        setToolMode(toolMode === mode ? 'none' : mode);
    };

    return (
        <div className="tool-bar-wrapper" style={{
            position: 'absolute', 
            top: 'calc(var(--safe-area-top, 0px) + 20px)', 
            left: 20, 
            zIndex: 1000,
            maxWidth: 'calc(100vw - 40px)', // Constrain width on mobile
            height: '40px', // Fixed height container
            overflow: 'hidden', // Hide overflow of wrapper
            display: 'flex',
            alignItems: 'center'
        }}>
            <div className="tool-bar-scroll" style={{ 
                display: 'flex', 
                gap: '12px',
                overflowX: 'auto', // Enable scroll
                whiteSpace: 'nowrap',
                scrollbarWidth: 'none', // Hide scrollbar FF
                msOverflowStyle: 'none', // Hide scrollbar IE
                paddingRight: '60px' // Space for fade
            }}>
            {/* Hide Scrollbar Chrome/Safari */}
            <style>{`
              .tool-bar-scroll::-webkit-scrollbar { display: none; }
              @media (min-width: 768px) {
                  .scroll-hint { display: none !important; }
                  .tool-bar-wrapper { max-width: none !important; }
              }
            `}</style>
            
            <ToolbarButton 
                active={toolMode === 'link'} 
                onClick={() => toggleMode('link')}
                color="#00ff41"
            >
                Link Analysis
            </ToolbarButton>
    
            <ToolbarButton 
                active={toolMode === 'optimize'} 
                onClick={() => toggleMode('optimize')}
                color="#00f2ff"
            >
                {toolMode === 'optimize' ? 'Cancel Finder' : 'Site Finder'}
            </ToolbarButton>
    
            <ToolbarButton 
                active={toolMode === 'viewshed'} 
                onClick={() => toggleMode('viewshed')}
                color="#a855f7"
            >
                Viewshed
            </ToolbarButton>
            
            <ToolbarButton 
                active={toolMode === 'rf_coverage'} 
                onClick={() => toggleMode('rf_coverage')}
                color="#ff6b00"
            >
                RF Simulator
            </ToolbarButton>
        </div> {/* Close scroll container */}
        
        {/* Scroll Hint Overlay */}
        <div className="scroll-hint" style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '60px',
            background: 'linear-gradient(to right, transparent, transparent 20%, rgba(0,0,0,0.6) 100%)',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: '12px'
        }}>
            <span style={{color: '#fff', fontSize: '20px', fontWeight: 'bold', textShadow: '0 0 5px #000'}}>›</span>
        </div>
        
        </div>
    );
};

export default MapToolbar;
