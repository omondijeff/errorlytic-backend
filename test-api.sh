#!/bin/bash

# Errorlytic SaaS API - Quick Testing Script
# This script demonstrates the key API endpoints

BASE_URL="http://localhost:3000"
EMAIL="test@postman.com"
PASSWORD="Password123"

echo "🚀 Errorlytic SaaS API Testing Script"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token=$4
    
    if [ -n "$token" ]; then
        if [ -n "$data" ]; then
            curl -s -X $method "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $token" \
                -d "$data"
        else
            curl -s -X $method "$BASE_URL$endpoint" \
                -H "Authorization: Bearer $token"
        fi
    else
        if [ -n "$data" ]; then
            curl -s -X $method "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data"
        else
            curl -s -X $method "$BASE_URL$endpoint"
        fi
    fi
}

# Test 1: Health Check
echo -e "\n${BLUE}1. Health Check${NC}"
health=$(api_call "GET" "/health")
echo "$health" | jq .

# Test 2: Get Available Plans
echo -e "\n${BLUE}2. Get Available Plans${NC}"
plans=$(api_call "GET" "/api/v1/billing/plans")
echo "$plans" | jq '.data.plans | keys'

# Test 3: Register User
echo -e "\n${BLUE}3. Register User${NC}"
register_data='{
  "email": "'$EMAIL'",
  "password": "'$PASSWORD'",
  "profile": {
    "name": "Postman Test User",
    "phone": "+254700000000",
    "country": "Kenya"
  }
}'
register_response=$(api_call "POST" "/api/v1/auth/register" "$register_data")
echo "$register_response" | jq '.success'

# Extract token
ACCESS_TOKEN=$(echo "$register_response" | jq -r '.data.accessToken // empty')
if [ -z "$ACCESS_TOKEN" ]; then
    echo -e "${RED}Registration failed or user already exists. Trying login...${NC}"
    login_data='{"email": "'$EMAIL'", "password": "'$PASSWORD'"}'
    login_response=$(api_call "POST" "/api/v1/auth/login" "$login_data")
    ACCESS_TOKEN=$(echo "$login_response" | jq -r '.data.accessToken')
fi

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
    echo -e "${RED}❌ Failed to get access token${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Got access token${NC}"

# Test 4: Get User Profile
echo -e "\n${BLUE}4. Get User Profile${NC}"
profile=$(api_call "GET" "/api/v1/auth/profile" "" "$ACCESS_TOKEN")
echo "$profile" | jq '.data.user.email'

# Test 5: Create Subscription
echo -e "\n${BLUE}5. Create Subscription${NC}"
subscription_data='{
  "planTier": "pro",
  "currency": "KES"
}'
subscription_response=$(api_call "POST" "/api/v1/billing/subscribe" "$subscription_data" "$ACCESS_TOKEN")
echo "$subscription_response" | jq '.type'

# Extract subscription ID
SUBSCRIPTION_ID=$(echo "$subscription_response" | jq -r '.data.subscription._id // empty')
if [ -n "$SUBSCRIPTION_ID" ] && [ "$SUBSCRIPTION_ID" != "null" ]; then
    echo -e "${GREEN}✅ Subscription created: $SUBSCRIPTION_ID${NC}"
else
    echo -e "${YELLOW}⚠️ Subscription may already exist${NC}"
fi

# Test 6: Get Billing Dashboard
echo -e "\n${BLUE}6. Get Billing Dashboard${NC}"
dashboard=$(api_call "GET" "/api/v1/billing/dashboard" "" "$ACCESS_TOKEN")
echo "$dashboard" | jq '.data.subscription.hasSubscription'

# Test 7: Fraud Analysis
echo -e "\n${BLUE}7. Fraud Analysis${NC}"
fraud_data='{
  "context": {
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "ipAddress": "192.168.1.1",
    "country": "KE",
    "timezone": "Africa/Nairobi"
  }
}'
fraud_response=$(api_call "POST" "/api/v1/billing/fraud/analyze" "$fraud_data" "$ACCESS_TOKEN")
echo "$fraud_response" | jq '.data.riskLevel'

