# Database Migration Branch Strategy

This document outlines the branch naming convention and PR workflow for the PostgreSQL migration (see `MIGRATION_PLAN.md`).

## Branch Structure

The migration is divided into 8 logical branches, grouped by milestones rather than strictly one-per-phase:

### 1. `feature/db-migration-setup-schema`
**Phases:** Phase 0 (Setup) + Phase 1 (Schema Design)  
**Duration:** 5-7 hours  
**Purpose:** Foundation - database setup, schema creation, models  
**Can't proceed without:** ✅ Critical foundation

### 2. `feature/db-migration-data-import`
**Phases:** Phase 2 (Data Migration)  
**Duration:** 2-3 hours  
**Purpose:** Migrate existing data from JSON/localStorage to PostgreSQL  
**Can't proceed without:** Phase 0-1 complete

### 3. `feature/db-migration-dual-write`
**Phases:** Phase 3 (Dual-Write Implementation)  
**Duration:** 5-6 hours  
**Purpose:** Implement dual-write for materials, create API endpoints for projects/workers  
**Can't proceed without:** Phase 2 complete  
**Critical:** Major milestone with backend + frontend changes

### 4. `feature/db-migration-db-reads`
**Phases:** Phase 4 (Read from Database)  
**Duration:** 2-3 hours  
**Purpose:** Switch reads from JSON to database  
**Can't proceed without:** Phase 3 complete

### 5. `feature/db-migration-sql-functions` ⚠️ **SECURITY-CRITICAL**
**Phases:** Phase 5 (SQL Functions for Agent)  
**Duration:** 6-7 hours  
**Purpose:** Create restricted agent role, SQL functions with permission checks  
**Can't proceed without:** Phase 4 complete  
**Critical:** Security review required - agent access control

### 6. `feature/db-migration-remove-json`
**Phases:** Phase 6 (Remove JSON Writes) + Phase 7 (Remove JSON Reads)  
**Duration:** 3-5 hours  
**Purpose:** Cleanup - remove JSON/localStorage dependencies  
**Can't proceed without:** Phase 5 complete  
**Note:** Logical cleanup unit

### 7. `feature/db-migration-testing`
**Phases:** Phase 8 (Testing & Optimization)  
**Duration:** 3-4 hours  
**Purpose:** Performance testing, security verification, optimization  
**Can't proceed without:** Phase 6-7 complete

### 8. `feature/db-migration-production`
**Phases:** Phase 9 (Production Deployment)  
**Duration:** 2-3 hours  
**Purpose:** Production database setup, monitoring, deployment  
**Can't proceed without:** Phase 8 complete

## Rationale

### Why 8 branches instead of 9 phases?
- **Logical grouping:** Phase 0+1 are foundation, Phase 6+7 are cleanup
- **Reviewable chunks:** Each branch represents a clear milestone
- **Safer rollback:** Can revert to any major milestone
- **Security focus:** Phase 5 gets dedicated review as security-critical

### Branch Naming Convention
- **Prefix:** `feature/db-migration-`
- **Suffix:** Descriptive milestone name (`setup-schema`, `dual-write`, etc.)
- **Kebab-case:** Standard convention for branch names

## PR Workflow

### For Each Branch

1. **Complete the branch work** following `MIGRATION_PLAN.md` tasks
2. **Test thoroughly** using the phase testing checklist
3. **Create PR** with:
   - **Title:** `[Migration] <Branch Name>: <Brief Description>`
   - **Description:**
     - Which phases are included
     - Key changes summary
     - Testing performed
     - Breaking changes (if any)
     - Next steps
   - **Labels:** `migration`, `database`, `security` (for Phase 5)
   - **Reviewers:** Assign for review
   - **Checklist:** Include phase completion criteria

### PR Template Example

```markdown
## Migration Branch: feature/db-migration-setup-schema

### Phases Included
- Phase 0: Preparation & Setup
- Phase 1: Schema Design & Models

### Changes
- Docker PostgreSQL setup
- Database schema with constraints
- SQLAlchemy models
- Alembic migrations

### Testing
- [ ] Docker container runs successfully
- [ ] Schema created with all tables
- [ ] Foreign key constraints work
- [ ] Indexes created correctly
- [ ] Models can be imported

### Breaking Changes
None - this is foundation work.

### Next Steps
Proceed to `feature/db-migration-data-import` branch.
```

## Merge Strategy

- **Merge to `main`** after approval
- **No force push** to `main`
- **Keep branches** for reference until migration is complete
- **Tag releases** at major milestones (e.g., `migration/v1.0-phase5-complete`)

## Branch Lifecycle

1. Create branch from `main`
2. Complete phase work
3. Create PR
4. Review & test
5. Merge to `main`
6. Tag milestone (optional)
7. Create next branch from `main`

## Current Status

- ✅ **Branch Created:** `feature/db-migration-setup-schema`
- ⏳ **Next:** Complete Phase 0 + Phase 1
- 📝 **Reference:** See `MIGRATION_PLAN.md` for detailed phase tasks

---

**Last Updated:** Created during initial migration planning  
**Maintained By:** Development team  
**Related Docs:** `MIGRATION_PLAN.md`, `MIGRATION_SQL_REFERENCE.md`

