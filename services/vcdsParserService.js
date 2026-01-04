const fs = require("fs").promises;
const path = require("path");
const pdfParse = require("pdf-parse");
const xml2js = require("xml2js");
const axios = require("axios");

/**
 * VCDS/OBD Parser Service
 * Extracts error codes and diagnostic information from VCDS/OBD report files
 * Supports TXT, XML, and PDF formats
 */
class VCDSParserService {
  constructor() {
    // Common VAG error code patterns
    this.errorPatterns = {
      // OBD-II P-codes (Powertrain)
      pCode: /P\d{4}/gi,
      // OBD-II C-codes (Chassis)
      cCode: /C\d{4}/gi,
      // OBD-II B-codes (Body)
      bCode: /B\d{4}/gi,
      // OBD-II U-codes (Network)
      uCode: /U\d{4}/gi,
      // VAG-specific 5-digit codes (like 17158, 25472, etc.)
      vagCode5: /\b\d{5}\b/g,
      // VAG-specific 6-digit codes (like 12658704, 13637426, etc.)
      vagCode6: /\b\d{6,8}\b/g,
      // Hex codes (like 0x1234)
      hexCode: /0x[0-9A-Fa-f]{4}/gi,
    };

    // Common VAG error code categories and their estimated costs
    this.errorCategories = {
      Engine: {
        keywords: [
          "engine",
          "motor",
          "cylinder",
          "misfire",
          "fuel",
          "injection",
          "ignition",
          "timing",
        ],
        baseCost: 8000,
        multiplier: 1.2,
      },
      Transmission: {
        keywords: [
          "transmission",
          "gearbox",
          "clutch",
          "shift",
          "gear",
          "automatic",
          "manual",
        ],
        baseCost: 15000,
        multiplier: 1.5,
      },
      Electrical: {
        keywords: [
          "electrical",
          "battery",
          "alternator",
          "starter",
          "wiring",
          "fuse",
          "relay",
        ],
        baseCost: 5000,
        multiplier: 1.1,
      },
      Suspension: {
        keywords: [
          "suspension",
          "shock",
          "strut",
          "spring",
          "control arm",
          "bushing",
          "ball joint",
        ],
        baseCost: 12000,
        multiplier: 1.3,
      },
      Brakes: {
        keywords: [
          "brake",
          "abs",
          "traction",
          "stability",
          "pad",
          "rotor",
          "caliper",
        ],
        baseCost: 10000,
        multiplier: 1.2,
      },
      "Air Conditioning": {
        keywords: [
          "ac",
          "air conditioning",
          "climate",
          "heater",
          "coolant",
          "thermostat",
        ],
        baseCost: 8000,
        multiplier: 1.1,
      },
      "Emission System": {
        keywords: [
          "emission",
          "catalyst",
          "oxygen",
          "lambda",
          "egr",
          "dpf",
          "adblue",
        ],
        baseCost: 20000,
        multiplier: 1.4,
      },
      "Fuel System": {
        keywords: ["fuel", "pump", "filter", "injector", "pressure", "tank"],
        baseCost: 7000,
        multiplier: 1.2,
      },
      "Exhaust System": {
        keywords: ["exhaust", "muffler", "pipe", "catalytic", "sensor"],
        baseCost: 15000,
        multiplier: 1.3,
      },
      "Safety Systems": {
        keywords: [
          "airbag",
          "safety",
          "sensor",
          "crash",
          "impact",
          "protection",
        ],
        baseCost: 25000,
        multiplier: 1.5,
      },
    };

    // Common VAG error codes with descriptions and severity
    this.knownErrorCodes = {
      P0300: {
        description: "Random/Multiple Cylinder Misfire Detected",
        severity: "high",
        category: "Engine",
        estimatedCost: 15000,
      },
      P0171: {
        description: "System Too Lean (Bank 1)",
        severity: "medium",
        category: "Fuel System",
        estimatedCost: 8000,
      },
      P0172: {
        description: "System Too Rich (Bank 1)",
        severity: "medium",
        category: "Fuel System",
        estimatedCost: 8000,
      },
      P0420: {
        description: "Catalyst System Efficiency Below Threshold",
        severity: "medium",
        category: "Emission System",
        estimatedCost: 25000,
      },
      P0430: {
        description: "Catalyst System Efficiency Below Threshold (Bank 2)",
        severity: "medium",
        category: "Emission System",
        estimatedCost: 25000,
      },
      P0128: {
        description:
          "Coolant Thermostat Temperature Below Regulating Temperature",
        severity: "low",
        category: "Engine",
        estimatedCost: 5000,
      },
      P0123: {
        description:
          "Throttle/Pedal Position Sensor/Switch A Circuit High Input",
        severity: "medium",
        category: "Engine",
        estimatedCost: 12000,
      },
      P0122: {
        description:
          "Throttle/Pedal Position Sensor/Switch A Circuit Low Input",
        severity: "medium",
        category: "Engine",
        estimatedCost: 12000,
      },
      P0222: {
        description:
          "Throttle/Pedal Position Sensor/Switch B Circuit Low Input",
        severity: "medium",
        category: "Engine",
        estimatedCost: 12000,
      },
      P0223: {
        description:
          "Throttle/Pedal Position Sensor/Switch B Circuit High Input",
        severity: "medium",
        category: "Engine",
        estimatedCost: 12000,
      },
      P0506: {
        description: "Idle Control System RPM Lower Than Expected",
        severity: "low",
        category: "Engine",
        estimatedCost: 6000,
      },
      P0507: {
        description: "Idle Control System RPM Higher Than Expected",
        severity: "low",
        category: "Engine",
        estimatedCost: 6000,
      },
      P0562: {
        description: "System Voltage Low",
        severity: "medium",
        category: "Electrical",
        estimatedCost: 8000,
      },
      P0563: {
        description: "System Voltage High",
        severity: "medium",
        category: "Electrical",
        estimatedCost: 8000,
      },
      P0700: {
        description: "Transmission Control System Malfunction",
        severity: "high",
        category: "Transmission",
        estimatedCost: 20000,
      },
      P0741: {
        description: "Torque Converter Clutch Circuit Performance or Stuck Off",
        severity: "medium",
        category: "Transmission",
        estimatedCost: 18000,
      },
      P0742: {
        description: "Torque Converter Clutch Circuit Stuck On",
        severity: "medium",
        category: "Transmission",
        estimatedCost: 18000,
      },
      P0753: {
        description: "Shift Solenoid A Electrical",
        severity: "medium",
        category: "Transmission",
        estimatedCost: 15000,
      },
      P0758: {
        description: "Shift Solenoid B Electrical",
        severity: "medium",
        category: "Transmission",
        estimatedCost: 15000,
      },
      P0841: {
        description:
          "Transmission Fluid Pressure Sensor/Switch A Circuit Range/Performance",
        severity: "medium",
        category: "Transmission",
        estimatedCost: 16000,
      },
      P0842: {
        description: "Transmission Fluid Pressure Sensor/Switch A Circuit Low",
        severity: "medium",
        category: "Transmission",
        estimatedCost: 16000,
      },
      P0843: {
        description: "Transmission Fluid Pressure Sensor/Switch A Circuit High",
        severity: "medium",
        category: "Transmission",
        estimatedCost: 16000,
      },
      // VAG-specific error codes
      17158: {
        description: "Databus - Received Error Message",
        severity: "medium",
        category: "Electrical",
        estimatedCost: 8000,
      },
      5250: {
        description: "Function Restriction due to Faults in Other Modules",
        severity: "medium",
        category: "Engine",
        estimatedCost: 12000,
      },
      7150: {
        description:
          "Implausible Data Received from Steering Angle Sensor Module",
        severity: "high",
        category: "Suspension",
        estimatedCost: 18000,
      },
      4716: {
        description: "No Communications with Parking Brake Control Module",
        severity: "medium",
        category: "Brakes",
        estimatedCost: 15000,
      },
      25472: {
        description: "No Communication with Gear Selector Module",
        severity: "high",
        category: "Transmission",
        estimatedCost: 20000,
      },
      21221: {
        description: "No Communications with Parking Brake Control Module",
        severity: "medium",
        category: "Brakes",
        estimatedCost: 15000,
      },
      "0295": {
        description: "Steering angle sensor - Missing Calibration",
        severity: "high",
        category: "Suspension",
        estimatedCost: 18000,
      },
      8299: {
        description: "Databus - Missing Message",
        severity: "medium",
        category: "Electrical",
        estimatedCost: 8000,
      },
      16390: {
        description: "Display for Tire Pressure Monitoring - Signal Failure",
        severity: "medium",
        category: "Brakes",
        estimatedCost: 12000,
      },
      554773: {
        description: "Databus - Missing Message",
        severity: "medium",
        category: "Electrical",
        estimatedCost: 8000,
      },
      12658704: {
        description: "Databus - Missing Message",
        severity: "medium",
        category: "Electrical",
        estimatedCost: 8000,
      },
      13637426: {
        description: "Databus - Received Error Message",
        severity: "medium",
        category: "Electrical",
        estimatedCost: 8000,
      },
      16776967: {
        description: "Databus - Missing Message",
        severity: "medium",
        category: "Electrical",
        estimatedCost: 8000,
      },
      16776973: {
        description: "Databus - Missing Message",
        severity: "medium",
        category: "Electrical",
        estimatedCost: 8000,
      },
      15873: {
        description: "Steering angle sensor - Missing Calibration",
        severity: "high",
        category: "Suspension",
        estimatedCost: 18000,
      },
      7175: {
        description: "Function Restricted due to Missing Message(s)",
        severity: "medium",
        category: "Electrical",
        estimatedCost: 8000,
      },
      7206: {
        description: "Function Restricted due to Missing Message(s)",
        severity: "medium",
        category: "Electrical",
        estimatedCost: 8000,
      },
      // Additional specific mappings for better categorization
      C3298: {
        description: "ESC Component Error",
        severity: "high",
        category: "Brakes",
        estimatedCost: 25000,
      },
      C0608: {
        description: "ESC Component Error",
        severity: "high",
        category: "Brakes",
        estimatedCost: 25000,
      },
      C1146: {
        description: "Tire Pressure Monitoring Display Error",
        severity: "high",
        category: "Brakes",
        estimatedCost: 15000,
      },
      B1168: {
        description: "Steering Angle Sensor Error",
        severity: "high",
        category: "Suspension",
        estimatedCost: 20000,
      },
      U1123: {
        description: "Databus - Received Error Message",
        severity: "medium",
        category: "Electrical",
        estimatedCost: 8000,
      },
      U1113: {
        description: "Function Restriction due to Faults in Other Modules",
        severity: "medium",
        category: "Engine",
        estimatedCost: 12000,
      },
      U0428: {
        description: "Implausible Data from Steering Angle Sensor",
        severity: "high",
        category: "Suspension",
        estimatedCost: 20000,
      },
      U0128: {
        description: "No Communications with Parking Brake Control Module",
        severity: "medium",
        category: "Brakes",
        estimatedCost: 15000,
      },
      U0103: {
        description: "No Communication with Gear Selector Module",
        severity: "high",
        category: "Transmission",
        estimatedCost: 20000,
      },
      U1121: {
        description: "Databus - Missing Message",
        severity: "medium",
        category: "Electrical",
        estimatedCost: 8000,
      },
      U1111: {
        description: "Function Restricted due to Missing Message(s)",
        severity: "medium",
        category: "Electrical",
        estimatedCost: 8000,
      },
      // Additional specific mappings for remaining problematic codes
      C2410: {
        description: "Body Control Module (BCM) Communication Error",
        severity: "high",
        category: "Electrical",
        estimatedCost: 15000,
      },
      C0000: {
        description: "Airbag System Component Error",
        severity: "high",
        category: "Safety Systems",
        estimatedCost: 20000,
      },
      C8000: {
        description: "Airbag System Component Error",
        severity: "high",
        category: "Safety Systems",
        estimatedCost: 20000,
      },
      C2136: {
        description: "Side Sensor Communication Error",
        severity: "high",
        category: "Safety Systems",
        estimatedCost: 18000,
      },
      C4008: {
        description: "Front Sensor Communication Error",
        severity: "high",
        category: "Safety Systems",
        estimatedCost: 18000,
      },
      C0714: {
        description: "Dashboard Communication Error",
        severity: "high",
        category: "Electrical",
        estimatedCost: 8000,
      },
      C9004: {
        description: "Passenger Door Control Module Error",
        severity: "high",
        category: "Electrical",
        estimatedCost: 8000,
      },
      B7945: {
        description: "Air Conditioning System Error",
        severity: "high",
        category: "Air Conditioning",
        estimatedCost: 15000,
      },
      B0864: {
        description: "CAN Gateway Communication Error",
        severity: "high",
        category: "Electrical",
        estimatedCost: 8000,
      },
      B0950: {
        description: "Driver Door Control Module Error",
        severity: "high",
        category: "Electrical",
        estimatedCost: 8000,
      },
      U5012: {
        description: "Transmission Control Module Error",
        severity: "high",
        category: "Transmission",
        estimatedCost: 20000,
      },
      U3700: {
        description: "Park Assist System Coding Error",
        severity: "high",
        category: "Electrical",
        estimatedCost: 8000,
      },
    };
  }

