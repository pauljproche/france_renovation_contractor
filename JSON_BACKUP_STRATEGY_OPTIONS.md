# JSON Backup Strategy Options

## The Question

**After Phase 6 (removing dual-write), what happens to JSON?**

You have **3 options**:

---

## Option 1: Never Write to JSON Again ❌

**Strategy**: JSON becomes a stale migration snapshot, never updated.

**Pros**:
- ✅ Simplest (no code changes needed)
- ✅ Fastest writes (no JSON overhead)
- ✅ No sync issues

**Cons**:
- ❌ JSON becomes outdated immediately
- ❌ Only useful as migration artifact
- ❌ Not useful for emergency fallback after a few days

**When to use**: If you're confident in database backups and don't need JSON fallback.

---

## Option 2: Periodic Export (Recommended) ✅

**Strategy**: Periodically export database to JSON (e.g., daily cron job).

**Implementation**:
```bash
# Daily cron job (runs at 2 AM)
0 2 * * * cd /opt/france-renovation && python backend/scripts/migrate_db_to_json.py --output-dir data/
```

**Pros**:
- ✅ JSON stays relatively fresh (daily updates)
- ✅ No write overhead during normal operations
- ✅ Useful emergency fallback
- ✅ Can be automated

**Cons**:
- ⚠️ JSON can be up to 24 hours old
- ⚠️ Need to set up cron job
- ⚠️ Takes a few seconds to run

**When to use**: Best balance of performance and safety.

---

## Option 3: On-Demand Export 🔧

**Strategy**: Export JSON manually when needed (or via API endpoint).

**Implementation Options**:

### A. Manual Export Script
```bash
# Run when you want a backup
python backend/scripts/migrate_db_to_json.py --output-dir data/
```

### B. API Endpoint
```python
# Add to backend/main.py
@app.post("/api/admin/export-to-json")
def export_to_json():
    """Export current database state to JSON files."""
    # Run migrate_db_to_json.py logic
    # Return success/failure
```

**Pros**:
- ✅ Full control over when backups happen
- ✅ No automatic overhead
- ✅ Can trigger before important operations

**Cons**:
- ❌ Easy to forget
- ❌ Manual process
- ❌ JSON can be very stale if not run regularly

**When to use**: If you want control and don't mind manual process.

---

## Comparison

| Option | JSON Freshness | Write Performance | Complexity | Usefulness |
|--------|---------------|------------------|------------|------------|
| **Never Write** | ❌ Stale immediately | ✅ Fastest | ✅ Simplest | ❌ Useless after migration |
| **Periodic Export** | ⚠️ Up to 24h old | ✅ Fast (no write overhead) | ⚠️ Need cron | ✅ Useful fallback |
| **On-Demand** | ⚠️ Varies (can be stale) | ✅ Fast (no write overhead) | ✅ Simple | ⚠️ Depends on usage |

---

## Recommendation: Option 2 (Periodic Export)

**Why**: Best balance of performance, safety, and usefulness.

**Setup**:

1. **Remove dual-write** (Phase 6)
   - Writes go to database only
   - No JSON writes during normal operations

2. **Add periodic export**:
   ```bash
   # Create backup script
   cat > scripts/backup_to_json.sh << 'EOF'
   #!/bin/bash
   cd /opt/france-renovation
   source backend/venv/bin/activate
   python backend/scripts/migrate_db_to_json.py --output-dir data/
   EOF
   
   chmod +x scripts/backup_to_json.sh
   
   # Add to crontab (daily at 2 AM)
   crontab -e
   # Add: 0 2 * * * /opt/france-renovation/scripts/backup_to_json.sh >> /opt/france-renovation/logs/backup.log 2>&1
   ```

3. **Keep read fallback**:
   - `load_materials_data()` still falls back to JSON if DB fails
   - JSON is now updated daily, not real-time

**Result**:
- ✅ Fast writes (database only)
- ✅ JSON updated daily (useful fallback)
- ✅ Simple code (no dual-write complexity)
- ✅ Emergency fallback available (even if 24h old)

---

## Alternative: Hybrid Approach

**Strategy**: Periodic export + on-demand API endpoint

- Daily automatic export (cron)
- API endpoint for manual exports when needed
- Best of both worlds

**Implementation**:
```python
# Add to backend/main.py
@app.post("/api/admin/export-to-json")
async def export_to_json():
    """Manually trigger JSON export."""
    try:
        # Run export logic
        from backend.scripts.migrate_db_to_json import export_materials
        from backend.db_session import db_readonly_session
        
        with db_readonly_session() as session:
            export_materials(session, Path("data"))
        
        return {"status": "success", "message": "JSON export completed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

## For AWS Deployment

**On AWS EC2**, you can set up the cron job:

```bash
# SSH into EC2
ssh -i ~/.ssh/llm-fastapi-key.pem ubuntu@3.236.203.206

# Create backup script
nano /opt/france-renovation/scripts/backup_to_json.sh
# (paste script content)

# Make executable
chmod +x /opt/france-renovation/scripts/backup_to_json.sh

# Add to crontab
crontab -e
# Add: 0 2 * * * /opt/france-renovation/scripts/backup_to_json.sh >> /opt/france-renovation/logs/backup.log 2>&1
```

---

## Summary

**Your question**: "Will JSON become stale and useless, or write to it once in a while?"

**Answer**: 
- ✅ **Option 2 (Periodic Export)** is recommended
- ✅ JSON stays relatively fresh (daily updates)
- ✅ No write overhead during normal operations
- ✅ Useful emergency fallback
- ✅ Can be automated with cron

**Next Steps**:
1. Proceed with Phase 6 (remove dual-write)
2. Set up periodic export (daily cron job)
3. Keep read fallback for emergencies

This gives you the best of both worlds: fast writes + useful backup!
