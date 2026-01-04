#!/bin/bash

# Errorlytic SaaS API - Complete Endpoint Testing with curl
# This script tests all 60+ API endpoints using curl commands

# Configuration
BASE_URL="http://localhost:3002"
API_BASE="${BASE_URL}/api/v1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Global variables to store tokens and IDs
ACCESS_TOKEN=""
REFRESH_TOKEN=""
USER_ID=""
ORG_ID=""
VEHICLE_ID=""
UPLOAD_ID=""
ANALYSIS_ID=""
QUOTATION_ID=""
WALKTHROUGH_ID=""

# Function to print section headers
print_section() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
    fi
}

# Function to extract JSON values
extract_json_value() {
    echo "$1" | grep -o "\"$2\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | sed "s/\"$2\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\"/\1/"
}

# Function to extract JSON values without quotes
extract_json_value_no_quotes() {
    echo "$1" | grep -o "\"$2\"[[:space:]]*:[[:space:]]*[^,}]*" | sed "s/\"$2\"[[:space:]]*:[[:space:]]*//" | sed 's/"//g'
}

# Check if server is running
check_server() {
    print_section "🔍 CHECKING SERVER STATUS"
    
    response=$(curl -s -w "%{http_code}" -o /dev/null "${BASE_URL}/health")
    if [ "$response" = "200" ]; then
        print_result 0 "Server is running on ${BASE_URL}"
        curl -s "${BASE_URL}/health" | jq '.' 2>/dev/null || echo "Health check response received"
    else
        print_result 1 "Server is not running on ${BASE_URL}"
        echo "Please start the server with: npm start"
        exit 1
    fi
}

# Test Authentication Endpoints
test_auth_endpoints() {
    print_section "🔐 TESTING AUTHENTICATION ENDPOINTS"
    
    # 1. Register new user
    echo "Testing user registration..."
    register_response=$(curl -s -X POST "${API_BASE}/auth/register" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "test@Errorlytic.com",
            "password": "TestPassword123!",
            "firstName": "Test",
            "lastName": "User",
            "phone": "+254700000000",
            "role": "user"
        }')
    
    if echo "$register_response" | grep -q "successfully registered\|already exists"; then
        print_result 0 "User registration"
        USER_ID=$(extract_json_value_no_quotes "$register_response" "userId")
        echo "User ID: $USER_ID"
    else
        print_result 1 "User registration"
        echo "Response: $register_response"
    fi
    
    # 2. Login
    echo -e "\nTesting user login..."
    login_response=$(curl -s -X POST "${API_BASE}/auth/login" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "test@Errorlytic.com",
            "password": "TestPassword123!"
        }')
    
    if echo "$login_response" | grep -q "accessToken"; then
        print_result 0 "User login"
        ACCESS_TOKEN=$(extract_json_value "$login_response" "accessToken")
        REFRESH_TOKEN=$(extract_json_value "$login_response" "refreshToken")
        echo "Access token obtained"
    else
        print_result 1 "User login"
        echo "Response: $login_response"
    fi
    
    # 3. Get user profile
    if [ -n "$ACCESS_TOKEN" ]; then
        echo -e "\nTesting get user profile..."
        profile_response=$(curl -s -X GET "${API_BASE}/auth/profile" \
            -H "Authorization: Bearer $ACCESS_TOKEN")
        
        if echo "$profile_response" | grep -q "email"; then
            print_result 0 "Get user profile"
        else
            print_result 1 "Get user profile"
            echo "Response: $profile_response"
        fi
        
        # 4. Update user profile
        echo -e "\nTesting update user profile..."
        update_response=$(curl -s -X PUT "${API_BASE}/auth/profile" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "firstName": "Updated",
                "lastName": "User",
                "phone": "+254700000001"
            }')
        
        if echo "$update_response" | grep -q "successfully updated\|profile"; then
            print_result 0 "Update user profile"
        else
            print_result 1 "Update user profile"
            echo "Response: $update_response"
        fi
        
        # 5. Change password
        echo -e "\nTesting change password..."
        change_password_response=$(curl -s -X POST "${API_BASE}/auth/change-password" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "currentPassword": "TestPassword123!",
                "newPassword": "NewTestPassword123!"
            }')
        
        if echo "$change_password_response" | grep -q "successfully changed\|password"; then
            print_result 0 "Change password"
        else
            print_result 1 "Change password"
            echo "Response: $change_password_response"
        fi
        
        # 6. Refresh token
        echo -e "\nTesting refresh token..."
        refresh_response=$(curl -s -X POST "${API_BASE}/auth/refresh" \
            -H "Content-Type: application/json" \
            -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}")
        
        if echo "$refresh_response" | grep -q "accessToken"; then
            print_result 0 "Refresh token"
            ACCESS_TOKEN=$(extract_json_value "$refresh_response" "accessToken")
        else
            print_result 1 "Refresh token"
            echo "Response: $refresh_response"
        fi
    fi
}

