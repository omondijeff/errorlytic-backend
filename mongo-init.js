// MongoDB initialization script
db = db.getSiblingDB("errorlytic_saas");

// Create collections
db.createCollection("users");
db.createCollection("quotations");
db.createCollection("error_codes");
db.createCollection("repair_costs");

// Create indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.quotations.createIndex({ createdAt: -1 });
db.error_codes.createIndex({ code: 1 }, { unique: true });

// Insert initial error codes data for VAG vehicles
db.error_codes.insertMany([
  {
    code: "P0300",
    description: "Random/Multiple Cylinder Misfire Detected",
    severity: "high",
    common_causes: [
      "Faulty spark plugs",
      "Bad ignition coils",
      "Fuel injector issues",
      "Low fuel pressure",
    ],
    estimated_repair_time: "2-4 hours",
    estimated_cost_kes: 15000,
    vag_models: ["VW Golf", "Audi A3", "Skoda Octavia", "Seat Leon"],
  },
  {
    code: "P0171",
    description: "System Too Lean (Bank 1)",
    severity: "medium",
    common_causes: [
      "Mass airflow sensor",
      "Oxygen sensor",
      "Vacuum leak",
      "Fuel pressure regulator",
    ],
    estimated_repair_time: "1-3 hours",
    estimated_cost_kes: 12000,
    vag_models: ["VW Passat", "Audi A4", "Porsche 911", "Skoda Superb"],
  },
  {
    code: "P0420",
    description: "Catalyst System Efficiency Below Threshold (Bank 1)",
    severity: "medium",
    common_causes: [
      "Catalytic converter",
      "Oxygen sensors",
      "Exhaust leak",
      "Engine misfire",
    ],
    estimated_repair_time: "3-5 hours",
    estimated_cost_kes: 25000,
    vag_models: ["VW Tiguan", "Audi Q5", "Porsche Cayenne", "Seat Ateca"],
  },
  {
    code: "P0128",
    description: "Coolant Thermostat Temperature Below Regulating Temperature",
    severity: "low",
    common_causes: [
      "Thermostat",
      "Coolant temperature sensor",
      "Cooling system leak",
    ],
    estimated_repair_time: "1-2 hours",
    estimated_cost_kes: 8000,
    vag_models: ["VW Polo", "Audi A1", "Skoda Fabia", "Fiat 500"],
  },
  {
    code: "P0442",
    description:
      "Evaporative Emission Control System Leak Detected (Small Leak)",
    severity: "low",
    common_causes: [
      "Gas cap",
      "EVAP purge valve",
      "Charcoal canister",
      "Hoses",
    ],
    estimated_repair_time: "1-2 hours",
    estimated_cost_kes: 6000,
    vag_models: ["VW Jetta", "Audi A6", "Porsche Panamera", "Skoda Kodiaq"],
  },
]);

// Insert initial repair costs data
db.repair_costs.insertMany([
  {
    category: "Engine",
    subcategory: "Ignition System",
    estimated_cost_kes: 15000,
    labor_hours: 2,
    parts_cost_kes: 8000,
    labor_rate_kes: 3500,
  },
  {
    category: "Engine",
    subcategory: "Fuel System",
    estimated_cost_kes: 12000,
    labor_hours: 1.5,
    parts_cost_kes: 7000,
    labor_rate_kes: 3500,
  },
  {
    category: "Exhaust",
    subcategory: "Catalytic Converter",
    estimated_cost_kes: 25000,
    labor_hours: 3,
    parts_cost_kes: 18000,
    labor_rate_kes: 3500,
  },
  {
    category: "Cooling",
    subcategory: "Thermostat",
    estimated_cost_kes: 8000,
    labor_hours: 1,
    parts_cost_kes: 4000,
    labor_rate_kes: 3500,
  },
  {
    category: "Emissions",
    subcategory: "EVAP System",
    estimated_cost_kes: 6000,
    labor_hours: 1,
    parts_cost_kes: 3000,
    labor_rate_kes: 3500,
  },
]);

print("Database 'errorlytic_saas' initialized successfully!");
print("Inserted " + db.error_codes.count() + " error codes");
print("Inserted " + db.repair_costs.count() + " repair cost categories");
