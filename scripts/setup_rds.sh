#!/bin/bash
# Setup script for RDS database
# Usage: ./scripts/setup_rds.sh <RDS_PASSWORD>

set -e

RDS_PASSWORD=$1
RDS_ENDPOINT="database-1.cbsy0008u62v.us-east-1.rds.amazonaws.com"
RDS_PORT="5432"
DB_NAME="france_renovation"
DB_USER="postgres"

if [ -z "$RDS_PASSWORD" ]; then
    echo "❌ Error: RDS password required"
    echo "Usage: ./scripts/setup_rds.sh <RDS_PASSWORD>"
    exit 1
fi

DATABASE_URL="postgresql://${DB_USER}:${RDS_PASSWORD}@${RDS_ENDPOINT}:${RDS_PORT}/postgres"
TARGET_DATABASE_URL="postgresql://${DB_USER}:${RDS_PASSWORD}@${RDS_ENDPOINT}:${RDS_PORT}/${DB_NAME}"

echo "================================================================================
RDS SETUP SCRIPT
================================================================================
"

echo "Step 1: Testing connection to RDS..."
if psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1; then
    echo "✅ Connection successful!"
else
    echo "❌ Connection failed. Please check:"
    echo "   - Password is correct"
    echo "   - Security group allows your IP"
    echo "   - RDS instance is available"
    exit 1
fi

echo ""
echo "Step 2: Creating database '${DB_NAME}'..."
psql "$DATABASE_URL" -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null || echo "⚠️  Database may already exist (continuing...)"

echo ""
echo "Step 3: Running Alembic migrations..."
cd backend
export DATABASE_URL="$TARGET_DATABASE_URL"
alembic upgrade head
echo "✅ Migrations complete!"

echo ""
echo "Step 4: Migrating data..."
python scripts/migrate_json_to_db.py
echo "✅ Data migration complete!"

echo ""
echo "Step 5: Setting up agent user role..."
psql "$TARGET_DATABASE_URL" -f scripts/setup_agent_role.sql
echo "✅ Agent user role created!"

echo ""
echo "Step 6: Applying SQL functions..."
psql "$TARGET_DATABASE_URL" -f sql_functions/agent_functions.sql
echo "✅ SQL functions applied!"

echo ""
echo "================================================================================
✅ RDS SETUP COMPLETE!
================================================================================

Database URL for production .env:
DATABASE_URL=${TARGET_DATABASE_URL}
AGENT_DATABASE_URL=postgresql://agent_user:secure_password@${RDS_ENDPOINT}:${RDS_PORT}/${DB_NAME}

Next steps:
1. Save these URLs securely
2. Update production .env file
3. Proceed to Phase 2: Create EC2 instance

"


