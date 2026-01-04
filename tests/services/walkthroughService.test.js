const request = require("supertest");
const app = require("../testServer");
const User = require("../../models/User");
const Organization = require("../../models/Organization");
const Vehicle = require("../../models/Vehicle");
const Upload = require("../../models/Upload");
const Analysis = require("../../models/Analysis");
const Walkthrough = require("../../models/Walkthrough");
const walkthroughService = require("../../services/walkthroughService");

describe("Walkthrough Service", () => {
  let testUser;
  let testOrg;
  let testVehicle;
  let testUpload;
  let testAnalysis;

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
        {
          code: "P0171",
          description: "System Too Lean (Bank 1)",
          status: "active",
        },
      ],
      summary: {
        overview: "Found 2 error codes",
        severity: "critical",
      },
      causes: ["Engine", "Fuel System"],
      recommendations: ["Check ignition system", "Inspect fuel system"],
      module: "Engine",
      aiEnrichment: {
        enabled: true,
        confidence: 0.8,
        provider: "openai",
      },
    });
    await testAnalysis.save();
  });

  afterEach(async () => {
    await Walkthrough.deleteMany({});
    // Don't delete analysis here as some tests need it
  });

  afterAll(async () => {
    await Walkthrough.deleteMany({});
    await Analysis.deleteMany({});
    await Upload.deleteMany({});
    await Vehicle.deleteMany({});
    await User.deleteMany({});
    await Organization.deleteMany({});
  });

  describe("generateWalkthrough", () => {
    it("should generate walkthrough successfully", async () => {
      const result = await walkthroughService.generateWalkthrough(
        testAnalysis._id.toString(),
        testUser._id.toString(),
        testOrg._id.toString()
      );

      expect(result.success).toBe(true);
      expect(result.walkthrough).toBeDefined();
      expect(result.walkthrough.steps.length).toBeGreaterThan(0);
      expect(result.walkthrough.parts.length).toBeGreaterThan(0);
      expect(result.walkthrough.tools.length).toBeGreaterThan(0);
      expect(result.walkthrough.difficulty).toBeDefined();
      expect(result.walkthrough.totalEstimatedTime).toBeGreaterThan(0);

      // Verify walkthrough was saved to database
      const savedWalkthrough = await Walkthrough.findById(result.walkthrough._id);
      expect(savedWalkthrough).toBeDefined();
      expect(savedWalkthrough.steps.length).toBeGreaterThan(0);
    });

    it("should handle analysis not found", async () => {
      await expect(
        walkthroughService.generateWalkthrough(
          "507f1f77bcf86cd799439011", // Non-existent ID
          testUser._id.toString(),
          testOrg._id.toString()
        )
      ).rejects.toThrow("Analysis not found");
    });

    it("should not create duplicate walkthrough", async () => {
      // Create a fresh analysis for this test
      const duplicateAnalysis = new Analysis({
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
      await duplicateAnalysis.save();

      // Generate first walkthrough
      const result1 = await walkthroughService.generateWalkthrough(
        duplicateAnalysis._id.toString(),
        testUser._id.toString(),
        testOrg._id.toString()
      );

      // Try to generate second walkthrough
      const result2 = await walkthroughService.generateWalkthrough(
        duplicateAnalysis._id.toString(),
        testUser._id.toString(),
        testOrg._id.toString()
      );

      expect(result2.success).toBe(true);
      expect(result2.message).toBe("Walkthrough already exists");
      expect(result2.walkthrough._id.toString()).toBe(result1.walkthrough._id.toString());
    });
  });

  describe("getWalkthrough", () => {
    let testWalkthrough;

    beforeEach(async () => {
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
        ],
        tools: ["Spark plug socket", "Torque wrench"],
        difficulty: "medium",
      });
      await testWalkthrough.save();
    });

    it("should get walkthrough successfully", async () => {
      const result = await walkthroughService.getWalkthrough(
        testAnalysis._id.toString(),
        testUser._id.toString(),
        testOrg._id.toString()
      );

      expect(result.success).toBe(true);
      expect(result.walkthrough._id.toString()).toBe(testWalkthrough._id.toString());
      expect(result.walkthrough.steps.length).toBe(2);
      expect(result.walkthrough.parts.length).toBe(1);
      expect(result.walkthrough.tools.length).toBe(2);
    });

    it("should handle walkthrough not found", async () => {
      await expect(
        walkthroughService.getWalkthrough(
          "507f1f77bcf86cd799439011", // Non-existent analysis ID
          testUser._id.toString(),
          testOrg._id.toString()
        )
      ).rejects.toThrow("Walkthrough not found");
    });
  });

  describe("updateWalkthrough", () => {
    let testWalkthrough;

    beforeEach(async () => {
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
        ],
        parts: [],
        tools: [],
        difficulty: "medium",
      });
      await testWalkthrough.save();
    });

    it("should update walkthrough successfully", async () => {
      const updatedSteps = [
        {
          title: "Updated step",
          detail: "Updated detail",
          type: "check",
          estMinutes: 20,
          order: 1,
        },
        {
          title: "New step",
          detail: "New detail",
          type: "replace",
          estMinutes: 30,
          order: 2,
        },
      ];

      const result = await walkthroughService.updateWalkthrough(
        testWalkthrough._id.toString(),
        updatedSteps,
        testUser._id.toString(),
        testOrg._id.toString()
      );

      expect(result.success).toBe(true);
      expect(result.walkthrough.steps.length).toBe(2);
      expect(result.walkthrough.steps[0].title).toBe("Updated step");
      expect(result.walkthrough.steps[1].title).toBe("New step");
    });

    it("should handle walkthrough not found", async () => {
      await expect(
        walkthroughService.updateWalkthrough(
          "507f1f77bcf86cd799439011", // Non-existent ID
          [],
          testUser._id.toString(),
          testOrg._id.toString()
        )
      ).rejects.toThrow("Walkthrough not found");
    });
  });

  describe("addStep", () => {
    let testWalkthrough;

    beforeEach(async () => {
      testWalkthrough = new Walkthrough({
        analysisId: testAnalysis._id,
        steps: [
          {
            title: "Existing step",
            detail: "Existing detail",
            type: "check",
            estMinutes: 30,
            order: 1,
          },
        ],
        parts: [],
        tools: [],
        difficulty: "medium",
      });
      await testWalkthrough.save();
    });

    it("should add step successfully", async () => {
      const newStep = {
        title: "New step",
        detail: "New detail",
        type: "replace",
        estMinutes: 45,
        order: 2,
      };

      const result = await walkthroughService.addStep(
        testWalkthrough._id.toString(),
        newStep,
        testUser._id.toString(),
        testOrg._id.toString()
      );

      expect(result.success).toBe(true);
      expect(result.walkthrough.steps.length).toBe(2);
      expect(result.walkthrough.steps[1].title).toBe("New step");
    });

    it("should auto-assign order if not provided", async () => {
      const newStep = {
        title: "Auto-order step",
        detail: "Auto-order detail",
        type: "retest",
        estMinutes: 15,
      };

      const result = await walkthroughService.addStep(
        testWalkthrough._id.toString(),
        newStep,
        testUser._id.toString(),
        testOrg._id.toString()
      );

      expect(result.success).toBe(true);
      expect(result.walkthrough.steps[1].order).toBe(2);
    });

    it("should handle walkthrough not found", async () => {
      await expect(
        walkthroughService.addStep(
          "507f1f77bcf86cd799439011", // Non-existent ID
          { title: "Test", detail: "Test", type: "check" },
          testUser._id.toString(),
          testOrg._id.toString()
        )
      ).rejects.toThrow("Walkthrough not found");
    });
  });

  describe("deleteWalkthrough", () => {
    let testWalkthrough;

    beforeEach(async () => {
      testWalkthrough = new Walkthrough({
        analysisId: testAnalysis._id,
        steps: [
          {
            title: "Test step",
            detail: "Test detail",
            type: "check",
            estMinutes: 30,
            order: 1,
          },
        ],
        parts: [],
        tools: [],
        difficulty: "medium",
      });
      await testWalkthrough.save();
    });

    it("should delete walkthrough successfully", async () => {
      const result = await walkthroughService.deleteWalkthrough(
        testWalkthrough._id.toString(),
        testUser._id.toString(),
        testOrg._id.toString()
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe("Walkthrough deleted successfully");

      // Verify walkthrough was deleted
      const deletedWalkthrough = await Walkthrough.findById(testWalkthrough._id);
      expect(deletedWalkthrough).toBeNull();
    });

    it("should handle walkthrough not found", async () => {
      await expect(
        walkthroughService.deleteWalkthrough(
          "507f1f77bcf86cd799439011", // Non-existent ID
          testUser._id.toString(),
          testOrg._id.toString()
        )
      ).rejects.toThrow("Walkthrough not found");
    });
  });

  describe("DTC-specific repair steps", () => {
    it("should generate correct steps for P0300", async () => {
      const analysis = new Analysis({
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
      await analysis.save();

      const result = await walkthroughService.generateWalkthrough(
        analysis._id.toString(),
        testUser._id.toString(),
        testOrg._id.toString()
      );

      expect(result.success).toBe(true);
      expect(result.walkthrough.steps.length).toBeGreaterThan(0);
      expect(result.walkthrough.parts.length).toBeGreaterThan(0);
      expect(result.walkthrough.tools.length).toBeGreaterThan(0);
      expect(result.walkthrough.difficulty).toBe("medium");
    });

    it("should use default steps for unknown DTC", async () => {
      const analysis = new Analysis({
        orgId: testOrg._id,
        userId: testUser._id,
        vehicleId: testVehicle._id,
        uploadId: testUpload._id,
        dtcs: [
          {
            code: "P9999",
            description: "Unknown Error Code",
            status: "active",
          },
        ],
        summary: {
          overview: "Found 1 error code",
          severity: "monitor",
        },
        causes: ["Unknown"],
        recommendations: ["Consult technician"],
        module: "Other",
      });
      await analysis.save();

      const result = await walkthroughService.generateWalkthrough(
        analysis._id.toString(),
        testUser._id.toString(),
        testOrg._id.toString()
      );

      expect(result.success).toBe(true);
      expect(result.walkthrough.steps.length).toBeGreaterThan(0);
      expect(result.walkthrough.difficulty).toBe("medium");
    });
  });
});
