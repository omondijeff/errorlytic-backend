const User = require("../../models/User");
const Organization = require("../../models/Organization");

describe("User Model", () => {
  describe("User Creation", () => {
    test("should create a user with default individual role", async () => {
      const userData = {
        email: "test@example.com",
        passwordHash: "hashedpassword123",
        profile: {
          name: "Test User",
          phone: "+254712345678",
          country: "Kenya",
        },
      };

      const user = new User(userData);
      await user.save();

      expect(user.email).toBe("test@example.com");
      expect(user.role).toBe("individual");
      expect(user.profile.name).toBe("Test User");
      expect(user.plan.tier).toBe("starter");
      expect(user.plan.status).toBe("active");
      expect(user.quotas.apiCalls.limit).toBe(100);
      expect(user.isActive).toBe(true);
    });

    test("should create a user with organization role", async () => {
      // First create an organization
      const org = new Organization({
        type: "garage",
        name: "Test Garage",
        country: "Kenya",
        currency: "KES",
      });
      await org.save();

      const userData = {
        email: "garage@example.com",
        passwordHash: "hashedpassword123",
        profile: {
          name: "Garage User",
        },
        role: "garage_user",
        orgId: org._id,
      };

      const user = new User(userData);
      await user.save();

      expect(user.role).toBe("garage_user");
      expect(user.orgId.toString()).toBe(org._id.toString());
    });

    test("should validate required fields", async () => {
      const userData = {
        email: "test@example.com",
        // Missing passwordHash and profile.name
      };

      const user = new User(userData);

      await expect(user.save()).rejects.toThrow();
    });

    test("should validate email format", async () => {
      const userData = {
        email: "invalid-email",
        passwordHash: "hashedpassword123",
        profile: {
          name: "Test User",
        },
      };

      const user = new User(userData);

      await expect(user.save()).rejects.toThrow();
    });

    test("should validate role enum", async () => {
      const userData = {
        email: "test@example.com",
        passwordHash: "hashedpassword123",
        profile: {
          name: "Test User",
        },
        role: "invalid_role",
      };

      const user = new User(userData);

      await expect(user.save()).rejects.toThrow();
    });
  });

  describe("Password Hashing", () => {
    test("should hash password before saving", async () => {
      const userData = {
        email: "test@example.com",
        passwordHash: "plainpassword123",
        profile: {
          name: "Test User",
        },
      };

      const user = new User(userData);
      await user.save();

      expect(user.passwordHash).not.toBe("plainpassword123");
      expect(user.passwordHash).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash pattern
    });

    test("should compare password correctly", async () => {
      const userData = {
        email: "test@example.com",
        passwordHash: "plainpassword123",
        profile: {
          name: "Test User",
        },
      };

      const user = new User(userData);
      await user.save();

      const isValid = await user.comparePassword("plainpassword123");
      expect(isValid).toBe(true);

      const isInvalid = await user.comparePassword("wrongpassword");
      expect(isInvalid).toBe(false);
    });
  });

  describe("Plan and Quotas", () => {
    test("should set default plan and quotas", async () => {
      const userData = {
        email: "test@example.com",
        passwordHash: "hashedpassword123",
        profile: {
          name: "Test User",
        },
      };

      const user = new User(userData);
      await user.save();

      expect(user.plan.tier).toBe("starter");
      expect(user.plan.status).toBe("active");
      expect(user.quotas.apiCalls.used).toBe(0);
      expect(user.quotas.apiCalls.limit).toBe(100);
      expect(user.quotas.apiCalls.periodStart).toBeInstanceOf(Date);
      expect(user.quotas.apiCalls.periodEnd).toBeInstanceOf(Date);
    });

    test("should update quotas correctly", async () => {
      const userData = {
        email: "test@example.com",
        passwordHash: "hashedpassword123",
        profile: {
          name: "Test User",
        },
      };

      const user = new User(userData);
      await user.save();

      // Update quota usage
      user.quotas.apiCalls.used = 50;
      await user.save();

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.quotas.apiCalls.used).toBe(50);
    });
  });

  describe("JSON Output", () => {
    test("should exclude passwordHash from JSON output", async () => {
      const userData = {
        email: "test@example.com",
        passwordHash: "hashedpassword123",
        profile: {
          name: "Test User",
        },
      };

      const user = new User(userData);
      await user.save();

      const userJSON = user.toJSON();
      expect(userJSON.passwordHash).toBeUndefined();
      expect(userJSON.email).toBe("test@example.com");
    });
  });
});
