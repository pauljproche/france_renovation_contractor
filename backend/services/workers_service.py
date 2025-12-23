"""
Workers service layer for database operations.

Handles CRUD operations for workers and worker jobs.
"""
from typing import Dict, List, Optional, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_

try:
    from models import Worker, WorkerJob, User, Project, WorkTypeEnum, UserRoleEnum
except ImportError:
    from backend.models import Worker, WorkerJob, User, Project, WorkTypeEnum, UserRoleEnum


def map_labor_type_to_enum(job_type: Optional[str]) -> Optional[WorkTypeEnum]:
    """Map job type strings to WorkTypeEnum."""
    if not job_type:
        return None
    
    mapping = {
        "demo": WorkTypeEnum.DEMOLITION,
        "demolition": WorkTypeEnum.DEMOLITION,
        "plumbing": WorkTypeEnum.PLUMBING,
        "electrical": WorkTypeEnum.ELECTRICAL,
        "structural": WorkTypeEnum.STRUCTURAL,
        "facade": WorkTypeEnum.FACADE,
        "exterior_joinery": WorkTypeEnum.EXTERIOR_JOINERY,
        "plastering": WorkTypeEnum.PLASTERING,
        "wall_covering": WorkTypeEnum.WALL_COVERING,
        "interior_joinery": WorkTypeEnum.INTERIOR_JOINERY,
        "landscaping": WorkTypeEnum.LANDSCAPING,
        "price_revision": WorkTypeEnum.PRICE_REVISION,
    }
    
    return mapping.get(job_type.lower())


def map_labor_type_from_enum(enum_value: Optional[WorkTypeEnum]) -> Optional[str]:
    """Map WorkTypeEnum back to string."""
    if not enum_value:
        return None
    
    mapping = {
        WorkTypeEnum.DEMOLITION: "demolition",
        WorkTypeEnum.STRUCTURAL: "structural",
        WorkTypeEnum.FACADE: "facade",
        WorkTypeEnum.EXTERIOR_JOINERY: "exterior_joinery",
        WorkTypeEnum.PLASTERING: "plastering",
        WorkTypeEnum.PLUMBING: "plumbing",
        WorkTypeEnum.ELECTRICAL: "electrical",
        WorkTypeEnum.WALL_COVERING: "wall_covering",
        WorkTypeEnum.INTERIOR_JOINERY: "interior_joinery",
        WorkTypeEnum.LANDSCAPING: "landscaping",
        WorkTypeEnum.PRICE_REVISION: "price_revision",
    }
    
    return mapping.get(enum_value)


def parse_date(date_str: Optional[str]) -> Optional[datetime]:
    """Parse ISO date string to datetime."""
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        return None


def worker_to_json(worker: Worker, session: Session) -> Dict[str, Any]:
    """Convert database Worker to JSON format (compatible with localStorage)."""
    user = session.query(User).filter(User.id == worker.user_id).first()
    
    worker_dict = {
        "id": worker.user_id,
        "name": user.email.split('@')[0] if user and user.email else "Unknown",  # Simplified - name not in users table
        "email": user.email if user else "",
        "phone": "",  # Not stored in current schema
        "jobs": []
    }
    
    # Get worker jobs
    jobs = session.query(WorkerJob).filter(WorkerJob.worker_id == worker.user_id).all()
    for job in jobs:
        project = session.query(Project).filter(Project.id == job.project_id).first()
        
        job_dict = {
            "id": job.id,
            "chantierName": project.address or project.name if project else None,
            "startDate": job.start_date.isoformat() + "Z" if job.start_date else None,
            "endDate": job.end_date.isoformat() + "Z" if job.end_date else None,
            "jobType": map_labor_type_from_enum(job.job_type)
        }
        
        worker_dict["jobs"].append(job_dict)
    
    return worker_dict


