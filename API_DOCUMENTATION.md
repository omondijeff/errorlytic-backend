# Errorlytic SaaS API Documentation

## 🚀 **Interactive API Documentation**

Our Errorlytic SaaS API is fully documented with **Swagger/OpenAPI 3.0** specification, providing interactive documentation that allows you to:

- **Explore all endpoints** with detailed descriptions
- **Test API calls directly** from the browser
- **View request/response schemas** with examples
- **Authenticate and make real API calls**
- **Download OpenAPI specification** for code generation

### 📖 **Access Documentation**

**Live Documentation:** [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

**API Base URL:** `http://localhost:3000/api/v1`

---

## 🏗️ **API Architecture**

### **Authentication & Authorization**

- **JWT-based authentication** with access and refresh tokens
- **Role-based access control (RBAC)** with 6 user roles
- **Multi-tenant organization support**

### **Core Features**

- **Multi-currency support** (KES, UGX, TZS, USD)
- **S3-compatible file storage** (MinIO integration)
- **AI-powered DTC analysis** (OpenAI integration)
- **Real-time caching** (Redis integration)
- **Comprehensive audit logging**

---

## 📋 **API Endpoints Overview**

### **Authentication** (`/api/v1/auth`)

- `POST /register` - Register new user
- `POST /login` - User login with JWT tokens
- `POST /refresh` - Refresh access token
- `GET /profile` - Get user profile
- `PUT /profile` - Update user profile
- `POST /logout` - User logout

### **Organizations** (`/api/v1/organizations`)

- `POST /` - Create organization (Superadmin only)
- `GET /` - List organizations (Superadmin only)
- `GET /:id` - Get organization details
- `PUT /:id` - Update organization
- `DELETE /:id` - Delete organization (Superadmin only)

### **Vehicles** (`/api/v1/vehicles`)

- `POST /` - Add vehicle
- `GET /` - List vehicles
- `GET /:id` - Get vehicle details
- `PUT /:id` - Update vehicle
- `DELETE /:id` - Delete vehicle

### **File Uploads** (`/api/v1/upload`)

- `POST /` - Upload VCDS/OBD file
- `GET /` - List uploads
- `GET /:id` - Get upload details
- `DELETE /:id` - Delete upload

### **Analysis** (`/api/v1/analysis`)

- `POST /generate/:uploadId` - Generate analysis from upload
- `GET /` - List analyses
- `GET /:id` - Get analysis details
- `PUT /:id` - Update analysis
- `DELETE /:id` - Delete analysis

### **Walkthroughs** (`/api/v1/walkthrough`)

- `POST /generate/:analysisId` - Generate repair walkthrough
- `GET /:analysisId` - Get walkthrough
- `PUT /:walkthroughId` - Update walkthrough
- `POST /:walkthroughId/steps` - Add step to walkthrough
- `DELETE /:walkthroughId` - Delete walkthrough
- `GET /:walkthroughId/export` - Export walkthrough as PDF

### **Quotations** (`/api/v1/quotations`)

- `POST /generate/:analysisId` - Generate quotation
- `GET /` - List quotations
- `GET /:id` - Get quotation details
- `PUT /:id` - Update quotation
- `POST /:id/status` - Update quotation status
- `POST /:id/share` - Generate shareable link
- `GET /share/:shareLinkId` - Get quotation by share link (public)
- `GET /statistics` - Get quotation statistics
- `GET /:id/export` - Export quotation as PDF
- `DELETE /:id` - Delete quotation

### **Error Codes** (`/api/v1/error-codes`)

- `GET /` - List DTC codes
- `GET /:code` - Get DTC code details
- `POST /` - Add DTC code (Admin only)
- `PUT /:id` - Update DTC code (Admin only)
- `DELETE /:id` - Delete DTC code (Admin only)

---

## 🔐 **Authentication**

### **Getting Started**

1. **Register** a new user: `POST /api/v1/auth/register`
2. **Login** to get tokens: `POST /api/v1/auth/login`
3. **Use access token** in Authorization header: `Bearer <access_token>`
4. **Refresh token** when expired: `POST /api/v1/auth/refresh`

### **User Roles**

- **`individual`** - Individual users
- **`garage_user`** - Garage employees
- **`garage_admin`** - Garage administrators
- **`insurer_user`** - Insurance company employees
- **`insurer_admin`** - Insurance company administrators
- **`superadmin`** - System administrators

### **Token Management**

- **Access Token**: 15 minutes expiry
- **Refresh Token**: 7 days expiry
- **Automatic refresh**: Use refresh token to get new access token

---

## 💰 **Multi-Currency Support**

### **Supported Currencies**

- **KES** - Kenyan Shilling
- **UGX** - Ugandan Shilling
- **TZS** - Tanzanian Shilling
- **USD** - US Dollar

### **Currency Formatting**

All monetary values are formatted with proper currency symbols:

- KES: `KSh 1,000`
- UGX: `USh 1,000`
- TZS: `TSh 1,000`
- USD: `$1,000`

---

## 📊 **Data Models**

### **User Schema**

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "role": "garage_user",
  "orgId": "507f1f77bcf86cd799439012",
  "profile": {
    "name": "John Doe",
    "phone": "+254712345678"
  },
  "plan": {
    "name": "professional",
    "limits": {
      "analysesPerMonth": 100,
      "quotationsPerMonth": 50
    }
  },
  "isActive": true
}
```

### **Organization Schema**

```json
{
  "_id": "507f1f77bcf86cd799439012",
  "type": "garage",
  "name": "Premium Auto Garage",
  "country": "Kenya",
  "currency": "KES",
  "settings": {
    "timezone": "Africa/Nairobi",
    "laborRate": 2500,
    "markupPercentage": 15,
    "taxPercentage": 16
  }
}
```

### **Vehicle Schema**

```json
{
  "_id": "507f1f77bcf86cd799439013",
  "vin": "WVWZZZ1JZ2W386752",
  "make": "VW",
  "model": "Golf",
  "year": 2018,
  "engineType": "1.4 TSI",
  "mileage": 50000,
  "color": "Silver"
}
```

### **Analysis Schema**

```json
{
  "_id": "507f1f77bcf86cd799439015",
  "dtcs": [
    {
      "code": "P0300",
      "description": "Random/Multiple Cylinder Misfire Detected",
      "status": "active"
    }
  ],
  "summary": {
    "overview": "Found 1 critical error code requiring immediate attention",
    "severity": "critical"
  },
  "causes": ["Engine", "Ignition System"],
  "recommendations": ["Check ignition system", "Replace spark plugs"],
  "module": "Engine",
  "aiEnrichment": {
    "enabled": true,
    "confidence": 0.85,
    "provider": "openai"
  }
}
```

### **Quotation Schema**

```json
{
  "_id": "507f1f77bcf86cd799439017",
  "currency": "KES",
  "labor": {
    "hours": 2,
    "ratePerHour": 2500,
    "subtotal": 5000
  },
  "parts": [
    {
      "name": "Spark Plugs",
      "unitPrice": 2500,
      "qty": 4,
      "subtotal": 10000,
      "partNumber": "NGK BKR6E",
      "isOEM": true
    }
  ],
  "taxPct": 16,
  "markupPct": 15,
  "totals": {
    "parts": 10000,
    "labor": 5000,
    "tax": 2464,
    "grand": 18964
  },
  "status": "draft",
  "notes": "This quotation includes all necessary parts and labor."
}
```

---

## 🚀 **Getting Started**

### **1. Prerequisites**

- Node.js 16+ installed
- MongoDB running
- Redis running (optional, for caching)
- MinIO running (for file storage)

### **2. Installation**

```bash
# Clone repository
git clone <repository-url>
cd Errorlytic

