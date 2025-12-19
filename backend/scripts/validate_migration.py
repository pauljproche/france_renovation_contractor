#!/usr/bin/env python3
"""
Validation script to verify migration correctness.

This script compares source data (JSON/localStorage) with database records
to ensure all data was migrated correctly.

Usage:
    python backend/scripts/validate_migration.py [--projects-file PATH] [--workers-file PATH]
"""

import json
import sys
from pathlib import Path
from collections import defaultdict

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy import func
from backend.database import SessionLocal
from backend.models import (
    User, Project, ProjectMember, Quote, Worker, WorkerJob,
    Section, Item, Approval, ReplacementUrl, Order, Comment, EditHistory
)

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
MATERIALS_JSON = PROJECT_ROOT / "data" / "materials.json"
EDIT_HISTORY_JSON = PROJECT_ROOT / "data" / "edit-history.json"


def validate_materials(session, materials_data):
    """Validate materials migration."""
    print("=" * 80)
    print("Validating Materials Migration")
    print("=" * 80)
    
    errors = []
    warnings = []
    
    # Count sections
    db_sections = session.query(Section).count()
    json_sections = len(materials_data.get("sections", []))
    
    if db_sections != json_sections:
        errors.append(f"Section count mismatch: DB={db_sections}, JSON={json_sections}")
    else:
        print(f"✅ Sections: {db_sections} (matches JSON)")
    
    # Count items
    json_item_count = sum(len(s.get("items", [])) for s in materials_data.get("sections", []))
    db_item_count = session.query(Item).count()
    
    if db_item_count != json_item_count:
        errors.append(f"Item count mismatch: DB={db_item_count}, JSON={json_item_count}")
    else:
        print(f"✅ Items: {db_item_count} (matches JSON)")
    
    # Count approvals
    json_approval_count = 0
    for section in materials_data.get("sections", []):
        for item in section.get("items", []):
            approvals = item.get("approvals", {})
            for role in ["client", "cray"]:
                if approvals.get(role) and approvals[role].get("status"):
                    json_approval_count += 1
    
    db_approval_count = session.query(Approval).count()
    
    if db_approval_count != json_approval_count:
        warnings.append(f"Approval count mismatch: DB={db_approval_count}, JSON={json_approval_count}")
        print(f"⚠️  Approvals: DB={db_approval_count}, JSON={json_approval_count}")
    else:
        print(f"✅ Approvals: {db_approval_count} (matches JSON)")
    
    # Count orders
    json_order_count = sum(
        1 for s in materials_data.get("sections", [])
        for item in s.get("items", [])
        if item.get("order")
    )
    db_order_count = session.query(Order).count()
    
    if db_order_count != json_order_count:
        errors.append(f"Order count mismatch: DB={db_order_count}, JSON={json_order_count}")
    else:
        print(f"✅ Orders: {db_order_count} (matches JSON)")
    
    # Count replacement URLs
    json_replacement_url_count = 0
    for section in materials_data.get("sections", []):
        for item in section.get("items", []):
            approvals = item.get("approvals", {})
            for role in ["client", "cray"]:
                approval = approvals.get(role, {})
                urls = approval.get("replacementUrls", [])
                json_replacement_url_count += len([u for u in urls if u])
    
    db_replacement_url_count = session.query(ReplacementUrl).count()
    
    if db_replacement_url_count != json_replacement_url_count:
        warnings.append(f"Replacement URL count mismatch: DB={db_replacement_url_count}, JSON={json_replacement_url_count}")
        print(f"⚠️  Replacement URLs: DB={db_replacement_url_count}, JSON={json_replacement_url_count}")
    else:
        print(f"✅ Replacement URLs: {db_replacement_url_count} (matches JSON)")
    
    # Count comments
    json_comment_count = 0
    for section in materials_data.get("sections", []):
        for item in section.get("items", []):
            comments = item.get("comments", {})
            for role in ["client", "cray"]:
                if comments.get(role):
                    json_comment_count += 1
    
    db_comment_count = session.query(Comment).count()
    
    if db_comment_count != json_comment_count:
        warnings.append(f"Comment count mismatch: DB={db_comment_count}, JSON={json_comment_count}")
        print(f"⚠️  Comments: DB={db_comment_count}, JSON={json_comment_count}")
    else:
        print(f"✅ Comments: {db_comment_count} (matches JSON)")
    
    return errors, warnings


def validate_projects(session, projects_data):
    """Validate projects migration."""
    print()
    print("=" * 80)
    print("Validating Projects Migration")
    print("=" * 80)
    
    errors = []
    warnings = []
    
    # Filter out demo projects
    non_demo_projects = [p for p in projects_data if not p.get("isDemo", False)]
    
    db_project_count = session.query(Project).filter(Project.is_demo == False).count()
    json_project_count = len(non_demo_projects)
    
    if db_project_count != json_project_count:
        errors.append(f"Project count mismatch: DB={db_project_count}, JSON={json_project_count}")
    else:
        print(f"✅ Projects: {db_project_count} (matches JSON)")
    
    # Count project members (should be at least 1 per project)
    db_member_count = session.query(ProjectMember).count()
    if db_member_count < json_project_count:
        warnings.append(f"Project member count ({db_member_count}) is less than project count ({json_project_count})")
        print(f"⚠️  Project Members: {db_member_count} (expected at least {json_project_count})")
    else:
        print(f"✅ Project Members: {db_member_count}")
    
    # Count quotes
    json_quote_count = sum(1 for p in non_demo_projects if p.get("devisStatus"))
    db_quote_count = session.query(Quote).count()
    
    if db_quote_count != json_quote_count:
        warnings.append(f"Quote count mismatch: DB={db_quote_count}, JSON={json_quote_count}")
        print(f"⚠️  Quotes: DB={db_quote_count}, JSON={json_quote_count}")
    else:
        print(f"✅ Quotes: {db_quote_count} (matches JSON)")
    
    return errors, warnings


