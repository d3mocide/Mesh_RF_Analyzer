#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <cstdint>
#include "meshrf_itm.h"
#include "meshrf_viewshed.h"
#include "meshrf_coverage.h"
#include <vector>

using namespace emscripten;

// External declarations
std::vector<int> optimize_site_selection(const float* coverage_matrix, int num_candidates, int num_targets);

EMSCRIPTEN_BINDINGS(meshrf_module) {
    
    // Bind LinkParameters Struct
    value_object<LinkParameters>("LinkParameters")
        .field("frequency_mhz", &LinkParameters::frequency_mhz)
        .field("tx_height_m", &LinkParameters::tx_height_m)
        .field("rx_height_m", &LinkParameters::rx_height_m)
        .field("polarization", &LinkParameters::polarization)
        .field("step_size_m", &LinkParameters::step_size_m)
        .field("N_0", &LinkParameters::N_0)
        .field("epsilon", &LinkParameters::epsilon)
        .field("sigma", &LinkParameters::sigma)
        .field("climate", &LinkParameters::climate)
        ;

    // Register Vector types
    register_vector<float>("VectorFloat");
    register_vector<uint8_t>("VectorUint8");
    register_vector<int>("VectorInt");
    
    // ITM Radial Loss Calculation
    function("calculate_itm", optional_override([](uintptr_t profile_ptr, int count, LinkParameters params) {
        float* profile = reinterpret_cast<float*>(profile_ptr);
        return calculate_radial_loss(profile, count, params);
    }));

    // Simple Viewshed (Line-of-Sight)
    function("calculate_viewshed", optional_override([](uintptr_t elev_ptr, int width, int height, int tx_x, int tx_y, float tx_h, int max_dist) {
        float* elev = reinterpret_cast<float*>(elev_ptr);
        return calculate_viewshed(elev, width, height, tx_x, tx_y, tx_h, max_dist);
    }));
    
    // RF Coverage (ITM-based propagation)
    function("calculate_rf_coverage", optional_override([](
        uintptr_t elev_ptr,
        int width,
        int height,
        int tx_x,
        int tx_y,
        float tx_h,
        float rx_h,
        float freq_mhz,
        float tx_power_dbm,
        float tx_gain_dbi,
        float rx_gain_dbi,
        float rx_sensitivity,
        int max_dist,
        float gsd_meters
    ) {
        float* elev = reinterpret_cast<float*>(elev_ptr);
        return calculate_rf_coverage(
            elev, width, height, tx_x, tx_y, tx_h, rx_h,
            freq_mhz, tx_power_dbm, tx_gain_dbi, rx_gain_dbi,
            rx_sensitivity, max_dist, gsd_meters
        );
    }));

}
