# 🚀 Errorlytic API - Quick curl Testing Guide

## 📋 Prerequisites

- Server running on `http://localhost:3000`
- MongoDB, Redis, and MinIO services running
- `jq` installed for JSON formatting (optional but recommended)

## 🔧 Setup

```bash
# Install jq for better JSON formatting (macOS)
brew install jq

# Install jq for better JSON formatting (Ubuntu/Debian)
sudo apt-get install jq
```

## 🔐 Authentication Flow

### 1. Register a new user

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@Errorlytic.com",
    "password": "TestPassword123!",
    "firstName": "Test",
    "lastName": "User",
    "phone": "+254700000000",
    "role": "user"
  }' | jq '.'
```

### 2. Login and get tokens

```bash
# Login and save response
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@Errorlytic.com",
    "password": "TestPassword123!"
  }')

# Extract tokens
ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken')
REFRESH_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.refreshToken')
USER_ID=$(echo $LOGIN_RESPONSE | jq -r '.user.id')

echo "Access Token: $ACCESS_TOKEN"
echo "User ID: $USER_ID"
```

### 3. Test authenticated endpoints

```bash
# Get user profile
curl -X GET http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# Update profile
curl -X PUT http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Updated",
    "lastName": "User"
  }' | jq '.'
```

## 🏢 Organization Management

### Create Organization (Superadmin only)

```bash
curl -X POST http://localhost:3000/api/v1/auth/orgs \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Garage",
    "type": "garage",
    "email": "garage@test.com",
    "phone": "+254700000000",
    "address": "123 Test Street, Nairobi",
    "description": "Test garage for Errorlytic"
  }' | jq '.'
```

### Get Organization Details

```bash
# Replace ORG_ID with actual organization ID
curl -X GET http://localhost:3000/api/v1/auth/orgs/ORG_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
```

## 🚗 Vehicle Management

### Get Vehicle-Specific Error Codes

```bash
# Get error codes for Volkswagen
curl -X GET http://localhost:3000/api/v1/error-codes/vehicle/volkswagen | jq '.'

# Get error codes for Audi
curl -X GET http://localhost:3000/api/v1/error-codes/vehicle/audi | jq '.'
```

### Upload File with Vehicle ID

```bash
# Create a test file
echo "Test VCDS diagnostic data" > test_vcds.txt

# Upload with vehicle association
curl -X POST http://localhost:3000/api/v1/upload \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "file=@test_vcds.txt" \
  -F "vehicleId=test-vehicle-123" \
  -F "description=Test upload" | jq '.'

# Clean up
rm test_vcds.txt
```

### Get Uploads by Vehicle

```bash
curl -X GET "http://localhost:3000/api/v1/upload?vehicleId=test-vehicle-123" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
```

## 💳 Billing System

### Get Available Plans

```bash
curl -X GET http://localhost:3000/api/v1/billing/plans \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
```

### Create Subscription

```bash
curl -X POST http://localhost:3000/api/v1/billing/subscribe \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "basic",
    "paymentMethodId": "pm_test_123"
  }' | jq '.'
```

### Get Billing Dashboard

```bash
curl -X GET http://localhost:3000/api/v1/billing/dashboard \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
```

### Get Usage Statistics

```bash
curl -X GET http://localhost:3000/api/v1/billing/usage \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
```

## 📁 File Upload & Analysis

### Upload VCDS File

```bash
# Create test file
echo "Test VCDS diagnostic data" > test_vcds.txt

# Upload file
UPLOAD_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/upload \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "file=@test_vcds.txt" \
  -F "description=Test VCDS file")

# Extract upload ID
UPLOAD_ID=$(echo $UPLOAD_RESPONSE | jq -r '.uploadId')
echo "Upload ID: $UPLOAD_ID"

# Clean up
rm test_vcds.txt
```

### Get Uploads List

```bash
curl -X GET http://localhost:3000/api/v1/upload \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
```

### Parse Upload

```bash
curl -X POST http://localhost:3000/api/v1/upload/$UPLOAD_ID/parse \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
```

### Process Analysis

```bash
ANALYSIS_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/analysis/process/$UPLOAD_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN")

ANALYSIS_ID=$(echo $ANALYSIS_RESPONSE | jq -r '.analysisId')
echo "Analysis ID: $ANALYSIS_ID"
```

### Get Analysis Results

```bash
curl -X GET http://localhost:3000/api/v1/analysis/$ANALYSIS_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
```

## 🚶 Walkthrough Generation

### Generate Walkthrough

```bash
WALKTHROUGH_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/walkthrough/generate/$ANALYSIS_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN")

