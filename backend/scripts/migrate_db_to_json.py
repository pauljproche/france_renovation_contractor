#!/usr/bin/env python3
"""
Reverse migration script: Export database data back to JSON format.

This script can be used for backup or rollback purposes.
It exports data in the same format as the source JSON files.

Usage:
    python backend/scripts/migrate_db_to_json.py --output-dir OUTPUT_DIR
"""

import json
import sys
import argparse
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy.orm import joinedload
from backend.database import SessionLocal
from backend.models import (
    Project, Section, Item, Approval, ReplacementUrl, Order, Comment,
    Worker, WorkerJob, EditHistory, Quote
)


def export_materials(session, output_dir: Path):
    """Export materials data to JSON format."""
    print("Exporting materials...")
    
    sections_data = []
    
    sections = session.query(Section).order_by(Section.id).all()
    
    for section in sections:
        section_dict = {
            "id": section.id,
            "label": section.label,
            "items": []
        }
        
        items = session.query(Item).filter(Item.section_id == section.id).order_by(Item.id).all()
        
        for item in items:
            item_dict = {
                "product": item.product,
                "reference": item.reference,
                "supplierLink": item.supplier_link,
                "price": {
                    "ttc": float(item.price_ttc) if item.price_ttc else None,
                    "htQuote": float(item.price_ht_quote) if item.price_ht_quote else None
                },
                "approvals": {
                    "client": {},
                    "cray": {}  # Note: stored as "contractor" in DB, exported as "cray" for compatibility
                },
                "order": {},
                "comments": {
                    "client": None,
                    "cray": None
                }
            }
            
            # Add labor type if present
            if item.labor_type:
                # Map enum value back to French string (simplified - would need full mapping)
                item_dict["laborType"] = item.labor_type.value
            
            # Get approvals
            approvals = session.query(Approval).filter(Approval.item_id == item.id).all()
            for approval in approvals:
                role_key = "cray" if approval.role == "contractor" else approval.role
                approval_dict = {
                    "status": approval.status.value if approval.status else None,
                    "note": approval.note,
                    "validatedAt": approval.validated_at.isoformat() + "Z" if approval.validated_at else None,
                    "replacementUrls": []
                }
                
                # Get replacement URLs
                urls = session.query(ReplacementUrl).filter(ReplacementUrl.approval_id == approval.id).all()
                approval_dict["replacementUrls"] = [url.url for url in urls]
                
                item_dict["approvals"][role_key] = approval_dict
            
            # Get order
            order = session.query(Order).filter(Order.item_id == item.id).first()
            if order:
                item_dict["order"] = {
                    "ordered": order.ordered,
                    "orderDate": order.order_date,
                    "delivery": {
                        "date": order.delivery_date,
                        "status": order.delivery_status.value if order.delivery_status else None
                    },
                    "quantity": order.quantity
                }
            
            # Get comments
            comments = session.query(Comment).filter(Comment.item_id == item.id).all()
            for comment in comments:
                role_key = "cray" if comment.role == "contractor" else comment.role
                item_dict["comments"][role_key] = comment.comment_text
            
            # Get project address for chantier
            if section.project_id:
                project = session.query(Project).filter(Project.id == section.project_id).first()
                if project:
                    item_dict["chantier"] = project.address or project.name
            
            section_dict["items"].append(item_dict)
        
        sections_data.append(section_dict)
    
    materials_data = {
        "currency": "EUR",
        "sections": sections_data
    }
    
    output_file = output_dir / "materials.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(materials_data, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Exported materials to: {output_file}")
    print(f"   Sections: {len(sections_data)}")
    print(f"   Items: {sum(len(s['items']) for s in sections_data)}")


