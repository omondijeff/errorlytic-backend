const express = require("express");
const { body, validationResult } = require("express-validator");
const { authMiddleware, requireRole } = require("../middleware/auth");
const User = require("../models/User");
const Organization = require("../models/Organization");
const Analysis = require("../models/Analysis");
const Quotation = require("../models/Quotation");
const Payment = require("../models/Payment");
const AuditLog = require("../models/AuditLog");
const Metering = require("../models/Metering");

const router = express.Router();

// Apply super admin middleware to all routes
router.use(authMiddleware);
router.use(requireRole(["superadmin"]));

/**
 * @swagger
 * /api/v1/superadmin/users:
 *   get:
 *     summary: Get all users with pagination and filtering
 *     tags: [Super Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of users per page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter by role
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Super admin access required
 */
router.get("/users", async (req, res) => {
  try {
    const { page = 1, limit = 10, role, status, search } = req.query;

    const query = {};

    // Apply filters
    if (role && role !== "all") {
      query.role = role;
    }

    if (status && status !== "all") {
      if (status === "active") {
        query.isActive = true;
      } else if (status === "inactive") {
        query.isActive = false;
      }
    }

    if (search) {
      query.$or = [
        { "profile.name": { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const users = await User.find(query)
      .populate("orgId", "name type")
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    // Transform users for frontend
    const transformedUsers = users.map((user) => ({
      id: user._id,
      email: user.email,
      name: user.profile.name,
      role: user.role,
      organization: user.orgId?.name || null,
      plan: user.plan.tier,
      status: user.isActive ? "active" : "inactive",
      lastLogin: user.lastLogin ? user.lastLogin.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      isActive: user.isActive,
    }));

    res.json({
      success: true,
      data: transformedUsers,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve users",
    });
  }
});

/**
 * @swagger
 * /api/v1/superadmin/users:
 *   post:
 *     summary: Create a new user
 *     tags: [Super Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - role
 *               - plan
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [individual, garage_user, garage_admin, insurer_user, insurer_admin, superadmin]
 *               plan:
 *                 type: string
 *                 enum: [starter, pro, enterprise]
 *               organization:
 *                 type: string
 *               phone:
 *                 type: string
 *               country:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Super admin access required
 */
router.post(
  "/users",
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("role")
      .isIn([
        "individual",
        "garage_user",
        "garage_admin",
        "insurer_user",
        "insurer_admin",
        "superadmin",
      ])
      .withMessage("Invalid role"),
    body("plan")
      .isIn(["starter", "pro", "enterprise"])
      .withMessage("Invalid plan"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: errors.array(),
        });
      }

      const { name, email, role, plan, organization, phone, country } =
        req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User with this email already exists",
        });
      }

      // Find organization if provided
      let orgId = null;
      if (organization && role !== "individual" && role !== "superadmin") {
        const org = await Organization.findOne({ name: organization });
        if (org) {
          orgId = org._id;
        }
      }

      // Create user
      const user = new User({
        email,
        passwordHash: "TempPassword123", // Will be changed on first login
        role,
        orgId,
        profile: {
          name,
          phone,
          country,
        },
        plan: {
          tier: plan,
          status: "active",
          renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        quotas: {
          apiCalls: {
            used: 0,
            limit: plan === "starter" ? 100 : plan === "pro" ? 1000 : 10000,
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
        isActive: true,
      });

      await user.save();

      // Log the action
      await AuditLog.create({
        actorId: req.user._id,
        action: "user_created",
        target: {
          type: "user",
          id: user._id,
          email: user.email,
          role: user.role,
        },
      });

      res.status(201).json({
        success: true,
        message: "User created successfully",
        data: {
          id: user._id,
          email: user.email,
          name: user.profile.name,
          role: user.role,
          plan: user.plan.tier,
          isActive: user.isActive,
        },
      });
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create user",
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/superadmin/users/{id}:
 *   put:
 *     summary: Update a user
 *     tags: [Super Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *               plan:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Super admin access required
 */
router.put("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update user fields
    if (updates.name) user.profile.name = updates.name;
    if (updates.email) user.email = updates.email;
    if (updates.role) user.role = updates.role;
    if (updates.plan) user.plan.tier = updates.plan;
    if (updates.isActive !== undefined) user.isActive = updates.isActive;

    await user.save();

    // Log the action
    await AuditLog.create({
      actorId: req.user._id,
      action: "user_updated",
      target: {
        type: "user",
        id: user._id,
        email: user.email,
      },
      changes: {
        before: updates,
        after: user.toObject(),
      },
    });

    res.json({
      success: true,
      message: "User updated successfully",
      data: {
        id: user._id,
        email: user.email,
        name: user.profile.name,
        role: user.role,
        plan: user.plan.tier,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user",
    });
  }
});

/**
 * @swagger
 * /api/v1/superadmin/users/{id}:
 *   delete:
 *     summary: Delete a user
 *     tags: [Super Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Super admin access required
 */
router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Don't allow deleting super admin users
    if (user.role === "superadmin") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete super admin users",
      });
    }

    await User.findByIdAndDelete(id);

    // Log the action
    await AuditLog.create({
      actorId: req.user._id,
      action: "user_deleted",
      target: {
        type: "user",
        id: user._id,
        email: user.email,
      },
    });

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
    });
  }
});

