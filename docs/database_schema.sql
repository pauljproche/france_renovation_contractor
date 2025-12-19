-- ============================================================================
-- France Renovation Contractor Database Schema
-- PostgreSQL 15
-- Generated: 2025-12-18
-- ============================================================================
-- 
-- This file contains the complete database schema with all tables, constraints,
-- and indexes for the France Renovation Contractor application.
-- 
-- Purpose: Clear SQL representation for schema discussion and review.
-- 
-- 📚 FOR THE BIG PICTURE:
--    Read SCHEMA_OVERVIEW.md first for:
--    - What the application does
--    - Why the schema is designed this way
--    - Core tables explanation
--    - Design decisions and rationale
--    - Migration context (before/after)
-- 
-- This SQL file shows HOW the schema is structured.
-- The overview document explains WHY.
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================
-- Work type enum: Centralized work/job types used for both materials (labor_type)
-- and worker assignments (job_type). Values are in English (simple, programmatic)
-- and can be translated in the frontend UI.
-- ============================================================================
CREATE TYPE work_type_enum AS ENUM (
    'demolition',
    'structural',
    'facade',
    'exterior_joinery',
    'plastering',
    'plumbing',
    'electrical',
    'wall_covering',
    'interior_joinery',
    'landscaping',
    'price_revision'
);

-- Approval role: Only 2 values, determined by user login (not directly selected)
-- Using VARCHAR with CHECK instead of enum for simplicity

-- Project status enum: Lifecycle status of projects
CREATE TYPE project_status_enum AS ENUM (
    'draft',
    'ready',
    'active',
    'completed',
    'archived'
);

-- Quote status enum: Quote approval status
CREATE TYPE quote_status_enum AS ENUM (
    'draft',
    'sent',
    'approved',
    'rejected',
    'superseded'  -- Replaced by a newer quote version
);

-- Approval status enum: Status of item approvals
CREATE TYPE approval_status_enum AS ENUM (
    'approved',
    'rejected',
    'change_order',
    'pending',
    'supplied_by'
);

