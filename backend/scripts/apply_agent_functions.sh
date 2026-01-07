#!/bin/bash
# Apply SQL functions for agent tools (Phase 5)
# This script applies the SQL functions that the agent uses for database access.

set -e

# Get database connection details from environment or use defaults
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-france_renovation}"
DB_USER="${DB_USER:-postgres}"

# Path to SQL functions file
SQL_FILE="$(dirname "$0")/../sql_functions/agent_functions.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo "Error: SQL functions file not found: $SQL_FILE"
    exit 1
fi

echo "Applying SQL functions for agent tools..."
echo "Database: $DB_NAME on $DB_HOST:$DB_PORT"
echo ""

# Apply SQL functions
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SQL_FILE"

echo ""
echo "✅ SQL functions applied successfully!"
echo ""
echo "Next steps:"
echo "1. Run setup_agent_role.sql to create the restricted agent_user role"
echo "2. Update AGENT_DATABASE_URL in .env file"
echo "3. Test agent tools with preview + confirmation system"


