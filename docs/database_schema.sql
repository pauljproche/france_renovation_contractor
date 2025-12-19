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
    'kitchen',
    'landscaping',
    'price_revision'
);

-- Approval role enum: Used in approvals and comments tables
CREATE TYPE approval_role_enum AS ENUM (
    'client',
    'cray'
);

-- Project status enum: Lifecycle status of projects
CREATE TYPE project_status_enum AS ENUM (
    'draft',
    'ready',
    'active',
    'completed',
    'archived'
);

-- Devis status enum: Quote/devis approval status
CREATE TYPE devis_status_enum AS ENUM (
    'sent',
    'approved',
    'rejected'
);

-- Approval status enum: Status of item approvals
CREATE TYPE approval_status_enum AS ENUM (
    'approved',
    'rejected',
    'change_order',
    'pending',
    'supplied_by'
);

-- Edit source enum: Source of edit (manual vs agent/AI)
CREATE TYPE edit_source_enum AS ENUM (
    'manual',
    'agent'
);

-- Delivery status enum: Status of item delivery
CREATE TYPE delivery_status_enum AS ENUM (
    'pending',
    'ordered',
    'shipped',
    'delivered',
    'cancelled'
);

-- ============================================================================
-- USERS (Authentication & Access Control)
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

CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),  -- Nullable if using OAuth only
    role user_role_enum NOT NULL,
    zulip_user_id VARCHAR(255),  -- For Zulip bot integration (nullable)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT users_id_length CHECK (LENGTH(id) > 0 AND LENGTH(id) <= 50),
    CONSTRAINT users_email_valid CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes for users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_zulip_user_id ON users(zulip_user_id) WHERE zulip_user_id IS NOT NULL;


-- ============================================================================
-- PROJECTS (Core Entity)
-- ============================================================================
-- Stores renovation projects/chantiers
-- Note: Demo projects remain hardcoded in frontend, not stored in DB
-- ============================================================================
CREATE TABLE projects (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(255),
    contractor_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,  -- Contractor managing this project
    client_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,  -- Client owning this project
    client_name VARCHAR(255),  -- Denormalized for backward compatibility (can be derived from client_id)
    status project_status_enum DEFAULT 'draft' NOT NULL,
    devis_status devis_status_enum,  -- NULL allowed (no devis yet)
    invoice_count INTEGER DEFAULT 0 NOT NULL,
    percentage_paid INTEGER DEFAULT 0 NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    is_demo BOOLEAN DEFAULT FALSE NOT NULL,
    has_data BOOLEAN DEFAULT FALSE NOT NULL,
    
    -- Constraints
    CONSTRAINT projects_id_length CHECK (LENGTH(id) > 0 AND LENGTH(id) <= 50),
    CONSTRAINT projects_name_length CHECK (LENGTH(name) > 0 AND LENGTH(name) <= 255),
    CONSTRAINT projects_date_range_valid CHECK (
        start_date IS NULL OR end_date IS NULL OR start_date <= end_date
    ),
    CONSTRAINT projects_invoice_count_valid CHECK (invoice_count >= 0),
    CONSTRAINT projects_percentage_paid_valid CHECK (percentage_paid >= 0 AND percentage_paid <= 100)
);

-- Indexes for projects
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created ON projects(created_at DESC);
CREATE INDEX idx_projects_dates ON projects(start_date, end_date) WHERE start_date IS NOT NULL;
CREATE INDEX idx_projects_contractor ON projects(contractor_id) WHERE contractor_id IS NOT NULL;
CREATE INDEX idx_projects_client ON projects(client_id) WHERE client_id IS NOT NULL;


