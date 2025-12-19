"""
SQLAlchemy models for the France Renovation Contractor database.

This module defines all database models with relationships, constraints, and indexes.
All models use TIMESTAMP WITH TIME ZONE for proper timezone handling.
"""
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Numeric, 
    DateTime, ForeignKey, CheckConstraint, UniqueConstraint,
    Index, Enum as SQLEnum
)
from sqlalchemy.dialects.postgresql import JSONB, ENUM
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

try:
    from database import Base  # Works when running from backend/ directory
except ImportError:
    from backend.database import Base  # Works when running from project root


# ============================================================================
# ENUMS (PostgreSQL Enum Types)
# ============================================================================

class WorkTypeEnum(str, enum.Enum):
    """Work type enum: Centralized work/job types."""
    DEMOLITION = 'demolition'
    STRUCTURAL = 'structural'
    FACADE = 'facade'
    EXTERIOR_JOINERY = 'exterior_joinery'
    PLASTERING = 'plastering'
    PLUMBING = 'plumbing'
    ELECTRICAL = 'electrical'
    WALL_COVERING = 'wall_covering'
    INTERIOR_JOINERY = 'interior_joinery'
    LANDSCAPING = 'landscaping'
    PRICE_REVISION = 'price_revision'

class ProjectStatusEnum(str, enum.Enum):
    """Project status enum: Lifecycle status of projects."""
    DRAFT = 'draft'
    READY = 'ready'
    ACTIVE = 'active'
    COMPLETED = 'completed'
    ARCHIVED = 'archived'

class QuoteStatusEnum(str, enum.Enum):
    """Quote status enum: Quote approval status."""
    DRAFT = 'draft'
    SENT = 'sent'
    APPROVED = 'approved'
    REJECTED = 'rejected'
    SUPERSEDED = 'superseded'

class ApprovalStatusEnum(str, enum.Enum):
    """Approval status enum: Status of item approvals."""
    APPROVED = 'approved'
    REJECTED = 'rejected'
    CHANGE_ORDER = 'change_order'
    PENDING = 'pending'
    SUPPLIED_BY = 'supplied_by'

class DeliveryStatusEnum(str, enum.Enum):
    """Delivery status enum: Status of item delivery."""
    PENDING = 'pending'
    ORDERED = 'ordered'
    SHIPPED = 'shipped'
    DELIVERED = 'delivered'
    CANCELLED = 'cancelled'

class UserRoleEnum(str, enum.Enum):
    """User role enum: Roles for users."""
    CONTRACTOR = 'contractor'
    CLIENT = 'client'
    WORKER = 'worker'
    SUBCONTRACTOR = 'subcontractor'

class ProjectMemberRoleEnum(str, enum.Enum):
    """Project member role enum: Roles on projects."""
    CONTRACTOR = 'contractor'
    CLIENT = 'client'
    ARCHITECT = 'architect'
    VIEWER = 'viewer'
    SUBCONTRACTOR = 'subcontractor'


# ============================================================================
# MODELS
# ============================================================================

class User(Base):
    """Users table - authentication & access control."""
    __tablename__ = 'users'
    
    id = Column(String(50), primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=True)  # Nullable if using OAuth only
    role = Column(ENUM(UserRoleEnum, name='user_role_enum'), nullable=False)
    zulip_user_id = Column(String(255), nullable=True)  # For Zulip bot integration
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    owned_projects = relationship('Project', foreign_keys='Project.owner_id', back_populates='owner')
    project_memberships = relationship('ProjectMember', back_populates='user', cascade='all, delete-orphan')
    worker_profile = relationship('Worker', back_populates='user', uselist=False, cascade='all, delete-orphan')
    edit_history = relationship('EditHistory', back_populates='user')
    
    # Constraints
    __table_args__ = (
        CheckConstraint('LENGTH(id) > 0 AND LENGTH(id) <= 50', name='users_id_length'),
        CheckConstraint(
            "email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'",
            name='users_email_valid'
        ),
        Index('idx_users_email', 'email'),
        Index('idx_users_role', 'role'),
        Index('idx_users_zulip_user_id', 'zulip_user_id'),
    )
    
    def __repr__(self):
        return f"<User(id='{self.id}', email='{self.email}', role='{self.role.value}')>"