  /**
   * Parse VCDS/OBD report file and extract error codes
   * @param {string} filePath - Path to the uploaded file
   * @param {string} fileType - File type (txt, xml, pdf)
   * @returns {Object} Parsed results with error codes and diagnostic info
   */
  async parseVCDSReport(filePath, fileType = "txt") {
    try {
      let fileContent;
      const isUrl = filePath.startsWith('http://') || filePath.startsWith('https://');

      // Read file content based on type
      switch (fileType.toLowerCase()) {
        case "txt":
          if (isUrl) {
            const response = await axios.get(filePath, { responseType: 'text' });
            fileContent = response.data;
          } else {
            fileContent = await fs.readFile(filePath, "utf8");
          }
          break;
        case "pdf":
          let pdfBuffer;
          if (isUrl) {
            const response = await axios.get(filePath, { responseType: 'arraybuffer' });
            pdfBuffer = Buffer.from(response.data);
          } else {
            pdfBuffer = await fs.readFile(filePath);
          }
          const pdfData = await pdfParse(pdfBuffer);
          fileContent = pdfData.text;
          break;
        case "xml":
          let xmlBuffer;
          if (isUrl) {
            const response = await axios.get(filePath, { responseType: 'text' });
            xmlBuffer = response.data;
          } else {
            xmlBuffer = await fs.readFile(filePath, "utf8");
          }
          const xmlData = await this.parseXML(xmlBuffer);
          fileContent = this.extractTextFromXML(xmlData);
          break;
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }

      // Extract error codes
      const errorCodes = this.extractErrorCodes(fileContent);

      // Extract vehicle information
      const vehicleInfo = this.extractVehicleInfo(fileContent);

      // Extract diagnostic information
      const diagnosticInfo = this.extractDiagnosticInfo(fileContent);

      // Generate analysis summary
      const analysisSummary = this.generateAnalysisSummary(
        errorCodes,
        vehicleInfo,
        diagnosticInfo
      );

      return {
        success: true,
        errorCodes,
        vehicleInfo,
        diagnosticInfo,
        analysisSummary,
        rawContent: fileContent.substring(0, 1000), // First 1000 chars for reference
        fileType,
        parsedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error parsing VCDS report:", error);
      return {
        success: false,
        error: error.message,
        fileType,
        parsedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Parse XML content
   * @param {string} xmlContent - XML content as string
   * @returns {Object} Parsed XML object
   */
  async parseXML(xmlContent) {
    try {
      const parser = new xml2js.Parser({
        explicitArray: false,
        mergeAttrs: true,
        explicitRoot: false,
      });
      return await parser.parseStringPromise(xmlContent);
    } catch (error) {
      console.error("Error parsing XML:", error);
      throw new Error(`XML parsing failed: ${error.message}`);
    }
  }

  /**
   * Extract text content from parsed XML
   * @param {Object} xmlData - Parsed XML object
   * @returns {string} Extracted text content
   */
  extractTextFromXML(xmlData) {
    let text = "";

    const extractTextRecursive = (obj) => {
      if (typeof obj === "string") {
        text += obj + "\n";
      } else if (typeof obj === "object" && obj !== null) {
        Object.values(obj).forEach((value) => {
          extractTextRecursive(value);
        });
      }
    };

    extractTextRecursive(xmlData);
    return text;
  }

  /**
   * Generate analysis summary
   * @param {Array} errorCodes - Array of error codes
   * @param {Object} vehicleInfo - Vehicle information
   * @param {Object} diagnosticInfo - Diagnostic information
   * @returns {Object} Analysis summary
   */
  generateAnalysisSummary(errorCodes, vehicleInfo, diagnosticInfo) {
    const summary = {
      totalErrors: errorCodes.length,
      criticalErrors: errorCodes.filter((code) => code.severity === "high")
        .length,
      mediumErrors: errorCodes.filter((code) => code.severity === "medium")
        .length,
      lowErrors: errorCodes.filter((code) => code.severity === "low").length,
      categories: {},
      estimatedTotalCost: 0,
      priority: "low",
      recommendations: [],
    };

    // Categorize errors
    errorCodes.forEach((error) => {
      const category = error.category || "Unknown";
      if (!summary.categories[category]) {
        summary.categories[category] = {
          count: 0,
          errors: [],
          estimatedCost: 0,
        };
      }
      summary.categories[category].count++;
      summary.categories[category].errors.push(error.code);
      summary.categories[category].estimatedCost += error.estimatedCost || 0;
    });

    // Calculate total estimated cost
    summary.estimatedTotalCost = errorCodes.reduce((total, error) => {
      return total + (error.estimatedCost || 0);
    }, 0);

    // Determine priority
    if (summary.criticalErrors > 0) {
      summary.priority = "high";
    } else if (summary.mediumErrors > 2) {
      summary.priority = "medium";
    }

    // Generate recommendations
    if (summary.criticalErrors > 0) {
      summary.recommendations.push(
        "Immediate attention required - critical errors detected"
      );
    }
    if (
      summary.categories["Engine"] &&
      summary.categories["Engine"].count > 0
    ) {
      summary.recommendations.push("Engine diagnostics recommended");
    }
    if (
      summary.categories["Transmission"] &&
      summary.categories["Transmission"].count > 0
    ) {
      summary.recommendations.push("Transmission inspection recommended");
    }
    if (
      summary.categories["Safety Systems"] &&
      summary.categories["Safety Systems"].count > 0
    ) {
      summary.recommendations.push("Safety system inspection required");
    }

    return summary;
  }

  /**
   * Extract error codes from VCDS content using VAG-specific patterns
   * @param {string} content - File content to analyze
   * @returns {Array} Array of extracted error codes with details
   */
  extractErrorCodes(content) {
    const errorCodes = [];
    const extractedCodes = new Set();

    // VAG-specific error code pattern: "17158 - Databus" or "25472 - No Communication"
    // Look for the specific format: "4 Faults Found:" followed by error codes
    const faultSectionPattern = /(\d+)\s+Faults? Found:?/gi;
    let faultMatch;

    while ((faultMatch = faultSectionPattern.exec(content)) !== null) {
      // Look for error codes in the next few lines after "X Faults Found:"
      const startIndex = faultMatch.index;
      const lines = content
        .substring(startIndex, startIndex + 2000)
        .split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Look for the pattern: "17158 - Description" or "25472 - Description" or "0295 - Description"
        const errorMatch = line.match(/^(\d{4,5})\s*-\s*([^\n\r]+)$/);

        if (errorMatch) {
          const code = errorMatch[1];
          const description = errorMatch[2].trim();

          if (!extractedCodes.has(code)) {
            extractedCodes.add(code);

            // Get error details
            const errorDetails = this.getErrorDetails(code, content);
            if (errorDetails) {
              // Override description with the one from the report
              errorDetails.description = description;
              errorCodes.push(errorDetails);
            }
          }
        }
      }
    }

    // Also look for OBD-II codes (P, C, B, U codes) in the content
    const obdPatterns = {
      pCode: /P\d{4}/gi,
      cCode: /C\d{4}/gi,
      bCode: /B\d{4}/gi,
      uCode: /U\d{4}/gi,
    };

    Object.keys(obdPatterns).forEach((patternType) => {
      const pattern = obdPatterns[patternType];
      const matches = content.match(pattern);

      if (matches) {
        matches.forEach((match) => {
          const code = match.toUpperCase();
          if (!extractedCodes.has(code)) {
            extractedCodes.add(code);

            // Get error details
            const errorDetails = this.getErrorDetails(code, content);
            if (errorDetails) {
              errorCodes.push(errorDetails);
            }
          }
        });
      }
    });

    // Also look for standalone error codes in lines (for test cases)
    const lines = content.split("\n");
    lines.forEach((line) => {
      // Look for patterns like "P0300 - Random/Multiple Cylinder Misfire Detected"
      const obdMatch = line.match(/^(P|C|B|U)(\d{4})\s*-\s*([^\n\r]+)$/i);
      if (obdMatch) {
        const code = obdMatch[1] + obdMatch[2];
        const description = obdMatch[3].trim();

        if (!extractedCodes.has(code)) {
          extractedCodes.add(code);

          const errorDetails = this.getErrorDetails(code, content);
          if (errorDetails) {
            errorDetails.description = description;
            errorCodes.push(errorDetails);
          }
        }
      }
    });

    return errorCodes;
  }

  /**
   * Get detailed information for an error code
   * @param {string} code - Error code to analyze
   * @param {string} content - Full file content for context analysis
   * @returns {Object} Error details with description, severity, and cost
   */
  getErrorDetails(code, content) {
    // Check if we have known information for this code
    if (this.knownErrorCodes[code]) {
      return {
        code: code,
        ...this.knownErrorCodes[code],
      };
    }

    // Try to extract description from content
    const description = this.extractDescriptionFromContent(code, content);

    // Determine category and severity based on content analysis
    const category = this.determineCategory(code, content);
    const severity = this.determineSeverity(code, content);
    const estimatedCost = this.estimateCost(category, severity);

    return {
      code: code,
      description: description || `Error Code ${code}`,
      severity,
      category,
      estimatedCost,
    };
  }

  /**
   * Extract error description from VCDS content
   * @param {string} code - Error code to search for
   * @param {string} content - File content to search in
   * @returns {string} Extracted description or null
   */
  extractDescriptionFromContent(code, content) {
    // Look for the error code in context
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(code)) {
        // Look for description in nearby lines
        for (
          let j = Math.max(0, i - 2);
          j <= Math.min(lines.length - 1, i + 2);
          j++
        ) {
          const contextLine = lines[j];
          if (
            contextLine.length > 10 &&
            !contextLine.includes(code) &&
            !contextLine.match(/^\s*$/)
          ) {
            return contextLine.trim();
          }
        }
      }
    }

    return null;
  }

  /**
   * Determine error category based on content analysis
   * @param {string} code - Error code
   * @param {string} content - File content
   * @returns {string} Determined category
   */
  determineCategory(code, content) {
    const contentLower = content.toLowerCase();

    // Check if we have a known category for this specific code
    if (this.knownErrorCodes[code] && this.knownErrorCodes[code].category) {
      return this.knownErrorCodes[code].category;
    }

    // Look for context around the error code
    const codeIndex = content.indexOf(code);
    if (codeIndex !== -1) {
      const contextStart = Math.max(0, codeIndex - 500);
      const contextEnd = Math.min(content.length, codeIndex + 500);
      const context = content.substring(contextStart, contextEnd).toLowerCase();

      // Check each category for keyword matches in the context
      for (const [category, config] of Object.entries(this.errorCategories)) {
        for (const keyword of config.keywords) {
          if (context.includes(keyword)) {
            return category;
          }
        }
      }

      // Look for specific VAG module indicators
      if (
        context.includes("engine") ||
        context.includes("motor") ||
        context.includes("cylinder")
      ) {
        return "Engine";
      }
      if (
        context.includes("transmission") ||
        context.includes("gearbox") ||
        context.includes("clutch")
      ) {
        return "Transmission";
      }
      if (
        context.includes("abs") ||
        context.includes("brake") ||
        context.includes("esc") ||
        context.includes("tire pressure") ||
        context.includes("tpms")
      ) {
        return "Brakes";
      }
      if (
        context.includes("steering") ||
        context.includes("suspension") ||
        context.includes("steering angle") ||
        context.includes("g85")
      ) {
        return "Suspension";
      }
      if (
        context.includes("electrical") ||
        context.includes("databus") ||
        context.includes("communication") ||
        context.includes("gateway") ||
        context.includes("can")
      ) {
        return "Electrical";
      }
      if (
        context.includes("ac") ||
        context.includes("air conditioning") ||
        context.includes("climatronic") ||
        context.includes("hvac")
      ) {
        return "Air Conditioning";
      }
      if (
        context.includes("fuel") ||
        context.includes("injection") ||
        context.includes("pump")
      ) {
        return "Fuel System";
      }
      if (
        context.includes("exhaust") ||
        context.includes("catalytic") ||
        context.includes("emission")
      ) {
        return "Exhaust System";
      }
    }

    // Default to Engine if no specific category found
    return "Engine";
  }

  /**
   * Determine error severity based on code and context
   * @param {string} code - Error code
   * @param {string} content - File content
   * @returns {string} Severity level (low, medium, high)
   */
  determineSeverity(code, content) {
    const contentLower = content.toLowerCase();

    // High severity indicators
    const highSeverityKeywords = [
      "misfire",
      "failure",
      "critical",
      "severe",
      "broken",
      "damaged",
    ];
    if (
      highSeverityKeywords.some((keyword) => contentLower.includes(keyword))
    ) {
      return "high";
    }

    // Medium severity indicators
    const mediumSeverityKeywords = [
      "performance",
      "efficiency",
      "threshold",
      "range",
      "circuit",
    ];
    if (
      mediumSeverityKeywords.some((keyword) => contentLower.includes(keyword))
    ) {
      return "medium";
    }

    // Default to medium for unknown codes
    return "medium";
  }

  /**
   * Estimate repair cost based on category and severity
   * @param {string} category - Error category
   * @param {string} severity - Error severity
   * @returns {number} Estimated cost in KES
   */
  estimateCost(category, severity) {
    const categoryConfig = this.errorCategories[category];
    if (!categoryConfig) {
      return 10000; // Default cost
    }

    let baseCost = categoryConfig.baseCost;

    // Adjust cost based on severity
    switch (severity) {
      case "high":
        baseCost *= 1.5;
        break;
      case "medium":
        baseCost *= 1.0;
        break;
      case "low":
        baseCost *= 0.8;
        break;
    }

    // Apply category multiplier
    baseCost *= categoryConfig.multiplier;

    // Round to nearest 1000
    return Math.round(baseCost / 1000) * 1000;
  }

  /**
   * Extract vehicle information from VCDS report
   * @param {string} content - File content
   * @returns {Object} Vehicle information
   */
  extractVehicleInfo(content) {
    const vehicleInfo = {};

    // Extract VIN
    const vinMatch = content.match(/VIN:\s*([A-Z0-9]{17})/i);
    if (vinMatch) {
      vehicleInfo.vin = vinMatch[1];
    }

    // Extract mileage
    const mileageMatch = content.match(/(\d+)\s*(km|kilometers|miles)/i);
    if (mileageMatch) {
      vehicleInfo.mileage = parseInt(mileageMatch[1]);
      vehicleInfo.mileageUnit = mileageMatch[2].toLowerCase();
    }

    // Extract scan date
    const dateMatch = content.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    if (dateMatch) {
      vehicleInfo.scanDate = dateMatch[1];
    }

    return vehicleInfo;
  }

  /**
   * Extract diagnostic information from VCDS report
   * @param {string} content - File content
   * @returns {Object} Diagnostic information
   */
  extractDiagnosticInfo(content) {
    const diagnosticInfo = {};

    // Count total errors
    const totalErrors = this.extractErrorCodes(content).length;
    diagnosticInfo.totalErrors = totalErrors;

    // Check for readiness status
    const readinessMatch = content.match(/readiness:\s*(.+)/i);
    if (readinessMatch) {
      diagnosticInfo.readinessStatus = readinessMatch[1].trim();
    }

    // Check for freeze frame data
    const freezeFrameMatch = content.match(/freeze frame/i);
    diagnosticInfo.hasFreezeFrame = !!freezeFrameMatch;

    return diagnosticInfo;
  }
}

module.exports = new VCDSParserService();
