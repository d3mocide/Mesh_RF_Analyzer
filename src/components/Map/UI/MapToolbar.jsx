import React from 'react';

const MapToolbar = ({ toolMode, setToolMode, resetToolState }) => {
    return (
        <div className="tool-bar-wrapper" style={{
            position: 'absolute', 
            top: 20, 
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
            
            <button 
              onClick={() => {
                  if (toolMode === 'link') {
                      resetToolState();
                      setToolMode('none');
                  } else {
                      resetToolState();
                      setToolMode('link');
                  }
              }}
              style={{
                  background: toolMode === 'link' ? '#00ff41' : '#222',
                  color: toolMode === 'link' ? '#000' : '#fff',
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
              Link Analysis
            </button>
    
            <button 
              onClick={() => {
                  if(toolMode === 'optimize') {
                      resetToolState();
                      setToolMode('none');
                  } else {
                      resetToolState();
                      setToolMode('optimize');
                  }
              }}
              style={{
                  background: toolMode === 'optimize' ? '#00f2ff' : '#222',
                  color: toolMode === 'optimize' ? '#000' : '#fff',
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
              {toolMode === 'optimize' ? 'Cancel Scan' : 'Elevation Scan'}
            </button>
    
            <button 
              onClick={() => {
                  if(toolMode === 'viewshed') {
                      resetToolState();
                      setToolMode('none');
                  } else {
                      resetToolState();
                      setToolMode('viewshed');
                  }
              }}
              style={{
                  // display: 'none', // Hidden - requires backend server at localhost:5001
                  background: toolMode === 'viewshed' ? '#a855f7' : '#222',
                  color: toolMode === 'viewshed' ? '#000' : '#fff',
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
              Viewshed
            </button>
            
            <button 
              onClick={() => {
                  if(toolMode === 'rf_coverage') {
                      resetToolState();
                      setToolMode('none');
                  } else {
                      resetToolState();
                      setToolMode('rf_coverage');
                  }
              }}
              style={{
                  background: toolMode === 'rf_coverage' ? '#ff6b00' : '#222',
                  color: toolMode === 'rf_coverage' ? '#000' : '#fff',
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
              RF Simulator
            </button>
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