class Project(Base):
    """Projects table - renovation projects/chantiers."""
    __tablename__ = 'projects'
    
    id = Column(String(50), primary_key=True)
    name = Column(String(255), nullable=False)
    address = Column(String(255), nullable=True)
    owner_id = Column(String(50), ForeignKey('users.id', ondelete='RESTRICT'), nullable=False)
    status = Column(ENUM(ProjectStatusEnum, name='project_status_enum'), default=ProjectStatusEnum.DRAFT, nullable=False)
    invoice_count = Column(Integer, default=0, nullable=False)
    percentage_paid = Column(Integer, default=0, nullable=False)
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    is_demo = Column(Boolean, default=False, nullable=False)
    has_data = Column(Boolean, default=False, nullable=False)
    
    # Relationships
    owner = relationship('User', foreign_keys=[owner_id], back_populates='owned_projects')
    members = relationship('ProjectMember', back_populates='project', cascade='all, delete-orphan')
    quotes = relationship('Quote', back_populates='project', cascade='all, delete-orphan')
    sections = relationship('Section', back_populates='project', cascade='all, delete-orphan')
    worker_jobs = relationship('WorkerJob', back_populates='project', cascade='all, delete-orphan')
    
    # Constraints
    __table_args__ = (
        CheckConstraint('LENGTH(id) > 0 AND LENGTH(id) <= 50', name='projects_id_length'),
        CheckConstraint('LENGTH(name) > 0 AND LENGTH(name) <= 255', name='projects_name_length'),
        CheckConstraint(
            'start_date IS NULL OR end_date IS NULL OR start_date <= end_date',
            name='projects_date_range_valid'
        ),
        CheckConstraint('invoice_count >= 0', name='projects_invoice_count_valid'),
        CheckConstraint('percentage_paid >= 0 AND percentage_paid <= 100', name='projects_percentage_paid_valid'),
        Index('idx_projects_status', 'status'),
        Index('idx_projects_created', 'created_at'),
        Index('idx_projects_dates', 'start_date', 'end_date'),
        Index('idx_projects_owner', 'owner_id'),
    )
    
    def __repr__(self):
        return f"<Project(id='{self.id}', name='{self.name}')>"


