const express = require("express");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const { OAuth2Client } = require('google-auth-library');
const User = require("../models/User");
const Organization = require("../models/Organization");
const {
  authMiddleware,
  requireRole,
  superadminMiddleware,
} = require("../middleware/auth");
const googleCalendarService = require("../services/googleCalendarService");

const router = express.Router();

// Initialize Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Generate JWT tokens (access + refresh)
const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "15m", // Short-lived access token
  });

  const refreshToken = jwt.sign(
    { userId, type: "refresh" },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d", // Long-lived refresh token
    }
  );

  return { accessToken, refreshToken };
};

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Create a new user account with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - profile
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: Password123
 *               profile:
 *                 type: object
 *                 required:
 *                   - name
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: John Doe
 *                   phone:
 *                     type: string
 *                     example: +254712345678
 *               role:
 *                 type: string
 *                 enum: [individual, garage_user, garage_admin, insurer_user, insurer_admin]
 *                 default: individual
 *                 example: individual
 *               orgId:
 *                 type: string
 *                 description: Organization ID (required for non-individual roles)
 *                 example: 507f1f77bcf86cd799439012
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               type: user_created
 *               title: User Created Successfully
 *               detail: User account has been created successfully
 *               data:
 *                 user:
 *                   _id: 507f1f77bcf86cd799439011
 *                   email: user@example.com
 *                   role: individual
 *                   profile:
 *                     name: John Doe
 *                   isActive: true
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: User already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/register",
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long")
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage(
        "Password must contain at least one lowercase letter, one uppercase letter, and one number"
      ),
    body("profile.name")
      .trim()
      .isLength({ min: 2 })
      .withMessage("Name must be at least 2 characters long"),
    body("role")
      .optional()
      .isIn([
        "individual",
        "garage_user",
        "garage_admin",
        "insurer_user",
        "insurer_admin",
      ])
      .withMessage("Invalid role"),
    body("orgId").optional().isMongoId().withMessage("Invalid organization ID"),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          type: "validation_error",
          title: "Validation Failed",
          detail: "Invalid input data",
          status: 400,
          errors: errors.array(),
        });
      }

      const { email, password, profile, role = "individual", orgId } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          type: "user_exists",
          title: "User Already Exists",
          detail: "A user with this email already exists",
          status: 400,
        });
      }

      // Validate organization if provided
      if (orgId) {
        const org = await Organization.findById(orgId);
        if (!org) {
          return res.status(400).json({
            type: "invalid_organization",
            title: "Invalid Organization",
            detail: "The specified organization does not exist",
            status: 400,
          });
        }
      }

      // Create new user
      const user = new User({
        email,
        passwordHash: password, // Will be hashed by pre-save middleware
        profile,
        role,
        orgId,
      });

      await user.save();

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user._id);

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user: {
            id: user._id,
            email: user.email,
            profile: user.profile,
            role: user.role,
            orgId: user.orgId,
            plan: user.plan,
          },
          accessToken,
          refreshToken,
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({
        type: "internal_error",
        title: "Internal Server Error",
        detail: "An error occurred during registration",
        status: 500,
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login user
 *     description: Authenticate user with email and password, returns access and refresh tokens
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: Password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               type: login_successful
 *               title: Login Successful
 *               detail: User authenticated successfully
 *               data:
 *                 user:
 *                   _id: 507f1f77bcf86cd799439011
 *                   email: user@example.com
 *                   role: individual
 *                   profile:
 *                     name: John Doe
 *                 tokens:
 *                   accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                   refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/login",
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          type: "validation_error",
          title: "Validation Failed",
          detail: "Invalid input data",
          status: 400,
          errors: errors.array(),
        });
      }

      const { email, password } = req.body;

      // Check if user exists
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({
          type: "invalid_credentials",
          title: "Invalid Credentials",
          detail: "Invalid email or password",
          status: 401,
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({
          type: "account_deactivated",
          title: "Account Deactivated",
          detail: "Your account has been deactivated",
          status: 401,
        });
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          type: "invalid_credentials",
          title: "Invalid Credentials",
          detail: "Invalid email or password",
          status: 401,
        });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user._id);

      res.json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user._id,
            email: user.email,
            profile: user.profile,
            role: user.role,
            orgId: user.orgId,
            plan: user.plan,
            quotas: user.quotas,
            googleCalendar: {
              isConnected: user.googleCalendar?.isConnected || false,
              calendarId: user.googleCalendar?.calendarId,
            },
          },
          accessToken,
          refreshToken,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        type: "internal_error",
        title: "Internal Server Error",
        detail: "An error occurred during login",
        status: 500,
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/auth/google:
 *   post:
 *     summary: Google OAuth Login
 *     description: Authenticate user with Google ID token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Google ID token from Google Sign-In
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid token
 */
