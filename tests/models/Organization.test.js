const Organization = require("../../models/Organization");

describe("Organization Model", () => {
  describe("Organization Creation", () => {
    test("should create a garage organization", async () => {
      const orgData = {
        type: "garage",
        name: "Test Garage Ltd",
        country: "Kenya",
        currency: "KES",
        settings: {
          laborRatePerHour: 2000,
          taxRatePct: 16,
          defaultMarkupPct: 15,
        },
        contact: {
          email: "info@testgarage.com",
          phone: "+254712345678",
          address: "Nairobi, Kenya",
        },
      };

      const org = new Organization(orgData);
      await org.save();

      expect(org.type).toBe("garage");
      expect(org.name).toBe("Test Garage Ltd");
      expect(org.country).toBe("Kenya");
      expect(org.currency).toBe("KES");
      expect(org.settings.laborRatePerHour).toBe(2000);
      expect(org.settings.taxRatePct).toBe(16);
      expect(org.settings.defaultMarkupPct).toBe(15);
      expect(org.plan.tier).toBe("pro");
      expect(org.plan.status).toBe("trial");
      expect(org.isActive).toBe(true);
    });

    test("should create an insurer organization", async () => {
      const orgData = {
        type: "insurer",
        name: "Test Insurance Co",
        country: "Uganda",
        currency: "UGX",
        settings: {
          laborRatePerHour: 50000,
          taxRatePct: 18,
          defaultMarkupPct: 10,
        },
      };

      const org = new Organization(orgData);
      await org.save();

      expect(org.type).toBe("insurer");
      expect(org.name).toBe("Test Insurance Co");
      expect(org.country).toBe("Uganda");
      expect(org.currency).toBe("UGX");
      expect(org.settings.laborRatePerHour).toBe(50000);
      expect(org.settings.taxRatePct).toBe(18);
      expect(org.settings.defaultMarkupPct).toBe(10);
    });

    test("should use default values for optional fields", async () => {
      const orgData = {
        type: "garage",
        name: "Minimal Garage",
        country: "Tanzania",
      };

      const org = new Organization(orgData);
      await org.save();

      expect(org.currency).toBe("KES"); // Default currency
      expect(org.settings.laborRatePerHour).toBe(1500); // Default labor rate
      expect(org.settings.taxRatePct).toBe(16); // Default tax rate
      expect(org.settings.defaultMarkupPct).toBe(10); // Default markup
      expect(org.plan.tier).toBe("pro"); // Default plan tier
      expect(org.plan.status).toBe("trial"); // Default plan status
    });

    test("should validate required fields", async () => {
      const orgData = {
        // Missing type, name, country
        currency: "KES",
      };

      const org = new Organization(orgData);

      await expect(org.save()).rejects.toThrow();
    });

    test("should validate type enum", async () => {
      const orgData = {
        type: "invalid_type",
        name: "Test Org",
        country: "Kenya",
      };

      const org = new Organization(orgData);

      await expect(org.save()).rejects.toThrow();
    });

    test("should validate currency enum", async () => {
      const orgData = {
        type: "garage",
        name: "Test Org",
        country: "Kenya",
        currency: "INVALID_CURRENCY",
      };

      const org = new Organization(orgData);

      await expect(org.save()).rejects.toThrow();
    });

    test("should validate plan tier enum", async () => {
      const orgData = {
        type: "garage",
        name: "Test Org",
        country: "Kenya",
        plan: {
          tier: "invalid_tier",
          status: "active",
        },
      };

      const org = new Organization(orgData);

      await expect(org.save()).rejects.toThrow();
    });
  });

  describe("Settings Validation", () => {
    test("should validate labor rate is non-negative", async () => {
      const orgData = {
        type: "garage",
        name: "Test Org",
        country: "Kenya",
        settings: {
          laborRatePerHour: -100,
        },
      };

      const org = new Organization(orgData);

      await expect(org.save()).rejects.toThrow();
    });

    test("should validate tax rate percentage", async () => {
      const orgData = {
        type: "garage",
        name: "Test Org",
        country: "Kenya",
        settings: {
          taxRatePct: 150, // Over 100%
        },
      };

      const org = new Organization(orgData);

      await expect(org.save()).rejects.toThrow();
    });

    test("should validate markup percentage", async () => {
      const orgData = {
        type: "garage",
        name: "Test Org",
        country: "Kenya",
        settings: {
          defaultMarkupPct: -10, // Negative markup
        },
      };

      const org = new Organization(orgData);

      await expect(org.save()).rejects.toThrow();
    });
  });

  describe("Multi-Currency Support", () => {
    test("should support KES currency", async () => {
      const orgData = {
        type: "garage",
        name: "Kenya Garage",
        country: "Kenya",
        currency: "KES",
      };

      const org = new Organization(orgData);
      await org.save();

      expect(org.currency).toBe("KES");
    });

    test("should support UGX currency", async () => {
      const orgData = {
        type: "garage",
        name: "Uganda Garage",
        country: "Uganda",
        currency: "UGX",
      };

      const org = new Organization(orgData);
      await org.save();

      expect(org.currency).toBe("UGX");
    });

    test("should support TZS currency", async () => {
      const orgData = {
        type: "garage",
        name: "Tanzania Garage",
        country: "Tanzania",
        currency: "TZS",
      };

      const org = new Organization(orgData);
      await org.save();

      expect(org.currency).toBe("TZS");
    });

    test("should support USD currency", async () => {
      const orgData = {
        type: "garage",
        name: "International Garage",
        country: "Kenya",
        currency: "USD",
      };

      const org = new Organization(orgData);
      await org.save();

      expect(org.currency).toBe("USD");
    });
  });
});