-- ============================================================================
-- WORKERS (Core Entity)
-- ============================================================================
-- Stores salaried workers information
-- ============================================================================
CREATE TABLE workers (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,  -- Optional link to user account (for workers who log in)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for workers
CREATE INDEX idx_workers_name ON workers(name);
CREATE INDEX idx_workers_user ON workers(user_id) WHERE user_id IS NOT NULL;


-- ============================================================================
-- WORKER_JOBS (Worker Assignments)
-- ============================================================================
-- Jobs/tasks assigned to workers on specific projects
-- ============================================================================
CREATE TABLE worker_jobs (
    id VARCHAR(50) PRIMARY KEY,
    worker_id VARCHAR(50) NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    project_id VARCHAR(50) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,  -- Direct FK to project
    job_type work_type_enum,  -- Type of work assigned (uses work_type_enum)
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for worker_jobs
CREATE INDEX idx_worker_jobs_worker ON worker_jobs(worker_id);
CREATE INDEX idx_worker_jobs_project ON worker_jobs(project_id);
CREATE INDEX idx_worker_jobs_dates ON worker_jobs(start_date, end_date);
CREATE INDEX idx_worker_jobs_type ON worker_jobs(job_type);


-- ============================================================================
-- SECTIONS (Material Categories)
-- ============================================================================
-- Groups items by category (e.g., "Cuisine", "Salle de bain")
-- Linked to projects
-- ============================================================================
CREATE TABLE sections (
    id VARCHAR(50) PRIMARY KEY,
    label VARCHAR(255) NOT NULL,
    project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT sections_id_length CHECK (LENGTH(id) > 0 AND LENGTH(id) <= 50),
    CONSTRAINT sections_label_length CHECK (LENGTH(label) > 0 AND LENGTH(label) <= 255)
);

-- Indexes for sections
CREATE INDEX idx_sections_project ON sections(project_id);


-- ============================================================================
-- ITEMS (Materials/Products)
-- ============================================================================
-- Individual products/materials in each section
-- ============================================================================
CREATE TABLE items (
    id SERIAL PRIMARY KEY,
    section_id VARCHAR(50) NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    product TEXT NOT NULL,
    reference VARCHAR(255),
    supplier_link TEXT,
    labor_type work_type_enum,  -- Type of work needed (uses work_type_enum)
    price_ttc NUMERIC(10, 2),
    price_ht_quote NUMERIC(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT items_product_not_empty CHECK (LENGTH(TRIM(product)) > 0),
    CONSTRAINT items_price_ttc_valid CHECK (price_ttc IS NULL OR price_ttc >= 0),
    CONSTRAINT items_price_ht_valid CHECK (price_ht_quote IS NULL OR price_ht_quote >= 0),
    CONSTRAINT uq_items_section_product UNIQUE(section_id, product)  -- Prevent duplicates
);

-- Indexes for items
CREATE INDEX idx_items_section ON items(section_id);
CREATE INDEX idx_items_product ON items(product);
CREATE INDEX idx_items_updated ON items(updated_at DESC);
CREATE INDEX idx_items_labor_type ON items(labor_type);


-- ============================================================================
-- APPROVALS (Approval Tracking)
-- ============================================================================
-- Tracks approval status by role (client/cray) for each item
-- ============================================================================
CREATE TABLE approvals (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    role approval_role_enum NOT NULL,
    status approval_status_enum,  -- NULL allowed (no status set yet)
    note TEXT,
    validated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT uq_approvals_item_role UNIQUE(item_id, role)  -- One approval per role per item
);

-- Indexes for approvals
CREATE INDEX idx_approvals_item ON approvals(item_id);
CREATE INDEX idx_approvals_item_role ON approvals(item_id, role);  -- Composite for common query
CREATE INDEX idx_approvals_status ON approvals(status) WHERE status IS NOT NULL;


-- ============================================================================
-- REPLACEMENT_URLS (Replacement URLs Array)
-- ============================================================================
-- Stores array of replacement URLs for approvals
-- Normalized: One row per URL (array converted to separate table)
-- ============================================================================
CREATE TABLE replacement_urls (
    id SERIAL PRIMARY KEY,
    approval_id INTEGER NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for replacement_urls
CREATE INDEX idx_replacement_urls_approval ON replacement_urls(approval_id);


-- ============================================================================
-- ORDERS (Order Tracking)
-- ============================================================================
-- Tracks ordering and delivery information for items
-- ============================================================================
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE UNIQUE,  -- One order per item
    ordered BOOLEAN DEFAULT FALSE NOT NULL,
    order_date VARCHAR(10),  -- Format: 'dd/mm' (kept as VARCHAR for frontend compatibility)
    delivery_date VARCHAR(10),  -- Format: 'dd/mm' (kept as VARCHAR for frontend compatibility)
    delivery_status delivery_status_enum,
    quantity INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT orders_quantity_valid CHECK (quantity IS NULL OR quantity > 0),
    CONSTRAINT orders_date_format CHECK (
        (order_date IS NULL OR order_date ~ '^\d{2}/\d{2}$') AND
        (delivery_date IS NULL OR delivery_date ~ '^\d{2}/\d{2}$')
    )
);

-- Indexes for orders
CREATE INDEX idx_orders_item ON orders(item_id);
CREATE INDEX idx_orders_ordered ON orders(ordered);


-- ============================================================================
-- COMMENTS (Comments by Role)
-- ============================================================================
-- Stores comments by role (client/cray) for each item
-- ============================================================================
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    role approval_role_enum NOT NULL,  -- Uses same enum as approvals (client/cray)
    comment_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT uq_comments_item_role UNIQUE(item_id, role)
);

-- Indexes for comments
CREATE INDEX idx_comments_item ON comments(item_id);


-- ============================================================================
-- EDIT_HISTORY (Audit Trail)
-- ============================================================================
-- Tracks all changes to items for audit purposes
-- ============================================================================
CREATE TABLE edit_history (
    id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,  -- Keep history even if item deleted
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,  -- User who made the change (for audit trail)
    section_id VARCHAR(50),
    section_label VARCHAR(255),
    product TEXT,
    field_path VARCHAR(255) NOT NULL,  -- e.g., 'price_ttc', 'approvals.client.status'
    old_value JSONB,
    new_value JSONB,
    source edit_source_enum DEFAULT 'manual' NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT edit_history_field_path_length CHECK (LENGTH(field_path) > 0 AND LENGTH(field_path) <= 255)
);

-- Indexes for edit_history
CREATE INDEX idx_edit_history_item ON edit_history(item_id);
CREATE INDEX idx_edit_history_timestamp ON edit_history(timestamp DESC);
CREATE INDEX idx_edit_history_user ON edit_history(user_id) WHERE user_id IS NOT NULL;


-- ============================================================================
-- CUSTOM_FIELDS (Extensible Fields)
-- ============================================================================
-- Allows extending items with custom fields dynamically
-- ============================================================================
CREATE TABLE custom_fields (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    field_value JSONB,  -- Flexible value storage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT uq_custom_fields_item_field UNIQUE(item_id, field_name)
);

-- Indexes for custom_fields
CREATE INDEX idx_custom_fields_item ON custom_fields(item_id);


-- ============================================================================
-- RELATIONSHIPS SUMMARY
-- ============================================================================
-- 
-- Authentication & Access:
--   users (1) ──< (0 or N) projects.contractor_id (SET NULL on delete)
--   users (1) ──< (0 or N) projects.client_id (SET NULL on delete)
--   users (1) ──< (0 or 1) workers.user_id (SET NULL on delete, nullable)
--   users (1) ──< (0 or N) edit_history.user_id (SET NULL on delete, nullable)
-- 
-- Core Hierarchy:
--   projects (1) ──< (N) sections (1) ──< (N) items
--   
-- Items Relationships:
--   items (1) ──< (N) approvals (1) ──< (N) replacement_urls
--   items (1) ──< (1) orders
--   items (1) ──< (N) comments
--   items (1) ──< (N) custom_fields
--   items (1) ──< (N) edit_history
--   
-- Workers:
--   workers (1) ──< (N) worker_jobs
--   projects (1) ──< (N) worker_jobs (direct FK)
-- 
-- CASCADE Rules:
--   - Deleting a project → deletes all sections → deletes all items → cascades through
--   - Deleting an item → deletes approvals, orders, comments, custom_fields
--   - Deleting an approval → deletes replacement_urls
--   - Deleting a worker → deletes all worker_jobs
--   - edit_history.item_id → SET NULL (preserves audit trail)
--   - Deleting a user → SET NULL on projects (contractor_id/client_id), workers.user_id, edit_history.user_id
--     (preserves data, just removes user linkage)
-- ============================================================================
