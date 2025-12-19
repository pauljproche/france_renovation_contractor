#!/usr/bin/env python3
"""
Migration script to migrate data from JSON files and localStorage to PostgreSQL database.

This script handles:
- Materials data (sections, items, approvals, orders, comments, replacement_urls)
- Projects data (from JSON export of localStorage)
- Workers data (from JSON export of localStorage)
- Edit history data

Usage:
    python backend/scripts/migrate_json_to_db.py [--projects-file PATH] [--workers-file PATH] [--dry-run]

Requirements:
    - Docker PostgreSQL must be running
    - Database schema must be created (Phase 1 complete)
    - For projects/workers: Export localStorage data to JSON files first using export_localStorage_data.js
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import argparse

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from backend.database import SessionLocal, engine
from backend.models import (
    User, Project, ProjectMember, Quote, Worker, WorkerJob,
    Section, Item, Approval, ReplacementURL, Order, Comment, EditHistory,
    WorkTypeEnum, ApprovalStatusEnum, DeliveryStatusEnum, ProjectStatusEnum,
    QuoteStatusEnum, UserRoleEnum, ProjectMemberRoleEnum
)

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
MATERIALS_JSON = PROJECT_ROOT / "data" / "materials.json"
EDIT_HISTORY_JSON = PROJECT_ROOT / "data" / "edit-history.json"

# Default user ID for migration (single-user system)
DEFAULT_USER_ID = "migration-user"
DEFAULT_USER_EMAIL = "migration@france-renovation.local"


# ============================================================================
# Mapping Functions
# ============================================================================

def map_labor_type_to_enum(labor_type: Optional[str]) -> Optional[WorkTypeEnum]:
    """Map French labor type strings to WorkTypeEnum values."""
    if not labor_type:
        return None
    
    mapping = {
        "Démolition & Dépose": WorkTypeEnum.DEMOLITION,
        "Gros œuvre & structure": WorkTypeEnum.STRUCTURAL,
        "Façade, Couverture & ITE": WorkTypeEnum.FACADE,
        "Menuiseries extérieures": WorkTypeEnum.EXTERIOR_JOINERY,
        "Plâtrerie & ITI": WorkTypeEnum.PLASTERING,
        "Plomberie & CVC": WorkTypeEnum.PLUMBING,
        "Électricité": WorkTypeEnum.ELECTRICAL,
        "Revêtement mur & plafond": WorkTypeEnum.WALL_COVERING,
        "Menuiseries intérieures": WorkTypeEnum.INTERIOR_JOINERY,
        "Espaces verts & Extérieurs": WorkTypeEnum.LANDSCAPING,
        "Révision de prix": WorkTypeEnum.PRICE_REVISION,
        # Also handle jobType values from workers
        "demo": WorkTypeEnum.DEMOLITION,
        "demolition": WorkTypeEnum.DEMOLITION,
        "plumbing": WorkTypeEnum.PLUMBING,
        "electrical": WorkTypeEnum.ELECTRICAL,
    }
    
    return mapping.get(labor_type)


def map_approval_status(status: Optional[str]) -> Optional[ApprovalStatusEnum]:
    """Map approval status strings to ApprovalStatusEnum."""
    if not status:
        return None
    
    mapping = {
        "approved": ApprovalStatusEnum.APPROVED,
        "alternative": ApprovalStatusEnum.CHANGE_ORDER,  # "alternative" means change order
        "pending": ApprovalStatusEnum.PENDING,
        "rejected": ApprovalStatusEnum.REJECTED,
        "supplied_by": ApprovalStatusEnum.SUPPLIED_BY,
    }
    
    return mapping.get(status.lower())


def map_delivery_status(status: Optional[str]) -> Optional[DeliveryStatusEnum]:
    """Map delivery status strings to DeliveryStatusEnum."""
    if not status:
        return None
    
    mapping = {
        "pending": DeliveryStatusEnum.PENDING,
        "ordered": DeliveryStatusEnum.ORDERED,
        "shipped": DeliveryStatusEnum.SHIPPED,
        "delivered": DeliveryStatusEnum.DELIVERED,
        "cancelled": DeliveryStatusEnum.CANCELLED,
    }
    
    return mapping.get(status.lower())


def map_project_status(status: str) -> ProjectStatusEnum:
    """Map project status strings to ProjectStatusEnum."""
    mapping = {
        "draft": ProjectStatusEnum.DRAFT,
        "ready": ProjectStatusEnum.READY,
        "active": ProjectStatusEnum.ACTIVE,
        "completed": ProjectStatusEnum.COMPLETED,
        "archived": ProjectStatusEnum.ARCHIVED,
    }
    return mapping.get(status.lower(), ProjectStatusEnum.DRAFT)


def map_quote_status(status: Optional[str]) -> Optional[QuoteStatusEnum]:
    """Map quote/devis status strings to QuoteStatusEnum."""
    if not status:
        return None
    
    mapping = {
        "draft": QuoteStatusEnum.DRAFT,
        "sent": QuoteStatusEnum.SENT,
        "approved": QuoteStatusEnum.APPROVED,
        "rejected": QuoteStatusEnum.REJECTED,
        "superseded": QuoteStatusEnum.SUPERSEDED,
    }
    
    return mapping.get(status.lower())


def parse_date(date_str: Optional[str]) -> Optional[datetime]:
    """Parse ISO date string to datetime."""
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        return None


# ============================================================================
# Migration Functions
# ============================================================================

def ensure_default_user(session: Session) -> User:
    """Ensure default user exists for migration."""
    user = session.query(User).filter(User.id == DEFAULT_USER_ID).first()
    if not user:
        user = User(
            id=DEFAULT_USER_ID,
            email=DEFAULT_USER_EMAIL,
            role=UserRoleEnum.CONTRACTOR,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        session.add(user)
        session.flush()
        print(f"✅ Created default user: {DEFAULT_USER_ID}")
    return user


def migrate_materials(session: Session, materials_data: Dict, project_map: Dict[str, str], dry_run: bool = False) -> Dict[str, Any]:
    """
    Migrate materials data from JSON to database.
    
    Args:
        session: Database session
        materials_data: Materials JSON data
        project_map: Mapping from chantier name to project_id
        dry_run: If True, don't commit changes
    
    Returns:
        Statistics dict with counts
    """
    stats = {
        "sections": 0,
        "items": 0,
        "approvals": 0,
        "replacement_urls": 0,
        "orders": 0,
        "comments": 0,
    }
    
    sections_data = materials_data.get("sections", [])
    
    for section_data in sections_data:
        section_id = section_data["id"]
        section_label = section_data["label"]
        
        # Find project_id from chantier name (use first item's chantier or section id as fallback)
        project_id = None
        if section_data.get("items"):
            first_chantier = section_data["items"][0].get("chantier")
            if first_chantier and first_chantier in project_map:
                project_id = project_map[first_chantier]
        
        # Create or get section
        section = session.query(Section).filter(Section.id == section_id).first()
        if not section:
            section = Section(
                id=section_id,
                label=section_label,
                project_id=project_id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            session.add(section)
            stats["sections"] += 1
        else:
            # Update section if needed
            section.label = section_label
            section.project_id = project_id
            section.updated_at = datetime.utcnow()
        
        session.flush()
        
        # Migrate items
        for item_data in section_data.get("items", []):
            # Skip items with empty product (violates constraint)
            product = item_data.get("product", "").strip()
            if not product:
                print(f"⚠️  Warning: Skipping item with empty product in section '{section_label}'")
                continue
            
            # Create item
            item = Item(
                section_id=section_id,
                product=product,
                reference=item_data.get("reference"),
                supplier_link=item_data.get("supplierLink"),
                labor_type=map_labor_type_to_enum(item_data.get("laborType")),
                price_ttc=item_data.get("price", {}).get("ttc"),
                price_ht_quote=item_data.get("price", {}).get("htQuote"),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            session.add(item)
            session.flush()
            stats["items"] += 1
            
            item_id = item.id
            
            # Migrate approvals
            approvals_data = item_data.get("approvals", {})
            for role_key, role_name in [("client", "client"), ("cray", "contractor")]:
                approval_data = approvals_data.get(role_key)
                if approval_data:
                    status = map_approval_status(approval_data.get("status"))
                    if status is not None:  # Only create if status is not None
                        approval = Approval(
                            item_id=item_id,
                            role=role_name,
                            status=status,
                            note=approval_data.get("note"),
                            validated_at=parse_date(approval_data.get("validatedAt")),
                            created_at=datetime.utcnow(),
                            updated_at=datetime.utcnow()
                        )
                        session.add(approval)
                        session.flush()
                        stats["approvals"] += 1
                        
                        approval_id = approval.id
                        
                        # Migrate replacement URLs
                        replacement_urls = approval_data.get("replacementUrls", [])
                        for url in replacement_urls:
                            if url:  # Only add non-empty URLs
                                replacement_url = ReplacementURL(
                                    approval_id=approval_id,
                                    url=url,
                                    created_at=datetime.utcnow()
                                )
                                session.add(replacement_url)
                                stats["replacement_urls"] += 1
            
            # Migrate order
            order_data = item_data.get("order", {})
            if order_data:
                delivery_status = None
                if order_data.get("delivery"):
                    delivery_status = map_delivery_status(order_data["delivery"].get("status"))
                
                order = Order(
                    item_id=item_id,
                    ordered=order_data.get("ordered", False),
                    order_date=order_data.get("orderDate"),
                    delivery_date=order_data.get("delivery", {}).get("date"),
                    delivery_status=delivery_status,
                    quantity=order_data.get("quantity"),
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                session.add(order)
                stats["orders"] += 1
            
            # Migrate comments
            comments_data = item_data.get("comments", {})
            for role_key, role_name in [("client", "client"), ("cray", "contractor")]:
                comment_text = comments_data.get(role_key)
                if comment_text:  # Only create if comment is not None/empty
                    comment = Comment(
                        item_id=item_id,
                        role=role_name,
                        comment_text=comment_text,
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    )
                    session.add(comment)
                    stats["comments"] += 1
    
    if not dry_run:
        session.commit()
        print("✅ Materials migration committed")
    else:
        print("🔍 DRY RUN: Materials migration not committed")
    
    return stats


def migrate_projects(session: Session, projects_data: List[Dict], dry_run: bool = False) -> Dict[str, Any]:
    """
    Migrate projects data from JSON to database.
    
    Args:
        session: Database session
        projects_data: List of project objects from localStorage export
        dry_run: If True, don't commit changes
    
    Returns:
        Statistics dict and project_map (chantier name -> project_id)
    """
    stats = {
        "projects": 0,
        "project_members": 0,
        "quotes": 0,
    }
    
    project_map = {}  # Maps chantier name (address/name) to project_id
    default_user = ensure_default_user(session)
    
    for project_data in projects_data:
        # Skip demo projects
        if project_data.get("isDemo", False):
            print(f"⏭️  Skipping demo project: {project_data.get('id')}")
            continue
        
        project_id = project_data["id"]
        project_name = project_data.get("name") or project_data.get("address", "Untitled Project")
        project_address = project_data.get("address")
        
        # Map chantier name to project_id for materials migration
        if project_address:
            project_map[project_address] = project_id
        if project_name and project_name != project_address:
            project_map[project_name] = project_id
        
        # Create project
        project = session.query(Project).filter(Project.id == project_id).first()
        if not project:
            project = Project(
                id=project_id,
                name=project_name,
                address=project_address,
                owner_id=default_user.id,
                status=map_project_status(project_data.get("status", "draft")),
                invoice_count=project_data.get("invoiceCount", 0),
                percentage_paid=project_data.get("percentagePaid", 0),
                start_date=parse_date(project_data.get("startDate")),
                end_date=parse_date(project_data.get("endDate")),
                is_demo=False,
                has_data=project_data.get("hasData", False),
                created_at=parse_date(project_data.get("createdAt")) or datetime.utcnow(),
                updated_at=parse_date(project_data.get("updatedAt")) or datetime.utcnow()
            )
            session.add(project)
            stats["projects"] += 1
        else:
            # Update existing project
            project.name = project_name
            project.address = project_address
            project.status = map_project_status(project_data.get("status", "draft"))
            project.invoice_count = project_data.get("invoiceCount", 0)
            project.percentage_paid = project_data.get("percentagePaid", 0)
            project.start_date = parse_date(project_data.get("startDate"))
            project.end_date = parse_date(project_data.get("endDate"))
            project.has_data = project_data.get("hasData", False)
            project.updated_at = parse_date(project_data.get("updatedAt")) or datetime.utcnow()
        
        session.flush()
        
        # Create project member (owner)
        existing_member = session.query(ProjectMember).filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == default_user.id
        ).first()
        
        if not existing_member:
            member = ProjectMember(
                project_id=project_id,
                user_id=default_user.id,
                role=ProjectMemberRoleEnum.CONTRACTOR,
                created_at=datetime.utcnow()
            )
            session.add(member)
            stats["project_members"] += 1
        
        # Create quote if devisStatus exists
        devis_status = project_data.get("devisStatus")
        if devis_status:
            quote_status = map_quote_status(devis_status)
            if quote_status:
                # Check if quote already exists
                existing_quote = session.query(Quote).filter(
                    Quote.project_id == project_id,
                    Quote.version_number == 1
                ).first()
                
                if not existing_quote:
                    quote = Quote(
                        id=f"{project_id}-quote-1",
                        project_id=project_id,
                        status=quote_status,
                        version_number=1,
                        sent_at=datetime.utcnow() if quote_status != QuoteStatusEnum.DRAFT else None,
                        approved_at=datetime.utcnow() if quote_status == QuoteStatusEnum.APPROVED else None,
                        rejected_at=datetime.utcnow() if quote_status == QuoteStatusEnum.REJECTED else None,
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    )
                    session.add(quote)
                    stats["quotes"] += 1
    
    if not dry_run:
        session.commit()
        print("✅ Projects migration committed")
    else:
        print("🔍 DRY RUN: Projects migration not committed")
    
    return stats, project_map


def migrate_workers(session: Session, workers_data: List[Dict], project_map: Dict[str, str], dry_run: bool = False) -> Dict[str, Any]:
    """
    Migrate workers data from JSON to database.
    
    Args:
        session: Database session
        workers_data: List of worker objects from localStorage export
        project_map: Mapping from chantier name to project_id
        dry_run: If True, don't commit changes
    
    Returns:
        Statistics dict
    """
    stats = {
        "users": 0,
        "workers": 0,
        "worker_jobs": 0,
    }
    
    default_user = ensure_default_user(session)
    
    for worker_data in workers_data:
        # Skip demo workers (they have IDs like 'worker-1', 'worker-2', etc.)
        worker_id = worker_data.get("id", "")
        if worker_id.startswith("worker-") and worker_id.replace("worker-", "").isdigit():
            print(f"⏭️  Skipping demo worker: {worker_id}")
            continue
        
        # Create user for worker
        user_id = worker_id  # Use worker ID as user ID
        user = session.query(User).filter(User.id == user_id).first()
        
        if not user:
            # Generate email if not provided
            email = worker_data.get("email")
            if not email:
                email = f"{worker_data.get('name', 'worker').lower().replace(' ', '.')}@france-renovation.local"
            
            user = User(
                id=user_id,
                email=email,
                role=UserRoleEnum.WORKER,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            session.add(user)
            session.flush()
            stats["users"] += 1
        
        # Create worker record
        worker = session.query(Worker).filter(Worker.user_id == user_id).first()
        if not worker:
            worker = Worker(
                user_id=user_id,
                certificates=None,  # Can be updated later
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            session.add(worker)
            session.flush()
            stats["workers"] += 1
        
        # Migrate worker jobs
        jobs_data = worker_data.get("jobs", [])
        for job_data in jobs_data:
            job_id = job_data.get("id")
            chantier_name = job_data.get("chantierName")
            
            # Find project_id from chantier name
            project_id = project_map.get(chantier_name)
            if not project_id:
                print(f"⚠️  Warning: Could not find project for chantier '{chantier_name}', skipping job {job_id}")
                continue
            
            # Check if job already exists
            existing_job = session.query(WorkerJob).filter(WorkerJob.id == job_id).first()
            if not existing_job:
                job = WorkerJob(
                    id=job_id,
                    worker_id=user_id,
                    project_id=project_id,
                    job_type=map_labor_type_to_enum(job_data.get("jobType")),
                    location=None,  # Not in current data structure
                    comment=None,  # Not in current data structure
                    start_date=parse_date(job_data.get("startDate")),
                    end_date=parse_date(job_data.get("endDate")),
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                session.add(job)
                stats["worker_jobs"] += 1
    
    if not dry_run:
        session.commit()
        print("✅ Workers migration committed")
    else:
        print("🔍 DRY RUN: Workers migration not committed")
    
    return stats


def migrate_edit_history(session: Session, edit_history_data: List[Dict], section_item_map: Dict[tuple, int], dry_run: bool = False) -> Dict[str, Any]:
    """
    Migrate edit history data from JSON to database.
    
    Args:
        session: Database session
        edit_history_data: List of edit history entries
        section_item_map: Mapping from (section_id, item_index) to item_id
        dry_run: If True, don't commit changes
    
    Returns:
        Statistics dict
    """
    stats = {
        "edit_history": 0,
    }
    
    default_user = ensure_default_user(session)
    
    for entry_data in edit_history_data:
        section_id = entry_data.get("section_id")
        item_index = entry_data.get("item_index")
        
        # Find item_id from section_id and item_index
        item_id = section_item_map.get((section_id, item_index))
        
        if not item_id:
            print(f"⚠️  Warning: Could not find item for section '{section_id}' index {item_index}, skipping edit history entry")
            continue
        
        # Create edit history entry
        edit_entry = EditHistory(
            item_id=item_id,
            user_id=default_user.id,  # Use default user for migration
            section_id=section_id,
            section_label=entry_data.get("section_label"),
            product=entry_data.get("product"),
            field_path=entry_data.get("field_path"),
            old_value=entry_data.get("old_value"),
            new_value=entry_data.get("new_value"),
            source=entry_data.get("source", "manual"),
            timestamp=parse_date(entry_data.get("timestamp")) or datetime.utcnow()
        )
        session.add(edit_entry)
        stats["edit_history"] += 1
    
    if not dry_run:
        session.commit()
        print("✅ Edit history migration committed")
    else:
        print("🔍 DRY RUN: Edit history migration not committed")
    
    return stats


def build_section_item_map(session: Session) -> Dict[tuple, int]:
    """Build mapping from (section_id, item_index) to item_id for edit history migration."""
    mapping = {}
    
    sections = session.query(Section).all()
    for section in sections:
        items = session.query(Item).filter(Item.section_id == section.id).order_by(Item.id).all()
        for index, item in enumerate(items):
            mapping[(section.id, index)] = item.id
    
    return mapping


# ============================================================================
# Main Migration Function
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="Migrate JSON/localStorage data to PostgreSQL")
    parser.add_argument("--projects-file", type=str, help="Path to projects JSON file (exported from localStorage)")
    parser.add_argument("--workers-file", type=str, help="Path to workers JSON file (exported from localStorage)")
    parser.add_argument("--dry-run", action="store_true", help="Perform dry run without committing changes")
    args = parser.parse_args()
    
    print("=" * 80)
    print("Phase 2: Data Migration Script")
    print("=" * 80)
    print()
    
    if args.dry_run:
        print("🔍 DRY RUN MODE: No changes will be committed to database")
        print()
    
    # Check files exist
    if not MATERIALS_JSON.exists():
        print(f"❌ Error: Materials file not found: {MATERIALS_JSON}")
        sys.exit(1)
    
    # Load materials data
    print(f"📖 Loading materials from: {MATERIALS_JSON}")
    with open(MATERIALS_JSON, 'r', encoding='utf-8') as f:
        materials_data = json.load(f)
    print(f"   Found {len(materials_data.get('sections', []))} sections")
    
    # Load edit history
    edit_history_data = []
    if EDIT_HISTORY_JSON.exists():
        print(f"📖 Loading edit history from: {EDIT_HISTORY_JSON}")
        with open(EDIT_HISTORY_JSON, 'r', encoding='utf-8') as f:
            edit_history_data = json.load(f)
        print(f"   Found {len(edit_history_data)} edit history entries")
    else:
        print(f"⚠️  Edit history file not found: {EDIT_HISTORY_JSON}")
    
    # Load projects data
    projects_data = []
    project_map = {}
    if args.projects_file:
        projects_file_path = Path(args.projects_file)
        if projects_file_path.exists():
            print(f"📖 Loading projects from: {projects_file_path}")
            with open(projects_file_path, 'r', encoding='utf-8') as f:
                projects_data = json.load(f)
            print(f"   Found {len(projects_data)} projects")
        else:
            print(f"⚠️  Projects file not found: {projects_file_path}")
    else:
        print("ℹ️  No projects file provided (use --projects-file)")
        print("   Projects can be exported from browser console using export_localStorage_data.js")
    
    # Load workers data
    workers_data = []
    if args.workers_file:
        workers_file_path = Path(args.workers_file)
        if workers_file_path.exists():
            print(f"📖 Loading workers from: {workers_file_path}")
            with open(workers_file_path, 'r', encoding='utf-8') as f:
                workers_data = json.load(f)
            print(f"   Found {len(workers_data)} workers")
        else:
            print(f"⚠️  Workers file not found: {workers_file_path}")
    else:
        print("ℹ️  No workers file provided (use --workers-file)")
        print("   Workers can be exported from browser console using export_localStorage_data.js")
    
    print()
    print("=" * 80)
    print("Starting Migration")
    print("=" * 80)
    print()
    
    # Create database session
    session = SessionLocal()
    
    try:
        # Step 1: Migrate projects first (needed for project_map)
        if projects_data:
            print("🔄 Migrating projects...")
            project_stats, project_map = migrate_projects(session, projects_data, dry_run=args.dry_run)
            print(f"   ✅ Migrated {project_stats['projects']} projects")
            print(f"   ✅ Migrated {project_stats['project_members']} project members")
            print(f"   ✅ Migrated {project_stats['quotes']} quotes")
            print()
        
        # Step 2: Migrate materials (uses project_map)
        print("🔄 Migrating materials...")
        materials_stats = migrate_materials(session, materials_data, project_map, dry_run=args.dry_run)
        print(f"   ✅ Migrated {materials_stats['sections']} sections")
        print(f"   ✅ Migrated {materials_stats['items']} items")
        print(f"   ✅ Migrated {materials_stats['approvals']} approvals")
        print(f"   ✅ Migrated {materials_stats['replacement_urls']} replacement URLs")
        print(f"   ✅ Migrated {materials_stats['orders']} orders")
        print(f"   ✅ Migrated {materials_stats['comments']} comments")
        print()
        
        # Step 3: Migrate workers (uses project_map)
        if workers_data:
            print("🔄 Migrating workers...")
            workers_stats = migrate_workers(session, workers_data, project_map, dry_run=args.dry_run)
            print(f"   ✅ Migrated {workers_stats['users']} users")
            print(f"   ✅ Migrated {workers_stats['workers']} workers")
            print(f"   ✅ Migrated {workers_stats['worker_jobs']} worker jobs")
            print()
        
        # Step 4: Migrate edit history (needs section_item_map)
        if edit_history_data:
            print("🔄 Migrating edit history...")
            section_item_map = build_section_item_map(session)
            print(f"   Built mapping for {len(section_item_map)} items")
            edit_stats = migrate_edit_history(session, edit_history_data, section_item_map, dry_run=args.dry_run)
            print(f"   ✅ Migrated {edit_stats['edit_history']} edit history entries")
            print()
        
        print("=" * 80)
        print("✅ Migration Complete!")
        print("=" * 80)
        
        if args.dry_run:
            print()
            print("🔍 This was a DRY RUN. No changes were committed.")
            print("   Run without --dry-run to commit changes.")
        
    except Exception as e:
        session.rollback()
        print()
        print("=" * 80)
        print(f"❌ Migration Failed: {e}")
        print("=" * 80)
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    main()
