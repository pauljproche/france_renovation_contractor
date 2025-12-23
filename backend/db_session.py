"""
Database session management with context managers for transaction handling.

Provides context managers for database sessions with automatic rollback on error
and proper cleanup.
"""
from contextlib import contextmanager
from sqlalchemy.exc import SQLAlchemyError
import logging
import sys
from pathlib import Path

# Handle imports for both backend/ and project root execution
try:
    from database import SessionLocal  # Works when running from backend/ directory
except ImportError:
    # Try adding parent directory to path for project root execution
    backend_dir = Path(__file__).parent
    if str(backend_dir.parent) not in sys.path:
        sys.path.insert(0, str(backend_dir.parent))
    try:
        from backend.database import SessionLocal
    except ImportError:
        # Check if database.py exists
        import os
        db_file = os.path.join(os.path.dirname(__file__), 'database.py')
        if os.path.exists(db_file):
            # File exists but import failed - might be due to database connection error
            # Try importing with error handling
            try:
                import importlib.util
                spec = importlib.util.spec_from_file_location("database", db_file)
                database_module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(database_module)
                SessionLocal = database_module.SessionLocal
            except Exception as e:
                # If it's a database connection error, that's expected if DB isn't running
                # Re-raise for now - the error will be caught at the application level
                raise ImportError(f"Cannot import database module. Error: {e}")
        else:
            raise ImportError("Cannot import database module. Please ensure database.py exists in backend/ directory.")

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

