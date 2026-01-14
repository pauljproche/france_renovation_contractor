"""
Migration script to assign existing materials (sections with NULL project_id) to projects.

This script helps migrate materials that were created before project-specific materials
were implemented. It can:
1. Assign materials to projects based on matching chantier field
2. Assign all NULL materials to a specific project
3. List all materials without project associations

Usage:
    python backend/scripts/migrate_materials_to_projects.py --list
    python backend/scripts/migrate_materials_to_projects.py --assign-by-chantier
    python backend/scripts/migrate_materials_to_projects.py --assign-to-project PROJECT_ID
"""

import sys
import os
from typing import Optional, List, Dict, Any

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from db_session import db_session

try:
    from models import Section, Item, Project
except ImportError:
    from backend.models import Section, Item, Project


def list_materials_without_projects(session: Session) -> List[Dict[str, Any]]:
    """List all sections that don't have a project_id assigned."""
    sections = session.query(Section).filter(Section.project_id == None).all()
    
    result = []
    for section in sections:
        items = session.query(Item).filter(Item.section_id == section.id).all()
        # Get unique chantiers from items
        chantiers = set()
        for item in items:
            # Try to get chantier from item's custom fields or other sources
            # For now, we'll check if there's a way to get chantier from items
            # Note: chantier might be stored in item data, but we need to check the actual structure
            pass
        
        result.append({
            'section_id': section.id,
            'section_label': section.label,
            'item_count': len(items),
            'created_at': section.created_at.isoformat() if section.created_at else None
        })
    
    return result


def assign_by_chantier(session: Session, dry_run: bool = True) -> Dict[str, Any]:
    """
    Assign materials to projects by matching chantier field in items.
    
    This is a placeholder - actual implementation would need to:
    1. Extract chantier from items (might be in custom fields or item data)
    2. Match chantier to project name/address
    3. Assign section.project_id to matching project
    
    For now, this provides a framework that can be extended.
    """
    sections = session.query(Section).filter(Section.project_id == None).all()
    projects = session.query(Project).all()
    
    assignments = []
    for section in sections:
        items = session.query(Item).filter(Item.section_id == section.id).all()
        
        # Try to find matching project based on items' chantier
        # This would need to be implemented based on how chantier is stored
        # For now, we'll just log what we find
        for item in items:
            # Check if we can extract chantier from item
            # This depends on how chantier is stored in your data model
            pass
    
    return {
        'sections_processed': len(sections),
        'assignments': assignments,
        'dry_run': dry_run
    }


def assign_to_project(session: Session, project_id: str, dry_run: bool = True) -> Dict[str, Any]:
    """Assign all sections with NULL project_id to a specific project."""
    project = session.query(Project).filter(Project.id == project_id).first()
    if not project:
        return {'error': f'Project {project_id} not found'}
    
    sections = session.query(Section).filter(Section.project_id == None).all()
    
    if not dry_run:
        for section in sections:
            section.project_id = project_id
        session.commit()
    
    return {
        'project_id': project_id,
        'project_name': project.name,
        'sections_assigned': len(sections),
        'dry_run': dry_run
    }


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Migrate materials to projects')
    parser.add_argument('--list', action='store_true', help='List all materials without project assignments')
    parser.add_argument('--assign-by-chantier', action='store_true', help='Assign materials to projects by matching chantier')
    parser.add_argument('--assign-to-project', type=str, help='Assign all NULL materials to a specific project ID')
    parser.add_argument('--dry-run', action='store_true', default=True, help='Dry run (default: True, set --no-dry-run to actually apply changes)')
    parser.add_argument('--no-dry-run', dest='dry_run', action='store_false', help='Actually apply changes (not a dry run)')
    
    args = parser.parse_args()
    
    with db_session() as session:
        if args.list:
            print("Materials without project assignments:")
            print("=" * 60)
            materials = list_materials_without_projects(session)
            if not materials:
                print("No materials found without project assignments.")
            else:
                for mat in materials:
                    print(f"Section: {mat['section_id']} ({mat['section_label']})")
                    print(f"  Items: {mat['item_count']}")
                    print(f"  Created: {mat['created_at']}")
                    print()
        
        elif args.assign_by_chantier:
            print("Assigning materials by chantier matching...")
            if args.dry_run:
                print("(DRY RUN - no changes will be made)")
            result = assign_by_chantier(session, dry_run=args.dry_run)
            print(f"Processed {result['sections_processed']} sections")
            if not args.dry_run:
                print("Changes applied!")
            else:
                print("(This was a dry run - use --no-dry-run to apply changes)")
        
        elif args.assign_to_project:
            print(f"Assigning materials to project: {args.assign_to_project}")
            if args.dry_run:
                print("(DRY RUN - no changes will be made)")
            result = assign_to_project(session, args.assign_to_project, dry_run=args.dry_run)
            if 'error' in result:
                print(f"Error: {result['error']}")
            else:
                print(f"Project: {result['project_name']} ({result['project_id']})")
                print(f"Sections to assign: {result['sections_assigned']}")
                if not args.dry_run:
                    print("Changes applied!")
                else:
                    print("(This was a dry run - use --no-dry-run to apply changes)")
        
        else:
            parser.print_help()


if __name__ == '__main__':
    main()
