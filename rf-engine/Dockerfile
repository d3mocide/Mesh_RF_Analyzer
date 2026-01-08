FROM python:3.9-slim

# Install system dependencies
# splat: RF analysis tool
# gdal-bin: Geospatial data abstraction library (for image conversion)
# wget, unzip: For downloading terrain data
RUN apt-get update && apt-get install -y \
    splat \
    gdal-bin \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Expose port and define entrypoint
EXPOSE 5001
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "5001"]
