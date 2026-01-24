import React, { useState } from 'react';
import { useMap } from 'react-leaflet';

const LocateControl = () => {
    const map = useMap();
    const [loading, setLoading] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleLocate = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setLoading(true);

        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser");
            setLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                map.flyTo([latitude, longitude], 15, { duration: 1.5 });
                setLoading(false);
            },
            (error) => {
                console.error("Locate error:", error);
                // Simple feedback - could be enhanced with a toast if available
                alert("Could not access location. Please check browser permissions.");
                setLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    return (
        <div style={{ 
            position: 'absolute', 
            top: isMobile ? '140px' : 'auto', 
            bottom: isMobile ? 'auto' : '110px', 
            right: isMobile ? '10px' : '11px', 
            zIndex: 1000 
        }}>
             <button
                onClick={handleLocate}
                title="Locate Me"
                style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: '#1a1a1a',
                    border: '2px solid #444',
                    borderRadius: '4px',
                    color: loading ? '#00f2ff' : '#eee',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                    transition: 'all 0.2s',
                    padding: 0
                }}
                onMouseOver={e => { if(!loading) {
                    e.currentTarget.style.backgroundColor = '#333';
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.borderColor = '#666';
                }}}
                onMouseOut={e => { if(!loading) {
                    e.currentTarget.style.backgroundColor = '#1a1a1a';
                    e.currentTarget.style.color = '#eee';
                    e.currentTarget.style.borderColor = '#444';
                }}}
             >
                {loading ? (
                    <div className="spinner" style={{
                         width: '14px', height: '14px',
                         border: '2px solid rgba(0, 242, 255, 0.3)',
                         borderTop: '2px solid #00f2ff',
                         borderRadius: '50%',
                         animation: 'spin 1s linear infinite'
                    }} />
                ) : (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <circle cx="12" cy="12" r="7"></circle>
                        <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"></circle>
                    </svg>
                )}
             </button>
             <style>{`
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
             `}</style>
        </div>
    );
};

export default LocateControl;
