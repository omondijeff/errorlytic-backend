const pdfService = require("../../services/pdfService");
const Quotation = require("../../models/Quotation");
const Analysis = require("../../models/Analysis");
const Walkthrough = require("../../models/Walkthrough");
const Organization = require("../../models/Organization");
const Vehicle = require("../../models/Vehicle");
const Upload = require("../../models/Upload");
const User = require("../../models/User");

describe("PDF Service", () => {
  let testOrg;
  let testUser;
  let testVehicle;
  let testUpload;
  let testAnalysis;
  let testWalkthrough;
  let testQuotation;

  beforeEach(async () => {
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
      vin: "WVWZZZ1JZ2W386752",
      make: "VW",
      model: "Golf",
      year: 2018,
      engineType: "1.4 TSI",
      orgId: testOrg._id,
      ownerUserId: testUser._id,
    });
    await testVehicle.save();

    // Create test upload
    testUpload = new Upload({
      orgId: testOrg._id,
      userId: testUser._id,
      vehicleId: testVehicle._id,
      storage: {
        bucket: "test-bucket",
        key: "test-vcds.txt",
        size: 1024,
        mime: "text/plain",
      },
      status: "parsed",
      meta: {
        source: "VCDS",
        format: "TXT",
        originalName: "test-vcds.txt",
      },
      parseResult: {
        dtcs: [
          {
            code: "P0300",
            description: "Random/Multiple Cylinder Misfire Detected",
            status: "active",
          },
        ],
        rawContent: "Test VCDS content",
        parseErrors: [],
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
          title: "Replace spark plugs",
          detail: "Remove old spark plugs and install new ones",
          type: "replace",
          estMinutes: 45,
          order: 2,
        },
        {
          title: "Test engine",
          detail: "Start engine and verify no misfire",
          type: "retest",
          estMinutes: 15,
          order: 3,
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
      tools: ["Spark plug socket", "Torque wrench"],
      difficulty: "medium",
    });
    await testWalkthrough.save();

    // Create test quotation
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
        tax: 2464,
        grand: 18964,
      },
      status: "draft",
      notes: "This quotation includes all necessary parts and labor for the repair.",
    });
    await testQuotation.save();
  });

  describe("generateQuotationPDF", () => {
    it("should generate quotation HTML successfully", async () => {
      const result = await pdfService.generateQuotationPDF(
        testQuotation,
        testOrg,
        testAnalysis,
        testWalkthrough
      );

      expect(result.success).toBe(true);
      expect(result.html).toBeDefined();
      expect(result.filename).toContain("quotation_");
      expect(result.html).toContain("Test Garage");
      expect(result.html).toContain("KSh 20,010");
      expect(result.html).toContain("P0300");
      expect(result.html).toContain("Spark Plugs");
    });

    it("should handle quotation without walkthrough", async () => {
      const result = await pdfService.generateQuotationPDF(
        testQuotation,
        testOrg,
        testAnalysis,
        null
      );

      expect(result.success).toBe(true);
      expect(result.html).toBeDefined();
      expect(result.html).toContain("Test Garage");
    });

    it("should format currency correctly", async () => {
      const result = await pdfService.generateQuotationPDF(
        testQuotation,
        testOrg,
        testAnalysis,
        testWalkthrough
      );

      expect(result.html).toContain("KSh 20,010");
      expect(result.html).toContain("KSh 10,000");
      expect(result.html).toContain("KSh 5,000");
    });

    it("should include all quotation details", async () => {
      const result = await pdfService.generateQuotationPDF(
        testQuotation,
        testOrg,
        testAnalysis,
        testWalkthrough
      );

      expect(result.html).toContain("Quotation #");
      expect(result.html).toContain("draft");
      expect(result.html).toContain("KES");
      expect(result.html).toContain("N/A");
      expect(result.html).toContain("P0300");
      expect(result.html).toContain("NGK BKR6E");
      expect(result.html).toContain("This quotation includes");
    });
  });

  describe("generateWalkthroughPDF", () => {
    it("should generate walkthrough HTML successfully", async () => {
      const result = await pdfService.generateWalkthroughPDF(
        testWalkthrough,
        testAnalysis,
        testOrg
      );

      expect(result.success).toBe(true);
      expect(result.html).toBeDefined();
      expect(result.filename).toContain("walkthrough_");
      expect(result.html).toContain("Repair Walkthrough");
      expect(result.html).toContain("Check ignition system");
      expect(result.html).toContain("Replace spark plugs");
      expect(result.html).toContain("Test engine");
    });

    it("should include all walkthrough details", async () => {
      const result = await pdfService.generateWalkthroughPDF(
        testWalkthrough,
        testAnalysis,
        testOrg
      );

      expect(result.html).toContain("medium");
      expect(result.html).toContain("1h 30m");
      expect(result.html).toContain("Steps:</strong> 3");
      expect(result.html).toContain("Spark Plugs");
      expect(result.html).toContain("NGK BKR6E");
      expect(result.html).toContain("Spark plug socket");
      expect(result.html).toContain("Torque wrench");
    });

    it("should format time correctly", async () => {
      const result = await pdfService.generateWalkthroughPDF(
        testWalkthrough,
        testAnalysis,
        testOrg
      );

      expect(result.html).toContain("30 minutes");
      expect(result.html).toContain("45 minutes");
      expect(result.html).toContain("15 minutes");
      expect(result.html).toContain("1h 30m");
    });

    it("should include step types and order", async () => {
      const result = await pdfService.generateWalkthroughPDF(
        testWalkthrough,
        testAnalysis,
        testOrg
      );

      expect(result.html).toContain("check");
      expect(result.html).toContain("replace");
      expect(result.html).toContain("retest");
      expect(result.html).toContain("1");
      expect(result.html).toContain("2");
      expect(result.html).toContain("3");
    });
  });

  describe("saveHTMLToFile", () => {
    it("should save HTML to file successfully", async () => {
      const html = "<html><body>Test HTML</body></html>";
      const filename = "test.html";

      const filePath = await pdfService.saveHTMLToFile(html, filename);

      expect(filePath).toContain("test.html");
      expect(filePath).toContain("templates");
    });
  });
});
