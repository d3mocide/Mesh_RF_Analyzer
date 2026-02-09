/**
 * RF Constants and Thresholds for MeshRF
 */
export const RF_CONSTANTS = {
  // Geodetic Constants
  EARTH_RADIUS_KM: 6371,
  K_FACTOR_DEFAULT: 1.33,

  // Fresnel Zone Constants
  FRESNEL: {
    CONST_METERS: 17.32, // Based on sqrt(c/1e9) approx for GHz
    QUALITY: {
      EXCELLENT: 0.8,
      GOOD: 0.6,
      MARGINAL: 0.0,
    }
  },

  // Propagation Model Constants (Okumura-Hata)
  HATA: {
    URBAN_BASE: 69.55,
    FREQ_SCALE: 26.16,
    HB_SCALE: 13.82,
    DISTANCE_BASE: 44.9,
    DISTANCE_HB_SCALE: 6.55,
    
    LIMITS: {
      MIN_DIST_KM: 0.1,
      MIN_HEIGHT: 1.0,
    }
  },

  // LoRa / Hardware Constants (Semtech SX1262 datasheet, power-saving RX mode)
  LORA: {
    // Per-SF sensitivity at 125kHz BW (dBm) - SX1262 datasheet Table 3-2
    SENSITIVITY_125KHZ: {
      7: -124,
      8: -127,
      9: -130,
      10: -133,
      11: -135.5,
      12: -137,
    },
    THERMAL_NOISE_DENSITY: -174, // dBm/Hz
    REF_BW_KHZ: 125,
    REF_SF: 7,
  },

  // Signal Quality Thresholds (SNR in dB)
  SNR_QUALITY: {
    EXCELLENT: 10,
    GREAT: 5,
    GOOD: 0,
    FAIR: -7,
    POOR: -15,
  },

  // Visualization
  MAP: {
    RSSI_ENCODING: {
      OFFSET: 150,
      SCALE: 200,
    }
  }
};
