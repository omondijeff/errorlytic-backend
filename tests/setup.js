const mongoose = require("mongoose");

// Mock environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-key";
process.env.MONGODB_URI =
  "mongodb://admin:password123@localhost:27017/errorlytic_test?authSource=admin";

// Disable server startup in test environment
process.env.DISABLE_SERVER_STARTUP = "true";

// Setup test database connection
beforeAll(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Test database connected");
  } catch (error) {
    console.error("Test database connection error:", error);
  }
});

// Clean up after each test
afterEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      try {
        await collection.deleteMany({});
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  }
});

// Close database connection after all tests
afterAll(async () => {
  try {
    await mongoose.connection.close();
    console.log("Test database connection closed");
  } catch (error) {
    console.error("Error closing test database:", error);
  }
});
