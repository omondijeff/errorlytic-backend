# Errorlytic Backend API

## 🚀 **Overview**

This is the backend API for Errorlytic, a comprehensive **Multi-tenant SaaS platform** for automotive diagnostics with AI-powered error code analysis. The backend API provides advanced diagnostic capabilities, billing management, and multi-currency support for automotive repair businesses across East Africa.

> **Note**: This is the backend component of the Errorlytic platform. For the complete project overview, see the [root README](../README.md).

### **Key Features**

- 🔐 **Multi-tenant Architecture** with organization-based isolation
- 🤖 **AI-Powered Analysis** using OpenAI for intelligent error code interpretation
- 💰 **Multi-Currency Support** (KES, UGX, TZS, USD) with proper formatting
- 📊 **Advanced Billing System** with subscriptions, invoicing, and fraud detection
- 🔒 **Role-Based Access Control** with 6 distinct user roles
- 📁 **S3-Compatible File Storage** for diagnostic reports and documents
- ⚡ **Real-time Caching** with Redis for optimal performance
- 📋 **Comprehensive Audit Logging** for compliance and tracking
- 🐳 **Docker-Ready** with complete containerization setup

---

## 🏗️ **System Architecture**

### **Technology Stack**

- **Backend**: Node.js + Express.js
- **Database**: MongoDB with Mongoose ODM
- **Cache**: Redis for session management and caching
- **File Storage**: MinIO (S3-compatible)
- **AI Integration**: OpenAI GPT-4 for intelligent analysis
- **Authentication**: JWT with refresh token mechanism
- **Payment Processing**: Stripe integration
- **Documentation**: Swagger/OpenAPI 3.0
- **Containerization**: Docker + Docker Compose

### **API Architecture**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Load Balancer │    │   API Gateway  │
│   (React/Vue)   │◄──►│   (Nginx)      │◄──►│   (Express)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                       ┌─────────────────────────────────┼─────────────────────────────────┐
                       │                                 │                                 │
                       ▼                                 ▼                                 ▼
              ┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
              │   Authentication │              │   Business      │              │   External      │
              │   & Authorization│              │   Logic         │              │   Services      │
              │   (JWT + RBAC)   │              │   (Services)    │              │   (OpenAI,      │
              └─────────────────┘              └─────────────────┘              │    Stripe, etc.) │
                       │                                 │                                 │
                       ▼                                 ▼                                 ▼
              ┌─────────────────┐              ┌─────────────────┐              └─────────────────┘
              │   Data Layer    │              │   Cache Layer   │
              │   (MongoDB)     │              │   (Redis)       │
              └─────────────────┘              └─────────────────┘
```

---

## 🚀 **Quick Start**

### **Prerequisites**

- Node.js 16+
- MongoDB 6.0+
- Redis 7+
- MinIO (S3-compatible storage)
- OpenAI API Key
- Stripe Account (for payments)

### **Local Development Setup**

1. **Install Dependencies**

```bash
npm install
```

2. **Environment Configuration**

```bash
cp env.example .env
# Edit .env with your configuration
```

3. **Start Services**

```bash
# Start MongoDB, Redis, and MinIO locally
# Or use Docker Compose for all services
docker-compose up -d

# Start the application
npm run dev
```

4. **Access the API**

- **API Base URL**: `http://localhost:3000`
- **Swagger Documentation**: `http://localhost:3000/api-docs`
- **Health Check**: `http://localhost:3000/health`

---

## 🐳 **Docker Deployment**

### **Complete Docker Setup**

The system includes a comprehensive Docker setup with all required services:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### **Docker Services**

| Service           | Port      | Description           |
| ----------------- | --------- | --------------------- |
| **app**           | 3002      | Main API application  |
| **mongo**         | 27018     | MongoDB database      |
| **mongo-express** | 9091      | MongoDB web interface |
| **redis**         | 6381      | Redis cache           |
| **minio**         | 9002/9003 | S3-compatible storage |

### **Production Deployment**

```bash
# Build production image
docker build -t Errorlytic-api .

# Run with production environment
docker run -d \
  --name Errorlytic-api \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e MONGODB_URI=mongodb://your-mongo-host:27017/Errorlytic \
  Errorlytic-api
```

---

## 🔐 **Authentication & Authorization**

### **Authentication Flow**

1. **Register**: `POST /api/v1/auth/register`
2. **Login**: `POST /api/v1/auth/login` → Receive JWT tokens
3. **Use Access Token**: Include in `Authorization: Bearer <token>` header
4. **Refresh**: `POST /api/v1/auth/refresh` when token expires

### **User Roles & Permissions**

