import { useMapEvents } from 'react-leaflet';

const CoverageClickHandler = ({ mode, runViewshed, runRFCoverage, setViewshedObserver, setRfObserver, rfContext }) => {
    useMapEvents({
        click(e) {
            if (mode === 'viewshed' || mode === 'rf_coverage') {
                const { lat, lng } = e.latlng;
                
                if (mode === 'viewshed') {
                    setViewshedObserver({ lat, lng, height: 2.0 });
                    // Run simple viewshed (25km radius)
                    runViewshed(lat, lng, 2.0, 25000);
                } else if (mode === 'rf_coverage') {
                    // Use helper to get height in meters (handling ft conversion)
                    const h = rfContext.getAntennaHeightMeters ? rfContext.getAntennaHeightMeters() : (rfContext.antennaHeight || 5.0);
                    
                    console.log(`[RF Click] Setting Observer: Height=${h.toFixed(2)}m (Raw input: ${rfContext.antennaHeight})`);
                    setRfObserver({ lat, lng, height: h }); // Store processed height in meters

                    const rfParams = {
                        freq: rfContext.freq,
                        txPower: rfContext.txPower,
                        txGain: rfContext.antennaGain,
                        rxGain: 2.15, // Default RX (dipole)
                        rxSensitivity: rfContext.calculateSensitivity ? rfContext.calculateSensitivity() : -126,
                        bw: rfContext.bw,
                        sf: rfContext.sf,
                        cr: rfContext.cr,
                        rxHeight: rfContext.rxHeight
                    };
                    
                    console.log("[RF Click] Running Analysis with Params:", rfParams);
                    runRFCoverage(lat, lng, h, 25000, rfParams);
                }
            }
        }
    });
    return null;
};

export default CoverageClickHandler;
