#!/usr/bin/env python3
"""
Update the execute_update_item_field SQL function to fix the quotes issue.
This script connects to the database and updates the function.
"""
import os
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine, text

# Get database connection string - use main DATABASE_URL (postgres user) to update function
# The function needs to be owned by postgres to have SECURITY DEFINER work correctly
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Try to construct from individual components
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "france_renovation")
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")  # Default password
    
    if DB_PASSWORD:
        DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    else:
        DATABASE_URL = f"postgresql://{DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in environment variables")
    print("Please set DATABASE_URL or DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD")
    sys.exit(1)

print(f"Connecting to database: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else DATABASE_URL}")

# SQL function definition
SQL_FUNCTION = """
CREATE OR REPLACE FUNCTION execute_update_item_field(
    p_item_id INTEGER,
    p_field_name VARCHAR,
    p_new_value JSONB
) RETURNS BOOLEAN AS $$
DECLARE
    v_old_value JSONB;
BEGIN
    CASE p_field_name
        WHEN 'price_ttc' THEN
            SELECT to_jsonb(price_ttc) INTO v_old_value FROM items WHERE id = p_item_id;
            UPDATE items SET price_ttc = (p_new_value)::numeric, updated_at = NOW() WHERE id = p_item_id;
        WHEN 'price_ht_quote' THEN
            SELECT to_jsonb(price_ht_quote) INTO v_old_value FROM items WHERE id = p_item_id;
            UPDATE items SET price_ht_quote = (p_new_value)::numeric, updated_at = NOW() WHERE id = p_item_id;
        WHEN 'product' THEN
            SELECT to_jsonb(product) INTO v_old_value FROM items WHERE id = p_item_id;
            UPDATE items SET product = (p_new_value#>>'{}'), updated_at = NOW() WHERE id = p_item_id;
        WHEN 'reference' THEN
            SELECT to_jsonb(reference) INTO v_old_value FROM items WHERE id = p_item_id;
            UPDATE items SET reference = (p_new_value#>>'{}'), updated_at = NOW() WHERE id = p_item_id;
        ELSE
            RAISE EXCEPTION 'Field % is not updatable', p_field_name;
    END CASE;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
"""

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        print("Updating execute_update_item_field function...")
        print("   - Using postgres user connection to ensure SECURITY DEFINER works")
        conn.execute(text(SQL_FUNCTION))
        conn.commit()
        
        # Verify the function has SECURITY DEFINER
        result = conn.execute(text("""
            SELECT prosecdef 
            FROM pg_proc 
            WHERE proname = 'execute_update_item_field'
        """))
        has_security_definer = result.scalar()
        
        if has_security_definer:
            print("✅ Successfully updated execute_update_item_field function!")
            print("   - Changed (p_new_value)::text to (p_new_value#>>'{}') for 'product' and 'reference'")
            print("   - Function has SECURITY DEFINER (verified)")
            print("   - This extracts text from JSONB without quotes")
            print("\nYou can now test updating a reference field - it should store without quotes.")
        else:
            print("⚠️ Function updated but SECURITY DEFINER is missing!")
            print("   The function may not have UPDATE permissions.")
            print("   Please run this script as the postgres user.")
except Exception as e:
    print(f"❌ Error updating function: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
