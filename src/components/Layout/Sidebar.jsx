import React, { useState, useEffect } from 'react';
import { RADIO_PRESETS, DEVICE_PRESETS, ANTENNA_PRESETS, CABLE_TYPES } from '../../data/presets';
import { useRF, GROUND_TYPES, CLIMATE_ZONES } from '../../context/RFContext';
import BatchProcessing from '../Map/BatchProcessing';

const CollapsibleSection = ({ title, isOpen, onToggle, children, isShared = false, isITM = false, alwaysVisible = null }) => (
    <div style={{
        marginBottom: 'var(--spacing-xs)', // Reduced from md to bring next section closer
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: isOpen ? 'var(--spacing-sm)' : '4px' 
    }}>
        <h3 
            onClick={onToggle}
            style={{
                fontSize: '1rem', 
                color: '#fff', 
                margin: '0 0 var(--spacing-sm) 0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                userSelect: 'none'
            }}
        >
            <div>
                {title}
                {isShared && <span style={{fontSize: '0.8em', color: '#888', fontWeight: 'normal', marginLeft: '6px'}}>(Shared)</span>}
                {isITM && <span style={{fontSize: '0.8em', color: '#888', fontWeight: 'normal', marginLeft: '6px'}}>(ITM)</span>}
            </div>
            <span style={{fontSize: '0.8em', color: '#888', display: 'flex', alignItems: 'center'}}>
                {isOpen ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6"/>
                    </svg>
                ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6"/>
                    </svg>
                )}
            </span>
        </h3>
        
        {alwaysVisible && (
            <div style={{ marginBottom: isOpen ? '12px' : '8px' }}> {/* Added margin when closed */}
                {alwaysVisible}
            </div>
        )}

        {isOpen && (
            <div style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
                {children}
            </div>
        )}
    </div>
);

