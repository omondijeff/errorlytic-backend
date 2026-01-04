const User = require("../models/User");
const Organization = require("../models/Organization");
const Quotation = require("../models/Quotation");

describe("Errorlytic Core Functionality Test", () => {
  test("should create and authenticate a user", async () => {
    // Create organization
    const org = new Organization({
      type: "garage",
      name: "Test Garage",
      country: "Kenya",
      currency: "KES",
    });
    await org.save();

    // Create user
    const user = new User({
      email: "test@errorlytic.com",
      passwordHash: "TestPassword123",
      profile: {
        name: "Test User",
        phone: "+254712345678",
        country: "Kenya",
      },
      role: "garage_user",
      orgId: org._id,
    });
    await user.save();

    // Verify user was created
    expect(user._id).toBeDefined();
    expect(user.email).toBe("test@errorlytic.com");
    expect(user.role).toBe("garage_user");
    expect(user.orgId.toString()).toBe(org._id.toString());
    expect(user.passwordHash).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash pattern

    // Test password comparison
    const isValidPassword = await user.comparePassword("TestPassword123");
    expect(isValidPassword).toBe(true);

    const isInvalidPassword = await user.comparePassword("WrongPassword");
    expect(isInvalidPassword).toBe(false);
  });

  test("should create organization with multi-currency support", async () => {
    const org = new Organization({
      type: "insurer",
      name: "Test Insurance",
      country: "Uganda",
      currency: "UGX",
      settings: {
        laborRatePerHour: 50000,
        taxRatePct: 18,
        defaultMarkupPct: 12,
      },
    });
    await org.save();

    expect(org.type).toBe("insurer");
    expect(org.currency).toBe("UGX");
    expect(org.settings.laborRatePerHour).toBe(50000);
    expect(org.settings.taxRatePct).toBe(18);
    expect(org.settings.defaultMarkupPct).toBe(12);
  });

  test("should create quotation with proper calculations", async () => {
    // Create organization
    const org = new Organization({
      type: "garage",
      name: "Test Garage",
      country: "Kenya",
      currency: "KES",
    });
    await org.save();

    // Create analysis (simplified)
    const analysis = {
      _id: "507f1f77bcf86cd799439011",
      dtcs: [{ code: "P0299", description: "Turbo underboost" }],
    };

    // Create quotation
    const quotation = new Quotation({
      orgId: org._id,
      analysisId: analysis._id,
      currency: "KES",
      labor: {
        hours: 2.5,
        ratePerHour: 1500,
        subtotal: 3750,
      },
      parts: [
        {
          name: "Boost pressure sensor",
          unitPrice: 6500,
          qty: 1,
          subtotal: 6500,
        },
      ],
      taxPct: 16,
      markupPct: 10,
      totals: {
        parts: 6500,
        labor: 3750,
        tax: 1640,
        grand: 11890,
      },
    });
    await quotation.save();

    // Verify quotation calculations
    expect(quotation.totals.parts).toBe(6500);
    expect(quotation.totals.labor).toBe(3750);

    // Calculate expected values:
    // Subtotal: 6500 + 3750 = 10250
    // After 10% markup: 10250 * 1.10 = 11275
    // Tax (16%): 11275 * 0.16 = 1804
    // Grand total: 11275 + 1804 = 13079
    expect(quotation.totals.tax).toBeCloseTo(1804, 2);
    expect(quotation.totals.grand).toBeCloseTo(13079, 2);
    expect(quotation.currency).toBe("KES");
  });

  test("should support all required currencies", () => {
    const currencies = ["KES", "UGX", "TZS", "USD"];

    currencies.forEach((currency) => {
      const org = new Organization({
        type: "garage",
        name: `Test Garage ${currency}`,
        country: "Kenya",
        currency: currency,
      });

      expect(org.currency).toBe(currency);
    });
  });

  test("should validate RBAC roles", () => {
    const roles = [
      "individual",
      "garage_user",
      "garage_admin",
      "insurer_user",
      "insurer_admin",
      "superadmin",
    ];

    roles.forEach((role) => {
      const user = new User({
        email: `${role}@test.com`,
        passwordHash: "TestPassword123",
        profile: { name: "Test User" },
        role: role,
      });

      expect(user.role).toBe(role);
    });
  });
});
