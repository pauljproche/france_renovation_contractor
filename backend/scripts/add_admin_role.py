#!/usr/bin/env python3
"""
Add ADMIN role to user_role_enum in PostgreSQL.
Run this script to update the database enum type.
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

# Get database connection string
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Try to construct from individual components
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "france_renovation")
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
    
    if DB_PASSWORD:
        DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    else:
        DATABASE_URL = f"postgresql://{DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in environment variables")
    sys.exit(1)

print(f"Connecting to database: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else DATABASE_URL}")

# SQL to add ADMIN role to enum
SQL_ADD_ADMIN_ROLE = """
-- Add ADMIN value to user_role_enum if it doesn't exist
DO $$ 
BEGIN
    -- Check if 'admin' already exists in the enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'admin' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role_enum')
    ) THEN
        -- Add 'admin' to the enum (add it first, before other values)
        ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'admin' BEFORE 'contractor';
    END IF;
END $$;
"""

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        print("Adding ADMIN role to user_role_enum...")
        conn.execute(text(SQL_ADD_ADMIN_ROLE))
        conn.commit()
        print("✅ Successfully added ADMIN role to user_role_enum!")
        print("\nAvailable roles:")
        result = conn.execute(text("""
            SELECT enumlabel 
            FROM pg_enum 
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role_enum')
            ORDER BY enumsortorder;
        """))
        for row in result:
            print(f"  - {row[0]}")
except Exception as e:
    print(f"❌ Error adding ADMIN role: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
