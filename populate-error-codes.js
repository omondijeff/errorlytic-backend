#!/usr/bin/env node

// Script to populate sample error codes in the database
const mongoose = require("mongoose");
const DtcLibrary = require("./models/ErrorCode");

// Sample error codes data
const sampleErrorCodes = [
  {
    code: "P0001",
    title: "Fuel Volume Regulator Control Circuit/Open",
    modules: ["Engine"],
    commonCauses: [
      "Faulty fuel volume regulator",
      "Wiring harness open or shorted",
      "ECU malfunction",
    ],
    checks: [
      "Check fuel volume regulator resistance",
      "Inspect wiring harness for damage",
      "Test ECU communication",
    ],
    replacements: [
      "Fuel volume regulator",
      "Wiring harness repair",
      "ECU replacement",
    ],
    estLaborMin: {
      min: 60,
      max: 120,
    },
    severity: "critical",
    description:
      "The fuel volume regulator controls the fuel pressure in the rail. This code indicates a problem with the regulator circuit.",
    symptoms: [
      "Engine misfire",
      "Poor fuel economy",
      "Rough idle",
      "Check engine light",
    ],
    technicalDetails: {
      ecuModule: "Engine Control Unit",
      dataBus: "CAN",
      freezeFrameData: true,
    },
    vagModels: [
      {
        make: "VW",
        models: ["Golf", "Passat", "Jetta"],
        years: {
          start: 2010,
          end: 2023,
        },
      },
      {
        make: "Audi",
        models: ["A3", "A4", "A6"],
        years: {
          start: 2010,
          end: 2023,
        },
      },
    ],
  },
  {
    code: "P0300",
    title: "Random/Multiple Cylinder Misfire Detected",
    modules: ["Engine"],
    commonCauses: [
      "Faulty spark plugs",
      "Bad ignition coils",
      "Fuel injector problems",
      "Low fuel pressure",
    ],
    checks: [
      "Check spark plug condition",
      "Test ignition coil resistance",
      "Verify fuel injector operation",
      "Check fuel pressure",
    ],
    replacements: [
      "Spark plugs",
      "Ignition coils",
      "Fuel injectors",
      "Fuel pump",
    ],
    estLaborMin: {
      min: 90,
      max: 180,
    },
    severity: "critical",
    description:
      "Multiple cylinders are experiencing misfires, indicating a systemic issue with ignition or fuel delivery.",
    symptoms: [
      "Engine misfire",
      "Rough idle",
      "Loss of power",
      "Poor acceleration",
    ],
    technicalDetails: {
      ecuModule: "Engine Control Unit",
      dataBus: "CAN",
      freezeFrameData: true,
    },
    vagModels: [
      {
        make: "VW",
        models: ["Golf", "Passat", "Jetta", "Tiguan"],
        years: {
          start: 2008,
          end: 2023,
        },
      },
      {
        make: "Audi",
        models: ["A3", "A4", "A6", "Q5"],
        years: {
          start: 2008,
          end: 2023,
        },
      },
    ],
  },
  {
    code: "P0171",
    title: "System Too Lean (Bank 1)",
    modules: ["Engine"],
    commonCauses: [
      "Vacuum leak",
      "Faulty MAF sensor",
      "Clogged fuel filter",
      "Weak fuel pump",
    ],
    checks: [
      "Check for vacuum leaks",
      "Test MAF sensor",
      "Inspect fuel filter",
      "Test fuel pump pressure",
    ],
    replacements: [
      "Vacuum hose repair",
      "MAF sensor",
      "Fuel filter",
      "Fuel pump",
    ],
    estLaborMin: {
      min: 45,
      max: 90,
    },
    severity: "recommended",
    description:
      "The engine is running too lean, meaning there's too much air or not enough fuel in the mixture.",
    symptoms: [
      "Poor fuel economy",
      "Rough idle",
      "Hesitation on acceleration",
      "Check engine light",
    ],
    technicalDetails: {
      ecuModule: "Engine Control Unit",
      dataBus: "CAN",
      freezeFrameData: true,
    },
    vagModels: [
      {
        make: "VW",
        models: ["Golf", "Passat", "Jetta"],
        years: {
          start: 2005,
          end: 2023,
        },
      },
      {
        make: "Audi",
        models: ["A3", "A4", "A6"],
        years: {
          start: 2005,
          end: 2023,
        },
      },
    ],
  },
  {
    code: "P0420",
    title: "Catalyst System Efficiency Below Threshold (Bank 1)",
    modules: ["Engine"],
    commonCauses: [
      "Faulty catalytic converter",
      "Oxygen sensor malfunction",
      "Exhaust leak",
      "Engine misfire",
    ],
    checks: [
      "Test catalytic converter efficiency",
      "Check oxygen sensor readings",
      "Inspect exhaust system",
      "Verify engine performance",
    ],
    replacements: ["Catalytic converter", "Oxygen sensors", "Exhaust repair"],
    estLaborMin: {
      min: 120,
      max: 240,
    },
    severity: "recommended",
    description:
      "The catalytic converter is not operating efficiently, likely due to age or damage.",
    symptoms: [
      "Check engine light",
      "Failed emissions test",
      "Reduced performance",
      "Rattling noise from exhaust",
    ],
    technicalDetails: {
      ecuModule: "Engine Control Unit",
      dataBus: "CAN",
      freezeFrameData: true,
    },
    vagModels: [
      {
        make: "VW",
        models: ["Golf", "Passat", "Jetta", "Tiguan"],
        years: {
          start: 2000,
          end: 2023,
        },
      },
      {
        make: "Audi",
        models: ["A3", "A4", "A6", "Q5"],
        years: {
          start: 2000,
          end: 2023,
        },
      },
    ],
  },
  {
    code: "P0441",
    title: "Evaporative Emission Control System Incorrect Purge Flow",
    modules: ["Engine"],
    commonCauses: [
      "Faulty purge valve",
      "Clogged charcoal canister",
      "Vacuum leak in EVAP system",
      "Faulty EVAP solenoid",
    ],
    checks: [
      "Test purge valve operation",
      "Check charcoal canister",
      "Inspect EVAP hoses",
      "Test EVAP solenoid",
    ],
    replacements: [
      "Purge valve",
      "Charcoal canister",
      "EVAP hoses",
      "EVAP solenoid",
    ],
    estLaborMin: {
      min: 30,
      max: 60,
    },
    severity: "monitor",
    description:
      "The EVAP system purge flow is incorrect, indicating a problem with the purge valve or related components.",
    symptoms: [
      "Check engine light",
      "Failed emissions test",
      "Fuel smell",
      "Rough idle",
    ],
    technicalDetails: {
      ecuModule: "Engine Control Unit",
      dataBus: "CAN",
      freezeFrameData: false,
    },
    vagModels: [
      {
        make: "VW",
        models: ["Golf", "Passat", "Jetta"],
        years: {
          start: 2000,
          end: 2023,
        },
      },
      {
        make: "Audi",
        models: ["A3", "A4", "A6"],
        years: {
          start: 2000,
          end: 2023,
        },
      },
    ],
  },
];

async function populateErrorCodes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      "mongodb://admin:password123@localhost:27018/Errorlytic_saas?authSource=admin"
    );
    console.log("✅ Connected to MongoDB");

    // Clear existing error codes
    await DtcLibrary.deleteMany({});
    console.log("✅ Cleared existing error codes");

    // Insert sample error codes
    const result = await DtcLibrary.insertMany(sampleErrorCodes);
    console.log(`✅ Inserted ${result.length} error codes`);

    // Verify insertion
    const count = await DtcLibrary.countDocuments();
    console.log(`✅ Total error codes in database: ${count}`);

    console.log("\n📋 Sample error codes inserted:");
    result.forEach((dtc) => {
      console.log(`  - ${dtc.code}: ${dtc.title}`);
    });
  } catch (error) {
    console.error("❌ Error populating error codes:", error);
  } finally {
    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
  }
}

// Run the script
populateErrorCodes();
