
import React, { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import ProfileChart from '../Common/ProfileChart';

const ProfileModal = ({ tx, rx, context, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const modalRef = useRef(null);

    useEffect(() => {
        if (modalRef.current) {
            L.DomEvent.disableScrollPropagation(modalRef.current);
            L.DomEvent.disableClickPropagation(modalRef.current);
        }
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await fetch('/api/calculate-link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tx_lat: tx.lat,
                        tx_lon: tx.lon,
                        rx_lat: rx.lat,
                        rx_lon: rx.lon,
                        tx_height: tx.height || 10, // Default 10m
                        rx_height: rx.height || 2,
                        frequency_mhz: context.freq || 915,
                        model: 'bullington'
                    })
                });
                
                if (!response.ok) throw new Error("API Error");
                
                const result = await response.json();
                setData(result);
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (tx && rx) fetchData();
    }, [tx, rx, context.freq]);

    return (
        <div ref={modalRef} style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.8)', zIndex: 3000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(5px)'
        }} onClick={onClose}>
            <div style={{
                background: '#1a1a20', border: '1px solid #00f2ff',
                borderRadius: '16px', padding: '24px',
                width: '90%', maxWidth: '800px',
                boxShadow: '0 0 30px rgba(0, 242, 255, 0.2)',
                position: 'relative'
            }} onClick={e => e.stopPropagation()}>
                
                <button onClick={onClose} style={{
                    position: 'absolute', top: '16px', right: '16px',
                    background: 'transparent', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer'
                }}>×</button>

                <h2 style={{ color: '#00f2ff', marginTop: 0, marginBottom: '20px' }}>Link Analysis</h2>
                
                {loading && <div style={{ color: '#fff' }}>Loading Profile...</div>}
                
                {error && <div style={{ color: '#ff0000' }}>Error: {error}</div>}
                
                {data && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ccc', fontSize: '0.9em' }}>
                            <div>Status: <span style={{ color: data.status === 'viable' ? '#00ff41' : 'orange' }}>{data.status.toUpperCase()}</span></div>
                            <div>Clearance: {data.min_clearance_ratio.toFixed(2)} F1</div>
                            <div>Distance: {data.dist_km.toFixed(2)} km</div>
                        </div>
                        
                        <div style={{ height: '350px' }}>
                            <ProfileChart data={{
                                ...data,
                                terrain_profile: data.terrain_profile, // Ensure backend provides this
                                los_profile: data.los_profile,
                                fresnel_profile: data.fresnel_profile
                            }} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProfileModal;
