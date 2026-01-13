# AWS Deployment Workflow Guide

## 🔄 Environment Independence

**Important**: Your local project and AWS deployment are **completely independent** environments:

- ✅ **Local Development**: Runs on your machine (localhost)
  - Uses local database (if configured) or JSON files
  - Development server runs on `http://localhost:5173` (frontend) and `http://localhost:8000` (backend)
  - Changes made locally **do NOT automatically affect AWS**

- ✅ **AWS Production**: Runs on EC2 instance
  - Uses AWS RDS PostgreSQL database
  - Accessible at `http://3.236.203.206`
  - Changes made on AWS **do NOT automatically affect your local project**

- ⚠️ **No Automatic Sync**: Changes must be **manually deployed** from local to AWS

---

## 📋 Prerequisites

Before deploying, ensure you have:

1. **SSH Access**: Your SSH key (`~/.ssh/llm-fastapi-key.pem`)
2. **Git Repository**: Your code is committed and pushed to GitHub
3. **AWS Credentials**: EC2 instance details
   - **EC2 IP**: `3.236.203.206`
   - **EC2 User**: `ubuntu`
   - **SSH Key**: `~/.ssh/llm-fastapi-key.pem`

---

## 🚀 Deployment Process: Local → AWS

### Step 1: Commit and Push Local Changes

First, ensure all your local changes are committed and pushed to GitHub:

```bash
# Navigate to your local project directory
cd /Users/emmanuelroche/programming_progs/france_renovation_contractor

# Check git status
git status

# Add all changes
git add .

# Commit changes (with descriptive message)
git commit -m "Description of your changes"

# Push to GitHub
git push origin main
# (or git push origin master, depending on your default branch)
```

**⚠️ Important**: Only files tracked by git will be deployed. Files in `.gitignore` (like `.env`, `node_modules`, `venv/`) are NOT synced.

---

### Step 2: SSH into AWS EC2 Instance

Connect to your AWS EC2 instance:

```bash
ssh -i ~/.ssh/llm-fastapi-key.pem ubuntu@3.236.203.206
```

---

### Step 3: Navigate to Application Directory

Once connected to EC2:

```bash
cd /opt/france-renovation
```

---

### Step 4: Pull Latest Changes from GitHub

Update the code on AWS with your latest changes:

```bash
# Pull latest changes from GitHub
git pull origin main
# (or git pull origin master, depending on your default branch)
```

**Note**: If you encounter merge conflicts, resolve them manually or use:
```bash
git fetch origin
git reset --hard origin/main  # ⚠️ WARNING: This discards local changes on EC2
```

---

### Step 5: Update Backend Dependencies (if needed)

If you've added new Python packages or updated `requirements.txt`:

```bash
cd /opt/france-renovation/backend
source venv/bin/activate
pip install -r requirements.txt
```

---

### Step 6: Run Database Migrations (if needed)

If you've made database schema changes:

```bash
cd /opt/france-renovation/backend
source venv/bin/activate
export DATABASE_URL="postgresql://postgres:Vn{{,2vUu(p]y?;-@database-1.cbsy0008u62v.us-east-1.rds.amazonaws.com:5432/france_renovation"
alembic upgrade head
```

---

### Step 7: Rebuild Frontend

Always rebuild the frontend after pulling changes:

```bash
cd /opt/france-renovation/frontend
npm install  # Install any new dependencies
npm run build  # Build production version
```

---

### Step 8: Restart Services

Restart the backend service to apply changes:

```bash
# Restart backend service
sudo systemctl restart france-renovation-backend

# Reload nginx (if you changed nginx config)
sudo systemctl reload nginx

# Check service status
sudo systemctl status france-renovation-backend
```

---

### Step 9: Verify Deployment

Check that everything is working:

```bash
# Check backend logs
sudo journalctl -u france-renovation-backend -n 50 -f

# Test backend API
curl http://localhost:8000/

# Test frontend
curl http://localhost/
```

Visit `http://3.236.203.206` in your browser to verify the deployment.

---

## 📝 Quick Deployment Script

For convenience, you can create a deployment script on EC2. SSH into EC2 and create:

```bash
# On EC2, create deployment script
nano /opt/france-renovation/deploy.sh
```

Add this content:

```bash
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

cd /opt/france-renovation

echo "📥 Pulling latest changes..."
git pull origin main

echo "📦 Updating backend dependencies..."
cd backend
source venv/bin/activate
pip install -r requirements.txt

echo "🗄️ Running database migrations..."
export DATABASE_URL="postgresql://postgres:Vn{{,2vUu(p]y?;-@database-1.cbsy0008u62v.us-east-1.rds.amazonaws.com:5432/france_renovation"
alembic upgrade head

echo "🏗️ Building frontend..."
cd ../frontend
npm install
npm run build

echo "🔄 Restarting services..."
sudo systemctl restart france-renovation-backend
sudo systemctl reload nginx

echo "✅ Deployment complete!"
echo "📊 Checking service status..."
sudo systemctl status france-renovation-backend --no-pager
```

