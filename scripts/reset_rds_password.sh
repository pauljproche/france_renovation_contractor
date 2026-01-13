#!/bin/bash
# Reset RDS master password
# Usage: ./scripts/reset_rds_password.sh <NEW_PASSWORD>

set -e

NEW_PASSWORD=$1
DB_INSTANCE="database-1"

if [ -z "$NEW_PASSWORD" ]; then
    echo "❌ Error: Password required"
    echo "Usage: ./scripts/reset_rds_password.sh <NEW_PASSWORD>"
    echo ""
    echo "Password requirements:"
    echo "  - 8-128 characters"
    echo "  - Contains uppercase, lowercase, numbers, and special characters"
    exit 1
fi

# Validate password length
if [ ${#NEW_PASSWORD} -lt 8 ] || [ ${#NEW_PASSWORD} -gt 128 ]; then
    echo "❌ Error: Password must be 8-128 characters"
    exit 1
fi

echo "================================================================================
RESETTING RDS PASSWORD
================================================================================
"
echo "Instance: $DB_INSTANCE"
echo "This will reset the master password immediately."
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

echo ""
echo "Resetting password..."
aws rds modify-db-instance \
    --db-instance-identifier "$DB_INSTANCE" \
    --master-user-password "$NEW_PASSWORD" \
    --apply-immediately

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Password reset initiated!"
    echo ""
    echo "⚠️  IMPORTANT: Wait 2-3 minutes for the change to apply."
    echo ""
    echo "Save this password securely:"
    echo "  Password: $NEW_PASSWORD"
    echo ""
    echo "Next steps:"
    echo "  1. Wait for RDS to finish modifying"
    echo "  2. Test connection: ./scripts/test_rds_connection.sh $NEW_PASSWORD"
    echo "  3. Run setup: ./scripts/setup_rds.sh $NEW_PASSWORD"
else
    echo ""
    echo "❌ Failed to reset password. Check AWS CLI configuration."
    exit 1
fi