def export_projects(session, output_dir: Path):
    """Export projects data to JSON format."""
    print("Exporting projects...")
    
    projects_data = []
    
    projects = session.query(Project).filter(Project.is_demo == False).order_by(Project.created_at).all()
    
    for project in projects:
        project_dict = {
            "id": project.id,
            "name": project.name,
            "address": project.address,
            "clientName": "",  # Would need to look up from project_members
            "createdAt": project.created_at.isoformat() + "Z" if project.created_at else None,
            "updatedAt": project.updated_at.isoformat() + "Z" if project.updated_at else None,
            "startDate": project.start_date.isoformat() + "Z" if project.start_date else None,
            "endDate": project.end_date.isoformat() + "Z" if project.end_date else None,
            "status": project.status.value,
            "isDemo": False,
            "hasData": project.has_data,
            "invoiceCount": project.invoice_count,
            "percentagePaid": project.percentage_paid,
            "devisStatus": None
        }
        
        # Get quote status
        quote = session.query(Quote).filter(Quote.project_id == project.id).order_by(Quote.version_number.desc()).first()
        if quote:
            project_dict["devisStatus"] = quote.status.value
        
        projects_data.append(project_dict)
    
    output_file = output_dir / "projects.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(projects_data, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Exported projects to: {output_file}")
    print(f"   Projects: {len(projects_data)}")


def export_workers(session, output_dir: Path):
    """Export workers data to JSON format."""
    print("Exporting workers...")
    
    workers_data = []
    
    workers = session.query(Worker).all()
    
    for worker in workers:
        # Get user info
        from backend.models import User
        user = session.query(User).filter(User.id == worker.user_id).first()
        
        worker_dict = {
            "id": worker.user_id,
            "name": user.email.split('@')[0] if user else "Unknown",  # Simplified - name not in users table
            "email": user.email if user else "",
            "phone": "",  # Not stored in current schema
            "jobs": []
        }
        
        # Get jobs
        jobs = session.query(WorkerJob).filter(WorkerJob.worker_id == worker.user_id).all()
        for job in jobs:
            project = session.query(Project).filter(Project.id == job.project_id).first()
            
            job_dict = {
                "id": job.id,
                "chantierName": project.address or project.name if project else None,
                "startDate": job.start_date.isoformat() + "Z" if job.start_date else None,
                "endDate": job.end_date.isoformat() + "Z" if job.end_date else None,
                "jobType": job.job_type.value if job.job_type else None
            }
            
            worker_dict["jobs"].append(job_dict)
        
        workers_data.append(worker_dict)
    
    output_file = output_dir / "workers.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(workers_data, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Exported workers to: {output_file}")
    print(f"   Workers: {len(workers_data)}")


def export_edit_history(session, output_dir: Path):
    """Export edit history data to JSON format."""
    print("Exporting edit history...")
    
    history_data = []
    
    history_entries = session.query(EditHistory).order_by(EditHistory.timestamp).all()
    
    for entry in history_entries:
        entry_dict = {
            "timestamp": entry.timestamp.isoformat() + "Z" if entry.timestamp else None,
            "section_id": entry.section_id,
            "section_label": entry.section_label,
            "item_index": None,  # Cannot reconstruct index from item_id alone
            "product": entry.product,
            "field_path": entry.field_path,
            "old_value": entry.old_value,
            "new_value": entry.new_value,
            "source": entry.source
        }
        
        history_data.append(entry_dict)
    
    output_file = output_dir / "edit-history.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(history_data, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Exported edit history to: {output_file}")
    print(f"   Entries: {len(history_data)}")
    print("   ⚠️  Note: item_index cannot be reconstructed (would need item position within section)")


def main():
    parser = argparse.ArgumentParser(description="Export database data to JSON format")
    parser.add_argument("--output-dir", type=str, required=True, help="Output directory for JSON files")
    args = parser.parse_args()
    
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("=" * 80)
    print("Reverse Migration: Database → JSON")
    print("=" * 80)
    print()
    print(f"Output directory: {output_dir}")
    print()
    
    session = SessionLocal()
    
    try:
        export_materials(session, output_dir)
        print()
        export_projects(session, output_dir)
        print()
        export_workers(session, output_dir)
        print()
        export_edit_history(session, output_dir)
        print()
        
        print("=" * 80)
        print("✅ Export Complete!")
        print("=" * 80)
        
    except Exception as e:
        print()
        print("=" * 80)
        print(f"❌ Export Failed: {e}")
        print("=" * 80)
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    main()
