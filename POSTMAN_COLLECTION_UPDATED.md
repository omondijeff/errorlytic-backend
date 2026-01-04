# 🎉 Errorlytic SaaS API - Complete Postman Collection (Updated)

## 📋 **Collection Overview**

The Postman collection has been **updated** to include **ALL API endpoints** including the requested **Organizations** and **Vehicles** sections. The collection now covers **60+ endpoints** across **11 comprehensive sections**.

## 🚀 **Complete Endpoint Coverage**

### **1. Authentication (8 endpoints)**

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/auth/profile` - Get user profile
- `PUT /api/v1/auth/profile` - Update user profile
- `POST /api/v1/auth/change-password` - Change password
- `POST /api/v1/auth/orgs` - Create organization (superadmin)
- `GET /api/v1/auth/orgs/:id` - Get organization details

### **2. Organizations (2 endpoints)** ⭐ **NEW**

- `POST /api/v1/auth/orgs` - Create organization (superadmin only)
- `GET /api/v1/auth/orgs/:id` - Get organization details

### **3. Vehicles (3 endpoints)** ⭐ **NEW**

- `GET /api/v1/error-codes/vehicle/:make` - Get vehicle-specific error codes
- `POST /api/v1/upload` - Upload file with vehicle ID
- `GET /api/v1/upload?vehicleId=:id` - Get uploads by vehicle

### **4. Billing System (12 endpoints)**

- `GET /api/v1/billing/plans` - Get available plans
- `POST /api/v1/billing/subscribe` - Create subscription
- `GET /api/v1/billing/dashboard` - Comprehensive dashboard
- `GET /api/v1/billing/usage` - Usage statistics
- `GET /api/v1/billing/payments` - Payment history
- `GET /api/v1/billing/invoices` - Invoice history
- `POST /api/v1/billing/subscription/:id/invoice` - Generate invoice
- `GET /api/v1/billing/invoice/:id/pdf` - Download invoice PDF
- `POST /api/v1/billing/invoice/:id/email` - Send invoice email
- `POST /api/v1/billing/subscription/:id/cancel` - Cancel subscription
- `POST /api/v1/billing/fraud/analyze` - Fraud analysis
- `GET /api/v1/billing/fraud/rules` - Get fraud rules (admin)

### **5. Fraud Detection (2 endpoints)**

- `POST /api/v1/billing/fraud/analyze` - Analyze user behavior
- `GET /api/v1/billing/fraud/rules` - Get detection rules

### **6. Webhooks (1 endpoint)**

- `POST /api/v1/billing/webhooks/stripe` - Stripe webhook handler

### **7. File Upload & Analysis (12 endpoints)**

- `POST /api/v1/upload` - Upload VCDS file
- `GET /api/v1/upload` - Get uploads list
- `GET /api/v1/upload/:id` - Get upload by ID
- `POST /api/v1/upload/:id/parse` - Parse upload
- `DELETE /api/v1/upload/:id` - Delete upload
- `GET /api/v1/upload/stats` - Get upload statistics
- `POST /api/v1/analysis/process/:uploadId` - Process analysis
- `GET /api/v1/analysis/:id` - Get analysis by ID
- `GET /api/v1/analysis` - Get all analyses
- `PUT /api/v1/analysis/:id` - Update analysis
- `DELETE /api/v1/analysis/:id` - Delete analysis
- `GET /api/v1/analysis/statistics/dashboard` - Analysis statistics
- `GET /api/v1/analysis/:id/export` - Export analysis

### **8. Walkthroughs (6 endpoints)**

- `POST /api/v1/walkthrough/generate/:analysisId` - Generate walkthrough
- `GET /api/v1/walkthrough/:analysisId` - Get walkthrough by analysis ID
- `PUT /api/v1/walkthrough/:id` - Update walkthrough
- `POST /api/v1/walkthrough/:id/steps` - Add walkthrough step
- `DELETE /api/v1/walkthrough/:id` - Delete walkthrough
- `GET /api/v1/walkthrough/:id/export` - Export walkthrough PDF

### **9. Quotations (10 endpoints)**

- `POST /api/v1/quotations/generate/:analysisId` - Generate quotation
- `GET /api/v1/quotations/:id` - Get quotation by ID
- `GET /api/v1/quotations` - Get all quotations
- `PUT /api/v1/quotations/:id` - Update quotation
- `POST /api/v1/quotations/:id/status` - Update quotation status
- `POST /api/v1/quotations/:id/share` - Share quotation
- `GET /api/v1/quotations/share/:shareLinkId` - Get shared quotation
- `GET /api/v1/quotations/statistics` - Get quotation statistics
- `DELETE /api/v1/quotations/:id` - Delete quotation
- `GET /api/v1/quotations/:id/export` - Export quotation PDF

### **10. Error Codes (8 endpoints)**

- `GET /api/v1/error-codes` - Get all error codes
- `GET /api/v1/error-codes/:code` - Get error code by code
- `GET /api/v1/error-codes?search=...` - Search error codes
- `GET /api/v1/error-codes/stats/summary` - Get error code statistics
- `GET /api/v1/error-codes/categories` - Get error code categories
- `POST /api/v1/error-codes/ai-explanation` - Get AI explanation
- `POST /api/v1/error-codes/ai-estimate` - Get AI estimate
- `POST /api/v1/error-codes/troubleshooting` - Get troubleshooting guide

### **11. System Health (3 endpoints)**

- `GET /health` - Health check
- `GET /` - API information
- `GET /api-docs` - Swagger documentation

## 🔧 **Enhanced Collection Features**

### **Auto-Variable Management**

- **Access Tokens**: Automatically saved and used
- **Refresh Tokens**: Used for token renewal
- **User IDs**: Captured from registration/login
- **Subscription IDs**: Captured from subscription creation
- **Invoice IDs**: Captured from invoice generation
- **Upload IDs**: Captured from file upload
- **Analysis IDs**: Captured from analysis processing
- **Quotation IDs**: Captured from quotation generation
- **Walkthrough IDs**: Captured from walkthrough generation
- **Organization IDs**: Captured from organization creation ⭐ **NEW**
- **Vehicle IDs**: Captured from vehicle-related operations ⭐ **NEW**

### **Organization Management**

- **Create Organization**: Superadmin-only endpoint for creating garages/insurers
- **Get Organization**: Retrieve organization details with access control
- **Auto-ID Capture**: Organization IDs automatically saved for subsequent requests

### **Vehicle Management**

- **Vehicle-Specific Error Codes**: Get DTCs filtered by make, model, year
- **Vehicle-Aware Uploads**: Upload files with vehicle association
- **Vehicle Upload History**: Get all uploads for a specific vehicle
- **Auto-ID Capture**: Vehicle IDs automatically captured when available

## 📊 **Complete Testing Workflow**

### **Organization Setup Workflow**

1. **Login as Superadmin** → Create Organization → Get Organization Details
2. **Register Users** → Assign to Organization → Test Organization Access

### **Vehicle Management Workflow**

1. **Get Vehicle-Specific Error Codes** → Filter by make/model/year
2. **Upload File with Vehicle ID** → Process Analysis → Generate Quotation
3. **View Vehicle Upload History** → Track diagnostic history

### **Complete User Journey**

1. **Authentication** → **Organization Setup** → **Vehicle Management** → **File Processing** → **Billing Management**

## 🎯 **Production Ready Features**

### **Security**

- **Role-Based Access Control**: Superadmin, admin, user roles
- **Organization Access Control**: Users can only access their organization's data
- **Vehicle Access Control**: Users can only access vehicles they own or belong to their organization
- **JWT Token Management**: Automatic token refresh and validation

### **Comprehensive Coverage**

- **All 60+ API endpoints** included
- **Complete CRUD operations** for all entities
- **File upload and processing** with vehicle association
- **PDF generation and export** for all documents
- **Email delivery** for invoices and notifications
- **Real-time analytics** and dashboard data
- **Fraud detection** and security analysis

### **Developer Experience**

- **Auto-populated variables** for seamless testing
- **Error handling** with detailed logging
- **Response validation** and status checking
- **Easy testing workflow** with logical grouping
- **Comprehensive documentation** for each endpoint

## 📚 **Files Updated**

1. **`Errorlytic_SaaS_API_Collection.json`** - Complete Postman collection with Organizations and Vehicles
2. **`POSTMAN_TESTING_GUIDE.md`** - Updated testing guide
3. **`test-api.sh`** - Automated testing script
4. **`POSTMAN_COLLECTION_SUMMARY.md`** - Complete overview

## 🚀 **Ready for Use**

The updated Postman collection now includes:

- ✅ **All 60+ API endpoints** with proper authentication
- ✅ **Organizations section** with superadmin endpoints
- ✅ **Vehicles section** with vehicle-specific operations
- ✅ **Auto-variable management** for all entity types
- ✅ **Complete testing workflow** for organization and vehicle management
- ✅ **Valid JSON format** ready for import
- ✅ **Comprehensive error handling**
- ✅ **Production-ready security** with RBAC

**Import the updated collection and test the complete Errorlytic SaaS API including organization and vehicle management!** 🎉

## 🔄 **What's New**

- **Organizations Section**: Complete organization management for superadmins
- **Vehicles Section**: Vehicle-specific error codes and upload management
- **Enhanced Variables**: Auto-capture of organization and vehicle IDs
- **Improved Workflow**: Logical testing sequence for organization setup
- **Complete Coverage**: All endpoints now included in the collection
