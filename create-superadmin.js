#!/usr/bin/env node

/**
 * Script to create a super admin user for Errorlytic
 * This bypasses the registration endpoint restrictions
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Import User model
const User = require("./models/User");

async function createSuperAdmin() {
  try {
    // Connect to MongoDB
    const mongoUri =
      process.env.MONGODB_URI ||
      "mongodb://admin:password123@localhost:27017/errorlytic_saas?authSource=admin";
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    // Check if super admin already exists
    const existingSuperAdmin = await User.findOne({ role: "superadmin" });
    if (existingSuperAdmin) {
      console.log("⚠️  Super admin already exists:", existingSuperAdmin.email);
      console.log("📧 Email:", existingSuperAdmin.email);
      console.log("👤 Name:", existingSuperAdmin.profile.name);
      console.log("🔑 Role:", existingSuperAdmin.role);
      return;
    }

    // Create super admin user
    const superAdminData = {
      email: "admin@Errorlytic.com",
      passwordHash: await bcrypt.hash("AdminPassword123", 12),
      profile: {
        name: "Errorlytic Super Admin",
        phone: "+254700000000",
        country: "Kenya",
      },
      role: "superadmin",
      plan: {
        tier: "enterprise",
        status: "active",
        renewsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      },
      quotas: {
        apiCalls: {
          used: 0,
          limit: 10000, // High limit for super admin
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      },
      isActive: true,
    };

    const superAdmin = new User(superAdminData);
    await superAdmin.save();

    console.log("🎉 Super admin created successfully!");
    console.log("📧 Email: admin@Errorlytic.com");
    console.log("🔑 Password: AdminPassword123");
    console.log("👤 Name: Errorlytic Super Admin");
    console.log("🔑 Role: superadmin");
    console.log("📊 Plan: Enterprise");
    console.log("📈 API Limit: 10,000 calls/year");
    console.log("");
    console.log(
      "🚀 You can now use these credentials to log in as super admin!"
    );
  } catch (error) {
    console.error("❌ Error creating super admin:", error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
  }
}

// Run the script
createSuperAdmin();
