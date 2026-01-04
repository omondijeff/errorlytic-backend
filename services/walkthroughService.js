const Walkthrough = require("../models/Walkthrough");
const Analysis = require("../models/Analysis");
const AuditLog = require("../models/AuditLog");
const Metering = require("../models/Metering");
const openaiService = require("./openaiService");

class WalkthroughService {
  constructor() {
    // DTC-specific repair steps database
    this.dtcRepairSteps = {
      // Engine-related DTCs
      "P0300": {
        steps: [
          {
            title: "Check ignition system components",
            detail: "Inspect spark plugs, ignition coils, and spark plug wires for wear or damage",
            type: "check",
            estMinutes: 30,
            order: 1,
          },
          {
            title: "Test fuel system pressure",
            detail: "Connect fuel pressure gauge and verify pressure is within specifications",
            type: "check",
            estMinutes: 20,
            order: 2,
          },
          {
            title: "Replace faulty ignition components",
            detail: "Replace any damaged spark plugs, coils, or wires found during inspection",
            type: "replace",
            estMinutes: 45,
            order: 3,
          },
          {
            title: "Test engine performance",
            detail: "Start engine and verify misfire is resolved, check for smooth idle",
            type: "retest",
            estMinutes: 15,
            order: 4,
          },
        ],
        parts: [
          {
            name: "Spark Plugs",
            oem: "NGK BKR6E",
            alt: ["Bosch FR7DPP", "Champion RC12YC"],
            qty: 4,
            estimatedCost: 2500,
          },
          {
            name: "Ignition Coil",
            oem: "VW 06H905115",
            alt: ["Bosch 0221604001", "Beru ZSE038"],
            qty: 1,
            estimatedCost: 8500,
          },
        ],
        tools: ["Spark plug socket", "Torque wrench", "Fuel pressure gauge", "Multimeter"],
        difficulty: "medium",
      },
      "P0171": {
        steps: [
          {
            title: "Check air intake system",
            detail: "Inspect air filter, intake hoses, and MAF sensor for leaks or contamination",
            type: "check",
            estMinutes: 25,
            order: 1,
          },
          {
            title: "Test fuel pressure",
            detail: "Measure fuel pressure at rail to ensure adequate fuel delivery",
            type: "check",
            estMinutes: 20,
            order: 2,
          },
          {
            title: "Clean or replace MAF sensor",
            detail: "Clean MAF sensor with appropriate cleaner or replace if faulty",
            type: "replace",
            estMinutes: 30,
            order: 3,
          },
          {
            title: "Verify fuel trim values",
            detail: "Check long-term and short-term fuel trim values are within normal range",
            type: "retest",
            estMinutes: 20,
            order: 4,
          },
        ],
        parts: [
          {
            name: "Air Filter",
            oem: "Mann C14130",
            alt: ["Bosch 1457433276", "Fram CA9265"],
            qty: 1,
            estimatedCost: 1200,
          },
          {
            name: "MAF Sensor",
            oem: "VW 06A906461",
            alt: ["Bosch 0280218004", "Pierburg 7.22684.01.0"],
            qty: 1,
            estimatedCost: 15000,
          },
        ],
        tools: ["MAF sensor cleaner", "Fuel pressure gauge", "Scan tool", "Multimeter"],
        difficulty: "easy",
      },
      // Transmission-related DTCs
      "P0700": {
        steps: [
          {
            title: "Check transmission fluid level and condition",
            detail: "Verify fluid level is correct and check for contamination or burning smell",
            type: "check",
            estMinutes: 15,
            order: 1,
          },
          {
            title: "Scan transmission control module",
            detail: "Read all transmission DTCs to identify specific component failures",
            type: "check",
            estMinutes: 10,
            order: 2,
          },
          {
            title: "Test transmission solenoids",
            detail: "Check resistance and operation of shift solenoids and pressure control valves",
            type: "check",
            estMinutes: 45,
            order: 3,
          },
          {
            title: "Replace faulty transmission components",
            detail: "Replace any defective solenoids, sensors, or mechanical components",
            type: "replace",
            estMinutes: 120,
            order: 4,
          },
        ],
        parts: [
          {
            name: "Transmission Fluid",
            oem: "VW G052182A2",
            alt: ["Pentosin ATF 44", "Castrol Transmax"],
            qty: 4,
            estimatedCost: 3200,
          },
          {
            name: "Shift Solenoid",
            oem: "VW 01M325429",
            alt: ["Bosch 0 986 375 001", "Febi 25120"],
            qty: 1,
            estimatedCost: 12000,
          },
        ],
        tools: ["Transmission fluid pump", "Scan tool", "Multimeter", "Transmission jack"],
        difficulty: "hard",
      },
      // ABS-related DTCs
      "C1015": {
        steps: [
          {
            title: "Check ABS wheel speed sensors",
            detail: "Inspect all wheel speed sensors for damage, contamination, or loose connections",
            type: "check",
            estMinutes: 30,
            order: 1,
          },
          {
            title: "Test ABS sensor signals",
            detail: "Use oscilloscope to verify proper signal output from each wheel speed sensor",
            type: "check",
            estMinutes: 45,
            order: 2,
          },
          {
            title: "Clean or replace ABS sensors",
            detail: "Clean sensor mounting surfaces and replace any faulty sensors",
            type: "replace",
            estMinutes: 60,
            order: 3,
          },
          {
            title: "Test ABS system operation",
            detail: "Perform ABS test drive and verify system activates correctly",
            type: "retest",
            estMinutes: 20,
            order: 4,
          },
        ],
        parts: [
          {
            name: "ABS Wheel Speed Sensor",
            oem: "VW 1J0927807",
            alt: ["Bosch 0265008001", "Febi 25120"],
            qty: 1,
            estimatedCost: 8500,
          },
          {
            name: "ABS Sensor Cable",
            oem: "VW 1J0927808",
            alt: ["Bosch 0265008002"],
            qty: 1,
            estimatedCost: 3500,
          },
        ],
        tools: ["Oscilloscope", "Multimeter", "Jack stands", "ABS scan tool"],
        difficulty: "medium",
      },
      // Airbag-related DTCs
      "B1000": {
        steps: [
          {
            title: "Check airbag system connections",
            detail: "Inspect all airbag connectors and wiring harnesses for damage or corrosion",
            type: "check",
            estMinutes: 45,
            order: 1,
          },
          {
            title: "Test airbag control module",
            detail: "Use airbag scan tool to read system status and test module communication",
            type: "check",
            estMinutes: 30,
            order: 2,
          },
          {
            title: "Replace faulty airbag components",
            detail: "Replace any damaged airbag modules, sensors, or wiring harnesses",
            type: "replace",
            estMinutes: 90,
            order: 3,
          },
          {
            title: "Verify airbag system readiness",
            detail: "Clear codes and verify airbag warning light extinguishes properly",
            type: "retest",
            estMinutes: 15,
            order: 4,
          },
        ],
        parts: [
          {
            name: "Airbag Control Module",
            oem: "VW 1J0909601",
            alt: ["Bosch 0265008001"],
            qty: 1,
            estimatedCost: 25000,
          },
          {
            name: "Airbag Wiring Harness",
            oem: "VW 1J0973702",
            alt: ["Bosch 0265008002"],
            qty: 1,
            estimatedCost: 4500,
          },
        ],
        tools: ["Airbag scan tool", "Multimeter", "Safety glasses", "Anti-static wrist strap"],
        difficulty: "expert",
      },
    };

    // Default steps for unknown DTCs
    this.defaultSteps = {
      steps: [
        {
          title: "Perform visual inspection",
          detail: "Thoroughly inspect the affected system for obvious signs of damage or wear",
          type: "check",
          estMinutes: 20,
          order: 1,
        },
        {
          title: "Check system connections",
          detail: "Verify all electrical connections and wiring harnesses are secure and undamaged",
          type: "check",
          estMinutes: 15,
          order: 2,
        },
        {
          title: "Test system operation",
          detail: "Use appropriate diagnostic tools to test system functionality and identify root cause",
          type: "check",
          estMinutes: 30,
          order: 3,
        },
        {
          title: "Replace faulty components",
          detail: "Replace any components identified as defective during inspection and testing",
          type: "replace",
          estMinutes: 60,
          order: 4,
        },
        {
          title: "Verify repair success",
          detail: "Test system operation to confirm the issue has been resolved",
          type: "retest",
          estMinutes: 15,
          order: 5,
        },
      ],
      parts: [
        {
          name: "Diagnostic Scan",
          oem: "VAG-COM",
          alt: ["OBD-II Scanner", "Dealer Tool"],
          qty: 1,
          estimatedCost: 0,
        },
      ],
      tools: ["Multimeter", "Scan tool", "Basic hand tools"],
      difficulty: "medium",
    };
  }

