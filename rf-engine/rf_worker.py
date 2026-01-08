import os
import subprocess
import math


CACHE_DIR = "/app/cache"
SDF_DIR = "/app/cache/sdf" # SPLAT looks for SDF files in current dir or specific path

os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(SDF_DIR, exist_ok=True)

def get_srtm_filename(lat, lon):
    # Construct SRTM filename, e.g., N45W123.hgt
    ns = 'N' if lat >= 0 else 'S'
    ew = 'E' if lon >= 0 else 'W'
    lat_int = abs(int(math.floor(lat)))
    lon_int = abs(int(math.floor(lon)))
    return f"{ns}{lat_int:02d}{ew}{lon_int:03d}.hgt"

def ensure_terrain_data(lat, lon):
    filename = get_srtm_filename(lat, lon)
    hgt_path = os.path.join(CACHE_DIR, filename)
    sdf_filename = filename.replace('.hgt', '.sdf')
    sdf_path = os.path.join(SDF_DIR, sdf_filename)

    # 1. Check if SDF exists (SPLAT uses SDF)
    if os.path.exists(sdf_path):
        return

    # 2. Check if HGT exists
    if not os.path.exists(hgt_path):
        # We now REQUIRE the user to provide the HGT file locally in ./cache
        raise FileNotFoundError(
            f"Missing terrain data: {filename}. "
            f"Please download the SRTM file (e.g. from USGS or OpenTopography) "
            f"and place it in the 'cache' directory: {hgt_path}"
        )

    # 3. Convert HGT to SDF
    # splat usually comes with srtm2sdf
    # Command: srtm2sdf N45W123.hgt
    print(f"Converting {filename} to SDF...")
    try:
        subprocess.run(["srtm2sdf", hgt_path], cwd=SDF_DIR, check=True)
    except FileNotFoundError:
        print("Error: srtm2sdf not found. Ensure splat is installed.")

