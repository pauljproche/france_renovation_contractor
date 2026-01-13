#!/bin/bash
# Phase 5 Setup Script
# This script sets up the database for Phase 5: SQL Functions for Agent Tools

set -e

echo "=========================================="
echo "Phase 5: SQL Functions for Agent Tools"
echo "Setup Script"
echo "=========================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running!"
    echo ""
    echo "Please start Docker Desktop first, then run this script again."
    echo ""
    exit 1
fi

# Check if database container exists
if ! docker ps -a | grep -q france-renovation-db; then
    echo "❌ Database container 'france-renovation-db' not found!"
    echo ""
    echo "Please start the database container first:"
    echo "  docker start france-renovation-db"
    echo ""
    echo "Or create it if it doesn't exist:"
    echo "  docker run -d --name france-renovation-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=france_renovation -p 5432:5432 postgres:15"
    echo ""
    exit 1
fi

# Check if container is running
if ! docker ps | grep -q france-renovation-db; then
    echo "Starting database container..."
    docker start france-renovation-db
    echo "Waiting for PostgreSQL to be ready..."
    sleep 5
fi

# Wait for PostgreSQL to be ready
echo "Checking if PostgreSQL is ready..."
for i in {1..30}; do
    if docker exec france-renovation-db pg_isready -U postgres > /dev/null 2>&1; then
        echo "✅ PostgreSQL is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ PostgreSQL failed to start after 30 seconds"
        exit 1
    fi
    sleep 1
done

echo ""
echo "Step 1: Applying SQL functions..."
echo "-----------------------------------"

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SQL_FILE="$SCRIPT_DIR/../sql_functions/agent_functions.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo "❌ SQL functions file not found: $SQL_FILE"
    exit 1
fi

# Apply SQL functions
docker exec -i france-renovation-db psql -U postgres -d france_renovation < "$SQL_FILE"

if [ $? -eq 0 ]; then
    echo "✅ SQL functions applied successfully!"
else
    echo "❌ Failed to apply SQL functions"
    exit 1
fi

echo ""
echo "Step 2: Creating agent_user role..."
echo "-----------------------------------"

# Apply role setup
ROLE_FILE="$SCRIPT_DIR/setup_agent_role.sql"
if [ ! -f "$ROLE_FILE" ]; then
    echo "❌ Role setup file not found: $ROLE_FILE"
    exit 1
fi

# Apply role setup (remove RAISE NOTICE commands for cleaner output)
docker exec -i france-renovation-db psql -U postgres -d france_renovation < "$ROLE_FILE" 2>&1 | grep -v "NOTICE:" || true

echo "✅ Agent role setup complete!"
echo ""

echo "Step 3: Verifying setup..."
echo "-----------------------------------"

# Verify functions exist
FUNC_COUNT=$(docker exec france-renovation-db psql -U postgres -d france_renovation -t -c "SELECT COUNT(*) FROM pg_proc WHERE proname LIKE '%preview%' OR proname LIKE 'get_%' OR proname LIKE 'search_%' OR proname LIKE 'execute_%';" | tr -d ' ')

echo "Found $FUNC_COUNT SQL functions"

# Verify role exists
ROLE_EXISTS=$(docker exec france-renovation-db psql -U postgres -d france_renovation -t -c "SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'agent_user');" | tr -d ' ')

if [ "$ROLE_EXISTS" = "t" ]; then
    echo "✅ agent_user role exists"
else
    echo "❌ agent_user role not found"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ Phase 5 database setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Update backend/.env with:"
echo "   AGENT_DATABASE_URL=postgresql://agent_user:change_me_in_production@localhost:5432/france_renovation"
echo ""
echo "2. Update the password in production:"
echo "   docker exec -it france-renovation-db psql -U postgres -d france_renovation -c \"ALTER ROLE agent_user WITH PASSWORD 'secure_password';\""
echo ""
echo "3. Test the backend with:"
echo "   python -m pytest tests/  # if you have tests"
echo "   # or manually test via API"
echo ""



