import { describe, it, expect } from "vitest";
import {
  calculateFSPL,
  calculateFresnelRadius,
  calculateOkumuraHata,
  analyzeLinkProfile,
  calculateLinkBudget,
  calculateBullingtonDiffraction
} from "../rfMath";
import { RF_CONSTANTS } from "../rfConstants";

describe("RF Math Functions", () => {
  describe("calculateFSPL", () => {
    it("should calculate free space path loss correctly", () => {
      // 915MHz, 10km
      const fspl = calculateFSPL(10, 915);
      // Expected: 20*log10(10) + 20*log10(915) + 32.44 = 20 + 59.23 + 32.44 = 111.67
      expect(fspl).toBeCloseTo(111.67, 1);
    });

    it("should return 0 for zero distance", () => {
      expect(calculateFSPL(0, 915)).toBe(0);
    });
  });

  describe("calculateFresnelRadius", () => {
    it("should calculate first Fresnel zone radius at midpoint", () => {
      // 915MHz, 10km distance
      const radius = calculateFresnelRadius(10, 915);
      // r = 17.32 * sqrt((5 * 5) / (0.915 * 10)) = 17.32 * sqrt(25 / 9.15) = 17.32 * 1.65 = 28.58
      expect(radius).toBeCloseTo(28.58, 1);
    });
  });

  describe("calculateOkumuraHata", () => {
    it("should fallback to FSPL for very short distances", () => {
      const hata = calculateOkumuraHata(0.05, 915, 30, 2, "suburban");
      const fspl = calculateFSPL(0.05, 915);
      expect(hata).toBeCloseTo(fspl, 1);
    });

    it("should apply environmental corrections", () => {
      const urban = calculateOkumuraHata(5, 915, 30, 2, "urban_large");
      const rural = calculateOkumuraHata(5, 915, 30, 2, "rural");
      expect(rural).toBeLessThan(urban);
    });
  });

  describe("analyzeLinkProfile", () => {
    it("should detect obstruction when terrain blocks LOS", () => {
      const profile = [
        { distance: 0, elevation: 100 },
        { distance: 5, elevation: 200 }, // Hill higher than LOS
        { distance: 10, elevation: 100 },
      ];

      // LOS at 5km would be (100+10)/2 = 55 + base? 
      // Actually LOS height = txH + (rxH - txH) * ratio
      // If txHeightAGL=10, rxHeightAGL=10, txH=110, rxH=110, LOS=110 at all points.
      // Profile elevation 200 > 110, so blocked.
      const result = analyzeLinkProfile(profile, 915, 10, 10);
      expect(result.isObstructed).toBe(true);
      expect(result.linkQuality).toContain("Obstructed");
    });
  });

  describe("calculateLinkBudget", () => {
    it("should subtract default fade margin (10dB) from RSSI", () => {
      // params: txPower=20, txGain=0, txLoss=0, rxGain=0, rxLoss=0, distanceKm=1, freqMHz=915, sf=7, bw=125
      // FSPL(1km, 915MHz) approx 91.7 dB (based on 32.44 const)
      // RSSI = 20 - 91.7 - 10 (fade) = -81.7
      const result = calculateLinkBudget({
        txPower: 20, txGain: 0, txLoss: 0, 
        rxGain: 0, rxLoss: 0, 
        distanceKm: 1, freqMHz: 915, 
        sf: 7, bw: 125 
      });
      // FSPL calc: 20log(1) + 20log(915) + 32.44 = 0 + 59.229 + 32.44 = 91.669
      // RSSI = 20 - 91.67 - 10 = -81.67
      expect(result.rssi).toBeCloseTo(-81.67, 1);
    });

    it("should use custom fade margin", () => {
      const result = calculateLinkBudget({
        txPower: 20, txGain: 0, txLoss: 0, 
        rxGain: 0, rxLoss: 0, 
        distanceKm: 1, freqMHz: 915, 
        sf: 7, bw: 125,
        fadeMargin: 5
      });
      // RSSI = 20 - 91.67 - 5 = -76.67
      expect(result.rssi).toBeCloseTo(-76.67, 1);
    });
  });

  describe("calculateBullingtonDiffraction", () => {
    it("should apply correct loss for grazing incidence (v=0)", () => {
      // profile needs at least 3 points. 
      // To get v=0, obstacle tip must be exactly on LOS line.
      // Simple case: Flat earth (bulge=0 implied or handled manually in mock), 
      // Start (0,0), End (10,0). Midpoint (5,0). 
      // If we pass profile where 'elevation' places tip on LOS line.
      // But calculateBullingtonDiffraction adds earthBulge internally if we aren't careful?
      // "rfMath.js usually calculates earthBulge separately."
      // In the function: "const effectiveH = pt.elevation + bulge;"
      // So to test pure v=0, we need to counter-act bulge or use very short distance where bulge is negligible.
      // dist=0.1km. Bulge ~ 0. Wait, strict v check is better done by mocking the math or carefully constructing profile.
      
      // Let's create a scenario where we force v=0 by geometric construction accounting for bulge logic.
      // Or relies on the fact that short distance has tiny bulge.
      // 1km link. Midpoint 0.5km. Bulge = (0.5*0.5)/(2*4/3*6371) = 0.25 / 17000 ~ 0 meters.
      // So v=0 requires obstacle height = txHeight (if flat).
      // txH=10, rxH=10. LOS=10. Obstacle=10.
      
      const profile = [
        { distance: 0, elevation: 0 },
        { distance: 0.5, elevation: 10 }, // Obstacle at LOS level
        { distance: 1, elevation: 0 }
      ];
      // txHeightAGL=10, rxHeightAGL=10.
      // Absolute heights: Tx=10, Rx=10. LOS at 0.5km is 10m.
      // Obstacle ground=10. Effective = 10 + 0(bulge) = 10.
      // h = 10 - 10 = 0.
      // v = 0 * sqrt(...) = 0.
      
      const loss = calculateBullingtonDiffraction(profile, 915, 10, 10);
      // Expected: ~6.03 dB
      expect(loss).toBeCloseTo(6.03, 1);
    });

    it("should return loss for v = -0.75 (new threshold check)", () => {
      // We need v = -0.75.
      // v = h * sqrt(...) 
      // sqrt term is positive. So h must be negative (clearance).
      // If we set up existing geometry, we can tweak elevation to get h.
      
      // Let's use a known v value test if possible, determining h backswards is tricky without calc.
      // Instead, we trust the function logic and just check a case that WAS 0 and IS NOW > 0.
      // v = -0.75 is the key.
      // If we set obstacle low enough to be clearly below LOS but not "-infinitely".
      
      // Actually, constructing exact geometry is hard. 
      // But we know the code change: if (maxV > -0.78).
      // We can try to feed a "fake" profile object? 
      // No, function computes v from profile.
      
      // Let's try a case. 10km link. 915MHz => lambda ~ 0.328m.
      // Midpoint: d1=5000, d2=5000.
      // sqrt( 2(10000) / (0.328 * 25000000) ) = sqrt( 20000 / 8,200,000 ) = sqrt(0.00244) = 0.049.
      // v = h * 0.049.
      // We want v = -0.75.
      // h = -0.75 / 0.049 = -15.3 meters.
      // So obstacle should be 15.3m BELOW the LOS line.
      
      // Tx=100m, Rx=100m. LOS=100m.
      // Obstacle elevation = 100 - 15.3 = 84.7m.
      // (Ignoring bulge for simplicity or calculating it).
      // Bulge at 5km (10km link): (5*5)/(2*8500) = 25/17000 ~ 0.001km = 1.5m.
      // So effective elevation = Elevation + 1.5.
      // We want Effective = 84.7.
      // Elevation = 83.2.
      
      const profile = [
        { distance: 0, elevation: 0 },
        { distance: 5, elevation: 83.2 }, 
        { distance: 10, elevation: 0 }
      ];
      
      // Tx=100, Rx=100.
      const loss = calculateBullingtonDiffraction(profile, 915, 100, 100);
      
      // Old code (v > -0.7): v is approx -0.75. -0.75 is NOT > -0.7. Result 0.
      // New code (v > -0.78): -0.75 IS > -0.78. Result > 0.
      expect(loss).toBeGreaterThan(0.1); 
    });
  });
});