  /**
   * Generate walkthrough steps for an analysis
   * @param {string} analysisId - The analysis ID
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Generated walkthrough
   */
  async generateWalkthrough(analysisId, userId, orgId) {
    try {
      // Get the analysis
      const analysis = await Analysis.findById(analysisId)
        .populate("vehicleId", "make model year")
        .populate("uploadId", "meta.originalName");

      if (!analysis) {
        throw new Error("Analysis not found");
      }

      // Check if walkthrough already exists
      let walkthrough = await Walkthrough.findOne({ analysisId });
      if (walkthrough) {
        return {
          success: true,
          walkthrough,
          message: "Walkthrough already exists",
        };
      }

      // Generate steps for each DTC
      const allSteps = [];
      const allParts = [];
      const allTools = new Set();
      let maxDifficulty = "easy";

      for (const dtc of analysis.dtcs) {
        const dtcSteps = await this.generateStepsForDTC(dtc, analysis.vehicleId);
        
        // Add DTC-specific steps
        allSteps.push(...dtcSteps.steps);
        allParts.push(...dtcSteps.parts);
        dtcSteps.tools.forEach(tool => allTools.add(tool));
        
        // Update difficulty level
        if (this.getDifficultyLevel(dtcSteps.difficulty) > this.getDifficultyLevel(maxDifficulty)) {
          maxDifficulty = dtcSteps.difficulty;
        }
      }

      // Sort steps by order
      allSteps.sort((a, b) => a.order - b.order);

      // Create walkthrough
      walkthrough = new Walkthrough({
        analysisId,
        steps: allSteps,
        parts: allParts,
        tools: Array.from(allTools),
        difficulty: maxDifficulty,
      });

      await walkthrough.save();

      // Log activity
      await AuditLog.create({
        actorId: userId,
        orgId: orgId,
        action: "walkthrough_created",
        target: {
          type: "walkthrough",
          id: walkthrough._id,
          analysisId: analysisId,
          stepCount: allSteps.length,
          dtcCount: analysis.dtcs.length,
        },
      });

      // Record API usage
      await Metering.create({
        orgId: orgId,
        userId: userId,
        type: "walkthrough",
        count: 1,
        period: new Date().toISOString().slice(0, 7), // YYYY-MM format
      });

      return {
        success: true,
        walkthrough,
        message: "Walkthrough generated successfully",
      };
    } catch (error) {
      console.error("Walkthrough generation error:", error);
      throw error;
    }
  }

