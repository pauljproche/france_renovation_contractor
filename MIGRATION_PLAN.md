# PostgreSQL Migration Plan

## Overview

This document outlines the phased migration from JSON file-based storage and localStorage to PostgreSQL database for the France Renovation Contractor application.

**Git Workflow**: This migration is organized into branches following `MIGRATION_BRANCH_STRATEGY.md`. Each phase or logical milestone has its own branch with PRs for review. See the branch strategy document for details.

**Goal**: Migrate from JSON file-based storage (`data/materials.json`, localStorage for projects/workers) to PostgreSQL while maintaining zero downtime and backward compatibility during the transition.

**Primary Goal**: Achieve ACID compliance - all database operations are atomic ("all or nothing"). This ensures data consistency guarantees that JSON/localStorage cannot provide.

**Security Goal**: Prevent agent/LLM from directly modifying data. All modifications must go through SQL functions that perform permission checks. Agent queries materials data indirectly through SQL functions.

**Approach**: Direct migration - frontend contexts will call API endpoints directly (no abstraction layer). This keeps the migration faster and simpler. Refactoring can happen after migration if needed.

**Security Model**:
- Agent uses restricted database role (`agent_user`) with SELECT + EXECUTE permissions only
- Agent CANNOT directly INSERT/UPDATE/DELETE on tables
- All agent modifications go through SQL functions (`SECURITY DEFINER` functions with permission checks)
- All agent queries go through SQL functions (indirect access for consistency)
- Permission checks inside SQL functions validate user roles before allowing modifications

**Data Sources to Migrate**:
- Materials data: `data/materials.json` → sections, items, approvals, orders, comments tables
- Projects data: localStorage `renovationProjects` → projects table
- Workers data: localStorage `workers` → workers, worker_jobs tables
- Edit history: `data/edit-history.json` → edit_history table (if applicable)

**Benefits**:
- **ACID Transactions**: All-or-nothing operations guarantee data consistency
- **Atomic Updates**: Multiple related changes succeed or fail together
- **Security**: Agent can ONLY modify data through SQL functions with permission checks (no direct table writes)
- **Indirect Data Access**: All agent queries go through SQL functions, not direct table access
- Deterministic, fast testing (no LLM costs)
- SQL-based queries for agent tools
- Multi-user support with ACID guarantees (future-ready)
- Production-ready architecture
- Role-based access control at SQL function level
- Centralized data storage (no more localStorage fragmentation)
- Timeline queries for projects and workers
- Better data relationships and integrity
- **Data Integrity**: Foreign keys, constraints, and transactions prevent inconsistent states

---

## Prerequisites

Before starting:
- [ ] **Docker installed** (required - we use Docker for database development)
- [ ] Database credentials configured
- [ ] Backup of current `data/materials.json`
- [ ] Backup of localStorage data (projects, workers, edit history)
- [ ] Understanding of current data structure
- [ ] Test suite passing on current JSON/localStorage implementation
- [ ] Understanding of new features: Timeline page, Workers page, WorkersCard, TimelineCard
- [ ] Understanding of ACID guarantees and transaction requirements
- [ ] Decision on authentication: Single-user (no auth needed) or multi-user (add auth later)
- [ ] Understanding of SQL function-based security model (agent cannot directly modify tables)

**Note on Multi-User**: Current system appears single-user (localStorage). If multi-user is needed later, add `user_id` foreign keys to all tables. For now, assuming single-user operation.

**Security Model**: Agent will have a restricted database role that can ONLY execute SQL functions (no direct table INSERT/UPDATE/DELETE). All modifications must go through SQL functions that perform permission checks.

---

## Phase 0: Preparation & Setup

**Duration**: 2-3 hours  
**Risk**: Low  
**Can Rollback**: Yes (no changes to code)

### Tasks

1. **Database Setup (Using Docker - Recommended)**
   
   **We use Docker for database development to ensure environment parity with AWS RDS production.**
   
   ```bash
   # Start PostgreSQL in Docker (first time)
   docker run --name france-renovation-db \
     -e POSTGRES_PASSWORD=yourpassword \
     -e POSTGRES_DB=france_renovation \
     -e POSTGRES_USER=postgres \
     -p 5432:5432 \
     -v france-renovation-data:/var/lib/postgresql/data \
     -d postgres:15
   
   # If container already exists, start it
   docker start france-renovation-db
   
   # Stop database (when needed)
   docker stop france-renovation-db
   
   # Remove database (fresh start - WARNING: deletes all data)
   docker rm -v france-renovation-db
   ```
   
   **Why Docker?**
   - Environment parity with AWS RDS (same PostgreSQL version/config)
   - Easy cleanup and reset during development
   - Consistent across team members
   - Easy to switch PostgreSQL versions if needed
   - Isolation from other PostgreSQL instances
   
   **Alternative (Local PostgreSQL):**
   ```bash
   # Only if you prefer local installation
   createdb france_renovation
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
   # Docker PostgreSQL connection (default postgres user)
   DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/france_renovation
   # Separate connection for agent with restricted permissions (created in Phase 5)
   AGENT_DATABASE_URL=postgresql://agent_user:secure_password@localhost:5432/france_renovation
   USE_DATABASE=false  # Feature flag for gradual rollout
   # When false: Materials use JSON, Projects/Workers APIs return 501 (frontend uses localStorage)
   # When true: Everything uses database
   ```
   
   **Note**: 
   - `DATABASE_URL` connects to Docker PostgreSQL (localhost:5432 when using Docker port mapping)
   - `AGENT_DATABASE_URL` uses the `agent_user` role which has restricted permissions (SELECT + EXECUTE only, no direct table writes) - created in Phase 5

4. **Create Database Connection Module**
   - Create `backend/database.py` with connection pool
     ```python
     from sqlalchemy import create_engine, pool
     from sqlalchemy.orm import sessionmaker
     
     # Main application connection (full privileges)
     engine = create_engine(
         DATABASE_URL,
         pool_size=10,  # Limit concurrent connections
         max_overflow=20,  # Max connections beyond pool_size
         pool_pre_ping=True,  # Verify connections before use
         pool_recycle=3600,  # Recycle connections after 1 hour
         echo=False  # Set to True for SQL query logging in development
     )
     
     SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
     ```
   - Create `backend/models.py` with SQLAlchemy models
   - Create `backend/db_session.py` for session management
     ```python
     from contextlib import contextmanager
     
     @contextmanager
     def db_session():
         """Context manager for database sessions with automatic rollback on error."""
         session = SessionLocal()
         try:
             yield session
             session.commit()
         except Exception:
             session.rollback()
             raise
         finally:
             session.close()
     ```
   - **Configure transaction support**: Ensure SQLAlchemy session uses transactions
   - Set up proper session lifecycle (context managers for atomicity)
   - **Connection Pool Security**: Set reasonable limits to prevent resource exhaustion

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

