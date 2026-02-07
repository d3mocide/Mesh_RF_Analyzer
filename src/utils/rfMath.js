import * as turf from "@turf/turf";
import { RF_CONSTANTS } from "./rfConstants";

/**
 * Calculate Free Space Path Loss (FSPL) in dB
 * @param {number} distanceKm - Distance in Kilometers
 * @param {number} freqMHz - Frequency in MHz
 * @returns {number} Path Loss in dB
 */
export const calculateFSPL = (distanceKm, freqMHz) => {
  if (distanceKm <= 0) return 0;
  // FSPL(dB) = 20log10(d) + 20log10(f) + 32.44
  return 20 * Math.log10(distanceKm) + 20 * Math.log10(freqMHz) + 32.44;
};

/**
 * Calculate the radius of the nth Fresnel Zone
 * @param {number} distanceKm - Total link distance in Kilometers
 * @param {number} freqMHz - Frequency in MHz
 * @param {number} pointDistKm - Distance from one end to the point of interest (default: midpoint)
 * @returns {number} Radius in meters
 */
export const calculateFresnelRadius = (
  distanceKm,
  freqMHz,
  pointDistKm = null,
) => {
  if (!pointDistKm) pointDistKm = distanceKm / 2;
  const d1 = pointDistKm;
  const d2 = distanceKm - pointDistKm;
  const fGHz = freqMHz / 1000;

  // r = 17.32 * sqrt((d1 * d2) / (f * D))
  // d1, d2, D in km, f in GHz, r in meters
  return RF_CONSTANTS.FRESNEL.CONST_METERS * Math.sqrt((d1 * d2) / (fGHz * distanceKm));
};

/**
 * Calculate Link Budget
 * @param {Object} params
 * @param {number} params.txPower - TX Power in dBm
 * @param {number} params.txGain - TX Antenna Gain in dBi
 * @param {number} params.txLoss - TX Cable Loss in dB
 * @param {number} params.rxGain - RX Antenna Gain in dBi (Assuming symmetric for now or user defined)
 * @param {number} params.rxLoss - RX Cable Loss in dB
 * @param {number} params.distanceKm - Distance in Km
 * @param {number} params.freqMHz - Frequency in MHz
 * @param {number} params.sf - Spreading Factor (for sensitivity)
 * @param {number} params.bw - Bandwidth in kHz (for sensitivity)
 * @param {number} [params.pathLossOverride=null] - Optional override for path loss in dB. If provided, FSPL is not calculated.
 * @returns {Object} { rssi, fspl, snrLimit, linkMargin }
 */
export const calculateLinkBudget = ({
  txPower,
  txGain,
  txLoss,
  rxGain,
  rxLoss,
  distanceKm,
  freqMHz,
  sf,
  bw,

  pathLossOverride = null,
  excessLoss = 0,
  fadeMargin = 10,
}) => {
  const fspl = pathLossOverride !== null ? pathLossOverride : calculateFSPL(distanceKm, freqMHz);

  // Estimated RSSI at receiver
  // RSSI = Ptx + Gtx - Ltx - PathLoss - ExcessLoss - FadeMargin + Grx - Lrx
  const rssi = txPower + txGain - txLoss - fspl - excessLoss - fadeMargin + rxGain - rxLoss;

  // Receiver Sensitivity Calculation (Semtech SX1262 approx)
  // S = -174 + 10log10(BW) + NF + SNR_limit
  // Standard LoRa sensitivity approximation:
  // SF7/125kHz ~ -123dBm
  // Rule of thumb: Higher SF = Lower (better) sensitivity. Double BW = 3dB worse.

  // Base sensitivity for SF7, 125kHz
  let baseSensitivity = RF_CONSTANTS.LORA.BASE_SENSITIVITY_SF7_125KHZ;

  // Adjust for Bandwidth: 10 * log10(BW_meas / BW_ref)
  // If BW goes 125 -> 250, noise floor rises by 3dB, sensitivity worsens by 3dB
  const bwFactor = 10 * Math.log10(bw / RF_CONSTANTS.LORA.REF_BW_KHZ);

  // Adjust for Spreading Factor: Each step adds ~2.5dB of process gain
  // SF7 is base. SF12 is 5 steps higher.
  const sfFactor = (sf - RF_CONSTANTS.LORA.REF_SF) * -RF_CONSTANTS.LORA.SF_GAIN_PER_STEP;

  const sensitiveLimit = baseSensitivity + bwFactor + sfFactor;

  const linkMargin = rssi - sensitiveLimit;

  return {
    rssi: parseFloat(rssi.toFixed(2)),
    fspl: parseFloat(fspl.toFixed(2)),
    sensitivity: parseFloat(sensitiveLimit.toFixed(2)),
    margin: parseFloat(linkMargin.toFixed(2)),
  };
};

