# Migration Checklist

Use this checklist to track your progress through the migration phases.

## Phase 0: Preparation & Setup
- [ ] PostgreSQL installed and running
- [ ] Database `france_renovation` created
- [ ] Dependencies added to `requirements.txt` (sqlalchemy, psycopg2-binary, alembic)
- [ ] Environment variables configured (DATABASE_URL, USE_DATABASE)
- [ ] `backend/database.py` created (connection pool)
- [ ] `backend/models.py` created (SQLAlchemy models)
- [ ] `backend/db_session.py` created (session management)
- [ ] Feature flag `USE_DATABASE` implemented
- [ ] Can connect to database successfully

## Phase 1: Schema Design & Models
- [ ] Database schema designed
- [ ] Tables created: sections, items, approvals, replacement_urls, orders, comments, edit_history, custom_fields
- [ ] Foreign key constraints added
- [ ] Indexes created for performance
- [ ] SQLAlchemy models defined in `backend/models.py`
- [ ] Alembic initialized
- [ ] Initial migration created
- [ ] Migration applied successfully
- [ ] Models can be imported without errors

## Phase 2: Data Migration Script
- [ ] `backend/scripts/migrate_json_to_db.py` created
- [ ] Script reads `data/materials.json` correctly
- [ ] Script transforms JSON to database records
- [ ] All sections migrated
- [ ] All items migrated
- [ ] All approvals migrated
- [ ] All replacement URLs migrated
- [ ] All orders migrated
- [ ] All comments migrated
- [ ] Validation script created
- [ ] Data integrity verified (counts match)
- [ ] Reverse migration script created (`migrate_db_to_json.py`)
- [ ] Reverse migration tested (produces identical JSON)

## Phase 3: Dual-Write Implementation
- [ ] `backend/services/materials_service.py` created
- [ ] `get_materials()` function implemented
- [ ] `update_item()` function implemented
- [ ] `create_item()` function implemented
- [ ] `load_materials_data()` updated to check `USE_DATABASE` flag
- [ ] `write_materials_data()` updated for dual-write
- [ ] `update_cell()` function updated for dual-write
- [ ] `log_edit()` function updated for dual-write
- [ ] All API endpoints support dual-write
- [ ] Test: Write to JSON, verify DB updated
- [ ] Test: Write to DB, verify JSON updated
- [ ] Test: Read from DB when flag is on
- [ ] Test: Read from JSON when flag is off
- [ ] Test suite passes

## Phase 4: Read from Database
- [ ] `USE_DATABASE=true` set in environment
- [ ] All reads come from PostgreSQL
- [ ] Writes still go to both (dual-write active)
- [ ] Performance tested (acceptable)
- [ ] Frontend works correctly
- [ ] API endpoints return data from DB
- [ ] Test suite passes
- [ ] Can rollback to JSON if needed (tested)

## Phase 5: SQL Functions for Agent Tools
- [ ] SQL function: `get_items_needing_validation(role)` created
- [ ] SQL function: `get_todo_items(role)` created
- [ ] SQL function: `update_item_approval(item_id, role, status)` created
- [ ] SQL function: `add_replacement_url(item_id, role, url)` created
- [ ] SQL function: `remove_replacement_url(item_id, role, url)` created
- [ ] SQL function: `get_pricing_summary()` created
- [ ] SQL function: `get_items_by_section(section_id)` created
- [ ] `backend/services/agent_tools.py` created
- [ ] Agent tool wrappers implemented
- [ ] System prompt updated (document SQL functions)
- [ ] Agent query handler updated
- [ ] Agent uses SQL functions instead of JSON parsing
- [ ] Test: Agent can query using SQL functions
- [ ] Test: All agent operations work correctly
- [ ] Test suite passes with SQL functions

## Phase 6: Remove JSON Writes (DB-Only Writes)
- [ ] `write_materials_data()` updated to write DB only
- [ ] JSON writes removed from all functions
- [ ] Database transactions implemented
- [ ] Error handling with rollback
- [ ] All API endpoints write to DB only
- [ ] Test: Writes go to DB only
- [ ] Test: JSON file is not modified
- [ ] Test: Transactions work correctly
- [ ] Test: Rollback works on errors
- [ ] JSON file kept as read-only backup

## Phase 7: Remove JSON Reads (DB-Only)
- [ ] `USE_DATABASE` flag removed (or always true)
- [ ] `load_materials_data()` JSON implementation removed
- [ ] `write_materials_data()` JSON implementation removed
- [ ] JSON file paths removed from code
- [ ] All reads come from database
- [ ] Application works without JSON files
- [ ] Test suite passes
- [ ] No references to JSON files in code

## Phase 8: Testing & Optimization
- [ ] Test suite updated to use database
- [ ] Database fixtures created
- [ ] Test isolation using transactions
- [ ] Slow queries identified
- [ ] Missing indexes added
- [ ] SQL functions optimized
- [ ] Load testing completed
- [ ] Performance is acceptable
- [ ] Security review completed
- [ ] Role-based access verified
- [ ] SQL injection prevention verified

## Phase 9: Production Deployment
- [ ] Production PostgreSQL set up
- [ ] Backups configured
- [ ] Replication set up (if needed)
- [ ] Production data migrated
- [ ] Data integrity verified
- [ ] All functionality tested in production
- [ ] Database monitoring configured
- [ ] Alerts configured
- [ ] Query performance monitoring set up
- [ ] Deployment documentation updated
- [ ] Database schema documented
- [ ] Runbooks created
- [ ] Rollback plan tested

## Final Verification
- [ ] All data in PostgreSQL
- [ ] JSON files no longer used
- [ ] Agent uses SQL functions
- [ ] Test suite is fast and cheap (no LLM costs)
- [ ] Production is stable
- [ ] Documentation is complete
- [ ] Team trained on new system

---

## Quick Reference

**Rollback Command**: Set `USE_DATABASE=false` in environment

**Check Database Connection**: 
```python
from backend.database import get_db
db = next(get_db())
# Should work without errors
```

**Verify Data Migration**:
```sql
SELECT COUNT(*) FROM items;
-- Should match count in JSON file
```

**Test SQL Functions**:
```sql
SELECT * FROM get_items_needing_validation('client');
-- Should return items needing validation
```

