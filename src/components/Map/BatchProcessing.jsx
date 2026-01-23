import React, { useState, useRef, useEffect } from 'react';
import { useRF } from '../../context/RFContext';
import { fetchElevationPath } from '../../utils/elevation';
import { analyzeLinkProfile, calculateLinkBudget } from '../../utils/rfMath';

const BatchProcessing = () => {
    const {
        batchNodes, setBatchNodes,
        setShowBatchPanel,
        freq, antennaHeight, antennaGain,
        txPower, cableLoss,
        kFactor, clutterHeight,
        sf, bw,
        isMobile, sidebarIsOpen
    } = useRF();

    const [batchNotification, setBatchNotification] = useState(null); // { message, type }
    const fileInputRef = useRef(null);

    // Auto-close batch notification after 2 seconds
    useEffect(() => {
        if (batchNotification) {
            const timer = setTimeout(() => {
                setBatchNotification(null);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [batchNotification]);

    const sectionStyle = {
        marginBottom: 'var(--spacing-lg)',
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: 'var(--spacing-md)'
    };

    const buttonStyle = {
        padding: '8px 16px',
        border: 'none',
        borderRadius: '4px',
        color: '#fff',
        fontWeight: 'bold',
        cursor: 'pointer',
        fontSize: '0.9rem',
        marginTop: '8px'
    };

    return (
        <div style={sectionStyle}>
            <h3 style={{fontSize: '1rem', color: '#fff', margin: '0 0 var(--spacing-sm) 0'}}>Batch Processing</h3>
            
            {/* Import */}
            <div style={{marginBottom: '8px'}}>
                <label htmlFor="csv-upload" style={{display: 'block', padding: '6px 10px', background: '#333', color: '#ccc', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8em', textAlign: 'center'}}>
                    Import Nodes (CSV)
                    <input 
                    id="csv-upload"
                    name="csv-upload"
                    ref={fileInputRef}
                    type="file" 
                    accept=".csv"
                    style={{display: 'none'}}
                    onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                const text = event.target.result;
                                const lines = text.split('\n');
                                const newNodes = [];
                                lines.forEach((line, idx) => {
                                    if (idx === 0 && line.toLowerCase().includes('lat')) return; // Skip header
                                    const parts = line.split(',');
                                    if (parts.length >= 3) {
                                        let name, lat, lng;
                                        
                                        // Simple heuristic: if parts[0] is number, it's lat.
                                        if (!isNaN(parseFloat(parts[0]))) {
                                                lat = parseFloat(parts[0]);
                                                lng = parseFloat(parts[1]);
                                                name = parts[2] || `Node ${idx}`;
                                        } else {
                                                name = parts[0];
                                                lat = parseFloat(parts[1]);
                                                lng = parseFloat(parts[2]);
                                        }
                                        
                                        if (!isNaN(lat) && !isNaN(lng)) {
                                            newNodes.push({ id: idx, name: name.trim(), lat, lng });
                                        }
                                    }
                                });
                                setBatchNodes(newNodes);
                                setShowBatchPanel(true);
                                setBatchNotification({ message: `Successfully imported ${newNodes.length} nodes`, type: 'success' });
                                // Reset file input to allow re-upload of same file
                                if (fileInputRef.current) {
                                    fileInputRef.current.value = '';
                                }
                            };
                            reader.readAsText(file);
                        }
                    }}
                    />
                </label>
                <div style={{fontSize: '0.7em', color: '#666', marginTop: '4px'}}>
                Format: Name, Lat, Lon 
                <span style={{color: '#444', margin: '0 4px'}}>|</span>
                <a 
                    href="data:text/csv;charset=utf-8,Name,Lat,Lon%0ASite%20Alpha,45.5152,-122.6784%0ASite%20Bravo,45.5252,-122.6684%0ASite%20Charlie,45.5052,-122.6884%0ASite%20Delta,45.5100,-122.6500%0ASite%20Echo,45.5300,-122.6900" 
                    download="meshrf_template.csv"
                    style={{color: 'var(--color-primary)', textDecoration: 'none', cursor: 'pointer'}}
                >
                    Download Template
                </a>
                </div>
            </div>

            {/* Export Report */}
            {batchNodes.length > 1 && (
                <button 
                style={{...buttonStyle, background: '#00afb9', width: '100%'}}
                onClick={async () => {
                        const totalLinks = batchNodes.length * (batchNodes.length - 1) / 2;
                        if (batchNodes.length > 20 && !window.confirm(`Preparing to analyze ${totalLinks} links. This may take a while. Continue?`)) return;
                        
                        const startExport = async () => {
                            let csvContent = "data:text/csv;charset=utf-8,Source,Target,Distance_km,Status,Quality,Margin_dB,Clearance_m\n";
                            
                            // Iterate all pairs
                            for (let i = 0; i < batchNodes.length; i++) {
                                for (let j = i + 1; j < batchNodes.length; j++) {
                                    const n1 = batchNodes[i];
                                    const n2 = batchNodes[j];
                                    
                                    try {
                                        // Fetch Profile
                                        const profile = await fetchElevationPath(
                                            {lat: n1.lat, lng: n1.lng}, 
                                            {lat: n2.lat, lng: n2.lng}, 
                                            20 // Lower resolution for batch to save time
                                        );
                                        
                                        if (profile) {
                                            const analysis = analyzeLinkProfile(
                                                profile, 
                                                freq, 
                                                antennaHeight, 
                                                antennaHeight,
                                                kFactor,
                                                clutterHeight
                                            );
                                            
                                            const distKm = profile[profile.length-1].distance;
                                            
                                            // Link Budget
                                            const budget = calculateLinkBudget({
                                                txPower, 
                                                txGain: antennaGain, 
                                                txLoss: cableLoss,
                                                rxGain: antennaGain, 
                                                rxLoss: cableLoss,
                                                distanceKm: distKm, 
                                                freqMHz: freq,
                                                sf, bw
                                            });
                                            
                                            const status = analysis.isObstructed ? 'OBSTRUCTED' : (budget.margin > 10 ? 'GOOD' : 'MARGINAL');
                                            
                                            csvContent += `${n1.name},${n2.name},${distKm.toFixed(3)},${status},${analysis.linkQuality},${budget.margin},${analysis.minClearance}\n`;
                                        }
                                    } catch (e) {
                                        console.error("Batch Error", e);
                                        csvContent += `${n1.name},${n2.name},ERR,ERR,ERR,ERR,ERR\n`;
                                    }
                                    
                                    // Small delay to prevent browser freeze & rate limit
                                    await new Promise(r => setTimeout(r, 200));
                                }
                            }
                            
                            // Trigger Download
                            const encodedUri = encodeURI(csvContent);
                            const link = document.createElement("a");
                            link.setAttribute("href", encodedUri);
                            link.setAttribute("download", `mesh_rf_analysis_${new Date().toISOString().slice(0,10)}.csv`);
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        };
                        
                        // Allow UI to update before blocking
                        setTimeout(startExport, 100);
                }}
                >
                    Export Mesh Report
                </button>
            )}
            {batchNodes.length > 0 && (
                <div style={{fontSize: '0.75em', color: '#888', marginTop: '4px'}}>{batchNodes.length} Nodes Loaded</div>
            )}

            {/* Batch Import Notification Overlay */}
            {batchNotification && (
                <div style={{
                    position: 'fixed', 
                    top: '50%', 
                    // Center in the map area (assuming sidebar is ~320px)
                    left: (!isMobile && sidebarIsOpen) ? 'calc(50% + 160px)' : '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(10, 10, 15, 0.95)', 
                    color: batchNotification.type === 'success' ? '#4ade80' : '#f87171',
                    padding: '30px 50px', 
                    borderRadius: '16px', 
                    border: batchNotification.type === 'success' ? '1px solid rgba(50, 255, 100, 0.3)' : '1px solid rgba(255, 50, 50, 0.3)',
                    boxShadow: batchNotification.type === 'success' 
                        ? '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 30px rgba(50, 255, 100, 0.1)' 
                        : '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 30px rgba(255, 50, 50, 0.1)',
                    zIndex: 3000,
                    textAlign: 'center',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px',
                    minWidth: '280px'
                }}>
                    <div style={{
                        width: '48px', height: '48px',
                        borderRadius: '50%',
                        background: batchNotification.type === 'success' ? 'rgba(50, 255, 100, 0.1)' : 'rgba(255, 50, 50, 0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: batchNotification.type === 'success' ? '2px solid rgba(50, 255, 100, 0.2)' : '2px solid rgba(255, 50, 50, 0.2)'
                    }}>
                        {batchNotification.type === 'success' ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        )}
                    </div>
                    
                    <div style={{ fontSize: '1.1em', fontWeight: '700', color: '#fff' }}>
                        {batchNotification.type === 'success' ? 'IMPORT SUCCESSFUL' : 'IMPORT FAILED'}
                    </div>
                    <div style={{ fontSize: '0.9em', color: 'rgba(255, 255, 255, 0.7)' }}>
                        {batchNotification.message}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BatchProcessing;