/**
 * Calculate Fresnel Zone Polygon coordinates
 * @param {Object} p1 - Start {lat, lng}
 * @param {Object} p2 - End {lat, lng}
 * @param {number} freqMHz - Frequency
 * @param {number} steps - Number of steps for the polygon
 * @returns {Array} List of [lat, lng] arrays for Leaflet Polygon
 */
export const calculateFresnelPolygon = (p1, p2, freqMHz, steps = 30) => {
  const startPt = turf.point([p1.lng, p1.lat]);
  const endPt = turf.point([p2.lng, p2.lat]);
  const totalDistance = turf.distance(startPt, endPt, { units: "kilometers" });
  const bearing = turf.bearing(startPt, endPt);

  // Left and Right boundaries
  const leftSide = [];
  const rightSide = [];

  for (let i = 0; i <= steps; i++) {
    const fraction = i / steps;
    const dist = totalDistance * fraction; // Current distance along path

    // Calculate Fresnel Radius at this point
    // totalDistance must be in Km for Fresnel calc
    // dist is distance from source
    // Fresnel Radius calc expects total distance and distance from source

    // Warning: calculateFresnelRadius returns METERS
    const rMeters = calculateFresnelRadius(totalDistance, freqMHz, dist);
    const rKm = rMeters / 1000;

    // Find point on the line
    const pointOnLine = turf.destination(startPt, dist, bearing, {
      units: "kilometers",
    });

    // Perpendicular points
    // Bearing - 90 is Left, Bearing + 90 is Right
    const leftPt = turf.destination(pointOnLine, rKm, bearing - 90, {
      units: "kilometers",
    });
    const rightPt = turf.destination(pointOnLine, rKm, bearing + 90, {
      units: "kilometers",
    });

    // Leaflet wants [lat, lng]
    leftSide.push(leftPt.geometry.coordinates.reverse());
    // We unshift rightSide to keep polygon drawing order correct (CCW)
    rightSide.unshift(rightPt.geometry.coordinates.reverse());
  }

  return [...leftSide, ...rightSide];
};

/**
 * Calculate Earth Bulge at a specific point
 * @param {number} distKm - Distance from start point (km)
 * @param {number} totalDistKm - Total link distance (km)
 * @param {number} kFactor - Standard Refraction Factor (default 1.33)
 * @returns {number} Bulge height in meters
 */
export const calculateEarthBulge = (distKm, totalDistKm, kFactor = RF_CONSTANTS.K_FACTOR_DEFAULT) => {
  // Earth Radius (km)
  const R = RF_CONSTANTS.EARTH_RADIUS_KM;
  const Re = R * kFactor; // Effective Radius

  // Distance to second point
  const d1 = distKm;
  const d2 = totalDistKm - distKm;

  // h = (d1 * d2) / (2 * Re)
  // Result in km, convert to meters
  const hKm = (d1 * d2) / (2 * Re);
  return hKm * 1000;
};

