# Database Schema Overview

## Table of Contents
1. [Big Picture](#big-picture)
2. [Core Tables](#core-tables)
3. [Schema Design Philosophy](#schema-design-philosophy)
4. [Why This Design?](#why-this-design)
5. [Data Flow & Relationships](#data-flow--relationships)
6. [Migration Context](#migration-context)
7. [Key Design Decisions](#key-design-decisions)

---

## Big Picture

**France Renovation Contractor** is a project management application for construction contractors. It helps manage:

1. **Renovation Projects (Chantiers)**: Track multiple construction projects with timelines, status, and financials
2. **Materials & Procurement**: Manage materials, approvals, orders, and delivery for each project
3. **Worker Management**: Assign workers to projects and track their job assignments over time
4. **Approval Workflows**: Two-tier approval system (client + contractor) for materials
5. **Audit Trail**: Complete history of all changes to materials and approvals

The database schema supports all these domains with normalized, relational tables that ensure data integrity and enable complex queries.

---

## Core Tables

The schema consists of **12 tables** organized into four main domains:

### 🔐 **Authentication & Access Control Domain** (1 table)

#### `users`
**Purpose**: User accounts for authentication and authorization

**Key Fields**:
- `id`, `email`, `password_hash` - Authentication credentials
- `role` - User type: `'contractor'`, `'client'`, `'worker'`, `'subcontractor'`
- `zulip_user_id` - Links to Zulip bot integration (nullable)
- `last_login` - Track user activity

**Why Critical?**: Enables multi-user access control. Contractors, clients, and workers can log in. Projects link to users via `contractor_id` and `client_id`. Workers can optionally link their accounts via `user_id`.

---

### 🏗️ **Project Management Domain** (3 tables)

#### `projects`
**Purpose**: Master table for all renovation projects/chantiers

**Key Fields**:
- `id`, `name`, `address` - Project identification
- `contractor_id` → references `users(id)` - Contractor managing this project
- `client_id` → references `users(id)` - Client owning this project
- `client_name` - **REDUNDANT**: Derivable from `client_id` (kept for migration compatibility)
- `status` - Lifecycle state: `'draft'`, `'ready'`, `'active'`, `'completed'`, `'archived'` (enum)
- Quote status tracked in separate `quotes` table (supports multiple quotes per project)
- `start_date`, `end_date` - Project timeline (with validation: start ≤ end)
- `invoice_count`, `percentage_paid` - Financial tracking

**Why Core?**: Everything revolves around projects. Materials belong to projects. Workers are assigned to projects. This is the root of the hierarchy.

**Access Control**: The `contractor_id` and `client_id` foreign keys enable role-based access:
- Contractors see all projects they manage
- Clients see only their own projects
- Queries filter by `contractor_id` or `client_id` based on logged-in user

---

#### `workers`
**Purpose**: Employee/salaried worker information

**Key Fields**:
- `id`, `name`, `email`, `phone` - Contact information
- `user_id` → references `users(id)` (nullable) - Optional link to user account
- Timestamps for tracking creation/updates

**Why Core?**: Workers are independent entities that can be assigned to multiple projects over time.

**Design Note**: `user_id` is nullable because not all workers need user accounts. Workers who log in (e.g., to check their schedule via Zulip bot) have a `user_id`. Workers managed by contractors but who don't log in have `user_id = NULL`. The `email` field is kept because some workers won't have accounts but still need contact info.

---

#### `worker_jobs`
**Purpose**: Assigns workers to specific jobs/tasks on projects

**Key Fields**:
- `worker_id` → references `workers(id)`
- `chantier_name` - Logically links to project (by address/name)
- `job_type` - Type of work: `plumbing`, `electrical`, `demo`, etc.
- `start_date`, `end_date` - Timeline for this specific job assignment

**Design Note**: Uses `chantier_name` (string) rather than `project_id` (FK) because worker assignments can reference projects by name/address in a flexible way. This allows linking before project IDs are finalized, or linking to external projects.

**Why Separate?**: One worker can have many jobs across multiple projects and time periods. This normalized design enables timeline queries ("What jobs does John have in March?") and prevents data duplication.

---

### 📦 **Materials & Procurement Domain** (7 tables)

#### `sections`
**Purpose**: Material categories within a project (e.g., "Cuisine", "Salle de bain", "Chambre")

**Key Fields**:
- `id`, `label` - Category identification
- `project_id` → references `projects(id)` (CASCADE delete)

**Why Normalized?**: Instead of storing sections as nested objects in JSON, we normalize them to enable:
- Querying all sections across all projects
- Reusing section structures
- Efficient indexing and filtering

---

#### `items`
**Purpose**: Individual products/materials within a section

**Key Fields**:
- `section_id` → references `sections(id)` (CASCADE)
- `product` - Product name/description (TEXT for long descriptions)
- `reference`, `supplier_link` - Procurement information
- `labor_type` - Type of labor required using `work_type_enum`: `'demolition'`, `'plumbing'`, `'electrical'`, etc.
  - **Note**: Uses centralized `work_type_enum` shared with `worker_jobs.job_type` for consistency
- `price_ttc`, `price_ht_quote` - Pricing (TTC = with tax, HT = without tax quote)
- `UNIQUE(section_id, product)` - Prevents duplicate products in same section

**Why Core?**: Items are the central entity in the materials workflow. All approvals, orders, comments, and history revolve around items.

---

#### `approvals`
**Purpose**: Approval status tracking by role (client vs. contractor)

**Key Fields**:
- `item_id` → references `items(id)` (CASCADE)
- `role` - `'client'` or `'contractor'` - VARCHAR(20) with CHECK constraint
- `status` - Approval status enum: `'approved'`, `'rejected'`, `'change_order'`, `'pending'`, `'supplied_by'`, or `NULL`
- `note`, `validated_at` - Approval metadata
- `UNIQUE(item_id, role)` - One approval record per role per item

**Why Normalized?**: The original JSON stored approvals as nested objects:
```json
{
  "approvals": {
    "client": { "status": "approved", ... },
    "contractor": { "status": "pending", ... }
  }
}
```

By normalizing, we can:
- Query "all items pending client approval"
- Index on status for fast filtering
- Easily add new approval roles in the future
- Track approval history separately

---

#### `replacement_urls`
**Purpose**: Stores alternative/replacement product URLs for approvals

**Key Fields**:
- `approval_id` → references `approvals(id)` (CASCADE)
- `url` - Replacement product URL

**Why Separate Table?**: The original JSON stored `replacementUrls` as an array:
```json
{
  "approvals": {
    "client": {
      "replacementUrls": ["url1", "url2", "url3"]
    }
  }
}
```

PostgreSQL arrays could work, but a separate table enables:
- Querying all replacement URLs across all approvals
- Efficient indexing
- Future metadata per URL (description, reason, etc.)
- Better SQL query patterns

**Design Pattern**: This is a classic "array normalization" - converting nested arrays into one-to-many relationships.

---

#### `orders`
**Purpose**: Tracks procurement/ordering status for items

**Key Fields**:
- `item_id` → references `items(id)` (CASCADE, UNIQUE - one order per item)
- `ordered` - Boolean flag
- `order_date`, `delivery_date` - Dates in `'dd/mm'` format (with regex validation)
- `delivery_status` - Delivery status enum: `'pending'`, `'ordered'`, `'shipped'`, `'delivered'`, `'cancelled'`
- `quantity` - Order quantity (must be positive if set)

**Constraints**:
- `orders_ordered_with_date`: If `ordered = TRUE`, then `order_date` must be set (logical requirement)

**Why Separate?**: Order information is independent of approvals. An item can be approved but not yet ordered, or ordered but pending approval. Separation allows:
- Independent lifecycle tracking
- Efficient queries: "What items are ordered but not delivered?"
- Future expansion (multiple orders per item? shipment tracking?)

---

#### `comments`
**Purpose**: Role-based comments on items

**Key Fields**:
- `item_id` → references `items(id)` (CASCADE)
- `role` - `'client'` or `'contractor'`
- `comment_text` - Free-form text
- `UNIQUE(item_id, role)` - One comment per role per item

**Why Normalized?**: Similar to approvals, this separates client comments from contractor comments, enabling role-based filtering and future features (comment history, threading, etc.).

---

#### `edit_history`
**Purpose**: Complete audit trail of all changes to materials

**Key Fields**:
- `item_id` → references `items(id)` (SET NULL on delete - preserves history)
- `user_id` → references `users(id)` (SET NULL, nullable) - **Who made the change** (audit trail)
- `section_id`, `section_label`, `product` - Denormalized fields (preserved even if item deleted)
- `field_path` - Which field changed (e.g., `'price_ttc'`, `'approvals.client.status'`)
- `old_value`, `new_value` - Stored as JSONB for flexibility
- `source` - `'manual'` or `'agent'` (tracks if change came from AI/LLM, VARCHAR with CHECK)
- `timestamp` - When the change occurred

**Why Critical?**: Provides full auditability. Even if an item is deleted, its edit history is preserved (`SET NULL` on `item_id`). JSONB allows storing complex nested values without schema changes.

**Audit Features**: 
- `user_id` tracks **who** made the change (for accountability)
- `source` tracks **how** the change was made (manual vs agent/AI)
- Denormalized fields (`section_id`, `section_label`, `product`) preserve context even after item deletion

**Security Note**: The `source` field helps track AI/agent modifications for security monitoring.

---

#### `custom_fields`
**Purpose**: Extensibility - allows adding custom metadata to items without schema changes

**Key Fields**:
- `item_id` → references `items(id)` (CASCADE)
- `field_name` - Custom field identifier
- `field_value` - JSONB for flexible value storage
- `UNIQUE(item_id, field_name)`

**Why Important?**: Future-proofs the schema. If new requirements emerge (e.g., "warranty_period", "eco_label", "installation_notes"), they can be added as custom fields without migrations. JSONB allows storing structured data (objects, arrays) as values.

---

## Enums & Type System

The schema uses PostgreSQL enums for user-facing choices and multi-value fields:

### **Centralized Work Type Enum**
- **`work_type_enum`**: Used by both `items.labor_type` and `worker_jobs.job_type`
  - Values: `'demolition'`, `'structural'`, `'facade'`, `'exterior_joinery'`, `'plastering'`, `'plumbing'`, `'electrical'`, `'wall_covering'`, `'interior_joinery'`, `'kitchen'`, `'landscaping'`, `'price_revision'`
  - **Rationale**: Single source of truth for work types. Enables queries like "all plumbing-related work (materials + worker jobs)"
  - Frontend translates enum values (English) to display names (French)

### **Status & Role Enums**
- **`project_status_enum`**: `'draft'`, `'ready'`, `'active'`, `'completed'`, `'archived'`
- **`quote_status_enum`**: `'draft'`, `'sent'`, `'approved'`, `'rejected'`, `'superseded'` (in `quotes` table)
- **`approval_status_enum`**: `'approved'`, `'rejected'`, `'change_order'`, `'pending'`, `'supplied_by'`
- **`delivery_status_enum`**: `'pending'`, `'ordered'`, `'shipped'`, `'delivered'`, `'cancelled'`
- **`user_role_enum`**: `'contractor'`, `'client'`, `'worker'`, `'subcontractor'`

### **Simple VARCHAR + CHECK (2-value fields)**
- **`approvals.role` / `comments.role`**: VARCHAR(20) CHECK (`'client'`, `'contractor'`)
- **`edit_history.source`**: VARCHAR(10) CHECK (`'manual'`, `'agent'`)

**Design Philosophy**: Use enums for user selections and multi-value filters (better indexes, type safety). Use VARCHAR + CHECK for simple 2-value internal fields (simpler, still validated).

---

## Schema Design Philosophy

### 1. **Normalization First**
The original data was stored as deeply nested JSON:
```json
{
  "sections": [
    {
      "items": [
        {
          "approvals": {
            "client": {
              "replacementUrls": [...]
            }
          },
          "order": {...},
          "comments": {...}
        }
      ]
    }
  ]
}
```

We normalized this into relational tables because:
- **Query Flexibility**: SQL can join, filter, aggregate across any dimension
- **Data Integrity**: Foreign keys and constraints prevent orphaned/invalid data
- **Performance**: Indexes on normalized columns enable fast queries
- **Scalability**: Adding new relationships doesn't require restructuring entire JSON documents

### 2. **ACID Compliance**
The primary migration goal is **ACID transactions** ("all or nothing"). The schema supports this through:
- Foreign keys with CASCADE rules (consistent deletes)
- Check constraints (data validation at DB level)
- Transaction boundaries (multiple related changes succeed or fail together)
- Optimistic locking support (via `updated_at` timestamps)

### 3. **Security by Design**
- **Agent Restrictions**: The schema is designed for a restricted `agent_user` role that can only execute SQL functions (no direct table writes)
- **Audit Trail**: `edit_history` captures all changes with `user_id` (who) and `source` (how) tracking
- **User Authentication**: `users` table enables role-based access control (contractors see their projects, clients see theirs)
- **Validation**: Check constraints and enums prevent invalid states (negative prices, invalid statuses, date ranges)

### 4. **Access Control & User Management**
- **Users Table**: Centralized authentication for contractors, clients, and workers
- **Project Ownership**: `projects.contractor_id` and `projects.client_id` enable access control
- **Worker Accounts**: `workers.user_id` links workers to accounts (optional - some workers don't log in)
- **Zulip Integration**: `users.zulip_user_id` links user accounts to Zulip for bot integration

### 5. **Flexibility Where Needed**
- **JSONB Fields**: `edit_history.old_value/new_value` and `custom_fields.field_value` use JSONB for schema-less flexibility
- **Optional Foreign Keys**: `edit_history.item_id` and `edit_history.user_id` use `SET NULL` to preserve audit trail even after item/user deletion
- **Denormalization**: `projects.client_name` kept temporarily for migration compatibility (redundant but necessary during transition)

---

## Why This Design?

### **Problem: JSON Storage Limitations**

**Before Migration:**
- Data stored in `data/materials.json` (nested JSON)
- Projects/workers in browser `localStorage` (client-side only)
- No ACID guarantees (partial writes possible)
- No data validation (invalid states possible)
- Hard to query ("find all items pending approval across all projects")
- No referential integrity (orphaned data possible)
- No audit trail (limited edit history)

**After Migration:**
- Relational tables with foreign keys
- ACID transactions (all-or-nothing operations)
- Database-level validation (CHECK constraints)
- SQL queries for any use case
- Referential integrity (FKs prevent orphaned data)
- Complete audit trail (`edit_history`)

### **Normalization Rationale**

| Original Structure | Normalized Design | Benefit |
|-------------------|-------------------|---------|
| Nested `approvals` object | Separate `approvals` table with `role` column | Query by role, index by status |
| `replacementUrls` array | `replacement_urls` table (one row per URL) | Query URLs across all approvals, add metadata later |
| Single `items` array in JSON | `sections` + `items` tables | Query items across sections, efficient filtering |
| No project-material link | `sections.project_id` FK | Link materials to projects, CASCADE deletes |
| localStorage projects | `projects` table + `users` FKs | Centralized storage, timeline queries, access control |
| localStorage workers | `workers` + `worker_jobs` tables | Query worker assignments by date, multiple projects |
| String `chantier_name` reference | `worker_jobs.project_id` FK | Referential integrity, direct JOINs, no typos |
| No user authentication | `users` table | Multi-user support, role-based access, Zulip integration |
| Separate `labor_type` and `job_type` | Centralized `work_type_enum` | Single source of truth, consistent queries |

### **Performance Considerations**

**Indexes on Foreign Keys**: Every FK has an index (e.g., `idx_items_section`, `idx_approvals_item`) for fast JOINs.

**Composite Indexes**: 
- `idx_approvals_item_role` - Common query: "get approval for item X by role Y"
- `idx_worker_jobs_dates` - Timeline queries: "worker jobs in date range"
- `idx_projects_dates` - Project timeline queries

**Partial Indexes**:
- `idx_approvals_status WHERE status IS NOT NULL` - Only indexes non-null statuses (smaller index)
- `idx_projects_dates WHERE start_date IS NOT NULL` - Only indexes projects with dates

### **Data Integrity**

**Enums (Type Safety)**:
- `project_status_enum`, `quote_status_enum`, `approval_status_enum`, `delivery_status_enum`, `user_role_enum`, `work_type_enum`, `project_member_role_enum`
- Database enforces valid values, better indexes, cleaner queries

**Check Constraints**:
- `projects_date_range_valid`: `start_date <= end_date` (prevents invalid timelines)
- `items_price_ttc_valid`: Prices cannot be negative
- `orders_date_format`: Dates must match `'dd/mm'` regex pattern
- `orders_ordered_with_date`: If `ordered = TRUE`, then `order_date` must be set (logical requirement)
- `approvals.role` CHECK: Role must be `'client'` or `'contractor'`
- `edit_history.source` CHECK: Source must be `'manual'` or `'agent'`

**Unique Constraints**:
- `uq_items_section_product`: Prevents duplicate products in same section
- `uq_approvals_item_role`: One approval per role per item
- `uq_comments_item_role`: One comment per role per item
- `uq_custom_fields_item_field`: One custom field value per field name per item

**Foreign Keys with CASCADE**:
- Delete project → deletes sections → deletes items → deletes all related data
- Delete project → deletes worker_jobs (direct FK)
- Delete item → deletes approvals, orders, comments, custom_fields
- Delete approval → deletes replacement_urls
- Delete worker → deletes worker_jobs

**Foreign Keys with SET NULL** (preserve data, remove linkage):
- Delete user → SET NULL on `projects.contractor_id`, `projects.client_id`, `workers.user_id`, `edit_history.user_id`
- Delete item → SET NULL on `edit_history.item_id` (preserves audit trail)
- Delete user → SET NULL on `edit_history.user_id` (preserves audit trail, loses user link)

**Rationale**: SET NULL preserves data integrity while removing user/item linkages. Critical for audit trail - we want to know "what changed" even if the item/user is deleted.

---

## Data Flow & Relationships

### **Hierarchical Structure**

```
projects (1) ──< (N) sections (1) ──< (N) items
```

Projects contain multiple sections (categories). Sections contain multiple items (products).

### **Items Relationship Web**

```
items (1) ──< (N) approvals (1) ──< (N) replacement_urls
items (1) ──< (1) orders
items (1) ──< (N) comments
items (1) ──< (N) custom_fields
items (1) ──< (N) edit_history
```

Every item can have:
- Multiple approvals (one per role: client, contractor)
- Multiple replacement URLs (one per approval that has alternatives)
- One order record
- Multiple comments (one per role)
- Multiple custom fields
- Multiple edit history entries (audit trail)

### **Workers Structure**

```
workers (1) ──< (N) worker_jobs
projects (1) ──< (N) worker_jobs (direct FK)
users (1) ──< (0 or 1) workers.user_id (nullable, SET NULL)
```

Workers can have multiple job assignments. Each job has a **direct foreign key** to `projects` for referential integrity. Workers can optionally link to user accounts for login access.

### **Query Patterns Enabled**

1. **"All items pending client approval"**
   ```sql
   SELECT i.* FROM items i
   JOIN approvals a ON a.item_id = i.id
   WHERE a.role = 'client' AND a.status = 'pending';
   ```

2. **"Worker timeline for March 2025"**
   ```sql
   SELECT wj.*, p.name as project_name
   FROM worker_jobs wj
   JOIN projects p ON p.id = wj.project_id  -- Direct JOIN now possible
   WHERE wj.worker_id = 'john_doe'
     AND wj.start_date >= '2025-03-01'
     AND (wj.end_date IS NULL OR wj.end_date <= '2025-03-31');
   ```

3. **"All replacement URLs for rejected items"**
   ```sql
   SELECT ru.url FROM replacement_urls ru
   JOIN approvals a ON a.id = ru.approval_id
   JOIN items i ON i.id = a.item_id
   WHERE a.status = 'rejected';
   ```

4. **"Project materials summary"**
   ```sql
   SELECT p.name, COUNT(DISTINCT s.id) as section_count, 
          COUNT(i.id) as item_count
   FROM projects p
   LEFT JOIN sections s ON s.project_id = p.id
   LEFT JOIN items i ON i.section_id = s.id
   WHERE p.id = 'project_123'
   GROUP BY p.id, p.name;
   ```

5. **"All projects for a contractor"** (Access Control)
   ```sql
   SELECT p.* FROM projects p
   WHERE p.contractor_id = 'user_contractor_123';
   ```

6. **"All plumbing-related work (materials + jobs)"** (Centralized work_type)
   ```sql
   SELECT 'material' as type, i.product, i.labor_type as work_type
   FROM items i
   WHERE i.labor_type = 'plumbing'
   UNION ALL
   SELECT 'worker_job' as type, wj.id, wj.job_type as work_type
   FROM worker_jobs wj
   WHERE wj.job_type = 'plumbing';
   ```

7. **"Who changed this item?"** (Audit Trail)
   ```sql
   SELECT eh.*, u.email as changed_by_email
   FROM edit_history eh
   LEFT JOIN users u ON u.id = eh.user_id
   WHERE eh.item_id = 123
   ORDER BY eh.timestamp DESC;
   ```

---

## Migration Context

### **Original Data Structure**

**Materials (`data/materials.json`)**:
```json
{
  "currency": "EUR",
  "sections": [
    {
      "id": "kitchen",
      "label": "Cuisine",
      "items": [
        {
          "product": "Mitigeur Grohe Blue",
          "approvals": {
            "client": {
              "status": "approved",
              "replacementUrls": ["url1", "url2"]
            },
            "contractor": { "status": "approved" }
          },
          "order": { "ordered": true, "orderDate": "13/02" },
          "comments": { "client": null, "contractor": null }
        }
      ]
    }
  ]
}
```

**Projects (localStorage)**:
```json
{
  "projects": [
    {
      "id": "project_1",
      "name": "Alexis Roche Paris Apt",
      "status": "active",
      "startDate": "2025-01-15",
      "endDate": "2025-06-30"
    }
  ]
}
```

**Workers (localStorage)**:
```json
{
  "workers": [
    {
      "id": "worker_1",
      "name": "John Doe",
      "jobs": [
        {
          "chantierName": "Alexis Roche Paris Apt",
          "startDate": "2025-03-01",
          "endDate": "2025-03-15"
        }
      ]
    }
  ]
}
```

### **Normalized Result**

**New Tables:**
- `users` table ← New (authentication & access control)
- `custom_fields` table ← New (for future extensibility)

**Migrated Tables:**
- `projects` table ← localStorage projects (now with `contractor_id`, `client_id` FKs)
- `sections` table ← JSON sections
- `items` table ← JSON items (now with `work_type_enum` for `labor_type`)
- `approvals` table ← JSON items.approvals (normalized by role, now with enum status)
- `replacement_urls` table ← JSON items.approvals[role].replacementUrls (array → table)
- `orders` table ← JSON items.order (now with enum `delivery_status`)
- `comments` table ← JSON items.comments (normalized by role)
- `workers` table ← localStorage workers (now with optional `user_id` FK)
- `worker_jobs` table ← localStorage workers[].jobs (now with `project_id` FK instead of `chantier_name`, uses `work_type_enum`)
- `edit_history` table ← `data/edit-history.json` (now with `user_id` FK for audit trail)

---

## Key Design Decisions

### 1. **Why VARCHAR(50) for IDs Instead of UUIDs?**

- **Current**: IDs are strings like `"kitchen"`, `"project_1"` (human-readable)
- **Rationale**: Existing frontend uses these IDs. Migration maintains compatibility.
- **Future**: Could migrate to UUIDs if needed, but string IDs work fine for current scale.

### 2. **Why TEXT Instead of VARCHAR for `items.product`?**

- **Rationale**: Product names can be long (e.g., "Mitigeur Grohe Blue Home avec système de filtration de l'eau"). TEXT is unlimited length, VARCHAR(255) might truncate.
- **Trade-off**: Slightly less efficient indexing, but avoids data loss.

### 3. **Why `TIMESTAMP WITH TIME ZONE`?**

- **Rationale**: Projects span time zones. Workers may work in different locations. Audit trail must be accurate globally.
- **Benefit**: PostgreSQL stores in UTC, displays in session timezone. Prevents timezone bugs.

### 4. **Why `orders.order_date` is VARCHAR(10) Not DATE?**

- **Rationale**: Original format is `'dd/mm'` (no year). Converting to DATE would require assumptions about year.
- **Future**: Could migrate to `DATE` with year tracking, but VARCHAR matches current frontend format.
- **Validation**: Regex check ensures format is `'^\d{2}/\d{2}$'`.

### 5. **Why `worker_jobs.project_id` FK (Changed from `chantier_name`)?**

- **Updated Design**: Now uses **direct foreign key** `project_id` instead of string `chantier_name`
- **Rationale**: 
  - Better referential integrity (no orphaned jobs)
  - Direct JOINs without string matching
  - Prevents typos/mismatches
  - CASCADE deletes (removing project removes related jobs)
  - Better normalization
- **Migration**: When migrating data, map `chantier` string to corresponding `project_id` in database

### 6. **Why `edit_history.item_id` Uses SET NULL (Not CASCADE)?**

- **Rationale**: Preserve audit trail even after item deletion. If item is deleted, we still want to know "what was changed and when."
- **Trade-off**: Slightly more complex queries (need to check both `item_id` and `product`/`section_label`), but maintains complete history.

### 7. **Why JSONB for `custom_fields.field_value`?**

- **Rationale**: Custom fields are schema-less. One field might be a string, another an object, another an array. JSONB allows storing any structure.
- **Benefit**: Can query JSONB with PostgreSQL operators (`->`, `->>`, `@>`), but flexible enough for future requirements.

### 8. **Why Centralized `work_type_enum` for Both Materials and Jobs?**

- **Rationale**: Both `items.labor_type` and `worker_jobs.job_type` describe the same concept (type of work). Using a single enum:
  - Single source of truth
  - Enables queries like "all plumbing-related work (materials + workers)"
  - Consistent data across the system
  - Frontend can translate enum values (English) to display names (French)
- **Values**: English, simple, programmatic (e.g., `'plumbing'`, `'electrical'`)
- **Display**: Frontend translations convert to French (e.g., `'plumbing'` → `'Plomberie & CVC'`)

### 9. **Why Enums Instead of VARCHAR + CHECK for Status Fields?**

- **Rationale**: Status fields that users select or filter by benefit from enums:
  - Type safety (database enforces valid values)
  - Better indexes (more efficient than VARCHAR)
  - Cleaner queries (enum comparison vs string matching)
  - Easy to add values: `ALTER TYPE ... ADD VALUE`
- **Exception**: 2-value internal fields (`approvals.role`, `edit_history.source`) use VARCHAR + CHECK for simplicity

### 10. **Why `projects.client_name` is Redundant but Kept?**

- **Redundancy**: Can be derived from `client_id → users` (name/email)
- **Rationale**: Kept temporarily for **migration compatibility**
  - Existing data might reference client by name
  - During migration, can populate `client_id` from `client_name`
  - Post-migration: Can be removed or kept only for legacy projects without `client_id`
- **Trade-off**: Acceptable temporary redundancy to ease migration

### 11. **Why So Many Indexes?**

- **Rationale**: Every foreign key has an index (best practice for JOIN performance). Composite indexes support common query patterns (item+role, dates). Enum indexes are more efficient than VARCHAR indexes.
- **Trade-off**: Slightly slower INSERTs/UPDATEs, but dramatically faster SELECTs. For a read-heavy application, this is optimal.

---

## Summary

This schema transforms a nested JSON/localStorage data structure into a normalized, relational database that provides:

✅ **ACID transactions** - All-or-nothing operations  
✅ **Data integrity** - Constraints, enums, and foreign keys prevent invalid states  
✅ **Query flexibility** - SQL enables any query pattern  
✅ **Access control** - User authentication and role-based project access  
✅ **Audit trail** - Complete history of all changes with user tracking  
✅ **Centralized types** - `work_type_enum` shared across materials and jobs for consistency  
✅ **Scalability** - Indexes and normalization support growth  
✅ **Security** - Designed for restricted agent access via SQL functions  
✅ **Extensibility** - Custom fields and flexible JSONB where needed  
✅ **Type safety** - Enums for user selections, CHECK constraints for validation  

The design balances normalization (for integrity and queryability) with flexibility (JSONB, denormalized fields for migration) where strict relational rules would be too rigid.

**Schema Statistics:**
- **14 tables**: users, projects, project_members, quotes, workers, worker_jobs, sections, items, approvals, replacement_urls, orders, comments, edit_history, custom_fields
- **7 enums**: work_type_enum, project_status_enum, quote_status_enum, approval_status_enum, delivery_status_enum, user_role_enum, project_member_role_enum
- **All foreign keys indexed** for optimal JOIN performance
- **Referential integrity** throughout with appropriate CASCADE/SET NULL rules

---

**See Also:**
- `database_schema.sql` - Complete SQL CREATE TABLE statements
- `MIGRATION_PLAN.md` - Migration strategy and phases
- `MIGRATION_SQL_REFERENCE.md` - SQL functions for agent tools
