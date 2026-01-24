import { describe, it, expect } from "vitest";
import {
  calculateFSPL,
  calculateFresnelRadius,
  calculateOkumuraHata,
  analyzeLinkProfile,
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
});