/**
 * Analyze Link Profile for Obstructions (Geodetic + Clutter + Fresnel Standards)
 * @param {Array} profile - Array of {distance, elevation} points (distance in km, elevation in m)
 * @param {number} freqMHz - Frequency
 * @param {number} txHeightAGL - TX Antenna Height (m)
 * @param {number} rxHeightAGL - RX Antenna Height (m)
 * @param {number} kFactor - Atmospheric Refraction (default 1.33)
 * @param {number} clutterHeight - Uniform Clutter Height (e.g., Trees/Urban) default 0
 * @returns {Object} { minClearance, isObstructed, linkQuality, profileWithStats }
 */
export const analyzeLinkProfile = (
  profile,
  freqMHz,
  txHeightAGL,
  rxHeightAGL,
  kFactor = RF_CONSTANTS.K_FACTOR_DEFAULT,
  clutterHeight = 0,
) => {
  if (!profile || profile.length === 0)
    return { isObstructed: false, minClearance: 999 };

  const startPt = profile[0];
  const endPt = profile[profile.length - 1];
  const totalDistKm = endPt.distance;

  const txH = startPt.elevation + txHeightAGL;
  const rxH = endPt.elevation + rxHeightAGL;

  let minClearance = 9999;
  let isObstructed = false;
  let worstFresnelRatio = 1.0; // 1.0 = Fully Clear. < 0.6 = Bad.

  const profileWithStats = profile.map((pt) => {
    const d = pt.distance; // km

    // 1. Calculate Earth Bulge
    const bulge = calculateEarthBulge(d, totalDistKm, kFactor);

    // 2. Effective Terrain Height (Terrain + Bulge + Clutter)
    const effectiveTerrain = pt.elevation + bulge + clutterHeight;

    // 3. LOS Height at this distance
    const ratio = d / totalDistKm;
    const losHeight = txH + (rxH - txH) * ratio;

    // 4. Fresnel Radius (m)
    const f1 = calculateFresnelRadius(totalDistKm, freqMHz, d);

    // 5. Clearance (m) relative to F1 bottom
    // Positive = Clear of F1. Negative = Inside F1 or Obstructed.
    const distFromCenter = losHeight - effectiveTerrain;
    const clearance = distFromCenter - f1;

    // Ratio of Clearance / F1 Radius (for quality check)
    // 60% rule means distFromCenter >= 0.6 * F1
    const fRatio = f1 > 0 ? distFromCenter / f1 : 1;

    if (fRatio < worstFresnelRatio) worstFresnelRatio = fRatio;
    if (clearance < minClearance) minClearance = clearance;

    // Obstructed logic
    if (distFromCenter <= 0) isObstructed = true;

    return {
      ...pt,
      earthBulge: bulge,
      effectiveTerrain,
      losHeight,
      f1Radius: f1,
      clearance,
      fresnelRatio: fRatio,
    };
  });

  // Determine Link Quality String
  // Excellent (>0.8), Good (>0.6), Marginal (>0), Obstructed (<=0)

  let linkQuality = "Obstructed";
  if (worstFresnelRatio >= RF_CONSTANTS.FRESNEL.QUALITY.EXCELLENT) linkQuality = "Excellent (+++)";
  else if (worstFresnelRatio >= RF_CONSTANTS.FRESNEL.QUALITY.GOOD)
    linkQuality = "Good (++)"; // 60% rule
  else if (worstFresnelRatio > RF_CONSTANTS.FRESNEL.QUALITY.MARGINAL)
    linkQuality = "Marginal (+)"; // Visual LOS, but heavy Fresnel
  else linkQuality = "Obstructed (-)"; // No Visual LOS

  return {
    minClearance: parseFloat(minClearance.toFixed(1)),
    isObstructed,
    linkQuality,
    profileWithStats,
  };
};