# Test Organization Endpoints
test_organization_endpoints() {
    print_section "🏢 TESTING ORGANIZATION ENDPOINTS"
    
    if [ -z "$ACCESS_TOKEN" ]; then
        echo "Skipping organization tests - no access token available"
        return
    fi
    
    # 1. Create organization (superadmin only)
    echo "Testing create organization..."
    create_org_response=$(curl -s -X POST "${API_BASE}/auth/orgs" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "Test Garage",
            "type": "garage",
            "email": "garage@test.com",
            "phone": "+254700000000",
            "address": "123 Test Street, Nairobi",
            "description": "Test garage for Errorlytic"
        }')
    
    if echo "$create_org_response" | grep -q "organization\|created"; then
        print_result 0 "Create organization"
        ORG_ID=$(extract_json_value_no_quotes "$create_org_response" "organizationId")
        echo "Organization ID: $ORG_ID"
    else
        print_result 1 "Create organization"
        echo "Response: $create_org_response"
    fi
    
    # 2. Get organization details
    if [ -n "$ORG_ID" ]; then
        echo -e "\nTesting get organization details..."
        get_org_response=$(curl -s -X GET "${API_BASE}/auth/orgs/$ORG_ID" \
            -H "Authorization: Bearer $ACCESS_TOKEN")
        
        if echo "$get_org_response" | grep -q "name\|organization"; then
            print_result 0 "Get organization details"
        else
            print_result 1 "Get organization details"
            echo "Response: $get_org_response"
        fi
    fi
}

# Test Vehicle Endpoints
test_vehicle_endpoints() {
    print_section "🚗 TESTING VEHICLE ENDPOINTS"
    
    # 1. Get vehicle-specific error codes
    echo "Testing get vehicle-specific error codes..."
    vehicle_error_response=$(curl -s -X GET "${API_BASE}/error-codes/vehicle/volkswagen")
    
    if echo "$vehicle_error_response" | grep -q "errorCodes\|codes"; then
        print_result 0 "Get vehicle-specific error codes"
    else
        print_result 1 "Get vehicle-specific error codes"
        echo "Response: $vehicle_error_response"
    fi
    
    # 2. Upload file with vehicle ID (if we have a token)
    if [ -n "$ACCESS_TOKEN" ]; then
        echo -e "\nTesting upload file with vehicle ID..."
        # Create a test file
        echo "Test VCDS data" > test_vcds.txt
        
        upload_response=$(curl -s -X POST "${API_BASE}/upload" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -F "file=@test_vcds.txt" \
            -F "vehicleId=test-vehicle-123" \
            -F "description=Test upload")
        
        if echo "$upload_response" | grep -q "uploadId\|success"; then
            print_result 0 "Upload file with vehicle ID"
            UPLOAD_ID=$(extract_json_value_no_quotes "$upload_response" "uploadId")
            echo "Upload ID: $UPLOAD_ID"
        else
            print_result 1 "Upload file with vehicle ID"
            echo "Response: $upload_response"
        fi
        
        # Clean up test file
        rm -f test_vcds.txt
        
        # 3. Get uploads by vehicle
        echo -e "\nTesting get uploads by vehicle..."
        vehicle_uploads_response=$(curl -s -X GET "${API_BASE}/upload?vehicleId=test-vehicle-123" \
            -H "Authorization: Bearer $ACCESS_TOKEN")
        
        if echo "$vehicle_uploads_response" | grep -q "uploads\|files"; then
            print_result 0 "Get uploads by vehicle"
        else
            print_result 1 "Get uploads by vehicle"
            echo "Response: $vehicle_uploads_response"
        fi
    fi
}