WALKTHROUGH_ID=$(echo $WALKTHROUGH_RESPONSE | jq -r '.walkthroughId')
echo "Walkthrough ID: $WALKTHROUGH_ID"
```

### Get Walkthrough

```bash
curl -X GET http://localhost:3000/api/v1/walkthrough/$ANALYSIS_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
```

## 💰 Quotation Generation

### Generate Quotation

```bash
QUOTATION_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/quotations/generate/$ANALYSIS_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN")

QUOTATION_ID=$(echo $QUOTATION_RESPONSE | jq -r '.quotationId')
echo "Quotation ID: $QUOTATION_ID"
```

### Get Quotation

```bash
curl -X GET http://localhost:3000/api/v1/quotations/$QUOTATION_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
```

### Get All Quotations

```bash
curl -X GET http://localhost:3000/api/v1/quotations \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
```

## ❌ Error Code Management

### Get All Error Codes

```bash
curl -X GET http://localhost:3000/api/v1/error-codes | jq '.'
```

### Get Error Code by Code

```bash
curl -X GET http://localhost:3000/api/v1/error-codes/P0001 | jq '.'
```

### Search Error Codes

```bash
curl -X GET "http://localhost:3000/api/v1/error-codes?search=engine" | jq '.'
```

### Get AI Explanation

```bash
curl -X POST http://localhost:3000/api/v1/error-codes/ai-explanation \
  -H "Content-Type: application/json" \
  -d '{
    "errorCode": "P0001",
    "vehicleMake": "volkswagen",
    "vehicleModel": "golf"
  }' | jq '.'
```

### Get AI Cost Estimate

```bash
curl -X POST http://localhost:3000/api/v1/error-codes/ai-estimate \
  -H "Content-Type: application/json" \
  -d '{
    "errorCode": "P0001",
    "vehicleMake": "volkswagen",
    "vehicleModel": "golf",
    "year": 2020
  }' | jq '.'
```

## 🏥 System Health

### Health Check

```bash
curl -X GET http://localhost:3000/health | jq '.'
```

### API Information

```bash
curl -X GET http://localhost:3000/ | jq '.'
```

### Swagger Documentation

```bash
# Open in browser
open http://localhost:3000/api-docs
```

## 🕵️ Fraud Detection

### Analyze User Behavior

```bash
curl -X POST http://localhost:3000/api/v1/billing/fraud/analyze \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'$USER_ID'",
    "transactionAmount": 100.00,
    "transactionType": "subscription"
  }' | jq '.'
```

### Get Fraud Rules

```bash
curl -X GET http://localhost:3000/api/v1/billing/fraud/rules \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
```

## 🔗 Webhooks

### Stripe Webhook Handler

```bash
curl -X POST http://localhost:3000/api/v1/billing/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{
    "type": "payment_intent.succeeded",
    "data": {
      "object": {
        "id": "pi_test_123",
        "amount": 1000,
        "currency": "usd"
      }
    }
  }' | jq '.'
```

## 🚀 Quick Test Script

Save this as `quick-test.sh` and run it:

```bash
#!/bin/bash

# Quick test script for Errorlytic API
BASE_URL="http://localhost:3000"

echo "🔍 Testing server health..."
curl -s "$BASE_URL/health" | jq '.'

echo -e "\n🔐 Testing authentication..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@Errorlytic.com",
    "password": "TestPassword123!"
  }')

ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken')

if [ "$ACCESS_TOKEN" != "null" ]; then
    echo "✅ Login successful"

    echo -e "\n👤 Testing profile..."
    curl -s -X GET "$BASE_URL/api/v1/auth/profile" \
      -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

    echo -e "\n❌ Testing error codes..."
    curl -s -X GET "$BASE_URL/api/v1/error-codes" | jq '.'

    echo -e "\n💳 Testing billing..."
    curl -s -X GET "$BASE_URL/api/v1/billing/plans" \
      -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

else
    echo "❌ Login failed"
fi

echo -e "\n✅ Quick test completed!"
```

## 📝 Notes

1. **Authentication**: Most endpoints require authentication. Use the `Authorization: Bearer $ACCESS_TOKEN` header.

2. **Error Handling**: Check HTTP status codes and response bodies for error details.

3. **File Uploads**: Use `-F` flag for multipart/form-data uploads.

4. **JSON Formatting**: Use `jq` for better JSON output formatting.

5. **Variables**: Save IDs from responses to use in subsequent requests.

6. **Testing Order**: Follow the authentication flow first, then test other endpoints.

## 🔧 Troubleshooting

- **401 Unauthorized**: Check if access token is valid and properly formatted
- **404 Not Found**: Verify endpoint URLs and server is running
- **500 Internal Server Error**: Check server logs and database connections
- **File Upload Issues**: Ensure file exists and has proper permissions

## 📊 Complete Testing

For comprehensive testing of all 60+ endpoints, use the full test script:

```bash
./test-all-endpoints.sh
```

This will test all endpoints systematically and provide detailed results.