def validate_workers(session, workers_data):
    """Validate workers migration."""
    print()
    print("=" * 80)
    print("Validating Workers Migration")
    print("=" * 80)
    
    errors = []
    warnings = []
    
    # Filter out demo workers
    non_demo_workers = [
        w for w in workers_data
        if not (w.get("id", "").startswith("worker-") and w.get("id", "").replace("worker-", "").isdigit())
    ]
    
    db_worker_count = session.query(Worker).count()
    json_worker_count = len(non_demo_workers)
    
    if db_worker_count != json_worker_count:
        errors.append(f"Worker count mismatch: DB={db_worker_count}, JSON={json_worker_count}")
    else:
        print(f"✅ Workers: {db_worker_count} (matches JSON)")
    
    # Count worker jobs
    json_job_count = sum(len(w.get("jobs", [])) for w in non_demo_workers)
    db_job_count = session.query(WorkerJob).count()
    
    if db_job_count != json_job_count:
        warnings.append(f"Worker job count mismatch: DB={db_job_count}, JSON={json_job_count}")
        print(f"⚠️  Worker Jobs: DB={db_job_count}, JSON={json_job_count}")
    else:
        print(f"✅ Worker Jobs: {db_job_count} (matches JSON)")
    
    return errors, warnings


def validate_edit_history(session, edit_history_data):
    """Validate edit history migration."""
    print()
    print("=" * 80)
    print("Validating Edit History Migration")
    print("=" * 80)
    
    errors = []
    warnings = []
    
    db_history_count = session.query(EditHistory).count()
    json_history_count = len(edit_history_data)
    
    if db_history_count != json_history_count:
        warnings.append(f"Edit history count mismatch: DB={db_history_count}, JSON={json_history_count}")
        print(f"⚠️  Edit History: DB={db_history_count}, JSON={json_history_count}")
        print("   (Some entries may have been skipped due to missing items)")
    else:
        print(f"✅ Edit History: {db_history_count} (matches JSON)")
    
    return errors, warnings


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Validate database migration")
    parser.add_argument("--projects-file", type=str, help="Path to projects JSON file")
    parser.add_argument("--workers-file", type=str, help="Path to workers JSON file")
    args = parser.parse_args()
    
    print("=" * 80)
    print("Migration Validation Script")
    print("=" * 80)
    print()
    
    # Load source data
    with open(MATERIALS_JSON, 'r', encoding='utf-8') as f:
        materials_data = json.load(f)
    
    edit_history_data = []
    if EDIT_HISTORY_JSON.exists():
        with open(EDIT_HISTORY_JSON, 'r', encoding='utf-8') as f:
            edit_history_data = json.load(f)
    
    projects_data = []
    if args.projects_file:
        with open(args.projects_file, 'r', encoding='utf-8') as f:
            projects_data = json.load(f)
    
    workers_data = []
    if args.workers_file:
        with open(args.workers_file, 'r', encoding='utf-8') as f:
            workers_data = json.load(f)
    
    # Create session
    session = SessionLocal()
    
    try:
        all_errors = []
        all_warnings = []
        
        # Validate each data type
        errors, warnings = validate_materials(session, materials_data)
        all_errors.extend(errors)
        all_warnings.extend(warnings)
        
        if projects_data:
            errors, warnings = validate_projects(session, projects_data)
            all_errors.extend(errors)
            all_warnings.extend(warnings)
        
        if workers_data:
            errors, warnings = validate_workers(session, workers_data)
            all_errors.extend(errors)
            all_warnings.extend(warnings)
        
        if edit_history_data:
            errors, warnings = validate_edit_history(session, edit_history_data)
            all_errors.extend(errors)
            all_warnings.extend(warnings)
        
        # Print summary
        print()
        print("=" * 80)
        print("Validation Summary")
        print("=" * 80)
        
        if all_errors:
            print(f"❌ Errors: {len(all_errors)}")
            for error in all_errors:
                print(f"   - {error}")
            print()
        
        if all_warnings:
            print(f"⚠️  Warnings: {len(all_warnings)}")
            for warning in all_warnings:
                print(f"   - {warning}")
            print()
        
        if not all_errors and not all_warnings:
            print("✅ All validations passed!")
        elif not all_errors:
            print("✅ No critical errors found (warnings are acceptable)")
        else:
            print("❌ Validation failed with errors")
            sys.exit(1)
        
    finally:
        session.close()


if __name__ == "__main__":
    main()
