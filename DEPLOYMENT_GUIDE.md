# AWS EC2 Deployment Guide

This guide walks you through deploying the France Renovation Contractor application on AWS EC2.

## Prerequisites

- AWS EC2 instance running (Ubuntu 20.04+ or Amazon Linux 2)
- SSH access to your EC2 instance
- Domain name (optional, can use EC2 public IP)
- Basic knowledge of Linux commands

## Step 1: Prepare EC2 Instance

### 1.1 Update System

```bash
sudo apt update && sudo apt upgrade -y  # Ubuntu/Debian
# OR
sudo yum update -y  # Amazon Linux
```

### 1.2 Install Required Software

```bash
# Install Python 3.8+ and pip
sudo apt install python3 python3-pip python3-venv -y  # Ubuntu/Debian
# OR
sudo yum install python3 python3-pip -y  # Amazon Linux

# Install Node.js 16+ (using NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs  # Ubuntu/Debian
# OR for Amazon Linux
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install nginx (for serving frontend and reverse proxy)
sudo apt install nginx -y  # Ubuntu/Debian
# OR
sudo yum install nginx -y  # Amazon Linux

# Install git (if not already installed)
sudo apt install git -y  # Ubuntu/Debian
# OR
sudo yum install git -y  # Amazon Linux
```

### 1.3 Configure Firewall

```bash
# Allow HTTP, HTTPS, and SSH
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 8000/tcp # Backend API (if not using nginx proxy)
sudo ufw enable
```

## Step 2: Deploy Application Code

### 2.1 Clone Repository

```bash
# Create application directory
sudo mkdir -p /opt/france-renovation
sudo chown $USER:$USER /opt/france-renovation
cd /opt/france-renovation

# Clone your repository (replace with your repo URL)
git clone https://github.com/yourusername/france_renovation_contractor.git .
# OR upload files via SCP/SFTP
```

### 2.2 Set Up Python Environment

```bash
cd /opt/france-renovation/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 2.3 Set Up Frontend

```bash
cd /opt/france-renovation/frontend
npm install
npm run build  # Build for production
```

## Step 3: Configure Environment Variables

### 3.1 Create Production .env File

```bash
cd /opt/france-renovation/backend
cp ../.env.production.example .env
nano .env  # Edit with your production values
```

**Important variables to set:**
- `OPENAI_API_KEY` - Your OpenAI API key
- `CORS_ORIGINS` - Your domain/IP (e.g., `http://yourdomain.com,https://yourdomain.com`)
- `BACKEND_PORT` - Port for backend (default: 8000)
- `ZULIP_*` - If using Zulip integration

### 3.2 Secure .env File

```bash
chmod 600 /opt/france-renovation/backend/.env
```

## Step 4: Configure Nginx

