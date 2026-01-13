# AWS Cron Job Setup - Step by Step

**Purpose**: Set up daily JSON backup on AWS EC2  
**Duration**: ~10 minutes

---

## Prerequisites

- SSH access to AWS EC2
- EC2 IP: `3.236.203.206`
- SSH Key: `~/.ssh/llm-fastapi-key.pem`
- User: `ubuntu`

---

## Step 1: SSH into AWS EC2

```bash
ssh -i ~/.ssh/llm-fastapi-key.pem ubuntu@3.236.203.206
```

---

## Step 2: Navigate to Project Directory

```bash
cd /opt/france-renovation
```

---

## Step 3: Verify Script Exists

```bash
ls -la scripts/backup_to_json.sh
```

**Expected**: Script should exist and be executable

If not executable:
```bash
chmod +x scripts/backup_to_json.sh
```

---

## Step 4: Verify USE_DATABASE is Enabled

```bash
grep USE_DATABASE backend/.env
```

**Expected**: Should show `USE_DATABASE=true`

If not set:
```bash
echo "USE_DATABASE=true" >> backend/.env
```

---

## Step 5: Test Script Manually (IMPORTANT)

Test the script before setting up cron:

```bash
cd /opt/france-renovation
./scripts/backup_to_json.sh
```

**Expected Output**:
```
[2026-01-XX XX:XX:XX] Starting JSON backup export...
Exporting materials...
✅ Exported materials to: data/materials.json
   Sections: 3
   Items: 17
...
[2026-01-XX XX:XX:XX] ✅ JSON backup export completed successfully
```

**If it fails**, check:
- Database connection: `grep DATABASE_URL backend/.env`
- Virtual environment: `ls -la venv/bin/activate` or `ls -la backend/venv/bin/activate`
- Python dependencies: `source venv/bin/activate && pip list | grep sqlalchemy`

---

## Step 6: Verify Logs Directory Exists

```bash
mkdir -p logs
ls -la logs/
```

---

## Step 7: Set Up Cron Job

Edit crontab:
```bash
crontab -e
```

**If prompted to choose editor**, choose `nano` (easiest).

Add this line at the end of the file:
```bash
0 2 * * * /opt/france-renovation/scripts/backup_to_json.sh >> /opt/france-renovation/logs/backup.log 2>&1
```

**Explanation**:
- `0 2 * * *` = Daily at 2:00 AM UTC
- `>>` = Append output to log file
- `2>&1` = Include errors in log file

**Save and exit**:
- In nano: Press `Ctrl+X`, then `Y`, then `Enter`

---

## Step 8: Verify Cron Job is Set

```bash
crontab -l
```

**Expected**: Should show the line you just added

---

## Step 9: Test Cron Job Immediately (Optional)

To test without waiting for 2 AM, you can:

**Option A**: Run script manually again
```bash
/opt/france-renovation/scripts/backup_to_json.sh
```

**Option B**: Temporarily change cron to run every minute (for testing)
```bash
crontab -e
# Change to: * * * * * (runs every minute)
# Wait 2 minutes, then change back to: 0 2 * * *
```

---

## Step 10: Monitor Logs

Check backup log:
```bash
tail -f /opt/france-renovation/logs/backup.log
```

After cron runs (or manually), verify:
```bash
tail -n 50 /opt/france-renovation/logs/backup.log
```

---

## Step 11: Verify JSON File Updated

```bash
ls -la /opt/france-renovation/data/materials.json
```

**Expected**: Should show recent modification time

---

## Troubleshooting

### Script Fails

1. **Check permissions**:
   ```bash
   chmod +x /opt/france-renovation/scripts/backup_to_json.sh
   ```

2. **Check USE_DATABASE**:
   ```bash
   grep USE_DATABASE /opt/france-renovation/backend/.env
   ```

3. **Check database connection**:
   ```bash
   cd /opt/france-renovation/backend
   source ../venv/bin/activate
   python3 -c "from db_session import db_readonly_session; session = db_readonly_session().__enter__(); print('DB OK')"
   ```

4. **Check logs**:
   ```bash
   tail -n 100 /opt/france-renovation/logs/backup.log
   ```

### Cron Not Running

1. **Check cron service**:
   ```bash
   sudo systemctl status cron
   # Or on Amazon Linux:
   sudo systemctl status crond
   ```

2. **Check cron logs**:
   ```bash
   # Ubuntu/Debian
   grep CRON /var/log/syslog | tail -20
   
   # Amazon Linux
   sudo tail -f /var/log/cron
   ```

3. **Verify crontab**:
   ```bash
   crontab -l
   ```

### Virtual Environment Issues

If script can't find Python packages:

1. **Find virtual environment**:
   ```bash
   ls -la /opt/france-renovation/venv/bin/activate
   ls -la /opt/france-renovation/backend/venv/bin/activate
   ```

2. **Update script** if venv is in different location:
   ```bash
   nano /opt/france-renovation/scripts/backup_to_json.sh
   # Update venv path if needed
   ```

---

## Verification Checklist

- [ ] Script exists and is executable
- [ ] `USE_DATABASE=true` is set
- [ ] Script runs manually without errors
- [ ] Cron job is scheduled (`crontab -l`)
- [ ] Logs directory exists
- [ ] JSON file is updated after script runs
- [ ] Backup log shows success

---

## Summary

✅ **Cron Job**: Daily at 2 AM UTC  
✅ **Script**: `/opt/france-renovation/scripts/backup_to_json.sh`  
✅ **Logs**: `/opt/france-renovation/logs/backup.log`  
✅ **Output**: `/opt/france-renovation/data/materials.json`

The JSON file will be updated daily via cron job, providing a relatively fresh backup while keeping writes fast and simple.
