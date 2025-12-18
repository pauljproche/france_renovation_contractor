"""
Database connection and engine configuration for PostgreSQL.

This module sets up SQLAlchemy engine and session management for the application.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Main application database connection (full privileges)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/france_renovation"
)

# Separate connection for agent (restricted role - created in Phase 5)
AGENT_DATABASE_URL = os.getenv(
    "AGENT_DATABASE_URL",
    "postgresql://agent_user:secure_password@localhost:5432/france_renovation"
)

# Create engine with connection pooling
engine = create_engine(
    DATABASE_URL,
    pool_size=10,  # Limit concurrent connections
    max_overflow=20,  # Max connections beyond pool_size
    pool_pre_ping=True,  # Verify connections before use
    pool_recycle=3600,  # Recycle connections after 1 hour
    echo=False  # Set to True for SQL query logging in development
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """
    Dependency function for FastAPI routes.
    Provides database session and ensures cleanup.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
