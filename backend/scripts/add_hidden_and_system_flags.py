"""
Migration script to add 'hidden' and 'is_system' columns to projects table.

This script:
1. Adds 'hidden' column (default False) - allows hiding projects from main list
2. Adds 'is_system' column (default False) - marks system projects that cannot be deleted
3. Marks 'legacy-materials' and 'demo-project' as system projects
"""

import sys
import os
from sqlalchemy import text

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from db_session import db_session
    from models import Project
except ImportError:
    from backend.db_session import db_session
    from backend.models import Project


def add_columns(session):
    """Add hidden and is_system columns if they don't exist."""
    # Check if columns exist
    result = session.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='projects' AND column_name IN ('hidden', 'is_system')
    """))
    existing_columns = [row[0] for row in result]
    
    if 'hidden' not in existing_columns:
        print("Adding 'hidden' column...")
        session.execute(text("ALTER TABLE projects ADD COLUMN hidden BOOLEAN DEFAULT FALSE NOT NULL"))
        print("✓ Added 'hidden' column")
    else:
        print("✓ 'hidden' column already exists")
    
    if 'is_system' not in existing_columns:
        print("Adding 'is_system' column...")
        session.execute(text("ALTER TABLE projects ADD COLUMN is_system BOOLEAN DEFAULT FALSE NOT NULL"))
        print("✓ Added 'is_system' column")
    else:
        print("✓ 'is_system' column already exists")


def mark_system_projects(session):
    """Mark system projects (legacy-materials, demo-project) as system projects."""
    system_project_ids = ['legacy-materials', 'demo-project']
    
    for project_id in system_project_ids:
        project = session.query(Project).filter(Project.id == project_id).first()
        if project:
            if not project.is_system:
                project.is_system = True
                print(f"✓ Marked '{project.name}' ({project_id}) as system project")
            else:
                print(f"✓ '{project.name}' ({project_id}) already marked as system project")
        else:
            print(f"⚠ Project '{project_id}' not found (skipping)")


def main():
    print("=== Adding hidden and is_system columns to projects ===")
    print()
    
    with db_session() as session:
        try:
            # Add columns
            add_columns(session)
            session.commit()
            print()
            
            # Mark system projects
            print("Marking system projects...")
            mark_system_projects(session)
            session.commit()
            print()
            
            print("=== Migration complete! ===")
            
        except Exception as e:
            session.rollback()
            print(f"Error: {e}")
            raise


if __name__ == '__main__':
    main()