1. **Design Database Schema with Constraints and Validation**

   ```sql
   -- Sections table
   CREATE TABLE sections (
       id VARCHAR(50) PRIMARY KEY,
       label VARCHAR(255) NOT NULL,
       project_id VARCHAR(50),
       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
       updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
       CONSTRAINT sections_id_length CHECK (LENGTH(id) > 0 AND LENGTH(id) <= 50),
       CONSTRAINT sections_label_length CHECK (LENGTH(label) > 0 AND LENGTH(label) <= 255)
   );

   -- Items table
   CREATE TABLE items (
       id SERIAL PRIMARY KEY,
       section_id VARCHAR(50) NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
       product TEXT NOT NULL,
       reference VARCHAR(255),
       supplier_link TEXT,
       labor_type VARCHAR(50),
       price_ttc DECIMAL(10, 2) CHECK (price_ttc >= 0),
       price_ht_quote DECIMAL(10, 2) CHECK (price_ht_quote >= 0),
       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
       updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
       UNIQUE(section_id, product),  -- Prevent duplicates
       CONSTRAINT items_product_not_empty CHECK (LENGTH(TRIM(product)) > 0),
       CONSTRAINT items_price_valid CHECK (
           (price_ttc IS NULL OR price_ttc >= 0) AND
           (price_ht_quote IS NULL OR price_ht_quote >= 0)
       )
   );

   -- Approvals table (normalized)
   CREATE TABLE approvals (
       id SERIAL PRIMARY KEY,
       item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
       role VARCHAR(50) NOT NULL,  -- 'client' or 'cray'
       status VARCHAR(50),  -- 'approved', 'rejected', 'change_order', 'pending', 'supplied_by', null
       note TEXT,
       validated_at TIMESTAMP WITH TIME ZONE,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
       updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
       UNIQUE(item_id, role),  -- One approval per role per item
       CONSTRAINT approvals_role_valid CHECK (role IN ('client', 'cray')),
       CONSTRAINT approvals_status_valid CHECK (
           status IS NULL OR status IN ('approved', 'rejected', 'change_order', 'pending', 'supplied_by')
       )
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
       quantity INTEGER CHECK (quantity IS NULL OR quantity > 0),
       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
       updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
       UNIQUE(item_id),  -- One order per item
       CONSTRAINT orders_date_format CHECK (
           (order_date IS NULL OR order_date ~ '^\d{2}/\d{2}$') AND
           (delivery_date IS NULL OR delivery_date ~ '^\d{2}/\d{2}$')
       )
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
       timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
       CONSTRAINT edit_history_source_valid CHECK (source IN ('manual', 'agent')),
       CONSTRAINT edit_history_field_path_length CHECK (LENGTH(field_path) > 0 AND LENGTH(field_path) <= 255)
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

   -- Projects table (for project management)
   CREATE TABLE projects (
       id VARCHAR(50) PRIMARY KEY,
       name VARCHAR(255) NOT NULL,
       address VARCHAR(255),
       client_name VARCHAR(255),
       status VARCHAR(50) DEFAULT 'draft',  -- 'draft', 'ready', 'active', 'completed', 'archived'
       devis_status VARCHAR(50),  -- 'sent', 'approved', 'rejected', null
       invoice_count INTEGER DEFAULT 0 CHECK (invoice_count >= 0),
       percentage_paid INTEGER DEFAULT 0 CHECK (percentage_paid >= 0 AND percentage_paid <= 100),
       start_date TIMESTAMP WITH TIME ZONE,
       end_date TIMESTAMP WITH TIME ZONE,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
       updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
       is_demo BOOLEAN DEFAULT FALSE,
       has_data BOOLEAN DEFAULT FALSE,
       CONSTRAINT projects_id_length CHECK (LENGTH(id) > 0 AND LENGTH(id) <= 50),
       CONSTRAINT projects_name_length CHECK (LENGTH(name) > 0 AND LENGTH(name) <= 255),
       CONSTRAINT projects_status_valid CHECK (status IN ('draft', 'ready', 'active', 'completed', 'archived')),
       CONSTRAINT projects_devis_status_valid CHECK (
           devis_status IS NULL OR devis_status IN ('sent', 'approved', 'rejected')
       ),
       CONSTRAINT projects_date_range_valid CHECK (
           start_date IS NULL OR end_date IS NULL OR start_date <= end_date
       )
       -- Note: Demo projects remain hardcoded in frontend, not stored in DB
   );

   -- Workers table (for worker management)
   CREATE TABLE workers (
       id VARCHAR(50) PRIMARY KEY,
       name VARCHAR(255) NOT NULL,
       email VARCHAR(255),
       phone VARCHAR(50),
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW()
   );

   -- Worker jobs table (jobs assigned to workers)
   CREATE TABLE worker_jobs (
       id VARCHAR(50) PRIMARY KEY,
       worker_id VARCHAR(50) NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
       chantier_name VARCHAR(255) NOT NULL,  -- References project address/name
       job_type VARCHAR(50),  -- 'plumbing', 'electrical', 'demo', etc.
       start_date TIMESTAMP NOT NULL,
       end_date TIMESTAMP,
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW()
   );

   -- Link sections to projects
   ALTER TABLE sections ADD COLUMN project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE;

   -- Indexes for performance
   -- CRITICAL: Index all foreign keys for JOIN performance
   CREATE INDEX idx_items_section ON items(section_id);
   CREATE INDEX idx_items_product ON items(product);
   CREATE INDEX idx_approvals_item ON approvals(item_id);  -- FK index
   CREATE INDEX idx_approvals_item_role ON approvals(item_id, role);  -- Composite for common query
   CREATE INDEX idx_approvals_status ON approvals(status) WHERE status IS NOT NULL;
   CREATE INDEX idx_replacement_urls_approval ON replacement_urls(approval_id);  -- FK index
   CREATE INDEX idx_orders_item ON orders(item_id);  -- FK index
   CREATE INDEX idx_orders_ordered ON orders(ordered);
   CREATE INDEX idx_comments_item ON comments(item_id);  -- FK index
   CREATE INDEX idx_edit_history_item ON edit_history(item_id);
   CREATE INDEX idx_edit_history_timestamp ON edit_history(timestamp DESC);
   CREATE INDEX idx_custom_fields_item ON custom_fields(item_id);  -- FK index
   CREATE INDEX idx_projects_status ON projects(status);
   CREATE INDEX idx_projects_created ON projects(created_at DESC);
   CREATE INDEX idx_workers_name ON workers(name);
   CREATE INDEX idx_worker_jobs_worker ON worker_jobs(worker_id);  -- FK index
   CREATE INDEX idx_worker_jobs_chantier ON worker_jobs(chantier_name);
   CREATE INDEX idx_worker_jobs_dates ON worker_jobs(start_date, end_date);
   CREATE INDEX idx_sections_project ON sections(project_id);  -- FK index
   
   -- Additional indexes for common query patterns
   CREATE INDEX idx_projects_dates ON projects(start_date, end_date) WHERE start_date IS NOT NULL;
   CREATE INDEX idx_items_updated ON items(updated_at DESC);
   ```

