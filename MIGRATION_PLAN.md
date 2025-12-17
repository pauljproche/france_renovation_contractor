# PostgreSQL Migration Plan

## Overview

This document outlines the phased migration from JSON file-based storage to PostgreSQL database for the France Renovation Contractor application.

**Goal**: Migrate from `data/materials.json` to PostgreSQL while maintaining zero downtime and backward compatibility during the transition.

**Benefits**:
- Deterministic, fast testing (no LLM costs)
- SQL-based queries for agent tools
- Multi-user support with ACID guarantees
- Production-ready architecture
- Role-based access control

---

## Prerequisites

Before starting:
- [ ] PostgreSQL installed locally (or Docker)
- [ ] Database credentials configured
- [ ] Backup of current `data/materials.json`
- [ ] Understanding of current data structure
- [ ] Test suite passing on current JSON implementation

---

## Phase 0: Preparation & Setup

**Duration**: 2-3 hours  
**Risk**: Low  
**Can Rollback**: Yes (no changes to code)

### Tasks

1. **Database Setup**
   ```bash
   # Create database
   createdb france_renovation
   
   # Or using Docker
   docker run --name france-renovation-db \
     -e POSTGRES_PASSWORD=yourpassword \
     -e POSTGRES_DB=france_renovation \
     -p 5432:5432 \
     -d postgres:15
   ```

2. **Install Dependencies**
   ```bash
   # Add to backend/requirements.txt
   sqlalchemy==2.0.23
   psycopg2-binary==2.9.9
   alembic==1.12.1  # For migrations
   ```

3. **Environment Variables**
   ```bash
   # Add to .env
   DATABASE_URL=postgresql://user:password@localhost:5432/france_renovation
   USE_DATABASE=false  # Feature flag for gradual rollout
   ```

4. **Create Database Connection Module**
   - Create `backend/database.py` with connection pool
   - Create `backend/models.py` with SQLAlchemy models
   - Create `backend/db_session.py` for session management

### Deliverables
- [ ] PostgreSQL database running
- [ ] Database connection module created
- [ ] Environment variables configured
- [ ] Feature flag `USE_DATABASE` implemented

### Testing
- [ ] Can connect to database
- [ ] Connection pooling works
- [ ] Feature flag can toggle between JSON and DB

---

## Phase 1: Schema Design & Models