# Test Billing Endpoints
test_billing_endpoints() {
    print_section "💳 TESTING BILLING ENDPOINTS"
    
    if [ -z "$ACCESS_TOKEN" ]; then
        echo "Skipping billing tests - no access token available"
        return
    fi
    
    # 1. Get available plans
    echo "Testing get available plans..."
    plans_response=$(curl -s -X GET "${API_BASE}/billing/plans" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if echo "$plans_response" | grep -q "plans\|subscription"; then
        print_result 0 "Get available plans"
    else
        print_result 1 "Get available plans"
        echo "Response: $plans_response"
    fi
    
    # 2. Create subscription
    echo -e "\nTesting create subscription..."
    subscription_response=$(curl -s -X POST "${API_BASE}/billing/subscribe" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "planId": "basic",
            "paymentMethodId": "pm_test_123"
        }')
    
    if echo "$subscription_response" | grep -q "subscription\|success"; then
        print_result 0 "Create subscription"
    else
        print_result 1 "Create subscription"
        echo "Response: $subscription_response"
    fi
    
    # 3. Get billing dashboard
    echo -e "\nTesting get billing dashboard..."
    dashboard_response=$(curl -s -X GET "${API_BASE}/billing/dashboard" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if echo "$dashboard_response" | grep -q "dashboard\|billing"; then
        print_result 0 "Get billing dashboard"
    else
        print_result 1 "Get billing dashboard"
        echo "Response: $dashboard_response"
    fi
    
    # 4. Get usage statistics
    echo -e "\nTesting get usage statistics..."
    usage_response=$(curl -s -X GET "${API_BASE}/billing/usage" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if echo "$usage_response" | grep -q "usage\|statistics"; then
        print_result 0 "Get usage statistics"
    else
        print_result 1 "Get usage statistics"
        echo "Response: $usage_response"
    fi
    
    # 5. Get payment history
    echo -e "\nTesting get payment history..."
    payments_response=$(curl -s -X GET "${API_BASE}/billing/payments" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if echo "$payments_response" | grep -q "payments\|history"; then
        print_result 0 "Get payment history"
    else
        print_result 1 "Get payment history"
        echo "Response: $payments_response"
    fi
    
    # 6. Get invoice history
    echo -e "\nTesting get invoice history..."
    invoices_response=$(curl -s -X GET "${API_BASE}/billing/invoices" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if echo "$invoices_response" | grep -q "invoices\|history"; then
        print_result 0 "Get invoice history"
    else
        print_result 1 "Get invoice history"
        echo "Response: $invoices_response"
    fi
}

# Test File Upload & Analysis Endpoints
test_upload_analysis_endpoints() {
    print_section "📁 TESTING FILE UPLOAD & ANALYSIS ENDPOINTS"
    
    if [ -z "$ACCESS_TOKEN" ]; then
        echo "Skipping upload/analysis tests - no access token available"
        return
    fi
    
    # 1. Upload VCDS file
    echo "Testing upload VCDS file..."
    echo "Test VCDS diagnostic data" > test_vcds.txt
    
    upload_response=$(curl -s -X POST "${API_BASE}/upload" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -F "file=@test_vcds.txt" \
        -F "description=Test VCDS file")
    
    if echo "$upload_response" | grep -q "uploadId\|success"; then
        print_result 0 "Upload VCDS file"
        UPLOAD_ID=$(extract_json_value_no_quotes "$upload_response" "uploadId")
        echo "Upload ID: $UPLOAD_ID"
    else
        print_result 1 "Upload VCDS file"
        echo "Response: $upload_response"
    fi
    
    # Clean up test file
    rm -f test_vcds.txt
    
    # 2. Get uploads list
    echo -e "\nTesting get uploads list..."
    uploads_response=$(curl -s -X GET "${API_BASE}/upload" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if echo "$uploads_response" | grep -q "uploads\|files"; then
        print_result 0 "Get uploads list"
    else
        print_result 1 "Get uploads list"
        echo "Response: $uploads_response"
    fi
    
    # 3. Get upload by ID
    if [ -n "$UPLOAD_ID" ]; then
        echo -e "\nTesting get upload by ID..."
        upload_by_id_response=$(curl -s -X GET "${API_BASE}/upload/$UPLOAD_ID" \
            -H "Authorization: Bearer $ACCESS_TOKEN")
        
        if echo "$upload_by_id_response" | grep -q "upload\|file"; then
            print_result 0 "Get upload by ID"
        else
            print_result 1 "Get upload by ID"
            echo "Response: $upload_by_id_response"
        fi
        
        # 4. Parse upload
        echo -e "\nTesting parse upload..."
        parse_response=$(curl -s -X POST "${API_BASE}/upload/$UPLOAD_ID/parse" \
            -H "Authorization: Bearer $ACCESS_TOKEN")
        
        if echo "$parse_response" | grep -q "parsed\|success"; then
            print_result 0 "Parse upload"
        else
            print_result 1 "Parse upload"
            echo "Response: $parse_response"
        fi
        
        # 5. Process analysis
        echo -e "\nTesting process analysis..."
        analysis_response=$(curl -s -X POST "${API_BASE}/analysis/process/$UPLOAD_ID" \
            -H "Authorization: Bearer $ACCESS_TOKEN")
        
        if echo "$analysis_response" | grep -q "analysisId\|success"; then
            print_result 0 "Process analysis"
            ANALYSIS_ID=$(extract_json_value_no_quotes "$analysis_response" "analysisId")
            echo "Analysis ID: $ANALYSIS_ID"
        else
            print_result 1 "Process analysis"
            echo "Response: $analysis_response"
        fi
    fi
    
    # 6. Get all analyses
    echo -e "\nTesting get all analyses..."
    analyses_response=$(curl -s -X GET "${API_BASE}/analysis" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if echo "$analyses_response" | grep -q "analyses\|results"; then
        print_result 0 "Get all analyses"
    else
        print_result 1 "Get all analyses"
        echo "Response: $analyses_response"
    fi
    
    # 7. Get analysis by ID
    if [ -n "$ANALYSIS_ID" ]; then
        echo -e "\nTesting get analysis by ID..."
        analysis_by_id_response=$(curl -s -X GET "${API_BASE}/analysis/$ANALYSIS_ID" \
            -H "Authorization: Bearer $ACCESS_TOKEN")
        
        if echo "$analysis_by_id_response" | grep -q "analysis\|result"; then
            print_result 0 "Get analysis by ID"
        else
            print_result 1 "Get analysis by ID"
            echo "Response: $analysis_by_id_response"
        fi
        
        # 8. Update analysis
        echo -e "\nTesting update analysis..."
        update_analysis_response=$(curl -s -X PUT "${API_BASE}/analysis/$ANALYSIS_ID" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "notes": "Updated analysis notes",
                "status": "completed"
            }')
        
        if echo "$update_analysis_response" | grep -q "updated\|success"; then
            print_result 0 "Update analysis"
        else
            print_result 1 "Update analysis"
            echo "Response: $update_analysis_response"
        fi
    fi
    
    # 9. Get upload statistics
    echo -e "\nTesting get upload statistics..."
    upload_stats_response=$(curl -s -X GET "${API_BASE}/upload/stats" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if echo "$upload_stats_response" | grep -q "statistics\|stats"; then
        print_result 0 "Get upload statistics"
    else
        print_result 1 "Get upload statistics"
        echo "Response: $upload_stats_response"
    fi
    
    # 10. Get analysis statistics dashboard
    echo -e "\nTesting get analysis statistics dashboard..."
    analysis_stats_response=$(curl -s -X GET "${API_BASE}/analysis/statistics/dashboard" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if echo "$analysis_stats_response" | grep -q "statistics\|dashboard"; then
        print_result 0 "Get analysis statistics dashboard"
    else
        print_result 1 "Get analysis statistics dashboard"
        echo "Response: $analysis_stats_response"
    fi
}

# Test Walkthrough Endpoints
test_walkthrough_endpoints() {
    print_section "🚶 TESTING WALKTHROUGH ENDPOINTS"
    
    if [ -z "$ACCESS_TOKEN" ] || [ -z "$ANALYSIS_ID" ]; then
        echo "Skipping walkthrough tests - no access token or analysis ID available"
        return
    fi
    
    # 1. Generate walkthrough
    echo "Testing generate walkthrough..."
    generate_walkthrough_response=$(curl -s -X POST "${API_BASE}/walkthrough/generate/$ANALYSIS_ID" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if echo "$generate_walkthrough_response" | grep -q "walkthroughId\|success"; then
        print_result 0 "Generate walkthrough"
        WALKTHROUGH_ID=$(extract_json_value_no_quotes "$generate_walkthrough_response" "walkthroughId")
        echo "Walkthrough ID: $WALKTHROUGH_ID"
    else
        print_result 1 "Generate walkthrough"
        echo "Response: $generate_walkthrough_response"
    fi
    
    # 2. Get walkthrough by analysis ID
    echo -e "\nTesting get walkthrough by analysis ID..."
    walkthrough_by_analysis_response=$(curl -s -X GET "${API_BASE}/walkthrough/$ANALYSIS_ID" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if echo "$walkthrough_by_analysis_response" | grep -q "walkthrough\|steps"; then
        print_result 0 "Get walkthrough by analysis ID"
    else
        print_result 1 "Get walkthrough by analysis ID"
        echo "Response: $walkthrough_by_analysis_response"
    fi
    
    # 3. Update walkthrough
    if [ -n "$WALKTHROUGH_ID" ]; then
        echo -e "\nTesting update walkthrough..."
        update_walkthrough_response=$(curl -s -X PUT "${API_BASE}/walkthrough/$WALKTHROUGH_ID" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "title": "Updated Walkthrough",
                "description": "Updated walkthrough description"
            }')
        
        if echo "$update_walkthrough_response" | grep -q "updated\|success"; then
            print_result 0 "Update walkthrough"
        else
            print_result 1 "Update walkthrough"
            echo "Response: $update_walkthrough_response"
        fi
        
        # 4. Add walkthrough step
        echo -e "\nTesting add walkthrough step..."
        add_step_response=$(curl -s -X POST "${API_BASE}/walkthrough/$WALKTHROUGH_ID/steps" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "stepNumber": 1,
                "title": "Test Step",
                "description": "Test step description",
                "instructions": "Test instructions"
            }')
        
        if echo "$add_step_response" | grep -q "step\|success"; then
            print_result 0 "Add walkthrough step"
        else
            print_result 1 "Add walkthrough step"
            echo "Response: $add_step_response"
        fi
    fi
}

# Test Quotation Endpoints
test_quotation_endpoints() {
    print_section "💰 TESTING QUOTATION ENDPOINTS"
    
    if [ -z "$ACCESS_TOKEN" ] || [ -z "$ANALYSIS_ID" ]; then
        echo "Skipping quotation tests - no access token or analysis ID available"
        return
    fi
    
    # 1. Generate quotation
    echo "Testing generate quotation..."
    generate_quotation_response=$(curl -s -X POST "${API_BASE}/quotations/generate/$ANALYSIS_ID" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if echo "$generate_quotation_response" | grep -q "quotationId\|success"; then
        print_result 0 "Generate quotation"
        QUOTATION_ID=$(extract_json_value_no_quotes "$generate_quotation_response" "quotationId")
        echo "Quotation ID: $QUOTATION_ID"
    else
        print_result 1 "Generate quotation"
        echo "Response: $generate_quotation_response"
    fi
    
    # 2. Get quotation by ID
    if [ -n "$QUOTATION_ID" ]; then
        echo -e "\nTesting get quotation by ID..."
        quotation_by_id_response=$(curl -s -X GET "${API_BASE}/quotations/$QUOTATION_ID" \
            -H "Authorization: Bearer $ACCESS_TOKEN")
        
        if echo "$quotation_by_id_response" | grep -q "quotation\|estimate"; then
            print_result 0 "Get quotation by ID"
        else
            print_result 1 "Get quotation by ID"
            echo "Response: $quotation_by_id_response"
        fi
        
        # 3. Update quotation
        echo -e "\nTesting update quotation..."
        update_quotation_response=$(curl -s -X PUT "${API_BASE}/quotations/$QUOTATION_ID" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "notes": "Updated quotation notes",
                "status": "pending"
            }')
        
        if echo "$update_quotation_response" | grep -q "updated\|success"; then
            print_result 0 "Update quotation"
        else
            print_result 1 "Update quotation"
            echo "Response: $update_quotation_response"
        fi
        
        # 4. Update quotation status
        echo -e "\nTesting update quotation status..."
        update_status_response=$(curl -s -X POST "${API_BASE}/quotations/$QUOTATION_ID/status" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "status": "approved"
            }')
        
        if echo "$update_status_response" | grep -q "updated\|success"; then
            print_result 0 "Update quotation status"
        else
            print_result 1 "Update quotation status"
            echo "Response: $update_status_response"
        fi
        
        # 5. Share quotation
        echo -e "\nTesting share quotation..."
        share_response=$(curl -s -X POST "${API_BASE}/quotations/$QUOTATION_ID/share" \
            -H "Authorization: Bearer $ACCESS_TOKEN")
        
        if echo "$share_response" | grep -q "shareLink\|success"; then
            print_result 0 "Share quotation"
        else
            print_result 1 "Share quotation"
            echo "Response: $share_response"
        fi
    fi
    
    # 6. Get all quotations
    echo -e "\nTesting get all quotations..."
    quotations_response=$(curl -s -X GET "${API_BASE}/quotations" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if echo "$quotations_response" | grep -q "quotations\|estimates"; then
        print_result 0 "Get all quotations"
    else
        print_result 1 "Get all quotations"
        echo "Response: $quotations_response"
    fi
    
    # 7. Get quotation statistics
    echo -e "\nTesting get quotation statistics..."
    quotation_stats_response=$(curl -s -X GET "${API_BASE}/quotations/statistics" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if echo "$quotation_stats_response" | grep -q "statistics\|stats"; then
        print_result 0 "Get quotation statistics"
    else
        print_result 1 "Get quotation statistics"
        echo "Response: $quotation_stats_response"
    fi
}

# Test Error Code Endpoints
test_error_code_endpoints() {
    print_section "❌ TESTING ERROR CODE ENDPOINTS"
    
    # 1. Get all error codes
    echo "Testing get all error codes..."
    error_codes_response=$(curl -s -X GET "${API_BASE}/error-codes")
    
    if echo "$error_codes_response" | grep -q "errorCodes\|codes"; then
        print_result 0 "Get all error codes"
    else
        print_result 1 "Get all error codes"
        echo "Response: $error_codes_response"
    fi
    
    # 2. Get error code by code
    echo -e "\nTesting get error code by code..."
    error_code_by_code_response=$(curl -s -X GET "${API_BASE}/error-codes/P0001")
    
    if echo "$error_code_by_code_response" | grep -q "errorCode\|code"; then
        print_result 0 "Get error code by code"
    else
        print_result 1 "Get error code by code"
        echo "Response: $error_code_by_code_response"
    fi
    
    # 3. Search error codes
    echo -e "\nTesting search error codes..."
    search_error_codes_response=$(curl -s -X GET "${API_BASE}/error-codes?search=engine")
    
    if echo "$search_error_codes_response" | grep -q "errorCodes\|results"; then
        print_result 0 "Search error codes"
    else
        print_result 1 "Search error codes"
        echo "Response: $search_error_codes_response"
    fi
    
    # 4. Get error code statistics
    echo -e "\nTesting get error code statistics..."
    error_code_stats_response=$(curl -s -X GET "${API_BASE}/error-codes/stats/summary")
    
    if echo "$error_code_stats_response" | grep -q "statistics\|stats"; then
        print_result 0 "Get error code statistics"
    else
        print_result 1 "Get error code statistics"
        echo "Response: $error_code_stats_response"
    fi
    
    # 5. Get error code categories
    echo -e "\nTesting get error code categories..."
    error_code_categories_response=$(curl -s -X GET "${API_BASE}/error-codes/categories")
    
    if echo "$error_code_categories_response" | grep -q "categories\|types"; then
        print_result 0 "Get error code categories"
    else
        print_result 1 "Get error code categories"
        echo "Response: $error_code_categories_response"
    fi
    
    # 6. Get AI explanation
    echo -e "\nTesting get AI explanation..."
    ai_explanation_response=$(curl -s -X POST "${API_BASE}/error-codes/ai-explanation" \
        -H "Content-Type: application/json" \
        -d '{
            "errorCode": "P0001",
            "vehicleMake": "volkswagen",
            "vehicleModel": "golf"
        }')
    
    if echo "$ai_explanation_response" | grep -q "explanation\|analysis"; then
        print_result 0 "Get AI explanation"
    else
        print_result 1 "Get AI explanation"
        echo "Response: $ai_explanation_response"
    fi
    
    # 7. Get AI estimate
    echo -e "\nTesting get AI estimate..."
    ai_estimate_response=$(curl -s -X POST "${API_BASE}/error-codes/ai-estimate" \
        -H "Content-Type: application/json" \
        -d '{
            "errorCode": "P0001",
            "vehicleMake": "volkswagen",
            "vehicleModel": "golf",
            "year": 2020
        }')
    
    if echo "$ai_estimate_response" | grep -q "estimate\|cost"; then
        print_result 0 "Get AI estimate"
    else
        print_result 1 "Get AI estimate"
        echo "Response: $ai_estimate_response"
    fi
    
    # 8. Get troubleshooting guide
    echo -e "\nTesting get troubleshooting guide..."
    troubleshooting_response=$(curl -s -X POST "${API_BASE}/error-codes/troubleshooting" \
        -H "Content-Type: application/json" \
        -d '{
            "errorCode": "P0001",
            "vehicleMake": "volkswagen",
            "vehicleModel": "golf"
        }')
    
    if echo "$troubleshooting_response" | grep -q "troubleshooting\|guide"; then
        print_result 0 "Get troubleshooting guide"
    else
        print_result 1 "Get troubleshooting guide"
        echo "Response: $troubleshooting_response"
    fi
}

# Test System Health Endpoints
test_system_health_endpoints() {
    print_section "🏥 TESTING SYSTEM HEALTH ENDPOINTS"
    
    # 1. Health check
    echo "Testing health check..."
    health_response=$(curl -s -X GET "${BASE_URL}/health")
    
    if echo "$health_response" | grep -q "status.*OK\|uptime"; then
        print_result 0 "Health check"
    else
        print_result 1 "Health check"
        echo "Response: $health_response"
    fi
    
    # 2. API information
    echo -e "\nTesting API information..."
    api_info_response=$(curl -s -X GET "${BASE_URL}/")
    
    if echo "$api_info_response" | grep -q "Errorlytic\|API"; then
        print_result 0 "API information"
    else
        print_result 1 "API information"
        echo "Response: $api_info_response"
    fi
    
    # 3. Swagger documentation
    echo -e "\nTesting Swagger documentation..."
    swagger_response=$(curl -s -w "%{http_code}" -o /dev/null "${BASE_URL}/api-docs")
    
    if [ "$swagger_response" = "200" ]; then
        print_result 0 "Swagger documentation"
    else
        print_result 1 "Swagger documentation"
        echo "HTTP Status: $swagger_response"
    fi
}

# Test Fraud Detection Endpoints
test_fraud_detection_endpoints() {
    print_section "🕵️ TESTING FRAUD DETECTION ENDPOINTS"
    
    if [ -z "$ACCESS_TOKEN" ]; then
        echo "Skipping fraud detection tests - no access token available"
        return
    fi
    
    # 1. Analyze user behavior
    echo "Testing fraud analysis..."
    fraud_analysis_response=$(curl -s -X POST "${API_BASE}/billing/fraud/analyze" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "userId": "'$USER_ID'",
            "transactionAmount": 100.00,
            "transactionType": "subscription"
        }')
    
    if echo "$fraud_analysis_response" | grep -q "analysis\|fraud"; then
        print_result 0 "Fraud analysis"
    else
        print_result 1 "Fraud analysis"
        echo "Response: $fraud_analysis_response"
    fi
    
    # 2. Get fraud rules
    echo -e "\nTesting get fraud rules..."
    fraud_rules_response=$(curl -s -X GET "${API_BASE}/billing/fraud/rules" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if echo "$fraud_rules_response" | grep -q "rules\|fraud"; then
        print_result 0 "Get fraud rules"
    else
        print_result 1 "Get fraud rules"
        echo "Response: $fraud_rules_response"
    fi
}

# Test Webhook Endpoints
test_webhook_endpoints() {
    print_section "🔗 TESTING WEBHOOK ENDPOINTS"
    
    # 1. Stripe webhook handler
    echo "Testing Stripe webhook handler..."
    webhook_response=$(curl -s -X POST "${API_BASE}/billing/webhooks/stripe" \
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
        }')
    
    if echo "$webhook_response" | grep -q "received\|processed"; then
        print_result 0 "Stripe webhook handler"
    else
        print_result 1 "Stripe webhook handler"
        echo "Response: $webhook_response"
    fi
}

# Main execution
main() {
    echo -e "${GREEN}🚀 Errorlytic SaaS API - Complete Endpoint Testing${NC}"
    echo -e "${GREEN}================================================${NC}\n"
    
    # Check if jq is installed for JSON parsing
    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}Warning: jq is not installed. Some JSON parsing features may not work optimally.${NC}"
        echo -e "${YELLOW}Install jq with: brew install jq (macOS) or apt-get install jq (Ubuntu)${NC}\n"
    fi
    
    # Run all tests
    check_server
    test_auth_endpoints
    test_organization_endpoints
    test_vehicle_endpoints
    test_billing_endpoints
    test_upload_analysis_endpoints
    test_walkthrough_endpoints
    test_quotation_endpoints
    test_error_code_endpoints
    test_fraud_detection_endpoints
    test_webhook_endpoints
    test_system_health_endpoints
    
    # Summary
    print_section "📊 TESTING SUMMARY"
    echo -e "${GREEN}✅ All endpoint tests completed!${NC}"
    echo -e "${BLUE}📝 Check the output above for detailed results${NC}"
    echo -e "${YELLOW}💡 Some tests may fail if the server is not fully configured${NC}"
    echo -e "${YELLOW}💡 Make sure MongoDB, Redis, and MinIO services are running${NC}"
    
    # Clean up any test files
    rm -f test_vcds.txt
}

# Run the main function
main "$@"
