# Self-Hosting OpenTopoData for meshRF

By default, the rf-engine uses the public OpenTopoData API, which is rate-limited. For unlimited local queries and better performance, you can self-host the OpenTopoData service using the included Docker configuration.

## 1. Setup

The service is already configured in `docker-compose.yml`, but it requires you to manually download the elevation data files for your region.

### Directory Structure

Ensure the following directory exists in your project root:

```bash
data/opentopodata/
```

_(The Docker service maps this folder to `/app/data` inside the container)_

## 2. Download Elevation Data (Example: Portland, OR)

meshRF is configured to use the **NED 10m** dataset (high resolution for US) by default.

1.  **Find your grid**: Portland, Oregon is located at approximately **N45 W122**.
2.  **Download the file**: You need the `.hgt` or `.tif` files for this region.
    - **Source**: [USGS National Map](https://apps.nationalmap.gov/downloader/) or via OpenTopography.
    - **Direct Download (NED 10m)**: Look for files named like `n45w123.hgt` or similar 1-arc-second data.

    _For this example, download the 1-arc-second SRTM or NED file for N45W123._

3.  **Place the file**:
    Move the downloaded `.hgt` (or `.tif`) file into `data/opentopodata/`.

    ```text
    meshrf/
    ├── data/
    │   └── opentopodata/
    │       └── n45w123.hgt  <-- Place file here
    ```

**If you would like to download larger datasets to support an entire region we have created a tool for batch processing with guides on batch downloads from USGS**
[meshRF Datasets Tool](https://github.com/d3mocide/meshRF-datasets-tool)

## 3. Configuration (config.yaml)

The service requires a `config.yaml` file to define the datasets. Only the `config.yaml` is tracked by git; the data files are ignored.

Create or edit `data/opentopodata/config.yaml`:

Example:

```yaml
datasets:
  - name: ned10m
    path: /app/data/ned10m/
    filename_epsg: 4269
    filename_tile_size: 1
    wgs84_bounds:
      left: -125
      right: -115
      bottom: 41
      top: 50
```

## 4. Environment Variables

If you downloaded a different dataset type (e.g., SRTM 30m instead of NED 10m), update the `ELEVATION_DATASET` environment variable in `docker-compose.yml`:

```yaml
rf-engine:
  environment:
    - ELEVATION_API_URL=http://opentopodata:5000
    - ELEVATION_DATASET=srtm30m # Change to match your data (srtm30m, srtm90m, ned10m, etc.)
```

## 5. Restart

Restart the services to pick up the new data:

```bash
docker-compose restart rf-engine
```

The service scans the `data` folder on startup. If successful, `http://localhost:5000/v1/ned10m?locations=45.5,-122.6` should return valid elevation data.
