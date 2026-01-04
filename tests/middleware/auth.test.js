const jwt = require("jsonwebtoken");
const {
  authMiddleware,
  requireRole,
  requireOrgAccess,
  superadminMiddleware,
} = require("../../middleware/auth");
const User = require("../../models/User");
const Organization = require("../../models/Organization");

// Mock request and response objects
const createMockReq = (headers = {}) => ({
  header: (name) => headers[name],
  headers,
});

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createMockNext = () => jest.fn();

describe("Authentication Middleware", () => {
  let testUser;
  let testOrg;
  let validToken;

  beforeEach(async () => {
    // Create test organization
    testOrg = new Organization({
      type: "garage",
      name: "Test Garage",
      country: "Kenya",
      currency: "KES",
    });
    await testOrg.save();

    // Create test user with unique email
    const timestamp = Date.now();
    testUser = new User({
      email: `test${timestamp}@example.com`,
      passwordHash: "hashedpassword123",
      profile: {
        name: "Test User",
      },
      role: "garage_user",
      orgId: testOrg._id,
    });
    await testUser.save();

    // Generate valid token
    validToken = jwt.sign({ userId: testUser._id }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });
  });

  describe("authMiddleware", () => {
    test("should authenticate user with valid token", async () => {
      const req = createMockReq({ Authorization: `Bearer ${validToken}` });
      const res = createMockRes();
      const next = createMockNext();

      await authMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user._id.toString()).toBe(testUser._id.toString());
      expect(req.user.email).toBe(testUser.email);
      expect(req.user.role).toBe("garage_user");
    });

    test("should reject request without token", async () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Access denied. No token provided.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should reject request with invalid token", async () => {
      const req = createMockReq({ Authorization: "Bearer invalid-token" });
      const res = createMockRes();
      const next = createMockNext();

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Invalid token.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should reject request with expired token", async () => {
      const expiredToken = jwt.sign(
        { userId: testUser._id },
        process.env.JWT_SECRET,
        {
          expiresIn: "-1h", // Expired token
        }
      );

      const req = createMockReq({ Authorization: `Bearer ${expiredToken}` });
      const res = createMockRes();
      const next = createMockNext();

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Token expired.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should reject request for deactivated user", async () => {
      // Deactivate user
      testUser.isActive = false;
      await testUser.save();

      const req = createMockReq({ Authorization: `Bearer ${validToken}` });
      const res = createMockRes();
      const next = createMockNext();

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Account is deactivated.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should populate organization for organization users", async () => {
      const req = createMockReq({ Authorization: `Bearer ${validToken}` });
      const res = createMockRes();
      const next = createMockNext();

      await authMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.organization).toBeDefined();
      if (req.user.organization) {
        expect(req.user.organization._id.toString()).toBe(
          testOrg._id.toString()
        );
        expect(req.user.organization.name).toBe("Test Garage");
      }
    });
  });

  describe("requireRole", () => {
    test("should allow access for user with required role", async () => {
      const middleware = requireRole(["garage_user", "garage_admin"]);
      const req = createMockReq({ Authorization: `Bearer ${validToken}` });
      const res = createMockRes();
      const next = createMockNext();

      await authMiddleware(req, res, () => {}); // First authenticate
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test("should deny access for user without required role", async () => {
      const middleware = requireRole(["superadmin"]);
      const req = createMockReq({ Authorization: `Bearer ${validToken}` });
      const res = createMockRes();
      const next = createMockNext();

      await authMiddleware(req, res, () => {}); // First authenticate
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Access denied. Required roles: superadmin",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should allow access for user with multiple required roles", async () => {
      const middleware = requireRole([
        "garage_user",
        "garage_admin",
        "superadmin",
      ]);
      const req = createMockReq({ Authorization: `Bearer ${validToken}` });
      const res = createMockRes();
      const next = createMockNext();

      await authMiddleware(req, res, () => {}); // First authenticate
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("requireOrgAccess", () => {
    test("should allow access for superadmin regardless of organization", async () => {
      // Create superadmin user
      const superadmin = new User({
        email: "superadmin@example.com",
        passwordHash: "hashedpassword123",
        profile: { name: "Super Admin" },
        role: "superadmin",
      });
      await superadmin.save();

      const superadminToken = jwt.sign(
        { userId: superadmin._id },
        process.env.JWT_SECRET,
        {
          expiresIn: "15m",
        }
      );

      const middleware = requireOrgAccess(["garage"]);
      const req = createMockReq({ Authorization: `Bearer ${superadminToken}` });
      const res = createMockRes();
      const next = createMockNext();

      await authMiddleware(req, res, () => {}); // First authenticate
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test("should allow access for individual users", async () => {
      // Create individual user
      const individual = new User({
        email: "individual@example.com",
        passwordHash: "hashedpassword123",
        profile: { name: "Individual User" },
        role: "individual",
      });
      await individual.save();

      const individualToken = jwt.sign(
        { userId: individual._id },
        process.env.JWT_SECRET,
        {
          expiresIn: "15m",
        }
      );

      const middleware = requireOrgAccess(["garage"]);
      const req = createMockReq({ Authorization: `Bearer ${individualToken}` });
      const res = createMockRes();
      const next = createMockNext();

      await authMiddleware(req, res, () => {}); // First authenticate
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test("should allow access for organization user with correct type", async () => {
      const middleware = requireOrgAccess(["garage"]);
      const req = createMockReq({ Authorization: `Bearer ${validToken}` });
      const res = createMockRes();
      const next = createMockNext();

      await authMiddleware(req, res, () => {}); // First authenticate
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test("should deny access for organization user with wrong type", async () => {
      const middleware = requireOrgAccess(["insurer"]);
      const req = createMockReq({ Authorization: `Bearer ${validToken}` });
      const res = createMockRes();
      const next = createMockNext();

      await authMiddleware(req, res, () => {}); // First authenticate

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Access denied. Organization type must be: insurer",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("should deny access for organization user without organization", async () => {
      // Create user without organization
      const userWithoutOrg = new User({
        email: "noorg@example.com",
        passwordHash: "hashedpassword123",
        profile: { name: "No Org User" },
        role: "garage_user",
        orgId: null,
      });
      await userWithoutOrg.save();

      const noOrgToken = jwt.sign(
        { userId: userWithoutOrg._id },
        process.env.JWT_SECRET,
        {
          expiresIn: "15m",
        }
      );

      const middleware = requireOrgAccess(["garage"]);
      const req = createMockReq({ Authorization: `Bearer ${noOrgToken}` });
      const res = createMockRes();
      const next = createMockNext();

      await authMiddleware(req, res, () => {}); // First authenticate
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Access denied. Organization membership required.",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("superadminMiddleware", () => {
    test("should allow access for superadmin", async () => {
      // Create superadmin user
      const superadmin = new User({
        email: "superadmin@example.com",
        passwordHash: "hashedpassword123",
        profile: { name: "Super Admin" },
        role: "superadmin",
      });
      await superadmin.save();

      const superadminToken = jwt.sign(
        { userId: superadmin._id },
        process.env.JWT_SECRET,
        {
          expiresIn: "15m",
        }
      );

      const req = createMockReq({ Authorization: `Bearer ${superadminToken}` });
      const res = createMockRes();
      const next = createMockNext();

      await authMiddleware(req, res, () => {}); // First authenticate
      await superadminMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test("should deny access for non-superadmin", async () => {
      const req = createMockReq({ Authorization: `Bearer ${validToken}` });
      const res = createMockRes();
      const next = createMockNext();

      await authMiddleware(req, res, () => {}); // First authenticate
      await superadminMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Access denied. Required roles: superadmin",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
