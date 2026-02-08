const API_URL = '/api';

export const optimizeLocation = async (bounds, freq, height, weights) => {
    // bounds: { _southWest: { lat, lng }, _northEast: { lat, lng } }
    const min_lat = bounds.getSouth();
    const max_lat = bounds.getNorth();
    const min_lon = bounds.getWest();
    const max_lon = bounds.getEast();

    try {
        const response = await fetch(`${API_URL}/optimize-location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                min_lat: Number(min_lat),
                min_lon: Number(min_lon),
                max_lat: Number(max_lat),
                max_lon: Number(max_lon),
                frequency_mhz: Number(freq),
                height_meters: Number(height),
                weights: weights || { elevation: 0.5, prominence: 0.3, fresnel: 0.2 }
            })
        });
        const initialData = await response.json();
        return initialData;
    } catch (error) {
        console.error("Optimize Error:", error);
        throw error;
    }
};

export const calculateLink = async (nodeA, nodeB, freq, h1, h2, model, env, kFactor, clutterHeight) => {
    try {
        const response = await fetch(`${API_URL}/calculate-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tx_lat: Number(nodeA.lat),
                tx_lon: Number(nodeA.lng),
                rx_lat: Number(nodeB.lat),
                rx_lon: Number(nodeB.lng),
                frequency_mhz: Number(freq),
                tx_height: Number(h1),
                rx_height: Number(h2),
                model: model || 'itm_wasm',
                environment: env || 'suburban',
                k_factor: Number(kFactor) || 1.333,
                clutter_height: Number(clutterHeight) || 0
            })
        });
        return await response.json();
    } catch (error) {
        console.error("Link Calc Error:", error);
        throw error;
    }
};
