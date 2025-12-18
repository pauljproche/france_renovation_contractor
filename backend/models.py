"""
SQLAlchemy models for the France Renovation Contractor database.

This module defines all database models with relationships, constraints, and indexes.
All models use TIMESTAMP WITH TIME ZONE for proper timezone handling.
"""
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Numeric, 
    DateTime, ForeignKey, CheckConstraint, UniqueConstraint,
    Index
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


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
    labor_type = Column(String(50), nullable=True)
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
    )
    
    def __repr__(self):
        return f"<Item(id={self.id}, product='{self.product[:30]}...')>"


class Approval(Base):
    """Approvals table - tracks approval status by role (client/cray)."""
    __tablename__ = 'approvals'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    item_id = Column(Integer, ForeignKey('items.id', ondelete='CASCADE'), nullable=False)
    role = Column(String(50), nullable=False)  # 'client' or 'cray'
    status = Column(String(50), nullable=True)  # 'approved', 'rejected', 'change_order', 'pending', 'supplied_by'
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
        CheckConstraint("role IN ('client', 'cray')", name='approvals_role_valid'),
        CheckConstraint(
            "status IS NULL OR status IN ('approved', 'rejected', 'change_order', 'pending', 'supplied_by')",
            name='approvals_status_valid'
        ),
        Index('idx_approvals_item', 'item_id'),
        Index('idx_approvals_item_role', 'item_id', 'role'),
        Index('idx_approvals_status', 'status'),
    )
    
    def __repr__(self):
        return f"<Approval(id={self.id}, item_id={self.item_id}, role='{self.role}', status='{self.status}')>"


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
    delivery_status = Column(String(50), nullable=True)
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
        Index('idx_orders_item', 'item_id'),
        Index('idx_orders_ordered', 'ordered'),
    )
    
    def __repr__(self):
        return f"<Order(id={self.id}, item_id={self.item_id}, ordered={self.ordered})>"


class Comment(Base):
    """Comments table - stores comments by role (client/cray)."""
    __tablename__ = 'comments'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    item_id = Column(Integer, ForeignKey('items.id', ondelete='CASCADE'), nullable=False)
    role = Column(String(50), nullable=False)  # 'client' or 'cray'
    comment_text = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    item = relationship('Item', back_populates='comments')
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('item_id', 'role', name='uq_comments_item_role'),
        Index('idx_comments_item', 'item_id'),
    )
    
    def __repr__(self):
        return f"<Comment(id={self.id}, item_id={self.item_id}, role='{self.role}')>"


class EditHistory(Base):
    """Edit history table - tracks all changes to items."""
    __tablename__ = 'edit_history'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    item_id = Column(Integer, ForeignKey('items.id', ondelete='SET NULL'), nullable=True)
    section_id = Column(String(50), nullable=True)
    section_label = Column(String(255), nullable=True)
    product = Column(Text, nullable=True)
    field_path = Column(String(255), nullable=False)
    old_value = Column(JSONB, nullable=True)
    new_value = Column(JSONB, nullable=True)
    source = Column(String(50), default='manual', nullable=False)  # 'manual' or 'agent'
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    item = relationship('Item', back_populates='edit_history')
    
    # Constraints
    __table_args__ = (
        CheckConstraint("source IN ('manual', 'agent')", name='edit_history_source_valid'),
        CheckConstraint('LENGTH(field_path) > 0 AND LENGTH(field_path) <= 255', name='edit_history_field_path_length'),
        Index('idx_edit_history_item', 'item_id'),
        Index('idx_edit_history_timestamp', 'timestamp'),
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


class Project(Base):
    """Projects table - renovation projects/chantiers."""
    __tablename__ = 'projects'
    
    id = Column(String(50), primary_key=True)
    name = Column(String(255), nullable=False)
    address = Column(String(255), nullable=True)
    client_name = Column(String(255), nullable=True)
    status = Column(String(50), default='draft', nullable=False)  # 'draft', 'ready', 'active', 'completed', 'archived'
    devis_status = Column(String(50), nullable=True)  # 'sent', 'approved', 'rejected'
    invoice_count = Column(Integer, default=0, nullable=False)
    percentage_paid = Column(Integer, default=0, nullable=False)
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    is_demo = Column(Boolean, default=False, nullable=False)
    has_data = Column(Boolean, default=False, nullable=False)
    
    # Relationships
    sections = relationship('Section', back_populates='project', cascade='all, delete-orphan')
    
    # Constraints
    __table_args__ = (
        CheckConstraint('LENGTH(id) > 0 AND LENGTH(id) <= 50', name='projects_id_length'),
        CheckConstraint('LENGTH(name) > 0 AND LENGTH(name) <= 255', name='projects_name_length'),
        CheckConstraint("status IN ('draft', 'ready', 'active', 'completed', 'archived')", name='projects_status_valid'),
        CheckConstraint(
            "devis_status IS NULL OR devis_status IN ('sent', 'approved', 'rejected')",
            name='projects_devis_status_valid'
        ),
        CheckConstraint(
            'start_date IS NULL OR end_date IS NULL OR start_date <= end_date',
            name='projects_date_range_valid'
        ),
        CheckConstraint('invoice_count >= 0', name='projects_invoice_count_valid'),
        CheckConstraint('percentage_paid >= 0 AND percentage_paid <= 100', name='projects_percentage_paid_valid'),
        Index('idx_projects_status', 'status'),
        Index('idx_projects_created', 'created_at'),
        Index('idx_projects_dates', 'start_date', 'end_date'),
    )
    
    def __repr__(self):
        return f"<Project(id='{self.id}', name='{self.name}')>"


class Worker(Base):
    """Workers table - salaried workers."""
    __tablename__ = 'workers'
    
    id = Column(String(50), primary_key=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    jobs = relationship('WorkerJob', back_populates='worker', cascade='all, delete-orphan')
    
    # Constraints
    __table_args__ = (
        Index('idx_workers_name', 'name'),
    )
    
    def __repr__(self):
        return f"<Worker(id='{self.id}', name='{self.name}')>"


class WorkerJob(Base):
    """Worker jobs table - jobs/tasks assigned to workers."""
    __tablename__ = 'worker_jobs'
    
    id = Column(String(50), primary_key=True)
    worker_id = Column(String(50), ForeignKey('workers.id', ondelete='CASCADE'), nullable=False)
    chantier_name = Column(String(255), nullable=False)  # References project address/name
    job_type = Column(String(50), nullable=True)  # 'plumbing', 'electrical', 'demo', etc.
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    worker = relationship('Worker', back_populates='jobs')
    
    # Constraints
    __table_args__ = (
        Index('idx_worker_jobs_worker', 'worker_id'),
        Index('idx_worker_jobs_chantier', 'chantier_name'),
        Index('idx_worker_jobs_dates', 'start_date', 'end_date'),
    )
    
    def __repr__(self):
        return f"<WorkerJob(id='{self.id}', worker_id='{self.worker_id}', chantier_name='{self.chantier_name}')>"