router.post("/google", async (req, res) => {
  try {
    let email, name, picture, googleId;

    // Support both ID token verification and direct user info
    if (req.body.idToken) {
      // Verify Google ID token (legacy method)
      const ticket = await googleClient.verifyIdToken({
        idToken: req.body.idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
      googleId = payload.sub;
    } else if (req.body.email && req.body.googleId) {
      // Direct user info from frontend (new method)
      email = req.body.email;
      name = req.body.name;
      picture = req.body.picture;
      googleId = req.body.googleId;
    } else {
      return res.status(400).json({
        type: "validation_error",
        title: "Validation Failed",
        detail: "Either Google ID token or user info (email, googleId) is required",
        status: 400,
      });
    }

    if (!email) {
      return res.status(400).json({
        type: "invalid_token",
        title: "Invalid Data",
        detail: "Email not found in Google account",
        status: 400,
      });
    }

    // Check if user exists
    let user = await User.findOne({ email });

    if (!user) {
      // Create new user with Google account
      user = new User({
        email,
        profile: {
          name: name || email.split('@')[0],
          picture,
        },
        role: "individual",
        googleId,
        isActive: true,
        // No password hash for Google OAuth users
      });
      await user.save();
    } else {
      // Update existing user with Google ID if not set
      if (!user.googleId) {
        user.googleId = googleId;
        user.profile.picture = user.profile.picture || picture;
        await user.save();
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({
          type: "account_deactivated",
          title: "Account Deactivated",
          detail: "Your account has been deactivated",
          status: 401,
        });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    res.json({
      success: true,
      message: "Google login successful",
      data: {
        user: {
          id: user._id,
          email: user.email,
          profile: user.profile,
          role: user.role,
          orgId: user.orgId,
          plan: user.plan,
          quotas: user.quotas,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("Google OAuth error:", error);

    if (error.message && error.message.includes('Token used too late')) {
      return res.status(401).json({
        type: "invalid_token",
        title: "Invalid Token",
        detail: "Google token has expired",
        status: 401,
      });
    }

    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "An error occurred during Google authentication",
      status: 500,
    });
  }
});

// @route   POST /api/v1/auth/google/callback
// @desc    Handle Google OAuth callback (redirect flow)
// @access  Public
router.post("/google/callback", async (req, res) => {
  try {
    const { code, redirectUri } = req.body;

    if (!code || !redirectUri) {
      return res.status(400).json({
        type: "validation_error",
        title: "Validation Failed",
        detail: "Authorization code and redirect URI are required",
        status: 400,
      });
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange error:', tokens);
      return res.status(400).json({
        type: "oauth_error",
        title: "OAuth Error",
        detail: tokens.error_description || "Failed to exchange authorization code",
        status: 400,
      });
    }

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    });

    const userInfo = await userInfoResponse.json();

    if (!userInfoResponse.ok) {
      return res.status(400).json({
        type: "oauth_error",
        title: "OAuth Error",
        detail: "Failed to fetch user information from Google",
        status: 400,
      });
    }

    const { email, name, picture, sub: googleId } = userInfo;

    if (!email) {
      return res.status(400).json({
        type: "invalid_data",
        title: "Invalid Data",
        detail: "Email not found in Google account",
        status: 400,
      });
    }

    // Check if user exists
    let user = await User.findOne({ email });

    if (!user) {
      // Create new user with Google account
      user = new User({
        email,
        profile: {
          name: name || email.split('@')[0],
          picture,
        },
        role: "individual",
        googleId,
        isActive: true,
      });
      await user.save();
    } else {
      // Update existing user with Google ID if not set
      if (!user.googleId) {
        user.googleId = googleId;
        user.profile.picture = user.profile.picture || picture;
        await user.save();
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({
          type: "account_deactivated",
          title: "Account Deactivated",
          detail: "Your account has been deactivated",
          status: 401,
        });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    res.json({
      success: true,
      message: "Google login successful",
      data: {
        user: {
          id: user._id,
          email: user.email,
          profile: user.profile,
          role: user.role,
          orgId: user.orgId,
          plan: user.plan,
          quotas: user.quotas,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("Google OAuth callback error:", error);

    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "An error occurred during Google authentication",
      status: 500,
    });
  }
});

// @route   POST /api/v1/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post(
  "/refresh",
  [body("refreshToken").notEmpty().withMessage("Refresh token is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          type: "validation_error",
          title: "Validation Failed",
          detail: "Invalid input data",
          status: 400,
          errors: errors.array(),
        });
      }

      const { refreshToken } = req.body;

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

      if (decoded.type !== "refresh") {
        return res.status(401).json({
          type: "invalid_token",
          title: "Invalid Token",
          detail: "Invalid refresh token",
          status: 401,
        });
      }

      // Check if user still exists and is active
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({
          type: "invalid_token",
          title: "Invalid Token",
          detail: "User not found or deactivated",
          status: 401,
        });
      }

      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken } = generateTokens(
        user._id
      );

      res.json({
        success: true,
        message: "Token refreshed successfully",
        data: {
          accessToken,
          refreshToken: newRefreshToken,
        },
      });
    } catch (error) {
      if (
        error.name === "JsonWebTokenError" ||
        error.name === "TokenExpiredError"
      ) {
        return res.status(401).json({
          type: "invalid_token",
          title: "Invalid Token",
          detail: "Invalid or expired refresh token",
          status: 401,
        });
      }

      console.error("Token refresh error:", error);
      res.status(500).json({
        type: "internal_error",
        title: "Internal Server Error",
        detail: "An error occurred during token refresh",
        status: 500,
      });
    }
  }
);

// @route   GET /api/v1/auth/profile
// @desc    Get user profile
// @access  Private
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          email: req.user.email,
          profile: req.user.profile,
          role: req.user.role,
          orgId: req.user.orgId,
          organization: req.user.organization,
          plan: req.user.plan,
          quotas: req.user.quotas,
          googleCalendar: {
            isConnected: req.user.googleCalendar?.isConnected || false,
            calendarId: req.user.googleCalendar?.calendarId,
          },
          isActive: req.user.isActive,
          lastLogin: req.user.lastLogin,
          createdAt: req.user.createdAt,
        },
      },
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "An error occurred while fetching profile",
      status: 500,
    });
  }
});

