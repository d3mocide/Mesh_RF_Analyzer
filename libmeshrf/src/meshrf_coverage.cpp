#include "meshrf_coverage.h"
#include "meshrf_itm.h"
#include <cmath>
#include <algorithm>
#include <vector>

std::vector<float> calculate_rf_coverage(
    const float* elevation_data,
    int width,
    int height,
    int tx_x,
    int tx_y,
    float tx_h_meters,
    float rx_h_meters,
    float frequency_mhz,
    float tx_power_dbm,
    float tx_gain_dbi,
    float rx_gain_dbi,
    float rx_sensitivity,
    int max_dist_pixels,
    float gsd_meters,
    float epsilon,
    float sigma,
    int climate
) {
    // Initialize result buffer with "no signal" value
    std::vector<float> signal_strength(width * height, -999.0f);
    
    // Validate inputs
    if (tx_x < 0 || tx_x >= width || tx_y < 0 || tx_y >= height) {
        return signal_strength;
    }
    
    // TX location always has maximum signal
    signal_strength[tx_y * width + tx_x] = tx_power_dbm + tx_gain_dbi;
    
    // Define bounding box for calculation
    int x_min = std::max(0, tx_x - max_dist_pixels);
    int x_max = std::min(width - 1, tx_x + max_dist_pixels);
    int y_min = std::max(0, tx_y - max_dist_pixels);
    int y_max = std::min(height - 1, tx_y + max_dist_pixels);
    
    // Sampling rate: calculate every Nth pixel to speed up computation
    // For a 256x256 tile, sample_rate=4 reduces from ~58k to ~3.6k pixels
    const int sample_rate = 4;
    
    // For each pixel in the coverage area (with sampling)
    for (int y = y_min; y <= y_max; y += sample_rate) {
        for (int x = x_min; x <= x_max; x += sample_rate) {
            // Skip TX location (already set)
            if (x == tx_x && y == tx_y) continue;
            
            // Calculate distance
            int dx = x - tx_x;
            int dy = y - tx_y;
            float dist_pixels = std::sqrt(dx * dx + dy * dy);
            
            // Skip if beyond max distance
            if (dist_pixels > max_dist_pixels) continue;
            
            // Extract terrain profile from TX to this pixel
            // Use Bresenham's line algorithm to sample elevation
            std::vector<float> profile;
            int steps = static_cast<int>(dist_pixels) + 1;
            
            for (int i = 0; i <= steps; i++) {
                float t = static_cast<float>(i) / steps;
                int sample_x = static_cast<int>(tx_x + t * dx);
                int sample_y = static_cast<int>(tx_y + t * dy);
                
                // Bounds check
                if (sample_x >= 0 && sample_x < width && sample_y >= 0 && sample_y < height) {
                    profile.push_back(elevation_data[sample_y * width + sample_x]);
                }
            }
            
            // Need at least 2 points for ITM
            if (profile.size() < 2) continue;
            
            // Prepare ITM parameters
            LinkParameters params;
            params.frequency_mhz = frequency_mhz;
            params.tx_height_m = tx_h_meters;
            params.rx_height_m = rx_h_meters; // Use parameterized RX height
            params.polarization = 1; // Vertical (typical for LoRa)
            params.step_size_m = gsd_meters;
            params.N_0 = 301.0; // Standard atmosphere
            params.epsilon = epsilon; // Ground permittivity
            params.sigma = sigma; // Ground conductivity
            params.climate = climate; // Climate zone
            
            // Calculate path loss using ITM
            std::vector<float> losses = calculate_radial_loss(profile.data(), profile.size(), params);
            
            // Get loss at the target pixel (last point in profile)
            float path_loss_db = losses.back();
            
            // Skip if ITM returned error
            if (path_loss_db > 500.0f) continue;
            
            // Calculate received signal strength
            // RSSI = TX_Power + TX_Gain + RX_Gain - Path_Loss
            float rssi_dbm = tx_power_dbm + tx_gain_dbi + rx_gain_dbi - path_loss_db;
            
            // Store result
            signal_strength[y * width + x] = rssi_dbm;
        }
    }
    
    return signal_strength;
}
