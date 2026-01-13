# Daily Cron Job Setup for JSON Backup

**Phase 6**: JSON is updated via daily export, not during writes.

---

## Local Development (Testing)

To test the backup script manually:

```bash
cd /Users/emmanuelroche/programming_progs/france_renovation_contractor
./scripts/backup_to_json.sh
```

This will export the database to `data/materials.json` and other JSON files.

---

## AWS EC2 Deployment

### Step 1: Ensure Script is Deployed

The script should already be in your repository. After deploying to AWS:

```bash
# SSH into EC2
ssh -i ~/.ssh/llm-fastapi-key.pem ubuntu@3.236.203.206

# Verify script exists
ls -la /opt/france-renovation/scripts/backup_to_json.sh

# Make sure it's executable
chmod +x /opt/france-renovation/scripts/backup_to_json.sh
```

### Step 2: Test Script Manually

Test the script before setting up cron:

```bash
cd /opt/france-renovation
./scripts/backup_to_json.sh
```

Expected output:
```
[2026-01-XX XX:XX:XX] Starting JSON backup export...
Exporting materials...
✅ Exported materials to: data/materials.json
   Sections: 3
   Items: 17
...
[2026-01-XX XX:XX:XX] ✅ JSON backup export completed successfully
```

### Step 3: Set Up Cron Job

Edit crontab:

```bash
crontab -e
```

Add this line (runs daily at 2 AM):

```bash
0 2 * * * /opt/france-renovation/scripts/backup_to_json.sh >> /opt/france-renovation/logs/backup.log 2>&1
```

**Explanation**:
- `0 2 * * *` = Daily at 2:00 AM
- `>> /opt/france-renovation/logs/backup.log` = Append output to log file
- `2>&1` = Include errors in log file

### Step 4: Verify Cron Job

```bash
# View crontab
crontab -l

# Check logs (after it runs)
tail -f /opt/france-renovation/logs/backup.log
```

### Step 5: Test Cron Job (Optional)

To test immediately without waiting for 2 AM:

```bash
# Run the script manually
/opt/france-renovation/scripts/backup_to_json.sh

# Or test cron syntax (runs every minute for testing)
# Edit crontab and change to: * * * * * (then change back after testing)
```

---

## Cron Schedule Options

Common schedules:

- `0 2 * * *` - Daily at 2:00 AM (recommended)
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Weekly on Sunday at midnight
- `0 2 * * 1-5` - Weekdays only at 2:00 AM

---

## Monitoring

### Check Logs

```bash
# View recent backup logs
tail -n 50 /opt/france-renovation/logs/backup.log

# Watch logs in real-time
tail -f /opt/france-renovation/logs/backup.log
```

### Verify JSON Files Updated

```bash
# Check JSON file timestamp
ls -la /opt/france-renovation/data/materials.json

# Should show recent modification time (after cron runs)
```

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
   # Should show: USE_DATABASE=true
   ```

3. **Check database connection**:
   ```bash
   cd /opt/france-renovation/backend
   source venv/bin/activate
   python3 -c "from db_session import db_readonly_session; from services import materials_service; session = db_readonly_session().__enter__(); print('DB OK')"
   ```

4. **Check logs**:
   ```bash
   tail -n 100 /opt/france-renovation/logs/backup.log
   ```

### Cron Not Running

1. **Check cron service**:
   ```bash
   sudo systemctl status cron
   # Or on some systems:
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

---

## Summary

✅ **Phase 6 Complete**: Database-only writes  
✅ **Backup Script**: `scripts/backup_to_json.sh`  
✅ **Cron Job**: Daily at 2 AM  
✅ **Logs**: `/opt/france-renovation/logs/backup.log`

The JSON file will be updated daily via cron job, providing a relatively fresh backup while keeping writes fast and simple.
