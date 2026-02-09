import React, { createContext, useState, useContext, useEffect } from "react";
import {
  RADIO_PRESETS,
  DEVICE_PRESETS,
  ANTENNA_PRESETS,
  CABLE_TYPES,
} from "../data/presets";
import { calculateLoRaSensitivity } from "../utils/rfMath";

// ITM Environment Constants
export const GROUND_TYPES = {
  "Average Ground": { epsilon: 15.0, sigma: 0.005 },
  "Poor Ground": { epsilon: 4.0, sigma: 0.001 },
  "Good Ground": { epsilon: 25.0, sigma: 0.02 },
  "Fresh Water": { epsilon: 81.0, sigma: 0.01 },
  "Sea Water": { epsilon: 81.0, sigma: 5.0 },
  "City / Industrial": { epsilon: 5.0, sigma: 0.001 },
  Farmland: { epsilon: 15.0, sigma: 0.01 },
};

export const CLIMATE_ZONES = {
  1: "Equatorial",
  2: "Continental Subtropical",
  3: "Maritime Subtropical",
  4: "Desert",
  5: "Continental Temperate",
  6: "Maritime Temperate Over Land",
  7: "Maritime Temperate Over Sea",
};

const RFContext = createContext();

export const useRF = () => {
  return useContext(RFContext);
};