| Role              | Description              | Permissions                         |
| ----------------- | ------------------------ | ----------------------------------- |
| **individual**    | Individual users         | Basic analysis, personal quotations |
| **garage_user**   | Garage employees         | Organization analysis, quotations   |
| **garage_admin**  | Garage administrators    | Full garage management, billing     |
| **insurer_user**  | Insurance employees      | View claims, basic analysis         |
| **insurer_admin** | Insurance administrators | Full insurance management           |
| **superadmin**    | System administrators    | Full system access                  |

### **Token Management**

- **Access Token**: 15 minutes expiry
- **Refresh Token**: 7 days expiry
- **Automatic Refresh**: Built-in token refresh mechanism

---

## 📋 **API Endpoints Overview**

### **Authentication** (`/api/v1/auth`)

- `POST /register` - User registration
- `POST /login` - User login
- `POST /refresh` - Token refresh
- `GET /profile` - Get user profile
- `PUT /profile` - Update profile
- `POST /change-password` - Change password
- `POST /orgs` - Create organization
- `GET /orgs/:id` - Get organization

### **File Upload & Analysis** (`/api/v1/upload`, `/api/v1/analysis`)

- `POST /upload` - Upload VCDS/OBD files
- `GET /upload` - List uploads
- `POST /analysis/process/:uploadId` - Generate AI analysis
- `GET /analysis/:id` - Get analysis details
- `GET /analysis/statistics/dashboard` - Analysis statistics

### **Walkthroughs** (`/api/v1/walkthrough`)

- `POST /walkthrough/generate/:analysisId` - Generate repair walkthrough
- `GET /walkthrough/:analysisId` - Get walkthrough
- `PUT /walkthrough/:id` - Update walkthrough
- `POST /walkthrough/:id/steps` - Add repair steps
- `GET /walkthrough/:id/export` - Export as PDF

### **Quotations** (`/api/v1/quotations`)

- `POST /quotations/generate/:analysisId` - Generate quotation
- `GET /quotations` - List quotations
- `PUT /quotations/:id` - Update quotation
- `POST /quotations/:id/status` - Update status
- `POST /quotations/:id/share` - Generate shareable link
- `GET /quotations/:id/export` - Export as PDF

### **Billing System** (`/api/v1/billing`)

- `GET /billing/plans` - Available subscription plans
- `POST /billing/subscribe` - Create subscription
- `GET /billing/dashboard` - Billing dashboard
- `GET /billing/usage` - Usage statistics
- `GET /billing/payments` - Payment history
- `GET /billing/invoices` - Invoice history
- `POST /billing/subscription/:id/invoice` - Generate invoice
- `GET /billing/invoice/:id/pdf` - Download invoice PDF

### **Error Codes** (`/api/v1/error-codes`)

- `GET /error-codes` - List DTC codes
- `GET /error-codes/:code` - Get specific DTC
- `POST /error-codes/ai-explanation` - AI-powered explanation
- `POST /error-codes/ai-estimate` - AI cost estimation
- `POST /error-codes/troubleshooting` - Troubleshooting guide

---

## 💰 **Multi-Currency Support**

### **Supported Currencies**

| Currency           | Code | Symbol | Format Example |
| ------------------ | ---- | ------ | -------------- |
| Kenyan Shilling    | KES  | KSh    | KSh 1,000.00   |
| Ugandan Shilling   | UGX  | USh    | USh 1,000.00   |
| Tanzanian Shilling | TZS  | TSh    | TSh 1,000.00   |
| US Dollar          | USD  | $      | $1,000.00      |

### **Currency Features**

- **Automatic Formatting**: Proper currency symbols and formatting
- **Exchange Rate Support**: Real-time currency conversion
- **Regional Pricing**: Localized pricing for different markets
- **Multi-Currency Invoicing**: Generate invoices in any supported currency

---

## 📊 **Data Models**

### **Core Entities**

#### **User Model**

```javascript
{
  _id: ObjectId,
  email: String,
  password: String (hashed),
  role: String, // individual, garage_user, garage_admin, etc.
  orgId: ObjectId,
  profile: {
    name: String,
    phone: String,
    country: String
  },
  plan: {
    name: String,
    limits: {
      analysesPerMonth: Number,
      quotationsPerMonth: Number
    }
  },
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

#### **Organization Model**

```javascript
{
  _id: ObjectId,
  type: String, // garage, insurer, individual
  name: String,
  address: {
    street: String,
    city: String,
    country: String
  },
  currency: String, // KES, UGX, TZS, USD
  settings: {
    timezone: String,
    laborRate: Number,
    markupPercentage: Number,
    taxPercentage: Number
  },
  subscription: ObjectId,
  isActive: Boolean
}
```

#### **Analysis Model**

```javascript
{
  _id: ObjectId,
  uploadId: ObjectId,
  userId: ObjectId,
  orgId: ObjectId,
  dtcs: [{
    code: String,
    description: String,
    status: String // active, pending, resolved
  }],
  summary: {
    overview: String,
    severity: String, // low, medium, high, critical
    confidence: Number
  },
  causes: [String],
  recommendations: [String],
  module: String,
  aiEnrichment: {
    enabled: Boolean,
    confidence: Number,
    provider: String
  },
  createdAt: Date
}
```

---

## 🔧 **Environment Configuration**

### **Required Environment Variables**

```bash
# Server Configuration
NODE_ENV=development
PORT=3000

