const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const authRoutes = require("../../routes/auth");
const User = require("../../models/User");
const Organization = require("../../models/Organization");

// Create test app
const app = express();
app.use(express.json());
app.use("/api/v1/auth", authRoutes);

describe("Auth Routes", () => {
  let testOrg;

  beforeEach(async () => {
    // Create test organization
    testOrg = new Organization({
      type: "garage",
      name: "Test Garage",
      country: "Kenya",
      currency: "KES",
    });
    await testOrg.save();
  });

  describe("POST /api/v1/auth/register", () => {
    test("should register a new individual user", async () => {
      const userData = {
        email: "newuser@example.com",
        password: "Password123",
        profile: {
          name: "New User",
          phone: "+254712345678",
          country: "Kenya",
        },
        role: "individual",
      };

      const response = await request(app)
        .post("/api/v1/auth/register")
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("User registered successfully");
      expect(response.body.data.user.email).toBe("newuser@example.com");
      expect(response.body.data.user.role).toBe("individual");
      expect(response.body.data.user.profile.name).toBe("New User");
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();

      // Verify user was created in database
      await new Promise((resolve) => setTimeout(resolve, 200)); // Increased wait time
      const user = await User.findOne({ email: "newuser@example.com" });
      expect(user).toBeTruthy();
      expect(user.role).toBe("individual");
      expect(user.orgId).toBeNull();
    });

    test("should register a new organization user", async () => {
      const userData = {
        email: "garageuser@example.com",
        password: "Password123",
        profile: {
          name: "Garage User",
        },
        role: "garage_user",
        orgId: testOrg._id.toString(),
      };

      const response = await request(app)
        .post("/api/v1/auth/register")
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe("garage_user");
      expect(response.body.data.user.orgId).toBe(testOrg._id.toString());

      // Verify user was created in database
      const user = await User.findOne({ email: "garageuser@example.com" });
      expect(user).toBeTruthy();
      expect(user.orgId.toString()).toBe(testOrg._id.toString());
    });

    test("should reject registration with invalid email", async () => {
      const userData = {
        email: "invalid-email",
        password: "Password123",
        profile: {
          name: "Test User",
        },
      };

      const response = await request(app)
        .post("/api/v1/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body.type).toBe("validation_error");
      expect(response.body.title).toBe("Validation Failed");
    });

    test("should reject registration with weak password", async () => {
      const userData = {
        email: "test@example.com",
        password: "weak",
        profile: {
          name: "Test User",
        },
      };

      const response = await request(app)
        .post("/api/v1/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body.type).toBe("validation_error");
    });

    test("should reject registration with existing email", async () => {
      // First create a user
      const user = new User({
        email: "existing@example.com",
        passwordHash: "hashedpassword123",
        profile: { name: "Existing User" },
      });
      await user.save();

      const userData = {
        email: "existing@example.com",
        password: "Password123",
        profile: {
          name: "New User",
        },
      };

      const response = await request(app)
        .post("/api/v1/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body.type).toBe("user_exists");
      expect(response.body.title).toBe("User Already Exists");
    });

    test("should reject registration with invalid organization ID", async () => {
      const userData = {
        email: "test@example.com",
        password: "Password123",
        profile: {
          name: "Test User",
        },
        role: "garage_user",
        orgId: "507f1f77bcf86cd799439011", // Invalid ObjectId
      };

      const response = await request(app)
        .post("/api/v1/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body.type).toBe("invalid_organization");
    });
  });

  describe("POST /api/v1/auth/login", () => {
    let testUser;

    beforeEach(async () => {
      // Create test user with plain password (will be hashed by pre-save middleware)
      testUser = new User({
        email: "login@example.com",
        passwordHash: "Password123", // Will be hashed by pre-save middleware
        profile: {
          name: "Login User",
        },
        role: "individual",
      });
      await testUser.save();

      // Wait a bit to ensure user is saved and password is hashed
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    test("should login with valid credentials", async () => {
      const loginData = {
        email: "login@example.com",
        password: "Password123",
      };

      const response = await request(app)
        .post("/api/v1/auth/login")
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Login successful");
      expect(response.body.data.user.email).toBe("login@example.com");
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    test("should reject login with invalid email", async () => {
      const loginData = {
        email: "nonexistent@example.com",
        password: "Password123",
      };

      const response = await request(app)
        .post("/api/v1/auth/login")
        .send(loginData)
        .expect(401);

      expect(response.body.type).toBe("invalid_credentials");
      expect(response.body.title).toBe("Invalid Credentials");
    });

    test("should reject login with invalid password", async () => {
      const loginData = {
        email: "login@example.com",
        password: "WrongPassword",
      };

      const response = await request(app)
        .post("/api/v1/auth/login")
        .send(loginData)
        .expect(401);

      expect(response.body.type).toBe("invalid_credentials");
    });

    test("should reject login for deactivated user", async () => {
      // Deactivate user
      testUser.isActive = false;
      await testUser.save();

      // Wait for save to complete
      await new Promise((resolve) => setTimeout(resolve, 200));

      const loginData = {
        email: "login@example.com",
        password: "Password123",
      };

      const response = await request(app)
        .post("/api/v1/auth/login")
        .send(loginData)
        .expect(401);

      expect(response.body.type).toBe("account_deactivated");
      expect(response.body.title).toBe("Account Deactivated");
    });
  });

  describe("POST /api/v1/auth/refresh", () => {
    let testUser;
    let refreshToken;

    beforeEach(async () => {
      // Create test user
      testUser = new User({
        email: "refresh@example.com",
        passwordHash: "Password123",
        profile: { name: "Refresh User" },
        role: "individual",
      });
      await testUser.save();

      // Generate refresh token
      const jwt = require("jsonwebtoken");
      refreshToken = jwt.sign(
        { userId: testUser._id, type: "refresh" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );
    });

    test("should refresh token with valid refresh token", async () => {
      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Token refreshed successfully");
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    test("should reject refresh with invalid token", async () => {
      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: "invalid-token" })
        .expect(401);

      expect(response.body.type).toBe("invalid_token");
      expect(response.body.title).toBe("Invalid Token");
    });

    test("should reject refresh with access token instead of refresh token", async () => {
      const jwt = require("jsonwebtoken");
      const accessToken = jwt.sign(
        { userId: testUser._id },
        process.env.JWT_SECRET,
        {
          expiresIn: "15m",
        }
      );

      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: accessToken })
        .expect(401);

      expect(response.body.type).toBe("invalid_token");
    });
  });
});
