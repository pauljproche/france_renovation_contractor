-- ============================================================================
-- Setup Restricted Database Role for Agent (Phase 5)
-- ============================================================================
-- 
-- This script creates a restricted database role that the AI agent uses.
-- The agent_user role can ONLY:
-- - SELECT from tables (read queries)
-- - EXECUTE SQL functions (controlled writes)
-- 
-- The agent_user role CANNOT:
-- - INSERT/UPDATE/DELETE directly on tables
-- - Modify schema or permissions
-- - Access other databases
-- 
-- Run this script as the database owner (postgres user):
--   psql -U postgres -d france_renovation -f setup_agent_role.sql
-- ============================================================================

-- Create restricted role for agent
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'agent_user') THEN
        CREATE ROLE agent_user WITH LOGIN PASSWORD 'change_me_in_production';
        RAISE NOTICE 'Created agent_user role';
    ELSE
        RAISE NOTICE 'agent_user role already exists';
    END IF;
END
$$;

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

-- Set default privileges for future tables and functions
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT ON TABLES TO agent_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT ON SEQUENCES TO agent_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT EXECUTE ON FUNCTIONS TO agent_user;

-- Verify permissions (should show SELECT and EXECUTE only)
SELECT 
    grantee,
    table_schema,
    table_name,
    privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'agent_user'
ORDER BY table_name, privilege_type;

SELECT 
    grantee,
    routine_schema,
    routine_name,
    privilege_type
FROM information_schema.role_routine_grants
WHERE grantee = 'agent_user'
ORDER BY routine_name, privilege_type;

RAISE NOTICE 'Agent role setup complete!';
RAISE NOTICE 'Update password in production: ALTER ROLE agent_user WITH PASSWORD ''secure_password'';';
RAISE NOTICE 'Update AGENT_DATABASE_URL in .env: postgresql://agent_user:secure_password@localhost:5432/france_renovation';