# Install dependencies
npm install

# Set up environment variables
cp env.example .env
# Edit .env with your configuration

# Start services
npm start
```

### **3. Environment Variables**

```bash
# Database
MONGODB_URI=mongodb://localhost:27017/Errorlytic_saas

# JWT
JWT_SECRET=your_jwt_secret_key_here

# Redis
REDIS_URL=redis://localhost:6379

# MinIO/S3
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET=Errorlytic-uploads
MINIO_USE_SSL=false

# OpenAI
OPENAI_API_KEY=your_openai_api_key_here

# Server
PORT=3000
NODE_ENV=development
```

### **4. Testing the API**

1. **Start the server**: `npm start`
2. **Open Swagger UI**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
3. **Register a user** using the `/api/v1/auth/register` endpoint
4. **Login** using the `/api/v1/auth/login` endpoint
5. **Copy the access token** from the response
6. **Click "Authorize"** in Swagger UI and paste the token
7. **Test other endpoints** with authentication

---

## 📝 **API Response Format**

### **Success Response**

```json
{
  "type": "success_type",
  "title": "Success Title",
  "detail": "Detailed success message",
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

### **Error Response**

```json
{
  "type": "error_type",
  "title": "Error Title",
  "detail": "Detailed error message",
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

## 🔧 **Development Tools**

### **Testing**

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/services/analysisService.test.js

# Run tests with coverage
npm test -- --coverage
```

### **API Testing with cURL**

```bash
# Register user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123","profile":{"name":"Test User"}}'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123"}'

# Use token in subsequent requests
curl -X GET http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer <access_token>"
```

---

## 📚 **Additional Resources**

- **Swagger UI**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
- **Health Check**: [http://localhost:3000/health](http://localhost:3000/health)
- **API Root**: [http://localhost:3000/](http://localhost:3000/)

---

## 🤝 **Support**

For API support and questions:

- **Email**: support@Errorlytic.com
- **Documentation**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
- **Health Check**: [http://localhost:3000/health](http://localhost:3000/health)

---

**Errorlytic SaaS API v1.0.0** - Professional Automotive Diagnostic Platform
