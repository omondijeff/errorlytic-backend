const openaiService = require("./services/openaiService");

async function testAI() {
  try {
    console.log("Testing AI service...");

    const errorCodes = [
      {
        code: "17158",
        description: "Databus",
        severity: "medium",
        category: "Electrical",
        estimatedCost: 8000,
      },
    ];

    const vehicleInfo = {
      make: "Volkswagen",
      model: "Passat",
      year: "2020",
    };

    console.log("Calling generateAIEnhancedEstimate...");
    const result = await openaiService.generateAIEnhancedEstimate(
      errorCodes,
      vehicleInfo
    );

    console.log("AI Result:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error testing AI:", error);
  }
}

testAI();


