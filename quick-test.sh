#!/bin/bash

# Quick test script for Errorlytic API
BASE_URL="http://localhost:3002"

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
