const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Organization = require("../models/Organization");

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        error: "Access denied. No token provided.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-passwordHash");

    if (!user) {
      return res.status(401).json({
        error: "Invalid token. User not found.",
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: "Account is deactivated.",
      });
    }

    // Populate organization if user belongs to one
    if (user.orgId) {
      const org = await Organization.findById(user.orgId);
      user.organization = org;
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        error: "Invalid token.",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token expired.",
      });
    }

    console.error("Auth middleware error:", error);
    res.status(500).json({
      error: "Internal server error during authentication.",
    });
  }
};

// Role-based access control middleware
const requireRole = (roles) => {
  return async (req, res, next) => {
    try {
      await authMiddleware(req, res, () => {});

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          error: `Access denied. Required roles: ${roles.join(", ")}`,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Organization-based access control
const requireOrgAccess = (allowedTypes = []) => {
  return async (req, res, next) => {
    try {
      await authMiddleware(req, res, () => {});

      // Superadmin can access everything
      if (req.user.role === "superadmin") {
        return next();
      }

      // Individual users can only access their own data
      if (req.user.role === "individual") {
        return next();
      }

      // Organization users must belong to an organization
      if (!req.user.orgId) {
        return res.status(403).json({
          error: "Access denied. Organization membership required.",
        });
      }

      // Check if organization type is allowed
      if (allowedTypes.length > 0 && req.user.organization) {
        if (!allowedTypes.includes(req.user.organization.type)) {
          return res.status(403).json({
            error: `Access denied. Organization type must be: ${allowedTypes.join(
              ", "
            )}`,
          });
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Admin middleware for organization admins and superadmin
const adminMiddleware = requireRole([
  "garage_admin",
  "insurer_admin",
  "superadmin",
]);

// Superadmin middleware
const superadminMiddleware = requireRole(["superadmin"]);

// Garage-specific middleware
const garageMiddleware = requireOrgAccess(["garage"]);

// Insurer-specific middleware
const insurerMiddleware = requireOrgAccess(["insurer"]);

// Resource ownership middleware
const requireOwnership = (resourceField = "userId") => {
  return async (req, res, next) => {
    try {
      await authMiddleware(req, res, () => {});

      // Superadmin can access everything
      if (req.user.role === "superadmin") {
        return next();
      }

      // Organization admins can access their org's resources
      if (["garage_admin", "insurer_admin"].includes(req.user.role)) {
        return next();
      }

      // Individual users can only access their own resources
      const resourceUserId =
        req.params[resourceField] || req.body[resourceField];
      if (resourceUserId && resourceUserId !== req.user._id.toString()) {
        return res.status(403).json({
          error: "Access denied. You can only access your own resources.",
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  authMiddleware,
  requireRole,
  requireOrgAccess,
  adminMiddleware,
  superadminMiddleware,
  garageMiddleware,
  insurerMiddleware,
  requireOwnership,
};
