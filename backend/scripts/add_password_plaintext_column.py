#!/usr/bin/env python3
"""
Temporary script to add password_plaintext column to users table.
WARNING: This is for testing/admin display only. Remove in production!
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db_session import db_session
from sqlalchemy import text

def add_password_plaintext_column():
    """Add password_plaintext column if it doesn't exist."""
    try:
        with db_session() as session:
            # Check if column exists
            result = session.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' AND column_name='password_plaintext'
            """))
            
            if result.fetchone():
                print("✓ password_plaintext column already exists")
                return
            
            # Add column
            session.execute(text("""
                ALTER TABLE users 
                ADD COLUMN password_plaintext VARCHAR(255) NULL
            """))
            session.commit()
            print("✓ Added password_plaintext column to users table")
            print("⚠️  WARNING: This column stores passwords in plaintext for testing only!")
            print("⚠️  REMOVE THIS COLUMN IN PRODUCTION!")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    add_password_plaintext_column()
