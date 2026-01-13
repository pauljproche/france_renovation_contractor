# RDS Password Setup

## Step 1: Reset RDS Master Password

You need to reset the RDS master password. Here are your options:

### Option A: AWS Console (Recommended - Easiest)

1. Go to AWS Console → RDS → Databases
2. Click on `database-1`
3. Click "Modify" button
4. Scroll down to "Database authentication"
5. Click "Edit" next to "Master password"
6. Enter a new password (save it securely!)
7. Click "Continue"
8. Choose "Apply immediately"
9. Click "Modify DB instance"

**Wait 2-3 minutes** for the password to be updated.

### Option B: AWS CLI

```bash
# Replace NEW_PASSWORD with your desired password
aws rds modify-db-instance \
  --db-instance-identifier database-1 \
  --master-user-password NEW_PASSWORD \
  --apply-immediately
```

**Note**: The password must be:
- 8-128 characters
- Contains uppercase, lowercase, numbers, and special characters

## Step 2: Save Password Securely

Once you have the password, save it:
- In a password manager
- In AWS Secrets Manager (recommended for production)
- In your production .env file (secure it with chmod 600)

## Step 3: Test Connection

After resetting, test the connection:

```bash
# Test with psql
psql -h database-1.cbsy0008u62v.us-east-1.rds.amazonaws.com \
     -U postgres \
     -d postgres

# Or test with Python
python3 << 'PYTHON'
from sqlalchemy import create_engine
import os

DATABASE_URL = "postgresql://postgres:YOUR_PASSWORD@database-1.cbsy0008u62v.us-east-1.rds.amazonaws.com:5432/postgres"

try:
    engine = create_engine(DATABASE_URL)
    conn = engine.connect()
    print("✅ Connection successful!")
    conn.close()
except Exception as e:
    print(f"❌ Connection failed: {e}")
PYTHON
```

## Next Steps

Once password is set and connection works:
1. Create `france_renovation` database
2. Run Alembic migrations
3. Migrate data
4. Set up agent user role