### 4.1 Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/france-renovation
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com;  # Replace with your domain or EC2 IP

    # Serve frontend static files
    location / {
        root /opt/france-renovation/frontend/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
    }

    # Proxy API requests to FastAPI backend
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy other backend endpoints
    location ~ ^/(assistant|materials|translate|extract-product-image|edit-history) {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4.2 Enable Site

```bash
# Ubuntu/Debian
sudo ln -s /etc/nginx/sites-available/france-renovation /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl restart nginx

# Amazon Linux
sudo cp /etc/nginx/sites-available/france-renovation /etc/nginx/conf.d/france-renovation.conf
sudo nginx -t
sudo systemctl restart nginx
```

## Step 5: Create Systemd Service Files

### 5.1 Backend Service

```bash
sudo nano /etc/systemd/system/france-renovation-backend.service
```

Add:

```ini
[Unit]
Description=France Renovation Contractor Backend
After=network.target

[Service]
Type=simple
User=ubuntu  # Replace with your username
WorkingDirectory=/opt/france-renovation/backend
Environment="PATH=/opt/france-renovation/backend/venv/bin"
ExecStart=/opt/france-renovation/backend/venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 5.2 Zulip Bot Service (Optional)

```bash
sudo nano /etc/systemd/system/france-renovation-bot.service
```

Add:

```ini
[Unit]
Description=France Renovation Contractor Zulip Bot
After=network.target france-renovation-backend.service
Requires=france-renovation-backend.service

[Service]
Type=simple
User=ubuntu  # Replace with your username
WorkingDirectory=/opt/france-renovation
Environment="PATH=/opt/france-renovation/backend/venv/bin"
ExecStart=/opt/france-renovation/backend/venv/bin/python -m backend.zulip_bot.bot
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 5.3 Enable and Start Services

```bash
sudo systemctl daemon-reload
sudo systemctl enable france-renovation-backend
sudo systemctl start france-renovation-backend

# If using Zulip bot
sudo systemctl enable france-renovation-bot
sudo systemctl start france-renovation-bot

# Check status
sudo systemctl status france-renovation-backend
sudo systemctl status france-renovation-bot
```

## Step 6: Set Up SSL (Optional but Recommended)

### 6.1 Install Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y  # Ubuntu/Debian
# OR
sudo yum install certbot python3-certbot-nginx -y  # Amazon Linux
```

### 6.2 Obtain SSL Certificate

```bash
sudo certbot --nginx -d yourdomain.com
```

Follow the prompts. Certbot will automatically configure nginx.

## Step 7: Verify Deployment

### 7.1 Check Services

```bash
# Check backend
curl http://localhost:8000/
# Should return: {"message":"Renovation Contractor API","status":"running"}

# Check nginx
curl http://localhost/
# Should return the frontend HTML

# Check service logs
sudo journalctl -u france-renovation-backend -f
sudo journalctl -u france-renovation-bot -f
```

### 7.2 Test from Browser

1. Open `http://your-ec2-ip` or `http://yourdomain.com`
2. Verify frontend loads
3. Test API endpoints
4. Test AI agent functionality

## Step 8: Maintenance Commands

### Restart Services

```bash
sudo systemctl restart france-renovation-backend
sudo systemctl restart france-renovation-bot
sudo systemctl restart nginx
```

### View Logs

```bash
# Backend logs
sudo journalctl -u france-renovation-backend -n 100 -f

# Bot logs
sudo journalctl -u france-renovation-bot -n 100 -f

# Application logs
tail -f /opt/france-renovation/logs/backend.log
tail -f /opt/france-renovation/logs/bot.log

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Update Application

```bash
cd /opt/france-renovation
git pull  # Or upload new files

# Update backend
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Update frontend
cd ../frontend
npm install
npm run build

# Restart services
sudo systemctl restart france-renovation-backend
sudo systemctl restart nginx
```

## Troubleshooting

### Backend Not Starting

1. Check logs: `sudo journalctl -u france-renovation-backend -n 50`
2. Verify .env file exists and is configured
3. Check port 8000 is not in use: `sudo lsof -i :8000`
4. Verify Python venv is activated correctly

### Frontend Not Loading

1. Check nginx status: `sudo systemctl status nginx`
2. Verify frontend is built: `ls -la /opt/france-renovation/frontend/dist`
3. Check nginx error logs: `sudo tail -f /var/log/nginx/error.log`
4. Verify nginx configuration: `sudo nginx -t`

### CORS Errors

1. Check `CORS_ORIGINS` in `.env` includes your domain/IP
2. Restart backend: `sudo systemctl restart france-renovation-backend`
3. Check browser console for specific CORS error

## Security Considerations

1. **Firewall**: Only open necessary ports (22, 80, 443)
2. **SSL**: Use HTTPS in production (Let's Encrypt)
3. **Environment Variables**: Keep `.env` file secure (chmod 600)
4. **Updates**: Keep system and dependencies updated
5. **Backups**: Regularly backup `data/` directory
6. **Monitoring**: Set up CloudWatch or similar monitoring

## Next Steps

- Set up automated backups for `data/` directory
- Configure CloudWatch monitoring
- Set up log rotation
- Consider using AWS RDS for database (future migration)
- Set up CI/CD pipeline for automated deployments


