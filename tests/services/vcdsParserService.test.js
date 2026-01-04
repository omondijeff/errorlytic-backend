const vcdsParserService = require("../../services/vcdsParserService");
const fs = require("fs").promises;
const path = require("path");

describe("VCDS Parser Service", () => {
  let testFilePath;

  beforeAll(async () => {
    // Create a temporary test file
    testFilePath = path.join(__dirname, "../test-vcds-sample.txt");
    const testContent = `Saturday,16,April,2016,10:26:15:03521
VCDS -- Windows Based VAG/VAS Emulator Running on Windows 10 x64
VCDS Version: 16.3.1.1 (x64)
Data version: 20160325
www.Ross-Tech.com

VIN: **************  License Plate: 

Chassis Type: AU (5Q0)
Scan: 01 02 03 08 09 10 15 16 17 19 42 44 52 5F

VIN: ************  Mileage: 22291km-13850miles

01-Engine -- Status: Malfunction 0010
02-Auto Trans -- Status: Malfunction 0010
03-ABS Brakes -- Status: Malfunction 0010

-------------------------------------------------------------------------------
Address 01: Engine (J623-CHPA)       Labels: 04E-907-309-V1.clb
   Part No SW: 04E 906 016 G    HW: 04E 907 309 A
   Component: 1,4l R4 TSI   H08 7862  
   Revision: WAH08---    
   Coding: 01250032242405082000
   Shop #: WSC 04363 002 1048576
   ASAM Dataset: EV_ECM14TFS01104E906016G 002011
   ROD: EV_ECM14TFS01104E906016G.rod
   VCID: 26431A2059EACC0CEE-8072

4 Faults Found:
17158 - Databus 
          U1123 00 [047] - Received Error Message
          Confirmed - Tested Since Memory Clear
             Freeze Frame:
                    Fault Status: 00000001
                    Fault Priority: 6
                    Fault Frequency: 3
                    Mileage: 22291 km
                    Date: 2016.04.16
                    Time: 09:45:42

5250 - Function Restriction due to Faults in Other Modules 
          U1113 00 [040] - -
          Intermittent - Confirmed - Tested Since Memory Clear

7150 - Implausible Data Received from Steering Angle Sensor Module (G85) 
          U0428 00 [047] - -
          Confirmed - Tested Since Memory Clear

4716 - No Communications with Parking Brake Control Module 
          U0128 00 [040] - -
          Intermittent - Confirmed - Tested Since Memory Clear

Readiness: 0000 0000

-------------------------------------------------------------------------------
Address 02: Auto Trans (J743)       Labels: 0CW-927-769.clb
   Part No SW: 0CW 300 045     HW: 0AM 927 769 G
   Component: GSG DQ200-MQB H43 5240  
   Revision: 00043014    Serial number: CU501212296246
   Coding: 0014
   Shop #: WSC 00028 028 00025
   ASAM Dataset: EV_TCMDQ200021 001001
   ROD: EV_TCMDQ200021.rod
   VCID: 76E30A60C9CAFC8C9E-8022

2 Faults Found:
25472 - No Communication with Gear Selector Module 
          U0103 00 [072] - -
          Intermittent - Confirmed - Tested Since Memory Clear

21221 - No Communications with Parking Brake Control Module 
          U0128 00 [008] - -
          Intermittent - Confirmed - Tested Since Memory Clear

-------------------------------------------------------------------------------
Address 03: ABS Brakes (J104)       Labels: 5Q0-907-379-IPB-V1.clb
   Part No SW: 5Q0 907 379 AC    HW: 5Q0 907 379 D
   Component: ESC           H75 0437  
   Revision: 00000000    Serial number:               
   Coding: 01FA8AA1202312700377060701C32980510448C0608094F3002A0028C1
   Shop #: WSC 00028 028 00025
   ASAM Dataset: EV_Brake1UDSContiMK100IPB 008020
   ROD: EV_Brake1UDSContiMK100IPB_VW37.rod
   VCID: 7DF1154CECFCAFD4DF-8028

3 Faults Found:
0295 - Steering angle sensor 
          B1168 54 [137] - Missing Calibration / Basic Setting
          MIL ON - Confirmed - Tested Since Memory Clear

8299 - Databus 
          U1121 00 [009] - Missing Message
          Confirmed - Tested Since Memory Clear

16390 - Display for Tire Pressure Monitoring 
          C1146 02 [137] - Signal Failure
          MIL ON - Confirmed - Tested Since Memory Clear

End-------------------------(Elapsed Time: 03:13)--------------------------`;

    await fs.writeFile(testFilePath, testContent, "utf8");
  });

  afterAll(async () => {
    // Clean up test file
    try {
      await fs.unlink(testFilePath);
    } catch (error) {
      // File might not exist, ignore error
    }
  });

  describe("parseVCDSReport", () => {
    it("should parse TXT file successfully", async () => {
      const result = await vcdsParserService.parseVCDSReport(
        testFilePath,
        "txt"
      );

      expect(result.success).toBe(true);
      expect(result.errorCodes).toBeDefined();
      expect(result.vehicleInfo).toBeDefined();
      expect(result.diagnosticInfo).toBeDefined();
      expect(result.analysisSummary).toBeDefined();
      expect(result.fileType).toBe("txt");
      expect(result.parsedAt).toBeDefined();
    });

    it("should extract error codes correctly", async () => {
      const result = await vcdsParserService.parseVCDSReport(
        testFilePath,
        "txt"
      );

      expect(result.success).toBe(true);
      expect(result.errorCodes.length).toBeGreaterThan(0);

      // Check for specific error codes from the test file
      const errorCodes = result.errorCodes.map((code) => code.code);
      expect(errorCodes).toContain("17158");
      expect(errorCodes).toContain("5250");
      expect(errorCodes).toContain("7150");
      expect(errorCodes).toContain("4716");
      expect(errorCodes).toContain("25472");
      expect(errorCodes).toContain("21221");
      expect(errorCodes).toContain("0295");
      expect(errorCodes).toContain("8299");
      expect(errorCodes).toContain("16390");
    });

    it("should extract vehicle information", async () => {
      const result = await vcdsParserService.parseVCDSReport(
        testFilePath,
        "txt"
      );

      expect(result.success).toBe(true);
      expect(result.vehicleInfo).toBeDefined();
      expect(result.vehicleInfo.mileage).toBe(22291);
      expect(result.vehicleInfo.mileageUnit).toBe("km");
    });

    it("should generate analysis summary", async () => {
      const result = await vcdsParserService.parseVCDSReport(
        testFilePath,
        "txt"
      );

      expect(result.success).toBe(true);
      expect(result.analysisSummary).toBeDefined();
      expect(result.analysisSummary.totalErrors).toBeGreaterThan(0);
      expect(result.analysisSummary.categories).toBeDefined();
      expect(result.analysisSummary.estimatedTotalCost).toBeGreaterThan(0);
      expect(result.analysisSummary.priority).toBeDefined();
      expect(result.analysisSummary.recommendations).toBeDefined();
    });

    it("should handle unsupported file types", async () => {
      const result = await vcdsParserService.parseVCDSReport(
        testFilePath,
        "unsupported"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unsupported file type");
    });

    it("should handle file not found", async () => {
      const result = await vcdsParserService.parseVCDSReport(
        "/nonexistent/file.txt",
        "txt"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("extractErrorCodes", () => {
    it("should extract VAG-specific error codes", () => {
      const content = `
4 Faults Found:
17158 - Databus 
5250 - Function Restriction due to Faults in Other Modules 
7150 - Implausible Data Received from Steering Angle Sensor Module
4716 - No Communications with Parking Brake Control Module
      `;

      const errorCodes = vcdsParserService.extractErrorCodes(content);

      expect(errorCodes.length).toBe(4);
      expect(errorCodes[0].code).toBe("17158");
      expect(errorCodes[0].description).toBe("Databus");
      expect(errorCodes[1].code).toBe("5250");
      expect(errorCodes[1].description).toBe(
        "Function Restriction due to Faults in Other Modules"
      );
    });

    it("should extract OBD-II codes", () => {
      const content = `
P0300 - Random/Multiple Cylinder Misfire Detected
P0171 - System Too Lean (Bank 1)
C3298 - ESC Component Error
B1168 - Steering Angle Sensor Error
U1123 - Databus - Received Error Message
      `;

      const errorCodes = vcdsParserService.extractErrorCodes(content);

      expect(errorCodes.length).toBeGreaterThan(0);
      const codes = errorCodes.map((code) => code.code);
      expect(codes).toContain("P0300");
      expect(codes).toContain("P0171");
      expect(codes).toContain("C3298");
      expect(codes).toContain("B1168");
      expect(codes).toContain("U1123");
    });
  });

  describe("generateAnalysisSummary", () => {
    it("should generate correct summary", () => {
      const errorCodes = [
        {
          code: "P0300",
          severity: "high",
          category: "Engine",
          estimatedCost: 15000,
        },
        {
          code: "P0171",
          severity: "medium",
          category: "Fuel System",
          estimatedCost: 8000,
        },
        {
          code: "C3298",
          severity: "high",
          category: "Brakes",
          estimatedCost: 25000,
        },
        {
          code: "B1168",
          severity: "low",
          category: "Suspension",
          estimatedCost: 20000,
        },
      ];

      const vehicleInfo = { vin: "TEST123", mileage: 50000 };
      const diagnosticInfo = { totalErrors: 4 };

      const summary = vcdsParserService.generateAnalysisSummary(
        errorCodes,
        vehicleInfo,
        diagnosticInfo
      );

      expect(summary.totalErrors).toBe(4);
      expect(summary.criticalErrors).toBe(2);
      expect(summary.mediumErrors).toBe(1);
      expect(summary.lowErrors).toBe(1);
      expect(summary.estimatedTotalCost).toBe(68000);
      expect(summary.priority).toBe("high");
      expect(summary.categories.Engine.count).toBe(1);
      expect(summary.categories["Fuel System"].count).toBe(1);
      expect(summary.categories.Brakes.count).toBe(1);
      expect(summary.categories.Suspension.count).toBe(1);
      expect(summary.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe("determineCategory", () => {
    it("should categorize engine-related errors", () => {
      const content = "Engine misfire detected";
      const category = vcdsParserService.determineCategory("P0300", content);

      expect(category).toBe("Engine");
    });

    it("should categorize transmission-related errors", () => {
      const content = "Transmission control system malfunction";
      const category = vcdsParserService.determineCategory("P0700", content);

      expect(category).toBe("Transmission");
    });

    it("should categorize brake-related errors", () => {
      const content = "ABS system error";
      const category = vcdsParserService.determineCategory("C3298", content);

      expect(category).toBe("Brakes");
    });

    it("should categorize electrical errors", () => {
      const content = "Databus communication error";
      const category = vcdsParserService.determineCategory("U1123", content);

      expect(category).toBe("Electrical");
    });
  });

  describe("determineSeverity", () => {
    it("should identify high severity errors", () => {
      const content = "Critical engine failure detected";
      const severity = vcdsParserService.determineSeverity("P0300", content);

      expect(severity).toBe("high");
    });

    it("should identify medium severity errors", () => {
      const content = "Performance issue detected";
      const severity = vcdsParserService.determineSeverity("P0171", content);

      expect(severity).toBe("medium");
    });

    it("should default to medium for unknown errors", () => {
      const content = "Unknown error";
      const severity = vcdsParserService.determineSeverity("UNKNOWN", content);

      expect(severity).toBe("medium");
    });
  });

  describe("estimateCost", () => {
    it("should estimate costs correctly", () => {
      const engineCost = vcdsParserService.estimateCost("Engine", "high");
      const transmissionCost = vcdsParserService.estimateCost(
        "Transmission",
        "medium"
      );
      const electricalCost = vcdsParserService.estimateCost(
        "Electrical",
        "low"
      );

      expect(engineCost).toBeGreaterThan(0);
      expect(transmissionCost).toBeGreaterThan(0);
      expect(electricalCost).toBeGreaterThan(0);
      expect(engineCost).toBeGreaterThan(electricalCost);
    });

    it("should handle unknown categories", () => {
      const cost = vcdsParserService.estimateCost("Unknown", "medium");

      expect(cost).toBe(10000); // Default cost
    });
  });
});
