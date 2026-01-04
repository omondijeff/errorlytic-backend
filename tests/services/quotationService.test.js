const request = require("supertest");
const app = require("../testServer");
const User = require("../../models/User");
const Organization = require("../../models/Organization");
const Vehicle = require("../../models/Vehicle");
const Upload = require("../../models/Upload");
const Analysis = require("../../models/Analysis");
const Walkthrough = require("../../models/Walkthrough");
const Quotation = require("../../models/Quotation");
const quotationService = require("../../services/quotationService");

describe("Quotation Service", () => {
  let testUser;
  let testOrg;
  let testVehicle;
  let testUpload;
  let testAnalysis;
  let testWalkthrough;

  beforeAll(async () => {
    // Create test organization
    testOrg = new Organization({
      type: "garage",
      name: "Test Garage",
      country: "Kenya",
      currency: "KES",
      settings: {
        timezone: "Africa/Nairobi",
        laborRate: 2500,
        markupPercentage: 15,
        taxPercentage: 16,
      },
    });
    await testOrg.save();

    // Create test user
    testUser = new User({
      email: `test${Date.now()}@example.com`,
      passwordHash: "hashedpassword123",
      profile: {
        name: "Test User",
      },
      role: "garage_user",
      orgId: testOrg._id,
    });
    await testUser.save();

    // Create test vehicle
    testVehicle = new Vehicle({
      orgId: testOrg._id,
      ownerUserId: testUser._id,
      make: "VW",
      model: "Golf",
      year: 2020,
      vin: "WVWZZZ1JZYW123456",
      plate: "KCA 123A",
    });
    await testVehicle.save();

    // Create test upload
    testUpload = new Upload({
      orgId: testOrg._id,
      userId: testUser._id,
      vehicleId: testVehicle._id,
      storage: {
        bucket: "test-bucket",
        key: "test-file.txt",
        size: 1024,
        mime: "text/plain",
      },
      status: "uploaded",
      meta: {
        source: "VCDS",
        format: "TXT",
        originalName: "test-report.txt",
      },
    });
    await testUpload.save();

    // Create test analysis
    testAnalysis = new Analysis({
      orgId: testOrg._id,
      userId: testUser._id,
      vehicleId: testVehicle._id,
      uploadId: testUpload._id,
      dtcs: [
        {
          code: "P0300",
          description: "Random/Multiple Cylinder Misfire Detected",
          status: "active",
        },
      ],
      summary: {
        overview: "Found 1 error code",
        severity: "critical",
      },
      causes: ["Engine"],
      recommendations: ["Check ignition system"],
      module: "Engine",
      aiEnrichment: {
        enabled: true,
        confidence: 0.8,
        provider: "openai",
      },
    });
    await testAnalysis.save();

    // Create test walkthrough
    testWalkthrough = new Walkthrough({
      analysisId: testAnalysis._id,
      steps: [
        {
          title: "Check ignition system",
          detail: "Inspect spark plugs and coils",
          type: "check",
          estMinutes: 30,
          order: 1,
        },
        {
          title: "Replace faulty components",
          detail: "Replace damaged spark plugs",
          type: "replace",
          estMinutes: 45,
          order: 2,
        },
      ],
      parts: [
        {
          name: "Spark Plugs",
          oem: "NGK BKR6E",
          alt: ["Bosch FR7DPP"],
          qty: 4,
          estimatedCost: 2500,
        },
        {
          name: "Ignition Coil",
          oem: "VW 06H905115",
          alt: ["Bosch 0221604001"],
          qty: 1,
          estimatedCost: 8500,
        },
      ],
      tools: ["Spark plug socket", "Torque wrench"],
      difficulty: "medium",
    });
    await testWalkthrough.save();
  });

  afterEach(async () => {
    await Quotation.deleteMany({});
    // Don't delete analysis here as some tests need it
  });

  afterAll(async () => {
    await Quotation.deleteMany({});
    await Walkthrough.deleteMany({});
    await Analysis.deleteMany({});
    await Upload.deleteMany({});
    await Vehicle.deleteMany({});
    await User.deleteMany({});
    await Organization.deleteMany({});
  });

  describe("generateQuotation", () => {
    it("should generate quotation successfully", async () => {
      const options = {
        currency: "KES",
        laborRate: 2500,
        markupPct: 15,
        taxPct: 16,
        useOEMParts: false,
        notes: "Test quotation",
      };

      const result = await quotationService.generateQuotation(
        testAnalysis._id.toString(),
        options,
        testUser._id.toString(),
        testOrg._id.toString()
      );

      expect(result.success).toBe(true);
      expect(result.quotation).toBeDefined();
      expect(result.quotation.currency).toBe("KES");
      expect(result.quotation.labor.hours).toBeGreaterThan(0);
      expect(result.quotation.parts.length).toBeGreaterThan(0);
      expect(result.quotation.totals.grand).toBeGreaterThan(0);
      expect(result.quotation.status).toBe("draft");

      // Verify quotation was saved to database
      const savedQuotation = await Quotation.findById(result.quotation._id);
      expect(savedQuotation).toBeDefined();
      expect(savedQuotation.parts.length).toBe(2);
    });

    it("should handle analysis not found", async () => {
      await expect(
        quotationService.generateQuotation(
          "507f1f77bcf86cd799439011", // Non-existent ID
          {},
          testUser._id.toString(),
          testOrg._id.toString()
        )
      ).rejects.toThrow("Analysis not found");
    });

    it("should handle walkthrough not found", async () => {
      // Create analysis without walkthrough
      const analysisWithoutWalkthrough = new Analysis({
        orgId: testOrg._id,
        userId: testUser._id,
        vehicleId: testVehicle._id,
        uploadId: testUpload._id,
        dtcs: [
          {
            code: "P0300",
            description: "Random/Multiple Cylinder Misfire Detected",
            status: "active",
          },
        ],
        summary: {
          overview: "Found 1 error code",
          severity: "critical",
        },
        causes: ["Engine"],
        recommendations: ["Check ignition system"],
        module: "Engine",
      });
      await analysisWithoutWalkthrough.save();

      await expect(
        quotationService.generateQuotation(
          analysisWithoutWalkthrough._id.toString(),
          {},
          testUser._id.toString(),
          testOrg._id.toString()
        )
      ).rejects.toThrow(
        "Walkthrough not found. Please generate walkthrough first."
      );
    });

    it("should convert currency correctly", async () => {
      // Create a fresh organization for this test
      const currencyOrg = new Organization({
        type: "garage",
        name: "Currency Test Garage",
        country: "Kenya",
        currency: "KES",
        settings: {
          timezone: "Africa/Nairobi",
          laborRate: 2500,
          markupPercentage: 15,
          taxPercentage: 16,
        },
      });
      await currencyOrg.save();

      // Create a fresh analysis for this test
      const currencyAnalysis = new Analysis({
        orgId: currencyOrg._id,
        userId: testUser._id,
        vehicleId: testVehicle._id,
        uploadId: testUpload._id,
        dtcs: [
          {
            code: "P0300",
            description: "Random/Multiple Cylinder Misfire Detected",
            status: "active",
          },
        ],
        summary: {
          overview: "Found 1 error code",
          severity: "critical",
        },
        causes: ["Engine"],
        recommendations: ["Check ignition system"],
        module: "Engine",
        aiEnrichment: {
          enabled: true,
          confidence: 0.8,
          provider: "openai",
        },
      });
      await currencyAnalysis.save();

      // Create walkthrough for this analysis
      const currencyWalkthrough = new Walkthrough({
        analysisId: currencyAnalysis._id,
        steps: [
          {
            title: "Check ignition system",
            detail: "Inspect spark plugs and coils",
            type: "check",
            estMinutes: 30,
            order: 1,
          },
        ],
        parts: [
          {
            name: "Spark Plugs",
            oem: "NGK BKR6E",
            alt: ["Bosch FR7DPP"],
            qty: 4,
            estimatedCost: 2500,
          },
        ],
        tools: ["Spark plug socket"],
        difficulty: "medium",
      });
      await currencyWalkthrough.save();

      const options = {
        currency: "USD",
        laborRate: 16.75, // USD rate
        markupPct: 15,
        taxPct: 16,
        useOEMParts: false,
      };

      const result = await quotationService.generateQuotation(
        currencyAnalysis._id.toString(),
        options,
        testUser._id.toString(),
        currencyOrg._id.toString()
      );

      expect(result.success).toBe(true);
      expect(result.quotation.currency).toBe("USD");
      expect(result.quotation.labor.ratePerHour).toBe(16.75);
    });
  });

  describe("getQuotation", () => {
    let testQuotation;

    beforeEach(async () => {
      testQuotation = new Quotation({
        orgId: testOrg._id,
        analysisId: testAnalysis._id,
        currency: "KES",
        labor: {
          hours: 2,
          ratePerHour: 2500,
          subtotal: 5000,
        },
        parts: [
          {
            name: "Spark Plugs",
            unitPrice: 2500,
            qty: 4,
            subtotal: 10000,
            partNumber: "NGK BKR6E",
            isOEM: true,
          },
        ],
        taxPct: 16,
        markupPct: 15,
        totals: {
          parts: 10000,
          labor: 5000,
          tax: 2400,
          grand: 17400,
        },
        status: "draft",
      });
      await testQuotation.save();
    });

    it("should get quotation successfully", async () => {
      const result = await quotationService.getQuotation(
        testQuotation._id.toString(),
        testUser._id.toString(),
        testOrg._id.toString()
      );

      expect(result.success).toBe(true);
      expect(result.quotation._id.toString()).toBe(
        testQuotation._id.toString()
      );
      expect(result.quotation.currency).toBe("KES");
      expect(result.quotation.totals.grand).toBeGreaterThan(0);
    });

    it("should handle quotation not found", async () => {
      await expect(
        quotationService.getQuotation(
          "507f1f77bcf86cd799439011", // Non-existent ID
          testUser._id.toString(),
          testOrg._id.toString()
        )
      ).rejects.toThrow("Quotation not found");
    });
  });

  describe("updateQuotation", () => {
    let testQuotation;

    beforeEach(async () => {
      testQuotation = new Quotation({
        orgId: testOrg._id,
        analysisId: testAnalysis._id,
        currency: "KES",
        labor: {
          hours: 2,
          ratePerHour: 2500,
          subtotal: 5000,
        },
        parts: [
          {
            name: "Spark Plugs",
            unitPrice: 2500,
            qty: 4,
            subtotal: 10000,
            partNumber: "NGK BKR6E",
            isOEM: true,
          },
        ],
        taxPct: 16,
        markupPct: 15,
        totals: {
          parts: 10000,
          labor: 5000,
          tax: 2400,
          grand: 17400,
        },
        status: "draft",
      });
      await testQuotation.save();
    });

    it("should update quotation successfully", async () => {
      const updates = {
        notes: "Updated quotation notes",
        markupPct: 20,
      };

      const result = await quotationService.updateQuotation(
        testQuotation._id.toString(),
        updates,
        testUser._id.toString(),
        testOrg._id.toString()
      );

      expect(result.success).toBe(true);
      expect(result.quotation.notes).toBe("Updated quotation notes");
      expect(result.quotation.markupPct).toBe(20);
    });

    it("should handle quotation not found", async () => {
      await expect(
        quotationService.updateQuotation(
          "507f1f77bcf86cd799439011", // Non-existent ID
          { notes: "Test" },
          testUser._id.toString(),
          testOrg._id.toString()
        )
      ).rejects.toThrow("Quotation not found");
    });
  });

  describe("updateQuotationStatus", () => {
    let testQuotation;

    beforeEach(async () => {
      testQuotation = new Quotation({
        orgId: testOrg._id,
        analysisId: testAnalysis._id,
        currency: "KES",
        labor: {
          hours: 2,
          ratePerHour: 2500,
          subtotal: 5000,
        },
        parts: [
          {
            name: "Spark Plugs",
            unitPrice: 2500,
            qty: 4,
            subtotal: 10000,
            partNumber: "NGK BKR6E",
            isOEM: true,
          },
        ],
        taxPct: 16,
        markupPct: 15,
        totals: {
          parts: 10000,
          labor: 5000,
          tax: 2400,
          grand: 17400,
        },
        status: "draft",
      });
      await testQuotation.save();
    });

    it("should update quotation status successfully", async () => {
      const result = await quotationService.updateQuotationStatus(
        testQuotation._id.toString(),
        "sent",
        testUser._id.toString(),
        testOrg._id.toString()
      );

      expect(result.success).toBe(true);
      expect(result.quotation.status).toBe("sent");
    });

    it("should handle quotation not found", async () => {
      await expect(
        quotationService.updateQuotationStatus(
          "507f1f77bcf86cd799439011", // Non-existent ID
          "sent",
          testUser._id.toString(),
          testOrg._id.toString()
        )
      ).rejects.toThrow("Quotation not found");
    });
  });

  describe("generateShareLink", () => {
    let testQuotation;

    beforeEach(async () => {
      testQuotation = new Quotation({
        orgId: testOrg._id,
        analysisId: testAnalysis._id,
        currency: "KES",
        labor: {
          hours: 2,
          ratePerHour: 2500,
          subtotal: 5000,
        },
        parts: [
          {
            name: "Spark Plugs",
            unitPrice: 2500,
            qty: 4,
            subtotal: 10000,
            partNumber: "NGK BKR6E",
            isOEM: true,
          },
        ],
        taxPct: 16,
        markupPct: 15,
        totals: {
          parts: 10000,
          labor: 5000,
          tax: 2400,
          grand: 17400,
        },
        status: "draft",
      });
      await testQuotation.save();
    });

    it("should generate share link successfully", async () => {
      const result = await quotationService.generateShareLink(
        testQuotation._id.toString(),
        testUser._id.toString(),
        testOrg._id.toString()
      );

      expect(result.success).toBe(true);
      expect(result.shareLinkId).toBeDefined();
      expect(result.shareUrl).toBeDefined();
      expect(result.shareLinkId).toHaveLength(32); // 16 bytes = 32 hex chars

      // Verify share link was saved to quotation
      const updatedQuotation = await Quotation.findById(testQuotation._id);
      expect(updatedQuotation.shareLinkId).toBe(result.shareLinkId);
    });

    it("should handle quotation not found", async () => {
      await expect(
        quotationService.generateShareLink(
          "507f1f77bcf86cd799439011", // Non-existent ID
          testUser._id.toString(),
          testOrg._id.toString()
        )
      ).rejects.toThrow("Quotation not found");
    });
  });

  describe("getQuotationByShareLink", () => {
    let testQuotation;

    beforeEach(async () => {
      testQuotation = new Quotation({
        orgId: testOrg._id,
        analysisId: testAnalysis._id,
        currency: "KES",
        labor: {
          hours: 2,
          ratePerHour: 2500,
          subtotal: 5000,
        },
        parts: [
          {
            name: "Spark Plugs",
            unitPrice: 2500,
            qty: 4,
            subtotal: 10000,
            partNumber: "NGK BKR6E",
            isOEM: true,
          },
        ],
        taxPct: 16,
        markupPct: 15,
        totals: {
          parts: 10000,
          labor: 5000,
          tax: 2400,
          grand: 17400,
        },
        status: "draft",
        shareLinkId: "testsharelink12345678901234567890",
      });
      await testQuotation.save();
    });

    it("should get quotation by share link successfully", async () => {
      const result = await quotationService.getQuotationByShareLink(
        "testsharelink12345678901234567890"
      );

      expect(result.success).toBe(true);
      expect(result.quotation._id.toString()).toBe(
        testQuotation._id.toString()
      );
      expect(result.quotation.shareLinkId).toBe(
        "testsharelink12345678901234567890"
      );
    });

    it("should handle quotation not found", async () => {
      await expect(
        quotationService.getQuotationByShareLink("nonexistentsharelink")
      ).rejects.toThrow("Quotation not found or link expired");
    });
  });

  describe("getQuotations", () => {
    beforeEach(async () => {
      // Create multiple quotations for testing
      const quotations = [
        {
          orgId: testOrg._id,
          analysisId: testAnalysis._id,
          currency: "KES",
          labor: { hours: 2, ratePerHour: 2500, subtotal: 5000 },
          parts: [
            {
              name: "Spark Plugs",
              unitPrice: 2500,
              qty: 4,
              subtotal: 10000,
              partNumber: "NGK BKR6E",
              isOEM: true,
            },
          ],
          taxPct: 16,
          markupPct: 15,
          totals: { parts: 10000, labor: 5000, tax: 2400, grand: 17400 },
          status: "draft",
        },
        {
          orgId: testOrg._id,
          analysisId: testAnalysis._id,
          currency: "USD",
          labor: { hours: 2, ratePerHour: 16.75, subtotal: 33.5 },
          parts: [
            {
              name: "Spark Plugs",
              unitPrice: 16.75,
              qty: 4,
              subtotal: 67,
              partNumber: "NGK BKR6E",
              isOEM: true,
            },
          ],
          taxPct: 16,
          markupPct: 15,
          totals: { parts: 67, labor: 33.5, tax: 16.08, grand: 116.58 },
          status: "sent",
        },
      ];

      await Quotation.insertMany(quotations);
    });

    it("should get quotations with pagination", async () => {
      const result = await quotationService.getQuotations(
        testUser._id.toString(),
        testOrg._id.toString(),
        {},
        1,
        10
      );

      expect(result.success).toBe(true);
      expect(result.quotations.length).toBe(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pages).toBe(1);
    });

    it("should filter quotations by status", async () => {
      const result = await quotationService.getQuotations(
        testUser._id.toString(),
        testOrg._id.toString(),
        { status: "draft" },
        1,
        10
      );

      expect(result.success).toBe(true);
      expect(result.quotations.length).toBe(1);
      expect(result.quotations[0].status).toBe("draft");
    });

    it("should filter quotations by currency", async () => {
      const result = await quotationService.getQuotations(
        testUser._id.toString(),
        testOrg._id.toString(),
        { currency: "USD" },
        1,
        10
      );

      expect(result.success).toBe(true);
      expect(result.quotations.length).toBe(1);
      expect(result.quotations[0].currency).toBe("USD");
    });
  });

  describe("deleteQuotation", () => {
    let testQuotation;

    beforeEach(async () => {
      testQuotation = new Quotation({
        orgId: testOrg._id,
        analysisId: testAnalysis._id,
        currency: "KES",
        labor: {
          hours: 2,
          ratePerHour: 2500,
          subtotal: 5000,
        },
        parts: [
          {
            name: "Spark Plugs",
            unitPrice: 2500,
            qty: 4,
            subtotal: 10000,
            partNumber: "NGK BKR6E",
            isOEM: true,
          },
        ],
        taxPct: 16,
        markupPct: 15,
        totals: {
          parts: 10000,
          labor: 5000,
          tax: 2400,
          grand: 17400,
        },
        status: "draft",
      });
      await testQuotation.save();
    });

    it("should delete quotation successfully", async () => {
      const result = await quotationService.deleteQuotation(
        testQuotation._id.toString(),
        testUser._id.toString(),
        testOrg._id.toString()
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe("Quotation deleted successfully");

      // Verify quotation was deleted
      const deletedQuotation = await Quotation.findById(testQuotation._id);
      expect(deletedQuotation).toBeNull();
    });

    it("should handle quotation not found", async () => {
      await expect(
        quotationService.deleteQuotation(
          "507f1f77bcf86cd799439011", // Non-existent ID
          testUser._id.toString(),
          testOrg._id.toString()
        )
      ).rejects.toThrow("Quotation not found");
    });
  });

  describe("getQuotationStatistics", () => {
    beforeEach(async () => {
      // Create quotations with different statuses
      const quotations = [
        {
          orgId: testOrg._id,
          analysisId: testAnalysis._id,
          currency: "KES",
          labor: { hours: 2, ratePerHour: 2500, subtotal: 5000 },
          parts: [
            {
              name: "Spark Plugs",
              unitPrice: 2500,
              qty: 4,
              subtotal: 10000,
              partNumber: "NGK BKR6E",
              isOEM: true,
            },
          ],
          taxPct: 16,
          markupPct: 15,
          totals: { parts: 10000, labor: 5000, tax: 2400, grand: 17400 },
          status: "draft",
        },
        {
          orgId: testOrg._id,
          analysisId: testAnalysis._id,
          currency: "KES",
          labor: { hours: 2, ratePerHour: 2500, subtotal: 5000 },
          parts: [
            {
              name: "Spark Plugs",
              unitPrice: 2500,
              qty: 4,
              subtotal: 10000,
              partNumber: "NGK BKR6E",
              isOEM: true,
            },
          ],
          taxPct: 16,
          markupPct: 15,
          totals: { parts: 10000, labor: 5000, tax: 2400, grand: 17400 },
          status: "sent",
        },
        {
          orgId: testOrg._id,
          analysisId: testAnalysis._id,
          currency: "KES",
          labor: { hours: 2, ratePerHour: 2500, subtotal: 5000 },
          parts: [
            {
              name: "Spark Plugs",
              unitPrice: 2500,
              qty: 4,
              subtotal: 10000,
              partNumber: "NGK BKR6E",
              isOEM: true,
            },
          ],
          taxPct: 16,
          markupPct: 15,
          totals: { parts: 10000, labor: 5000, tax: 2400, grand: 17400 },
          status: "approved",
        },
      ];

      await Quotation.insertMany(quotations);
    });

    it("should get quotation statistics successfully", async () => {
      const result = await quotationService.getQuotationStatistics(
        testUser._id.toString(),
        testOrg._id.toString()
      );

      expect(result.success).toBe(true);
      expect(result.statistics.totalQuotations).toBe(3);
      expect(result.statistics.draftQuotations).toBe(1);
      expect(result.statistics.sentQuotations).toBe(1);
      expect(result.statistics.approvedQuotations).toBe(1);
      expect(result.statistics.totalValue).toBeGreaterThanOrEqual(0);
      expect(result.statistics.recentQuotations.length).toBe(3);
    });
  });

  describe("currency conversion", () => {
    it("should convert KES to USD correctly", () => {
      const result = quotationService.convertCurrency(15000, "KES", "USD");
      expect(result).toBeCloseTo(100.5, 1); // 15000 KES ≈ 100.5 USD
    });

    it("should convert USD to KES correctly", () => {
      const result = quotationService.convertCurrency(100, "USD", "KES");
      expect(result).toBeCloseTo(14925, 0); // 100 USD ≈ 14925 KES
    });

    it("should handle same currency conversion", () => {
      const result = quotationService.convertCurrency(1000, "KES", "KES");
      expect(result).toBe(1000);
    });
  });

  describe("part pricing", () => {
    it("should get OEM part pricing", () => {
      const result = quotationService.getPartPricing(
        "Spark Plugs",
        "KES",
        true
      );
      expect(result.price).toBe(2500);
      expect(result.currency).toBe("KES");
    });

    it("should get aftermarket part pricing", () => {
      const result = quotationService.getPartPricing(
        "Spark Plugs",
        "KES",
        false
      );
      expect(result.price).toBe(1500);
      expect(result.currency).toBe("KES");
    });

    it("should get default pricing for unknown parts", () => {
      const result = quotationService.getPartPricing(
        "Unknown Part",
        "KES",
        true
      );
      expect(result.price).toBe(5000);
      expect(result.currency).toBe("KES");
    });
  });
});
