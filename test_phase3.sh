#!/bin/bash
# Phase 3 Testing Script
# Tests dual-write implementation and API endpoints

set -e

echo "🧪 Phase 3 Testing Script"
echo "=========================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_BASE="http://localhost:8000"
TEST_PASSED=0
TEST_FAILED=0

# Function to test API endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local expected_status=$3
    local data=$4
    local description=$5
    
    echo -n "Testing: $description ... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$API_BASE$endpoint" 2>/dev/null || echo -e "\n000")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" \
            -d "$data" "$API_BASE$endpoint" 2>/dev/null || echo -e "\n000")
    elif [ "$method" = "PUT" ]; then
        response=$(curl -s -w "\n%{http_code}" -X PUT -H "Content-Type: application/json" \
            -d "$data" "$API_BASE$endpoint" 2>/dev/null || echo -e "\n000")
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" -X DELETE "$API_BASE$endpoint" 2>/dev/null || echo -e "\n000")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (Status: $http_code)"
        TEST_PASSED=$((TEST_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $http_code)"
        echo "  Response: $body"
        TEST_FAILED=$((TEST_FAILED + 1))
        return 1
    fi
}

# Check if backend is running
echo "📡 Checking if backend is running..."
if ! curl -s "$API_BASE/" > /dev/null 2>&1; then
    echo -e "${RED}✗ Backend is not running at $API_BASE${NC}"
    echo "  Please start the backend server first:"
    echo "  cd backend && python main.py"
    exit 1
fi
echo -e "${GREEN}✓ Backend is running${NC}"
echo ""

# Test 1: Check USE_DATABASE flag status
echo "🔍 Test 1: Checking USE_DATABASE environment variable"
if [ -f backend/.env ]; then
    if grep -q "USE_DATABASE=true" backend/.env; then
        echo -e "${GREEN}✓ USE_DATABASE=true detected${NC}"
        DB_ENABLED=true
    else
        echo -e "${YELLOW}⚠ USE_DATABASE not set or false - testing fallback mode${NC}"
        DB_ENABLED=false
    fi
else
    echo -e "${YELLOW}⚠ No .env file found - assuming USE_DATABASE=false${NC}"
    DB_ENABLED=false
fi
echo ""

# Test 2: Test materials endpoint (should work regardless)
echo "📦 Test 2: Materials Endpoint"
# Materials endpoint uses POST, but we can test the root endpoint
echo -n "Testing: GET / (root endpoint) ... "
response=$(curl -s -w "\n%{http_code}" "$API_BASE/" 2>/dev/null || echo -e "\n000")
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ PASS${NC} (Status: $http_code)"
    TEST_PASSED=$((TEST_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC} (Expected: 200, Got: $http_code)"
    TEST_FAILED=$((TEST_FAILED + 1))
fi
echo ""

# Test 3: Test projects endpoint
echo "📋 Test 3: Projects API Endpoints"
if [ "$DB_ENABLED" = "true" ]; then
    test_endpoint "GET" "/api/projects" "200" "" "GET /api/projects (DB enabled)"
    
    # Test creating a project
    PROJECT_DATA='{"name":"Test Project","address":"123 Test St","status":"draft"}'
    test_endpoint "POST" "/api/projects" "200" "$PROJECT_DATA" "POST /api/projects"
    
    # Get project ID from response (simplified - would need to parse JSON)
    echo "  Note: To test PUT/DELETE, you'll need to use a valid project ID from the GET response"
else
    test_endpoint "GET" "/api/projects" "501" "" "GET /api/projects (should return 501 when DB disabled)"
fi
echo ""

# Test 4: Test workers endpoint
echo "👷 Test 4: Workers API Endpoints"
if [ "$DB_ENABLED" = "true" ]; then
    test_endpoint "GET" "/api/workers" "200" "" "GET /api/workers (DB enabled)"
else
    test_endpoint "GET" "/api/workers" "501" "" "GET /api/workers (should return 501 when DB disabled)"
fi
echo ""

# Test 5: Verify JSON backup exists (for materials)
echo "💾 Test 5: JSON Backup Verification"
if [ -f "data/materials.json" ]; then
    echo -e "${GREEN}✓ materials.json exists${NC}"
    TEST_PASSED=$((TEST_PASSED + 1))
    
    # Check if JSON is valid
    if python3 -m json.tool data/materials.json > /dev/null 2>&1; then
        echo -e "${GREEN}✓ materials.json is valid JSON${NC}"
        TEST_PASSED=$((TEST_PASSED + 1))
    else
        echo -e "${RED}✗ materials.json is not valid JSON${NC}"
        TEST_FAILED=$((TEST_FAILED + 1))
    fi
else
    echo -e "${RED}✗ materials.json not found${NC}"
    TEST_FAILED=$((TEST_FAILED + 1))
fi
echo ""

# Summary
echo "=========================="
echo "Test Summary:"
echo -e "${GREEN}Passed: $TEST_PASSED${NC}"
if [ $TEST_FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $TEST_FAILED${NC}"
else
    echo -e "${GREEN}Failed: $TEST_FAILED${NC}"
fi
echo ""

if [ $TEST_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi
