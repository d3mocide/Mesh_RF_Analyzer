const API_URL = 'http://localhost:5001';

export const optimizeLocation = async (bounds, freq, height) => {
    // bounds: { _southWest: { lat, lng }, _northEast: { lat, lng } } or similar Leaflet bounds
    const min_lat = bounds.getSouth();
    const max_lat = bounds.getNorth();
    const min_lon = bounds.getWest();
    const max_lon = bounds.getEast();

    try {
        const response = await fetch(`${API_URL}/optimize-location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                min_lat, min_lon, max_lat, max_lon,
                frequency_mhz: freq,
                height_meters: height
            })
        });
        const initialData = await response.json();
        return initialData;
    } catch (error) {
        console.error("Optimize Error:", error);
        throw error;
    }
};
