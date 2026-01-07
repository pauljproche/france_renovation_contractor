# Pre-Phase 3 Checklist

Before starting Phase 3 (Dual-Write Implementation), the following items should be completed:

## ✅ Completed

### Phase 2 Scripts Created
- ✅ Migration script (`migrate_json_to_db.py`)
- ✅ Export helper (`export_localStorage_data.js`)
- ✅ Validation script (`validate_migration.py`)
- ✅ Reverse migration script (`migrate_db_to_json.py`)
- ✅ Documentation (`backend/scripts/README.md`)

### Phase 1 Complete
- ✅ Database schema created
- ✅ Alembic migrations applied
- ✅ SQLAlchemy models synced
- ✅ Docker PostgreSQL running

## ⏳ Required Before Phase 3

### 1. **Test & Execute Data Migration** ⚠️ CRITICAL

The migration scripts are created, but **data must actually be migrated to the database** before Phase 3.

**Steps:**

#### Step 1.1: Export localStorage Data
1. Open your application in browser
2. Open browser console (F12 or Cmd+Option+I)
3. Copy-paste content from `backend/scripts/export_localStorage_data.js`
4. Run:
   ```javascript
   const data = exportLocalStorageData();
   ```
5. Save exports:
   ```javascript
   // Save projects
   console.log(JSON.stringify(data.projects, null, 2));
   // Copy output and save to: data/projects_export.json
   
   // Save workers
   console.log(JSON.stringify(data.workers, null, 2));
   // Copy output and save to: data/workers_export.json
   ```

#### Step 1.2: Verify Docker PostgreSQL is Running
```bash
# Check if container is running
docker ps | grep france-renovation-db

# If not running, start it:
./scripts/setup_docker_db.sh start
# OR
docker start france-renovation-db
```

#### Step 1.3: Run Dry-Run Migration
```bash
cd /Users/emmanuelroche/programming_progs/france_renovation_contractor

python backend/scripts/migrate_json_to_db.py \
    --projects-file data/projects_export.json \
    --workers-file data/workers_export.json \
    --dry-run
```

**Review output:**
- Check for any errors or warnings
- Verify counts look reasonable
- Check for "Could not find project for chantier" warnings (acceptable if projects don't exist)

#### Step 1.4: Run Actual Migration
```bash
python backend/scripts/migrate_json_to_db.py \
    --projects-file data/projects_export.json \
    --workers-file data/workers_export.json
```

#### Step 1.5: Validate Migration
```bash
python backend/scripts/validate_migration.py \
    --projects-file data/projects_export.json \
    --workers-file data/workers_export.json
```

**Expected Results:**
- ✅ No errors (some warnings may be acceptable)
- ✅ Counts match or are close (warnings for nullable fields are OK)
- ✅ All critical data migrated

#### Step 1.6: Verify in Database (Optional but Recommended)

Using pgAdmin or `psql`:
```sql
-- Check counts
SELECT COUNT(*) FROM sections;
SELECT COUNT(*) FROM items;
SELECT COUNT(*) FROM projects WHERE is_demo = FALSE;
SELECT COUNT(*) FROM workers;
SELECT COUNT(*) FROM worker_jobs;

-- Spot check some data
SELECT * FROM sections LIMIT 5;
SELECT * FROM items LIMIT 5;
SELECT * FROM projects WHERE is_demo = FALSE LIMIT 5;
```

### 2. **Verify Environment Setup**

#### 2.1: Database Connection
- ✅ Docker PostgreSQL container running
- ✅ Database schema applied (Phase 1)
- ✅ Connection string in `.env` (if needed):
  ```
  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/france_renovation
  ```

#### 2.2: Python Dependencies
```bash
cd backend
pip install -r requirements.txt
# Should include: sqlalchemy, psycopg2-binary, alembic
```

### 3. **Optional: Test Reverse Migration**

To verify backup/rollback capability:
```bash
python backend/scripts/migrate_db_to_json.py --output-dir data/backup_test

# Compare with original files (materials.json should be similar)
# Note: Some differences are expected (formatting, null handling)
```

## ⚠️ Critical Dependencies for Phase 3

Phase 3 **requires** migrated data in the database because:
1. API endpoints will read from database
2. Dual-write will compare DB vs JSON
3. Frontend will call APIs that query database
4. Testing Phase 3 requires data to be present

**Without migrated data:**
- Phase 3 API endpoints will return empty results
- Frontend will have no data to display
- Testing will be impossible

## Quick Start Command Summary

```bash
# 1. Ensure Docker is running
docker start france-renovation-db

# 2. Export localStorage (in browser console)
# (See Step 1.1 above)

# 3. Run migration
python backend/scripts/migrate_json_to_db.py \
    --projects-file data/projects_export.json \
    --workers-file data/workers_export.json

# 4. Validate
python backend/scripts/validate_migration.py \
    --projects-file data/projects_export.json \
    --workers-file data/workers_export.json
```

## If You Skip Testing

**Risk:** Phase 3 implementation will be harder to test and debug because:
- Empty database = empty API responses
- Can't verify dual-write is working
- Can't test frontend integration properly

**Recommendation:** At minimum, run the migration with at least materials data (which doesn't require localStorage export). This gives you something to work with in Phase 3.

## Ready for Phase 3 When:

- ✅ Data migrated to database
- ✅ Validation script shows no critical errors
- ✅ Database has data (can verify with `SELECT COUNT(*) FROM items;`)
- ✅ Docker PostgreSQL running
- ✅ Python dependencies installed

---

**Status:** ⏳ Waiting for data migration execution

**Next:** Once migration is complete, proceed to Phase 3: Dual-Write Implementation