**Duration**: 3-4 hours  
**Risk**: Medium  
**Can Rollback**: Yes (models don't affect existing code)

### Tasks

1. **Design Database Schema**

   ```sql
   -- Sections table
   CREATE TABLE sections (
       id VARCHAR(50) PRIMARY KEY,
       label VARCHAR(255) NOT NULL,
       project_id VARCHAR(50),
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW()
   );

   -- Items table
   CREATE TABLE items (
       id SERIAL PRIMARY KEY,
       section_id VARCHAR(50) NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
       product TEXT NOT NULL,
       reference VARCHAR(255),
       supplier_link TEXT,
       labor_type VARCHAR(50),
       price_ttc DECIMAL(10, 2),
       price_ht_quote DECIMAL(10, 2),
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW(),
       UNIQUE(section_id, product)  -- Prevent duplicates
   );

   -- Approvals table (normalized)
   CREATE TABLE approvals (
       id SERIAL PRIMARY KEY,
       item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
       role VARCHAR(50) NOT NULL,  -- 'client' or 'cray'
       status VARCHAR(50),  -- 'approved', 'rejected', 'change_order', 'pending', null
       note TEXT,
       validated_at TIMESTAMP,
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW(),
       UNIQUE(item_id, role)  -- One approval per role per item
   );

   -- Replacement URLs (separate table for arrays)
   CREATE TABLE replacement_urls (
       id SERIAL PRIMARY KEY,
       approval_id INTEGER NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
       url TEXT NOT NULL,
       created_at TIMESTAMP DEFAULT NOW()
   );

   -- Orders table
   CREATE TABLE orders (
       id SERIAL PRIMARY KEY,
       item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
       ordered BOOLEAN DEFAULT FALSE,
       order_date VARCHAR(10),  -- Format: 'dd/mm'
       delivery_date VARCHAR(10),
       delivery_status VARCHAR(50),
       quantity INTEGER,
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW(),
       UNIQUE(item_id)  -- One order per item
   );

   -- Comments table
   CREATE TABLE comments (
       id SERIAL PRIMARY KEY,
       item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
       role VARCHAR(50) NOT NULL,  -- 'client' or 'cray'
       comment_text TEXT,
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW(),
       UNIQUE(item_id, role)
   );

   -- Edit history table
   CREATE TABLE edit_history (
       id SERIAL PRIMARY KEY,
       item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
       section_id VARCHAR(50),
       section_label VARCHAR(255),
       product TEXT,
       field_path VARCHAR(255) NOT NULL,
       old_value JSONB,
       new_value JSONB,
       source VARCHAR(50) DEFAULT 'manual',  -- 'manual' or 'agent'
       timestamp TIMESTAMP DEFAULT NOW()
   );

   -- Custom fields table (for extensibility)
   CREATE TABLE custom_fields (
       id SERIAL PRIMARY KEY,
       item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
       field_name VARCHAR(100) NOT NULL,
       field_value JSONB,
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW(),
       UNIQUE(item_id, field_name)
   );

   -- Indexes for performance
   CREATE INDEX idx_items_section ON items(section_id);
   CREATE INDEX idx_items_product ON items(product);
   CREATE INDEX idx_approvals_item_role ON approvals(item_id, role);
   CREATE INDEX idx_approvals_status ON approvals(status) WHERE status IS NOT NULL;
   CREATE INDEX idx_orders_ordered ON orders(ordered);
   CREATE INDEX idx_edit_history_item ON edit_history(item_id);
   CREATE INDEX idx_edit_history_timestamp ON edit_history(timestamp DESC);
   ```

2. **Create SQLAlchemy Models**
   - Create `backend/models.py` with all models
   - Define relationships between tables
   - Add helper methods for common queries

3. **Create Alembic Migration**
   ```bash
   alembic init alembic
   alembic revision --autogenerate -m "Initial schema"
   alembic upgrade head
   ```

### Deliverables
- [ ] Database schema created
- [ ] SQLAlchemy models defined
- [ ] Alembic migration created and applied
- [ ] Indexes created for performance

### Testing
- [ ] Can create tables
- [ ] Foreign key constraints work
- [ ] Indexes are created
- [ ] Models can be imported without errors

---

## Phase 2: Data Migration Script

**Duration**: 2-3 hours  
**Risk**: Low (read-only, doesn't affect production)  
**Can Rollback**: Yes (just don't use migrated data)

### Tasks

1. **Create Migration Script**
   - `backend/scripts/migrate_json_to_db.py`
   - Reads `data/materials.json`
   - Transforms to database records
   - Handles all nested structures (approvals, orders, etc.)

2. **Data Validation**
   - Verify all items migrated
   - Check data integrity
   - Compare counts (JSON items vs DB items)
   - Validate relationships

3. **Create Reverse Migration** (for safety)
   - `backend/scripts/migrate_db_to_json.py`
   - Can export DB back to JSON format
   - Useful for backup/rollback

### Deliverables
- [ ] Migration script that converts JSON → PostgreSQL
- [ ] Validation script to verify migration
- [ ] Reverse migration script (DB → JSON)
- [ ] Migrated data in database

### Testing
- [ ] All items from JSON are in database
- [ ] All relationships are correct
- [ ] Data matches JSON exactly
- [ ] Reverse migration produces identical JSON

---

## Phase 3: Dual-Write Implementation

**Duration**: 4-5 hours  
**Risk**: Medium  
**Can Rollback**: Yes (disable `USE_DATABASE` flag)

### Tasks

1. **Create Database Service Layer**
   - `backend/services/materials_service.py`
   - Functions: `get_materials()`, `update_item()`, `create_item()`, etc.
   - Abstracts database operations

2. **Modify Existing Functions**
   - Update `load_materials_data()` to check `USE_DATABASE` flag
   - If flag is True: read from DB, else: read from JSON
   - Update `write_materials_data()` to write to BOTH JSON and DB
   - This ensures data stays in sync

3. **Update All Write Operations**
   - `update_cell()` function
   - `log_edit()` function
   - All API endpoints that modify data

### Implementation Pattern

```python
def load_materials_data() -> dict:
    if os.getenv("USE_DATABASE", "false").lower() == "true":
        return materials_service.get_materials_dict()  # From DB
    else:
        with open(MATERIALS_FILE_PATH, encoding='utf-8') as f:
            return json.load(f)  # From JSON

def write_materials_data(data: dict) -> None:
    # Always write to JSON (backward compatibility)
    with open(MATERIALS_FILE_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    # Also write to DB if enabled (dual-write)
    if os.getenv("USE_DATABASE", "false").lower() == "true":
        materials_service.save_materials_dict(data)  # To DB
```

### Deliverables
- [ ] Database service layer created
- [ ] All write operations support dual-write
- [ ] Feature flag controls read source
- [ ] JSON and DB stay in sync

### Testing
- [ ] Write to JSON, verify DB is updated
- [ ] Write to DB (via API), verify JSON is updated
- [ ] Read from DB when flag is on
- [ ] Read from JSON when flag is off
- [ ] Test suite still passes

---

## Phase 4: Read from Database

**Duration**: 2-3 hours  
**Risk**: Medium  
**Can Rollback**: Yes (set `USE_DATABASE=false`)

### Tasks

1. **Enable Database Reads**
   - Set `USE_DATABASE=true` in environment
   - All reads now come from PostgreSQL
   - Writes still go to both (dual-write)

2. **Performance Testing**
   - Compare read performance (JSON vs DB)
   - Verify queries are fast with indexes
   - Test with larger datasets

3. **Update Frontend if Needed**
   - Check if API response format changed
   - Update if necessary (likely minimal)

### Deliverables
- [ ] All reads come from database
- [ ] Performance is acceptable
- [ ] Frontend works correctly
- [ ] Test suite passes

### Testing
- [ ] All API endpoints return data from DB
- [ ] Frontend displays data correctly
- [ ] Performance is good
- [ ] Can rollback to JSON if needed

---

## Phase 5: SQL Functions for Agent Tools

**Duration**: 5-6 hours  
**Risk**: Medium  
**Can Rollback**: Yes (keep old JSON parsing as fallback)

### Tasks

1. **Create SQL Functions**
   ```sql
   -- Function: Get items needing validation
   CREATE OR REPLACE FUNCTION get_items_needing_validation(
       p_role VARCHAR
   ) RETURNS TABLE (
       item_id INTEGER,
       section_label VARCHAR,
       product TEXT,
       status VARCHAR
   ) AS $$
   BEGIN
       RETURN QUERY
       SELECT i.id, s.label, i.product, a.status
       FROM items i
       JOIN sections s ON i.section_id = s.id
       LEFT JOIN approvals a ON a.item_id = i.id AND a.role = p_role
       WHERE a.status IS NULL 
          OR a.status NOT IN ('approved', 'supplied_by')
       ORDER BY s.label, i.product;
   END;
   $$ LANGUAGE plpgsql;

   -- Function: Get TODO items for role
   CREATE OR REPLACE FUNCTION get_todo_items(
       p_role VARCHAR
   ) RETURNS TABLE (
       item_id INTEGER,
       section_label VARCHAR,
       product TEXT,
       action_reason TEXT
   ) AS $$
   BEGIN
       RETURN QUERY
       SELECT 
           i.id,
           s.label,
           i.product,
           CASE 
               WHEN a.status IS NULL OR a.status != 'approved' THEN 'validation'
               WHEN o.ordered = FALSE THEN 'needs ordering'
               WHEN o.delivery_date IS NOT NULL THEN 'delivery tracking'
           END as action_reason
       FROM items i
       JOIN sections s ON i.section_id = s.id
       LEFT JOIN approvals a ON a.item_id = i.id AND a.role = p_role
       LEFT JOIN orders o ON o.item_id = i.id
       WHERE (a.status IS NULL OR a.status != 'approved')
          OR o.ordered = FALSE
          OR o.delivery_date IS NOT NULL;
   END;
   $$ LANGUAGE plpgsql;

   -- Function: Update item status
   CREATE OR REPLACE FUNCTION update_item_approval(
       p_item_id INTEGER,
       p_role VARCHAR,
       p_status VARCHAR
   ) RETURNS BOOLEAN AS $$
   BEGIN
       INSERT INTO approvals (item_id, role, status, updated_at)
       VALUES (p_item_id, p_role, p_status, NOW())
       ON CONFLICT (item_id, role) 
       DO UPDATE SET status = p_status, updated_at = NOW();
       RETURN TRUE;
   EXCEPTION
       WHEN OTHERS THEN
           RETURN FALSE;
   END;
   $$ LANGUAGE plpgsql;

   -- Function: Add replacement URL
   CREATE OR REPLACE FUNCTION add_replacement_url(
       p_item_id INTEGER,
       p_role VARCHAR,
       p_url TEXT
   ) RETURNS BOOLEAN AS $$
   DECLARE
       v_approval_id INTEGER;
   BEGIN
       -- Get or create approval record
       SELECT id INTO v_approval_id
       FROM approvals
       WHERE item_id = p_item_id AND role = p_role;
       
       IF v_approval_id IS NULL THEN
           INSERT INTO approvals (item_id, role, status)
           VALUES (p_item_id, p_role, NULL)
           RETURNING id INTO v_approval_id;
       END IF;
       
       -- Add URL if not exists
       INSERT INTO replacement_urls (approval_id, url)
       SELECT v_approval_id, p_url
       WHERE NOT EXISTS (
           SELECT 1 FROM replacement_urls 
           WHERE approval_id = v_approval_id AND url = p_url
       );
       
       RETURN TRUE;
   EXCEPTION
       WHEN OTHERS THEN
           RETURN FALSE;
   END;
   $$ LANGUAGE plpgsql;

   -- Function: Remove replacement URL
   CREATE OR REPLACE FUNCTION remove_replacement_url(
       p_item_id INTEGER,
       p_role VARCHAR,
       p_url TEXT
   ) RETURNS BOOLEAN AS $$
   DECLARE
       v_approval_id INTEGER;
   BEGIN
       SELECT id INTO v_approval_id
       FROM approvals
       WHERE item_id = p_item_id AND role = p_role;
       
       IF v_approval_id IS NULL THEN
           RETURN FALSE;
       END IF;
       
       DELETE FROM replacement_urls
       WHERE approval_id = v_approval_id AND url = p_url;
       
       RETURN TRUE;
   EXCEPTION
       WHEN OTHERS THEN
           RETURN FALSE;
   END;
   $$ LANGUAGE plpgsql;

   -- Function: Get pricing summary
   CREATE OR REPLACE FUNCTION get_pricing_summary()
   RETURNS TABLE (
       total_ttc DECIMAL,
       total_ht DECIMAL,
       item_count INTEGER
   ) AS $$
   BEGIN
       RETURN QUERY
       SELECT 
           COALESCE(SUM(price_ttc), 0) as total_ttc,
           COALESCE(SUM(price_ht_quote), 0) as total_ht,
           COUNT(*) as item_count
       FROM items
       WHERE price_ttc IS NOT NULL OR price_ht_quote IS NOT NULL;
   END;
   $$ LANGUAGE plpgsql;
   ```

2. **Create Agent Tool Wrappers**
   - `backend/services/agent_tools.py`
   - Python functions that call SQL functions
   - Return data in format agent expects

3. **Update Agent System Prompt**
   - Document new SQL-based tools
   - Remove JSON parsing instructions
   - Add SQL function descriptions

4. **Update Agent Query Handler**
   - Replace JSON parsing with SQL function calls
   - Update tool definitions in `main.py`

### Deliverables
- [ ] SQL functions created for all agent operations
- [ ] Agent tool wrappers implemented
- [ ] System prompt updated
- [ ] Agent uses SQL functions instead of JSON parsing

### Testing
- [ ] Agent can query using SQL functions
- [ ] All agent operations work correctly
- [ ] Test suite passes with SQL functions
- [ ] Performance is good

---

## Phase 6: Remove JSON Writes (DB-Only Writes)

**Duration**: 2-3 hours  
**Risk**: Medium  
**Can Rollback**: Yes (re-enable dual-write)

### Tasks

1. **Remove Dual-Write**
   - Update `write_materials_data()` to only write to DB
   - Keep JSON read as fallback (for safety)
   - Update all write operations

2. **Update API Endpoints**
   - All endpoints write directly to database
   - Remove JSON file writes
   - Keep JSON reads as backup

3. **Add Database Transactions**
   - Wrap writes in transactions
   - Rollback on errors
   - Ensure data consistency

### Deliverables
- [ ] All writes go to database only
- [ ] JSON is no longer updated
- [ ] Transactions ensure data integrity
- [ ] Error handling is robust

### Testing
- [ ] Writes go to DB only
- [ ] JSON file is not modified
- [ ] Transactions work correctly
- [ ] Rollback works on errors

---

## Phase 7: Remove JSON Reads (DB-Only)

**Duration**: 1-2 hours  
**Risk**: Low (DB is source of truth)  
**Can Rollback**: Yes (re-enable JSON reads)

### Tasks

1. **Remove JSON Fallback**
   - Remove `USE_DATABASE` flag
   - Remove all JSON read code
   - Database is now the only source

2. **Clean Up Code**
   - Remove `load_materials_data()` JSON implementation
   - Remove `write_materials_data()` JSON implementation
   - Remove JSON file paths from code

3. **Update Documentation**
   - Update README
   - Document database setup
   - Update deployment instructions

### Deliverables
- [ ] All reads come from database
- [ ] JSON code removed
- [ ] Documentation updated
- [ ] Code is cleaner

### Testing
- [ ] Application works without JSON files
- [ ] All functionality works
- [ ] Test suite passes
- [ ] No references to JSON files in code

---

## Phase 8: Testing & Optimization

**Duration**: 3-4 hours  
**Risk**: Low  
**Can Rollback**: N/A (optimization only)

### Tasks

1. **Update Test Suite**
   - Replace JSON fixtures with database fixtures
   - Use transactions for test isolation
   - Much faster and cheaper (no LLM calls needed)

2. **Performance Optimization**
   - Analyze slow queries
   - Add missing indexes
   - Optimize SQL functions

3. **Load Testing**
   - Test with larger datasets
   - Test concurrent users
   - Verify performance is acceptable

4. **Security Review**
   - Verify role-based access works
   - Check SQL injection prevention
   - Review permissions

### Deliverables
- [ ] Test suite uses database
- [ ] Performance is optimized
- [ ] Security is verified
- [ ] Load testing completed

### Testing
- [ ] Test suite runs fast
- [ ] No LLM costs for testing
- [ ] Performance is good
- [ ] Security is verified

---

## Phase 9: Production Deployment

**Duration**: 2-3 hours  
**Risk**: Medium  
**Can Rollback**: Yes (keep JSON as backup)

### Tasks

1. **Production Database Setup**
   - Set up production PostgreSQL
   - Configure backups
   - Set up replication (if needed)

2. **Migration to Production**
   - Run migration script on production data
   - Verify data integrity
   - Test all functionality

3. **Monitoring**
   - Set up database monitoring
   - Configure alerts
   - Monitor query performance

4. **Documentation**
   - Update deployment docs
   - Document database schema
   - Create runbooks

### Deliverables
- [ ] Production database running
- [ ] Data migrated
- [ ] Monitoring configured
- [ ] Documentation complete

### Testing
- [ ] Production works correctly
- [ ] Backups work
- [ ] Monitoring works
- [ ] Rollback plan tested

---

## Rollback Strategy

### For Each Phase

**Phase 1-2**: No rollback needed (no code changes)

**Phase 3-4**: Set `USE_DATABASE=false` to revert to JSON

**Phase 5**: Keep old JSON parsing code, switch back in system prompt

**Phase 6**: Re-enable dual-write, restore from JSON backup

**Phase 7**: Re-enable JSON reads, restore JSON file from backup

**Phase 8-9**: Restore from database backup

### Emergency Rollback

1. Set `USE_DATABASE=false`
2. Restore `data/materials.json` from backup
3. Restart application
4. Application now uses JSON only

---

## Risk Mitigation

### Data Loss Prevention
- **Backup before each phase**: Always backup JSON and database
- **Dual-write during transition**: Data in both places
- **Validation scripts**: Verify data integrity after each phase

### Performance Issues
- **Indexes**: Create indexes early
- **Connection pooling**: Use proper pooling
- **Query optimization**: Monitor and optimize slow queries

### Breaking Changes
- **Feature flags**: Use flags to control rollout
- **Gradual migration**: One phase at a time
- **Testing**: Test thoroughly before moving to next phase

---

## Success Criteria

### Phase Completion Criteria
- [ ] All tests pass
- [ ] No data loss
- [ ] Performance is acceptable
- [ ] Can rollback if needed

### Final Success Criteria
- [ ] All data in PostgreSQL
- [ ] JSON files no longer used
- [ ] Agent uses SQL functions
- [ ] Test suite is fast and cheap
- [ ] Production is stable
- [ ] Documentation is complete

---

## Timeline Estimate

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 0: Preparation | 2-3 hours | 2-3 hours |
| Phase 1: Schema Design | 3-4 hours | 5-7 hours |
| Phase 2: Data Migration | 2-3 hours | 7-10 hours |
| Phase 3: Dual-Write | 4-5 hours | 11-15 hours |
| Phase 4: DB Reads | 2-3 hours | 13-18 hours |
| Phase 5: SQL Functions | 5-6 hours | 18-24 hours |
| Phase 6: Remove JSON Writes | 2-3 hours | 20-27 hours |
| Phase 7: Remove JSON Reads | 1-2 hours | 21-29 hours |
| Phase 8: Testing | 3-4 hours | 24-33 hours |
| Phase 9: Production | 2-3 hours | 26-36 hours |

**Total Estimate**: 26-36 hours (3-5 days of focused work)

---

## Dependencies

- **Phase 1** depends on **Phase 0**
- **Phase 2** depends on **Phase 1**
- **Phase 3** depends on **Phase 2**
- **Phase 4** depends on **Phase 3**
- **Phase 5** depends on **Phase 4**
- **Phase 6** depends on **Phase 5**
- **Phase 7** depends on **Phase 6**
- **Phase 8** can be done in parallel with **Phase 6-7**
- **Phase 9** depends on **Phase 8**

---

## Notes

- Each phase should be completed and tested before moving to the next
- Keep JSON files as backup until Phase 7 is complete
- Test suite should be updated in Phase 8 to use database
- Consider doing this migration in a feature branch
- Document any issues encountered during migration

---

## Next Steps

1. Review this plan
2. Set up PostgreSQL (Phase 0)
3. Start with Phase 1 (Schema Design)
4. Proceed phase by phase
5. Test thoroughly after each phase
6. Document any deviations from plan
