# Database
MONGODB_URI=mongodb://localhost:27017/Errorlytic_saas

# Authentication
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=24h

# External Services
OPENAI_API_KEY=your_openai_api_key_here
STRIPE_SECRET_KEY=sk_test_your_stripe_key
REDIS_URL=redis://localhost:6379

# File Storage
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET=Errorlytic-uploads

# Email (for invoices)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

---

## 🧪 **Testing**

### **Running Tests**

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- tests/services/analysisService.test.js

# Run with coverage
npm test -- --coverage

# Run integration tests
npm run test:integration
```

### **API Testing with Postman**

The project includes a comprehensive Postman collection:

- **File**: `Errorlytic SaaS API Collection.json`
- **Environment**: Configure `baseUrl` variable
- **Authentication**: Automatic token management
- **Test Scripts**: Auto-save IDs and validate responses

### **Manual API Testing**

```bash
# Register user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123",
    "profile": {
      "name": "Test User",
      "phone": "+254700000000"
    }
  }'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123"
  }'

# Use token in requests
curl -X GET http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer <access_token>"
```

---

## 📚 **API Documentation**

### **Interactive Documentation**

- **Swagger UI**: `http://localhost:3000/api-docs`
- **OpenAPI Spec**: `http://localhost:3000/api-docs/swagger.json`
- **Health Check**: `http://localhost:3000/health`

### **Response Format**

#### **Success Response**

```json
{
  "type": "success",
  "title": "Operation Successful",
  "detail": "Resource created successfully",
  "data": {
    // Response data
  },
  "meta": {
    "total": 100,
    "page": 1,
    "pages": 10
  }
}
```

#### **Error Response**

```json
{
  "type": "error",
  "title": "Validation Error",
  "detail": "Request validation failed",
  "status": 400,
  "errors": [
    {
      "field": "email",
      "message": "Email is required"
    }
  ]
}
```

---

## 🚀 **Production Deployment**

### **Docker Production Setup**

```bash
# Build production image
docker build -t Errorlytic-api:latest .

# Run with production environment
docker run -d \
  --name Errorlytic-api \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e MONGODB_URI=mongodb://your-production-mongo:27017/Errorlytic \
  -e JWT_SECRET=your-production-jwt-secret \
  -e OPENAI_API_KEY=your-openai-key \
  Errorlytic-api:latest
```

### **Environment-Specific Configuration**

```bash
# Production environment variables
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://production-mongo:27017/Errorlytic_prod
JWT_SECRET=your-super-secure-jwt-secret
OPENAI_API_KEY=your-production-openai-key
STRIPE_SECRET_KEY=sk_live_your-live-stripe-key
REDIS_URL=redis://production-redis:6379
MINIO_ENDPOINT=production-minio
MINIO_USE_SSL=true
```

### **Health Monitoring**

```bash
# Health check endpoint
curl http://localhost:3000/health

# Expected response
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "environment": "production"
}
```

---

## 🔒 **Security Features**

### **Authentication Security**

- JWT-based authentication with short-lived access tokens
- Refresh token rotation for enhanced security
- Password hashing with bcrypt
- Rate limiting to prevent brute force attacks

### **Data Protection**

- Input validation and sanitization
- SQL injection prevention (NoSQL)
- CORS configuration for cross-origin requests
- Helmet.js for security headers

### **Fraud Detection**

- Built-in fraud detection system
- Suspicious activity monitoring
- IP-based rate limiting
- Transaction pattern analysis

---

## 📈 **Performance & Monitoring**

### **Caching Strategy**

- Redis for session storage
- API response caching
- Database query optimization
- File upload optimization

### **Monitoring Endpoints**

- `/health` - System health check
- `/api/v1/billing/dashboard` - Usage statistics
- `/api/v1/analysis/statistics/dashboard` - Analysis metrics

### **Logging**

- Comprehensive audit logging
- Error tracking and monitoring
- Performance metrics collection
- User activity tracking

---

## 🤝 **Support & Contributing**

### **Getting Help**

- **Documentation**: `http://localhost:3000/api-docs`
- **Health Check**: `http://localhost:3000/health`
- **Issues**: Create GitHub issues for bugs and feature requests

### **Development Guidelines**

- Follow RESTful API conventions
- Write comprehensive tests
- Update documentation for new endpoints
- Follow the existing code structure

---

## 📄 **License**

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Errorlytic Backend API v1.0.0** - Professional Automotive Diagnostic Platform

_Built with ❤️ for the automotive industry in East Africa_