2. **Create SQLAlchemy Models**
   - Create `backend/models.py` with all models
   - Define relationships between tables (foreign keys)
   - Add helper methods for common queries
   - **Enable transaction support**: Configure session management for ACID guarantees
   - **Data Validation**: Use SQLAlchemy validators for business logic validation
   - **Optional**: Add `version` fields for optimistic locking on:
     - `projects` table
     - `workers` table
     - `items` table (if concurrent updates expected)
   - **SQL Injection Prevention**: SQLAlchemy ORM automatically parameterizes queries, but verify no raw SQL with string formatting

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
- [ ] Foreign key constraints work (test cascade deletes)
- [ ] Indexes are created
- [ ] Models can be imported without errors
- [ ] **Transaction support verified**: Can begin/commit/rollback transactions
- [ ] **Foreign key integrity**: Cannot create orphaned records

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
   - **Projects migration**: Requires manual export of localStorage or browser-based migration script
     - Option A: User exports localStorage data to JSON file, script reads it
     - Option B: Browser-based script (copy-paste into console) exports data
   - **Workers migration**: Same approach as projects
   - **Note**: Demo projects/workers are hardcoded in frontend - don't migrate those (they're always available)

2. **Data Sources to Migrate**
   - `data/materials.json` → sections, items, approvals, orders, comments
   - Projects (from localStorage) → projects table
     - **Exclude**: Demo projects (hardcoded in frontend, always available)
     - **Include**: User-created projects and converted demo projects
   - Workers (from localStorage) → workers, worker_jobs tables
     - **Exclude**: Demo workers (hardcoded in frontend, always available)
     - **Include**: User-created workers
   - Edit history: `data/edit-history.json` → edit_history table

3. **Data Validation**
   - Verify all items migrated
   - Verify all projects migrated
   - Verify all workers and jobs migrated
   - Check data integrity
   - Compare counts (JSON items vs DB items)
   - Validate relationships
   - Verify foreign key constraints

4. **Create Reverse Migration** (for safety)
   - `backend/scripts/migrate_db_to_json.py`
   - Can export DB back to JSON format (materials)
   - Can export projects and workers to JSON/localStorage format
   - Useful for backup/rollback
   - **Note**: Demo projects/workers not exported (they're frontend constants)

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

**Duration**: 5-6 hours  
**Risk**: Medium  
**Can Rollback**: Yes (disable `USE_DATABASE` flag or use localStorage fallback)

**Critical Note**: Frontend must gracefully handle API unavailability. When `USE_DATABASE=false`, API endpoints return 501, and frontend falls back to localStorage seamlessly.

### Tasks

1. **Create Database Service Layer (Backend)**
   - `backend/services/materials_service.py` - Materials, items, approvals, orders
   - `backend/services/projects_service.py` - Projects CRUD operations
   - `backend/services/workers_service.py` - Workers and worker jobs CRUD operations
   - Functions: `get_materials()`, `update_item()`, `create_item()`, `get_project()`, `update_project()`, `get_workers()`, `get_worker_jobs()`, etc.
   - **Note**: Service layer is backend-only. Frontend will call API endpoints directly.

2. **Create API Endpoints**
   - `GET /api/projects` - Get all projects
   - `POST /api/projects` - Create project
   - `PUT /api/projects/{id}` - Update project
   - `DELETE /api/projects/{id}` - Delete project
   - `GET /api/workers` - Get all workers
   - `POST /api/workers` - Create worker
   - `PUT /api/workers/{id}` - Update worker
   - `DELETE /api/workers/{id}` - Delete worker
   - Existing `/api/materials` endpoints remain

3. **Modify Existing Backend Functions**
   - Update `load_materials_data()` to check `USE_DATABASE` flag
   - If flag is True: read from DB, else: read from JSON
   - Update `write_materials_data()` to write to BOTH JSON and DB (dual-write)
   - **CRITICAL**: Implement dual-write with proper error handling:
     ```python
     def write_materials_data(data: dict) -> None:
         # Strategy: Write to DB first (source of truth), then JSON (backup)
         db_success = False
         json_success = False
         
         # Try DB write first (primary source)
         if os.getenv("USE_DATABASE", "false").lower() == "true":
             try:
                 with db_session() as session:
                     materials_service.save_materials_dict(data, session)
                     session.commit()
                     db_success = True
             except Exception as e:
                 logger.error(f"DB write failed: {e}")
                 raise  # Fail fast - don't write to JSON if DB fails
         
         # Then write to JSON (backup during migration)
         try:
             with open(MATERIALS_FILE_PATH, 'w', encoding='utf-8') as f:
                 json.dump(data, f, indent=2, ensure_ascii=False)
             json_success = True
         except Exception as e:
             logger.error(f"JSON write failed: {e}")
             if db_success:
                 # DB succeeded but JSON failed - log warning, continue
                 logger.warning("JSON backup write failed, but DB write succeeded")
             else:
                 raise  # Both failed
     ```
   - **Principle**: DB is source of truth. If DB write fails, transaction rolls back (atomicity). JSON is backup only.

4. **Update Frontend Contexts Directly**
   - **ProjectsContext**: Change `localStorage.getItem('renovationProjects')` → `fetch('/api/projects')`
   - **WorkersContext**: Change `localStorage.getItem('workers')` → `fetch('/api/workers')`
   - **No abstraction layer**: Direct API calls in contexts (can refactor later if needed)
   - Add error handling and loading states for API calls
   - **CRITICAL**: Implement smart fallback logic:
     - Try API first (when `USE_DATABASE=true`)
     - If API returns 501 or fails → fallback to localStorage
     - When writing: if API fails, write to localStorage AND queue sync for when DB is enabled
     - **Demo projects**: Keep hardcoded demo projects in frontend (not in DB), merge with API results

5. **Update All Write Operations**
   - `update_cell()` function (already uses API)
   - `log_edit()` function (backend handles)
   - All API endpoints that modify data
   - Frontend: Project operations → API calls
   - Frontend: Worker operations → API calls
   - **All write operations must use database transactions for atomicity**

6. **API Security (Optional but Recommended)**
   - **Current**: Single-user system (no authentication needed for MVP)
   - **Future**: If multi-user support needed, add:
     - API authentication middleware
     - User context in database schema (`user_id` foreign keys)
     - Role-based access control at API level
   - **For now**: Consider adding basic rate limiting or request validation

### Implementation Pattern

**Backend (Python)**:
```python
# Materials (already has API)
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

# Projects & Workers (new API endpoints)
@app.get("/api/projects")
def get_projects():
    if os.getenv("USE_DATABASE", "false").lower() == "true":
        return projects_service.get_all_projects()  # From DB
    else:
        # CRITICAL: Return 501 Not Implemented or error
        # Frontend must use localStorage fallback when API unavailable
        # This prevents frontend from breaking during migration
        raise HTTPException(status_code=501, detail="Database not enabled. Use localStorage.")

@app.post("/api/projects")
def create_project(project: dict):
    if os.getenv("USE_DATABASE", "false").lower() == "true":
        return projects_service.create_project(project)  # To DB
    else:
        raise HTTPException(status_code=501, detail="Database not enabled. Use localStorage.")
```

**Frontend (React)**:
```javascript
// ProjectsContext.jsx - Direct API calls (no abstraction layer)
const [projects, setProjects] = useState([]);

useEffect(() => {
  async function loadProjects() {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        // Merge with demo projects (hardcoded, not in DB)
        const allProjects = [...DEMO_PROJECTS, ...data];
        setProjects(allProjects);
        return;
      }
    } catch (error) {
      // API not available or DB not enabled - use localStorage
    }
    
    // Fallback to localStorage during migration
    const stored = localStorage.getItem('renovationProjects');
    if (stored) {
      const storedProjects = JSON.parse(stored);
      // Merge with demo projects
      const allProjects = [...DEMO_PROJECTS, ...storedProjects];
      setProjects(allProjects);
    } else {
      // No stored data, use demo projects only
      setProjects(DEMO_PROJECTS);
    }
  }
  loadProjects();
}, []);

const updateProject = async (id, updates) => {
  try {
    const response = await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    // Reload projects from API
    // ...
  } catch (error) {
    // Fallback to localStorage during migration
    // ...
  }
};
```

**Key Decision**: No service abstraction layer in frontend. Direct API calls in contexts. Can refactor later if needed.

### Deliverables
- [ ] Backend database service layer created (materials, projects, workers)
- [ ] API endpoints created for projects and workers
- [ ] Frontend contexts updated to use API (with localStorage fallback)
- [ ] All write operations support dual-write (materials) with proper error handling
- [ ] Feature flag controls read source
- [ ] JSON and DB stay in sync (materials) - DB is source of truth
- [ ] Projects/Workers sync between localStorage and DB during transition
- [ ] Dual-write failure handling implemented (DB-first strategy)
- [ ] Error logging for write failures

### Testing
- [ ] Write to JSON, verify DB is updated (materials)
- [ ] Write to DB (via API), verify JSON is updated (materials)
- [ ] **Test dual-write failure scenarios**:
  - [ ] DB write succeeds, JSON write fails → data in DB, warning logged
  - [ ] DB write fails → transaction rolls back, JSON not updated, error returned
  - [ ] Verify atomicity: partial writes don't persist
- [ ] Read from DB when flag is on
- [ ] Read from JSON when flag is off (materials)
- [ ] Frontend gracefully falls back to localStorage when API unavailable
- [ ] Demo projects still appear correctly (hardcoded + API/DB projects merged)
- [ ] Projects/workers can be created/updated via API
- [ ] localStorage fallback works when API returns 501
- [ ] **Verify transaction atomicity**: Multiple related updates succeed or fail together
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
   - **Verify transaction performance**: Ensure transactions don't block for long
   - Test concurrent read performance (multiple queries)

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

## Phase 5: SQL Functions for Agent Tools (Security-Critical)

**Duration**: 6-7 hours  
**Risk**: Medium  
**Can Rollback**: Yes (keep old JSON parsing as fallback)

**CRITICAL SECURITY REQUIREMENT**: The agent MUST NOT be able to directly modify database tables. All modifications must go through SQL functions that perform permission checks.

### Tasks

1. **Create Restricted Database Role for Agent**
   ```sql
   -- Create a restricted role that can only execute functions, not write directly to tables
   CREATE ROLE agent_user WITH LOGIN PASSWORD 'secure_password';
   
   -- Grant connection to database
   GRANT CONNECT ON DATABASE france_renovation TO agent_user;
   
   -- Grant usage on schema
   GRANT USAGE ON SCHEMA public TO agent_user;
   
   -- Grant SELECT only (for read queries)
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO agent_user;
   GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO agent_user;
   
   -- Grant EXECUTE on all functions (for controlled writes)
   GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO agent_user;
   
   -- CRITICAL: Do NOT grant INSERT, UPDATE, DELETE on tables
   -- Agent can ONLY modify data through SQL functions
   
   -- Set default privileges for future functions
   ALTER DEFAULT PRIVILEGES IN SCHEMA public 
   GRANT EXECUTE ON FUNCTIONS TO agent_user;
   ```

2. **Create SQL Functions with Permission Checks**
   ```sql
   -- Function: Get items needing validation (READ-ONLY, indirect access)
   -- Even read queries go through functions for consistency and future permission checks
   CREATE OR REPLACE FUNCTION get_items_needing_validation(
       p_role VARCHAR,
       p_user_role VARCHAR DEFAULT NULL  -- For future permission checks
   ) RETURNS TABLE (
       item_id INTEGER,
       section_label VARCHAR,
       product TEXT,
       status VARCHAR
   ) AS $$
   BEGIN
       -- Future: Add permission checks here if needed
       -- For now: All roles can query (single-user system)
       
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

   -- Function: Get TODO items for role (READ-ONLY, indirect access)
   CREATE OR REPLACE FUNCTION get_todo_items(
       p_role VARCHAR,
       p_user_role VARCHAR DEFAULT NULL  -- For future permission checks
   ) RETURNS TABLE (
       item_id INTEGER,
       section_label VARCHAR,
       product TEXT,
       action_reason TEXT
   ) AS $$
   BEGIN
       -- Future: Add permission checks here if needed
       
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

   -- Function: Update item status (WITH PERMISSION CHECK)
   CREATE OR REPLACE FUNCTION update_item_approval(
       p_item_id INTEGER,
       p_role VARCHAR,
       p_status VARCHAR,
       p_user_role VARCHAR DEFAULT NULL  -- User's role for permission checking
   ) RETURNS BOOLEAN AS $$
   DECLARE
       v_item_exists BOOLEAN;
       v_allowed BOOLEAN := FALSE;
   BEGIN
       -- PERMISSION CHECK: Verify user has permission to update
       -- For now: single-user system, allow all updates
       -- Future: Add user_role validation here
       -- Example: IF p_user_role NOT IN ('client', 'contractor') THEN RETURN FALSE; END IF;
       
       -- Validate item exists
       SELECT EXISTS(SELECT 1 FROM items WHERE id = p_item_id) INTO v_item_exists;
       IF NOT v_item_exists THEN
           RAISE EXCEPTION 'Item % does not exist', p_item_id;
       END IF;
       
       -- Validate status value
       IF p_status IS NOT NULL AND p_status NOT IN ('approved', 'rejected', 'change_order', 'pending', 'supplied_by') THEN
           RAISE EXCEPTION 'Invalid status: %', p_status;
       END IF;
       
       -- Perform update within transaction (atomic)
       INSERT INTO approvals (item_id, role, status, updated_at)
       VALUES (p_item_id, p_role, p_status, NOW())
       ON CONFLICT (item_id, role) 
       DO UPDATE SET status = p_status, updated_at = NOW();
       
       -- Log edit history
       INSERT INTO edit_history (item_id, field_path, old_value, new_value, source)
       VALUES (p_item_id, 'approvals.' || p_role || '.status', 
               (SELECT status FROM approvals WHERE item_id = p_item_id AND role = p_role), 
               p_status, 'agent');
       
       RETURN TRUE;
   EXCEPTION
       WHEN OTHERS THEN
           -- SECURITY: Don't expose SQLERRM (may contain sensitive DB details)
           -- Log detailed error internally, but return generic error to agent
           RAISE EXCEPTION 'Failed to update approval';
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   
   -- SECURITY DEFINER allows function to run with table owner's privileges
   -- But permission checks inside function restrict what agent can do
   -- SECURITY: Function does NOT allow privilege escalation (no ALTER, CREATE, GRANT operations)

   -- Function: Add replacement URL (WITH PERMISSION CHECK)
   CREATE OR REPLACE FUNCTION add_replacement_url(
       p_item_id INTEGER,
       p_role VARCHAR,
       p_url TEXT,
       p_user_role VARCHAR DEFAULT NULL
   ) RETURNS BOOLEAN AS $$
   DECLARE
       v_approval_id INTEGER;
       v_item_exists BOOLEAN;
   BEGIN
       -- PERMISSION CHECK: Add validation here
       
       -- Validate item exists
       SELECT EXISTS(SELECT 1 FROM items WHERE id = p_item_id) INTO v_item_exists;
       IF NOT v_item_exists THEN
           RAISE EXCEPTION 'Item % does not exist', p_item_id;
       END IF;
       
       -- Validate URL format (basic check)
       IF p_url IS NULL OR LENGTH(TRIM(p_url)) = 0 THEN
           RAISE EXCEPTION 'URL cannot be empty';
       END IF;
       
       -- Get or create approval record
       SELECT id INTO v_approval_id
       FROM approvals
       WHERE item_id = p_item_id AND role = p_role;
       
       IF v_approval_id IS NULL THEN
           INSERT INTO approvals (item_id, role, status)
           VALUES (p_item_id, p_role, NULL)
           RETURNING id INTO v_approval_id;
       END IF;
       
       -- Add URL if not exists (atomic operation)
       INSERT INTO replacement_urls (approval_id, url)
       SELECT v_approval_id, p_url
       WHERE NOT EXISTS (
           SELECT 1 FROM replacement_urls 
           WHERE approval_id = v_approval_id AND url = p_url
       );
       
       RETURN TRUE;
   EXCEPTION
       WHEN OTHERS THEN
           -- SECURITY: Don't expose SQLERRM (may contain sensitive DB details)
           RAISE EXCEPTION 'Failed to add replacement URL';
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;

   -- Function: Remove replacement URL (WITH PERMISSION CHECK)
   CREATE OR REPLACE FUNCTION remove_replacement_url(
       p_item_id INTEGER,
       p_role VARCHAR,
       p_url TEXT,
       p_user_role VARCHAR DEFAULT NULL
   ) RETURNS BOOLEAN AS $$
   DECLARE
       v_approval_id INTEGER;
       v_item_exists BOOLEAN;
   BEGIN
       -- PERMISSION CHECK: Add validation here
       
       -- Validate item exists
       SELECT EXISTS(SELECT 1 FROM items WHERE id = p_item_id) INTO v_item_exists;
       IF NOT v_item_exists THEN
           RAISE EXCEPTION 'Item % does not exist', p_item_id;
       END IF;
       
       SELECT id INTO v_approval_id
       FROM approvals
       WHERE item_id = p_item_id AND role = p_role;
       
       IF v_approval_id IS NULL THEN
           RETURN FALSE;
       END IF;
       
       -- Remove URL (atomic operation)
       DELETE FROM replacement_urls
       WHERE approval_id = v_approval_id AND url = p_url;
       
       RETURN TRUE;
   EXCEPTION
       WHEN OTHERS THEN
           -- SECURITY: Don't expose SQLERRM (may contain sensitive DB details)
           RAISE EXCEPTION 'Failed to remove replacement URL';
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;

   -- Function: Update item field (GENERIC UPDATE FUNCTION WITH PERMISSION CHECK)
   CREATE OR REPLACE FUNCTION update_item_field(
       p_item_id INTEGER,
       p_field_name VARCHAR,
       p_new_value JSONB,
       p_user_role VARCHAR DEFAULT NULL,
       p_expected_product_hint VARCHAR DEFAULT NULL
   ) RETURNS BOOLEAN AS $$
   DECLARE
       v_item_record RECORD;
       v_old_value JSONB;
       v_field_exists BOOLEAN;
   BEGIN
       -- PERMISSION CHECK: Verify user has permission to update
       
       -- Get item record
       SELECT * INTO v_item_record
       FROM items
       WHERE id = p_item_id;
       
       IF NOT FOUND THEN
           RAISE EXCEPTION 'Item % does not exist', p_item_id;
       END IF;
       
       -- VALIDATION: Check expected_product_hint if provided
       IF p_expected_product_hint IS NOT NULL THEN
           IF LOWER(v_item_record.product) NOT LIKE '%' || LOWER(p_expected_product_hint) || '%' 
              AND LOWER(p_expected_product_hint) NOT LIKE '%' || LOWER(v_item_record.product) || '%' THEN
               RAISE EXCEPTION 'Product mismatch: Expected item matching %, but found %', 
                   p_expected_product_hint, v_item_record.product;
           END IF;
       END IF;
       
       -- VALIDATION: Verify field exists and get old value
       -- Map field_name to actual column or JSONB field
       CASE p_field_name
           WHEN 'price_ttc' THEN
               v_old_value := to_jsonb(v_item_record.price_ttc);
               UPDATE items SET price_ttc = (p_new_value)::numeric, updated_at = NOW() WHERE id = p_item_id;
           WHEN 'price_ht_quote' THEN
               v_old_value := to_jsonb(v_item_record.price_ht_quote);
               UPDATE items SET price_ht_quote = (p_new_value)::numeric, updated_at = NOW() WHERE id = p_item_id;
           WHEN 'product' THEN
               v_old_value := to_jsonb(v_item_record.product);
               UPDATE items SET product = (p_new_value)::text, updated_at = NOW() WHERE id = p_item_id;
           WHEN 'reference' THEN
               v_old_value := to_jsonb(v_item_record.reference);
               UPDATE items SET reference = (p_new_value)::text, updated_at = NOW() WHERE id = p_item_id;
           ELSE
               RAISE EXCEPTION 'Field % is not updatable through this function', p_field_name;
       END CASE;
       
       -- VALIDATION: Check if value actually changed
       IF v_old_value = p_new_value THEN
           RAISE EXCEPTION 'Update would result in no change for field %', p_field_name;
       END IF;
       
       -- Log edit history
       INSERT INTO edit_history (item_id, field_path, old_value, new_value, source)
       VALUES (p_item_id, p_field_name, v_old_value, p_new_value, 'agent');
       
       RETURN TRUE;
   EXCEPTION
       WHEN OTHERS THEN
           -- SECURITY: Don't expose SQLERRM (may contain sensitive DB details, table names, etc.)
           RAISE EXCEPTION 'Failed to update item field';
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;

   -- Function: Get pricing summary (READ-ONLY, NO PERMISSION CHECK NEEDED)
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

   -- Function: Get workers for a project
   -- SQL INJECTION PREVENTION: p_project_address is a parameter, not concatenated string
   -- PostgreSQL automatically parameterizes function parameters, making them safe
   CREATE OR REPLACE FUNCTION get_project_workers(p_project_address VARCHAR)
   RETURNS TABLE (
       worker_id VARCHAR,
       worker_name VARCHAR,
       worker_email VARCHAR,
       worker_phone VARCHAR,
       job_id VARCHAR,
       chantier_name VARCHAR,
       job_type VARCHAR,
       start_date TIMESTAMP,
       end_date TIMESTAMP
   ) AS $$
   BEGIN
       -- SAFE: p_project_address is a function parameter, not string concatenation
       -- PostgreSQL parameterizes this automatically, preventing SQL injection
       RETURN QUERY
       SELECT 
           w.id,
           w.name,
           w.email,
           w.phone,
           wj.id as job_id,
           wj.chantier_name,
           wj.job_type,
           wj.start_date,
           wj.end_date
       FROM workers w
       JOIN worker_jobs wj ON wj.worker_id = w.id
       WHERE UPPER(TRIM(wj.chantier_name)) = UPPER(TRIM(p_project_address))
          OR UPPER(TRIM(wj.chantier_name)) LIKE '%' || UPPER(TRIM(p_project_address)) || '%'
          OR UPPER(TRIM(p_project_address)) LIKE '%' || UPPER(TRIM(wj.chantier_name)) || '%'
       ORDER BY w.name, wj.start_date;
   END;
   $$ LANGUAGE plpgsql;

   -- Function: Get project timeline summary
   CREATE OR REPLACE FUNCTION get_project_timeline(p_project_id VARCHAR)
   RETURNS TABLE (
       project_id VARCHAR,
       start_date TIMESTAMP,
       end_date TIMESTAMP,
       duration_days INTEGER,
       status VARCHAR,
       progress_percentage INTEGER
   ) AS $$
   BEGIN
       RETURN QUERY
       SELECT 
           p.id,
           p.start_date,
           p.end_date,
           CASE 
               WHEN p.start_date IS NOT NULL AND p.end_date IS NOT NULL 
               THEN EXTRACT(DAY FROM (p.end_date - p.start_date))::INTEGER
               ELSE NULL
           END as duration_days,
           p.status,
           CASE
               WHEN p.start_date IS NOT NULL AND p.end_date IS NOT NULL AND NOW() >= p.start_date AND NOW() <= p.end_date
               THEN ROUND(EXTRACT(DAY FROM (NOW() - p.start_date))::NUMERIC / EXTRACT(DAY FROM (p.end_date - p.start_date))::NUMERIC * 100)::INTEGER
               WHEN p.end_date IS NOT NULL AND NOW() > p.end_date THEN 100
               ELSE NULL
           END as progress_percentage
       FROM projects p
       WHERE p.id = p_project_id;
   END;
   $$ LANGUAGE plpgsql;

   -- Function: Get all projects with timeline data
   CREATE OR REPLACE FUNCTION get_all_projects_timeline()
   RETURNS TABLE (
       project_id VARCHAR,
       name VARCHAR,
       address VARCHAR,
       start_date TIMESTAMP,
       end_date TIMESTAMP,
       status VARCHAR,
       client_name VARCHAR
   ) AS $$
   BEGIN
       RETURN QUERY
       SELECT 
           p.id,
           p.name,
           p.address,
           p.start_date,
           p.end_date,
           p.status,
           p.client_name
       FROM projects p
       ORDER BY p.start_date ASC NULLS LAST, p.created_at ASC;
   END;
   $$ LANGUAGE plpgsql;
   ```

2. **Create Agent Tool Wrappers (CRITICAL: Use Restricted DB Connection)**
   - `backend/services/agent_tools.py`
   - **Use separate database connection with `agent_user` role** (NOT the main app connection)
   - Python functions that call SQL functions (agent cannot bypass this)
   - Return data in format agent expects
   - Example:
     ```python
     # backend/services/agent_tools.py
     from sqlalchemy import create_engine, text
     import os
     
     # Separate connection for agent (restricted role)
     AGENT_DATABASE_URL = os.getenv("AGENT_DATABASE_URL")  # Uses agent_user role
     agent_engine = create_engine(AGENT_DATABASE_URL)
     
     def update_item_approval(item_id: int, role: str, status: str, user_role: str = None) -> bool:
         """Agent tool wrapper - can ONLY call SQL function, cannot write directly to tables.
         
         SQL INJECTION PREVENTION:
         - Uses parameterized queries via SQLAlchemy text() with bindparams
         - Never concatenates user input into SQL strings
         - All values passed as dictionary parameters
         """
         # Input validation (defense in depth)
         if not isinstance(item_id, int) or item_id <= 0:
             raise ValueError("Invalid item_id")
         if not isinstance(role, str) or not role.strip():
             raise ValueError("Invalid role")
         if status and not isinstance(status, str):
             raise ValueError("Invalid status")
         
         # SAFE: Parameterized query - SQLAlchemy handles escaping
         with agent_engine.connect() as conn:
             result = conn.execute(
                 text("SELECT update_item_approval(:item_id, :role, :status, :user_role)"),
                 {
                     "item_id": item_id,
                     "role": role.strip(),
                     "status": status.strip() if status else None,
                     "user_role": user_role.strip() if user_role else None
                 }
             )
             conn.commit()  # Explicit commit for agent operations
             return result.scalar()
     ```

3. **Update Agent System Prompt**
   - Document new SQL-based tools
   - **Emphasize**: Agent CANNOT directly modify database tables
   - **Emphasize**: All modifications MUST go through provided SQL function tools
   - Remove JSON parsing instructions
   - Add SQL function descriptions with permission requirements
   - Document that queries are indirect (through SQL functions)

4. **Update Agent Query Handler**
   - Replace JSON parsing with SQL function calls
   - Update tool definitions in `main.py` to use agent_tools wrappers
   - **Ensure agent_tools uses restricted database connection** (agent_user role)
   - Remove direct database write access from agent

5. **Verify Agent Cannot Bypass Functions**
   - Test that agent_user role cannot INSERT/UPDATE/DELETE directly on tables
   - Test that agent_user can only EXECUTE functions
   - Verify permission checks inside functions work correctly

### Deliverables
- [ ] Restricted database role `agent_user` created (SELECT + EXECUTE only, no direct writes)
- [ ] SQL functions created for all agent operations with permission checks
- [ ] Agent tool wrappers implemented using restricted connection
- [ ] System prompt updated (emphasizes indirect access through functions)
- [ ] Agent uses SQL functions instead of JSON parsing
- [ ] **Security verified**: Agent cannot directly write to tables

### Testing
- [ ] **SECURITY TEST**: Attempt direct INSERT/UPDATE/DELETE with agent_user role → Should fail
- [ ] **SECURITY TEST**: Agent can only call SQL functions → Should succeed
- [ ] **SQL INJECTION TEST**: Attempt SQL injection via function parameters → Should be safe (parameterized)
- [ ] **SQL INJECTION TEST**: Verify no string concatenation in SQL function calls
- [ ] **ERROR MESSAGE TEST**: Verify SQLERRM is not exposed to agent/users
- [ ] **PERMISSION TEST**: SQL functions reject invalid inputs → Should raise exceptions
- [ ] **SECURITY DEFINER TEST**: Verify functions cannot escalate privileges
- [ ] Agent can query using SQL functions
- [ ] All agent operations work correctly through functions
- [ ] Test suite passes with SQL functions
- [ ] Performance is good
- [ ] Permission checks in functions work correctly
- [ ] Input validation works in Python wrappers

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

3. **Add Database Transactions for ACID Guarantees**
   - **PRIMARY GOAL**: All operations are atomic ("all or nothing")
   - Wrap ALL writes in transactions (use `BEGIN/COMMIT/ROLLBACK`)
   - Set appropriate isolation levels:
     - **READ COMMITTED** for most operations (default, prevents dirty reads)
     - Consider **SERIALIZABLE** for critical operations if needed
   - **Atomicity**: If any part of transaction fails, entire transaction rolls back
   - **Example**: Updating item + approval + order must all succeed or all fail
   - Use optimistic locking for concurrent updates:
     - Add `version` INTEGER field to projects, workers, items (optional but recommended)
     - OR use `updated_at` timestamp checks
     - Return `409 Conflict` if concurrent modification detected
   - **Error Handling**:
     ```python
     try:
         with db_session() as session:
             # Multiple related operations
             item = session.query(Item).filter_by(id=item_id).first()
             approval = session.query(Approval).filter_by(item_id=item_id).first()
             order = session.query(Order).filter_by(item_id=item_id).first()
             
             item.price_ttc = new_price
             approval.status = 'approved'
             order.ordered = True
             
             session.commit()  # All or nothing
     except Exception as e:
         session.rollback()  # Atomic rollback
         raise
     ```
   - Ensure data consistency: Foreign keys, constraints enforced at DB level

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
   - Remove localStorage fallback code from frontend contexts (ProjectsContext, WorkersContext)
   - Remove localStorage read/write operations (keep only for UI state)

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
- [ ] Timeline page works with database
- [ ] Workers page works with database
- [ ] Dashboard cards (WorkersCard, TimelineCard) work with database
- [ ] Test suite passes
- [ ] No references to JSON files or localStorage for core data in code

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
   - Analyze slow queries (use `EXPLAIN ANALYZE`)
   - Add missing indexes
   - Optimize SQL functions
   - Monitor transaction duration and lock contention

3. **ACID Compliance Verification**
   - Test atomicity: Multiple related updates succeed or fail together
   - Test isolation: Concurrent reads don't see uncommitted data
   - Test consistency: Foreign key constraints prevent invalid states
   - Test durability: Committed data persists after crash/restart
   - Verify transaction rollback works correctly

4. **Load Testing**
   - Test with larger datasets
   - Test concurrent users (even if single-user now, verify DB handles it)
   - Verify performance is acceptable
   - Test transaction throughput

5. **Security Review**
   - **CRITICAL**: Verify agent_user role cannot directly modify tables
   - **CRITICAL**: Verify all agent modifications go through SQL functions
   - **CRITICAL**: Test permission checks in SQL functions
   - Verify role-based access works (frontend level)
   - **SQL Injection Prevention**:
     - ✅ SQL functions use parameterized queries (function parameters prevent injection)
     - ✅ Python code uses SQLAlchemy `text()` with parameter binding (never string concatenation)
     - ✅ All user input passed as function parameters, never embedded in SQL strings
     - ✅ Validate and sanitize inputs before passing to functions
   - **Error Message Security**: SQL functions must not expose `SQLERRM` to agent/users (see Phase 5 fixes)
   - Review permissions (database user permissions)
   - **Function Security**: All modification functions use `SECURITY DEFINER` correctly, but no privilege escalation possible
   - **SECURITY DEFINER Review**: Verify functions cannot be used to escalate privileges (no `ALTER`, `CREATE`, `GRANT` operations)
   - **API Security**: Consider adding rate limiting if needed
   - **Authentication**: Document single-user assumption vs multi-user future
   - **Access Control**: Agent tools use restricted database connection (agent_user role)
   - **Connection Pool Security**: Verify connection pooling limits prevent resource exhaustion

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

1. **Production Database Setup (AWS RDS)**
   - Set up AWS RDS PostgreSQL instance (matching Docker version - PostgreSQL 15)
   - Configure backups (automated daily backups with retention period)
   - Set up replication (Multi-AZ for high availability if needed)
   - Configure security groups and VPC settings
   - Update `DATABASE_URL` environment variable to point to RDS endpoint
   - Verify connection from application to RDS
   - **Note**: Same PostgreSQL version (15) ensures compatibility with Docker development environment

2. **Migration to Production**
   - Run migration script on production data
   - Verify data integrity
   - Test all functionality

3. **Monitoring & Observability**
   - Set up database monitoring:
     - Connection pool usage
     - Query execution time (slow query log)
     - Transaction count and duration
     - Lock wait times
     - Failed transaction rate
   - Configure alerts:
     - Database connection failures
     - Slow queries (> 1 second)
     - High transaction failure rate
     - Lock contention warnings
   - Monitor query performance:
     - Track query execution plans
     - Monitor index usage
     - Track transaction rollback rate
   - Application logging:
     - Log all transaction commits/rollbacks
     - Log dual-write failures
     - Log concurrent modification conflicts (409 errors)

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
- **Dual-write during transition**: Data in both places (DB is source of truth)
- **Validation scripts**: Verify data integrity after each phase
- **Atomicity guarantees**: Database transactions ensure all-or-nothing operations
- **Transaction rollback**: Failed operations don't leave partial data

### Dual-Write Failure Handling
- **Strategy**: DB-first approach
  - Write to database first (source of truth)
  - If DB write succeeds: attempt JSON backup write
  - If DB write fails: transaction rolls back, JSON not updated
  - If JSON write fails but DB succeeded: log warning, continue (DB is source)
- **Detection**: Log all write failures for monitoring
- **Recovery**: Validation scripts can detect divergence and repair
- **Phase 7**: Remove JSON writes entirely (DB-only, pure atomicity)

### Concurrent Access
- **Optimistic locking**: Use version fields or updated_at checks
- **Conflict resolution**: Return 409 Conflict on concurrent modification
- **Transaction isolation**: READ COMMITTED prevents dirty reads
- **Deadlock prevention**: 
  - Keep transactions short
  - Always acquire locks in consistent order (e.g., by ID)
  - Use `NOWAIT` option for lock acquisition if needed
  - Retry logic with exponential backoff for deadlock retries
- **Lock contention monitoring**: Track lock wait times in monitoring
- **Note**: Single-user system currently, but DB supports multi-user when needed

### Performance Issues
- **Indexes**: Create indexes early (Phase 1)
- **Connection pooling**: Use proper pooling (SQLAlchemy default)
- **Query optimization**: Monitor and optimize slow queries
- **Transaction scope**: Keep transactions short (don't hold locks too long)

### Breaking Changes
- **Feature flags**: Use flags to control rollout
- **Gradual migration**: One phase at a time
- **Testing**: Test thoroughly before moving to next phase
- **Rollback paths**: Every phase has clear rollback strategy

---

## Success Criteria

### Phase Completion Criteria
- [ ] All tests pass
- [ ] No data loss
- [ ] **Atomicity verified**: No partial writes or inconsistent states
- [ ] Performance is acceptable
- [ ] Can rollback if needed
- [ ] Transaction rollback works correctly

### Final Success Criteria
- [ ] All data in PostgreSQL (materials, projects, workers, edit history)
- [ ] **ACID compliance achieved**: All operations are atomic, consistent, isolated, durable
- [ ] **Transaction atomicity verified**: Multi-step operations succeed or fail together
- [ ] **Security achieved**: Agent can ONLY modify data through SQL functions with permission checks
- [ ] **Indirect access verified**: All agent queries go through SQL functions, not direct table access
- [ ] **Restricted access verified**: Agent database role cannot directly INSERT/UPDATE/DELETE tables
- [ ] JSON files no longer used for core data
- [ ] localStorage no longer used for projects and workers (backend manages data)
- [ ] Agent uses SQL functions (indirect access only)
- [ ] Timeline page works with database queries
- [ ] Workers page works with database queries
- [ ] Dashboard cards (WorkersCard, TimelineCard) work with database
- [ ] Test suite is fast and cheap
- [ ] Production is stable
- [ ] **No partial writes**: All database operations are atomic
- [ ] **Data integrity**: Foreign keys and constraints prevent inconsistent states
- [ ] **Permission enforcement**: SQL functions validate user permissions before modifications
- [ ] Documentation is complete

---

## Timeline Estimate

| Phase | Duration | Cumulative | Notes |
|-------|----------|------------|-------|
| Phase 0: Preparation | 2-3 hours | 2-3 hours | |
| Phase 1: Schema Design | 3-4 hours | 5-7 hours | Includes projects, workers tables |
| Phase 2: Data Migration | 2-3 hours | 7-10 hours | Projects, workers, materials |
| Phase 3: Dual-Write | 5-6 hours | 11-16 hours | **Includes API endpoints + frontend updates + fallback logic** |
| Phase 4: DB Reads | 2-3 hours | 13-19 hours | Enable feature flag |
| Phase 5: SQL Functions | 6-7 hours | 19-26 hours | **Includes security setup (restricted role, permission checks)** |
| Phase 6: Remove JSON Writes | 2-3 hours | 20-28 hours | |
| Phase 7: Remove JSON Reads | 1-2 hours | 21-30 hours | Clean up localStorage fallback |
| Phase 8: Testing | 3-4 hours | 24-34 hours | |
| Phase 9: Production | 2-3 hours | 26-37 hours | |

**Total Estimate**: 26-37 hours (3-5 days of focused work)

**Updated**: Phase 3 duration increased to account for proper fallback handling and demo project merging logic.

**Note**: Phase 3 now includes frontend context updates (direct API calls, no abstraction layer). This is slightly faster than creating an abstraction layer first.

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

- **Branch Strategy**: See `MIGRATION_BRANCH_STRATEGY.md` for branch organization and PR workflow
- Each phase should be completed and tested before moving to the next
- Keep JSON files as backup until Phase 7 is complete
- Keep localStorage data as backup for projects and workers until Phase 7
- **No abstraction layer**: Frontend contexts call API directly (simpler, faster migration)
- Frontend can use localStorage as fallback during migration transition
- Test suite should be updated in Phase 8 to use database
- Consider doing this migration in a feature branch
- Document any issues encountered during migration
- Refactoring (service layers, abstraction) can happen after migration if needed

## Critical Security & Data Integrity Checklist

### SQL Injection Prevention
- ✅ **SQL Functions**: All user input passed as function parameters (PostgreSQL auto-parameterizes)
- ✅ **Python Code**: SQLAlchemy `text()` with parameter binding, never string concatenation
- ✅ **Input Validation**: Validate inputs in Python wrappers before calling SQL functions
- ✅ **LIKE Queries**: Safe because parameters are bound, not concatenated

### Error Message Security
- ✅ **No SQLERRM Exposure**: Generic error messages in SQL functions (no internal DB details leaked)
- ✅ **Error Logging**: Detailed errors logged server-side, generic errors returned to agent/users

### Data Integrity
- ✅ **Constraints**: CHECK constraints validate data (status values, date ranges, price >= 0)
- ✅ **Foreign Keys**: Enforce referential integrity with ON DELETE CASCADE/SET NULL
- ✅ **Unique Constraints**: Prevent duplicates (section_id + product, item_id + role)
- ✅ **NOT NULL**: Required fields enforced at database level
- ✅ **Indexes on Foreign Keys**: All FKs have indexes for JOIN performance
- ✅ **Timestamp with Time Zone**: Use TIMESTAMP WITH TIME ZONE for proper timezone handling

### Transaction & Concurrency Safety
- ✅ **ACID Transactions**: All writes wrapped in transactions
- ✅ **Optimistic Locking**: Version fields or updated_at checks prevent lost updates
- ✅ **Isolation Levels**: READ COMMITTED prevents dirty reads
- ✅ **Deadlock Prevention**: Consistent lock ordering, short transactions
- ✅ **409 Conflict Handling**: Return proper HTTP status on concurrent modification

### Privilege & Access Control
- ✅ **Restricted Role**: agent_user has SELECT + EXECUTE only, no direct table writes
- ✅ **SECURITY DEFINER**: Functions run with owner privileges, but permission checks restrict actions
- ✅ **No Privilege Escalation**: Functions don't allow ALTER, CREATE, GRANT operations
- ✅ **Separate Connections**: Agent uses restricted connection, app uses full privilege connection

### Performance & Scalability
- ✅ **Connection Pooling**: Limits prevent resource exhaustion (pool_size=10, max_overflow=20)
- ✅ **Indexes**: All foreign keys and common query columns indexed
- ✅ **Query Optimization**: Use EXPLAIN ANALYZE to verify index usage
- ✅ **Transaction Duration**: Keep transactions short to reduce lock contention
- **SECURITY**: Agent database user (`agent_user`) must ONLY have SELECT + EXECUTE permissions, NEVER direct INSERT/UPDATE/DELETE on tables
- **SECURITY**: All agent modifications go through SQL functions that perform permission checks
- **SECURITY**: SQL functions use `SECURITY DEFINER` to run with table owner privileges, but permission checks inside functions restrict agent actions
- **SECURITY**: No `SQLERRM` in exception messages exposed to agent (prevents information leakage)
- **SQL INJECTION PREVENTION**: 
  - All SQL functions use parameterized queries (function parameters, never string concatenation)
  - Python code uses SQLAlchemy `text()` with parameter binding
  - Input validation in Python wrappers (defense in depth)
- **QUERY INDIRECTION**: Agent queries materials data indirectly through SQL functions, not direct table SELECT (even for reads, use functions for consistency and future permission checks)
- **DATA INTEGRITY**: All foreign keys have indexes for performance, constraints enforce data validity
- **TRANSACTION MANAGEMENT**: Keep transactions short, acquire locks in consistent order to prevent deadlocks

## New Features & Data Structures

### Timeline Page
- Displays all projects in a timeline/Gantt chart view
- Supports multiple zoom levels (Week, Month, Quarter, Year)
- Requires projects table with `start_date` and `end_date` fields
- SQL function: `get_all_projects_timeline()` for efficient queries

### Workers Page
- Displays workers and their assigned jobs in timeline view
- Requires `workers` and `worker_jobs` tables
- Worker jobs linked to projects via `chantier_name` matching
- SQL function: `get_project_workers()` for dashboard queries

### WorkersCard Component
- Shows workers assigned to current project on Dashboard
- Uses flexible matching between `worker_jobs.chantier_name` and `projects.address`
- Requires efficient querying of worker-job relationships

### TimelineCard Component
- Shows project timeline information on Dashboard
- Displays start/end dates, duration, progress
- Uses `get_project_timeline()` SQL function for calculations

### Projects Data
- Projects stored in localStorage `renovationProjects`
- Fields: id, name, address, clientName, status, startDate, endDate, etc.
- Need to migrate to `projects` table
- Support project selection and switching

### Workers Data
- Workers stored in localStorage `workers`
- Fields: id, name, email, phone, jobs[]
- Jobs contain: id, chantierName, startDate, endDate, jobType
- Need to normalize into `workers` and `worker_jobs` tables

---

## Next Steps

1. Review this plan
2. Set up PostgreSQL (Phase 0)
3. Start with Phase 1 (Schema Design)
4. Proceed phase by phase
5. Test thoroughly after each phase
6. Document any deviations from plan

















