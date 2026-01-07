#!/bin/bash
# Phase 4 Testing Script
# Tests database reads are working correctly

set -e

echo "🧪 Phase 4 Testing Script - Database Reads"
echo "==========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_BASE="http://localhost:8000"
TEST_PASSED=0
TEST_FAILED=0

# Function to test API endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local expected_status=$3
    local description=$4
    
    echo -n "Testing: $description ... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$API_BASE$endpoint" 2>/dev/null || echo -e "\n000")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (Status: $http_code)"
        TEST_PASSED=$((TEST_PASSED + 1))
        
        # Check if response contains data (for 200 status)
        if [ "$http_code" = "200" ]; then
            # Check if body contains JSON data (not empty or error)
            if echo "$body" | grep -q "projects\|workers\|sections\|items" 2>/dev/null; then
                echo "  ${BLUE}→ Response contains data${NC}"
            elif echo "$body" | grep -q "count\|\[\]" 2>/dev/null; then
                echo "  ${BLUE}→ Response valid (may be empty array)${NC}"
            fi
        fi
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $http_code)"
        echo "  Response: $(echo "$body" | head -3)"
        TEST_FAILED=$((TEST_FAILED + 1))
        return 1
    fi
}

# Check if backend is running
echo "📡 Checking if backend is running..."
if ! curl -s "$API_BASE/" > /dev/null 2>&1; then
    echo -e "${RED}✗ Backend is not running at $API_BASE${NC}"
    echo "  Please start the backend server first"
    exit 1
fi
echo -e "${GREEN}✓ Backend is running${NC}"
echo ""

# Check USE_DATABASE setting
echo "🔍 Test 1: Checking USE_DATABASE environment variable"
if [ -f backend/.env ]; then
    if grep -q "USE_DATABASE=true" backend/.env; then
        echo -e "${GREEN}✓ USE_DATABASE=true detected${NC}"
        DB_ENABLED=true
    else
        echo -e "${YELLOW}⚠ USE_DATABASE not set to true${NC}"
        DB_ENABLED=false
    fi
else
    echo -e "${YELLOW}⚠ No .env file found${NC}"
    DB_ENABLED=false
fi
echo ""

# Test 2: Projects endpoint should return 200 (not 501)
echo "📋 Test 2: Projects API Endpoints"
if [ "$DB_ENABLED" = "true" ]; then
    test_endpoint "GET" "/api/projects" "200" "GET /api/projects (should return 200 with DB enabled)"
else
    echo -e "${YELLOW}⚠ Skipping - USE_DATABASE not enabled${NC}"
fi
echo ""

# Test 3: Workers endpoint should return 200 (not 501)
echo "👷 Test 3: Workers API Endpoints"
if [ "$DB_ENABLED" = "true" ]; then
    test_endpoint "GET" "/api/workers" "200" "GET /api/workers (should return 200 with DB enabled)"
else
    echo -e "${YELLOW}⚠ Skipping - USE_DATABASE not enabled${NC}"
fi
echo ""

# Test 4: Verify response contains data
echo "📊 Test 4: Verify API Returns Data from Database"
if [ "$DB_ENABLED" = "true" ]; then
    projects_response=$(curl -s "$API_BASE/api/projects" 2>/dev/null)
    if echo "$projects_response" | grep -q "projects\|count\|\[\]" 2>/dev/null; then
        echo -e "${GREEN}✓ Projects API returns valid response${NC}"
        # Count projects if possible
        project_count=$(echo "$projects_response" | grep -o '"count"[^,]*' | grep -o '[0-9]*' | head -1 || echo "unknown")
        echo "  ${BLUE}→ Projects count: $project_count${NC}"
        TEST_PASSED=$((TEST_PASSED + 1))
    else
        echo -e "${RED}✗ Projects API response format unexpected${NC}"
        TEST_FAILED=$((TEST_FAILED + 1))
    fi
    
    workers_response=$(curl -s "$API_BASE/api/workers" 2>/dev/null)
    if echo "$workers_response" | grep -q "workers\|count\|\[\]" 2>/dev/null; then
        echo -e "${GREEN}✓ Workers API returns valid response${NC}"
        worker_count=$(echo "$workers_response" | grep -o '"count"[^,]*' | grep -o '[0-9]*' | head -1 || echo "unknown")
        echo "  ${BLUE}→ Workers count: $worker_count${NC}"
        TEST_PASSED=$((TEST_PASSED + 1))
    else
        echo -e "${RED}✗ Workers API response format unexpected${NC}"
        TEST_FAILED=$((TEST_FAILED + 1))
    fi
fi
echo ""

# Test 5: Performance check (simple)
echo "⚡ Test 5: Performance Check"
if [ "$DB_ENABLED" = "true" ]; then
    echo -n "  Testing API response time... "
    start_time=$(date +%s%N)
    curl -s "$API_BASE/api/projects" > /dev/null 2>&1
    end_time=$(date +%s%N)
    duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
    if [ "$duration" -lt 1000 ]; then
        echo -e "${GREEN}✓ Fast${NC} (${duration}ms)"
        TEST_PASSED=$((TEST_PASSED + 1))
    elif [ "$duration" -lt 5000 ]; then
        echo -e "${YELLOW}⚠ Acceptable${NC} (${duration}ms)"
        TEST_PASSED=$((TEST_PASSED + 1))
    else
        echo -e "${RED}✗ Slow${NC} (${duration}ms)"
        TEST_FAILED=$((TEST_FAILED + 1))
    fi
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

if [ $TEST_FAILED -eq 0 ] && [ "$DB_ENABLED" = "true" ]; then
    echo -e "${GREEN}✅ All tests passed! Phase 4 database reads are working!${NC}"
    exit 0
elif [ "$DB_ENABLED" != "true" ]; then
    echo -e "${YELLOW}⚠ USE_DATABASE not enabled - cannot test database reads${NC}"
    exit 1
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi

