const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

// Import Swagger documentation
const { swaggerUi, specs, swaggerOptions } = require("./swagger");

const app = express();
const PORT = process.env.PORT || 7337;

// Import routes
const authRoutes = require("./routes/auth");
const quotationRoutes = require("./routes/quotations");
const errorCodeRoutes = require("./routes/errorCodes");
const uploadRoutes = require("./routes/upload");
const analysisRoutes = require("./routes/analysis");
const walkthroughRoutes = require("./routes/walkthrough");
const billingRoutes = require("./routes/billing");
const superadminRoutes = require("./routes/superadmin");
const reportsRoutes = require("./routes/reports");
const vehiclesRoutes = require("./routes/vehicles");
const creditsRoutes = require("./routes/credits");
const paymentsRoutes = require("./routes/payments");
const bookingsRoutes = require("./routes/bookings");
const organizationRoutes = require("./routes/organizations");

// Import middleware
const { errorHandler } = require("./middleware/errorHandler");
const { authMiddleware } = require("./middleware/auth");

// Import services
const openaiService = require("./services/openaiService");
const minioService = require("./services/minioService");
const redisService = require("./services/redisService");

// Connect to MongoDB
mongoose
  .connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/errorlytic_saas",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// CORS configuration
app.use(
  cors({
    origin: [
      "http://localhost:7337",
      "http://localhost:5173", // Vite dev server
      "http://localhost:8001", // Mongo Express
      "http://frontend:80",
      "http://frontend:5173",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
    ],
  })
);

// Security middleware with less restrictive CORS settings
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api/", limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static files
app.use("/uploads", express.static("uploads"));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// Swagger API Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs, swaggerOptions));

// API routes - Errorlytic v1 API
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/quotations", authMiddleware, quotationRoutes);
app.use("/api/v1/error-codes", errorCodeRoutes);
app.use("/api/v1/upload", authMiddleware, uploadRoutes);
app.use("/api/v1/analysis", authMiddleware, analysisRoutes);
app.use("/api/v1/walkthrough", authMiddleware, walkthroughRoutes);
app.use("/api/v1/billing", billingRoutes);
app.use("/api/v1/superadmin", superadminRoutes);
app.use("/api/v1/reports", reportsRoutes);
app.use("/api/v1/vehicles", authMiddleware, vehiclesRoutes);
app.use("/api/v1/credits", creditsRoutes);
app.use("/api/v1/payments", paymentsRoutes);
app.use("/api/v1/bookings", authMiddleware, bookingsRoutes);
app.use("/api/v1/organizations", authMiddleware, organizationRoutes);

// Legacy API routes (for backward compatibility)
app.use("/api/auth", authRoutes);
app.use("/api/quotations", authMiddleware, quotationRoutes);
app.use("/api/error-codes", errorCodeRoutes);
app.use("/api/upload", authMiddleware, uploadRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Errorlytic SaaS API - Advanced Automotive Diagnostic Platform",
    version: "1.0.0",
    description:
      "Multi-tenant SaaS platform for automotive diagnostics with AI-powered error code analysis",
    documentation: {
      swagger: "/api-docs",
      description: "Interactive API documentation with Swagger UI",
    },
    endpoints: {
      v1: {
        auth: "/api/v1/auth",
        quotations: "/api/v1/quotations",
        errorCodes: "/api/v1/error-codes",
        upload: "/api/v1/upload",
        analysis: "/api/v1/analysis",
        walkthrough: "/api/v1/walkthrough",
        billing: "/api/v1/billing",
        superadmin: "/api/v1/superadmin",
        credits: "/api/v1/credits",
        payments: "/api/v1/payments",
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
      "AI-powered error code analysis",
      "Real-time caching with Redis",
      "Comprehensive audit logging",
      "Interactive API documentation",
      "Flexible billing system (subscriptions + micropayments)",
      "Usage metering and quota management",
      "Advanced diagnostic report processing",
      "Multi-brand vehicle support",
    ],
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Error handling middleware
app.use(errorHandler);

// Start server only if not in test mode or server startup is not disabled
if (process.env.NODE_ENV !== "test" && !process.env.DISABLE_SERVER_STARTUP) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
}

module.exports = app;
