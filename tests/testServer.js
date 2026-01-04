const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();

// Manual CORS headers middleware - must come before helmet
app.use((req, res, next) => {
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://frontend:80",
    "http://frontend:3001",
  ];
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
});

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Import routes
const authRoutes = require("../routes/auth");
const quotationRoutes = require("../routes/quotations");
const errorCodeRoutes = require("../routes/errorCodes");
const uploadRoutes = require("../routes/upload");
const analysisRoutes = require("../routes/analysis");
const walkthroughRoutes = require("../routes/walkthrough");

// Import middleware
const { errorHandler } = require("../middleware/errorHandler");
const { authMiddleware } = require("../middleware/auth");

// API routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/quotations", authMiddleware, quotationRoutes);
app.use("/api/v1/error-codes", errorCodeRoutes);
app.use("/api/v1/upload", authMiddleware, uploadRoutes);
app.use("/api/v1/analysis", authMiddleware, analysisRoutes);
app.use("/api/v1/walkthrough", authMiddleware, walkthroughRoutes);

// Legacy API routes for backward compatibility
app.use("/api/auth", authRoutes);
app.use("/api/quotations", authMiddleware, quotationRoutes);
app.use("/api/error-codes", errorCodeRoutes);
app.use("/api/upload", authMiddleware, uploadRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Errorlytic SaaS API - Automotive Diagnostic Platform",
    version: "1.0.0",
    description:
      "Multi-tenant SaaS platform for VAG vehicle diagnostics with AI-powered analysis",
    endpoints: {
      v1: {
        auth: "/api/v1/auth",
        quotations: "/api/v1/quotations",
        errorCodes: "/api/v1/error-codes",
        upload: "/api/v1/upload",
        analysis: "/api/v1/analysis",
        walkthrough: "/api/v1/walkthrough",
      },
      legacy: {
        auth: "/api/auth",
        quotations: "/api/quotations",
        errorCodes: "/api/error-codes",
        upload: "/api/upload",
      },
    },
    features: [
      "Multi-tenant organization support",
      "RBAC with 6 user roles",
      "Multi-currency support (KES, UGX, TZS, USD)",
      "S3-compatible file storage",
      "AI-powered DTC analysis",
      "AI-powered repair walkthrough generation",
      "Comprehensive quotation generation",
    ],
    status: "online",
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

module.exports = app;
