# AWS Deployment - Step by Step

## Phase 1: Prepare RDS ✅ IN PROGRESS

### Step 1.1: Get RDS Password

**Option A: Check AWS Secrets Manager**
```bash
aws secretsmanager list-secrets
aws secretsmanager get-secret-value --secret-id <secret-name>
```

**Option B: Reset Password in AWS Console**
1. Go to RDS → database-1
2. Click "Modify"
3. Change master password
4. Save new password securely

**Option C: Use AWS CLI to reset**
```bash
aws rds modify-db-instance \
  --db-instance-identifier database-1 \
  --master-user-password <new-password> \
  --apply-immediately
```

### Step 1.2: Test Connection Locally

Once we have the password:
```bash
# Test connection
psql -h database-1.cbsy0008u62v.us-east-1.rds.amazonaws.com \
     -U postgres \
     -d postgres

# Or test with Python
python3 -c "
from sqlalchemy import create_engine
engine = create_engine('postgresql://postgres:PASSWORD@database-1.cbsy0008u62v.us-east-1.rds.amazonaws.com:5432/postgres')
conn = engine.connect()
print('✅ Connection successful!')
"
```

### Step 1.3: Create Database Schema

```bash
# Connect to RDS
export DATABASE_URL="postgresql://postgres:PASSWORD@database-1.cbsy0008u62v.us-east-1.rds.amazonaws.com:5432/postgres"

# Create database
psql $DATABASE_URL -c "CREATE DATABASE france_renovation;"

# Run Alembic migrations
cd backend
alembic upgrade head
```

### Step 1.4: Migrate Data

```bash
# Update DATABASE_URL
export DATABASE_URL="postgresql://postgres:PASSWORD@database-1.cbsy0008u62v.us-east-1.rds.amazonaws.com:5432/france_renovation"

# Run migration
python backend/scripts/migrate_json_to_db.py

# Validate migration
python backend/scripts/validate_migration.py
```

### Step 1.5: Set Up Agent User Role

```bash
# Connect to RDS
psql $DATABASE_URL

# Run setup script
\i backend/scripts/setup_agent_role.sql

# Apply SQL functions
\i backend/sql_functions/agent_functions.sql
```

## Phase 2: Create EC2 Instance

### Step 2.1: Launch EC2 Instance

```bash
# Get latest Ubuntu 22.04 AMI
AMI_ID=$(aws ec2 describe-images \
  --owners 099720109477 \
  --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
  --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
  --output text)

# Create security group for EC2
SG_ID=$(aws ec2 create-security-group \
  --group-name france-renovation-ec2 \
  --description "Security group for France Renovation Contractor EC2" \
  --vpc-id vpc-09cfeed193ab44aaf \
  --query 'GroupId' \
  --output text)

# Add rules to security group
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0  # Restrict to your IP later

aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

# Launch instance
aws ec2 run-instances \
  --image-id $AMI_ID \
  --instance-type t3.medium \
  --key-name <your-key-name> \
  --security-group-ids $SG_ID \
  --subnet-id <subnet-id> \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=france-renovation-app}]' \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":20,"VolumeType":"gp3"}}]'
```

### Step 2.2: Update RDS Security Group

```bash
# Remove public access (0.0.0.0/0)
aws ec2 revoke-security-group-ingress \
  --group-id sg-0074d2b4ae6ccb4d3 \
  --protocol tcp \
  --port 5432 \
  --cidr 0.0.0.0/0

# Allow access from EC2 security group
aws ec2 authorize-security-group-ingress \
  --group-id sg-0074d2b4ae6ccb4d3 \
  --protocol tcp \
  --port 5432 \
  --source-group $SG_ID
```

## Phase 3: Deploy Application

### Step 3.1: Set Up EC2

```bash
# SSH into EC2
ssh -i ~/.ssh/your-key.pem ubuntu@<EC2_IP>

# Update system
sudo apt update && sudo apt upgrade -y

# Install Python
sudo apt install python3 python3-pip python3-venv -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install nginx
sudo apt install nginx -y

# Install git
sudo apt install git -y
```

### Step 3.2: Deploy Code

```bash
# Create app directory
sudo mkdir -p /opt/france-renovation
sudo chown $USER:$USER /opt/france-renovation
cd /opt/france-renovation

# Clone repository
git clone https://github.com/pauljproche/france_renovation_contractor.git .

# Set up Python environment
cd backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Set up frontend
cd ../frontend
npm install
npm run build
```

### Step 3.3: Configure Environment

```bash
# Create production .env
cd /opt/france-renovation/backend
nano .env

# Add:
USE_DATABASE=true
DATABASE_URL=postgresql://postgres:PASSWORD@database-1.cbsy0008u62v.us-east-1.rds.amazonaws.com:5432/france_renovation
AGENT_DATABASE_URL=postgresql://agent_user:PASSWORD@database-1.cbsy0008u62v.us-east-1.rds.amazonaws.com:5432/france_renovation
CORS_ORIGINS=https://yourdomain.com,http://<EC2_IP>
OPENAI_API_KEY=your-key-here

# Secure .env
chmod 600 .env
```

### Step 3.4: Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/france-renovation
```

Add configuration (see DEPLOYMENT_GUIDE.md)

### Step 3.5: Set Up Systemd Services

```bash
# Copy service files
sudo cp systemd/france-renovation-backend.service /etc/systemd/system/
sudo cp systemd/france-renovation-bot.service /etc/systemd/system/

# Edit service files with correct paths
sudo nano /etc/systemd/system/france-renovation-backend.service

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable france-renovation-backend
sudo systemctl start france-renovation-backend
```

## Next Steps

We'll go through each step together. Starting with getting the RDS password.