Make it executable:

```bash
chmod +x /opt/france-renovation/deploy.sh
```

Then future deployments are just:

```bash
# On EC2
/opt/france-renovation/deploy.sh
```

---

## 🔄 Reverse Process: AWS → Local (if needed)

If you need to pull changes made directly on AWS back to your local project:

```bash
# On your local machine
cd /Users/emmanuelroche/programming_progs/france_renovation_contractor

# Pull from GitHub (if changes were committed on AWS)
git pull origin main

# Or, if you made changes directly on AWS without git:
# SSH into EC2, commit changes, push to GitHub, then pull locally
```

**⚠️ Best Practice**: Always commit changes on AWS to git before pulling locally, or avoid making changes directly on AWS.

---

## ⚠️ Important Notes

### Environment Variables

- **Local `.env`**: Stored in `backend/.env` (not in git)
- **AWS `.env`**: Stored in `/opt/france-renovation/backend/.env` (not synced via git)
- **⚠️ Changes to `.env` must be manually updated on AWS**

To update AWS `.env`:

```bash
# SSH into EC2
ssh -i ~/.ssh/llm-fastapi-key.pem ubuntu@3.236.203.206

# Edit .env file
nano /opt/france-renovation/backend/.env

# Restart service after changes
sudo systemctl restart france-renovation-backend
```

### Database Independence

- **Local**: Uses local database or JSON files
- **AWS**: Uses AWS RDS PostgreSQL (`database-1.cbsy0008u62v.us-east-1.rds.amazonaws.com`)
- **⚠️ Database changes are NOT automatically synced**

### Build Artifacts

- **Local `dist/`**: Built for local development
- **AWS `dist/`**: Built on EC2 for production
- **⚠️ Build artifacts are NOT synced** - always rebuild on AWS

---

## 🐛 Troubleshooting

### Git Pull Fails

```bash
# Check if you have uncommitted changes on EC2
cd /opt/france-renovation
git status

# If needed, stash or commit changes
git stash
# OR
git commit -am "EC2 local changes"
git pull origin main
```

### Service Won't Start

```bash
# Check logs
sudo journalctl -u france-renovation-backend -n 100

# Check if port is in use
sudo lsof -i :8000

# Verify .env file exists and is correct
cat /opt/france-renovation/backend/.env
```

### Frontend Not Updating

```bash
# Ensure frontend is rebuilt
cd /opt/france-renovation/frontend
rm -rf dist
npm run build

# Check nginx is serving correct directory
ls -la /opt/france-renovation/frontend/dist

# Reload nginx
sudo systemctl reload nginx
```

---

## 📊 Deployment Checklist

Before deploying, ensure:

- [ ] All local changes are committed
- [ ] Changes are pushed to GitHub
- [ ] You have SSH access to EC2
- [ ] You know which branch to pull from (main/master)
- [ ] Database migrations are ready (if schema changed)
- [ ] New dependencies are in `requirements.txt` (if added)
- [ ] `.env` variables are updated on AWS (if changed)

After deploying, verify:

- [ ] Git pull succeeded
- [ ] Backend service is running (`sudo systemctl status france-renovation-backend`)
- [ ] Frontend loads at `http://3.236.203.206`
- [ ] API endpoints work (`http://3.236.203.206/api/docs`)
- [ ] No errors in logs (`sudo journalctl -u france-renovation-backend -n 50`)

---

## 🔐 Security Reminders

1. **Never commit `.env` files** - they contain sensitive credentials
2. **Keep SSH key secure** - `chmod 600 ~/.ssh/llm-fastapi-key.pem`
3. **Restrict SSH access** - Consider limiting EC2 security group to your IP
4. **Use strong passwords** - Especially for RDS and API keys

---

## 📚 Related Documentation

- `AWS_DEPLOYMENT_COMPLETE.md` - Initial deployment details
- `AWS_DEPLOYMENT_STATUS.md` - Current AWS infrastructure status
- `DEPLOYMENT_GUIDE.md` - General deployment guide
- `scripts/deploy_to_ec2.sh` - Initial setup script

---

**Last Updated**: January 2026  
**AWS EC2 IP**: `3.236.203.206`  
**Repository**: `https://github.com/pauljproche/france_renovation_contractor.git`
