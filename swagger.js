const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Errorlytic SaaS API",
      version: "1.0.0",
      description:
        "Advanced Automotive Diagnostic Platform with AI-powered Error Code Analysis",
      contact: {
        name: "Errorlytic Support",
        email: "support@errorlytic.com",
        url: "https://errorlytic.com",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: process.env.API_BASE_URL || "http://localhost:3000",
        description: "Development server",
      },
      {
        url: "https://api.errorlytic.com",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token obtained from login endpoint",
        },
      },
      schemas: {
        User: {
          type: "object",
          required: ["email", "passwordHash", "role"],
          properties: {
            _id: {
              type: "string",
              description: "User ID",
              example: "507f1f77bcf86cd799439011",
            },
            email: {
              type: "string",
              format: "email",
              description: "User email address",
              example: "user@example.com",
            },
            role: {
              type: "string",
              enum: [
                "individual",
                "garage_user",
                "garage_admin",
                "insurer_user",
                "insurer_admin",
                "superadmin",
              ],
              description: "User role",
              example: "garage_user",
            },
            orgId: {
              type: "string",
              description: "Organization ID",
              example: "507f1f77bcf86cd799439012",
            },
            profile: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  example: "John Doe",
                },
                phone: {
                  type: "string",
                  example: "+254712345678",
                },
              },
            },
            plan: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  example: "professional",
                },
                limits: {
                  type: "object",
                  properties: {
                    analysesPerMonth: {
                      type: "number",
                      example: 100,
                    },
                    quotationsPerMonth: {
                      type: "number",
                      example: 50,
                    },
                  },
                },
              },
            },
            isActive: {
              type: "boolean",
              description: "User account status",
              example: true,
            },
            createdAt: {
              type: "string",
              format: "date-time",
              example: "2024-01-15T10:30:00Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              example: "2024-01-15T10:30:00Z",
            },
          },
        },
        Organization: {
          type: "object",
          required: ["type", "name", "country", "currency"],
          properties: {
            _id: {
              type: "string",
              description: "Organization ID",
              example: "507f1f77bcf86cd799439012",
            },
            type: {
              type: "string",
              enum: ["garage", "insurer"],
              description: "Organization type",
              example: "garage",
            },
            name: {
              type: "string",
              description: "Organization name",
              example: "Premium Auto Garage",
            },
            country: {
              type: "string",
              description: "Country code",
              example: "Kenya",
            },
            currency: {
              type: "string",
              enum: ["KES", "UGX", "TZS", "USD"],
              description: "Primary currency",
              example: "KES",
            },
            settings: {
              type: "object",
              properties: {
                timezone: {
                  type: "string",
                  example: "Africa/Nairobi",
                },
                laborRate: {
                  type: "number",
                  example: 2500,
                },
                markupPercentage: {
                  type: "number",
                  example: 15,
                },
                taxPercentage: {
                  type: "number",
                  example: 16,
                },
              },
            },
            isActive: {
              type: "boolean",
              example: true,
            },
            createdAt: {
              type: "string",
              format: "date-time",
              example: "2024-01-15T10:30:00Z",
            },
          },
        },
        Vehicle: {
          type: "object",
          required: ["make"],
          properties: {
            _id: {
              type: "string",
              description: "Vehicle ID",
              example: "507f1f77bcf86cd799439013",
            },
            vin: {
              type: "string",
              description: "Vehicle Identification Number",
              example: "WVWZZZ1JZ2W386752",
            },
            make: {
              type: "string",
              enum: ["VW", "Audi", "Skoda", "Seat", "Porsche", "Other"],
              description: "Vehicle make",
              example: "VW",
            },
            model: {
              type: "string",
              description: "Vehicle model",
              example: "Golf",
            },
            year: {
              type: "number",
              minimum: 1990,
              maximum: 2030,
              description: "Manufacturing year",
              example: 2018,
            },
            engineType: {
              type: "string",
              description: "Engine type",
              example: "1.4 TSI",
            },
            mileage: {
              type: "number",
              minimum: 0,
              description: "Vehicle mileage",
              example: 50000,
            },
            color: {
              type: "string",
              description: "Vehicle color",
              example: "Silver",
            },
            orgId: {
              type: "string",
              description: "Organization ID",
              example: "507f1f77bcf86cd799439012",
            },
            ownerUserId: {
              type: "string",
              description: "Owner user ID",
              example: "507f1f77bcf86cd799439011",
            },
          },
        },
        Upload: {
          type: "object",
          required: ["userId", "storage", "meta"],
          properties: {
            _id: {
              type: "string",
              description: "Upload ID",
              example: "507f1f77bcf86cd799439014",
            },
            orgId: {
              type: "string",
              description: "Organization ID",
              example: "507f1f77bcf86cd799439012",
            },
            userId: {
              type: "string",
              description: "User ID",
              example: "507f1f77bcf86cd799439011",
            },
            vehicleId: {
              type: "string",
              description: "Vehicle ID",
              example: "507f1f77bcf86cd799439013",
            },
            storage: {
              type: "object",
              required: ["bucket", "key", "size", "mime"],
              properties: {
                bucket: {
                  type: "string",
                  example: "errorlytic-uploads",
                },
                key: {
                  type: "string",
                  example: "uploads/2024/01/file.txt",
                },
                size: {
                  type: "number",
                  example: 1024,
                },
                mime: {
                  type: "string",
                  example: "text/plain",
                },
              },
            },
            status: {
              type: "string",
              enum: ["uploaded", "parsed", "failed"],
              example: "parsed",
            },
            meta: {
              type: "object",
              required: ["source", "format", "originalName"],
              properties: {
                source: {
                  type: "string",
                  enum: ["VCDS", "OBD", "Other"],
                  example: "VCDS",
                },
                format: {
                  type: "string",
                  enum: ["TXT", "XML", "PDF"],
                  example: "TXT",
                },
                originalName: {
                  type: "string",
                  example: "vcds-report.txt",
                },
              },
            },
            parseResult: {
              type: "object",
              properties: {
                dtcs: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      code: {
                        type: "string",
                        example: "P0300",
                      },
                      description: {
                        type: "string",
                        example: "Random/Multiple Cylinder Misfire Detected",
                      },
                      status: {
                        type: "string",
                        enum: ["active", "historic"],
                        example: "active",
                      },
                    },
                  },
                },
                rawContent: {
                  type: "string",
                  example: "Raw VCDS content...",
                },
                parseErrors: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                },
              },
            },
          },
        },
        Analysis: {
          type: "object",
          required: ["userId", "dtcs", "summary"],
          properties: {
            _id: {
              type: "string",
              description: "Analysis ID",
              example: "507f1f77bcf86cd799439015",
            },
            orgId: {
              type: "string",
              description: "Organization ID",
              example: "507f1f77bcf86cd799439012",
            },
            userId: {
              type: "string",
              description: "User ID",
              example: "507f1f77bcf86cd799439011",
            },
            vehicleId: {
              type: "string",
              description: "Vehicle ID",
              example: "507f1f77bcf86cd799439013",
            },
            uploadId: {
              type: "string",
              description: "Upload ID",
              example: "507f1f77bcf86cd799439014",
            },
            dtcs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  code: {
                    type: "string",
                    example: "P0300",
                  },
                  description: {
                    type: "string",
                    example: "Random/Multiple Cylinder Misfire Detected",
                  },
                  status: {
                    type: "string",
                    enum: ["active", "historic"],
                    example: "active",
                  },
                },
              },
            },
            summary: {
              type: "object",
              required: ["overview", "severity"],
              properties: {
                overview: {
                  type: "string",
                  example:
                    "Found 1 critical error code requiring immediate attention",
                },
                severity: {
                  type: "string",
                  enum: ["low", "medium", "high", "critical"],
                  example: "critical",
                },
              },
            },
            causes: {
              type: "array",
              items: {
                type: "string",
              },
              example: ["Engine", "Ignition System"],
            },
            recommendations: {
              type: "array",
              items: {
                type: "string",
              },
              example: ["Check ignition system", "Replace spark plugs"],
            },
            module: {
              type: "string",
              example: "Engine",
            },
            aiEnrichment: {
              type: "object",
              properties: {
                enabled: {
                  type: "boolean",
                  example: true,
                },
                confidence: {
                  type: "number",
                  minimum: 0,
                  maximum: 1,
                  example: 0.85,
                },
                provider: {
                  type: "string",
                  example: "openai",
                },
              },
            },
          },
        },
        Walkthrough: {
          type: "object",
          required: ["analysisId", "steps"],
          properties: {
            _id: {
              type: "string",
              description: "Walkthrough ID",
              example: "507f1f77bcf86cd799439016",
            },
            analysisId: {
              type: "string",
              description: "Analysis ID",
              example: "507f1f77bcf86cd799439015",
            },
            steps: {
              type: "array",
              items: {
                type: "object",
                required: ["title", "detail", "type", "order"],
                properties: {
                  title: {
                    type: "string",
                    example: "Check ignition system",
                  },
                  detail: {
                    type: "string",
                    example:
                      "Inspect spark plugs and ignition coils for damage",
                  },
                  type: {
                    type: "string",
                    enum: ["check", "replace", "retest"],
                    example: "check",
                  },
                  estMinutes: {
                    type: "number",
                    minimum: 0,
                    example: 30,
                  },
                  order: {
                    type: "number",
                    minimum: 1,
                    example: 1,
                  },
                },
              },
            },
            parts: {
              type: "array",
              items: {
                type: "object",
                required: ["name", "qty"],
                properties: {
                  name: {
                    type: "string",
                    example: "Spark Plugs",
                  },
                  oem: {
                    type: "string",
                    example: "NGK BKR6E",
                  },
                  alt: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                    example: ["Bosch FR7DPP"],
                  },
                  qty: {
                    type: "number",
                    minimum: 1,
                    example: 4,
                  },
                  estimatedCost: {
                    type: "number",
                    minimum: 0,
                    example: 2500,
                  },
                },
              },
            },
            tools: {
              type: "array",
              items: {
                type: "string",
              },
              example: ["Spark plug socket", "Torque wrench"],
            },
            totalEstimatedTime: {
              type: "number",
              minimum: 0,
              example: 90,
            },
            difficulty: {
              type: "string",
              enum: ["easy", "medium", "hard", "expert"],
              example: "medium",
            },
          },
        },
        Quotation: {
          type: "object",
          required: [
            "analysisId",
            "currency",
            "labor",
            "parts",
            "taxPct",
            "markupPct",
          ],
          properties: {
            _id: {
              type: "string",
              description: "Quotation ID",
              example: "507f1f77bcf86cd799439017",
            },
            orgId: {
              type: "string",
              description: "Organization ID",
              example: "507f1f77bcf86cd799439012",
            },
            analysisId: {
              type: "string",
              description: "Analysis ID",
              example: "507f1f77bcf86cd799439015",
            },
            currency: {
              type: "string",
              enum: ["KES", "UGX", "TZS", "USD"],
              example: "KES",
            },
            labor: {
              type: "object",
              required: ["hours", "ratePerHour", "subtotal"],
              properties: {
                hours: {
                  type: "number",
                  minimum: 0,
                  example: 2,
                },
                ratePerHour: {
                  type: "number",
                  minimum: 0,
                  example: 2500,
                },
                subtotal: {
                  type: "number",
                  minimum: 0,
                  example: 5000,
                },
              },
            },
            parts: {
              type: "array",
              items: {
                type: "object",
                required: ["name", "unitPrice", "qty", "subtotal"],
                properties: {
                  name: {
                    type: "string",
                    example: "Spark Plugs",
                  },
                  unitPrice: {
                    type: "number",
                    minimum: 0,
                    example: 2500,
                  },
                  qty: {
                    type: "number",
                    minimum: 1,
                    example: 4,
                  },
                  subtotal: {
                    type: "number",
                    minimum: 0,
                    example: 10000,
                  },
                  partNumber: {
                    type: "string",
                    example: "NGK BKR6E",
                  },
                  isOEM: {
                    type: "boolean",
                    example: true,
                  },
                },
              },
            },
            taxPct: {
              type: "number",
              minimum: 0,
              maximum: 100,
              example: 16,
            },
            markupPct: {
              type: "number",
              minimum: 0,
              maximum: 100,
              example: 15,
            },
            totals: {
              type: "object",
              required: ["parts", "labor", "tax", "grand"],
              properties: {
                parts: {
                  type: "number",
                  minimum: 0,
                  example: 10000,
                },
                labor: {
                  type: "number",
                  minimum: 0,
                  example: 5000,
                },
                tax: {
                  type: "number",
                  minimum: 0,
                  example: 2464,
                },
                grand: {
                  type: "number",
                  minimum: 0,
                  example: 18964,
                },
              },
            },
            status: {
              type: "string",
              enum: ["draft", "sent", "approved", "rejected"],
              example: "draft",
            },
            shareLinkId: {
              type: "string",
              example: "abc123def456",
            },
            notes: {
              type: "string",
              example: "This quotation includes all necessary parts and labor.",
            },
            validUntil: {
              type: "string",
              format: "date-time",
              example: "2024-02-15T10:30:00Z",
            },
          },
        },
        Error: {
          type: "object",
          required: ["type", "title", "detail", "status"],
          properties: {
            type: {
              type: "string",
              description: "Error type identifier",
              example: "validation_error",
            },
            title: {
              type: "string",
              description: "Error title",
              example: "Validation Failed",
            },
            detail: {
              type: "string",
              description: "Detailed error message",
              example: "Invalid input data provided",
            },
            status: {
              type: "number",
              description: "HTTP status code",
              example: 400,
            },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: {
                    type: "string",
                    example: "email",
                  },
                  message: {
                    type: "string",
                    example: "Email is required",
                  },
                },
              },
            },
          },
        },
        Success: {
          type: "object",
          required: ["type", "title"],
          properties: {
            type: {
              type: "string",
              description: "Success type identifier",
              example: "user_created",
            },
            title: {
              type: "string",
              description: "Success title",
              example: "User Created Successfully",
            },
            detail: {
              type: "string",
              description: "Detailed success message",
              example: "User account has been created successfully",
            },
            data: {
              type: "object",
              description: "Response data",
            },
            meta: {
              type: "object",
              description: "Additional metadata",
              properties: {
                total: {
                  type: "number",
                  example: 100,
                },
                page: {
                  type: "number",
                  example: 1,
                },
                pages: {
                  type: "number",
                  example: 10,
                },
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: "Authentication",
        description: "User authentication and authorization endpoints",
      },
      {
        name: "Organizations",
        description: "Organization management endpoints",
      },
      {
        name: "Vehicles",
        description: "Vehicle management endpoints",
      },
      {
        name: "Uploads",
        description: "File upload and parsing endpoints",
      },
      {
        name: "Analysis",
        description: "Diagnostic analysis endpoints",
      },
      {
        name: "Walkthroughs",
        description: "Repair walkthrough generation endpoints",
      },
      {
        name: "Quotations",
        description: "Quotation and estimate endpoints",
      },
      {
        name: "Error Codes",
        description: "DTC library and error code endpoints",
      },
    ],
  },
  apis: ["./routes/*.js", "./server.js"],
};

const specs = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  specs,
  swaggerOptions: {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #667eea; }
      .swagger-ui .scheme-container { background: #f8f9fa; padding: 15px; border-radius: 5px; }
    `,
    customSiteTitle: "Errorlytic SaaS API Documentation",
    customfavIcon: "/favicon.ico",
  },
};
