import requests
import msgpack
import mercantile
import numpy as np
import logging
import os
import scipy.ndimage
import threading
from concurrent.futures import ThreadPoolExecutor
from requests.adapters import HTTPAdapter

logger = logging.getLogger(__name__)

class TileManager:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.zoom = 12  # Standard zoom level for 30m resolution approx
        self.ttl = 30 * 24 * 60 * 60  # 30 Days
        
        # Connection pooling for high concurrency
        self.session = requests.Session()
        adapter = HTTPAdapter(pool_connections=50, pool_maxsize=50)
        self.session.mount('http://', adapter)
        self.session.mount('https://', adapter)
        
        # Separate executors to prevent deadlocks
        self.tile_executor = ThreadPoolExecutor(max_workers=10, thread_name_prefix='tile_')
        self.batch_executor = ThreadPoolExecutor(max_workers=30, thread_name_prefix='batch_')
        
        # Request coalescing to prevent thundering herd
        self.tile_locks = {}
        self.global_lock = threading.Lock()

    def get_tile_data(self, lat=None, lon=None, tile_x=None, tile_y=None, zoom=None):
        """
        Returns the raw data (elevation grid) for the tile.
        """
        if tile_x is None:
            if lat is None or lon is None:
                raise ValueError("Must provide either lat/lon or tile coordinates")
            tile = mercantile.tile(lon, lat, self.zoom)
            tile_x, tile_y, zoom = tile.x, tile.y, self.zoom
        
        zoom = zoom if zoom is not None else self.zoom
        tile_key = f"tile:{zoom}:{tile_x}:{tile_y}"
        
        # 1. Fast check cache
        data = self._get_tile_from_cache(tile_key)
        if data:
            return data
            
        # 2. Cache miss - use lock to prevent redundant fetches
        with self.global_lock:
            if tile_key not in self.tile_locks:
                self.tile_locks[tile_key] = threading.Lock()
            lock = self.tile_locks[tile_key]
            
        with lock:
            # Double check cache inside lock
            data = self._get_tile_from_cache(tile_key)
            if data:
                return data
                
            logger.info(f"Cache miss for tile {tile_key}. Fetching from API.")
            data = self._fetch_tile_from_api(tile_x, tile_y, zoom)
            if data:
                self._cache_tile(tile_key, data)
        
        return data

    def get_elevation(self, lat, lon):
        """
        Get elevation for a specific coordinate. 
        Transparently handles caching and fetching tiles.
        """
        logger.info(f"Getting elevation for lat={lat}, lon={lon}")
        tile = mercantile.tile(lon, lat, self.zoom)
        logger.info(f"Tile coordinates: x={tile.x}, y={tile.y}, z={self.zoom}")
        data = self.get_tile_data(lat=lat, lon=lon)
        
        if data:
            logger.info(f"Got tile data, first 5 elevation values: {data.get('elevation', [])[:5] if 'elevation' in data else 'NO ELEVATION KEY'}")
            result = self._extract_elevation_from_tile(data, lat, lon, tile)
            logger.info(f"Extracted elevation: {result}")
            return result
        logger.warning("No tile data returned!")
        return 0.0

    def get_elevation_profile(self, lat1, lon1, lat2, lon2, samples=50):
        """
        Get elevation profile along a path between two points (Batch optimized).
        """
        lats = np.linspace(lat1, lat2, samples)
        lons = np.linspace(lon1, lon2, samples)
        coords = list(zip(lats, lons))
        
        return self.get_elevations_batch(coords)



    def _fetch_tile_from_api(self, x, y, z):
        """
        Fetch elevation data from OpenTopoData API.
        Supports custom OpenTopoData instances via ELEVATION_API_URL env variable.
        Falls back to public OpenTopoData (api.opentopodata.org) if not set.
        
        OpenTopoData supports batch requests (up to 100 points per call),
        which reduces API calls significantly compared to individual point queries.
        """
        bounds = mercantile.bounds(x, y, z)
        lat_min, lat_max = bounds.south, bounds.north
        lon_min, lon_max = bounds.west, bounds.east
        
        base_url = os.environ.get('ELEVATION_API_URL', 'http://opentopodata:5000')
        dataset = os.environ.get('ELEVATION_DATASET', 'srtm30m')
        
        # Create 16x16 grid of coordinates
        lats = np.linspace(lat_min, lat_max, 16)
        lons = np.linspace(lon_min, lon_max, 16)
        
        lat_grid, lon_grid = np.meshgrid(lats, lons)
        lat_flat = lat_grid.flatten()
        lon_flat = lon_grid.flatten()
        
        # OpenTopoData supports up to 100 locations per request
        # We have 256 points (16x16), so split into 3 batches: 100, 100, 56
        batch_size = 100
        
        batches = []
        for i in range(0, len(lat_flat), batch_size):
            batch_lats = lat_flat[i:i + batch_size]
            batch_lons = lon_flat[i:i + batch_size]
            locations = "|".join([f"{lat},{lon}" for lat, lon in zip(batch_lats, batch_lons)])
            batches.append(locations)
            
        url = f"{base_url}/v1/{dataset}"
        
        def fetch_batch(locations, batch_num):
            try:
                # No artificial delay needed for local deployments
                response = self.session.get(
                    url,
                    params={'locations': locations},
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('status') == 'OK' and 'results' in data:
                        return [result.get('elevation', 0.0) for result in data['results']]
                    else:
                        error_msg = data.get('error', 'Unknown error')
                        logger.error(f"OpenTopoData batch {batch_num} error: {error_msg}")
                        return None
                elif response.status_code == 404:
                    logger.error(f"Dataset '{dataset}' not found. Check ELEVATION_DATASET env var and data files.")
                    return None
                else:
                    logger.warning(f"OpenTopoData batch {batch_num} failed with status {response.status_code}")
                    return None
                    
            except requests.exceptions.Timeout:
                logger.error(f"OpenTopoData request timed out for batch {batch_num}")
                return None
            except requests.exceptions.ConnectionError:
                logger.error(f"Cannot connect to OpenTopoData at {base_url}. Is the container running?")
                return None
            except Exception as e:
                logger.error(f"Exception fetching OpenTopoData batch {batch_num}: {e}")
                return None

        # Execute batches in parallel
        futures = [self.batch_executor.submit(fetch_batch, locs, i) for i, locs in enumerate(batches)]
        
        all_elevations = []
        for future in futures:
            batch_result = future.result()
            if batch_result is None:
                return None
            all_elevations.extend(batch_result)
        
        if len(all_elevations) == 256:
            logger.info(f"Successfully fetched elevation data from OpenTopoData ({dataset}): min={min(all_elevations):.1f}m, max={max(all_elevations):.1f}m")
            return {"elevation": all_elevations}
        else:
            logger.error(f"Expected 256 elevation points, got {len(all_elevations)}")
            return None

    def get_interpolated_grid(self, x, y, z, size=256):
        """
        Returns a (size, size) numpy array of elevation data for the tile.
        Upscales the low-res 16x16 fetched data.
        """
        data = self.get_tile_data(tile_x=x, tile_y=y, zoom=z)
        if not data or 'elevation' not in data:
            return np.zeros((size, size))
        
        raw_elev = np.array(data['elevation'])
        if raw_elev.size != 16*16:
             return np.zeros((size, size))
             
        grid_16 = raw_elev.reshape((16, 16)).T
        grid_16 = np.flipud(grid_16)
        
        zoom_factor = size / 16.0
        high_res_grid = scipy.ndimage.zoom(grid_16, zoom_factor, order=1)
        
        return high_res_grid

    def get_elevations_batch(self, coords):
        """
        Efficiently get elevations for a list of (lat, lon) coordinates.
        Groups by tile and fetches required tiles in parallel.
        """
        # 1. Group coordinates by tile
        tile_to_coords = {}
        for lat, lon in coords:
            tile = mercantile.tile(lon, lat, self.zoom)
            tile_key = (tile.x, tile.y, self.zoom)
            if tile_key not in tile_to_coords:
                tile_to_coords[tile_key] = []
            tile_to_coords[tile_key].append((lat, lon))
            
        # 2. Fetch all unique tiles in parallel
        unique_tiles = list(tile_to_coords.keys())
        tile_data_map = {}
        
        def fetch_single_tile(tx, ty, tz):
            data = self.get_tile_data(tile_x=tx, tile_y=ty, zoom=tz)
            return (tx, ty, tz), data

        futures = [self.tile_executor.submit(fetch_single_tile, tx, ty, tz) for tx, ty, tz in unique_tiles]
        
        for future in futures:
            key, data = future.result()
            tile_data_map[key] = data
            
        # 3. Extract elevations
        results = []
        for lat, lon in coords:
            tile = mercantile.tile(lon, lat, self.zoom)
            tile_key = (tile.x, tile.y, self.zoom)
            data = tile_data_map.get(tile_key)
            
            if data:
                # Need mercantile Tile object for extraction logic
                elev = self._extract_elevation_from_tile(data, lat, lon, tile)
                results.append(elev)
            else:
                results.append(0.0)
                
        return results

    def _cache_tile(self, key, data):
        packed = msgpack.packb(data)
        self.redis.setex(key, self.ttl, packed)

    def _get_tile_from_cache(self, key):
        packed = self.redis.get(key)
        if packed:
            return msgpack.unpackb(packed)
        return None

    def _extract_elevation_from_tile(self, data, lat, lon, tile):
        """
        Performs bilinear interpolation on the 16x16 grid to find elevation at lat, lon.
        """
        if not data or 'elevation' not in data:
            return 0.0
            
        raw_elev = np.array(data['elevation'])
        if raw_elev.size != 256: 
             return 0.0
             
        grid = raw_elev.reshape((16, 16))
        
        bounds = mercantile.bounds(tile)
        lat_min, lat_max = bounds.south, bounds.north
        lon_min, lon_max = bounds.west, bounds.east
        
        if lat_max == lat_min or lon_max == lon_min: 
            return 0.0
        
        u = (lat - lat_min) / (lat_max - lat_min) * 15.0
        v = (lon - lon_min) / (lon_max - lon_min) * 15.0
        
        u = np.clip(u, 0, 15)
        v = np.clip(v, 0, 15)
        
        i = int(np.floor(u))
        j = int(np.floor(v))
        
        u_ratio = u - i
        v_ratio = v - j
        
        i_next = min(i + 1, 15)
        j_next = min(j + 1, 15)
        
        p00 = grid[j, i]
        p10 = grid[j, i_next]
        p01 = grid[j_next, i]
        p11 = grid[j_next, i_next]
        
        val_j = (p00 * (1 - u_ratio)) + (p10 * u_ratio)
        val_jnext = (p01 * (1 - u_ratio)) + (p11 * u_ratio)
        
        final_elev = (val_j * (1 - v_ratio)) + (val_jnext * v_ratio)
        
        return float(final_elev)
