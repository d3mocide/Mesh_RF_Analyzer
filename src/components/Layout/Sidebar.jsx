import React from 'react';
import { RADIO_PRESETS, DEVICE_PRESETS, ANTENNA_PRESETS } from '../../data/presets';
import { useRF } from '../../context/RFContext';

const Sidebar = () => {
    const {
        selectedRadioPreset, setSelectedRadioPreset,
        selectedDevice, setSelectedDevice,
        selectedAntenna, setSelectedAntenna,
        txPower, setTxPower,
        antennaHeight, setAntennaHeight,
        antennaGain, setAntennaGain,
        freq, setFreq,
        bw, setBw,
        sf, setSf,
        cr, setCr,
        erp, cableLoss,
        units, setUnits,
        mapStyle, setMapStyle
    } = useRF();

    const handleTxPowerChange = (e) => {
        setTxPower(Math.min(Number(e.target.value), DEVICE_PRESETS[selectedDevice].tx_power_max));
    };

    const isCustom = selectedRadioPreset === 'CUSTOM';
    const isCustomAntenna = selectedAntenna === 'CUSTOM';

    const sectionStyle = {
        marginBottom: 'var(--spacing-lg)',
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: 'var(--spacing-md)'
    };

    const labelStyle = {
        display: 'block',
        color: 'var(--color-text-muted)',
        fontSize: '0.85rem',
        marginBottom: 'var(--spacing-xs)',
        marginTop: 'var(--spacing-sm)'
    };

    const inputStyle = {
        width: '100%',
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text-main)',
        padding: 'var(--spacing-sm)',
        borderRadius: 'var(--radius-md)',
        fontFamily: 'monospace'
    };

    const selectStyle = {
        ...inputStyle,
        cursor: 'pointer'
    };


  return (
    <aside style={{
        width: '320px',
        background: 'var(--color-bg-panel)',
        borderRight: '1px solid var(--color-border)',
        height: '100vh',
        padding: 'var(--spacing-md)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        position: 'relative',
        overflowY: 'auto'
      }}>
      <h2 style={{ 
        color: 'var(--color-primary)', 
        margin: '0 0 var(--spacing-lg) 0',
        fontSize: '1.2rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        MeshRF
      </h2>
      
      {/* DEVICE SELECTION */}
      <div style={sectionStyle}>
        <h3 style={{fontSize: '1rem', color: '#fff', margin: '0 0 var(--spacing-sm) 0'}}>Hardware</h3>
        
        <label style={labelStyle}>Device Preset</label>
        <select 
            style={selectStyle}
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
        >
            {Object.values(DEVICE_PRESETS).map(device => (
                <option key={device.id} value={device.id}>{device.name}</option>
            ))}
        </select>

        <label style={labelStyle}>Antenna Type</label>
        <select 
            style={selectStyle}
            value={selectedAntenna}
            onChange={(e) => setSelectedAntenna(e.target.value)}
        >
             {Object.values(ANTENNA_PRESETS).map(ant => (
                <option key={ant.id} value={ant.id}>
                    {ant.name} ({ant.gain} dBi)
                </option>
            ))}
        </select>

        {isCustomAntenna && (
            <div>
                 <label style={labelStyle}>Custom Gain (dBi)</label>
                 <input 
                    type="number" 
                    style={inputStyle} 
                    value={antennaGain} 
                    onChange={(e) => setAntennaGain(Number(e.target.value))}
                />
            </div>
        )}

        <label style={labelStyle}>
            Antenna Height: {units === 'imperial' ? `${(antennaHeight * 3.28084).toFixed(0)} ft` : `${antennaHeight} m`}
        </label>
        <input 
            type="range" 
            min="1" max="50" 
            value={antennaHeight} 
            onChange={(e) => setAntennaHeight(Number(e.target.value))}
            style={{width: '100%', cursor: 'pointer'}}
        />
      </div>

      {/* RADIO SETTINGS */}
      <div style={sectionStyle}>
        <h3 style={{fontSize: '1rem', color: '#fff', margin: '0 0 var(--spacing-sm) 0'}}>Radio Config</h3>
        
        <label style={labelStyle}>Radio Preset</label>
        <select 
            style={selectStyle}
            value={selectedRadioPreset}
            onChange={(e) => setSelectedRadioPreset(e.target.value)}
        >
            {Object.values(RADIO_PRESETS).map(preset => (
                <option key={preset.id} value={preset.id}>{preset.name}</option>
            ))}
        </select>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)'}}>
            <div>
                <label style={labelStyle}>Freq (MHz)</label>
                <input 
                    type="number" 
                    style={inputStyle} 
                    value={freq} 
                    disabled={!isCustom}
                    onChange={(e) => isCustom && setFreq(e.target.value)}
                />
            </div>
             <div>
                <label style={labelStyle}>BW (kHz)</label>
                <input 
                    type="number" 
                    style={inputStyle} 
                    value={bw} 
                    disabled={!isCustom}
                    onChange={(e) => isCustom && setBw(e.target.value)}
                />
            </div>
             <div>
                <label style={labelStyle}>SF</label>
                <input 
                    type="number" 
                    style={inputStyle} 
                    value={sf} 
                    disabled={!isCustom}
                    onChange={(e) => isCustom && setSf(e.target.value)}
                />
            </div>
             <div>
                <label style={labelStyle}>CR</label>
                <input 
                    type="number" 
                    style={inputStyle} 
                    value={cr} 
                    disabled={!isCustom}
                    onChange={(e) => isCustom && setCr(e.target.value)}
                />
            </div>
        </div>

        <label style={labelStyle}>
            TX Power (dBm): {txPower} 
            <span style={{color: 'var(--color-secondary)', marginLeft: '8px'}}>
                (Max: {DEVICE_PRESETS[selectedDevice].tx_power_max})
            </span>
        </label>
        <input 
            type="range" 
            min="0" 
            max={DEVICE_PRESETS[selectedDevice].tx_power_max} 
            value={txPower} 
            onChange={handleTxPowerChange}
            style={{width: '100%', cursor: 'pointer', accentColor: 'var(--color-primary)'}}
        />

        {/* ERP CALCULATION DISPLAY */}
        <div style={{
            marginTop: 'var(--spacing-md)', 
            padding: 'var(--spacing-sm)', 
            background: 'var(--glass-bg)', 
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)'
        }}>
            <label style={{fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase'}}>Estimated ERP</label>
            <div style={{fontSize: '1.2rem', color: 'var(--color-primary)', fontWeight: 'bold'}}>
                {erp} dBm
            </div>
            <div style={{fontSize: '0.7rem', color: 'var(--color-text-muted)'}}>
                (TX {txPower} + Gain {antennaGain} - Loss {cableLoss})
            </div>
        </div>
      </div>

        {/* SETTINGS */}
        <div style={sectionStyle}>
             <h3 style={{fontSize: '1rem', color: '#fff', margin: '0 0 var(--spacing-sm) 0'}}>Settings</h3>
             <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px'}}>
                 <label style={{color: '#aaa', fontSize: '0.9em'}}>Units</label>
                 <div style={{display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', overflow: 'hidden', border: '1px solid #444'}}>
                     <button 
                        onClick={() => setUnits('metric')}
                        style={{
                            background: units === 'metric' ? 'var(--color-primary)' : 'transparent',
                            color: units === 'metric' ? '#000' : '#888',
                            border: 'none',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: '0.8em',
                            fontWeight: 600
                        }}
                     >
                        Metric
                     </button>
                     <button 
                        onClick={() => setUnits('imperial')}
                        style={{
                            background: units === 'imperial' ? 'var(--color-primary)' : 'transparent',
                            color: units === 'imperial' ? '#000' : '#888',
                            border: 'none',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: '0.8em',
                            fontWeight: 600
                        }}
                     >
                        Imperial
                     </button>
                 </div>
             </div>
             
             {/* Map Style Selector */}
             <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', marginTop: '12px'}}>
                 <label style={{color: '#aaa', fontSize: '0.9em'}}>Map Style</label>
                 <select 
                    value={mapStyle}
                    onChange={(e) => setMapStyle(e.target.value)}
                    style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid #444',
                        color: '#eee',
                        borderRadius: '4px',
                        padding: '4px',
                        fontSize: '0.85em',
                        width: '120px'
                    }}
                 >
                     <option value="dark">Dark Matter</option>
                     <option value="light">Light Mode</option>
                     <option value="topo">Topography</option>
                     <option value="satellite">Satellite</option>
                 </select>
             </div>
        </div>

    </aside>
  );
};

export default Sidebar;