-- Edit source: Only 2 values, internal tracking (users don't select)
-- Using VARCHAR with CHECK instead of enum for simplicity

-- Delivery status enum: Status of item delivery
CREATE TYPE delivery_status_enum AS ENUM (
    'pending',
    'ordered',
    'shipped',
    'delivered',
    'cancelled'
);

-- ============================================================================
-- USER (Authentication & Access Control)
-- ============================================================================
-- Stores user accounts for contractors, clients, and workers
-- Supports web login and Zulip bot integration
-- ============================================================================
CREATE TYPE user_role_enum AS ENUM (
    'contractor',
    'client',
    'worker',
    'subcontractor'
);

CREATE TABLE user (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),  -- Nullable if using OAuth only
    role user_role_enum NOT NULL,
    zulip_user_id VARCHAR(255),  -- For Zulip bot integration (nullable)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT user_id_length CHECK (LENGTH(id) > 0 AND LENGTH(id) <= 50),
    CONSTRAINT user_email_valid CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes for user
CREATE INDEX idx_user_email ON "user"(email);
CREATE INDEX idx_user_role ON "user"(role);
CREATE INDEX idx_user_zulip_user_id ON "user"(zulip_user_id) WHERE zulip_user_id IS NOT NULL;


-- ============================================================================
-- PROJECT (Core Entity)
-- ============================================================================
-- Stores renovation projects/chantiers
-- Note: Demo projects remain hardcoded in frontend, not stored in DB
-- ============================================================================
CREATE TABLE project (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(255),
    owner_id VARCHAR(50) NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,  -- Primary owner/contractor who created/manages this project (required, prevents orphaned projects)
    status project_status_enum DEFAULT 'draft' NOT NULL,
    invoice_count INTEGER DEFAULT 0 NOT NULL,
    percentage_paid INTEGER DEFAULT 0 NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    is_demo BOOLEAN DEFAULT FALSE NOT NULL,
    has_data BOOLEAN DEFAULT FALSE NOT NULL,
    
    -- Constraints
    CONSTRAINT project_id_length CHECK (LENGTH(id) > 0 AND LENGTH(id) <= 50),
    CONSTRAINT project_name_length CHECK (LENGTH(name) > 0 AND LENGTH(name) <= 255),
    CONSTRAINT project_date_range_valid CHECK (
        start_date IS NULL OR end_date IS NULL OR start_date <= end_date
    ),
    CONSTRAINT project_invoice_count_valid CHECK (invoice_count >= 0),
    CONSTRAINT project_percentage_paid_valid CHECK (percentage_paid >= 0 AND percentage_paid <= 100)
);

-- Indexes for project
CREATE INDEX idx_project_status ON project(status);
CREATE INDEX idx_project_created ON project(created_at DESC);
CREATE INDEX idx_project_dates ON project(start_date, end_date) WHERE start_date IS NOT NULL;
CREATE INDEX idx_project_owner ON project(owner_id) WHERE owner_id IS NOT NULL;


-- ============================================================================
-- PROJECT_MEMBER (User-Project Memberships)
-- ============================================================================
-- Many-to-many relationship: Users can be members of multiple projects
-- with different roles per project (contractor, client, architect, etc.)
-- ============================================================================
CREATE TYPE project_member_role_enum AS ENUM (
    'contractor',
    'client',
    'architect',
    'viewer',
    'subcontractor'
);

CREATE TABLE project_member (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(50) NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    role project_member_role_enum NOT NULL,  -- Role on THIS project
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT uq_project_member_project_user UNIQUE(project_id, user_id)  -- One role per user per project
);

-- Indexes for project_member
CREATE INDEX idx_project_member_project ON project_member(project_id);
CREATE INDEX idx_project_member_user ON project_member(user_id);
CREATE INDEX idx_project_member_role ON project_member(role);
CREATE INDEX idx_project_member_project_role ON project_member(project_id, role);  -- For queries like "all contractors on project X"


-- ============================================================================
-- QUOTE (Project Quotes/Devis)
-- ============================================================================
-- Stores quotes (devis) sent to clients for projects
-- Multiple quotes per project supported (for revisions, updates, etc.)
-- Initial quote is the itemized estimate/quote sent to client for approval
-- ============================================================================
CREATE TABLE quote (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    status quote_status_enum DEFAULT 'draft' NOT NULL,
    version_number INTEGER DEFAULT 1 NOT NULL,  -- Version number for multiple quotes (1, 2, 3, etc.)
    sent_at TIMESTAMP WITH TIME ZONE,  -- When quote was sent to client
    approved_at TIMESTAMP WITH TIME ZONE,  -- When quote was approved
    rejected_at TIMESTAMP WITH TIME ZONE,  -- When quote was rejected
    notes TEXT,  -- Optional notes about this quote
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT quote_id_length CHECK (LENGTH(id) > 0 AND LENGTH(id) <= 50),
    CONSTRAINT quote_version_positive CHECK (version_number > 0),
    CONSTRAINT quote_status_dates_consistent CHECK (
        (status = 'draft' AND sent_at IS NULL) OR
        (status IN ('sent', 'approved', 'rejected', 'superseded') AND sent_at IS NOT NULL) OR
        (status = 'draft')
    )
);

-- Indexes for quote
CREATE INDEX idx_quote_project ON quote(project_id);
CREATE INDEX idx_quote_status ON quote(status);
CREATE INDEX idx_quote_project_status ON quote(project_id, status);  -- For finding active quotes per project
CREATE INDEX idx_quote_created ON quote(created_at DESC);


-- ============================================================================
-- WORKER (Worker-Specific Information)
-- ============================================================================
-- Stores worker-specific information (diplomas, certificates, etc.)
-- One-to-one relationship with users: a worker IS a user with additional worker data
-- Note: Basic info (name, email) comes from user table
-- ============================================================================
CREATE TABLE worker (
    user_id VARCHAR(50) PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,  -- PK = FK to user (one-to-one)
    certificates JSONB,  -- Optional: Array of certificates/diplomas
    -- Example structure: [
    --   {"name": "Electrician License", "issuing_org": "French Electric Authority", "date": "2020-01-15", "expires": "2025-01-15"},
    --   {"name": "Plumbing Certificate", "issuing_org": "Trade School", "date": "2018-06-01", "expires": null}
    -- ]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index for certificates JSONB field (useful for queries filtering by certificate name/type)
CREATE INDEX idx_worker_certificates ON worker USING GIN (certificates);


-- ============================================================================
-- WORKER_JOB (Worker Assignments)
-- ============================================================================
-- Jobs/tasks assigned to workers on specific projects
-- ============================================================================
CREATE TABLE worker_job (
    id VARCHAR(50) PRIMARY KEY,
    worker_id VARCHAR(50) NOT NULL REFERENCES worker(user_id) ON DELETE CASCADE,  -- References worker.user_id (which is also user.id)
    project_id VARCHAR(50) NOT NULL REFERENCES project(id) ON DELETE CASCADE,  -- Direct FK to project
    job_type work_type_enum,  -- Type of work assigned (uses work_type_enum)
    location VARCHAR(255),  -- Optional: Location where work is performed (e.g., "kitchen", "bathroom", "living room")
    comment TEXT,  -- Optional: Additional notes/comments about the job
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for worker_job
CREATE INDEX idx_worker_job_worker ON worker_job(worker_id);
CREATE INDEX idx_worker_job_project ON worker_job(project_id);
CREATE INDEX idx_worker_job_dates ON worker_job(start_date, end_date);
CREATE INDEX idx_worker_job_type ON worker_job(job_type);
CREATE INDEX idx_worker_job_location ON worker_job(location) WHERE location IS NOT NULL;  -- Partial index for location queries


-- ============================================================================
-- SECTION (Material Categories)
-- ============================================================================
-- Groups items by category (e.g., "Cuisine", "Salle de bain")
-- Linked to projects
-- ============================================================================
CREATE TABLE section (
    id VARCHAR(50) PRIMARY KEY,
    label VARCHAR(255) NOT NULL,
    project_id VARCHAR(50) REFERENCES project(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT section_id_length CHECK (LENGTH(id) > 0 AND LENGTH(id) <= 50),
    CONSTRAINT section_label_length CHECK (LENGTH(label) > 0 AND LENGTH(label) <= 255)
);

-- Indexes for section
CREATE INDEX idx_section_project ON section(project_id);


-- ============================================================================
-- ITEM (Materials/Products)
-- ============================================================================
-- Individual products/materials in each section
-- ============================================================================
CREATE TABLE item (
    id SERIAL PRIMARY KEY,
    section_id VARCHAR(50) NOT NULL REFERENCES section(id) ON DELETE CASCADE,
    product TEXT NOT NULL,
    reference VARCHAR(255),
    supplier_link TEXT,
    labor_type work_type_enum,  -- Type of work needed (uses work_type_enum)
    price_ttc NUMERIC(10, 2),
    price_ht_quote NUMERIC(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT item_product_not_empty CHECK (LENGTH(TRIM(product)) > 0),
    CONSTRAINT item_price_ttc_valid CHECK (price_ttc IS NULL OR price_ttc >= 0),
    CONSTRAINT item_price_ht_valid CHECK (price_ht_quote IS NULL OR price_ht_quote >= 0),
    CONSTRAINT uq_item_section_product UNIQUE(section_id, product)  -- Prevent duplicates
);

-- Indexes for item
CREATE INDEX idx_item_section ON item(section_id);
CREATE INDEX idx_item_product ON item(product);
CREATE INDEX idx_item_updated ON item(updated_at DESC);
CREATE INDEX idx_item_labor_type ON item(labor_type);


-- ============================================================================
-- APPROVAL (Approval Tracking)
-- ============================================================================
-- Tracks approval status by role (client/cray) for each item
-- ============================================================================
CREATE TABLE approval (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES item(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('client', 'cray')),
    status approval_status_enum,  -- NULL allowed (no status set yet)
    note TEXT,
    validated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT uq_approval_item_role UNIQUE(item_id, role)  -- One approval per role per item
);

-- Indexes for approval
CREATE INDEX idx_approval_item ON approval(item_id);
CREATE INDEX idx_approval_item_role ON approval(item_id, role);  -- Composite for common query
CREATE INDEX idx_approval_status ON approval(status) WHERE status IS NOT NULL;


-- ============================================================================
-- REPLACEMENT_URL (Replacement URLs Array)
-- ============================================================================
-- Stores array of replacement URLs for approvals
-- Normalized: One row per URL (array converted to separate table)
-- ============================================================================
CREATE TABLE replacement_url (
    id SERIAL PRIMARY KEY,
    approval_id INTEGER NOT NULL REFERENCES approval(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for replacement_url
CREATE INDEX idx_replacement_url_approval ON replacement_url(approval_id);


-- ============================================================================
-- ORDER (Order Tracking)
-- ============================================================================
-- Tracks ordering and delivery information for items
-- ============================================================================
CREATE TABLE "order" (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES item(id) ON DELETE CASCADE UNIQUE,  -- One order per item
    ordered BOOLEAN DEFAULT FALSE NOT NULL,
    order_date VARCHAR(10),  -- Format: 'dd/mm' (kept as VARCHAR for frontend compatibility)
    delivery_date VARCHAR(10),  -- Format: 'dd/mm' (kept as VARCHAR for frontend compatibility)
    delivery_status delivery_status_enum,
    quantity INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT order_quantity_valid CHECK (quantity IS NULL OR quantity > 0),
    CONSTRAINT order_ordered_with_date CHECK (
        (ordered = FALSE AND order_date IS NULL) OR 
        (ordered = TRUE AND order_date IS NOT NULL)
    ),  -- If ordered=true, order_date must be set
    CONSTRAINT order_date_format CHECK (
        (order_date IS NULL OR order_date ~ '^\d{2}/\d{2}$') AND
        (delivery_date IS NULL OR delivery_date ~ '^\d{2}/\d{2}$')
    )
);

-- Indexes for order
CREATE INDEX idx_order_item ON "order"(item_id);
CREATE INDEX idx_order_ordered ON "order"(ordered);


-- ============================================================================
-- COMMENT (Comments by Role)
-- ============================================================================
-- Stores comments by role (client/cray) for each item
-- ============================================================================
CREATE TABLE comment (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES item(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('client', 'cray')),
    comment_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT uq_comment_item_role UNIQUE(item_id, role)
);

-- Indexes for comment
CREATE INDEX idx_comment_item ON comment(item_id);


-- ============================================================================
-- EDIT_HISTORY (Audit Trail)
-- ============================================================================
-- Tracks all changes to items for audit purposes
-- Note: "history" is already singular (the concept, not "histories")
-- ============================================================================
CREATE TABLE edit_history (
    id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES item(id) ON DELETE SET NULL,  -- Keep history even if item deleted
    user_id VARCHAR(50) REFERENCES "user"(id) ON DELETE SET NULL,  -- User who made the change (for audit trail)
    section_id VARCHAR(50),
    section_label VARCHAR(255),
    product TEXT,
    field_path VARCHAR(255) NOT NULL,  -- e.g., 'price_ttc', 'approvals.client.status'
    old_value JSONB,
    new_value JSONB,
    source VARCHAR(10) DEFAULT 'manual' NOT NULL CHECK (source IN ('manual', 'agent')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT edit_history_field_path_length CHECK (LENGTH(field_path) > 0 AND LENGTH(field_path) <= 255)
);

-- Indexes for edit_history
CREATE INDEX idx_edit_history_item ON edit_history(item_id);
CREATE INDEX idx_edit_history_timestamp ON edit_history(timestamp DESC);
CREATE INDEX idx_edit_history_user ON edit_history(user_id) WHERE user_id IS NOT NULL;


-- ============================================================================
-- CUSTOM_FIELD (Extensible Fields)
-- ============================================================================
-- Allows extending items with custom fields dynamically
-- ============================================================================
CREATE TABLE custom_field (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES item(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    field_value JSONB,  -- Flexible value storage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT uq_custom_field_item_field UNIQUE(item_id, field_name)
);

-- Indexes for custom_field
CREATE INDEX idx_custom_field_item ON custom_field(item_id);


-- ============================================================================
-- RELATIONSHIPS SUMMARY
-- ============================================================================
-- 
-- Authentication & Access:
--   user (1) ──< (1 or N) project.owner_id (RESTRICT on delete - ensures at least one owner per project)
--   user (1) ──< (0 or N) project_member (many-to-many with role, CASCADE delete)
--   user (1) ──< (0 or 1) worker (one-to-one, worker.user_id = PK = FK to user.id, CASCADE delete)
--   user (1) ──< (0 or N) edit_history.user_id (SET NULL on delete, nullable)
--   project (1) ──< (N) project_member (CASCADE delete)
-- 
-- Core Hierarchy:
--   project (1) ──< (N) quote (multiple quotes per project, versioned)
--   project (1) ──< (N) section (1) ──< (N) item
--   
-- Item Relationships:
--   item (1) ──< (N) approval (1) ──< (N) replacement_url
--   item (1) ──< (1) order
--   item (1) ──< (N) comment
--   item (1) ──< (N) custom_field
--   item (1) ──< (N) edit_history
--   
-- Workers:
--   worker (1) ──< (N) worker_job
--   project (1) ──< (N) worker_job (direct FK)
-- 
-- CASCADE Rules:
--   - Deleting a project → deletes all quotes (CASCADE)
--   - Deleting a project → deletes all sections → deletes all items → cascades through
--   - Deleting a project → deletes project_member (CASCADE)
--   - Deleting an item → deletes approvals, orders, comments, custom_fields
--   - Deleting an approval → deletes replacement_urls
--   - Deleting a worker (user) → deletes worker row (CASCADE) → deletes all worker_job (CASCADE)
--   - Deleting a user → deletes project_member (CASCADE)
--   - Deleting a user → deletes worker row if user is a worker (CASCADE)
--   - Deleting a user → RESTRICT if user is owner of any projects (prevents orphaned projects)
--   - edit_history.item_id → SET NULL (preserves audit trail)
--   - Deleting a user → SET NULL on edit_history.user_id (preserves audit trail, just removes user linkage)
--     (but NOT for project.owner_id - RESTRICT applies, NOT for worker - CASCADE applies)
-- ============================================================================