// @route   PUT /api/v1/auth/profile
// @desc    Update user profile
// @access  Private
router.put(
  "/profile",
  authMiddleware,
  [
    body("profile.name")
      .optional()
      .trim()
      .isLength({ min: 2 })
      .withMessage("Name must be at least 2 characters long"),
    body("profile.phone").optional().trim(),
    body("profile.country").optional().trim(),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          type: "validation_error",
          title: "Validation Failed",
          detail: "Invalid input data",
          status: 400,
          errors: errors.array(),
        });
      }

      const { profile } = req.body;
      const updateFields = {};

      if (profile) {
        if (profile.name) updateFields["profile.name"] = profile.name;
        if (profile.phone !== undefined)
          updateFields["profile.phone"] = profile.phone;
        if (profile.country !== undefined)
          updateFields["profile.country"] = profile.country;
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        updateFields,
        { new: true, runValidators: true }
      ).select("-passwordHash");

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: {
          user: updatedUser,
        },
      });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({
        type: "internal_error",
        title: "Internal Server Error",
        detail: "An error occurred while updating profile",
        status: 500,
      });
    }
  }
);

// @route   POST /api/v1/auth/change-password
// @desc    Change user password
// @access  Private
router.post(
  "/change-password",
  authMiddleware,
  [
    body("currentPassword")
      .notEmpty()
      .withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("New password must be at least 8 characters long")
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage(
        "New password must contain at least one lowercase letter, one uppercase letter, and one number"
      ),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          type: "validation_error",
          title: "Validation Failed",
          detail: "Invalid input data",
          status: 400,
          errors: errors.array(),
        });
      }

      const { currentPassword, newPassword } = req.body;

      // Get user with password
      const user = await User.findById(req.user._id);

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(
        currentPassword
      );
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          type: "invalid_password",
          title: "Invalid Password",
          detail: "Current password is incorrect",
          status: 400,
        });
      }

      // Update password
      user.passwordHash = newPassword; // Will be hashed by pre-save middleware
      await user.save();

      res.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      console.error("Password change error:", error);
      res.status(500).json({
        type: "internal_error",
        title: "Internal Server Error",
        detail: "An error occurred while changing password",
        status: 500,
      });
    }
  }
);