/**
 * @swagger
 * /api/v1/superadmin/stats:
 *   get:
 *     summary: Get system statistics
 *     tags: [Super Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Super admin access required
 */
router.get("/stats", async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalOrganizations,
      totalAnalyses,
      totalQuotations,
      totalPayments,
      recentUsers,
      systemHealth,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      Organization.countDocuments(),
      Analysis.countDocuments(),
      Quotation.countDocuments(),
      Payment.countDocuments(),
      User.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("profile.name email role createdAt"),
      // Simple health check
      Promise.resolve({ status: "healthy", uptime: process.uptime() }),
    ]);

    const stats = {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
      },
      organizations: {
        total: totalOrganizations,
      },
      content: {
        analyses: totalAnalyses,
        quotations: totalQuotations,
        payments: totalPayments,
      },
      system: systemHealth,
      recent: {
        users: recentUsers.map((user) => ({
          name: user.profile.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        })),
      },
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve system statistics",
    });
  }
});

// =====================
// ORGANIZATION ROUTES
// =====================

/**
 * @swagger
 * /api/v1/superadmin/organizations:
 *   get:
 *     summary: Get all organizations with pagination and filtering
 *     tags: [Super Admin]
 */
router.get("/organizations", async (req, res) => {
  try {
    const { page = 1, limit = 10, type, search } = req.query;

    const query = {};

    if (type && type !== "all") {
      query.type = type;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { "contact.email": { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const organizations = await Organization.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Organization.countDocuments(query);

    // Get user counts for each organization
    const orgsWithCounts = await Promise.all(
      organizations.map(async (org) => {
        const userCount = await User.countDocuments({ orgId: org._id });
        const reportsCount = await Analysis.countDocuments({ orgId: org._id });
        return {
          id: org._id,
          name: org.name,
          type: org.type,
          email: org.contact?.email || "",
          phone: org.contact?.phone || "",
          address: org.contact?.address || "",
          country: org.country,
          currency: org.currency,
          plan: org.plan?.tier || "pro",
          status: org.isActive ? "active" : "inactive",
          userCount,
          reportsCount,
          settings: org.settings,
          createdAt: org.createdAt,
        };
      })
    );

    res.json({
      success: true,
      data: orgsWithCounts,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error("Get organizations error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve organizations",
    });
  }
});

/**
 * @swagger
 * /api/v1/superadmin/organizations:
 *   post:
 *     summary: Create a new organization
 *     tags: [Super Admin]
 */
router.post(
  "/organizations",
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("type")
      .isIn(["garage", "insurer"])
      .withMessage("Type must be garage or insurer"),
    body("country").notEmpty().withMessage("Country is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: errors.array(),
        });
      }

      const { name, type, country, currency, email, phone, address, plan } =
        req.body;

      // Check if organization already exists
      const existingOrg = await Organization.findOne({ name });
      if (existingOrg) {
        return res.status(400).json({
          success: false,
          message: "Organization with this name already exists",
        });
      }

      const organization = new Organization({
        name,
        type,
        country,
        currency: currency || "KES",
        contact: {
          email,
          phone,
          address,
        },
        plan: {
          tier: plan || "pro",
          status: "active",
        },
        isActive: true,
      });

      await organization.save();

      // Log the action
      await AuditLog.create({
        actorId: req.user._id,
        action: "organization_created",
        target: {
          type: "organization",
          id: organization._id,
          name: organization.name,
        },
      });

      res.status(201).json({
        success: true,
        message: "Organization created successfully",
        data: {
          id: organization._id,
          name: organization.name,
          type: organization.type,
          country: organization.country,
        },
      });
    } catch (error) {
      console.error("Create organization error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create organization",
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/superadmin/organizations/{id}:
 *   put:
 *     summary: Update an organization
 *     tags: [Super Admin]
 */
router.put("/organizations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const organization = await Organization.findById(id);
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    // Update fields
    if (updates.name) organization.name = updates.name;
    if (updates.type) organization.type = updates.type;
    if (updates.country) organization.country = updates.country;
    if (updates.currency) organization.currency = updates.currency;
    if (updates.email) organization.contact.email = updates.email;
    if (updates.phone) organization.contact.phone = updates.phone;
    if (updates.address) organization.contact.address = updates.address;
    if (updates.plan) organization.plan.tier = updates.plan;
    if (updates.isActive !== undefined) organization.isActive = updates.isActive;
    if (updates.settings) {
      organization.settings = { ...organization.settings, ...updates.settings };
    }

    await organization.save();

    // Log the action
    await AuditLog.create({
      actorId: req.user._id,
      action: "organization_updated",
      target: {
        type: "organization",
        id: organization._id,
        name: organization.name,
      },
    });

    res.json({
      success: true,
      message: "Organization updated successfully",
      data: {
        id: organization._id,
        name: organization.name,
        type: organization.type,
      },
    });
  } catch (error) {
    console.error("Update organization error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update organization",
    });
  }
});

/**
 * @swagger
 * /api/v1/superadmin/organizations/{id}:
 *   delete:
 *     summary: Delete an organization
 *     tags: [Super Admin]
 */
router.delete("/organizations/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const organization = await Organization.findById(id);
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    // Check if organization has users
    const userCount = await User.countDocuments({ orgId: id });
    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete organization with ${userCount} active users`,
      });
    }

    await Organization.findByIdAndDelete(id);

    // Log the action
    await AuditLog.create({
      actorId: req.user._id,
      action: "organization_deleted",
      target: {
        type: "organization",
        id: organization._id,
        name: organization.name,
      },
    });

    res.json({
      success: true,
      message: "Organization deleted successfully",
    });
  } catch (error) {
    console.error("Delete organization error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete organization",
    });
  }
});

// =====================
// AUDIT LOG ROUTES
// =====================

/**
 * @swagger
 * /api/v1/superadmin/audit:
 *   get:
 *     summary: Get audit logs with pagination and filtering
 *     tags: [Super Admin]
 */
router.get("/audit", async (req, res) => {
  try {
    const { page = 1, limit = 20, action, userId, startDate, endDate } = req.query;

    const query = {};

    if (action && action !== "all") {
      query.action = action;
    }

    if (userId) {
      query.actorId = userId;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const logs = await AuditLog.find(query)
      .populate("actorId", "profile.name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AuditLog.countDocuments(query);

    const transformedLogs = logs.map((log) => ({
      id: log._id,
      action: log.action,
      actor: {
        id: log.actorId?._id,
        name: log.actorId?.profile?.name || "System",
        email: log.actorId?.email,
      },
      target: log.target,
      meta: log.meta,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
    }));

    res.json({
      success: true,
      data: transformedLogs,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error("Get audit logs error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve audit logs",
    });
  }
});

// =====================
// ANALYTICS ROUTES
// =====================

/**
 * @swagger
 * /api/v1/superadmin/analytics:
 *   get:
 *     summary: Get system analytics
 *     tags: [Super Admin]
 */
router.get("/analytics", async (req, res) => {
  try {
    const { period = "30d" } = req.query;

    // Calculate date range
    let startDate = new Date();
    switch (period) {
      case "7d":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(startDate.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(startDate.getDate() - 90);
        break;
      case "1y":
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Get various analytics
    const [
      totalUsers,
      newUsers,
      totalOrgs,
      totalAnalyses,
      newAnalyses,
      usersByRole,
      analysesByDay,
      topOrganizations,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: startDate } }),
      Organization.countDocuments(),
      Analysis.countDocuments(),
      Analysis.countDocuments({ createdAt: { $gte: startDate } }),
      User.aggregate([
        { $group: { _id: "$role", count: { $sum: 1 } } },
      ]),
      Analysis.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Organization.aggregate([
        {
          $lookup: {
            from: "analyses",
            localField: "_id",
            foreignField: "orgId",
            as: "analyses",
          },
        },
        {
          $project: {
            name: 1,
            type: 1,
            analysisCount: { $size: "$analyses" },
          },
        },
        { $sort: { analysisCount: -1 } },
        { $limit: 5 },
      ]),
    ]);

    // Calculate growth rates
    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - (new Date() - startDate) / (1000 * 60 * 60 * 24));

    const previousUsers = await User.countDocuments({
      createdAt: { $gte: previousStartDate, $lt: startDate },
    });
    const previousAnalyses = await Analysis.countDocuments({
      createdAt: { $gte: previousStartDate, $lt: startDate },
    });

    const userGrowth = previousUsers > 0 ? ((newUsers - previousUsers) / previousUsers * 100).toFixed(1) : 0;
    const analysisGrowth = previousAnalyses > 0 ? ((newAnalyses - previousAnalyses) / previousAnalyses * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          newUsers,
          userGrowth: parseFloat(userGrowth),
          totalOrganizations: totalOrgs,
          totalAnalyses,
          newAnalyses,
          analysisGrowth: parseFloat(analysisGrowth),
        },
        usersByRole: usersByRole.map((r) => ({
          role: r._id,
          count: r.count,
        })),
        analysesByDay,
        topOrganizations,
        period,
      },
    });
  } catch (error) {
    console.error("Get analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve analytics",
    });
  }
});

// =====================
// BILLING/REVENUE ROUTES
// =====================

/**
 * @swagger
 * /api/v1/superadmin/revenue:
 *   get:
 *     summary: Get revenue analytics
 *     tags: [Super Admin]
 */
router.get("/revenue", async (req, res) => {
  try {
    const { period = "30d" } = req.query;

    let startDate = new Date();
    switch (period) {
      case "7d":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(startDate.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(startDate.getDate() - 90);
        break;
      case "1y":
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const [
      totalPayments,
      recentPayments,
      paymentsByDay,
      subscriptionsByPlan,
    ] = await Promise.all([
      Payment.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.find({ createdAt: { $gte: startDate } })
        .populate("userId", "profile.name email")
        .sort({ createdAt: -1 })
        .limit(10),
      Payment.aggregate([
        { $match: { createdAt: { $gte: startDate }, status: "completed" } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            amount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      User.aggregate([
        { $group: { _id: "$plan.tier", count: { $sum: 1 } } },
      ]),
    ]);

    // Calculate MRR (Monthly Recurring Revenue) estimate
    const planPrices = { starter: 0, pro: 29, enterprise: 99 };
    const mrr = subscriptionsByPlan.reduce((acc, plan) => {
      return acc + (planPrices[plan._id] || 0) * plan.count;
    }, 0);

    res.json({
      success: true,
      data: {
        totalRevenue: totalPayments[0]?.total || 0,
        mrr,
        recentPayments: recentPayments.map((p) => ({
          id: p._id,
          amount: p.amount,
          status: p.status,
          user: {
            name: p.userId?.profile?.name,
            email: p.userId?.email,
          },
          createdAt: p.createdAt,
        })),
        paymentsByDay,
        subscriptionsByPlan: subscriptionsByPlan.map((s) => ({
          plan: s._id,
          count: s.count,
        })),
        period,
      },
    });
  } catch (error) {
    console.error("Get revenue error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve revenue data",
    });
  }
});

// =====================
// PLATFORM SETTINGS ROUTES
// =====================

/**
 * @swagger
 * /api/v1/superadmin/settings:
 *   get:
 *     summary: Get platform settings
 *     tags: [Super Admin]
 */
router.get("/settings", async (req, res) => {
  try {
    // For now, return default settings
    // In production, these would be stored in a Settings collection
    const settings = {
      general: {
        platformName: "Errorlytic",
        supportEmail: "support@errorlytic.com",
        maintenanceMode: false,
      },
      security: {
        maxLoginAttempts: 5,
        sessionTimeout: 3600,
        requireMFA: false,
      },
      api: {
        rateLimit: 100,
        rateLimitWindow: 60,
      },
      notifications: {
        emailNotifications: true,
        slackIntegration: false,
      },
    };

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Get settings error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve settings",
    });
  }
});

/**
 * @swagger
 * /api/v1/superadmin/settings:
 *   put:
 *     summary: Update platform settings
 *     tags: [Super Admin]
 */
router.put("/settings", async (req, res) => {
  try {
    const updates = req.body;

    // Log the settings change
    await AuditLog.create({
      actorId: req.user._id,
      action: "settings_updated",
      target: {
        type: "settings",
      },
      changes: updates,
    });

    res.json({
      success: true,
      message: "Settings updated successfully",
    });
  } catch (error) {
    console.error("Update settings error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update settings",
    });
  }
});

module.exports = router;