/**
 * Calculate Bullington Diffraction Loss (simplified)
 * Finds the "dominant obstacle" and calculates knife-edge diffraction.
 * @param {Array} profile - {distance (km), elevation (m), earthBulge (m)}
 * @param {number} freqMHz
 * @param {number} txHeightAGL - needed if not baked into profile
 * @param {number} rxHeightAGL - needed if not baked into profile
 * @returns {number} Additional Loss in dB
 */
export const calculateBullingtonDiffraction = (profile, freqMHz, txHeightAGL, rxHeightAGL) => {
    if (!profile || profile.length < 3) return 0;

    const start = profile[0];
    const end = profile[profile.length - 1];
    
    // Convert heights to AMSL (Above Mean Sea Level)
    const txElev = start.elevation + txHeightAGL;
    const rxElev = end.elevation + rxHeightAGL;

    // Line of Sight Equation: y = mx + b
    // x is distance from start (km)
    // y is elevation (m)
    // m = (rxElev - txElev) / totalDist
    // b = txElev
    
    const totalDist = end.distance;
    const slope = (rxElev - txElev) / totalDist;
    const intercept = txElev; // at x=0

    let maxV = -Infinity;

    // Iterate points to find highest "v" (Fresnel Diffraction Parameter)
    for (let i = 1; i < profile.length - 1; i++) {
        const pt = profile[i];
        const d_km = pt.distance; // distance from tx
        // Earth bulge should theoretically be added to elevation for checking obstruction
        // relative to a straight line cord, OR we curve the line. 
        // rfMath.js usually calculates earthBulge separately.
        // For Bullington, we compare "Effective Terrain Height" vs "LOS Line"
        
        // Effective Terrain = Elevation + Earth Bulge
        // We need to recalculate bulge if it's not in the object, but let's assume raw elevation first
        // and add bulge locally to be safe.
        const bulge = calculateEarthBulge(d_km, totalDist);
        const effectiveH = pt.elevation + bulge;

        // LOS Height at this point
        const losH = (slope * d_km) + intercept;
        
        // h = Vertical distance from LOS to Obstacle Tip
        // Positive h = Obstruction extends ABOVE LOS (Blocked)
        // Negative h = Obstruction is BELOW LOS (Clear)
        const h = effectiveH - losH; 

        // Fresnel Parameter v
        // v = h * sqrt( (2 * (d1 + d2)) / (lambda * d1 * d2) )
        // d1, d2 are distances to ends FROM the obstacle
        // lambda is wavelength
        
        const d1 = d_km * 1000; // meters
        const d2 = (totalDist - d_km) * 1000; // meters
        const wavelength = 300 / freqMHz; // meters

        // Pre-compute constant part of sqrt
        // v = h * sqrt(2 / lambda * (1/d1 + 1/d2))
        //   = h * sqrt( (2 * (d1+d2)) / (lambda * d1 * d2) )
        
        const geom = (2 * (d1 + d2)) / (wavelength * d1 * d2);
        const v = h * Math.sqrt(geom);

        if (v > maxV) {
            maxV = v;
        }
    }

    // Calculate Loss from v (Lee's Approximation for Knife Edge)
    // L(v) = 0 for v < -0.7
    // L(v) = 6.9 + 20log(sqrt((v-0.1)^2 + 1) + v - 0.1)
    // Simplified Approximation commonly used:
    // If v > -0.7: Loss = 6.9 + 20 * log10(v + sqrt(v^2 + 1))  <-- approx
    // Actual standard curve:
    
    if (maxV <= -1) return 0; // Clear LOS with good clearance

    let diffractionLoss = 0;
    
    if (maxV > -0.78) {
        // ITU-R P.526-14 Equation 31: J(v) = 6.9 + 20*log10(sqrt((v-0.1)^2 + 1) + v - 0.1)
        const term = maxV - 0.1;
        const val = Math.sqrt(term * term + 1) + term;
        diffractionLoss = 6.9 + 20 * Math.log10(val);
    }
    
    return Math.max(0, parseFloat(diffractionLoss.toFixed(2)));
};
