// Actually, since the project uses ES modules (export const), simple node execution might fail without package.json "type": "module" or .mjs extension.
// I will create it as .mjs

import { calculateBullingtonDiffraction, calculateLinkBudget } from '../src/utils/rfMath.js';

// Mock Profile: 10km link, Hill at 5km, 100m high.
// Start/End at 0m elevation + 10m/10m antenna
const profile = [];
const steps = 100;
const totalDist = 10; // km
for (let i = 0; i <= steps; i++) {
    const d = (i / steps) * totalDist;
    let elevation = 0;
    
    // Gaussian hill at 5km
    const peak = 5;
    const width = 1;
    elevation = 100 * Math.exp(-Math.pow(d - peak, 2) / (2 * Math.pow(width, 2)));

    // Add some random terrain noise
    elevation += Math.random() * 2;

    profile.push({
        distance: d, // km
        elevation: elevation // m
    });
}

const freq = 915; // MHz
const txHeight = 10; // m
const rxHeight = 10; // m

console.log("Running Bullington Diffraction Test...");
const loss = calculateBullingtonDiffraction(profile, freq, txHeight, rxHeight);
console.log(`Calculated Diffraction Loss: ${loss} dB`);

if (loss > 10) {
    console.log("PASS: Significant loss detected for obstruction.");
} else {
    console.log("FAIL: Loss too low for 100m hill obstruction.");
}

const budget = calculateLinkBudget({
    txPower: 20,
    txGain: 5,
    txLoss: 1,
    rxGain: 5,
    rxLoss: 1,
    distanceKm: 10,
    freqMHz: 915,
    sf: 7,
    bw: 125,
    excessLoss: loss
});

console.log("Link Budget with Diffraction:");
console.log(`RSSI: ${budget.rssi} dBm`);
console.log(`Margin: ${budget.margin} dB`);

if (budget.margin < 0) {
     console.log("PASS: Margin is negative as expected for obstructed link.");
} else {
     console.log("FAIL: Margin is still positive?");
}