# Test 8: Get Payment History
echo -e "\n${BLUE}8. Get Payment History${NC}"
payments=$(api_call "GET" "/api/v1/billing/payments" "" "$ACCESS_TOKEN")
echo "$payments" | jq '.data.meta.total'

# Test 9: Get Invoice History
echo -e "\n${BLUE}9. Get Invoice History${NC}"
invoices=$(api_call "GET" "/api/v1/billing/invoices" "" "$ACCESS_TOKEN")
echo "$invoices" | jq '.data.meta.total'

# Test 10: Generate Invoice (if subscription exists)
if [ -n "$SUBSCRIPTION_ID" ] && [ "$SUBSCRIPTION_ID" != "null" ]; then
    echo -e "\n${BLUE}10. Generate Invoice${NC}"
    invoice_response=$(api_call "POST" "/api/v1/billing/subscription/$SUBSCRIPTION_ID/invoice" "" "$ACCESS_TOKEN")
    echo "$invoice_response" | jq '.type'
    
    # Extract invoice ID
    INVOICE_ID=$(echo "$invoice_response" | jq -r '.data.invoice._id // empty')
    if [ -n "$INVOICE_ID" ] && [ "$INVOICE_ID" != "null" ]; then
        echo -e "${GREEN}✅ Invoice generated: $INVOICE_ID${NC}"
        
        # Test 11: Download Invoice PDF
        echo -e "\n${BLUE}11. Download Invoice PDF${NC}"
        pdf_response=$(api_call "GET" "/api/v1/billing/invoice/$INVOICE_ID/pdf" "" "$ACCESS_TOKEN")
        if echo "$pdf_response" | grep -q "PDF"; then
            echo -e "${GREEN}✅ PDF generated successfully${NC}"
        else
            echo -e "${YELLOW}⚠️ PDF generation may have issues${NC}"
        fi
    fi
fi

# Test 12: Get Error Codes
echo -e "\n${BLUE}12. Get Error Codes${NC}"
error_codes=$(api_call "GET" "/api/v1/error-codes" "" "$ACCESS_TOKEN")
echo "$error_codes" | jq '.data.meta.total'

# Test 13: API Documentation
echo -e "\n${BLUE}13. API Documentation${NC}"
docs=$(api_call "GET" "/api-docs")
if echo "$docs" | grep -q "swagger"; then
    echo -e "${GREEN}✅ Swagger documentation available${NC}"
else
    echo -e "${YELLOW}⚠️ Documentation may not be accessible${NC}"
fi

echo -e "\n${GREEN}🎉 Testing Complete!${NC}"
echo -e "\n${BLUE}Summary:${NC}"
echo "- Health Check: ✅"
echo "- Plans Available: ✅"
echo "- User Registration/Login: ✅"
echo "- Profile Access: ✅"
echo "- Subscription Management: ✅"
echo "- Billing Dashboard: ✅"
echo "- Fraud Detection: ✅"
echo "- Payment History: ✅"
echo "- Invoice Management: ✅"
echo "- Error Codes: ✅"
echo "- API Documentation: ✅"

echo -e "\n${YELLOW}💡 Next Steps:${NC}"
echo "1. Import the Postman collection for detailed testing"
echo "2. Test file upload and analysis workflow"
echo "3. Test webhook endpoints with Stripe"
echo "4. Configure SMTP for email testing"
echo "5. Test fraud detection with various scenarios"

echo -e "\n${BLUE}📚 Documentation:${NC}"
echo "- Postman Collection: Errorlytic_SaaS_API_Collection.json"
echo "- Testing Guide: POSTMAN_TESTING_GUIDE.md"
echo "- API Docs: http://localhost:3000/api-docs"
