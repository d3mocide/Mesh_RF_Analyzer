import React, { useState, useEffect, useRef } from 'react';
import { useRF } from '../../../context/RFContext';
import useSimulationStore from '../../../store/useSimulationStore';
import { Download, Upload, FileSpreadsheet } from 'lucide-react';

const NodeManager = ({ selectedLocation }) => {
    const { units } = useRF();
    const { nodes: simNodes, addNode, removeNode, startScan, isScanning, scanProgress, results: simResults, compositeOverlay, setNodes } = useSimulationStore();
    const [manualLat, setManualLat] = useState('');
    const [manualLon, setManualLon] = useState('');
    const fileInputRef = useRef(null);

    const handleCSVImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            const lines = text.split('\n');
            const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
            
            const importedNodes = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const values = line.split(',').map(v => v.trim());
                const node = {};
                
                headers.forEach((header, idx) => {
                    const val = values[idx];
                    if (header === 'lat') node.lat = parseFloat(val);
                    else if (header === 'lon' || header === 'lng') node.lon = parseFloat(val);
                    else if (header === 'name') node.name = val;
                    else if (header === 'antenna_height') node.height = parseFloat(val);
                    else if (header === 'tx_power') node.txPower = parseFloat(val);
                });

                if (!isNaN(node.lat) && !isNaN(node.lon)) {
                    importedNodes.push({
                        lat: node.lat,
                        lon: node.lon,
                        height: node.height || 10,
                        name: node.name || `Imported Site ${i}`,
                        txPower: node.txPower || 20
                    });
                }
            }

            if (importedNodes.length > 0) {
                setNodes(importedNodes);
            }
        };
        reader.readAsText(file);
        // Clear input so same file can be re-imported
        e.target.value = null;
    };

    const downloadTemplate = () => {
        const headers = 'name,lat,lon,antenna_height,tx_power\n';
        const example = 'Site A,45.5152,-122.6784,15,20\nSite B,45.5230,-122.6670,10,20';
        const blob = new Blob([headers + example], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mesh-site-template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };
    const [isGreedy, setIsGreedy] = useState(false);
    const [targetCount, setTargetCount] = useState(3);

    useEffect(() => {
        if (selectedLocation) {
            setManualLat(selectedLocation.lat.toFixed(6));
            setManualLon(selectedLocation.lng.toFixed(6));
        }
    }, [selectedLocation]);

    const handleAdd = () => {
        if (!manualLat || !manualLon) return;
        addNode({ 
            lat: parseFloat(manualLat), 
            lon: parseFloat(manualLon), 
            height: 10,
            name: `Node ${simNodes.length + 1}`
        });
        setManualLat('');
        setManualLon('');
    };

    const handleRunScan = () => {
        startScan(isGreedy ? targetCount : null);
    };

    const styles = {
        container: {
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'system-ui, sans-serif'
        },
        header: {
            fontWeight: 'bold',
            fontSize: '1em',
            marginBottom: '12px',
            color: '#00f2ff', 
            textTransform: 'uppercase',
            letterSpacing: '1px',
            borderBottom: '1px solid #00f2ff33',
            paddingBottom: '8px',
            flexShrink: 0
        },
        inputGroup: {
            display: 'flex',
            gap: '8px',
            marginBottom: '16px'
        },
        input: {
            width: '33%',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid #333',
            borderRadius: '4px',
            padding: '6px 8px',
            fontSize: '0.875rem',
            color: '#fff',
            outline: 'none',
            transition: 'border-color 0.2s',
            fontFamily: 'monospace'
        },
        addButton: {
            backgroundColor: 'rgba(0, 242, 255, 0.1)',
            color: '#00f2ff',
            padding: '4px 12px',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            border: '1px solid #00f2ff66',
            cursor: 'pointer',
            textTransform: 'uppercase',
            transition: 'all 0.2s'
        },
        nodeList: {
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginBottom: '16px',
            maxHeight: '180px',
            overflowY: 'auto',
            paddingRight: '8px' // Space for scrollbar
        },
        nodeItem: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #333'
        },
        removeBtn: {
            color: '#ff4444', 
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.1rem',
            padding: '0 8px',
            opacity: 0.8,
            transition: 'opacity 0.2s'
        },
        actionButton: {
            width: '100%',
            padding: '10px 0',
            borderRadius: '4px',
            fontWeight: 'bold',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textTransform: 'uppercase',
            fontSize: '0.8rem',
            letterSpacing: '1px'
        },
        scanBarContainer: {
            width: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '2px',
            height: '6px',
            marginTop: '8px',
            overflow: 'hidden'
        },
        scanBarFill: {
            height: '100%',
            backgroundColor: '#00f2ff',
            boxShadow: '0 0 10px #00f2ff',
            transition: 'width 0.3s ease'
        },
        optContainer: {
            background: 'rgba(0, 242, 255, 0.03)',
            border: '1px solid rgba(0, 242, 255, 0.15)',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '12px'
        },
        bulkHeader: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
            padding: '0 4px'
        },
        bulkButton: {
            flex: 1,
            padding: '8px',
            background: 'rgba(0, 242, 255, 0.05)',
            border: '1px solid rgba(0, 242, 255, 0.2)',
            borderRadius: '6px',
            color: '#00f2ff',
            fontSize: '0.85em',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
        },
        templateLink: {
            color: '#888',
            fontSize: '0.75em',
            textDecoration: 'underline',
            cursor: 'pointer',
            marginLeft: '10px'
        },
        styleSheet: `
            /* Theme number input spinners */
            input[type=number]::-webkit-inner-spin-button,
            input[type=number]::-webkit-outer-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            
            input[type=number] {
                -moz-appearance: textfield;
                position: relative;
            }

            /* Custom Arrows Replacement */
            .input-with-arrows {
                position: relative;
                display: flex;
                align-items: center;
            }

            .custom-arrows {
                position: absolute;
                right: 5px;
                display: flex;
                flex-direction: column;
                gap: 2px;
                pointer-events: none;
                opacity: 0.6;
            }

            .arrow-up {
                width: 0; 
                height: 0; 
                border-left: 4px solid transparent;
                border-right: 4px solid transparent;
                border-bottom: 5px solid #00f2ff;
            }

            .arrow-down {
                width: 0; 
                height: 0; 
                border-left: 4px solid transparent;
                border-right: 4px solid transparent;
                border-top: 5px solid #00f2ff;
            }
        `
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>Multi-Site Analysis</div>
            
            {/* Input Form */}
            <div style={styles.inputGroup}>
                <div className="input-with-arrows" style={{ width: '33%' }}>
                    <input 
                        type="number" 
                        placeholder="Lat" 
                        value={manualLat}
                        onChange={(e) => setManualLat(e.target.value)}
                        style={{ ...styles.input, width: '100%' }}
                    />
                    <div className="custom-arrows">
                        <div className="arrow-up"></div>
                        <div className="arrow-down"></div>
                    </div>
                </div>
                <div className="input-with-arrows" style={{ width: '33%' }}>
                    <input 
                        type="number" 
                        placeholder="Lon" 
                        value={manualLon}
                        onChange={(e) => setManualLon(e.target.value)}
                        style={{ ...styles.input, width: '100%' }}
                    />
                    <div className="custom-arrows">
                        <div className="arrow-up"></div>
                        <div className="arrow-down"></div>
                    </div>
                </div>
                <button 
                    onClick={handleAdd}
                    style={styles.addButton}
                >
                    Add
                </button>
            </div>

            {/* Bulk Import Section */}
            <div style={{ padding: '0 12px', marginBottom: '20px' }}>
                <div style={styles.bulkHeader}>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        style={styles.bulkButton}
                        onMouseOver={e => {
                            e.currentTarget.style.background = 'rgba(0, 242, 255, 0.15)';
                            e.currentTarget.style.borderColor = 'rgba(0, 242, 255, 0.4)';
                        }}
                        onMouseOut={e => {
                            e.currentTarget.style.background = 'rgba(0, 242, 255, 0.05)';
                            e.currentTarget.style.borderColor = 'rgba(0, 242, 255, 0.2)';
                        }}
                    >
                        <Upload size={14} />
                        Bulk Import (CSV)
                    </button>
                    <div 
                        onClick={downloadTemplate}
                        style={styles.templateLink}
                    >
                        Get Template
                    </div>
                </div>
                <input 
                    type="file" 
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".csv"
                    onChange={handleCSVImport}
                />
            </div>

            {/* Node List */}
            <div style={styles.nodeList} className="node-list-scroll">
                {simNodes.length === 0 && (
                    <div style={{textAlign: 'center', color: '#555', padding: '16px', border: '1px dashed #333', borderRadius: '4px', fontSize: '0.85em'}}>
                        No candidate points added
                    </div>
                )}
                
                {simNodes.map((node) => (
                    <div key={node.id} style={styles.nodeItem}>
                        <div>
                            <div style={{fontWeight: '600', fontSize: '0.8rem', color: '#fff'}}>{node.name}</div>
                            <div style={{fontSize: '0.7rem', color: '#00f2ff', fontFamily: 'monospace'}}>{node.lat.toFixed(4)}, {node.lon.toFixed(4)}</div>
                        </div>
                        <button onClick={() => removeNode(node.id)} style={styles.removeBtn}>×</button>
                    </div>
                ))}
            </div>

            {/* Optimization Config */}
            <div style={styles.optContainer}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                    <span style={{color: '#00f2ff', fontSize: '0.75em', fontWeight: 'bold', textTransform: 'uppercase'}}>Greedy Optimization</span>
                    <input 
                        type="checkbox" 
                        checked={isGreedy} 
                        onChange={(e) => setIsGreedy(e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        style={{accentColor: '#00f2ff', cursor: 'pointer'}}
                    />
                </div>
                
                {isGreedy && (
                    <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.7em', color: '#888'}}>
                            <span>Target Node Count</span>
                            <span style={{color: '#00f2ff', fontWeight: 'bold'}}>{targetCount}</span>
                        </div>
                        <input 
                            type="range" 
                            min="1" max={Math.max(1, simNodes.length)} step="1"
                            value={targetCount}
                            onChange={(e) => setTargetCount(parseInt(e.target.value))}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            style={{width: '100%', accentColor: '#00f2ff'}}
                        />
                    </div>
                )}
            </div>

            {/* Status & Actions */}
            {isScanning ? (
                <div>
                    <div style={{fontSize: '0.8rem', color: '#00f2ff', fontFamily: 'monospace', marginBottom: '6px', display: 'flex', justifyContent: 'space-between'}}>
                        <span>SCANNING...</span>
                        <span>{Math.round(scanProgress)}%</span>
                    </div>
                    <div style={styles.scanBarContainer}>
                        <div style={{...styles.scanBarFill, width: `${scanProgress}%`}}></div>
                    </div>
                </div>
            ) : (
                <button 
                    onClick={handleRunScan}
                    disabled={simNodes.length < (isGreedy ? 1 : 2)}
                    style={{
                        ...styles.actionButton,
                        backgroundColor: (simNodes.length < (isGreedy ? 1 : 2)) ? 'rgba(255,255,255,0.05)' : 'rgba(0, 242, 255, 0.15)',
                        border: (simNodes.length < (isGreedy ? 1 : 2)) ? '1px solid #333' : '1px solid #00f2ff',
                        color: (simNodes.length < (isGreedy ? 1 : 2)) ? '#555' : '#00f2ff',
                        cursor: (simNodes.length < (isGreedy ? 1 : 2)) ? 'not-allowed' : 'pointer',
                        boxShadow: (simNodes.length < (isGreedy ? 1 : 2)) ? 'none' : '0 0 15px rgba(0, 242, 255, 0.2)'
                    }}
                >
                    Run Site Analysis
                </button>
            )}
            <style>{styles.styleSheet}</style>
        </div>
    );
};

export default NodeManager;
