import { useMapEvents } from 'react-leaflet';
import { GROUND_TYPES } from '../../../context/RFContext'; 

const CoverageClickHandler = ({ mode, runViewshed, runRFCoverage, setViewshedObserver, setRfObserver, rfContext }) => {
    useMapEvents({
        click(e) {
            if (mode === 'viewshed' || mode === 'rf_coverage') {
                const { lat, lng } = e.latlng;
                
                if (mode === 'viewshed') {
                    // Task 1.4: Use antenna height from context
                    const h = rfContext.getAntennaHeightMeters ? rfContext.getAntennaHeightMeters() : 2.0;
                    setViewshedObserver({ lat, lng, height: h });
                    // Run simple viewshed (25km radius)
                    runViewshed(lat, lng, h, 25000);
                } else if (mode === 'rf_coverage') {
                    // Use helper to get height in meters (handling ft conversion)
                    const h = rfContext.getAntennaHeightMeters ? rfContext.getAntennaHeightMeters() : (rfContext.antennaHeight || 5.0);
                    

                    setRfObserver({ lat, lng, height: h }); // Store processed height in meters

                    // Get actual ground constants
                    const ground = GROUND_TYPES[rfContext.groundType] || GROUND_TYPES['Average Ground'];

                    const rfParams = {
                        freq: rfContext.freq,
                        txPower: rfContext.txPower,
                        txGain: rfContext.antennaGain,
                        txLoss: rfContext.cableLoss || 0, 
                        rxLoss: 0, 
                        rxGain: rfContext.rxAntennaGain || 2.15,
                        rxSensitivity: rfContext.calculateSensitivity ? rfContext.calculateSensitivity() : -126,
                        bw: rfContext.bw,
                        sf: rfContext.sf,
                        cr: rfContext.cr,
                        rxHeight: rfContext.rxHeight,
                        // New Environment Params
                        epsilon: ground.epsilon,
                        sigma: ground.sigma,
                        climate: rfContext.climate
                    };
                    

                    runRFCoverage(lat, lng, h, 25000, rfParams);
                }
            }
        }
    });
    return null;
};

export default CoverageClickHandler;
