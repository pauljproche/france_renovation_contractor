#!/bin/bash
# Automated deployment script for EC2
# Run this script on the EC2 instance after SSH'ing in

set -e

echo "================================================================================
FRANCE RENOVATION CONTRACTOR - EC2 DEPLOYMENT
================================================================================
"

# Configuration
RDS_PASSWORD="Vn{{,2vUu(p]y?;-"
RDS_ENDPOINT="database-1.cbsy0008u62v.us-east-1.rds.amazonaws.com"
EC2_IP="3.236.203.206"

echo "Step 1: Updating system..."
sudo apt update && sudo apt upgrade -y

echo ""
echo "Step 2: Installing Python..."
sudo apt install python3 python3-pip python3-venv -y

echo ""
echo "Step 3: Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

echo ""
echo "Step 4: Installing nginx..."
sudo apt install nginx -y

echo ""
echo "Step 5: Installing PostgreSQL client..."
sudo apt install postgresql-client -y

echo ""
echo "Step 6: Installing git..."
sudo apt install git -y

echo ""
echo "Step 7: Creating application directory..."
sudo mkdir -p /opt/france-renovation
sudo chown $USER:$USER /opt/france-renovation
cd /opt/france-renovation

echo ""
echo "Step 8: Cloning repository..."
git clone https://github.com/pauljproche/france_renovation_contractor.git .

echo ""
echo "Step 9: Testing RDS connection..."
export PGPASSWORD="$RDS_PASSWORD"
if psql -h "$RDS_ENDPOINT" -U postgres -d postgres -c "SELECT version();" > /dev/null 2>&1; then
    echo "✅ RDS connection successful!"
else
    echo "❌ RDS connection failed. Please check security groups."
    exit 1
fi

echo ""
echo "Step 10: Creating database..."
psql -h "$RDS_ENDPOINT" -U postgres -d postgres -c "CREATE DATABASE france_renovation;" 2>/dev/null || echo "Database may already exist (continuing...)"

echo ""
echo "Step 11: Setting up Python environment..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "Step 12: Running Alembic migrations..."
export DATABASE_URL="postgresql://postgres:${RDS_PASSWORD}@${RDS_ENDPOINT}:5432/france_renovation"
alembic upgrade head

echo ""
echo "Step 13: Migrating data..."
python scripts/migrate_json_to_db.py

echo ""
echo "Step 14: Setting up agent user role..."
psql "$DATABASE_URL" -f scripts/setup_agent_role.sql

echo ""
echo "Step 15: Applying SQL functions..."
psql "$DATABASE_URL" -f sql_functions/agent_functions.sql

echo ""
echo "Step 16: Creating production .env..."
cat > .env << EOF
USE_DATABASE=true
DATABASE_URL=postgresql://postgres:${RDS_PASSWORD}@${RDS_ENDPOINT}:5432/france_renovation
AGENT_DATABASE_URL=postgresql://agent_user:secure_password@${RDS_ENDPOINT}:5432/france_renovation
CORS_ORIGINS=http://${EC2_IP},https://yourdomain.com
OPENAI_API_KEY=your-key-here
EOF
chmod 600 .env
echo "⚠️  Remember to add your OPENAI_API_KEY to .env!"

echo ""
echo "Step 17: Building frontend..."
cd ../frontend
npm install
npm run build

echo ""
echo "================================================================================
✅ DEPLOYMENT SETUP COMPLETE!
================================================================================

Next steps:
1. Edit backend/.env and add your OPENAI_API_KEY
2. Configure nginx (see DEPLOYMENT_GUIDE.md)
3. Set up systemd services
4. Start the application

Run these commands:
  cd /opt/france-renovation
  # Edit .env with your API key
  # Configure nginx
  # Set up systemd services
  # Start services

"

