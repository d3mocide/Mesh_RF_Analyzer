
import numpy as np
from scipy.ndimage import maximum_filter
import math
import rf_physics

class OptimizationService:
    def __init__(self, tile_manager):
        self.tile_manager = tile_manager

    def calculate_prominence(self, lat, lon, radius_km=5.0):
        """
        Calculate topographic prominence: height of peak relative to the lowest
        contour line encircling it but no higher summit.
        Simplified approximation for grid: Peak Elevation - Mean Elevation in neighborhood.
        """
        delta_deg = radius_km / 111.0
        
        # Sampling grid around point (10x10)
        steps = 10
        min_lat, max_lat = lat - delta_deg, lat + delta_deg
        min_lon, max_lon = lon - delta_deg, lon + delta_deg
        
        lat_step = (max_lat - min_lat) / steps
        lon_step = (max_lon - min_lon) / steps
        
        coords = []
        for i in range(steps + 1):
            for j in range(steps + 1):
                c_lat = min_lat + (i * lat_step)
                c_lon = min_lon + (j * lon_step)
                coords.append((c_lat, c_lon))
                
        elevs = self.tile_manager.get_elevations_batch(coords)
        
        if not elevs:
            return 0
            
        center_elevation = self.tile_manager.get_elevation(lat, lon)
        mean_elevation = sum(elevs) / len(elevs)
        
        # Prominence approximation: Peak - Mean
        prominence = center_elevation - mean_elevation
        
        return max(0, prominence)

    def check_fresnel_clearance(self, tx_lat, tx_lon, tx_h_m, rx_list, freq_mhz):
        """
        Check Fresnel zone clearance to a list of existing nodes.
        Rx_list: list of dicts {lat, lon, height}
        Returns: Average clearance percentage (0.0 to 1.0+)
        """
        if not rx_list:
            return 1.0 # No nodes to block, assume clear
            
        total_clearance = 0
        count = 0
        
        for rx in rx_list:
            dist_m = rf_physics.haversine_distance(tx_lat, tx_lon, rx['lat'], rx['lon'])
            if dist_m < 100: continue # Skip too close
            
            # Get profile
            profile = self.tile_manager.get_elevation_profile(
                tx_lat, tx_lon, rx['lat'], rx['lon'], samples=20
            )
            
            # Analyze
            res = rf_physics.analyze_link(profile, dist_m, freq_mhz, tx_h_m, rx['height'])
            
            # Use min_clearance_ratio from rf_physics
            min_ratio = res.get('min_clearance_ratio', 0)
            
            if min_ratio < 0:
                clearance = 0.0 # Blocked
            else:
                # Clamp at 1.0 (100% clearance)
                clearance = min(1.0, min_ratio)
                
            total_clearance += clearance
            count += 1
            
        return total_clearance / count if count > 0 else 1.0

    def score_candidate(self, candidate, weights, rx_list=None):
        """
        candidate: {lat, lon, elevation}
        weights: {elevation, prominence, fresnel}
        rx_list: existing network nodes
        """
        # Recalculate if not present
        prominence = candidate.get('prominence')
        if prominence is None:
            prominence = self.calculate_prominence(candidate['lat'], candidate['lon'])
            
        fresnel = 1.0
        if rx_list:
            # Default RX height 2m if not specified in rx_list
            # Default freq 915MHz needs to be passed or assumed
            fresnel = self.check_fresnel_clearance(
                candidate['lat'], candidate['lon'], 10, rx_list, 915 
            )
            
        candidate['prominence'] = prominence
        candidate['fresnel_factor'] = fresnel
        
        w_elev = weights.get('elevation', 0.3)
        w_prom = weights.get('prominence', 0.4)
        w_fres = weights.get('fresnel', 0.3)
        
        # Scoring Logic
        # Normalize Elevation: relative to... just raw for now? 
        # Ideally we'd normalize against the max in the batch.
        # But this function scores a SINGLE candidate.
        # We will assume caller handles normalization or we use raw weighted sum (which is fine for sorting)
        
        # However, purely additive raw scores (Elev + Prom) works if we don't mix units too bad.
        # Elev ~ 100s meters. Prom ~ 10s meters. Fresnel ~ 0-1.
        # We MUST normalize or scale.
        
        # Let's assume:
        # Elevation Score = Elev / 100
        # Prominence Score = Prom / 10
        # Fresnel Score = Fresnel * 10
        
        # This is arbitrary. Better approach: Return the Components, let Caller normalize & rank.
        
        return {
            "elevation": candidate['elevation'],
            "prominence": prominence,
            "fresnel": fresnel
        }
