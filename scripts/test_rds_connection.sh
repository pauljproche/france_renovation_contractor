#!/bin/bash
# Test RDS connection
# Usage: ./scripts/test_rds_connection.sh <PASSWORD>

set -e

RDS_PASSWORD=$1
RDS_ENDPOINT="database-1.cbsy0008u62v.us-east-1.rds.amazonaws.com"
RDS_PORT="5432"
DB_USER="postgres"

if [ -z "$RDS_PASSWORD" ]; then
    echo "❌ Error: Password required"
    echo "Usage: ./scripts/test_rds_connection.sh <PASSWORD>"
    exit 1
fi

DATABASE_URL="postgresql://${DB_USER}:${RDS_PASSWORD}@${RDS_ENDPOINT}:${RDS_PORT}/postgres"

echo "================================================================================
TESTING RDS CONNECTION
================================================================================
"

echo "Testing connection to: $RDS_ENDPOINT"
echo ""

# Test with psql if available
if command -v psql &> /dev/null; then
    echo "Testing with psql..."
    if PGPASSWORD="$RDS_PASSWORD" psql -h "$RDS_ENDPOINT" -U "$DB_USER" -d postgres -c "SELECT version();" > /dev/null 2>&1; then
        echo "✅ Connection successful!"
        PGPASSWORD="$RDS_PASSWORD" psql -h "$RDS_ENDPOINT" -U "$DB_USER" -d postgres -c "SELECT version();"
    else
        echo "❌ Connection failed with psql"
    fi
    echo ""
fi

# Test with Python
echo "Testing with Python..."
python3 << PYTHON
from sqlalchemy import create_engine
import sys

DATABASE_URL = "$DATABASE_URL"

try:
    engine = create_engine(DATABASE_URL)
    conn = engine.connect()
    result = conn.execute("SELECT version();")
    version = result.fetchone()[0]
    print("✅ Connection successful!")
    print(f"PostgreSQL version: {version}")
    conn.close()
    sys.exit(0)
except Exception as e:
    print(f"❌ Connection failed: {e}")
    sys.exit(1)
PYTHON

if [ $? -eq 0 ]; then
    echo ""
    echo "================================================================================
✅ RDS CONNECTION TEST PASSED
================================================================================
"
    echo "You can now proceed with database setup!"
    echo "Run: ./scripts/setup_rds.sh $RDS_PASSWORD"
else
    echo ""
    echo "================================================================================
❌ RDS CONNECTION TEST FAILED
================================================================================
"
    echo "Please check:"
    echo "  1. Password is correct"
    echo "  2. Security group allows your IP (currently allows 0.0.0.0/0)"
    echo "  3. RDS instance is available"
    exit 1
fi