export const RFProvider = ({ children }) => {
  // --- NODE-SPECIFIC CONFIGURATION ---
  // GLOBAL: Edit defaults (applies to both if they haven't been overridden? Or just applies to both for now)
  // A/B: Edit specific node
  const [editMode, setEditMode] = useState("GLOBAL"); // 'GLOBAL', 'A', 'B'
  const [toolMode, setToolMode] = useState("link"); // 'link', 'optimize', 'viewshed', 'rf_coverage', 'none'
  const [sidebarIsOpen, setSidebarIsOpen] = useState(window.innerWidth > 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const DEFAULT_CONFIG = {
    device: "HELTEC_V3",
    antenna: "DIPOLE",
    txPower: 20,
    antennaHeight: 5,
    antennaGain: ANTENNA_PRESETS.DIPOLE.gain,
    cableType: "LMR400",
    cableLength: 0.3048, // 1 ft in meters
  };

  const [nodeConfigs, setNodeConfigs] = useState({
    A: { ...DEFAULT_CONFIG },
    B: { ...DEFAULT_CONFIG },
  });

  // Helper to update state based on current mode
  const updateConfig = (key, value) => {
    setNodeConfigs((prev) => {
      const newConfigs = { ...prev };
      if (editMode === "GLOBAL") {
        // Global updates both nodes
        newConfigs.A[key] = value;
        newConfigs.B[key] = value;
      } else {
        newConfigs[editMode][key] = value;
      }
      return newConfigs;
    });
  };

  // Get current values based on mode
  // If Global, we show A's values as representative (or defaults if we tracked them separately)
  const currentConfig =
    editMode === "GLOBAL" ? nodeConfigs.A : nodeConfigs[editMode];

  // Proxies for compatibility with existing components
  const selectedDevice = currentConfig.device;
  const setSelectedDevice = (val) => updateConfig("device", val);

  const selectedAntenna = currentConfig.antenna;
  const setSelectedAntenna = (val) => updateConfig("antenna", val);

  const txPower = currentConfig.txPower;
  const setTxPower = (val) => updateConfig("txPower", val);

  const antennaHeight = currentConfig.antennaHeight;
  const setAntennaHeight = (val) => updateConfig("antennaHeight", val);

  const antennaGain = currentConfig.antennaGain;
  const setAntennaGain = (val) => updateConfig("antennaGain", val);

  const selectedCableType = currentConfig.cableType || "LMR400";
  const setSelectedCableType = (val) => updateConfig("cableType", val);

  const cableLength =
    currentConfig.cableLength !== undefined ? currentConfig.cableLength : 1;
  const setCableLength = (val) => updateConfig("cableLength", val);

  // --- END NODE SPECIFIC ---

  // Batch Processing
  const [batchNodes, setBatchNodes] = useState([]); // Array of {id, name, lat, lng}
  const [showBatchPanel, setShowBatchPanel] = useState(false);

  // Helper for Environment Variables (Runtime or Build-time)
  const getEnv = (key, fallback) => {
    // 1. Runtime Injection (Docker)
    if (window._env_ && window._env_[key]) return window._env_[key];
    // 2. Build-time Injection (Vite)
    if (import.meta.env[`VITE_${key}`]) return import.meta.env[`VITE_${key}`];
    // 3. Fallback
    return fallback;
  };

  // Preferences
  const [units, setUnits] = useState(getEnv("DEFAULT_UNITS", "imperial"));
  const [mapStyle, setMapStyle] = useState(
    getEnv("DEFAULT_MAP_STYLE", "dark_green"),
  );

  // Environmental
  const [kFactor, setKFactor] = useState(1.33); // Standard Refraction
  const [clutterHeight, setClutterHeight] = useState(0); // Forest/Urban Obstruction (m)
  const [rxHeight, setRxHeight] = useState(2.0); // Receiver Height (m), default 2m (Handheld)
  const [fadeMargin, setFadeMargin] = useState(10); // Fade Margin (dB), default 10dB

  // Signals
  const [recalcTimestamp, setRecalcTimestamp] = useState(0);

  // ITM Environment State
  const [groundType, setGroundType] = useState("Average Ground");
  const [climate, setClimate] = useState(5); // Continental Temperate
  const triggerRecalc = () => setRecalcTimestamp(Date.now());

  // Radio Params (SHARED LINK PARAMETERS)
  const [selectedRadioPreset, setSelectedRadioPreset] =
    useState("MESHCORE_PNW");
  const [freq, setFreq] = useState(RADIO_PRESETS.MESHCORE_PNW.freq);
  const [bw, setBw] = useState(RADIO_PRESETS.MESHCORE_PNW.bw);
  const [sf, setSf] = useState(RADIO_PRESETS.MESHCORE_PNW.sf);
  const [cr, setCr] = useState(RADIO_PRESETS.MESHCORE_PNW.cr);

  // 1. Radio Preset Sync
  useEffect(() => {
    const preset = RADIO_PRESETS[selectedRadioPreset];
    if (selectedRadioPreset !== "CUSTOM") {
      setFreq(preset.freq);
      setBw(preset.bw);
      setSf(preset.sf);
      setCr(preset.cr);
      if (preset.power) {
        updateConfig("txPower", preset.power);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRadioPreset]);

  // 2. Device Cap Sync
  useEffect(() => {
    setNodeConfigs((prev) => {
      const next = { ...prev };
      ["A", "B"].forEach((node) => {
        const deviceMax = DEVICE_PRESETS[next[node].device].tx_power_max;
        if (next[node].txPower > deviceMax) {
          next[node].txPower = deviceMax;
        }
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeConfigs.A.device, nodeConfigs.B.device]); // Dependency on devices

  // 3. Antenna preset sync
  useEffect(() => {
    setNodeConfigs((prev) => {
      const next = { ...prev };
      let changed = false;

      ["A", "B"].forEach((node) => {
        const type = next[node].antenna;
        const currentGain = next[node].antennaGain;
        if (type !== "CUSTOM") {
          const correctGain = ANTENNA_PRESETS[type].gain;
          if (currentGain !== correctGain) {
            next[node].antennaGain = correctGain;
            changed = true;
          }
        }
      });

      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeConfigs.A.antenna, nodeConfigs.B.antenna]);

  // Derived Values (Active Context)
  const deviceLoss = DEVICE_PRESETS[selectedDevice].loss || 0;
  const cableConfig = CABLE_TYPES[selectedCableType] || CABLE_TYPES.LMR400;
  const cableLossVal =
    deviceLoss + cableConfig.loss_per_meter * (parseFloat(cableLength) || 0);
  const cableLoss = parseFloat(cableLossVal.toFixed(2));
  const erp = (txPower + antennaGain - cableLoss).toFixed(1);

  const value = {
    // Mode State
    editMode,
    setEditMode,
    toolMode,
    setToolMode,
    nodeConfigs,

    // Proxied Accessors (UI Compatibility)
    selectedRadioPreset,
    setSelectedRadioPreset,
    selectedDevice,
    setSelectedDevice,
    selectedAntenna,
    setSelectedAntenna,
    txPower,
    setTxPower,
    antennaHeight,
    setAntennaHeight,
    antennaGain,
    setAntennaGain,
    selectedCableType,
    setSelectedCableType,
    cableLength,
    setCableLength,

    // Shared Params
    freq,
    setFreq,
    bw,
    setBw,
    sf,
    setSf,
    cr,
    setCr,

    // ITM Environment
    groundType,
    setGroundType,
    climate,
    setClimate,

    // Derived & Globals
    erp,
    cableLoss,
    units,
    setUnits,
    mapStyle,
    setMapStyle,
    kFactor,
    setKFactor,
    clutterHeight,
    setClutterHeight,
    rxHeight,
    setRxHeight,
    fadeMargin,
    setFadeMargin,

    // Batch
    batchNodes,
    setBatchNodes,
    showBatchPanel,
    setShowBatchPanel,

    // UI State
    sidebarIsOpen,
    setSidebarIsOpen,
    isMobile,

    recalcTimestamp,
    triggerRecalc,

    // Helpers
    getAntennaHeightMeters: () => {
      return parseFloat(antennaHeight) || 0; // State is always in Meters
    },
    calculateSensitivity: () => {
      return calculateLoRaSensitivity(sf, bw);
    },
  };

  return <RFContext.Provider value={value}>{children}</RFContext.Provider>;
};
