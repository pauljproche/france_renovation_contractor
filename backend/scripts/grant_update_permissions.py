#!/usr/bin/env python3
"""
Grant UPDATE permissions on items table to postgres user.
This is needed for SECURITY DEFINER functions to work.
"""
import os
import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL")
DB_USER = os.getenv("DB_USER", "postgres")
if not DATABASE_URL:
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "france_renovation")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
    
    if DB_PASSWORD:
        DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    else:
        DATABASE_URL = f"postgresql://{DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

print(f"Connecting to database as {DB_USER}...")

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        # Grant UPDATE permission on items table to postgres (function owner)
        print("Granting UPDATE permission on items table to postgres user...")
        conn.execute(text("GRANT UPDATE ON items TO postgres"))
        conn.commit()
        print("✅ Successfully granted UPDATE permission!")
        print("   The execute_update_item_field function should now work correctly.")
except Exception as e:
    print(f"❌ Error granting permissions: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