  /**
   * Generate steps for a specific DTC
   * @param {Object} dtc - DTC object with code and description
   * @param {Object} vehicle - Vehicle information
   * @returns {Promise<Object>} Steps, parts, and tools for the DTC
   */
  async generateStepsForDTC(dtc, vehicle) {
    try {
      // Check if we have predefined steps for this DTC
      if (this.dtcRepairSteps[dtc.code]) {
        return this.dtcRepairSteps[dtc.code];
      }

      // Try to generate AI-enhanced steps
      try {
        const aiSteps = await this.generateAISteps(dtc, vehicle);
        if (aiSteps && aiSteps.steps.length > 0) {
          return aiSteps;
        }
      } catch (aiError) {
        console.warn(`AI step generation failed for DTC ${dtc.code}:`, aiError.message);
      }

      // Fall back to default steps
      return this.defaultSteps;
    } catch (error) {
      console.error(`Error generating steps for DTC ${dtc.code}:`, error);
      return this.defaultSteps;
    }
  }

  /**
   * Generate AI-enhanced repair steps
   * @param {Object} dtc - DTC object
   * @param {Object} vehicle - Vehicle information
   * @returns {Promise<Object>} AI-generated steps
   */
  async generateAISteps(dtc, vehicle) {
    try {
      const prompt = `Generate detailed repair steps for automotive diagnostic trouble code ${dtc.code} on a ${vehicle?.make || 'VW'} ${vehicle?.model || 'vehicle'} ${vehicle?.year || ''}.

Error Description: ${dtc.description}

Please provide:
1. 3-5 specific repair steps in order (check, replace, retest)
2. Required parts (OEM and alternatives)
3. Required tools
4. Difficulty level (easy, medium, hard, expert)
5. Time estimates for each step

Format as JSON with this structure:
{
  "steps": [
    {
      "title": "Step title",
      "detail": "Detailed description",
      "type": "check|replace|retest",
      "estMinutes": 30,
      "order": 1
    }
  ],
  "parts": [
    {
      "name": "Part name",
      "oem": "OEM part number",
      "alt": ["Alternative 1", "Alternative 2"],
      "qty": 1,
      "estimatedCost": 5000
    }
  ],
  "tools": ["Tool 1", "Tool 2"],
  "difficulty": "medium"
}`;

      const completion = await openaiService.generateAIExplanation(
        dtc.code,
        dtc.description,
        vehicle?.make || 'VW',
        vehicle?.model || 'vehicle'
      );

      // Parse AI response (this is a simplified version - in production you'd want more robust parsing)
      try {
        const aiResponse = JSON.parse(completion);
        return aiResponse;
      } catch (parseError) {
        console.warn("Failed to parse AI response as JSON:", parseError);
        return null;
      }
    } catch (error) {
      console.error("AI step generation error:", error);
      return null;
    }
  }

