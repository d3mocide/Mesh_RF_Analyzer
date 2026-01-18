import React, { createContext, useState, useContext, useEffect } from 'react';
import { RADIO_PRESETS, DEVICE_PRESETS, ANTENNA_PRESETS } from '../data/presets';

const RFContext = createContext();

export const useRF = () => {
    return useContext(RFContext);
};

export const RFProvider = ({ children }) => {
    // Selections
    const [selectedRadioPreset, setSelectedRadioPreset] = useState('MESHCORE_PNW');
    const [selectedDevice, setSelectedDevice] = useState('HELTEC_V3');
    const [selectedAntenna, setSelectedAntenna] = useState('STUBBY');
    
    // Batch Processing
    const [batchNodes, setBatchNodes] = useState([]); // Array of {id, name, lat, lng}
    const [showBatchPanel, setShowBatchPanel] = useState(false);

    // Config Values
    const [txPower, setTxPower] = useState(20);
    const [antennaHeight, setAntennaHeight] = useState(5); // always stored in meters
    const [antennaGain, setAntennaGain] = useState(ANTENNA_PRESETS.STUBBY.gain);
    
    // Preferences
    const [units, setUnits] = useState('imperial'); // 'metric' or 'imperial'
    const [mapStyle, setMapStyle] = useState('dark'); // 'dark', 'light', 'topo', 'satellite'
    
    // Environmental
    const [kFactor, setKFactor] = useState(1.33); // Standard Refraction
    const [clutterHeight, setClutterHeight] = useState(0); // Forest/Urban Obstruction (m)
    
    // Signals
    const [recalcTimestamp, setRecalcTimestamp] = useState(0);
    const triggerRecalc = () => setRecalcTimestamp(Date.now());
    
    // Radio Params
    const [freq, setFreq] = useState(RADIO_PRESETS.MESHCORE_PNW.freq);
    const [bw, setBw] = useState(RADIO_PRESETS.MESHCORE_PNW.bw);
    const [sf, setSf] = useState(RADIO_PRESETS.MESHCORE_PNW.sf);
    const [cr, setCr] = useState(RADIO_PRESETS.MESHCORE_PNW.cr);

    // Sync Logic (Migrated from Sidebar)
    
    // 1. Radio Preset Sync
    useEffect(() => {
        const preset = RADIO_PRESETS[selectedRadioPreset];
        if (selectedRadioPreset !== 'CUSTOM') {
            setFreq(preset.freq);
            setBw(preset.bw);
            setSf(preset.sf);
            setCr(preset.cr);
            if(preset.power) {
                const deviceMax = DEVICE_PRESETS[selectedDevice].tx_power_max;
                setTxPower(Math.min(preset.power, deviceMax));
            }
        }
    }, [selectedRadioPreset]); // Intentionally removed selectedDevice to prevent loop, handled below

    // 2. Device Cap Sync
    useEffect(() => {
        const deviceMax = DEVICE_PRESETS[selectedDevice].tx_power_max;
        if (txPower > deviceMax) {
            setTxPower(deviceMax);
        }
    }, [selectedDevice]);

    // 3. Antenna preset sync
    useEffect(() => {
        const antenna = ANTENNA_PRESETS[selectedAntenna];
        if (selectedAntenna !== 'CUSTOM') {
            setAntennaGain(antenna.gain);
        }
    }, [selectedAntenna]);

    // Derived Values
    const cableLoss = DEVICE_PRESETS[selectedDevice].loss || 0;
    const erp = (txPower + antennaGain - cableLoss).toFixed(1);

    const value = {
        selectedRadioPreset, setSelectedRadioPreset,
        selectedDevice, setSelectedDevice,
        selectedAntenna, setSelectedAntenna,
        batchNodes, setBatchNodes,
        txPower, setTxPower,
        antennaHeight, setAntennaHeight,
        antennaGain, setAntennaGain,
        freq, setFreq,
        bw, setBw,
        sf, setSf,

        cr, setCr,
        erp, cableLoss,
        units, setUnits,
        mapStyle, setMapStyle,
        kFactor, setKFactor,
        clutterHeight, setClutterHeight,
        showBatchPanel, setShowBatchPanel,
        setBatchNodes,
        recalcTimestamp, triggerRecalc
    };

    return (
        <RFContext.Provider value={value}>
            {children}
        </RFContext.Provider>
    );
};