class ProjectMember(Base):
    """Project members table - user-project memberships (many-to-many)."""
    __tablename__ = 'project_members'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String(50), ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(String(50), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    role = Column(ENUM(ProjectMemberRoleEnum, name='project_member_role_enum'), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    project = relationship('Project', back_populates='members')
    user = relationship('User', back_populates='project_memberships')
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('project_id', 'user_id', name='uq_project_members_project_user'),
        Index('idx_project_members_project', 'project_id'),
        Index('idx_project_members_user', 'user_id'),
        Index('idx_project_members_role', 'role'),
        Index('idx_project_members_project_role', 'project_id', 'role'),
    )
    
    def __repr__(self):
        return f"<ProjectMember(project_id='{self.project_id}', user_id='{self.user_id}', role='{self.role.value}')>"


class Quote(Base):
    """Quotes table - project quotes/devis."""
    __tablename__ = 'quotes'
    
    id = Column(String(50), primary_key=True)
    project_id = Column(String(50), ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    status = Column(ENUM(QuoteStatusEnum, name='quote_status_enum'), default=QuoteStatusEnum.DRAFT, nullable=False)
    version_number = Column(Integer, default=1, nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    project = relationship('Project', back_populates='quotes')
    
    # Constraints
    __table_args__ = (
        CheckConstraint('LENGTH(id) > 0 AND LENGTH(id) <= 50', name='quotes_id_length'),
        CheckConstraint('version_number > 0', name='quotes_version_positive'),
        Index('idx_quotes_project', 'project_id'),
        Index('idx_quotes_status', 'status'),
        Index('idx_quotes_project_status', 'project_id', 'status'),
        Index('idx_quotes_created', 'created_at'),
    )
    
    def __repr__(self):
        return f"<Quote(id='{self.id}', project_id='{self.project_id}', status='{self.status.value}', version={self.version_number})>"


class Worker(Base):
    """Workers table - worker-specific information (one-to-one with users)."""
    __tablename__ = 'workers'
    
    user_id = Column(String(50), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    certificates = Column(JSONB, nullable=True)  # Array of certificates/diplomas
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    user = relationship('User', back_populates='worker_profile')
    jobs = relationship('WorkerJob', back_populates='worker', cascade='all, delete-orphan')
    
    # Constraints
    __table_args__ = (
        Index('idx_workers_certificates', 'certificates', postgresql_using='gin'),
    )
    
    def __repr__(self):
        return f"<Worker(user_id='{self.user_id}')>"


class WorkerJob(Base):
    """Worker jobs table - jobs/tasks assigned to workers on projects."""
    __tablename__ = 'worker_jobs'
    
    id = Column(String(50), primary_key=True)
    worker_id = Column(String(50), ForeignKey('workers.user_id', ondelete='CASCADE'), nullable=False)
    project_id = Column(String(50), ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    job_type = Column(ENUM(WorkTypeEnum, name='work_type_enum'), nullable=True)
    location = Column(String(255), nullable=True)  # e.g., "kitchen", "bathroom"
    comment = Column(Text, nullable=True)
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    worker = relationship('Worker', back_populates='jobs')
    project = relationship('Project', back_populates='worker_jobs')
    
    # Constraints
    __table_args__ = (
        Index('idx_worker_jobs_worker', 'worker_id'),
        Index('idx_worker_jobs_project', 'project_id'),
        Index('idx_worker_jobs_dates', 'start_date', 'end_date'),
        Index('idx_worker_jobs_type', 'job_type'),
        Index('idx_worker_jobs_location', 'location'),
    )
    
    def __repr__(self):
        return f"<WorkerJob(id='{self.id}', worker_id='{self.worker_id}', project_id='{self.project_id}')>"


class Section(Base):
    """Sections table - groups items by category."""
    __tablename__ = 'sections'
    
    id = Column(String(50), primary_key=True)
    label = Column(String(255), nullable=False)
    project_id = Column(String(50), ForeignKey('projects.id', ondelete='CASCADE'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    project = relationship('Project', back_populates='sections')
    items = relationship('Item', back_populates='section', cascade='all, delete-orphan')
    
    # Constraints
    __table_args__ = (
        CheckConstraint('LENGTH(id) > 0 AND LENGTH(id) <= 50', name='sections_id_length'),
        CheckConstraint('LENGTH(label) > 0 AND LENGTH(label) <= 255', name='sections_label_length'),
        Index('idx_sections_project', 'project_id'),
    )
    
    def __repr__(self):
        return f"<Section(id='{self.id}', label='{self.label}')>"


class Item(Base):
    """Items table - individual products/materials."""
    __tablename__ = 'items'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    section_id = Column(String(50), ForeignKey('sections.id', ondelete='CASCADE'), nullable=False)
    product = Column(Text, nullable=False)
    reference = Column(String(255), nullable=True)
    supplier_link = Column(Text, nullable=True)
    labor_type = Column(ENUM(WorkTypeEnum, name='work_type_enum'), nullable=True)
    price_ttc = Column(Numeric(10, 2), nullable=True)
    price_ht_quote = Column(Numeric(10, 2), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    section = relationship('Section', back_populates='items')
    approvals = relationship('Approval', back_populates='item', cascade='all, delete-orphan')
    order = relationship('Order', back_populates='item', uselist=False, cascade='all, delete-orphan')
    comments = relationship('Comment', back_populates='item', cascade='all, delete-orphan')
    custom_fields = relationship('CustomField', back_populates='item', cascade='all, delete-orphan')
    edit_history = relationship('EditHistory', back_populates='item')
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('section_id', 'product', name='uq_items_section_product'),
        CheckConstraint('price_ttc IS NULL OR price_ttc >= 0', name='items_price_ttc_valid'),
        CheckConstraint('price_ht_quote IS NULL OR price_ht_quote >= 0', name='items_price_ht_valid'),
        CheckConstraint('LENGTH(TRIM(product)) > 0', name='items_product_not_empty'),
        Index('idx_items_section', 'section_id'),
        Index('idx_items_product', 'product'),
        Index('idx_items_updated', 'updated_at'),
        Index('idx_items_labor_type', 'labor_type'),
    )
    
    def __repr__(self):
        return f"<Item(id={self.id}, product='{self.product[:30]}...')>"


class Approval(Base):
    """Approvals table - tracks approval status by role (client/contractor)."""
    __tablename__ = 'approvals'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    item_id = Column(Integer, ForeignKey('items.id', ondelete='CASCADE'), nullable=False)
    role = Column(String(20), nullable=False)  # 'client' or 'contractor'
    status = Column(ENUM(ApprovalStatusEnum, name='approval_status_enum'), nullable=True)
    note = Column(Text, nullable=True)
    validated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    item = relationship('Item', back_populates='approvals')
    replacement_urls = relationship('ReplacementURL', back_populates='approval', cascade='all, delete-orphan')
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('item_id', 'role', name='uq_approvals_item_role'),
        CheckConstraint("role IN ('client', 'contractor')", name='approvals_role_valid'),
        Index('idx_approvals_item', 'item_id'),
        Index('idx_approvals_item_role', 'item_id', 'role'),
        Index('idx_approvals_status', 'status'),
    )
    
    def __repr__(self):
        return f"<Approval(id={self.id}, item_id={self.item_id}, role='{self.role}', status='{self.status.value if self.status else None}')>"


class ReplacementURL(Base):
    """Replacement URLs table - stores array of replacement URLs for approvals."""
    __tablename__ = 'replacement_urls'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    approval_id = Column(Integer, ForeignKey('approvals.id', ondelete='CASCADE'), nullable=False)
    url = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    approval = relationship('Approval', back_populates='replacement_urls')
    
    # Constraints
    __table_args__ = (
        Index('idx_replacement_urls_approval', 'approval_id'),
    )
    
    def __repr__(self):
        return f"<ReplacementURL(id={self.id}, approval_id={self.approval_id})>"


class Order(Base):
    """Orders table - tracks ordering and delivery information."""
    __tablename__ = 'orders'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    item_id = Column(Integer, ForeignKey('items.id', ondelete='CASCADE'), nullable=False, unique=True)
    ordered = Column(Boolean, default=False, nullable=False)
    order_date = Column(String(10), nullable=True)  # Format: 'dd/mm'
    delivery_date = Column(String(10), nullable=True)  # Format: 'dd/mm'
    delivery_status = Column(ENUM(DeliveryStatusEnum, name='delivery_status_enum'), nullable=True)
    quantity = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    item = relationship('Item', back_populates='order')
    
    # Constraints
    __table_args__ = (
        CheckConstraint('quantity IS NULL OR quantity > 0', name='orders_quantity_valid'),
        CheckConstraint(
            "(order_date IS NULL OR order_date ~ '^\\d{2}/\\d{2}$') AND (delivery_date IS NULL OR delivery_date ~ '^\\d{2}/\\d{2}$')",
            name='orders_date_format'
        ),
        CheckConstraint(
            '(ordered = FALSE AND order_date IS NULL) OR (ordered = TRUE AND order_date IS NOT NULL)',
            name='orders_ordered_with_date'
        ),
        Index('idx_orders_item', 'item_id'),
        Index('idx_orders_ordered', 'ordered'),
    )
    
    def __repr__(self):
        return f"<Order(id={self.id}, item_id={self.item_id}, ordered={self.ordered})>"


class Comment(Base):
    """Comments table - stores comments by role (client/contractor)."""
    __tablename__ = 'comments'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    item_id = Column(Integer, ForeignKey('items.id', ondelete='CASCADE'), nullable=False)
    role = Column(String(20), nullable=False)  # 'client' or 'contractor'
    comment_text = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    item = relationship('Item', back_populates='comments')
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('item_id', 'role', name='uq_comments_item_role'),
        CheckConstraint("role IN ('client', 'contractor')", name='comments_role_valid'),
        Index('idx_comments_item', 'item_id'),
    )
    
    def __repr__(self):
        return f"<Comment(id={self.id}, item_id={self.item_id}, role='{self.role}')>"


class EditHistory(Base):
    """Edit history table - tracks all changes to items."""
    __tablename__ = 'edit_history'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    item_id = Column(Integer, ForeignKey('items.id', ondelete='SET NULL'), nullable=True)
    user_id = Column(String(50), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    section_id = Column(String(50), nullable=True)
    section_label = Column(String(255), nullable=True)
    product = Column(Text, nullable=True)
    field_path = Column(String(255), nullable=False)
    old_value = Column(JSONB, nullable=True)
    new_value = Column(JSONB, nullable=True)
    source = Column(String(10), default='manual', nullable=False)  # 'manual' or 'agent'
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    item = relationship('Item', back_populates='edit_history')
    user = relationship('User', back_populates='edit_history')
    
    # Constraints
    __table_args__ = (
        CheckConstraint("source IN ('manual', 'agent')", name='edit_history_source_valid'),
        CheckConstraint('LENGTH(field_path) > 0 AND LENGTH(field_path) <= 255', name='edit_history_field_path_length'),
        Index('idx_edit_history_item', 'item_id'),
        Index('idx_edit_history_timestamp', 'timestamp'),
        Index('idx_edit_history_user', 'user_id'),
    )
    
    def __repr__(self):
        return f"<EditHistory(id={self.id}, item_id={self.item_id}, field_path='{self.field_path}')>"


class CustomField(Base):
    """Custom fields table - extensible fields for items."""
    __tablename__ = 'custom_fields'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    item_id = Column(Integer, ForeignKey('items.id', ondelete='CASCADE'), nullable=False)
    field_name = Column(String(100), nullable=False)
    field_value = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    item = relationship('Item', back_populates='custom_fields')
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('item_id', 'field_name', name='uq_custom_fields_item_field'),
        Index('idx_custom_fields_item', 'item_id'),
    )
    
    def __repr__(self):
        return f"<CustomField(id={self.id}, item_id={self.item_id}, field_name='{self.field_name}')>"
