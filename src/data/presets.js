export const RADIO_PRESETS = {
  MESHCORE_PNW: {
    id: 'MESHCORE_PNW',
    name: 'MeshCore PNW (Fast)',
    freq: 910.525, // MHz (Base freq)
    bw: 62.5,      // kHz
    sf: 7,
    cr: 5,
    power: 22      // dBm default
  },
  MESHCORE_US: {
    id: 'MESHCORE_US',
    name: 'MeshCore US (Standard)',
    freq: 915.0,   // MHz
    bw: 250.0,     // kHz
    sf: 11,
    cr: 5,
    power: 22
  },
  CUSTOM: {
    id: 'CUSTOM',
    name: 'Custom User Settings',
    freq: 915.0,
    bw: 125.0,
    sf: 9,
    cr: 5,
    power: 20
  }
};

export const DEVICE_PRESETS = {
  HELTEC_V3: {
    id: 'HELTEC_V3',
    name: 'Heltec V3',
    tx_power_max: 22,
    loss: 1.5 // dB loss from connector/cabling
  },
  HELTEC_V4: {
    id: 'HELTEC_V4',
    name: 'Heltec V4 (High Power)',
    tx_power_max: 28, // High power version covers up to 28dBm
    loss: 1.5
  },
  SEEED_XIAO: {
    id: 'SEEED_XIAO',
    name: 'Seeed Studio Xiao (SX1262)',
    tx_power_max: 22,
    loss: 2
  },
  T_DECK: {
    id: 'T_DECK',
    name: 'Lilygo T-Deck',
    tx_power_max: 22,
    loss: 2
  },
  RAK_4631: {
    id: 'RAK_4631',
    name: 'RAK WisBlock 4631',
    tx_power_max: 22,
    loss: 0.5
  },
  STATION_G2: {
    id: 'STATION_G2',
    name: 'Station G2',
    tx_power_max: 37, // Up to 5W (37dBm)
    loss: 0.5
  },
  CUSTOM: {
    id: 'CUSTOM',
    name: 'Custom Device',
    tx_power_max: 37,
    loss: 0
  }
};

export const ANTENNA_PRESETS = {
  STUBBY: {
    id: 'STUBBY',
    name: 'Stock / Stubby',
    gain: 2.15, // dBi
    type: 'omni'
  },
  DIPOLE: {
    id: 'DIPOLE',
    name: 'Standard Dipole',
    gain: 3.0,
    type: 'omni'
  },
  OMNI_MEDIUM: {
    id: 'OMNI_MEDIUM',
    name: 'Fiberglass Omni (Medium)',
    gain: 5.8,
    type: 'omni'
  },
  OMNI_HIGH: {
    id: 'OMNI_HIGH',
    name: 'Fiberglass Omni (High)',
    gain: 8.0,
    type: 'omni'
  },
  YAGI: {
    id: 'YAGI',
    name: 'Yagi (Directional)',
    gain: 11.0,
    type: 'directional'
  },
  CUSTOM: {
    id: 'CUSTOM',
    name: 'Custom Antenna',
    gain: 0,
    type: 'omni'
  }
};

export const CABLE_TYPES = {
  LMR400: { id: 'LMR400', name: 'LMR-400', loss_per_meter: 0.128 }, 
  RG58:   { id: 'RG58',   name: 'RG-58',   loss_per_meter: 0.500 },  
  RG8X:   { id: 'RG8X',   name: 'RG-8X',   loss_per_meter: 0.262 }, 
  LMR240: { id: 'LMR240', name: 'LMR-240', loss_per_meter: 0.249 }, 
  HELIAX: { id: 'HELIAX', name: '1/2" Heliax', loss_per_meter: 0.038 }, 
  NONE:   { id: 'NONE',   name: 'None / Direct', loss_per_meter: 0 }
};
