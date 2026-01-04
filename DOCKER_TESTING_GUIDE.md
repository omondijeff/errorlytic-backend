# 🐳 Errorlytic SaaS API - Docker Testing Guide

## 🚀 **Quick Start with Docker**

### **Prerequisites**

- Docker Desktop installed and running
- Docker Compose installed
- Postman (for API testing)

### **1. Start All Services**

```bash
# Make script executable and run
chmod +x docker-test.sh
./docker-test.sh
```

### **2. Alternative Manual Start**

```bash
# Stop existing containers
docker-compose down

# Build and start all services
docker-compose up --build -d

# Check service status
docker-compose ps
```

---

## 🌐 **Service URLs**

| Service           | URL                            | Credentials              |
| ----------------- | ------------------------------ | ------------------------ |
| **API**           | http://localhost:3000          | -                        |
| **Swagger Docs**  | http://localhost:3000/api-docs | -                        |
| **Health Check**  | http://localhost:3000/health   | -                        |
| **Frontend**      | http://localhost:3001          | -                        |
| **MongoDB**       | mongodb://localhost:27017      | admin/password123        |
| **Mongo Express** | http://localhost:9090          | admin/password123        |
| **Redis**         | redis://localhost:6379         | -                        |
| **MinIO Console** | http://localhost:9001          | minioadmin/minioadmin123 |

---

## 📋 **Testing with Postman**

### **1. Import Collection**

1. Open Postman
2. Click "Import" → "Upload Files"
3. Select `Errorlytic_SaaS_API.postman_collection.json`
4. Collection will be imported with all endpoints organized

### **2. Test Complete Workflow**

1. Open the **"🔄 Complete Workflow"** folder
2. Run requests in order (1-8):
   - Register User
   - Login User (saves tokens automatically)
   - Add Vehicle
   - Upload VCDS File (use `test-vcds-sample.txt`)
   - Process Upload
   - Generate Walkthrough
   - Generate Quotation
   - Export Quotation PDF

### **3. Individual Endpoint Testing**

- **🔐 Authentication** - User management
- **🚗 Vehicles** - Vehicle CRUD operations
- **📁 File Upload** - VCDS/OBD file upload
- **🔍 Analysis** - Diagnostic analysis
- **🛠️ Walkthroughs** - Repair walkthroughs
- **💰 Quotations** - Quotation management
- **📚 Error Codes** - DTC library access

---

## 🔧 **Docker Commands**

### **Service Management**

```bash
# View all services
docker-compose ps

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f app
docker-compose logs -f mongo
docker-compose logs -f redis
docker-compose logs -f minio

# Restart services
docker-compose restart

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### **Database Management**

```bash
# Access MongoDB shell
docker-compose exec mongo mongosh -u admin -p password123

# Access Redis CLI
docker-compose exec redis redis-cli

# Access MinIO CLI
docker-compose exec minio mc
```

---

## 📊 **Testing Scenarios**

### **Scenario 1: Complete Diagnostic Workflow**

1. Register a garage user
2. Add a vehicle
3. Upload VCDS file (`test-vcds-sample.txt`)
4. Process the upload to generate analysis
5. Generate repair walkthrough
6. Create quotation with pricing
7. Export PDF documents

### **Scenario 2: Multi-Currency Testing**

1. Create quotations in different currencies (KES, UGX, TZS, USD)
2. Verify currency formatting and calculations
3. Test tax and markup calculations

### **Scenario 3: File Upload Testing**

1. Test different file formats (TXT, PDF, XML, CSV)
2. Test file size limits
3. Test invalid file handling

### **Scenario 4: Authentication Testing**

1. Test JWT token generation and refresh
2. Test role-based access control
3. Test token expiration and renewal

---

## 🐛 **Troubleshooting**

### **Common Issues**

**1. Services Not Starting**

```bash
# Check Docker status
docker info

# Check service logs
docker-compose logs

# Restart services
docker-compose restart
```

**2. MongoDB Connection Issues**

```bash
# Check MongoDB logs
docker-compose logs mongo

# Restart MongoDB
docker-compose restart mongo
```

**3. MinIO Connection Issues**

```bash
# Check MinIO logs
docker-compose logs minio

# Access MinIO console
open http://localhost:9001
```

**4. API Not Responding**

```bash
# Check API logs
docker-compose logs app

# Check health endpoint
curl http://localhost:3000/health
```

### **Reset Everything**

```bash
# Stop and remove all containers and volumes
docker-compose down -v

# Remove all images (optional)
docker-compose down --rmi all

# Start fresh
docker-compose up --build -d
```

---

## 📁 **Test Files**

### **Sample VCDS File**

- `test-vcds-sample.txt` - Contains P0300 error code for testing

### **Postman Collection**

- `Errorlytic_SaaS_API.postman_collection.json` - Complete API collection

### **Environment Variables**

All environment variables are configured in `docker-compose.yml`:

- MongoDB: `admin/password123`
- Redis: No authentication
- MinIO: `minioadmin/minioadmin123`
- JWT Secret: Configured for development

---

## 🎯 **Success Criteria**

### **✅ All Services Running**

- API responds to health check
- MongoDB accepts connections
- Redis accepts connections
- MinIO console accessible
- Swagger UI loads correctly

### **✅ Complete Workflow Test**

- User registration and login
- Vehicle creation
- File upload and parsing
- Analysis generation
- Walkthrough creation
- Quotation generation
- PDF export

### **✅ API Features Working**

- JWT authentication
- Multi-currency support
- File upload handling
- Error handling
- Role-based access control

---

## 🚀 **Production Deployment**

For production deployment, update:

1. Environment variables in `docker-compose.yml`
2. JWT secrets and database passwords
3. MinIO credentials
4. API keys and external service URLs
5. SSL/TLS configuration
6. Resource limits and scaling

---

**🎉 Happy Testing! The Errorlytic SaaS API is ready for comprehensive testing in Docker!**
