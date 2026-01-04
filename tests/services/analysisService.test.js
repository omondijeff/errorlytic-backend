const analysisService = require("../../services/analysisService");
const vcdsParserService = require("../../services/vcdsParserService");
const openaiService = require("../../services/openaiService");
const redisService = require("../../services/redisService");
const Analysis = require("../../models/Analysis");
const Upload = require("../../models/Upload");
const Vehicle = require("../../models/Vehicle");
const User = require("../../models/User");
const Organization = require("../../models/Organization");

describe("Analysis Service", () => {
  let testUser, testOrg, testVehicle, testUpload;

  beforeAll(async () => {
    // Mock Redis service
    jest.spyOn(redisService, "get").mockResolvedValue(null);
    jest.spyOn(redisService, "set").mockResolvedValue(true);
    // Create test organization
    testOrg = new Organization({
      name: "Test Garage",
      type: "garage",
      country: "Kenya",
      settings: {
        currency: "KES",
        timezone: "Africa/Nairobi",
        features: ["analysis", "quotations"],
      },
    });
    await testOrg.save();

    // Create test user
    testUser = new User({
      email: `test${Date.now()}@example.com`,
      passwordHash: "hashedpassword",
      role: "garage_user",
      orgId: testOrg._id,
      profile: {
        name: "Test User",
        firstName: "Test",
        lastName: "User",
      },
      plan: {
        name: "basic",
        limits: {
          analysesPerMonth: 100,
          quotationsPerMonth: 50,
        },
      },
    });
    await testUser.save();

    // Create test vehicle
    testVehicle = new Vehicle({
      orgId: testOrg._id,
      ownerUserId: testUser._id,
      make: "VW",
      model: "Golf",
      year: 2016,
      vin: "TEST123456789",
      mileage: 50000,
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
        originalName: "test-file.txt",
      },
    });
    await testUpload.save();
  });

  afterAll(async () => {
    // Clean up test data
    await Analysis.deleteMany({});
    await Upload.deleteMany({});
    await Vehicle.deleteMany({});
    await User.deleteMany({});
    await Organization.deleteMany({});
  });

  describe("processAnalysis", () => {
    it("should process analysis successfully", async () => {
      // Mock the VCDS parser service
      const mockParseResult = {
        success: true,
        errorCodes: [
          {
            code: "P0300",
            description: "Random/Multiple Cylinder Misfire Detected",
            severity: "high",
            category: "Engine",
            estimatedCost: 15000,
          },
          {
            code: "P0171",
            description: "System Too Lean (Bank 1)",
            severity: "medium",
            category: "Fuel System",
            estimatedCost: 8000,
          },
        ],
        vehicleInfo: {
          vin: "TEST123456789",
          mileage: 50000,
        },
        diagnosticInfo: {
          totalErrors: 2,
          readinessStatus: "Not Ready",
        },
        analysisSummary: {
          totalErrors: 2,
          criticalErrors: 1,
          mediumErrors: 1,
          lowErrors: 0,
          estimatedTotalCost: 23000,
          priority: "high",
          categories: {
            Engine: { count: 1, errors: ["P0300"], estimatedCost: 15000 },
            "Fuel System": { count: 1, errors: ["P0171"], estimatedCost: 8000 },
          },
          recommendations: [
            "Immediate attention required - critical errors detected",
            "Engine diagnostics recommended",
          ],
        },
      };

      // Mock the AI service
      const mockAIAnalysis = {
        aiAssessment:
          "Critical engine issues detected requiring immediate attention.",
        errorExplanations: [
          {
            code: "P0300",
            explanation: "Engine misfire detected in multiple cylinders.",
            troubleshooting:
              "Check spark plugs, ignition coils, and fuel system.",
          },
        ],
        timestamp: new Date().toISOString(),
        model: "gpt-4o-mini",
        vehicleData: {
          make: "VW",
          model: "Golf",
          year: 2016,
        },
      };

      // Mock the services
      jest
        .spyOn(vcdsParserService, "parseVCDSReport")
        .mockResolvedValue(mockParseResult);
      jest
        .spyOn(openaiService, "generateAIEnhancedEstimate")
        .mockResolvedValue({
          aiAssessment: mockAIAnalysis.aiAssessment,
          timestamp: mockAIAnalysis.timestamp,
          model: mockAIAnalysis.model,
        });
      jest
        .spyOn(openaiService, "generateAIExplanation")
        .mockResolvedValue(mockAIAnalysis.errorExplanations[0].explanation);
      jest
        .spyOn(openaiService, "generateTroubleshootingSteps")
        .mockResolvedValue(mockAIAnalysis.errorExplanations[0].troubleshooting);

      const result = await analysisService.processAnalysis(
        testUpload._id.toString(),
        testUser._id.toString(),
        testOrg._id.toString()
      );

      expect(result.success).toBe(true);
      expect(result.analysisId).toBeDefined();
      expect(result.uploadId).toBe(testUpload._id.toString());
      expect(result.summary.overview).toContain("Found 2 error codes");
      expect(result.summary.severity).toBe("critical");
      expect(result.dtcs.length).toBe(2);
      expect(result.aiAnalysis).toBeDefined();

      // Verify analysis was saved to database
      const savedAnalysis = await Analysis.findById(result.analysisId);
      expect(savedAnalysis).toBeDefined();
      expect(savedAnalysis.dtcs.length).toBe(2);
      expect(savedAnalysis.summary.overview).toContain("Found 2 error codes");
      expect(savedAnalysis.summary.severity).toBe("critical");
      expect(savedAnalysis.aiEnrichment.enabled).toBe(true);

      // Verify upload status was updated
      const updatedUpload = await Upload.findById(testUpload._id);
      expect(updatedUpload).toBeDefined();
      expect(updatedUpload.status).toBe("parsed");
      expect(updatedUpload.analysisId).toBeDefined();
      expect(updatedUpload.analysisId.toString()).toBe(
        result.analysisId.toString()
      );

      // Restore mocks
      jest.restoreAllMocks();
    });

    it("should handle upload not found", async () => {
      await expect(
        analysisService.processAnalysis(
          "507f1f77bcf86cd799439011", // Non-existent ID
          testUser._id.toString(),
          testOrg._id.toString()
        )
      ).rejects.toThrow("Upload not found or already processed");
    });

    it("should handle parse failure", async () => {
      // Create a fresh upload for this test
      const freshUpload = new Upload({
        orgId: testOrg._id,
        userId: testUser._id,
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
      await freshUpload.save();

      // Mock parse failure
      jest.spyOn(vcdsParserService, "parseVCDSReport").mockResolvedValue({
        success: false,
        error: "Invalid file format",
      });

      await expect(
        analysisService.processAnalysis(
          freshUpload._id.toString(),
          testUser._id.toString(),
          testOrg._id.toString()
        )
      ).rejects.toThrow("Parse failed: Invalid file format");

      jest.restoreAllMocks();
    });
  });

  describe("getAnalysis", () => {
    let testAnalysis;

    beforeEach(async () => {
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
          overview: "Found 1 error codes",
          severity: "critical",
        },
        module: "Engine",
        causes: ["Engine"],
        recommendations: ["Check engine components"],
      });
      await testAnalysis.save();
    });

    afterEach(async () => {
      await Analysis.deleteMany({});
    });

    it("should get analysis successfully", async () => {
      const result = await analysisService.getAnalysis(
        testAnalysis._id.toString(),
        testUser._id.toString(),
        testOrg._id.toString()
      );

      expect(result.success).toBe(true);
      expect(result.analysis._id.toString()).toBe(testAnalysis._id.toString());
      expect(result.analysis.dtcs.length).toBe(1);
      expect(result.analysis.summary.overview).toContain("Found 1 error codes");
    });

    it("should handle analysis not found", async () => {
      await expect(
        analysisService.getAnalysis(
          "507f1f77bcf86cd799439011", // Non-existent ID
          testUser._id.toString(),
          testOrg._id.toString()
        )
      ).rejects.toThrow("Analysis not found");
    });
  });

  describe("getAnalyses", () => {
    beforeEach(async () => {
      // Create multiple test analyses
      const analyses = [];
      for (let i = 0; i < 5; i++) {
        analyses.push(
          new Analysis({
            orgId: testOrg._id,
            userId: testUser._id,
            vehicleId: testVehicle._id,
            uploadId: testUpload._id,
            dtcs: [],
            summary: {
              overview: `Test analysis ${i}`,
              severity: "recommended",
            },
            module: "Other",
            causes: [],
            recommendations: [],
          })
        );
      }
      await Analysis.insertMany(analyses);
    });

    afterEach(async () => {
      await Analysis.deleteMany({});
    });

    it("should get analyses with pagination", async () => {
      const result = await analysisService.getAnalyses(
        testUser._id.toString(),
        testOrg._id.toString(),
        { page: 1, limit: 3 }
      );

      expect(result.success).toBe(true);
      expect(result.analyses.length).toBe(3);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(3);
      expect(result.pagination.pages).toBe(2);
    });

    it("should filter analyses by severity", async () => {
      const result = await analysisService.getAnalyses(
        testUser._id.toString(),
        testOrg._id.toString(),
        { "summary.severity": "recommended" }
      );

      expect(result.success).toBe(true);
      expect(result.analyses.length).toBe(5);
      result.analyses.forEach((analysis) => {
        expect(analysis.summary.severity).toBe("recommended");
      });
    });
  });

  describe("updateAnalysisStatus", () => {
    let testAnalysis;

    beforeEach(async () => {
      testAnalysis = new Analysis({
        orgId: testOrg._id,
        userId: testUser._id,
        vehicleId: testVehicle._id,
        uploadId: testUpload._id,
        dtcs: [],
        summary: {
          overview: "Test analysis",
          severity: "recommended",
        },
        module: "Other",
        causes: [],
        recommendations: [],
      });
      await testAnalysis.save();
    });

    afterEach(async () => {
      await Analysis.deleteMany({});
    });

    it("should update analysis status successfully", async () => {
      const result = await analysisService.updateAnalysisStatus(
        testAnalysis._id.toString(),
        testUser._id.toString(),
        testOrg._id.toString(),
        "completed"
      );

      expect(result.success).toBe(true);
      expect(result.analysis.isActive).toBe(true);

      // Verify in database
      const updatedAnalysis = await Analysis.findById(testAnalysis._id);
      expect(updatedAnalysis.isActive).toBe(true);
    });

    it("should handle analysis not found", async () => {
      await expect(
        analysisService.updateAnalysisStatus(
          "507f1f77bcf86cd799439011", // Non-existent ID
          testUser._id.toString(),
          testOrg._id.toString(),
          "completed"
        )
      ).rejects.toThrow("Analysis not found");
    });
  });

  describe("deleteAnalysis", () => {
    let testAnalysis;

    beforeEach(async () => {
      testAnalysis = new Analysis({
        orgId: testOrg._id,
        userId: testUser._id,
        vehicleId: testVehicle._id,
        uploadId: testUpload._id,
        dtcs: [],
        summary: {
          overview: "Test analysis",
          severity: "recommended",
        },
        module: "Other",
        causes: [],
        recommendations: [],
      });
      await testAnalysis.save();
    });

    afterEach(async () => {
      await Analysis.deleteMany({});
    });

    it("should delete analysis successfully", async () => {
      const result = await analysisService.deleteAnalysis(
        testAnalysis._id.toString(),
        testUser._id.toString(),
        testOrg._id.toString()
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe("Analysis deleted successfully");

      // Verify deleted from database
      const deletedAnalysis = await Analysis.findById(testAnalysis._id);
      expect(deletedAnalysis).toBeNull();
    });

    it("should handle analysis not found", async () => {
      await expect(
        analysisService.deleteAnalysis(
          "507f1f77bcf86cd799439011", // Non-existent ID
          testUser._id.toString(),
          testOrg._id.toString()
        )
      ).rejects.toThrow("Analysis not found");
    });
  });

  describe("getAnalysisStatistics", () => {
    beforeEach(async () => {
      // Create test analyses with different statuses and severities
      const analyses = [
        {
          orgId: testOrg._id,
          userId: testUser._id,
          vehicleId: testVehicle._id,
          uploadId: testUpload._id,
          dtcs: [],
          summary: { severity: "critical", overview: "Critical analysis" },
          module: "Engine",
          causes: ["Engine", "Transmission"],
        },
        {
          orgId: testOrg._id,
          userId: testUser._id,
          vehicleId: testVehicle._id,
          uploadId: testUpload._id,
          dtcs: [],
          summary: {
            severity: "recommended",
            overview: "Recommended analysis",
          },
          module: "Engine",
          causes: ["Engine"],
        },
        {
          orgId: testOrg._id,
          userId: testUser._id,
          vehicleId: testVehicle._id,
          uploadId: testUpload._id,
          dtcs: [],
          summary: { severity: "monitor", overview: "Monitor analysis" },
          module: "Other",
          causes: ["Electrical"],
        },
      ];
      await Analysis.insertMany(analyses);
    });

    afterEach(async () => {
      await Analysis.deleteMany({});
    });

    it("should get analysis statistics successfully", async () => {
      const result = await analysisService.getAnalysisStatistics(
        testUser._id.toString(),
        testOrg._id.toString()
      );

      expect(result.success).toBe(true);
      expect(result.statistics.totalAnalyses).toBe(3);
      expect(result.statistics.completedAnalyses).toBe(3);
      expect(result.statistics.criticalAnalyses).toBe(1);
      expect(result.statistics.recommendedAnalyses).toBe(1);
      expect(result.statistics.monitorAnalyses).toBe(1);
      expect(result.statistics.recentAnalyses.length).toBe(3);
      expect(result.statistics.categoryStats).toBeDefined();
      expect(Array.isArray(result.statistics.categoryStats)).toBe(true);
    });
  });
});
