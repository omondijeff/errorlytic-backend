const Quotation = require("../../models/Quotation");
const Analysis = require("../../models/Analysis");
const Organization = require("../../models/Organization");

describe("Quotation Model", () => {
  let analysisId;
  let orgId;

  beforeEach(async () => {
    // Create a test organization
    const org = new Organization({
      type: "garage",
      name: "Test Garage",
      country: "Kenya",
      currency: "KES",
    });
    await org.save();
    orgId = org._id;

    // Create a test analysis
    const analysis = new Analysis({
      orgId: orgId,
      userId: "507f1f77bcf86cd799439011", // Mock user ID
      uploadId: "507f1f77bcf86cd799439012", // Mock upload ID
      dtcs: [
        {
          code: "P0299",
          description: "Turbo underboost",
          status: "active",
        },
      ],
      summary: {
        overview: "Turbo system issue detected",
        severity: "critical",
      },
      causes: ["Vacuum leak", "Wastegate issue"],
      recommendations: ["Check vacuum lines", "Inspect wastegate"],
      module: "Engine",
    });
    await analysis.save();
    analysisId = analysis._id;
  });

  describe("Quotation Creation", () => {
    test("should create a quotation with KES currency", async () => {
      const quotationData = {
        orgId: orgId,
        analysisId: analysisId,
        currency: "KES",
        labor: {
          hours: 2.5,
          ratePerHour: 1500,
          subtotal: 3750,
        },
        parts: [
          {
            name: "Boost pressure sensor",
            unitPrice: 6500,
            qty: 1,
            subtotal: 6500,
          },
        ],
        taxPct: 16,
        markupPct: 10,
        totals: {
          parts: 6500,
          labor: 3750,
          tax: 1640,
          grand: 11890,
        },
      };

      const quotation = new Quotation(quotationData);
      await quotation.save();

      expect(quotation.currency).toBe("KES");
      expect(quotation.labor.hours).toBe(2.5);
      expect(quotation.labor.ratePerHour).toBe(1500);
      expect(quotation.parts).toHaveLength(1);
      expect(quotation.parts[0].name).toBe("Boost pressure sensor");
      expect(quotation.taxPct).toBe(16);
      expect(quotation.markupPct).toBe(10);
      expect(quotation.status).toBe("draft");
    });

    test("should create a quotation with UGX currency", async () => {
      const quotationData = {
        orgId: orgId,
        analysisId: analysisId,
        currency: "UGX",
        labor: {
          hours: 3,
          ratePerHour: 50000,
          subtotal: 150000,
        },
        parts: [
          {
            name: "Turbo actuator",
            unitPrice: 200000,
            qty: 1,
            subtotal: 200000,
          },
        ],
        taxPct: 18,
        markupPct: 12,
        totals: {
          parts: 200000,
          labor: 150000,
          tax: 63000,
          grand: 413000,
        },
      };

      const quotation = new Quotation(quotationData);
      await quotation.save();

      expect(quotation.currency).toBe("UGX");
      expect(quotation.labor.hours).toBe(3);
      expect(quotation.labor.ratePerHour).toBe(50000);
      expect(quotation.parts[0].name).toBe("Turbo actuator");
      expect(quotation.taxPct).toBe(18);
      expect(quotation.markupPct).toBe(12);
    });

    test("should validate required fields", async () => {
      const quotationData = {
        // Missing analysisId, currency, labor, parts, taxPct, markupPct, totals
        orgId: orgId,
      };

      const quotation = new Quotation(quotationData);

      await expect(quotation.save()).rejects.toThrow();
    });

    test("should validate currency enum", async () => {
      const quotationData = {
        orgId: orgId,
        analysisId: analysisId,
        currency: "INVALID_CURRENCY",
        labor: {
          hours: 2,
          ratePerHour: 1500,
          subtotal: 3000,
        },
        parts: [],
        taxPct: 16,
        markupPct: 10,
        totals: {
          parts: 0,
          labor: 3000,
          tax: 480,
          grand: 3480,
        },
      };

      const quotation = new Quotation(quotationData);

      await expect(quotation.save()).rejects.toThrow();
    });

    test("should validate status enum", async () => {
      const quotationData = {
        orgId: orgId,
        analysisId: analysisId,
        currency: "KES",
        labor: {
          hours: 2,
          ratePerHour: 1500,
          subtotal: 3000,
        },
        parts: [],
        taxPct: 16,
        markupPct: 10,
        totals: {
          parts: 0,
          labor: 3000,
          tax: 480,
          grand: 3480,
        },
        status: "invalid_status",
      };

      const quotation = new Quotation(quotationData);

      await expect(quotation.save()).rejects.toThrow();
    });
  });

  describe("Total Calculations", () => {
    test("should calculate totals correctly for KES", async () => {
      const quotationData = {
        orgId: orgId,
        analysisId: analysisId,
        currency: "KES",
        labor: {
          hours: 2,
          ratePerHour: 1500,
          subtotal: 3000,
        },
        parts: [
          {
            name: "Sensor A",
            unitPrice: 5000,
            qty: 1,
            subtotal: 5000,
          },
          {
            name: "Sensor B",
            unitPrice: 3000,
            qty: 2,
            subtotal: 6000,
          },
        ],
        taxPct: 16,
        markupPct: 10,
        totals: {
          parts: 11000,
          labor: 3000,
          tax: 2240,
          grand: 16240,
        },
      };

      const quotation = new Quotation(quotationData);
      await quotation.save();

      // Verify calculations
      expect(quotation.totals.parts).toBe(11000); // 5000 + (3000 * 2)
      expect(quotation.totals.labor).toBe(3000); // 2 * 1500

      // Subtotal before markup: 11000 + 3000 = 14000
      // After 10% markup: 14000 * 1.10 = 15400
      // Tax (16%): 15400 * 0.16 = 2464
      // Grand total: 15400 + 2464 = 17864
      expect(quotation.totals.tax).toBeCloseTo(2464, 2);
      expect(quotation.totals.grand).toBeCloseTo(17864, 2);
    });

    test("should calculate totals correctly for UGX", async () => {
      const quotationData = {
        orgId: orgId,
        analysisId: analysisId,
        currency: "UGX",
        labor: {
          hours: 4,
          ratePerHour: 50000,
          subtotal: 200000,
        },
        parts: [
          {
            name: "Expensive Part",
            unitPrice: 500000,
            qty: 1,
            subtotal: 500000,
          },
        ],
        taxPct: 18,
        markupPct: 15,
        totals: {
          parts: 500000,
          labor: 200000,
          tax: 126000,
          grand: 826000,
        },
      };

      const quotation = new Quotation(quotationData);
      await quotation.save();

      // Verify calculations
      expect(quotation.totals.parts).toBe(500000);
      expect(quotation.totals.labor).toBe(200000);

      // Subtotal before markup: 500000 + 200000 = 700000
      // After 15% markup: 700000 * 1.15 = 805000
      // Tax (18%): 805000 * 0.18 = 144900
      // Grand total: 805000 + 144900 = 949900
      expect(quotation.totals.tax).toBeCloseTo(144900, 2);
      expect(quotation.totals.grand).toBeCloseTo(949900, 2);
    });

    test("should handle zero parts correctly", async () => {
      const quotationData = {
        orgId: orgId,
        analysisId: analysisId,
        currency: "KES",
        labor: {
          hours: 1,
          ratePerHour: 2000,
          subtotal: 2000,
        },
        parts: [],
        taxPct: 16,
        markupPct: 10,
        totals: {
          parts: 0,
          labor: 2000,
          tax: 352,
          grand: 2352,
        },
      };

      const quotation = new Quotation(quotationData);
      await quotation.save();

      expect(quotation.totals.parts).toBe(0);
      expect(quotation.totals.labor).toBe(2000);

      // Subtotal before markup: 0 + 2000 = 2000
      // After 10% markup: 2000 * 1.10 = 2200
      // Tax (16%): 2200 * 0.16 = 352
      // Grand total: 2200 + 352 = 2552
      expect(quotation.totals.tax).toBe(352);
      expect(quotation.totals.grand).toBe(2552);
    });
  });

  describe("Parts Validation", () => {
    test("should validate parts have required fields", async () => {
      const quotationData = {
        orgId: orgId,
        analysisId: analysisId,
        currency: "KES",
        labor: {
          hours: 1,
          ratePerHour: 1500,
          subtotal: 1500,
        },
        parts: [
          {
            // Missing name, unitPrice, qty, subtotal
            partNumber: "ABC123",
          },
        ],
        taxPct: 16,
        markupPct: 10,
        totals: {
          parts: 0,
          labor: 1500,
          tax: 264,
          grand: 1764,
        },
      };

      const quotation = new Quotation(quotationData);

      await expect(quotation.save()).rejects.toThrow();
    });

    test("should validate part quantities are positive", async () => {
      const quotationData = {
        orgId: orgId,
        analysisId: analysisId,
        currency: "KES",
        labor: {
          hours: 1,
          ratePerHour: 1500,
          subtotal: 1500,
        },
        parts: [
          {
            name: "Test Part",
            unitPrice: 1000,
            qty: 0, // Invalid quantity
            subtotal: 0,
          },
        ],
        taxPct: 16,
        markupPct: 10,
        totals: {
          parts: 0,
          labor: 1500,
          tax: 264,
          grand: 1764,
        },
      };

      const quotation = new Quotation(quotationData);

      await expect(quotation.save()).rejects.toThrow();
    });
  });
});
