#ifndef MESHRF_COVERAGE_H
#define MESHRF_COVERAGE_H

#include <vector>

/**
 * Calculate RF Coverage Map using ITM propagation model.
 * 
 * @param elevation_data    Pointer to elevation data (float array, row-major)
 * @param width             Width of elevation grid
 * @param height            Height of elevation grid
 * @param tx_x              Transmitter X coordinate (pixel)
 * @param tx_y              Transmitter Y coordinate (pixel)
 * @param tx_h_meters       Transmitter antenna height above ground (meters)
 * @param frequency_mhz     Frequency in MHz
 * @param tx_power_dbm      Transmitter power in dBm
 * @param tx_gain_dbi       Transmitter antenna gain in dBi
 * @param rx_gain_dbi       Receiver antenna gain in dBi
 * @param rx_sensitivity    Receiver sensitivity in dBm
 * @param max_dist_pixels   Maximum distance to calculate (pixels)
 * @param gsd_meters        Ground Sample Distance (meters per pixel)
 * @return                  Vector of float values representing received signal strength (dBm)
 *                          at each pixel. Values below rx_sensitivity indicate no coverage.
 */
std::vector<float> calculate_rf_coverage(
    const float* elevation_data,
    int width,
    int height,
    int tx_x,
    int tx_y,
    float tx_h_meters,
    float frequency_mhz,
    float tx_power_dbm,
    float tx_gain_dbi,
    float rx_gain_dbi,
    float rx_sensitivity,
    int max_dist_pixels,
    float gsd_meters
);

#endif // MESHRF_COVERAGE_H
