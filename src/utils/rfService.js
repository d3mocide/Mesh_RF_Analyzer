const API_URL = 'http://localhost:5001';

export const analyzeCoverage = async (lat, lng, freq, height) => {
    try {
        const response = await fetch(`${API_URL}/analyze-coverage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                lat: lat,
                lon: lng,
                frequency_mhz: freq,
                height_meters: height
            }),
        });

        if (!response.ok) {
            throw new Error('RF Analysis failed');
        }

        const initialData = await response.json();
        
        if (initialData.job_id) {
            return await pollJob(initialData.job_id);
        }
        
        return initialData;
    } catch (error) {
        console.error("Error calling RF Engine:", error);
        throw error;
    }
};

const pollJob = async (jobId) => {
    const maxRetries = 60; // 1 minute timeout?
    let retries = 0;
    
    while (retries < maxRetries) {
        const res = await fetch(`${API_URL}/status/${jobId}`);
        const data = await res.json();
        
        if (data.status === 'finished') {
            return data.result;
        } else if (data.status === 'failed') {
             throw new Error("Job failed");
        }
        
        await new Promise(r => setTimeout(r, 1000)); // Wait 1s
        retries++;
    }
    throw new Error("Job timeout");
};

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
        if (initialData.job_id) {
            return await pollJob(initialData.job_id);
        }
        return initialData;
    } catch (error) {
        console.error("Optimize Error:", error);
        throw error;
    }
};
