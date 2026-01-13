"""
User management service for admin operations.
Handles user CRUD operations, password hashing, and role management.
"""
import logging
from sqlalchemy.orm import Session
from sqlalchemy import and_
try:
    from models import User, UserRoleEnum
except ImportError:
    from backend.models import User, UserRoleEnum
from passlib.context import CryptContext
from datetime import datetime
from typing import Optional, List, Union
import uuid

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password using bcrypt.
    
    Bcrypt has a 72-byte limit, so we truncate if necessary.
    """
    # Convert to bytes to check length
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        # Truncate to 72 bytes, but decode back to string for hashing
        password = password_bytes[:72].decode('utf-8', errors='ignore')
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_all_users(session: Session) -> List[dict]:
    """Get all users with their information."""
    users = session.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "id": user.id,
            "email": user.email,
            "role": user.role.value,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "updated_at": user.updated_at.isoformat() if user.updated_at else None,
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "has_password": user.password_hash is not None,
            "password": user.password_plaintext,  # TEMPORARY: For admin display/testing only
        }
        for user in users
    ]


def get_user(session: Session, user_id: str) -> Optional[dict]:
    """Get a single user by ID."""
    user = session.query(User).filter(User.id == user_id).first()
    if not user:
        return None
    
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role.value,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "has_password": user.password_hash is not None,
        "password": user.password_plaintext,  # TEMPORARY: Return plaintext for admin display
    }


def create_user(
    session: Session,
    email: str,
    password: str,
    role: str
) -> dict:
    """Create a new user."""
    # Validate password
    if not password or len(password.strip()) == 0:
        raise ValueError("Password cannot be empty")
    
    if len(password) > 72:
        raise ValueError("Password cannot be longer than 72 characters")
    
    # Validate role - normalize to lowercase first (defensive: handle any case)
    if not role:
        raise ValueError("Role is required")
    
    # Force lowercase normalization
    role_normalized = str(role).lower().strip()
    logger = logging.getLogger(__name__)
    logger.info(f"Creating user with role: '{role}' -> normalized to: '{role_normalized}'")
    
    try:
        role_enum = UserRoleEnum(role_normalized)
        # Double-check: ensure we're using the value, not the name
        logger.info(f"Role enum created: name={role_enum.name}, value={role_enum.value}")
    except ValueError as e:
        logger.error(f"Invalid role '{role}' (normalized: '{role_normalized}'). Valid roles: {[r.value for r in UserRoleEnum]}")
        raise ValueError(f"Invalid role: {role}. Must be one of: {[r.value for r in UserRoleEnum]}")
    
    # Check if email already exists
    existing = session.query(User).filter(User.email == email.lower()).first()
    if existing:
        raise ValueError(f"User with email {email} already exists")
    
    # Generate user ID
    user_id = f"user-{uuid.uuid4().hex[:12]}"
    
    # Hash password (with truncation if needed for bcrypt)
    try:
        password_hash = hash_password(password)
    except Exception as e:
        # If hashing fails, try truncating to 72 bytes
        password_bytes = password.encode('utf-8')
        if len(password_bytes) > 72:
            password = password_bytes[:72].decode('utf-8', errors='ignore')
            password_hash = hash_password(password)
        else:
            raise ValueError(f"Failed to hash password: {str(e)}")
    
    # Create user
    # IMPORTANT: SQLAlchemy PostgreSQL ENUM might serialize enum.name instead of enum.value
    # So we explicitly use the value (string) to ensure it's lowercase
    user = User(
        id=user_id,
        email=email.lower(),
        password_hash=password_hash,
        password_plaintext=password,  # TEMPORARY: Store plaintext for admin display
        role=role_enum.value,  # Use .value explicitly to ensure lowercase 'admin' is stored
    )
    logger.info(f"User object created with role value: '{role_enum.value}' (from enum: {role_enum})")
    
    session.add(user)
    session.commit()
    session.refresh(user)
    
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role.value,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "has_password": True,
        "password": password,  # TEMPORARY: Return plaintext for admin display
    }


def update_user(
    session: Session,
    user_id: str,
    email: Optional[str] = None,
    password: Optional[str] = None,
    role: Optional[str] = None
) -> dict:
    """Update a user's information."""
    user = session.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError(f"User with ID {user_id} not found")
    
    # Update email if provided
    if email is not None:
        # Check if email is already taken by another user
        existing = session.query(User).filter(
            and_(User.email == email.lower(), User.id != user_id)
        ).first()
        if existing:
            raise ValueError(f"Email {email} is already taken by another user")
        user.email = email.lower()
    
    # Update password if provided
    if password is not None:
        if len(password.strip()) == 0:
            raise ValueError("Password cannot be empty")
        if len(password) > 72:
            raise ValueError("Password cannot be longer than 72 characters")
        try:
            password_hash = hash_password(password)
        except Exception as e:
            # If hashing fails, try truncating to 72 bytes
            password_bytes = password.encode('utf-8')
            if len(password_bytes) > 72:
                password = password_bytes[:72].decode('utf-8', errors='ignore')
                password_hash = hash_password(password)
            else:
                raise ValueError(f"Failed to hash password: {str(e)}")
        user.password_hash = password_hash
        user.password_plaintext = password  # TEMPORARY: Store plaintext for admin display
    
    # Update role if provided - normalize to lowercase first
    if role is not None:
        role_normalized = role.lower().strip() if role else None
        if not role_normalized:
            raise ValueError("Role cannot be empty")
        try:
            role_enum = UserRoleEnum(role_normalized)
            user.role = role_enum.value  # Use .value explicitly to ensure lowercase
        except ValueError:
            raise ValueError(f"Invalid role: {role}. Must be one of: {[r.value for r in UserRoleEnum]}")
    
    user.updated_at = datetime.utcnow()
    session.commit()
    session.refresh(user)
    
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role.value,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        "has_password": user.password_hash is not None,
    }


def delete_user(session: Session, user_id: str) -> bool:
    """Delete a user."""
    user = session.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError(f"User with ID {user_id} not found")
    
    # Prevent deleting the last admin
    if user.role == UserRoleEnum.ADMIN:
        admin_count = session.query(User).filter(User.role == UserRoleEnum.ADMIN).count()
        if admin_count <= 1:
            raise ValueError("Cannot delete the last admin user")
    
    session.delete(user)
    session.commit()
    return True


def authenticate_user(session: Session, email: str, password: str) -> Optional[dict]:
    """Authenticate a user by email and password."""
    user = session.query(User).filter(User.email == email).first()
    if not user:
        return None
    
    # Check if user has a password set
    if not user.password_hash:
        return None
    
    # Verify password
    if not verify_password(password, user.password_hash):
        return None
    
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role.value,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
    }


def update_last_login(session: Session, user_id: str) -> bool:
    """Update the last login timestamp for a user."""
    user = session.query(User).filter(User.id == user_id).first()
    if not user:
        return False
    
    user.last_login = datetime.utcnow()
    session.commit()
    return True


def get_user_roles() -> list[str]:
    """Get list of available user roles."""
    return [role.value for role in UserRoleEnum]
