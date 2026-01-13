"""
Materials service layer for database operations.

Converts between JSON format (used by frontend) and normalized database format.
Handles sections, items, approvals, orders, comments, and replacement URLs.
"""
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_

# Import models (works when running from backend/ directory or with sys.path setup)
try:
    from models import (
        Section, Item, Approval, ReplacementURL, Order, Comment,
        WorkTypeEnum, ApprovalStatusEnum, DeliveryStatusEnum
    )
except ImportError:
    from backend.models import (
        Section, Item, Approval, ReplacementURL, Order, Comment,
        WorkTypeEnum, ApprovalStatusEnum, DeliveryStatusEnum
    )


# Mapping functions (similar to migration script)
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
    }
    
    return mapping.get(labor_type)


def map_labor_type_from_enum(enum_value: Optional[WorkTypeEnum]) -> Optional[str]:
    """Map WorkTypeEnum back to French string."""
    if not enum_value:
        return None
    
    mapping = {
        WorkTypeEnum.DEMOLITION: "Démolition & Dépose",
        WorkTypeEnum.STRUCTURAL: "Gros œuvre & structure",
        WorkTypeEnum.FACADE: "Façade, Couverture & ITE",
        WorkTypeEnum.EXTERIOR_JOINERY: "Menuiseries extérieures",
        WorkTypeEnum.PLASTERING: "Plâtrerie & ITI",
        WorkTypeEnum.PLUMBING: "Plomberie & CVC",
        WorkTypeEnum.ELECTRICAL: "Électricité",
        WorkTypeEnum.WALL_COVERING: "Revêtement mur & plafond",
        WorkTypeEnum.INTERIOR_JOINERY: "Menuiseries intérieures",
        WorkTypeEnum.LANDSCAPING: "Espaces verts & Extérieurs",
        WorkTypeEnum.PRICE_REVISION: "Révision de prix",
    }
    
    return mapping.get(enum_value)


def map_approval_status_to_enum(status: Optional[str]) -> Optional[ApprovalStatusEnum]:
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


def map_approval_status_from_enum(enum_value: Optional[ApprovalStatusEnum]) -> Optional[str]:
    """Map ApprovalStatusEnum back to string."""
    if not enum_value:
        return None
    
    mapping = {
        ApprovalStatusEnum.APPROVED: "approved",
        ApprovalStatusEnum.CHANGE_ORDER: "alternative",  # Keep "alternative" for compatibility
        ApprovalStatusEnum.PENDING: "pending",
        ApprovalStatusEnum.REJECTED: "rejected",
        ApprovalStatusEnum.SUPPLIED_BY: "supplied_by",
    }
    
    return mapping.get(enum_value)


def map_delivery_status_to_enum(status: Optional[str]) -> Optional[DeliveryStatusEnum]:
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


def map_delivery_status_from_enum(enum_value: Optional[DeliveryStatusEnum]) -> Optional[str]:
    """Map DeliveryStatusEnum back to string."""
    if not enum_value:
        return None
    
    mapping = {
        DeliveryStatusEnum.PENDING: "pending",
        DeliveryStatusEnum.ORDERED: "ordered",
        DeliveryStatusEnum.SHIPPED: "shipped",
        DeliveryStatusEnum.DELIVERED: "delivered",
        DeliveryStatusEnum.CANCELLED: "cancelled",
    }
    
    return mapping.get(enum_value)


def item_to_json(item: Item, section: Section) -> Dict[str, Any]:
    """Convert database Item to JSON format."""
    item_dict = {
        "product": item.product,
        "reference": item.reference,
        "supplierLink": item.supplier_link,
        "price": {
            "ttc": float(item.price_ttc) if item.price_ttc is not None else None,
            "htQuote": float(item.price_ht_quote) if item.price_ht_quote is not None else None
        },
        "approvals": {
            "client": {},
            "cray": {}  # JSON uses "cray", DB uses "contractor"
        },
        "order": {},
        "comments": {
            "client": None,
            "cray": None
        }
    }
    
    # Add labor type if present
    if item.labor_type:
        item_dict["laborType"] = map_labor_type_from_enum(item.labor_type)
    
    # Get approvals
    for approval in item.approvals:
        role_key = "cray" if approval.role == "contractor" else approval.role
        approval_dict = {
            "status": map_approval_status_from_enum(approval.status),
            "note": approval.note,
            "validatedAt": approval.validated_at.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z') if approval.validated_at else None,
            "replacementUrls": []
        }
        
        # Get replacement URLs
        for url in approval.replacement_urls:
            approval_dict["replacementUrls"].append(url.url)
        
        item_dict["approvals"][role_key] = approval_dict
    
    # Get order
    if item.order:
        item_dict["order"] = {
            "ordered": item.order.ordered,
            "orderDate": item.order.order_date,
            "delivery": {
                "date": item.order.delivery_date,
                "status": map_delivery_status_from_enum(item.order.delivery_status)
            },
            "quantity": item.order.quantity
        }
    
    # Get comments
    for comment in item.comments:
        role_key = "cray" if comment.role == "contractor" else comment.role
        item_dict["comments"][role_key] = comment.comment_text
    
    # Get chantier from project (if section has project_id)
    if section.project_id and section.project:
        item_dict["chantier"] = section.project.address or section.project.name
    
    return item_dict


