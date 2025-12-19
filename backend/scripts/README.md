# Phase 2: Data Migration Scripts

This directory contains scripts for migrating data from JSON files and localStorage to PostgreSQL (Phase 2 of the database migration).

## Scripts

### 1. `migrate_json_to_db.py` - Main Migration Script

Migrates data from JSON files and localStorage exports to PostgreSQL.

**Usage:**
```bash
# Dry run (no database changes)
python backend/scripts/migrate_json_to_db.py --dry-run

# Full migration (requires projects/workers files)
python backend/scripts/migrate_json_to_db.py \
    --projects-file data/projects_export.json \
    --workers-file data/workers_export.json

# Migrate only materials (no projects/workers files needed)
python backend/scripts/migrate_json_to_db.py
```

**What it migrates:**
- ✅ Materials data (`data/materials.json`) → sections, items, approvals, orders, comments, replacement_urls
- ✅ Projects data (from JSON export) → projects, project_members, quotes
- ✅ Workers data (from JSON export) → users, workers, worker_jobs
- ✅ Edit history (`data/edit-history.json`) → edit_history

**Requirements:**
- Docker PostgreSQL must be running
- Database schema must be created (Phase 1 complete)
- `USE_DATABASE` environment variable not required (migration is independent)

**Options:**
- `--projects-file PATH`: Path to projects JSON file (exported from localStorage)
- `--workers-file PATH`: Path to workers JSON file (exported from localStorage)
- `--dry-run`: Perform dry run without committing changes

### 2. `export_localStorage_data.js` - Browser Export Script

Browser console script to export localStorage data for migration.

**Usage:**
1. Open your application in browser
2. Open browser console (F12 or Cmd+Option+I)
3. Copy-paste the entire script from `export_localStorage_data.js`
4. Run:
   ```javascript
   const data = exportLocalStorageData();
   ```
5. Copy the output JSON:
   ```javascript
   // For projects
   console.log(JSON.stringify(data.projects, null, 2));
   // Copy output and save to: data/projects_export.json
   
   // For workers
   console.log(JSON.stringify(data.workers, null, 2));
   // Copy output and save to: data/workers_export.json
   ```

**What it exports:**
- Projects from `localStorage.getItem('renovationProjects')`
- Workers from `localStorage.getItem('workers')`

**Note:** Demo projects/workers are included in the export but will be automatically skipped by the migration script.

### 3. `validate_migration.py` - Validation Script

Validates that migration was successful by comparing source data with database.

**Usage:**
```bash
# Validate materials only
python backend/scripts/validate_migration.py

# Validate all data types
python backend/scripts/validate_migration.py \
    --projects-file data/projects_export.json \
    --workers-file data/workers_export.json
```

**What it validates:**
- Section count matches JSON
- Item count matches JSON
- Approval count matches JSON (with warnings for nullable statuses)
- Order count matches JSON
- Replacement URL count matches JSON
- Comment count matches JSON
- Project count matches (excluding demos)
- Worker count matches (excluding demos)
- Worker job count matches
- Edit history count matches

**Output:**
- ✅ Success: Count matches
- ⚠️ Warning: Count mismatch (may be acceptable, e.g., null approvals not migrated)
- ❌ Error: Critical mismatch (should be fixed)

### 4. `migrate_db_to_json.py` - Reverse Migration Script

Exports database data back to JSON format (for backup/rollback).

**Usage:**
```bash
python backend/scripts/migrate_db_to_json.py --output-dir data/exported
```

**What it exports:**
- `materials.json`: Materials data in original JSON format
- `projects.json`: Projects data (excluding demos)
- `workers.json`: Workers data (excluding demos)
- `edit-history.json`: Edit history (note: `item_index` cannot be reconstructed)

**Output files:**
- `{output-dir}/materials.json`
- `{output-dir}/projects.json`
- `{output-dir}/workers.json`
- `{output-dir}/edit-history.json`

## Migration Workflow

### Step 1: Export localStorage Data

1. Open your application in browser
2. Run `export_localStorage_data.js` in browser console
3. Save projects export to `data/projects_export.json`
4. Save workers export to `data/workers_export.json`

### Step 2: Dry Run Migration

```bash
python backend/scripts/migrate_json_to_db.py \
    --projects-file data/projects_export.json \
    --workers-file data/workers_export.json \
    --dry-run
```

Review the output to ensure everything looks correct.

### Step 3: Run Migration

```bash
python backend/scripts/migrate_json_to_db.py \
    --projects-file data/projects_export.json \
    --workers-file data/workers_export.json
```

### Step 4: Validate Migration

```bash
python backend/scripts/validate_migration.py \
    --projects-file data/projects_export.json \
    --workers-file data/workers_export.json
```

### Step 5: Verify in Database

Use pgAdmin or `psql` to verify data:
```sql
-- Check counts
SELECT COUNT(*) FROM sections;
SELECT COUNT(*) FROM items;
SELECT COUNT(*) FROM projects WHERE is_demo = FALSE;
SELECT COUNT(*) FROM workers;
```

## Notes

### Demo Data

- **Demo projects** (hardcoded in `ProjectsContext.jsx`) are **NOT** migrated
- **Demo workers** (hardcoded in `WorkersContext.jsx`) are **NOT** migrated
- These remain as frontend constants and don't need database storage

### Data Mappings

**Labor Type Mapping:**
- French strings → English enum values
- Example: "Démolition & Dépose" → `WorkTypeEnum.DEMOLITION`
- See `map_labor_type_to_enum()` function

**Approval Status Mapping:**
- `"alternative"` → `ApprovalStatusEnum.CHANGE_ORDER`
- `"approved"` → `ApprovalStatusEnum.APPROVED`
- etc.

**Role Mapping:**
- JSON: `"cray"` → Database: `"contractor"`

### Project Mapping

The migration script creates a mapping from chantier name (from materials JSON) to project_id. This mapping is used to link:
- Items to projects (via `sections.project_id`)
- Worker jobs to projects (via `worker_jobs.project_id`)

**Important:** Items with chantier names that don't match any project will have `section.project_id = NULL`.

### Default User

A default user (`migration-user`) is created automatically if it doesn't exist. This user:
- Is set as the owner of all migrated projects
- Is used for edit history entries (when `user_id` is not available)
- Has role: `CONTRACTOR`

## Troubleshooting

### Error: "Could not find project for chantier 'X'"
- This warning means an item or worker job references a chantier name that doesn't match any project
- The item/job will still be created but won't be linked to a project
- To fix: Ensure all chantier names in materials match project addresses/names

### Error: "Could not find item for section 'X' index Y"
- This warning means edit history references an item that couldn't be found
- Usually happens if items were reordered or deleted after edit history was created
- These entries are skipped

### Validation Warnings
- Warnings (not errors) are often acceptable
- Example: Null approval statuses are not migrated (only non-null statuses create approval records)
- Review warnings but don't worry unless they indicate data loss

## Next Steps

After successful migration:
1. ✅ Data is in database
2. ⏭️ Proceed to Phase 3: Dual-Write Implementation
3. Phase 3 will add API endpoints and frontend integration
