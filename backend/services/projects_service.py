"""
Projects service layer for database operations.

Handles CRUD operations for projects and project members.
"""
from typing import Dict, List, Optional, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

try:
    from models import Project, ProjectMember, Quote, User, ProjectStatusEnum, QuoteStatusEnum, ProjectMemberRoleEnum, UserRoleEnum
except ImportError:
    from backend.models import Project, ProjectMember, Quote, User, ProjectStatusEnum, QuoteStatusEnum, ProjectMemberRoleEnum, UserRoleEnum


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


def map_project_status_from_enum(enum_value: ProjectStatusEnum) -> str:
    """Map ProjectStatusEnum back to string."""
    mapping = {
        ProjectStatusEnum.DRAFT: "draft",
        ProjectStatusEnum.READY: "ready",
        ProjectStatusEnum.ACTIVE: "active",
        ProjectStatusEnum.COMPLETED: "completed",
        ProjectStatusEnum.ARCHIVED: "archived",
    }
    return mapping.get(enum_value, "draft")


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


def map_quote_status_from_enum(enum_value: Optional[QuoteStatusEnum]) -> Optional[str]:
    """Map QuoteStatusEnum back to string."""
    if not enum_value:
        return None
    
    mapping = {
        QuoteStatusEnum.DRAFT: "draft",
        QuoteStatusEnum.SENT: "sent",
        QuoteStatusEnum.APPROVED: "approved",
        QuoteStatusEnum.REJECTED: "rejected",
        QuoteStatusEnum.SUPERSEDED: "superseded",
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


def get_default_user(session: Session) -> User:
    """Get or create default user for single-user system."""
    user = session.query(User).filter(User.id == "migration-user").first()
    if not user:
        user = User(
            id="migration-user",
            email="migration@france-renovation.local",
            role=UserRoleEnum.CONTRACTOR,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        session.add(user)
        session.flush()
    return user


def project_to_json(project: Project, session: Optional[Session] = None) -> Dict[str, Any]:
    """Convert database Project to JSON format (compatible with localStorage)."""
    project_dict = {
        "id": project.id,
        "name": project.name,
        "address": project.address,
        "clientName": "",  # Would need to look up from project_members
        "createdAt": project.created_at.isoformat() + "Z" if project.created_at else None,
        "updatedAt": project.updated_at.isoformat() + "Z" if project.updated_at else None,
        "startDate": project.start_date.isoformat() + "Z" if project.start_date else None,
        "endDate": project.end_date.isoformat() + "Z" if project.end_date else None,
        "status": map_project_status_from_enum(project.status),
        "isDemo": project.is_demo,
        "hasData": project.has_data,
        "hidden": project.hidden if hasattr(project, 'hidden') else False,
        "isSystem": project.is_system if hasattr(project, 'is_system') else False,
        "invoiceCount": project.invoice_count,
        "percentagePaid": project.percentage_paid,
        "devisStatus": None
    }
    
    # Get latest quote status (if session provided)
    if session:
        quote = session.query(Quote).filter(Quote.project_id == project.id).order_by(Quote.version_number.desc()).first()
        if quote:
            project_dict["devisStatus"] = map_quote_status_from_enum(quote.status)
    
    return project_dict


def json_to_project(project_data: Dict[str, Any], session: Session, owner_user: Optional[User] = None) -> Project:
    """Convert JSON project data to database Project (create or update)."""
    project_id = project_data["id"]
    
    # Find existing project
    project = session.query(Project).filter(Project.id == project_id).first()
    
    # Get owner (use provided or default)
    if not owner_user:
        owner_user = get_default_user(session)
    
    if project:
        # Update existing project
        project.name = project_data.get("name") or project_data.get("address", "Untitled Project")
        project.address = project_data.get("address")
        project.status = map_project_status(project_data.get("status", "draft"))
        project.invoice_count = project_data.get("invoiceCount", 0)
        project.percentage_paid = project_data.get("percentagePaid", 0)
        project.start_date = parse_date(project_data.get("startDate"))
        project.end_date = parse_date(project_data.get("endDate"))
        project.has_data = project_data.get("hasData", False)
        project.updated_at = parse_date(project_data.get("updatedAt")) or datetime.utcnow()
    else:
        # Create new project
        project = Project(
            id=project_id,
            name=project_data.get("name") or project_data.get("address", "Untitled Project"),
            address=project_data.get("address"),
            owner_id=owner_user.id,
            status=map_project_status(project_data.get("status", "draft")),
            invoice_count=project_data.get("invoiceCount", 0),
            percentage_paid=project_data.get("percentagePaid", 0),
            start_date=parse_date(project_data.get("startDate")),
            end_date=parse_date(project_data.get("endDate")),
            is_demo=False,  # Don't migrate demo projects
            has_data=project_data.get("hasData", False),
            created_at=parse_date(project_data.get("createdAt")) or datetime.utcnow(),
            updated_at=parse_date(project_data.get("updatedAt")) or datetime.utcnow()
        )
        session.add(project)
        session.flush()
        
        # Create project member (owner)
        member = ProjectMember(
            project_id=project.id,
            user_id=owner_user.id,
            role=ProjectMemberRoleEnum.CONTRACTOR,
            created_at=datetime.utcnow()
        )
        session.add(member)
    
    # Handle quote/devis status
    devis_status = project_data.get("devisStatus")
    if devis_status:
        quote_status = map_quote_status(devis_status)
        if quote_status:
            # Get or create quote (version 1)
            quote = session.query(Quote).filter(
                and_(Quote.project_id == project.id, Quote.version_number == 1)
            ).first()
            
            if quote:
                quote.status = quote_status
                quote.updated_at = datetime.utcnow()
            else:
                quote = Quote(
                    id=f"{project.id}-quote-1",
                    project_id=project.id,
                    status=quote_status,
                    version_number=1,
                    sent_at=datetime.utcnow() if quote_status != QuoteStatusEnum.DRAFT else None,
                    approved_at=datetime.utcnow() if quote_status == QuoteStatusEnum.APPROVED else None,
                    rejected_at=datetime.utcnow() if quote_status == QuoteStatusEnum.REJECTED else None,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                session.add(quote)
    
    return project


def get_all_projects(session: Session, user_id: Optional[str] = None, include_hidden: bool = False) -> List[Dict[str, Any]]:
    """
    Get all projects from database (excluding demos) and convert to JSON format.
    
    If user_id is provided, only returns projects where:
    - User is the owner (owner_id == user_id), OR
    - User is a member (ProjectMember with user_id)
    
    If user_id is None, returns all projects (for admin/backward compatibility).
    
    Args:
        session: Database session
        user_id: Optional user ID to filter projects by membership
        include_hidden: If False, excludes hidden projects (default: False)
    
    Returns:
        list: List of project dictionaries (compatible with localStorage format)
    """
    query = session.query(Project).filter(Project.is_demo == False)
    
    # Filter out hidden projects unless explicitly requested
    if not include_hidden:
        query = query.filter(Project.hidden == False)
    
    # Filter by user membership if user_id provided
    if user_id:
        # Get projects where user is owner OR member
        # Get project IDs where user is a member
        member_project_ids = [
            pm.project_id 
            for pm in session.query(ProjectMember.project_id)
            .filter(ProjectMember.user_id == user_id)
            .all()
        ]
        
        # Filter: owner OR member
        if member_project_ids:
            query = query.filter(
                or_(
                    Project.owner_id == user_id,
                    Project.id.in_(member_project_ids)
                )
            )
        else:
            # No memberships, only show owned projects
            query = query.filter(Project.owner_id == user_id)
    
    projects = query.order_by(Project.created_at.desc()).all()
    
    result = []
    for project in projects:
        result.append(project_to_json(project, session))
    
    return result


def get_project(session: Session, project_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a single project by ID.
    
    Returns:
        dict: Project dictionary or None if not found
    """
    project = session.query(Project).filter(Project.id == project_id).first()
    if not project:
        return None
    
    return project_to_json(project, session)


def create_project(session: Session, project_data: Dict[str, Any], owner_user: Optional[User] = None) -> Dict[str, Any]:
    """
    Create a new project.
    
    Args:
        session: Database session
        project_data: Project data dictionary
    
    Returns:
        dict: Created project dictionary
    """
    # Generate ID if not provided
    if "id" not in project_data:
        project_data["id"] = f"project-{datetime.utcnow().timestamp() * 1000:.0f}"
    
    project = json_to_project(project_data, session, owner_user=owner_user)
    session.flush()
    
    return project_to_json(project, session)


def update_project(session: Session, project_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update an existing project.
    
    Args:
        session: Database session
        project_id: Project ID
        updates: Dictionary with fields to update
    
    Returns:
        dict: Updated project dictionary or None if not found
    """
    project = session.query(Project).filter(Project.id == project_id).first()
    if not project:
        return None
    
    # Update fields
    if "name" in updates:
        project.name = updates["name"]
    if "address" in updates:
        project.address = updates["address"]
    if "status" in updates:
        project.status = map_project_status(updates["status"])
    if "invoiceCount" in updates:
        project.invoice_count = updates["invoiceCount"]
    if "percentagePaid" in updates:
        project.percentage_paid = updates["percentagePaid"]
    if "startDate" in updates:
        project.start_date = parse_date(updates["startDate"])
    if "endDate" in updates:
        project.end_date = parse_date(updates["endDate"])
    if "hasData" in updates:
        project.has_data = updates["hasData"]
    if "hidden" in updates:
        # Allow hiding any project (including system projects)
        # System projects can be hidden but cannot be deleted
        project.hidden = updates["hidden"]
    if "isSystem" in updates:
        # Prevent changing is_system flag (security - only via direct DB update)
        pass  # Don't allow changing this via API
    if "devisStatus" in updates:
        devis_status = updates["devisStatus"]
        if devis_status:
            quote_status = map_quote_status(devis_status)
            if quote_status:
                quote = session.query(Quote).filter(
                    and_(Quote.project_id == project.id, Quote.version_number == 1)
                ).first()
                
                if quote:
                    quote.status = quote_status
                    quote.updated_at = datetime.utcnow()
                else:
                    quote = Quote(
                        id=f"{project.id}-quote-1",
                        project_id=project.id,
                        status=quote_status,
                        version_number=1,
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    )
                    session.add(quote)
    
    project.updated_at = datetime.utcnow()
    session.flush()
    
    return project_to_json(project, session)


def delete_project(session: Session, project_id: str) -> bool:
    """
    Delete a project.
    
    Args:
        session: Database session
        project_id: Project ID
    
    Returns:
        bool: True if deleted, False if not found
    
    Raises:
        ValueError: If project is a system project and cannot be deleted
    """
    project = session.query(Project).filter(Project.id == project_id).first()
    if not project:
        return False
    
    # Prevent deletion of system projects
    if project.is_system:
        raise ValueError(f"Cannot delete system project '{project.name}' (ID: {project_id})")
    
    session.delete(project)
    session.flush()
    
    return True

