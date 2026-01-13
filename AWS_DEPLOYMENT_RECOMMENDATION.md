# AWS Deployment Recommendation

## My Recommendation: **Use Existing RDS + Create New EC2**

### Why This Approach?

1. **Cost Effective**: RDS is already running and costing money - use it!
2. **Quick Deployment**: No need to wait for new RDS setup
3. **Clean EC2**: New instance gives you fresh start for this project
4. **PostgreSQL 16.8**: Newer version is backward compatible with 15

## Recommended Plan

### Step 1: Use Existing RDS (database-1)
**Why:**
- ✅ Already running and paid for
- ✅ PostgreSQL 16.8 is compatible with your code (backward compatible)
- ✅ Security group already allows connections
- ✅ Quick to get started

**What to do:**
1. Get/reset RDS master password
2. Test connection from local machine
3. Verify PostgreSQL 16.8 compatibility
4. Migrate data to RDS

### Step 2: Create New EC2 Instance
**Why:**
- ✅ Fresh start for this project
- ✅ Can optimize for this application
- ✅ Better than reusing stopped instances (may have old configs)
- ✅ Can choose appropriate instance type

**Recommended Instance:**
- **Type**: `t3.medium` or `t3.large` (good balance of cost/performance)
- **OS**: Ubuntu 22.04 LTS
- **Storage**: 20GB minimum
- **Security Group**: Allow HTTP (80), HTTPS (443), SSH (22)

### Step 3: Configure Security
**Important:**
- RDS security group currently allows 0.0.0.0/0 (all IPs)
- **Recommendation**: Restrict to EC2 security group only
- This improves security while maintaining functionality

## Detailed Steps

### Phase 1: Prepare RDS (30 minutes)

1. **Get RDS Password**
   ```bash
   # Check AWS Secrets Manager
   aws secretsmanager list-secrets
   
   # OR reset password in AWS Console
   # RDS → database-1 → Modify → Master password
   ```

2. **Test Connection Locally**
   ```bash
   # Test from your local machine
   psql -h database-1.cbsy0008u62v.us-east-1.rds.amazonaws.com \
        -U postgres \
        -d postgres
   ```

3. **Verify Compatibility**
   - PostgreSQL 16.8 should work with your code
   - Test migration script
   - Verify SQL functions work

4. **Migrate Data**
   ```bash
   # Update DATABASE_URL temporarily
   export DATABASE_URL="postgresql://postgres:PASSWORD@database-1.cbsy0008u62v.us-east-1.rds.amazonaws.com:5432/france_renovation"
   
   # Run migration
   python backend/scripts/migrate_json_to_db.py
   ```

### Phase 2: Create EC2 Instance (15 minutes)

1. **Launch EC2 Instance**
   - AMI: Ubuntu 22.04 LTS
   - Instance Type: t3.medium (or t3.large for better performance)
   - Storage: 20GB gp3
   - Security Group: Create new or use existing
   - Key Pair: Use existing or create new

2. **Configure Security Group**
   - Allow SSH (22) from your IP
   - Allow HTTP (80) from anywhere
   - Allow HTTPS (443) from anywhere
   - Allow backend port (8000) from security group only

3. **Update RDS Security Group**
   - Remove 0.0.0.0/0 rule
   - Add rule: Allow port 5432 from EC2 security group

### Phase 3: Deploy Application (1-2 hours)

1. **Set Up EC2**
   - Install Python, Node.js, nginx
   - Clone repository
   - Set up virtual environment

2. **Configure Environment**
   ```bash
   # Production .env
   USE_DATABASE=true
   DATABASE_URL=postgresql://postgres:PASSWORD@database-1.cbsy0008u62v.us-east-1.rds.amazonaws.com:5432/france_renovation
   AGENT_DATABASE_URL=postgresql://agent_user:PASSWORD@database-1.cbsy0008u62v.us-east-1.rds.amazonaws.com:5432/france_renovation
   CORS_ORIGINS=https://yourdomain.com,http://EC2_IP
   ```

3. **Deploy**
   - Build frontend
   - Set up systemd services
   - Configure nginx
   - Start services

## Alternative: Use Existing EC2

If you want to save time, you could:
- Start `llm-fastapi-server` (t3.large - good for production)
- Clean it up for this project
- Deploy application

**Pros**: Faster, already configured
**Cons**: May have old configs, need to clean up

## Cost Estimate

**Current Monthly Costs** (from billing):
- RDS: ~$15-20/month (db.t3.micro)
- EC2: $0 (stopped)
- Other: ~$5-10/month

**With New EC2**:
- RDS: ~$15-20/month (existing)
- EC2 t3.medium: ~$30/month
- EC2 t3.large: ~$60/month
- **Total**: ~$45-80/month

## Timeline

- **Phase 1 (RDS)**: 30 minutes
- **Phase 2 (EC2)**: 15 minutes
- **Phase 3 (Deploy)**: 1-2 hours
- **Total**: 2-3 hours

## Risk Assessment

**Low Risk:**
- Using existing RDS (already tested)
- PostgreSQL 16.8 is compatible
- Can rollback easily

**Medium Risk:**
- Security group changes (need to be careful)
- Data migration (backup first)

**Mitigation:**
- Test everything locally first
- Backup RDS before migration
- Test connection before deploying
- Have rollback plan ready

## Final Recommendation

**✅ Use Existing RDS + Create New EC2**

This gives you:
- Quick deployment (use existing RDS)
- Clean setup (new EC2)
- Cost effective (RDS already running)
- Secure (can fix security groups)
- Professional (proper setup)

**Next Step**: I can help you:
1. Get/reset RDS password
2. Test RDS connection
3. Create EC2 instance
4. Set up deployment

Which would you like to start with?