def json_to_worker(worker_data: Dict[str, Any], session: Session) -> Worker:
    """Convert JSON worker data to database Worker (create or update)."""
    worker_id = worker_data["id"]
    
    # Create or get user
    user = session.query(User).filter(User.id == worker_id).first()
    if not user:
        # Generate email if not provided
        email = worker_data.get("email")
        if not email:
            name = worker_data.get("name", "worker")
            email = f"{name.lower().replace(' ', '.')}@france-renovation.local"
        
        user = User(
            id=worker_id,
            email=email,
            role=UserRoleEnum.WORKER,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        session.add(user)
        session.flush()
    
    # Create or get worker
    worker = session.query(Worker).filter(Worker.user_id == worker_id).first()
    if not worker:
        worker = Worker(
            user_id=worker_id,
            certificates=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        session.add(worker)
        session.flush()
    
    # Update worker jobs
    jobs_data = worker_data.get("jobs", [])
    existing_job_ids = {job.id for job in session.query(WorkerJob).filter(WorkerJob.worker_id == worker_id).all()}
    json_job_ids = {job.get("id") for job in jobs_data if job.get("id")}
    
    # Delete jobs not in JSON
    for job_id in existing_job_ids - json_job_ids:
        job = session.query(WorkerJob).filter(WorkerJob.id == job_id).first()
        if job:
            session.delete(job)
    
    # Create or update jobs
    for job_data in jobs_data:
        job_id = job_data.get("id")
        chantier_name = job_data.get("chantierName")
        
        # Find project by address or name
        project = None
        if chantier_name:
            project = session.query(Project).filter(
                (Project.address == chantier_name) | (Project.name == chantier_name)
            ).first()
        
        if not project:
            # Skip job if project not found (warning logged elsewhere)
            continue
        
        existing_job = session.query(WorkerJob).filter(WorkerJob.id == job_id).first()
        if existing_job:
            # Update existing job
            existing_job.project_id = project.id
            existing_job.job_type = map_labor_type_to_enum(job_data.get("jobType"))
            existing_job.start_date = parse_date(job_data.get("startDate"))
            existing_job.end_date = parse_date(job_data.get("endDate"))
            existing_job.updated_at = datetime.utcnow()
        else:
            # Create new job
            job = WorkerJob(
                id=job_id,
                worker_id=worker_id,
                project_id=project.id,
                job_type=map_labor_type_to_enum(job_data.get("jobType")),
                location=None,
                comment=None,
                start_date=parse_date(job_data.get("startDate")),
                end_date=parse_date(job_data.get("endDate")),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            session.add(job)
    
    return worker


def get_all_workers(session: Session) -> List[Dict[str, Any]]:
    """
    Get all workers from database and convert to JSON format.
    
    Returns:
        list: List of worker dictionaries (compatible with localStorage format)
    """
    workers = session.query(Worker).all()
    
    result = []
    for worker in workers:
        result.append(worker_to_json(worker, session))
    
    return result


def get_worker(session: Session, worker_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a single worker by ID.
    
    Returns:
        dict: Worker dictionary or None if not found
    """
    worker = session.query(Worker).filter(Worker.user_id == worker_id).first()
    if not worker:
        return None
    
    return worker_to_json(worker, session)


def create_worker(session: Session, worker_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a new worker.
    
    Args:
        session: Database session
        worker_data: Worker data dictionary
    
    Returns:
        dict: Created worker dictionary
    """
    # Generate ID if not provided
    if "id" not in worker_data:
        worker_data["id"] = f"worker-{datetime.utcnow().timestamp() * 1000:.0f}"
    
    worker = json_to_worker(worker_data, session)
    session.flush()
    
    return worker_to_json(worker, session)


def update_worker(session: Session, worker_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update an existing worker.
    
    Args:
        session: Database session
        worker_id: Worker ID (user_id)
        updates: Dictionary with fields to update
    
    Returns:
        dict: Updated worker dictionary or None if not found
    """
    worker = session.query(Worker).filter(Worker.user_id == worker_id).first()
    if not worker:
        return None
    
    user = session.query(User).filter(User.id == worker_id).first()
    if user:
        if "email" in updates:
            user.email = updates["email"]
            user.updated_at = datetime.utcnow()
    
    # Update jobs if provided
    if "jobs" in updates:
        jobs_data = updates["jobs"]
        existing_job_ids = {job.id for job in session.query(WorkerJob).filter(WorkerJob.worker_id == worker_id).all()}
        json_job_ids = {job.get("id") for job in jobs_data if job.get("id")}
        
        # Delete jobs not in updates
        for job_id in existing_job_ids - json_job_ids:
            job = session.query(WorkerJob).filter(WorkerJob.id == job_id).first()
            if job:
                session.delete(job)
        
        # Create or update jobs
        for job_data in jobs_data:
            job_id = job_data.get("id")
            chantier_name = job_data.get("chantierName")
            
            project = None
            if chantier_name:
                project = session.query(Project).filter(
                    (Project.address == chantier_name) | (Project.name == chantier_name)
                ).first()
            
            if not project:
                continue
            
            existing_job = session.query(WorkerJob).filter(WorkerJob.id == job_id).first()
            if existing_job:
                existing_job.project_id = project.id
                existing_job.job_type = map_labor_type_to_enum(job_data.get("jobType"))
                existing_job.start_date = parse_date(job_data.get("startDate"))
                existing_job.end_date = parse_date(job_data.get("endDate"))
                existing_job.updated_at = datetime.utcnow()
            else:
                job = WorkerJob(
                    id=job_id or f"{worker_id}-job-{datetime.utcnow().timestamp() * 1000:.0f}",
                    worker_id=worker_id,
                    project_id=project.id,
                    job_type=map_labor_type_to_enum(job_data.get("jobType")),
                    start_date=parse_date(job_data.get("startDate")),
                    end_date=parse_date(job_data.get("endDate")),
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                session.add(job)
    
    worker.updated_at = datetime.utcnow()
    session.flush()
    
    return worker_to_json(worker, session)


def delete_worker(session: Session, worker_id: str) -> bool:
    """
    Delete a worker (cascades to worker jobs).
    
    Args:
        session: Database session
        worker_id: Worker ID (user_id)
    
    Returns:
        bool: True if deleted, False if not found
    """
    worker = session.query(Worker).filter(Worker.user_id == worker_id).first()
    if not worker:
        return False
    
    # Delete worker (cascades to jobs via FK)
    session.delete(worker)
    
    # Also delete user
    user = session.query(User).filter(User.id == worker_id).first()
    if user:
        session.delete(user)
    
    session.flush()
    
    return True