def json_to_item(item_data: Dict[str, Any], section: Section, session: Session) -> Item:
    """Convert JSON item data to database Item (create or update)."""
    # Check if item already exists (by section_id + product)
    existing_item = session.query(Item).filter(
        and_(Item.section_id == section.id, Item.product == item_data["product"])
    ).first()
    
    if existing_item:
        # Update existing item
        item = existing_item
        item.reference = item_data.get("reference")
        item.supplier_link = item_data.get("supplierLink")
        item.labor_type = map_labor_type_to_enum(item_data.get("laborType"))
        item.price_ttc = Decimal(str(item_data.get("price", {}).get("ttc"))) if item_data.get("price", {}).get("ttc") is not None else None
        item.price_ht_quote = Decimal(str(item_data.get("price", {}).get("htQuote"))) if item_data.get("price", {}).get("htQuote") is not None else None
        item.updated_at = datetime.utcnow()
    else:
        # Create new item
        item = Item(
            section_id=section.id,
            product=item_data["product"],
            reference=item_data.get("reference"),
            supplier_link=item_data.get("supplierLink"),
            labor_type=map_labor_type_to_enum(item_data.get("laborType")),
            price_ttc=Decimal(str(item_data.get("price", {}).get("ttc"))) if item_data.get("price", {}).get("ttc") is not None else None,
            price_ht_quote=Decimal(str(item_data.get("price", {}).get("htQuote"))) if item_data.get("price", {}).get("htQuote") is not None else None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        session.add(item)
        session.flush()  # Get item.id
    
    # Update approvals
    approvals_data = item_data.get("approvals", {})
    for role_key, role_name in [("client", "client"), ("cray", "contractor")]:
        approval_data = approvals_data.get(role_key, {})
        
        # Find or create approval
        approval = session.query(Approval).filter(
            and_(Approval.item_id == item.id, Approval.role == role_name)
        ).first()
        
        if approval_data and approval_data.get("status"):
            # Update or create approval
            if not approval:
                approval = Approval(
                    item_id=item.id,
                    role=role_name,
                    status=map_approval_status_to_enum(approval_data.get("status")),
                    note=approval_data.get("note"),
                    validated_at=datetime.fromisoformat(approval_data["validatedAt"].replace('Z', '+00:00')) if approval_data.get("validatedAt") else None,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                session.add(approval)
                session.flush()
            else:
                approval.status = map_approval_status_to_enum(approval_data.get("status"))
                approval.note = approval_data.get("note")
                approval.validated_at = datetime.fromisoformat(approval_data["validatedAt"].replace('Z', '+00:00')) if approval_data.get("validatedAt") else None
                approval.updated_at = datetime.utcnow()
            
            # Update replacement URLs (delete existing, add new)
            if approval.id:
                session.query(ReplacementURL).filter(ReplacementURL.approval_id == approval.id).delete()
                for url in approval_data.get("replacementUrls", []):
                    if url:  # Only add non-empty URLs
                        replacement_url = ReplacementURL(
                            approval_id=approval.id,
                            url=url,
                            created_at=datetime.utcnow()
                        )
                        session.add(replacement_url)
        elif approval:
            # Remove approval if status is null/empty
            session.delete(approval)
    
    # Update order
    order_data = item_data.get("order", {})
    existing_order = session.query(Order).filter(Order.item_id == item.id).first()
    
    if order_data:
        delivery_status = None
        if order_data.get("delivery"):
            delivery_status = map_delivery_status_to_enum(order_data["delivery"].get("status"))
        
        if existing_order:
            existing_order.ordered = order_data.get("ordered", False)
            existing_order.order_date = order_data.get("orderDate")
            existing_order.delivery_date = order_data.get("delivery", {}).get("date")
            existing_order.delivery_status = delivery_status
            existing_order.quantity = order_data.get("quantity")
            existing_order.updated_at = datetime.utcnow()
        else:
            order = Order(
                item_id=item.id,
                ordered=order_data.get("ordered", False),
                order_date=order_data.get("orderDate"),
                delivery_date=order_data.get("delivery", {}).get("date"),
                delivery_status=delivery_status,
                quantity=order_data.get("quantity"),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            session.add(order)
    elif existing_order:
        # Remove order if not present in JSON
        session.delete(existing_order)
    
    # Update comments
    comments_data = item_data.get("comments", {})
    for role_key, role_name in [("client", "client"), ("cray", "contractor")]:
        comment_text = comments_data.get(role_key)
        existing_comment = session.query(Comment).filter(
            and_(Comment.item_id == item.id, Comment.role == role_name)
        ).first()
        
        if comment_text:
            if existing_comment:
                existing_comment.comment_text = comment_text
                existing_comment.updated_at = datetime.utcnow()
            else:
                comment = Comment(
                    item_id=item.id,
                    role=role_name,
                    comment_text=comment_text,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                session.add(comment)
        elif existing_comment:
            # Remove comment if None/empty
            session.delete(existing_comment)
    
    return item


def get_materials_dict(session: Session) -> Dict[str, Any]:
    """
    Get all materials from database and convert to JSON format.
    
    Returns:
        dict: Materials data in JSON format (same as materials.json structure)
    """
    sections = session.query(Section).options(
        joinedload(Section.items).joinedload(Item.approvals).joinedload(Approval.replacement_urls),
        joinedload(Section.items).joinedload(Item.order),
        joinedload(Section.items).joinedload(Item.comments),
        joinedload(Section.project)
    ).order_by(Section.id).all()
    
    sections_data = []
    for section in sections:
        section_dict = {
            "id": section.id,
            "label": section.label,
            "items": []
        }
        
        items = sorted(section.items, key=lambda x: x.id)  # Sort by ID for consistency
        for item in items:
            item_dict = item_to_json(item, section)
            section_dict["items"].append(item_dict)
        
        sections_data.append(section_dict)
    
    return {
        "currency": "EUR",
        "sections": sections_data
    }


def save_materials_dict(materials_data: Dict[str, Any], session: Session) -> None:
    """
    Save materials data (JSON format) to database.
    
    This performs an upsert operation:
    - Sections: Update if exists, create if new
    - Items: Update if exists (by section_id + product), create if new
    - Approvals, orders, comments: Update/replace based on item
    
    Args:
        materials_data: Materials data in JSON format (same as materials.json structure)
        session: Database session
    """
    sections_data = materials_data.get("sections", [])
    
    for section_data in sections_data:
        section_id = section_data["id"]
        section_label = section_data["label"]
        
        # Find or create section
        section = session.query(Section).filter(Section.id == section_id).first()
        if section:
            section.label = section_label
            section.updated_at = datetime.utcnow()
        else:
            section = Section(
                id=section_id,
                label=section_label,
                project_id=None,  # Will be set based on chantier if projects exist
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            session.add(section)
            session.flush()
        
        # Process items
        for item_data in section_data.get("items", []):
            # Skip items with empty product (constraint violation)
            if not item_data.get("product", "").strip():
                continue
            
            json_to_item(item_data, section, session)


def update_item_field(
    session: Session,
    section_id: str,
    item_index: int,
    field_path: str,
    new_value: Any,
    expected_product_hint: Optional[str] = None
) -> Item:
    """
    Update a single field in an item by section_id and item_index.
    
    This is used by update_cell() to update individual fields without
    replacing the entire materials structure.
    
    Args:
        session: Database session
        section_id: Section identifier
        item_index: Zero-based item index (by item.id order)
        field_path: Dot-delimited path to field (e.g., "approvals.client.status")
        new_value: New value to set
        expected_product_hint: Optional product name for validation
    
    Returns:
        Updated Item object
    
    Raises:
        ValueError: If section/item not found or validation fails
    """
    # Find section
    section = session.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise ValueError(f"Section '{section_id}' not found")
    
    # Get items sorted by ID
    items = sorted(session.query(Item).filter(Item.section_id == section_id).all(), key=lambda x: x.id)
    if item_index < 0 or item_index >= len(items):
        raise ValueError(f"Item index {item_index} is out of bounds for section '{section_id}'")
    
    item = items[item_index]
    
    # Validate product hint if provided
    if expected_product_hint:
        product = item.product.lower()
        hint_lower = expected_product_hint.lower()
        hint_matches = (hint_lower in product) or (product in hint_lower)
        if not hint_matches:
            raise ValueError(
                f"Product mismatch: Expected item matching '{expected_product_hint}', "
                f"but found '{item.product}' at index {item_index} in section '{section_id}'"
            )
    
    # Update field based on path
    parts = field_path.split('.')
    
    if parts[0] == "approvals":
        # approvals.client.status, approvals.cray.note, etc.
        role_key = parts[1]  # "client" or "cray"
        role_name = "contractor" if role_key == "cray" else role_key
        field = parts[2] if len(parts) > 2 else None
        
        # Find or create approval
        approval = session.query(Approval).filter(
            and_(Approval.item_id == item.id, Approval.role == role_name)
        ).first()
        
        if field == "status":
            if new_value:
                status_enum = map_approval_status_to_enum(new_value)
                if approval:
                    approval.status = status_enum
                    approval.updated_at = datetime.utcnow()
                else:
                    approval = Approval(
                        item_id=item.id,
                        role=role_name,
                        status=status_enum,
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    )
                    session.add(approval)
            elif approval:
                # Remove approval if status set to None/empty
                session.delete(approval)
        elif field == "note":
            if approval:
                approval.note = new_value
                approval.updated_at = datetime.utcnow()
        elif field == "validatedAt":
            if approval:
                approval.validated_at = datetime.fromisoformat(new_value.replace('Z', '+00:00')) if new_value else None
                approval.updated_at = datetime.utcnow()
        elif field == "replacementUrls":
            if approval:
                # Delete existing URLs
                session.query(ReplacementURL).filter(ReplacementURL.approval_id == approval.id).delete()
                # Add new URLs
                if isinstance(new_value, list):
                    for url in new_value:
                        if url:
                            replacement_url = ReplacementURL(
                                approval_id=approval.id,
                                url=url,
                                created_at=datetime.utcnow()
                            )
                            session.add(replacement_url)
        else:
            raise ValueError(f"Unknown approval field: {field}")
    
    elif parts[0] == "order":
        # order.ordered, order.orderDate, order.delivery.date, order.delivery.status, order.quantity
        field = parts[1] if len(parts) > 1 else None
        
        order = session.query(Order).filter(Order.item_id == item.id).first()
        if not order:
            # Create order if it doesn't exist
            order = Order(
                item_id=item.id,
                ordered=False,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            session.add(order)
            session.flush()
        
        if field == "ordered":
            order.ordered = bool(new_value)
            order.updated_at = datetime.utcnow()
        elif field == "orderDate":
            order.order_date = new_value
            order.updated_at = datetime.utcnow()
        elif field == "delivery":
            if isinstance(new_value, dict):
                order.delivery_date = new_value.get("date")
                order.delivery_status = map_delivery_status_to_enum(new_value.get("status"))
                order.updated_at = datetime.utcnow()
        elif field == "quantity":
            order.quantity = new_value
            order.updated_at = datetime.utcnow()
        else:
            raise ValueError(f"Unknown order field: {field}")
    
    elif parts[0] == "comments":
        # comments.client, comments.cray
        role_key = parts[1] if len(parts) > 1 else None
        role_name = "contractor" if role_key == "cray" else role_key
        
        comment = session.query(Comment).filter(
            and_(Comment.item_id == item.id, Comment.role == role_name)
        ).first()
        
        if new_value:
            if comment:
                comment.comment_text = new_value
                comment.updated_at = datetime.utcnow()
            else:
                comment = Comment(
                    item_id=item.id,
                    role=role_name,
                    comment_text=new_value,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                session.add(comment)
        elif comment:
            # Remove comment if set to None/empty
            session.delete(comment)
    
    else:
        # Direct item fields: product, reference, supplierLink, laborType, price.ttc, price.htQuote
        if field_path == "product":
            item.product = new_value
            item.updated_at = datetime.utcnow()
        elif field_path == "reference":
            item.reference = new_value
            item.updated_at = datetime.utcnow()
        elif field_path == "supplierLink":
            item.supplier_link = new_value
            item.updated_at = datetime.utcnow()
        elif field_path == "laborType":
            item.labor_type = map_labor_type_to_enum(new_value)
            item.updated_at = datetime.utcnow()
        elif field_path == "price.ttc":
            item.price_ttc = Decimal(str(new_value)) if new_value is not None else None
            item.updated_at = datetime.utcnow()
        elif field_path == "price.htQuote":
            item.price_ht_quote = Decimal(str(new_value)) if new_value is not None else None
            item.updated_at = datetime.utcnow()
        else:
            raise ValueError(f"Unknown field path: {field_path}")
    
    item.updated_at = datetime.utcnow()
    return item