  /**
   * Get walkthrough by analysis ID
   * @param {string} analysisId - Analysis ID
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Walkthrough data
   */
  async getWalkthrough(analysisId, userId, orgId) {
    try {
      const walkthrough = await Walkthrough.findOne({ analysisId })
        .populate("analysisId", "dtcs summary vehicleId");

      if (!walkthrough) {
        throw new Error("Walkthrough not found");
      }

      return {
        success: true,
        walkthrough,
      };
    } catch (error) {
      console.error("Get walkthrough error:", error);
      throw error;
    }
  }

  /**
   * Update walkthrough steps
   * @param {string} walkthroughId - Walkthrough ID
   * @param {Array} steps - Updated steps
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Updated walkthrough
   */
  async updateWalkthrough(walkthroughId, steps, userId, orgId) {
    try {
      const walkthrough = await Walkthrough.findByIdAndUpdate(
        walkthroughId,
        { steps },
        { new: true }
      );

      if (!walkthrough) {
        throw new Error("Walkthrough not found");
      }

      // Log update
      await AuditLog.create({
        actorId: userId,
        orgId: orgId,
        action: "walkthrough_updated",
        target: {
          type: "walkthrough",
          id: walkthroughId,
          stepCount: steps.length,
        },
      });

      return {
        success: true,
        walkthrough,
        message: "Walkthrough updated successfully",
      };
    } catch (error) {
      console.error("Update walkthrough error:", error);
      throw error;
    }
  }

  /**
   * Add new step to walkthrough
   * @param {string} walkthroughId - Walkthrough ID
   * @param {Object} step - New step data
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Updated walkthrough
   */
  async addStep(walkthroughId, step, userId, orgId) {
    try {
      const walkthrough = await Walkthrough.findById(walkthroughId);
      if (!walkthrough) {
        throw new Error("Walkthrough not found");
      }

      // Set order if not provided
      if (!step.order) {
        step.order = walkthrough.steps.length + 1;
      }

      walkthrough.steps.push(step);
      await walkthrough.save();

      // Log addition
      await AuditLog.create({
        actorId: userId,
        orgId: orgId,
        action: "walkthrough_step_added",
        target: {
          type: "walkthrough",
          id: walkthroughId,
          stepTitle: step.title,
        },
      });

      return {
        success: true,
        walkthrough,
        message: "Step added successfully",
      };
    } catch (error) {
      console.error("Add step error:", error);
      throw error;
    }
  }

  /**
   * Delete walkthrough
   * @param {string} walkthroughId - Walkthrough ID
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Success status
   */
  async deleteWalkthrough(walkthroughId, userId, orgId) {
    try {
      const walkthrough = await Walkthrough.findByIdAndDelete(walkthroughId);
      if (!walkthrough) {
        throw new Error("Walkthrough not found");
      }

      // Log deletion
      await AuditLog.create({
        actorId: userId,
        orgId: orgId,
        action: "walkthrough_deleted",
        target: {
          type: "walkthrough",
          id: walkthroughId,
        },
      });

      return {
        success: true,
        message: "Walkthrough deleted successfully",
      };
    } catch (error) {
      console.error("Delete walkthrough error:", error);
      throw error;
    }
  }

  /**
   * Get difficulty level as number for comparison
   * @param {string} difficulty - Difficulty string
   * @returns {number} Difficulty level
   */
  getDifficultyLevel(difficulty) {
    const levels = { easy: 1, medium: 2, hard: 3, expert: 4 };
    return levels[difficulty] || 2;
  }
}

module.exports = new WalkthroughService();
