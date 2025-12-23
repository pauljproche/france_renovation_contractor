"""
Database session management with context managers for transaction handling.

Provides context managers for database sessions with automatic rollback on error
and proper cleanup.
"""
from contextlib import contextmanager
from sqlalchemy.exc import SQLAlchemyError
import logging

try:
    from database import SessionLocal  # Works when running from backend/ directory
except ImportError:
    from backend.database import SessionLocal  # Works when running from project root

logger = logging.getLogger(__name__)


@contextmanager
def db_session():
    """
    Context manager for database sessions with automatic rollback on error.
    
    Usage:
        with db_session() as session:
            # Perform database operations
            session.add(item)
            session.commit()  # Commit explicitly or let context manager handle it
    
    If an exception occurs, the session will be rolled back automatically.
    """
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except SQLAlchemyError as e:
        session.rollback()
        logger.error(f"Database error, rolling back transaction: {e}")
        raise
    except Exception as e:
        session.rollback()
        logger.error(f"Unexpected error, rolling back transaction: {e}")
        raise
    finally:
        session.close()


@contextmanager
def db_readonly_session():
    """
    Context manager for read-only database sessions.
    
    Automatically rolls back any changes (read-only guarantee).
    Useful for queries where you want to ensure no modifications occur.
    """
    session = SessionLocal()
    try:
        yield session
        # Always rollback for read-only operations
        session.rollback()
    except Exception as e:
        session.rollback()
        logger.error(f"Read-only session error: {e}")
        raise
    finally:
        session.close()