const Sidebar = () => {
    const {
        selectedRadioPreset, setSelectedRadioPreset,
        selectedDevice, setSelectedDevice,
        selectedAntenna, setSelectedAntenna,
        txPower, setTxPower,
        antennaHeight, setAntennaHeight,
        antennaGain, setAntennaGain,
        selectedCableType, setSelectedCableType,
        cableLength, setCableLength,
        freq, setFreq,
        bw, setBw,
        sf, setSf,
        cr, setCr,
        erp, cableLoss,
        units, setUnits,
        mapStyle, setMapStyle,
        kFactor, setKFactor,
        clutterHeight, setClutterHeight,
        batchNodes, setBatchNodes,
        setShowBatchPanel,
        triggerRecalc,
        editMode, setEditMode,
        rxHeight, setRxHeight,
        toolMode,
        sidebarIsOpen, setSidebarIsOpen,
        isMobile,
        groundType, setGroundType,
        climate, setClimate,
        fadeMargin, setFadeMargin
    } = useRF();



    // Initial sync
    useEffect(() => {
        if (isMobile && sidebarIsOpen) setSidebarIsOpen(false);
    }, [isMobile]); // Add dependency

    const isOpen = sidebarIsOpen;
    const setIsOpen = setSidebarIsOpen;

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
        cursor: 'pointer',
        // Arrow SVG (Cyan Chevron)
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2300f2ff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
        backgroundSize: '16px',
        paddingRight: '32px', // Space for arrow
        appearance: 'none',
        WebkitAppearance: 'none',
        MozAppearance: 'none'
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

    const [sections, setSections] = useState({
        hardware: true,
        radio: false,
        environment: true
    });

    const toggleSection = (section) => {
        setSections(prev => ({ ...prev, [section]: !prev[section] }));
    };





  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
        style={{
            position: isMobile ? 'fixed' : 'absolute', // Stay with sidebar
            top: 'calc(var(--safe-area-top, 0px) + 76px)',
            left: isOpen ? '330px' : '15px', // Floating to the right
            zIndex: 2010, // Above sidebar (2000)
            background: 'var(--color-primary)',
            color: '#000',
            border: 'none',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
            transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            fontSize: '10px'
        }}
      >
        {isOpen ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6"/>
            </svg>
        ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6"/>
            </svg>
        )}
      </button>

      <aside style={{
        width: isOpen ? '320px' : '0px',
        background: 'var(--color-bg-panel)',
        borderRight: '1px solid var(--color-border)',
        height: '100dvh',
        paddingTop: isOpen ? 'calc(var(--safe-area-top, 0px) + var(--spacing-md))' : '0px',
        paddingLeft: isOpen ? 'var(--spacing-md)' : '0px',
        paddingRight: isOpen ? 'calc(var(--spacing-md) + 4px)' : '0px', // Extra room for scrollbar
        paddingBottom: isOpen ? 'calc(var(--safe-area-bottom, 0px) + var(--spacing-md))' : '0px',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 2000,
        position: isMobile ? 'fixed' : 'relative',
        overflowY: 'auto',
        overflowX: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        whiteSpace: 'nowrap',
        opacity: isOpen ? 1 : 0,
        boxShadow: isMobile && isOpen ? '4px 0 20px rgba(0,0,0,0.5)' : 'none'
      }}>
      <h2 style={{ 
        color: 'var(--color-primary)', 
        margin: '0 0 var(--spacing-lg) 0',
        fontSize: '1.2rem',
        letterSpacing: '0.05em',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px'
      }}>
        <img src="/icon.svg" alt="App Icon" style={{ height: '24px', width: '24px' }} /> meshRF
      </h2>

      {/* EDIT MODE BANNER - COMPACT */}
      {editMode !== 'GLOBAL' && (
          <div style={{
              background: editMode === 'A' ? 'rgba(0, 255, 65, 0.1)' : 'rgba(255, 50, 50, 0.1)',
              borderLeft: `3px solid ${editMode === 'A' ? '#00ff41' : '#ff0000'}`,
              padding: '8px 12px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
          }}>
              <div>
                  <div style={{fontSize: '0.7em', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1'}}>
                      Editing Config
                  </div>
                  <div style={{
                      color: editMode === 'A' ? '#00ff41' : '#ff4444', 
                      fontWeight: '700', 
                      fontSize: '0.95em',
                      marginTop: '4px'
                  }}>
                      {editMode === 'A' ? 'NODE A (TX)' : 'NODE B (RX)'}
                  </div>
              </div>

              <button 
                  onClick={() => setEditMode('GLOBAL')}
                  style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#ddd',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: '0.75em',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                      e.currentTarget.style.color = '#fff';
                  }}
                  onMouseOut={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.color = '#ddd';
                  }}
              >
                  <span>Done</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
              </button>
          </div>
      )}
      
      {/* DEVICE SELECTION */}
      <CollapsibleSection 
          title={editMode === 'GLOBAL' ? 'Hardware Config' : 'Node Hardware'}
          isOpen={sections.hardware}
          onToggle={() => toggleSection('hardware')}
      >
        <div style={{ paddingLeft: editMode !== 'GLOBAL' ? '12px' : '0', borderLeft: editMode !== 'GLOBAL' ? `3px solid ${editMode === 'A' ? '#00ff41' : '#ff0000'}` : 'none' }}>
        <label style={labelStyle} htmlFor="device-preset">Device Preset</label>
        <select 
            id="device-preset"
            name="device-preset"
            style={selectStyle}
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
        >
            {Object.values(DEVICE_PRESETS).map(device => (
                <option key={device.id} value={device.id}>{device.name}</option>
            ))}
        </select>

        <label style={labelStyle} htmlFor="antenna-type">Antenna Type</label>
        <select 
            id="antenna-type"
            name="antenna-type"
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
                 <label style={labelStyle} htmlFor="custom-gain">Custom Gain (dBi)</label>
                 <input 
                    id="custom-gain"
                    name="custom-gain"
                    type="number" 
                    style={inputStyle} 
                    value={antennaGain} 
                    onChange={(e) => setAntennaGain(Number(e.target.value))}
                />
            </div>
        )}

        <label style={labelStyle} htmlFor="antenna-height">
            Antenna Height: {units === 'imperial' ? `${(antennaHeight * 3.28084).toFixed(0)} ft` : `${antennaHeight} m`}
        </label>
        <input 
            id="antenna-height"
            name="antenna-height"
            aria-label="Antenna Height"
            type="range" 
            min="1" max="50" 
            value={antennaHeight} 
            onChange={(e) => setAntennaHeight(Number(e.target.value))}
            style={{width: '100%', cursor: 'pointer'}}
        />

        {/* RX Height Slider - Only for RF Coverage Tool */}
        {toolMode === 'rf_coverage' && (
            <div style={{marginTop: 'var(--spacing-md)'}}>
                <label style={labelStyle} htmlFor="rx-height">
                    Receiver Height: {units === 'imperial' ? `${(rxHeight * 3.28084).toFixed(0)} ft` : `${rxHeight} m`}
                    <span style={{color: 'var(--color-text-muted)', marginLeft: '8px', fontSize: '0.8em'}}>
                        ({rxHeight <= 2 ? 'Handheld' : rxHeight <= 5 ? 'Vehicle' : 'Mast'})
                    </span>
                </label>
                <input 
                    id="rx-height"
                    name="rx-height"
                    type="range" 
                    min="1" max="30" steps="1"
                    value={rxHeight} 
                    onChange={(e) => setRxHeight(Number(e.target.value))}
                    style={{width: '100%', cursor: 'pointer', accentColor: 'var(--color-secondary)'}} 
                />
            </div>
        )}

        {/* CABLE CONFIGURATION */}
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)'}}>
            <div>
                <label style={labelStyle} htmlFor="cable-type">Cable Type</label>
                <select 
                    id="cable-type"
                    name="cable-type"
                    style={selectStyle}
                    value={selectedCableType}
                    onChange={(e) => setSelectedCableType(e.target.value)}
                >
                    {Object.values(CABLE_TYPES).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>
            <div>
                <label style={labelStyle} htmlFor="cable-length">Length ({units === 'imperial' ? 'ft' : 'm'})</label>
                <input 
                    id="cable-length"
                    name="cable-length"
                    type="number" 
                    min="0" step="0.5"
                    style={inputStyle} 
                    value={units === 'imperial' ? (cableLength * 3.28084).toFixed(1) : cableLength} 
                    onChange={(e) => {
                        const val = Number(e.target.value);
                        // Store in meters always
                        setCableLength(units === 'imperial' ? val / 3.28084 : val);
                    }}
                />
            </div>
        </div>





        <label style={labelStyle} htmlFor="tx-power">
            TX Power (dBm): {txPower} 
            <span style={{color: 'var(--color-secondary)', marginLeft: '8px'}}>
                (Max: {DEVICE_PRESETS[selectedDevice].tx_power_max})
            </span>
        </label>
        <input 
            id="tx-power"
            name="tx-power"
            type="range" 
            min="0" 
            max={DEVICE_PRESETS[selectedDevice].tx_power_max} 
            value={txPower} 
            onChange={handleTxPowerChange}
            style={{width: '100%', cursor: 'pointer', accentColor: 'var(--color-primary)'}}
        />

        {/* Manual Recalculation Trigger */}
        <button
            onClick={triggerRecalc}
            style={{
                width: '100%',
                marginTop: '12px',
                padding: '8px',
                background: 'rgba(0, 255, 65, 0.1)',
                border: '1px solid var(--color-primary)',
                color: 'var(--color-primary)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: '0.9em',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(0, 255, 65, 0.2)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(0, 255, 65, 0.1)'}
        >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
             Update Calculation
        </button>

        {/* ERP CALCULATION DISPLAY */}
        <div style={{
            marginTop: 'var(--spacing-md)', 
            marginBottom: '12px', // Added spacing below
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

            {/* DOCUMENTATION LINK - Integrated into Hardware Summary */}
            <a 
                href="https://github.com/d3mocide/MeshRF/tree/main/Documentation" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    background: 'rgba(0, 242, 255, 0.05)',
                    border: '1px solid rgba(0, 242, 255, 0.2)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px',
                    color: 'var(--color-primary)',
                    textDecoration: 'none',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    transition: 'all 0.2s ease',
                    marginTop: '12px'
                }}
                onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 242, 255, 0.1)';
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 242, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(0, 242, 255, 0.2)';
                }}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                View Documentation
            </a>

        </div>
        </div>
      </CollapsibleSection>


      {/* ENVIRONMENT SETTINGS */}
      <CollapsibleSection 
          title="Environment" 
          isOpen={sections.environment} 
          onToggle={() => toggleSection('environment')}
          isITM={true}
      >
        <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
             <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px'}}>
                 <div>
                     <label style={{fontSize: '0.75em', color: '#888', display: 'block', marginBottom: '4px'}} htmlFor="k-factor">
                         Refraction (K)
                     </label>
                     <input 
                        type="number" 
                        step="0.01"
                        id="k-factor"
                        name="k-factor"
                        value={kFactor}
                        onChange={(e) => setKFactor(parseFloat(e.target.value))}
                        style={{...inputStyle, padding: '6px', fontSize: '0.9em'}}
                     />
                 </div>
                 <div>
                     <label style={{fontSize: '0.75em', color: '#888', display: 'block', marginBottom: '4px'}} htmlFor="clutter-height">
                         Clutter (m)
                     </label>
                     <input 
                        type="number" 
                        step="1"
                        id="clutter-height"
                        name="clutter-height"
                        value={clutterHeight}
                        onChange={(e) => setClutterHeight(parseFloat(e.target.value))}
                        style={{...inputStyle, padding: '6px', fontSize: '0.9em'}}
                     />
                 </div>
             </div>
             
             {/* Ground Type */}
             <div>
                <label style={{fontSize: '0.75em', color: '#888', display: 'block', marginBottom: '4px'}}>Ground Type</label>
                <select
                    value={groundType}
                    onChange={(e) => setGroundType(e.target.value)}
                    style={{...selectStyle, padding: '6px', fontSize: '0.9em', width: '100%'}}
                >
                    {Object.keys(GROUND_TYPES).map(type => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                </select>
             </div>

             {/* Climate Zone */}
             <div>
                <label style={{fontSize: '0.75em', color: '#888', display: 'block', marginBottom: '4px'}}>Climate Zone</label>
                <select
                    value={climate}
                    onChange={(e) => setClimate(Number(e.target.value))}
                    style={{...selectStyle, padding: '6px', fontSize: '0.9em', width: '100%'}}
                >
                    {Object.entries(CLIMATE_ZONES).map(([id, name]) => (
                        <option key={id} value={id}>{id} - {name}</option>
                    ))}
                </select>
             </div>

             {/* Fade Margin */}
             <div>
                 <label style={{fontSize: '0.75em', color: '#888', display: 'block', marginBottom: '4px'}} htmlFor="fade-margin">
                     Fade Margin (dB)
                 </label>
                 <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                     <input 
                        type="range" 
                        min="0" max="20" step="1"
                        id="fade-margin"
                        name="fade-margin"
                        value={fadeMargin}
                        onChange={(e) => setFadeMargin(Number(e.target.value))}
                        style={{flexGrow: 1, accentColor: 'var(--color-primary)', cursor: 'pointer'}}
                     />
                     <span style={{fontSize: '0.9em', color: '#fff', width: '24px', textAlign: 'right', fontWeight: 'bold'}}>{fadeMargin}</span>
                 </div>
             </div>
        </div>
      </CollapsibleSection>

      {/* LORA BAND SETTINGS */}
      <CollapsibleSection 
          title="LoRa Band" 
          isOpen={sections.radio} 
          onToggle={() => toggleSection('radio')}
          alwaysVisible={
            <div>
                <label style={labelStyle} htmlFor="radio-preset">Radio Preset</label>
                <select 
                    id="radio-preset"
                    name="radio-preset"
                    style={selectStyle}
                    value={selectedRadioPreset}
                    onChange={(e) => setSelectedRadioPreset(e.target.value)}
                >
                    {Object.values(RADIO_PRESETS).map(preset => (
                        <option key={preset.id} value={preset.id}>{preset.name}</option>
                    ))}
                </select>
            </div>
          }
      >

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)'}}>
            <div>
                <label style={labelStyle} htmlFor="radio-freq">Freq (MHz)</label>
                <input 
                    id="radio-freq"
                    name="radio-freq"
                    type="number" 
                    style={inputStyle} 
                    value={freq} 
                    disabled={!isCustom}
                    onChange={(e) => isCustom && setFreq(e.target.value)}
                />
            </div>
             <div>
                <label style={labelStyle} htmlFor="radio-bw">BW (kHz)</label>
                <input 
                    id="radio-bw"
                    name="radio-bw"
                    type="number" 
                    style={inputStyle} 
                    value={bw} 
                    disabled={!isCustom}
                    onChange={(e) => isCustom && setBw(e.target.value)}
                />
            </div>
             <div>
                <label style={labelStyle} htmlFor="radio-sf">SF</label>
                <input 
                    id="radio-sf"
                    name="radio-sf"
                    type="number" 
                    style={inputStyle} 
                    value={sf} 
                    disabled={!isCustom}
                    onChange={(e) => isCustom && setSf(e.target.value)}
                />
            </div>
             <div>
                <label style={labelStyle} htmlFor="radio-cr">CR</label>
                <input 
                    id="radio-cr"
                    name="radio-cr"
                    type="number" 
                    style={inputStyle} 
                    value={cr} 
                    disabled={!isCustom}
                    onChange={(e) => isCustom && setCr(e.target.value)}
                />
            </div>
        </div>



        {/* RX Height Slider - Only for RF Coverage Tool */}



      </CollapsibleSection>



      {/* BATCH PROCESSING */}
      {/* BATCH PROCESSING */}
      <div style={{
          marginTop: '0', 
          paddingTop: 'var(--spacing-md)', 
          borderTop: '0px solid var(--color-border)'
      }}>
        <BatchProcessing />
      </div>

        {/* SETTINGS (Collapsible) */}
        <div style={{
            marginBottom: 'var(--spacing-lg)'
        }}>
             <h3 
                style={{
                    fontSize: '1rem', 
                    color: '#fff', 
                    margin: '0 0 var(--spacing-sm) 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none'
                }}
             >
                Settings
             </h3>
             
             <div style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
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
             
             
             {/* Map Theme Selector */}


            {/* Map Theme Selector */}
             <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', marginTop: '12px'}}>
                 <label style={{color: '#aaa', fontSize: '0.9em'}} htmlFor="map-style">Map Style</label>
                 <select 
                    id="map-style"
                    name="map-style"
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
                     <option value="dark_green">Dark (Parks/Forests)</option>
                     <option value="light">Light Mode</option>
                     <option value="topo">Topography</option>
                     <option value="topo_dark">Dark Topography</option>
                     <option value="satellite">Satellite</option>
                 </select>
             </div>
             </div>
        </div>

             {/* Footer */}
             <div style={{marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #333', textAlign: 'center'}}>
                 <a 
                    href="https://github.com/d3mocide/MeshRF/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{color: '#666', fontSize: '0.75em', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'}}
                 >
                    <svg height="16" viewBox="0 0 16 16" width="16" style={{fill: '#666'}}>
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                    </svg>
                    d3mocide/MeshRF
                 </a>
             </div>


    </aside>
    
    </>
  );
};

export default Sidebar;
