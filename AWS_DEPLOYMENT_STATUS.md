# AWS Deployment Status

**Date**: January 12, 2026

## ✅ Phase 1: RDS Setup - COMPLETE

- ✅ RDS Password Reset: `Vn{{,2vUu(p]y?;-`
- ✅ RDS Instance: `database-1` (PostgreSQL 16.8)
- ✅ RDS Endpoint: `database-1.cbsy0008u62v.us-east-1.rds.amazonaws.com:5432`
- ✅ RDS Security Group: Updated to allow EC2 access
- ⚠️  RDS is NOT publicly accessible (good for security)
- ⚠️  Database setup will be done from EC2 (can't connect from local)

## ✅ Phase 2: EC2 Instance - CREATED

- ✅ Instance ID: `i-0f287ea1c1430b25d`
- ✅ Instance Type: `t3.medium`
- ✅ Status: Running
- ✅ Public IP: `3.236.203.206`
- ✅ Private IP: `172.31.3.230`
- ✅ Security Group: `sg-0e16f408491efe9de`
- ✅ Key Pair: `llm-fastapi-key`
- ✅ VPC: `vpc-09cfeed193ab44aaf` (same as RDS)

## Security Group Rules

**EC2 Security Group** (`sg-0e16f408491efe9de`):
- SSH (22): Open to 0.0.0.0/0 ⚠️ (restrict to your IP later)
- HTTP (80): Open to 0.0.0.0/0
- HTTPS (443): Open to 0.0.0.0/0

**RDS Security Group** (`sg-0074d2b4ae6ccb4d3`):
- PostgreSQL (5432): Allowed from EC2 security group ✅

## Next Steps: Phase 3 - Deploy Application

### Step 1: SSH into EC2
```bash
ssh -i ~/.ssh/llm-fastapi-key.pem ubuntu@3.236.203.206
```

### Step 2: Set Up Environment
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python
sudo apt install python3 python3-pip python3-venv -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install nginx
sudo apt install nginx -y

# Install PostgreSQL client (for testing)
sudo apt install postgresql-client -y

# Install git
sudo apt install git -y
```

### Step 3: Clone Repository
```bash
sudo mkdir -p /opt/france-renovation
sudo chown $USER:$USER /opt/france-renovation
cd /opt/france-renovation
git clone https://github.com/pauljproche/france_renovation_contractor.git .
```

### Step 4: Set Up Database
```bash
# Test RDS connection
psql -h database-1.cbsy0008u62v.us-east-1.rds.amazonaws.com \
     -U postgres \
     -d postgres

# Password: Vn{{,2vUu(p]y?;-

# Create database
psql -h database-1.cbsy0008u62v.us-east-1.rds.amazonaws.com \
     -U postgres \
     -d postgres \
     -c "CREATE DATABASE france_renovation;"

# Set up Python environment
cd backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Run migrations
export DATABASE_URL="postgresql://postgres:Vn{{,2vUu(p]y?;-@database-1.cbsy0008u62v.us-east-1.rds.amazonaws.com:5432/france_renovation"
alembic upgrade head

# Migrate data
python scripts/migrate_json_to_db.py

# Set up agent user and SQL functions
psql $DATABASE_URL -f scripts/setup_agent_role.sql
psql $DATABASE_URL -f sql_functions/agent_functions.sql
```

### Step 5: Configure Environment
```bash
cd /opt/france-renovation/backend
nano .env
```

Add:
```bash
USE_DATABASE=true
DATABASE_URL=postgresql://postgres:Vn{{,2vUu(p]y?;-@database-1.cbsy0008u62v.us-east-1.rds.amazonaws.com:5432/france_renovation
AGENT_DATABASE_URL=postgresql://agent_user:secure_password@database-1.cbsy0008u62v.us-east-1.rds.amazonaws.com:5432/france_renovation
CORS_ORIGINS=http://3.236.203.206,https://yourdomain.com
OPENAI_API_KEY=your-key-here
```

### Step 6: Build Frontend
```bash
cd /opt/france-renovation/frontend
npm install
npm run build
```

### Step 7: Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/france-renovation
```

### Step 8: Set Up Systemd Services
```bash
sudo cp systemd/france-renovation-backend.service /etc/systemd/system/
sudo nano /etc/systemd/system/france-renovation-backend.service
# Update paths and user

sudo systemctl daemon-reload
sudo systemctl enable france-renovation-backend
sudo systemctl start france-renovation-backend
```

## Important Credentials

**RDS Password**: `Vn{{,2vUu(p]y?;-`  
**EC2 Public IP**: `3.236.203.206`  
**EC2 Key**: `llm-fastapi-key` (check ~/.ssh/)

## Security Notes

⚠️ **TODO**: Restrict SSH access to your IP only
```bash
# Get your IP
curl ifconfig.me

# Update security group to restrict SSH to your IP
aws ec2 revoke-security-group-ingress \
  --group-id sg-0e16f408491efe9de \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id sg-0e16f408491efe9de \
  --protocol tcp \
  --port 22 \
  --cidr YOUR_IP/32
```

## Current Status

- ✅ RDS password reset
- ✅ EC2 instance created and running
- ✅ Security groups configured
- ⏳ Next: SSH into EC2 and set up application

