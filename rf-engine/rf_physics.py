
import numpy as np
import math

# Constants
EARTH_RADIUS_KM = 6371.0

def haversine_distance(lat1, lon1, lat2, lon2):
    R = EARTH_RADIUS_KM * 1000 # Meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c


def calculate_fresnel_zone(dist_m, freq_mhz, p_d1, p_d2):
    c = 2.99792e8
    wavelength = c / (freq_mhz * 1e6)
    return math.sqrt((1 * wavelength * p_d1 * p_d2) / dist_m)


def calculate_bullington_loss(dist_m, elevs, freq_mhz, tx_h, rx_h, k_factor=1.333, clutter_height=0.0):
    """
    Calculate diffraction loss using Bullington method (Knife-Edge).
    This serves as a robust 'Terrain Aware' model.
    """
    profile = np.array(elevs)
    num_points = len(profile)
    if num_points < 3:
        return 0.0

    # Calculate basic geometry
    dists = np.linspace(0, dist_m, num_points) # meters
    
    # Heights AMSL
    tx_alt = profile[0] + tx_h
    rx_alt = profile[-1] + rx_h
    
    # Slope of direct LOS line
    slope = (rx_alt - tx_alt) / dist_m
    intercept = tx_alt
    
    # Calculate Earth Bulge
    k = k_factor
    R_eff = k * EARTH_RADIUS_KM * 1000
    
    d1 = dists
    d2 = dist_m - dists
    bulge = (d1 * d2) / (2 * R_eff)
    
    # Effective Terrain (Terrain + Bulge + Clutter)
    effective_terrain = profile + bulge + clutter_height
    
    # LOS Height at each point
    los_h = (slope * dists) + intercept
    
    # Find max v (Diffraction Parameter)
    h_vec = effective_terrain - los_h
    
    wavelength = 2.99792e8 / (freq_mhz * 1e6)
    
    valid_mask = (d1 > 1.0) & (d2 > 1.0)
    
    if np.sum(valid_mask) == 0:
        return 0.0

    geom = np.sqrt( (2 * dist_m) / (wavelength * d1[valid_mask] * d2[valid_mask]) )
    v_vec = h_vec[valid_mask] * geom
    
    if len(v_vec) == 0:
        return 0.0
        
    max_v = np.max(v_vec)
    
    if max_v <= -0.78:
        return 0.0
        
    term = max_v - 0.1
    val = math.sqrt(term**2 + 1) + term
    loss = 6.9 + 20 * math.log10(val)
    
    return max(0.0, loss)

def calculate_hata_loss(dist_m, freq_mhz, tx_h, rx_h, environment='urban_small'):
    """
    Calculate Okumura-Hata Path Loss.
    Valid for 150-1500 MHz, 1-20km.
    """
    dist_km = dist_m / 1000.0
    
    # Clamp values to model limits/prevent errors
    d = max(0.1, dist_km) 
    f = freq_mhz
    hb = max(1, tx_h) # TX Height
    hm = max(1, rx_h) # RX Height
    
    logF = math.log10(f)
    logHb = math.log10(hb)
    logD = math.log10(d)
    
    # Mobile Height Correction a(hm)
    # Urban Small/Medium
    a_hm = (1.1 * logF - 0.7) * hm - (1.56 * logF - 0.8)
    
    if environment == 'urban_large':
        if f >= 400:
            a_hm = 3.2 * (math.log10(11.75 * hm)**2) - 4.97
        else:
            a_hm = 8.29 * (math.log10(1.54 * hm)**2) - 1.1

    # Urban Base Loss
    # Lu = 69.55 + 26.16*log(f) - 13.82*log(hb) - a(hm) + (44.9 - 6.55*log(hb))*log(d)
    loss = 69.55 + 26.16 * logF - 13.82 * logHb - a_hm + (44.9 - 6.55 * logHb) * logD
    
    # Environmental Corrections
    if environment == 'suburban':
        # Lsub = Lu - 2*(log(f/28))^2 - 5.4
        val = math.log10(f / 28)
        loss = loss - 2 * (val**2) - 5.4
    elif environment == 'rural':
        # Lrural = Lu - 4.78*(log(f))^2 + 18.33*log(f) - 40.94
        loss = loss - 4.78 * (logF**2) + 18.33 * logF - 40.94
        
    return max(0.0, loss)


def calculate_path_loss(dist_m, elevs, freq_mhz, tx_h, rx_h, model='bullington', environment='suburban', k_factor=1.333, clutter_height=0.0):
    """
    Generic Path Loss Calculator.
    Dispatches to specific model implementations.
    """
    dist_km = dist_m / 1000.0
    if dist_km < 0.001: return 0.0

    # 1. Okumura-Hata
    if model == 'hata':
        return calculate_hata_loss(dist_m, freq_mhz, tx_h, rx_h, environment)
        
    # 2. Free Space (FSPL) - implicitly used as base for others or explicit
    fspl = 20 * math.log10(dist_km) + 20 * math.log10(freq_mhz) + 32.44
    
    if model == 'fspl':
        return fspl
        
    # 3. Bullington (Terrain Helper - previously misnamed as ITM)
    if model == 'bullington' or model == 'itm':
        # Bullington is Diffraction ADDED to FSPL
        diffraction = calculate_bullington_loss(dist_m, elevs, freq_mhz, tx_h, rx_h, k_factor, clutter_height)
        return fspl + diffraction
        
    # Default fallback
    return fspl


def analyze_link(elevs, dist_m, freq_mhz, tx_h, rx_h, k_factor=1.333, clutter_height=0.0):
    # Standard Analysis
    elevs = np.array(elevs)
    num_points = len(elevs)
    dists = np.linspace(0, dist_m, num_points)
    
    k = k_factor
    R_eff = k * EARTH_RADIUS_KM * 1000
    
    d_tx = dists
    d_rx = dist_m - dists
    bulge = (d_tx * d_rx) / (2 * R_eff)
    
    terrain_h = elevs + bulge + clutter_height
    
    tx_alt = elevs[0] + tx_h
    rx_alt = elevs[-1] + rx_h
    los_h = np.linspace(tx_alt, rx_alt, num_points)
    
    clearance = los_h - terrain_h
    
    min_clearance_ratio = 100.0
    
    for i in range(num_points):
        d1 = dists[i]
        d2 = dist_m - d1
        if d1 < 1 or d2 < 1: continue
            
        f1 = calculate_fresnel_zone(dist_m, freq_mhz, d1, d2)
        ratio = clearance[i] / f1
        if ratio < min_clearance_ratio:
            min_clearance_ratio = ratio
            
    status = "viable"
    if min_clearance_ratio < 0:
        status = "blocked"
    elif min_clearance_ratio < 0.6:
        status = "degraded"
        
    return {
        "dist_km": dist_m / 1000,
        "status": status,
        "min_clearance_ratio": float(min_clearance_ratio),
        "path_loss_db": 0.0,
        "profile": elevs.tolist()
    }