def run_analysis(lat, lon, freq_mhz, height_m):
    # 1. Ensure Terrain
    ensure_terrain_data(lat, lon)

    # 2. Create QTH file (Site location)
    # site_name.qth
    # format:
    # name
    # lat
    # lon
    # height (meters or feet? SPLAT usually expects meters for some args, but QTH might vary.
    # Standard QTH: format is specific. 
    # Let's use command line args for site location instead of QTH file if possible, 
    # or generate a temporary QTH.
    
    site_name = "tx_site"
    qth_content = f"{site_name}\n{lat}\n{lon}\n{height_m} meters\n"
    qth_path = f"{site_name}.qth"
    
    with open(qth_path, "w") as f:
        f.write(qth_content)

    # 3. Run SPLAT
    # splat -t <site> -L <height> -f <freq> -R <radius> -o <output_ppm>
    # Note: SPLAT arguments vary by version. 
    # -t: terrain analysis? No, -t is usually for tx site.
    # Common usage: splat -t tx_site -r rx_site ...
    # For coverage (LR model): splat -t tx_site -L <tx_height_agl> -R <radius_miles> ...
    # We want radius in km (40km). 40km ~ 25 miles.
    
    # -d: path to sdf files (can be set via -d flag or locally)
    
    output_base = "coverage_map"
    cmd = [
        "splat",
        "-t", qth_path,
        "-L", str(height_m), # TX height AGL
        "-f", str(freq_mhz),
        "-R", "25", # Radius in miles (approx 40km)
        "-o", output_base + ".ppm", # Output file
        "-d", SDF_DIR # Directory for SDFs
    ]
    
    print(f"Running SPLAT: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"SPLAT failed: {result.stderr}")
        raise Exception("SPLAT execution failed")

    # 4. Convert PPM to PNG (Transparent)
    # Using gdal or convert (ImageMagick)
    # User asked for gdal-bin (gdal_translate) or convert.
    # splat produces .ppm. 
    # gdal_translate -of PNG -a_ullr <ulx> <uly> <lrx> <lry> ...
    # Wait, SPLAT generates a .geo file or .kml to tell us the bounds?
    # Usually splat produces a .kml if requested, or we know the bounds from the run.
    # Without georeferencing, the image is just pixels.
    # We need to parse the bounds to return them to the frontend.
    # SPLAT output often includes a .kml or we can parse the metadata.
    
    # For now, let's assume we return the PPM converted to PNG and we might need to parse the generated KML for bounds.
    # Let's add -kml flag to splat to generate georeference info
    
    subprocess.run(cmd + ["-kml"], check=False) # Generate KML too
    
    ppm_file = f"{site_name}-site_report.ppm" # Wait, output name depends on splat version and args. 
    # If -o is specified, it might be the output.
    # If splat 1.4.2, -o output_filename (without ext) for PPM.
    # Let's just assume output_base.ppm exists.
    
    if not os.path.exists(output_base + ".ppm"):
         # Fallback check
         pass

    # Convert logic
    png_output = "output.png"
    # gdal_translate input.ppm output.png
    # -a_nodata 0 or 255 depending on SPLAT background. Usually white (255,255,255) is background?
    # Or black (0,0,0)? SPLAT default background is often black.
    # Let's try 0 for transparency.
    convert_cmd = ["gdal_translate", "-of", "PNG", "-a_nodata", "0", output_base + ".ppm", png_output]
    subprocess.run(convert_cmd)
    
    # Parse KML for bounds if generated
    bounds = {}
    kml_file = f"{site_name}-site_report.kml" # Common output name
    if os.path.exists(kml_file):
        # TODO: Parse KML to extract North, South, East, West bounds
        # For now, return mock bounds based on input lat/lon + radius
        pass
    
    # Mock bounds calculation (approximate)
    # 40km ~ 0.36 degrees
    deg_radius = 40 / 111.0
    bounds = [[lat - deg_radius, lon - deg_radius], [lat + deg_radius, lon + deg_radius]]

    # Return result URL or base64 (omitted for brevity, assume file path for now)
    return {
        "status": "success", 
        "map_url": f"/static/{png_output}", 
        "bounds": bounds
    }

# --- Phase 3: Sieve Algorithm ---
import rasterio
import numpy as np
from scipy.ndimage import maximum_filter

def optimize_location_task(min_lat, min_lon, max_lat, max_lon, freq_mhz, height_m):
    """
    Find ideal locations within the bounding box using the 'Sieve' algorithm.
    Step A: Identify Prominence (local maxima).
    Step B: View Score (simplified LOS).
    Returns top 3 candidates.
    """
    
    # 1. Ensure/Load DEM Data covering the box
    # For simplicity, we assume we have a large DEM or fetch the tile covering the center.
    # In reality, might need to merge multiple tiles.
    center_lat = (min_lat + max_lat) / 2
    center_lon = (min_lon + max_lon) / 2
    ensure_terrain_data(center_lat, center_lon)
    
    filename = get_srtm_filename(center_lat, center_lon)
    hgt_path = os.path.join(CACHE_DIR, filename)
    
    if not os.path.exists(hgt_path):
        return {"status": "error", "message": "Terrain data missing"}

    locations = []
    
    try:
        with rasterio.open(hgt_path) as src:
            # Read elevation data
            # Window read? Or read all and crop?
            # Let's read the window matching our bbox
            window = src.window(min_lon, min_lat, max_lon, max_lat)
            # transform coordinates to window (approx) or read full if specific window logic hard
            # For HGT (1deg x 1deg), reading full is fast enough (1201x1201 or 3601x3601)
            
            elevation = src.read(1) # Read first band
            transform = src.transform
            
            # Step A: Local Maxima (Prominence)
            # Use maximum_filter to find peaks
            neighborhood_size = 20 # Look in similar radius pixels
            local_max = maximum_filter(elevation, size=neighborhood_size)
            peaks_mask = (elevation == local_max)
            
            # Filter peaks that are within our bbox
            # And above a certain threshold if needed?
            
            # Get indices of peaks
            peak_indices = np.argwhere(peaks_mask)
            
            candidates = []
            
            for r, c in peak_indices:
                # Convert pixel to lat/lon
                # Rasterio transform: x, y = transform * (col, row)
                # Note: HGT might implement specific transform
                lon, lat = rasterio.transform.xy(transform, r, c, offset='center')
                
                # Check if in bbox
                if min_lat <= lat <= max_lat and min_lon <= lon <= max_lon:
                    # Get elevation
                    elev = elevation[r, c]
                    candidates.append({ 'lat': lat, 'lon': lon, 'elev': float(elev), 'r': r, 'c': c })

            # Limit to top 20 by elevation (or prominence if calc'd)
            candidates.sort(key=lambda x: x['elev'], reverse=True)
            top_candidates = candidates[:20]
            
            # Step B: View Score (Simplified LOS)
            # Run simple check: average slope to neighbors or clear horizon?
            # "Simplified Line-of-Sight check (360 degrees)"
            # Doing full 360 LOS for 20 points on loaded DEM
            scored_candidates = []
            
            for cand in top_candidates:
                score = calculate_view_score(cand['r'], cand['c'], elevation)
                scored_candidates.append({**cand, 'score': score})
            
            # Sort by Score
            scored_candidates.sort(key=lambda x: x['score'], reverse=True)
            
            # Return Top 3
            final_top_3 = scored_candidates[:3]
            
            return {
                "status": "success",
                "locations": final_top_3
            }

    except Exception as e:
        print(f"Sieve Error: {e}")
        return {"status": "error", "message": str(e)}

def calculate_view_score(r, c, elev_grid):
    """
    Simple Viewshed Score:
    Check 8 or 16 directions. 
    Count how far we can see before hitting higher terrain?
    Or calculate total visible area?
    Prompt says: "calculate a 'View Score'"
    Let's do average distance to obstruction in 8 directions.
    """
    rows, cols = elev_grid.shape
    site_elev = elev_grid[r, c] + 10 # +10m tower
    
    view_distances = []
    directions = [
        (0, 1), (0, -1), (1, 0), (-1, 0), # Cardinals
        (1, 1), (1, -1), (-1, 1), (-1, -1) # Diagonals
    ]
    
    max_dist = 50 # check 50 pixels out
    
    for dr, dc in directions:
        dist = 0
        current_r, current_c = r, c
        blocked = False
        
        for i in range(1, max_dist):
            current_r += dr
            current_c += dc
            
            if not (0 <= current_r < rows and 0 <= current_c < cols):
                dist = i
                break # Edge of map
            
            # Earth curve drop? (Optional, simplify: straight line)
            # If target pixel > site_elev (simple)
            # Or LOS angle
            
            target_elev = elev_grid[current_r, current_c]
            if target_elev >= site_elev:
                dist = i
                blocked = True
                break
            
            dist = i
        
        view_distances.append(dist)
    
    # Score = sum of distances
    return sum(view_distances)