// @route   POST /api/v1/orgs
// @desc    Create organization (admin only)
// @access  Private (Admin)
router.post(
  "/orgs",
  superadminMiddleware,
  [
    body("type")
      .isIn(["garage", "insurer"])
      .withMessage("Organization type must be garage or insurer"),
    body("name")
      .trim()
      .isLength({ min: 2 })
      .withMessage("Organization name must be at least 2 characters long"),
    body("country")
      .trim()
      .isLength({ min: 2 })
      .withMessage("Country must be at least 2 characters long"),
    body("currency")
      .optional()
      .isIn(["KES", "UGX", "TZS", "USD"])
      .withMessage("Invalid currency"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          type: "validation_error",
          title: "Validation Failed",
          detail: "Invalid input data",
          status: 400,
          errors: errors.array(),
        });
      }

      const {
        type,
        name,
        country,
        currency = "KES",
        contact,
        settings,
      } = req.body;

      const organization = new Organization({
        type,
        name,
        country,
        currency,
        contact,
        settings,
      });

      await organization.save();

      res.status(201).json({
        success: true,
        message: "Organization created successfully",
        data: {
          organization,
        },
      });
    } catch (error) {
      console.error("Organization creation error:", error);
      res.status(500).json({
        type: "internal_error",
        title: "Internal Server Error",
        detail: "An error occurred while creating organization",
        status: 500,
      });
    }
  }
);

// @route   GET /api/v1/orgs/:id
// @desc    Get organization details
// @access  Private
router.get("/orgs/:id", authMiddleware, async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return res.status(404).json({
        type: "not_found",
        title: "Organization Not Found",
        detail: "The specified organization does not exist",
        status: 404,
      });
    }

    // Check if user has access to this organization
    if (
      req.user.role !== "superadmin" &&
      req.user.orgId?.toString() !== req.params.id
    ) {
      return res.status(403).json({
        type: "access_denied",
        title: "Access Denied",
        detail: "You don't have permission to access this organization",
        status: 403,
      });
    }

    res.json({
      success: true,
      data: {
        organization,
      },
    });
  } catch (error) {
    console.error("Organization fetch error:", error);
    res.status(500).json({
      type: "internal_error",
      title: "Internal Server Error",
      detail: "An error occurred while fetching organization",
      status: 500,
    });
  }
});

// Google Calendar Integration
router.get("/google/calendar/url", authMiddleware, async (req, res) => {
  try {
    const url = googleCalendarService.generateAuthUrl(req.user._id);
    res.json({ success: true, url });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/google/calendar/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    await googleCalendarService.handleAuthCallback(code, state);
    
    // Redirect back to frontend bookings page
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:7337'}/app/bookings?calendar_connected=true`);
  } catch (error) {
    console.error("Calendar callback error:", error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:7337'}/app/bookings?error=calendar_connection_failed`);
  }
});

router.post("/google/calendar/disconnect", authMiddleware, async (req, res) => {
  try {
    const result = await googleCalendarService.disconnectCalendar(req.user._id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/v1/auth/google/calendar/events
// @desc    Get Google Calendar events for the authenticated user
// @access  Private
router.get("/google/calendar/events", authMiddleware, async (req, res) => {
  try {
    // Check if user has Google Calendar connected
    if (!req.user.googleCalendar?.isConnected) {
      return res.status(400).json({
        success: false,
        message: "Google Calendar not connected",
      });
    }

    const { timeMin, timeMax } = req.query;
    const events = await googleCalendarService.getCalendarEvents(req.user._id, {
      timeMin,
      timeMax,
    });

    res.json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch calendar events",
    });
  }
});

/**
 * @route   GET /api/v1/auth/clients
 * @desc    Get all individual users (clients) - accessible by garage/insurer roles
 * @access  Private
 */
router.get("/clients", authMiddleware, async (req, res) => {
  try {
    const { search } = req.query;
    const query = { role: "individual", isActive: true };

    if (search) {
      query.$or = [
        { "profile.name": { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const clients = await User.find(query)
      .select("email profile.name profile.phone")
      .limit(50);

    const transformedClients = clients.map((client) => ({
      id: client._id,
      email: client.email,
      profile: client.profile,
    }));

    res.json({
      success: true,
      data: transformedClients,
    });
  } catch (error) {
    console.error("Error fetching clients:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch clients",
    });
  }
});

module.exports = router;
