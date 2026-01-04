#!/usr/bin/env node

/**
 * Simple test script to verify the Errorlytic SaaS system functionality
 * Run this after starting the system to test basic functionality
 */

const axios = require("axios");

const BASE_URL = "http://localhost:3000";
let authToken = null;

async function testSystem() {
  console.log("🚗 Testing Errorlytic SaaS System...\n");

  try {
    // Test 1: Health Check
    console.log("1️⃣ Testing Health Check...");
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log("✅ Health Check:", healthResponse.data.status);
    console.log("   Environment:", healthResponse.data.environment);
    console.log(
      "   Uptime:",
      Math.round(healthResponse.data.uptime),
      "seconds\n"
    );

    // Test 2: API Root
    console.log("2️⃣ Testing API Root...");
    const rootResponse = await axios.get(`${BASE_URL}/`);
    console.log("✅ API Root:", rootResponse.data.message);
    console.log("   Version:", rootResponse.data.version);
    console.log(
      "   Endpoints:",
      Object.keys(rootResponse.data.endpoints).length,
      "available\n"
    );

    // Test 3: User Registration
    console.log("3️⃣ Testing User Registration...");
    const testUser = {
      email: `test-${Date.now()}@example.com`,
      password: "testpassword123",
      firstName: "Test",
      lastName: "User",
      company: "Test Garage",
      phone: "+254700000000",
    };

    const registerResponse = await axios.post(
      `${BASE_URL}/api/auth/register`,
      testUser
    );
    console.log("✅ User Registration:", registerResponse.data.message);
    console.log("   User ID:", registerResponse.data.data.user.id);
    console.log("   Role:", registerResponse.data.data.user.role);

    authToken = registerResponse.data.data.token;
    console.log("   Token received\n");

    // Test 4: User Login
    console.log("4️⃣ Testing User Login...");
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: testUser.email,
      password: testUser.password,
    });
    console.log("✅ User Login:", loginResponse.data.message);
    console.log(
      "   Last Login:",
      loginResponse.data.data.user.lastLogin ? "Updated" : "Not set\n"
    );

    // Test 5: Get User Profile
    console.log("5️⃣ Testing Get User Profile...");
    const profileResponse = await axios.get(`${BASE_URL}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    console.log("✅ Get Profile:", "Profile retrieved successfully");
    console.log(
      "   User:",
      profileResponse.data.data.user.firstName,
      profileResponse.data.data.user.lastName
    );
    console.log(
      "   Company:",
      profileResponse.data.data.user.company || "Not set\n"
    );

    // Test 6: Create Quotation
    console.log("6️⃣ Testing Create Quotation...");
    const quotationData = {
      vehicleInfo: {
        make: "Volkswagen",
        model: "Golf",
        year: 2020,
        vin: "WVWZZZ1KZAW123456",
        mileage: 50000,
      },
      notes: "Engine check light on, rough idle",
    };

    const quotationResponse = await axios.post(
      `${BASE_URL}/api/quotations`,
      quotationData,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );
    console.log("✅ Create Quotation:", quotationResponse.data.message);
    console.log("   Quotation ID:", quotationResponse.data.data.quotation._id);
    console.log(
      "   Vehicle:",
      quotationResponse.data.data.quotation.vehicleInfo.make,
      quotationResponse.data.data.quotation.vehicleInfo.model
    );
    console.log("   Status:", quotationResponse.data.data.quotation.status);
    console.log(
      "   Total Cost:",
      quotationResponse.data.data.quotation.totalEstimate.totalCost,
      "KES\n"
    );

    // Test 7: Get Quotations List
    console.log("7️⃣ Testing Get Quotations...");
    const quotationsResponse = await axios.get(`${BASE_URL}/api/quotations`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    console.log("✅ Get Quotations:", "Quotations retrieved successfully");
    console.log(
      "   Total Quotations:",
      quotationsResponse.data.data.pagination.totalItems
    );
    console.log(
      "   Current Page:",
      quotationsResponse.data.data.pagination.currentPage
    );
    console.log(
      "   Items Per Page:",
      quotationsResponse.data.data.pagination.itemsPerPage,
      "\n"
    );

    // Test 8: Get Error Codes
    console.log("8️⃣ Testing Get Error Codes...");
    const errorCodesResponse = await axios.get(
      `${BASE_URL}/api/error-codes?limit=5`
    );
    console.log("✅ Get Error Codes:", "Error codes retrieved successfully");
    console.log(
      "   Total Error Codes:",
      errorCodesResponse.data.data.pagination.totalItems
    );
    console.log(
      "   Retrieved:",
      errorCodesResponse.data.data.errorCodes.length
    );
    console.log(
      "   Sample Codes:",
      errorCodesResponse.data.data.errorCodes.map((ec) => ec.code).join(", "),
      "\n"
    );

    // Test 9: Search Error Codes
    console.log("9️⃣ Testing Error Code Search...");
    const searchResponse = await axios.get(
      `${BASE_URL}/api/error-codes/search/autocomplete?q=P0300`
    );
    console.log("✅ Error Code Search:", "Search completed successfully");
    console.log(
      "   Search Results:",
      searchResponse.data.data.errorCodes.length
    );
    if (searchResponse.data.data.errorCodes.length > 0) {
      console.log(
        "   First Result:",
        searchResponse.data.data.errorCodes[0].code,
        "-",
        searchResponse.data.data.errorCodes[0].description
      );
    }
    console.log("");

    // Test 10: Get Error Code Statistics
    console.log("🔟 Testing Error Code Statistics...");
    const statsResponse = await axios.get(
      `${BASE_URL}/api/error-codes/stats/summary`
    );
    console.log("✅ Error Code Stats:", "Statistics retrieved successfully");
    console.log(
      "   Total Error Codes:",
      statsResponse.data.data.summary.totalErrorCodes
    );
    console.log(
      "   Average Cost:",
      statsResponse.data.data.summary.avgCost,
      "KES"
    );
    console.log(
      "   Categories:",
      statsResponse.data.data.summary.categoryCount
    );
    console.log(
      "   Severity Levels:",
      statsResponse.data.data.summary.severityCount,
      "\n"
    );

    console.log("🎉 All tests completed successfully!");
    console.log("📊 System is working correctly.");
    console.log(
      "🔧 You can now use the API endpoints for your VAG car quotation system.\n"
    );
  } catch (error) {
    console.error("❌ Test failed:", error.message);

    if (error.response) {
      console.error("   Status:", error.response.status);
      console.error("   Data:", error.response.data);
    }

    console.log(
      "\n💡 Make sure the system is running and accessible at:",
      BASE_URL
    );
    console.log("💡 Check that MongoDB is running and accessible");
    console.log("💡 Verify all environment variables are set correctly");
  }
}

// Run the tests
if (require.main === module) {
  testSystem();
}

module.exports = { testSystem };
