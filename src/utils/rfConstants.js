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

  // LoRa / Hardware Constants
  LORA: {
    BASE_SENSITIVITY_SF7_125KHZ: -123, // dBm
    SF_GAIN_PER_STEP: 2.5, // dB
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
