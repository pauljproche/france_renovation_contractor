# [Migration] feature/db-migration-data-import: Phase 2 Data Migration

## Phases Included
- Phase 2: Data Migration Script

## Changes Summary

### Created Migration Scripts
- ✅ **`backend/scripts/migrate_json_to_db.py`** - Main migration script
  - Migrates materials, projects, workers, edit history from JSON/localStorage to PostgreSQL
  - Handles all data mappings (French→English, roles, statuses, etc.)
  - Supports dry-run mode for safe testing
  - Auto-creates default user for single-user system
  - Graceful handling of missing/mismatched data

- ✅ **`backend/scripts/export_localStorage_data.js`** - Browser export helper
  - Allows users to export localStorage data (projects, workers) via browser console
  - Simple copy-paste script for data export

- ✅ **`backend/scripts/validate_migration.py`** - Validation script
  - Compares source JSON data with database records
  - Validates counts for all migrated entities
  - Reports errors and warnings

- ✅ **`backend/scripts/migrate_db_to_json.py`** - Reverse migration script
  - Exports database data back to JSON format
  - Useful for backup/rollback purposes

- ✅ **`backend/scripts/README.md`** - Complete documentation
  - Usage instructions for all scripts
  - Migration workflow guide
  - Troubleshooting tips

### Documentation Updates
- ✅ **`docs/database_schema.sql`** - Reordered tables to match migration creation order
- ✅ **`PHASE2_COMPLETION.md`** - Phase 2 completion summary

## Data Migration Coverage

### ✅ Materials Data
- Sections → `sections` table
- Items → `items` table
- Approvals (client/contractor) → `approvals` table
- Replacement URLs → `replacement_urls` table
- Orders → `orders` table
- Comments (client/contractor) → `comments` table

### ✅ Projects Data
- Projects → `projects` table (excludes demo projects)
- Project members → `project_members` table
- Quotes → `quotes` table (from devisStatus)

### ✅ Workers Data
- Workers → `users` + `workers` tables (one-to-one relationship)
- Worker jobs → `worker_jobs` table

### ✅ Edit History
- Edit history entries → `edit_history` table

## Key Features

### Smart Data Mappings
- Labor types: French strings → English enum values
- Approval status: "alternative" → "change_order"
- Role: "cray" → "contractor"
- Delivery status, project status, quote status mappings

### Safety Features
- Dry-run mode (`--dry-run` flag)
- Transaction rollback on errors
- Detailed logging and warnings
- Validation script to verify correctness
- Reverse migration for backup/rollback

### Data Integrity
- Foreign key relationships maintained
- Default user creation (`migration-user`)
- Project mapping via chantier names
- Graceful handling of missing data

## Testing

### Manual Testing Performed
- ✅ Scripts compile without syntax errors
- ✅ Import paths validated
- ✅ Data mapping functions tested (in code review)

### Testing Checklist
- [ ] Export localStorage data (projects + workers)
- [ ] Run dry-run migration
- [ ] Review dry-run output
- [ ] Run actual migration
- [ ] Run validation script
- [ ] Verify counts in database (pgAdmin/psql)
- [ ] Test reverse migration (backup)

## Breaking Changes
None - This is a migration script, doesn't affect existing code.

## Next Steps
After this PR is merged:
1. Test migration with actual data
2. Proceed to Phase 3: Dual-Write Implementation
   - Create API endpoints for projects/workers
   - Update frontend contexts to call APIs
   - Implement dual-write (DB + JSON during transition)

## Notes
- Demo projects/workers are automatically skipped (they're frontend constants)
- Default user (`migration-user`) is created automatically if needed
- Items with unmatched chantier names will have `section.project_id = NULL` (warning logged)
- Edit history entries for non-existent items are skipped (warning logged)

## Related Documentation
- `backend/scripts/README.md` - Complete usage guide
- `MIGRATION_PLAN.md` - Overall migration strategy
- `PHASE2_COMPLETION.md` - Phase 2 summary
