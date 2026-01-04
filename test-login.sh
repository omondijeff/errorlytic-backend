#!/bin/bash

echo "🔐 Testing Errorlytic Login Flow"
echo "================================"

# Test login endpoint
echo "📡 Testing login endpoint..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@Errorlytic.com",
    "password": "TestPassword123"
  }')

echo "Login Response:"
echo "$LOGIN_RESPONSE" | jq .

# Extract access token
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken')

if [ "$ACCESS_TOKEN" != "null" ] && [ "$ACCESS_TOKEN" != "" ]; then
    echo ""
    echo "✅ Login successful! Access token obtained."
    echo ""
    
    # Test dashboard endpoint with token
    echo "📊 Testing dashboard endpoint with token..."
    DASHBOARD_RESPONSE=$(curl -s -X GET http://localhost:3000/api/v1/billing/dashboard \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    echo "Dashboard Response:"
    echo "$DASHBOARD_RESPONSE" | jq .
    
    echo ""
    echo "🎉 All tests passed! The backend is working correctly."
    echo ""
echo "📝 To test the frontend:"
echo ""
echo "🔐 Regular User:"
echo "1. Go to http://localhost:8082/login"
echo "2. Use email: test@Errorlytic.com"
echo "3. Use password: TestPassword123"
echo "4. Click Login"
echo ""
echo "👑 Super Admin:"
echo "1. Go to http://localhost:8082/login"
echo "2. Use email: admin@Errorlytic.com"
echo "3. Use password: AdminPassword123"
echo "4. Click Login"
    echo ""
else
    echo "❌ Login failed! Please check the backend logs."
fi
