from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
import os
import json
import re
import httpx
import logging
from typing import Optional, Any, Tuple, List
from datetime import datetime
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()

# Database imports (only when USE_DATABASE is enabled)
USE_DATABASE = os.getenv("USE_DATABASE", "false").lower() == "true"

if USE_DATABASE:
    try:
        from db_session import db_session, db_readonly_session
        import services.materials_service as materials_service
        import services.projects_service as projects_service
        import services.workers_service as workers_service
    except ImportError:
        from backend.db_session import db_session, db_readonly_session
        import backend.services.materials_service as materials_service
        import backend.services.projects_service as projects_service
        import backend.services.workers_service as workers_service
else:
    # Dummy functions for when database is disabled
    db_session = None
    db_readonly_session = None
    materials_service = None
    projects_service = None
    workers_service = None

# Path to materials.json
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MATERIALS_FILE_PATH = os.path.join(BASE_DIR, '..', 'data', 'materials.json')
EDIT_HISTORY_FILE_PATH = os.path.join(BASE_DIR, '..', 'data', 'edit-history.json')
SUSPICIOUS_ACTIVITY_LOG = os.path.join(BASE_DIR, '..', 'logs', 'suspicious_activity.md')
SYSTEM_PROMPT_PATH = os.path.join(BASE_DIR, 'prompts', 'system_prompt.md')

app = FastAPI(title="Renovation Contractor API")

# CORS configuration for React frontend
# Allow origins from environment variable or default to localhost for development
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:5175")
# Split comma-separated origins and filter out empty strings
allowed_origins = [origin.strip() for origin in cors_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI client
api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key) if api_key else None
default_model = os.getenv("OPENAI_MODEL", "gpt-4o")


def load_materials_data() -> dict:
    """
    Load materials data from database or JSON file based on USE_DATABASE flag.
    
    Returns:
        dict: Materials data in JSON format
    """
    use_database = os.getenv("USE_DATABASE", "false").lower() == "true"
    
    if use_database:
        try:
            with db_readonly_session() as session:
                return materials_service.get_materials_dict(session)
        except Exception as e:
            logger.error(f"Failed to load materials from database: {e}")
            logger.warning("Falling back to JSON file")
            # Fallback to JSON on error
            with open(MATERIALS_FILE_PATH, encoding='utf-8') as f:
                return json.load(f)
    else:
        # Read from JSON file
        with open(MATERIALS_FILE_PATH, encoding='utf-8') as f:
            return json.load(f)


def write_materials_data(data: dict) -> None:
    """
    Write materials data to database and/or JSON file (dual-write).
    
    Strategy: Write to DB first (source of truth), then JSON (backup).
    If DB write fails, transaction rolls back and operation fails.
    If JSON write fails but DB succeeded, log warning and continue.
    
    Args:
        data: Materials data dictionary in JSON format
    """
    use_database = os.getenv("USE_DATABASE", "false").lower() == "true"
    
    db_success = False
    
    # Write to DB first (source of truth)
    if use_database:
        try:
            with db_session() as session:
                materials_service.save_materials_dict(data, session)
                session.commit()
                db_success = True
                logger.debug("Materials written to database successfully")
        except Exception as e:
            logger.error(f"DB write failed: {e}")
            raise  # Fail fast - don't write to JSON if DB fails
    
    # Write to JSON (backup during migration)
    try:
        with open(MATERIALS_FILE_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        logger.debug("Materials written to JSON file successfully")
    except Exception as e:
        logger.error(f"JSON write failed: {e}")
        if db_success:
            # DB succeeded but JSON failed - log warning, continue
            logger.warning("JSON backup write failed, but DB write succeeded")
        else:
            raise  # Both failed


def load_system_prompt() -> str:
    """
    Load the system prompt from the markdown file.
    
    Returns:
        str: The system prompt text
    """
    try:
        with open(SYSTEM_PROMPT_PATH, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except FileNotFoundError:
        logger.warning(f"System prompt file not found at {SYSTEM_PROMPT_PATH}, using fallback")
        # Fallback to a minimal prompt if file is missing
        return "You are an assistant for a renovation construction site. Use strictly the provided data."


def load_edit_history() -> List[dict]:
    """Load edit history from file."""
    if not os.path.exists(EDIT_HISTORY_FILE_PATH):
        return []
    try:
        with open(EDIT_HISTORY_FILE_PATH, encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return []


def save_edit_history(history: List[dict]) -> None:
    """Save edit history to file."""
    with open(EDIT_HISTORY_FILE_PATH, 'w', encoding='utf-8') as f:
        json.dump(history, f, indent=2, ensure_ascii=False)


def log_suspicious_activity(prompt: str, error_type: str, error_detail: str, 
                           attempted_action: Optional[dict] = None) -> None:
    """
    Log suspicious activity (validation failures, wrong item attempts, etc.) to a markdown file.
    
    Args:
        prompt: The user's original prompt
        error_type: Type of suspicious activity (e.g., 'product_mismatch', 'no_change_update', 'array_operation_error')
        error_detail: Detailed error message
        attempted_action: Optional dict with attempted action details (section_id, item_index, field_path, etc.)
    """
    # Ensure logs directory exists
    log_dir = os.path.dirname(SUSPICIOUS_ACTIVITY_LOG)
    os.makedirs(log_dir, exist_ok=True)
    
    # Check if file exists, if not create with header
    file_exists = os.path.exists(SUSPICIOUS_ACTIVITY_LOG)
    
    timestamp = datetime.utcnow().isoformat() + "Z"
    
    with open(SUSPICIOUS_ACTIVITY_LOG, 'a', encoding='utf-8') as f:
        if not file_exists:
            f.write("# Suspicious Activity Log\n\n")
            f.write("This file logs suspicious activities detected by validation, such as:\n")
            f.write("- Attempts to update wrong items\n")
            f.write("- No-change updates\n")
            f.write("- Array operation errors\n")
            f.write("- Product mismatches\n\n")
            f.write("---\n\n")
        
        f.write(f"## {timestamp}\n\n")
        f.write(f"**Error Type:** `{error_type}`\n\n")
        f.write(f"**User Prompt:**\n```\n{prompt}\n```\n\n")
        f.write(f"**Error Detail:**\n```\n{error_detail}\n```\n\n")
        
        if attempted_action:
            f.write(f"**Attempted Action:**\n```json\n{json.dumps(attempted_action, indent=2)}\n```\n\n")
        
        f.write("---\n\n")


def log_edit(section_id: str, section_label: str, item_index: int, product: str, 
             field_path: str, old_value: Any, new_value: Any, source: str = "manual") -> None:
    """Log an edit to the history."""
    history = load_edit_history()
    edit_entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "section_id": section_id,
        "section_label": section_label,
        "item_index": item_index,
        "product": product or "(empty product)",
        "field_path": field_path,
        "old_value": old_value,
        "new_value": new_value,
        "source": source  # "manual" or "agent"
    }
    history.append(edit_entry)
    # Keep only last 1000 entries
    if len(history) > 1000:
        history = history[-1000:]
    save_edit_history(history)


def set_nested_value(target: dict, field_path: str, value: Any) -> None:
    parts = field_path.split('.')
    current = target
    for part in parts[:-1]:
        if part not in current or not isinstance(current[part], dict):
            current[part] = {}
        current = current[part]
    current[parts[-1]] = value


def normalize_identifier(value: Optional[str]) -> str:
    if value is None:
        return ""
    return str(value).strip().lower()


def match_section(sections: list[dict], identifier: str) -> Optional[dict]:
    """Return a section by matching either its id or label (case-insensitive)."""
    target = normalize_identifier(identifier)
    if not target:
        return None
    for section in sections:
        section_id = normalize_identifier(section.get("id"))
        section_label = normalize_identifier(section.get("label"))
        if target in (section_id, section_label):
            return section
    return None


def get_nested_value(target: dict, field_path: str) -> Any:
    """Get a nested value from a dict using dot notation."""
    parts = field_path.split('.')
    current = target
    for part in parts:
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def find_matching_items(materials_data: dict, product_identifier: str) -> List[dict]:
    """
    Find all items that match a product identifier.
    
    Args:
        materials_data: The materials data dictionary
        product_identifier: Product identifier to match (can be partial or exact match)
    
    Returns:
        List of dicts with keys: section_id, section_label, item_index, product, item
    """
    matches = []
    identifier_lower = product_identifier.lower()
    
    for section in materials_data.get('sections', []):
        section_id = section.get('id', '')
        section_label = section.get('label', '')
        
        for idx, item in enumerate(section.get('items', [])):
            product = item.get('product', '').lower()
            
            # Check if identifier matches product
            # Exact match or identifier is contained in product name
            if identifier_lower == product or identifier_lower in product:
                matches.append({
                    'section_id': section_id,
                    'section_label': section_label,
                    'item_index': idx,
                    'product': item.get('product', ''),
                    'item': item
                })
    
    return matches


def update_cell(section_id: str, item_index: int, field_path: str, new_value: Any, source: str = "agent", 
                expected_product_hint: Optional[str] = None) -> Tuple[dict, dict]:
    """
    Update a single field in the materials table with validation.
    
    Supports both database and JSON modes based on USE_DATABASE flag.
    
    Args:
        section_id: Section identifier
        item_index: Zero-based item index
        field_path: Dot-delimited path to field
        new_value: New value to set
        source: Source of the update ('agent' or 'manual')
        expected_product_hint: Optional product name hint for validation (can be partial or exact match)
    
    Returns:
        Tuple of (updated data, updated item)
    
    Raises:
        ValueError: If validation fails or item doesn't match expected product
    """
    use_database = os.getenv("USE_DATABASE", "false").lower() == "true"
    
    if use_database:
        # Update in database
        try:
            with db_session() as session:
                # Get old value for logging
                data = materials_service.get_materials_dict(session)
                sections = data.get('sections', [])
                section = match_section(sections, section_id)
                if not section:
                    raise ValueError(f"Section '{section_id}' not found")
                items = section.get('items', [])
                if item_index < 0 or item_index >= len(items):
                    raise ValueError(f"Item index {item_index} is out of bounds for section '{section_id}'")
                item = items[item_index]
                old_value = get_nested_value(item, field_path)
                
                # Validate no-change
                if old_value == new_value:
                    product = item.get('product', '')
                    raise ValueError(
                        f"Update would result in no change. Old value and new value are identical for "
                        f"product '{product}' at field '{field_path}'"
                    )
                
                # Validate product hint if provided
                if expected_product_hint:
                    product = item.get('product', '').lower()
                    hint_lower = expected_product_hint.lower()
                    hint_matches = (hint_lower in product) or (product in hint_lower)
                    if not hint_matches:
                        raise ValueError(
                            f"Product mismatch: Expected item matching '{expected_product_hint}', "
                            f"but found '{item.get('product', '')}' at index {item_index} in section '{section_id}'"
                        )
                
                # Update in database
                updated_item = materials_service.update_item_field(
                    session, section_id, item_index, field_path, new_value, expected_product_hint
                )
                session.commit()
                
                # Log edit
                try:
                    from models import Section
                except ImportError:
                    from backend.models import Section
                
                section_obj = session.query(Section).filter(Section.id == section_id).first()
                log_edit(
                    section_id=section_id,
                    section_label=section_obj.label if section_obj else section_id,
                    item_index=item_index,
                    product=updated_item.product,
                    field_path=field_path,
                    old_value=old_value,
                    new_value=new_value,
                    source=source
                )
                
                # Reload data to return updated JSON format
                data = materials_service.get_materials_dict(session)
                
                # Write to JSON for backup (skip DB write since we already updated)
                try:
                    with open(MATERIALS_FILE_PATH, 'w', encoding='utf-8') as f:
                        json.dump(data, f, indent=2, ensure_ascii=False)
                except Exception as e:
                    logger.warning(f"JSON backup write failed: {e}")
                
                # Find updated item in JSON format for return
                sections = data.get('sections', [])
                section = match_section(sections, section_id)
                items = section.get('items', []) if section else []
                item = items[item_index] if item_index < len(items) else {}
                
                return data, item
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Database update failed: {e}")
            raise ValueError(f"Failed to update item in database: {str(e)}")
    else:
        # Original JSON-based update logic
        data = load_materials_data()
        sections = data.get('sections', [])
        section = match_section(sections, section_id)
        if not section:
            raise ValueError(f"Section '{section_id}' not found (match allowed on id or label).")
        items = section.get('items', [])
        if item_index < 0 or item_index >= len(items):
            raise ValueError(f"Item index {item_index} is out of bounds for section '{section_id}'.")
        item = items[item_index]
        
        # Get old value before updating
        old_value = get_nested_value(item, field_path)
    
    # VALIDATION: Check if new value is actually different (especially for arrays)
    if old_value == new_value:
        product = item.get('product', '')
        error_msg = (
            f"Update would result in no change. Old value and new value are identical for "
            f"product '{product}' at field '{field_path}'. Old: {old_value}, New: {new_value}"
        )
        # Log suspicious activity (but don't include user prompt here - it's added at call site)
        raise ValueError(error_msg)
    
    # VALIDATION: For array fields, verify the operation makes sense
    if isinstance(old_value, list) and isinstance(new_value, list):
        # Check if this looks like a valid array modification
        if len(new_value) > len(old_value) + 1:
            product = item.get('product', '')
            raise ValueError(
                f"Suspicious array update: new array has {len(new_value)} items, old had {len(old_value)}. "
                f"This might indicate an error. Product: '{product}', field: '{field_path}'"
            )
        # If removing, new should have fewer items
        # If adding, new should have same or one more item
        if len(new_value) == len(old_value) and old_value != new_value:
            # Same length but different - might be a replacement, which is OK
            pass
        elif len(new_value) > len(old_value) + 1:
            # Adding more than one item unexpectedly
            product = item.get('product', '')
            raise ValueError(
                f"Array update adds too many items unexpectedly. Product: '{product}', field: '{field_path}'"
            )
    
    # VALIDATION: If expected_product_hint is provided, verify the item matches
    if expected_product_hint:
        product = item.get('product', '').lower()
        hint_lower = expected_product_hint.lower()
        # Check if hint matches product (exact match or contains)
        # Partial match: hint contained in product name (e.g., 'faucet' matches 'Kitchen Faucet Model X')
        # Exact match: hint exactly matches product name (e.g., 'item123' matches 'item123')
        hint_matches = (hint_lower in product) or (product in hint_lower)
        
        if not hint_matches:
            error_msg = (
                f"Product mismatch: User requested update for item matching '{expected_product_hint}', "
                f"but update_cell was called on '{item.get('product', '')}' at index {item_index} in section '{section_id}'. "
                f"This is likely the WRONG ITEM. Please find the correct item that matches '{expected_product_hint}'."
            )
            raise ValueError(error_msg)
    
    # Update the value
    set_nested_value(item, field_path, new_value)
    write_materials_data(data)
    
    # Log the edit
    product = item.get('product', '')
    section_label = section.get('label', section_id)
    log_edit(section_id, section_label, item_index, product, field_path, old_value, new_value, source)
    
    return data, item


class MaterialsQuery(BaseModel):
    prompt: str
    materials: Optional[dict] = None
    customTables: Optional[list] = None
    language: Optional[str] = 'en'  # Language preference: 'en' or 'fr'


class MaterialsUpdate(BaseModel):
    materials: dict[str, Any]


class TranslationRequest(BaseModel):
    text: str
    target_language: str


class ImageExtractionRequest(BaseModel):
    url: str
    reference: Optional[str] = None


class EditLogRequest(BaseModel):
    section_id: str
    section_label: str
    item_index: int
    product: str
    field_path: str
    old_value: Any
    new_value: Any
    source: str = "manual"


@app.get("/")
async def root():
    return {"message": "Renovation Contractor API", "status": "running"}


@app.post("/api/assistant/query")
async def query_assistant(query: MaterialsQuery):
    """
    Query the LLM assistant with a prompt and materials data.
    """
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="Assistant endpoint is unavailable because OPENAI_API_KEY is not configured."
        )
    try:
        # Serialize materials data for the prompt
        materials_text = "No materials data provided."
        if query.materials and query.materials.get("sections"):
            sections_summary = []
            for section in query.materials["sections"]:
                section_data = {
                    "section": section.get("label", ""),
                    "sectionId": section.get("id", ""),
                    "items": []
                }
                for idx, item in enumerate(section.get("items", [])):
                    # Format item with product name prominently for easier identification
                    item_data = {
                        "index": idx,
                        "product": item.get("product", ""),  # PRIMARY IDENTIFIER
                        "reference": item.get("reference"),
                        "laborType": item.get("laborType"),  # Task/Labor type
                        "supplierLink": item.get("supplierLink"),  # Supplier URL
                        "priceTTC": item.get("price", {}).get("ttc"),
                        "approvals": item.get("approvals", {}),
                        "order": item.get("order", {}),
                        "comments": item.get("comments", {})  # Comments from client/cray
                    }
                    section_data["items"].append(item_data)
                sections_summary.append(section_data)
            materials_text = json.dumps(sections_summary, indent=2, ensure_ascii=False)

        # Add custom table information if available
        custom_tables_info = ""
        if query.customTables and len(query.customTables) > 0:
            custom_tables_text = []
            for idx, table in enumerate(query.customTables, 1):
                columns = table.get("columns", [])
                column_labels = table.get("columnLabels", {})
                sort_column = table.get("sortColumn", "")
                sort_direction = table.get("sortDirection", "")
                
                column_names = [column_labels.get(col, col) for col in columns]
                custom_tables_text.append(
                    f"Custom Table {idx}:\n"
                    f"  - Columns: {', '.join(column_names)}\n"
                    f"  - Sorted by: {column_labels.get(sort_column, sort_column)} ({sort_direction})"
                )
            custom_tables_info = "\n\nCustom Tables Created:\n" + "\n".join(custom_tables_text) + "\n"

        # Load system prompt from external file
        system_prompt = load_system_prompt()

        # Get language preference (default to 'en')
        user_language = query.language or 'en'
        language_instruction = f"\n\n🌐 LANGUAGE INSTRUCTION: The user's interface is set to {user_language.upper()}. Provide your response in BOTH English and French using this EXACT format:\n\nEN: [your English response here]\n\nFR: [your French response here]\n\nAlways include both languages in this format, even if the user's interface is in one language. This ensures the response can be displayed correctly in both languages.\n\n"

        # Add explicit instruction for validation questions
        validation_instruction = ""
        prompt_lower = query.prompt.lower()
        if any(keyword in prompt_lower for keyword in ["what items need", "what needs to be validated", "items requiring", "needs validation"]):
            # Detect which role is mentioned in the query - prioritize explicit "by [role]" patterns
            role_to_check = None
            field_path = None
            
            # Check for explicit "by cray" or "by client" patterns first
            if "by cray" in prompt_lower:
                role_to_check = "cray"
                field_path = "approvals.cray.status"
            elif "by client" in prompt_lower:
                role_to_check = "client"
                field_path = "approvals.client.status"
            # Fallback: check if "cray" or "client" appears in the query
            elif "cray" in prompt_lower and "client" not in prompt_lower:
                role_to_check = "cray"
                field_path = "approvals.cray.status"
            elif "client" in prompt_lower and "cray" not in prompt_lower:
                role_to_check = "client"
                field_path = "approvals.client.status"
            
            if role_to_check:
                validation_instruction = f"\n\n🚨🚨🚨 CRITICAL ROLE-SPECIFIC INSTRUCTION 🚨🚨🚨\n\nThe user is asking about **{role_to_check.upper()}** validation. You MUST:\n1. Check the `{field_path}` field for EVERY item in EVERY section\n2. DO NOT check `approvals.client.status` if the query mentions cray\n3. DO NOT check `approvals.cray.status` if the query mentions client\n4. List ALL items where `{field_path}` is: rejected, change_order, null, or any non-approved status\n5. Count them carefully\n\nIf you check the wrong field (e.g., checking client status when asked about cray), your response will be INCORRECT.\n\n"
            else:
                validation_instruction = "\n\n⚠️ CRITICAL INSTRUCTION: You MUST check EVERY item in EVERY section. Do not stop after finding one item. List ALL items that need validation (status: rejected, change_order, null, or any non-approved status). Count them carefully.\n\n"
        
        user_content = f"Materials data:\n{materials_text}{custom_tables_info}{language_instruction}{validation_instruction}Question: {query.prompt}"

        tools = [
            {
                "type": "function",
                "function": {
                    "name": "update_cell",
                    "description": (
                        "Update a single field in the materials table. "
                        "BEFORE calling this function, you MUST:\n"
                        "1. Find the item by matching product identifier from user's request to materials data\n"
                        "2. Verify the item's product name matches what user requested (identifier can be partial or exact match)\n"
                        "3. **CRITICAL**: Use the EXACT product name from the materials data (from the 'product' field) as the expected_product_hint\n"
                        "   - If user says 'demo_item', but the data has 'demo_item' (exact match), use 'demo_item'\n"
                        "   - If user says 'cathat', but the data has 'Cathat Item Model X', use 'Cathat Item Model X' (the exact name from data)\n"
                        "4. Read the current value from THAT specific item (for arrays, read the entire current array)\n"
                        "5. Modify the value appropriately:\n"
                        "   - Arrays: preserve all existing items unless removing, then add/remove only the specified item(s)\n"
                        "   - Non-arrays: set to the new value\n"
                        "6. Verify section_id, item_index, and product name all match the correct item\n"
                        "Parameters: section_id (section identifier), item_index (zero-based), field_path (dot-delimited path like 'approvals.client.status'), new_value (complete modified value)."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "section_id": {
                                "type": "string",
                                "description": "Section identifier, e.g. 'kitchen'."
                            },
                            "item_index": {
                                "type": "integer",
                                "description": "Zero-based index of the item within the section."
                            },
                            "field_path": {
                                "type": "string",
                                "description": (
                                    "Dot-delimited path to the field to update. "
                                    "Examples: 'price.ttc', 'approvals.client.status', 'order.delivery.date'."
                                )
                            },
                            "new_value": {
                                "description": "New value to set. Use the appropriate JSON type.",
                                "anyOf": [
                                    {"type": "string"},
                                    {"type": "number"},
                                    {"type": "boolean"},
                                    {"type": "object"},
                                    {"type": "array", "items": {}},
                                    {"type": "null"}
                                ]
                            }
                        },
                        "required": ["section_id", "item_index", "field_path", "new_value"]
                    }
                }
            }
        ]

        # Extract conversation context if present
        conversation_context = ""
        original_prompt = query.prompt
        if "Recent conversation:" in query.prompt:
            # Extract the conversation context from the prompt
            parts = query.prompt.split("Current request:", 1)
            if len(parts) == 2:
                conversation_context = parts[0].replace("Recent conversation:", "").strip()
                query.prompt = parts[1].strip()  # Update prompt to just the current request
        
        # Check if this is a confirmation response (user saying "all", "all of them", etc.)
        prompt_lower = query.prompt.lower()
        confirmation_phrases = ['all of them', 'all items', 'yes, all', 'update all', 'all', 'yes all', 'update all of them']
        is_confirmation = any(phrase in prompt_lower for phrase in confirmation_phrases)
        
        # Log for debugging
        if is_confirmation:
            logger.info(f"Confirmation detected in prompt: '{query.prompt}'")
            logger.info(f"Conversation context length: {len(conversation_context)} chars")
            if conversation_context:
                logger.info(f"Conversation context preview: {conversation_context[:200]}...")
        
        if is_confirmation and query.materials:
            # This is a confirmation - extract what was originally requested from conversation context
            product_hint = None
            operation = None
            value_to_operate = None
            field_path = None
            
            # Combine conversation context and current prompt for analysis
            full_context = (conversation_context + " " + query.prompt) if conversation_context else query.prompt
            context_lower = full_context.lower()
            
            # Extract product hint generically from conversation context
            # CRITICAL: For confirmations, prioritize the ORIGINAL request, not the confirmation message
            # Priority: 1) Quoted strings (most specific), 2) Common product identifiers from ORIGINAL request, 3) Pattern matching from ORIGINAL request
            
            # First, try to extract from the ORIGINAL request (conversation_context) if available
            original_context = conversation_context if conversation_context else ""
            original_lower = original_context.lower()
            
            quoted_matches = re.findall(r'["\']([^"\']+)["\']', full_context)
            if quoted_matches:
                # Use quoted strings as product hints (most reliable)
                product_hint = quoted_matches[0].lower()
            else:
                # Check for common product identifiers - prioritize ORIGINAL request
                common_identifiers = ['mitigeur', 'cathat', 'suspension', 'meuble', 'armoire', 'wc', 'lave-mains', 'beegcat', 'évier']
                for identifier in common_identifiers:
                    # Check original request first
                    if original_context and identifier in original_lower:
                        product_hint = identifier
                        break
                    # Fall back to full context
                    elif identifier in context_lower:
                        product_hint = identifier
                        break
                
                # If still no hint, try to extract from patterns - prioritize ORIGINAL request
                if not product_hint:
                    # Look for patterns like "the X" or "X in" where X might be a product
                    # Try original request first
                    search_text = original_context if original_context else full_context
                    product_patterns = [
                        r'validate\s+(?:the\s+)?([a-zA-Z0-9\-_]+(?:\s+[a-zA-Z0-9\-_]+)?)\s+(?:item|in|as)',  # "validate cathat item" or "validate cathat in"
                        r'approve\s+(?:the\s+)?([a-zA-Z0-9\-_]+(?:\s+[a-zA-Z0-9\-_]+)?)\s+(?:item|in|as)',  # "approve cathat item"
                        r'the\s+([a-zA-Z0-9\-_]+(?:\s+[a-zA-Z0-9\-_]+)?)\s+item',  # "the cathat item"
                        r'([a-zA-Z0-9\-_]+(?:\s+[a-zA-Z0-9\-_]+)?)\s+item\s+in',  # "cathat item in"
                    ]
                    for pattern in product_patterns:
                        matches = re.findall(pattern, search_text, re.IGNORECASE)
                        if matches:
                            # Use the first match from original request (most reliable)
                            candidate = matches[0].lower()
                            # Filter out common words that aren't products
                            if candidate not in ['all', 'them', 'items', 'update', 'the', 'this', 'that', 'cuisine', 'section', 'specific']:
                                product_hint = candidate
                                break
                    
                    # Fallback to simpler patterns if still no match
                    if not product_hint:
                        simple_patterns = [
                            r'the\s+([a-zA-Z0-9\-_]+(?:\s+[a-zA-Z0-9\-_]+)?)',
                            r'([a-zA-Z0-9\-_]+(?:\s+[a-zA-Z0-9\-_]+)?)\s+in',
                        ]
                        for pattern in simple_patterns:
                            matches = re.findall(pattern, search_text, re.IGNORECASE)
                            if matches:
                                candidate = matches[0].lower()
                                # Filter out common words and section names
                                if candidate not in ['all', 'them', 'items', 'update', 'the', 'this', 'that', 'cuisine', 'section', 'specific', 'found']:
                                    product_hint = candidate
                                    break
            
            # Extract field_path from conversation context
            # Look for mentions of specific fields
            field_keywords = {
                'replacementUrls': ['replacement', 'url', 'replacementurl', 'replacement url', 'urls'],
                'approvals.client.status': ['client status', 'client approval', 'approval status'],
                'approvals.cray.status': ['cray status', 'cray approval', 'contractor status'],
                'order.status': ['order status', 'ordered', 'ordering'],
                'order.ordered': ['ordered', 'order date']
            }
            
            for field, keywords in field_keywords.items():
                if any(keyword in context_lower for keyword in keywords):
                    field_path = field
                    break
            
            # Default to replacementUrls if operation involves URLs/links
            if not field_path and ('url' in context_lower or 'link' in context_lower):
                field_path = "approvals.client.replacementUrls"
            
            # Extract operation and value from conversation context
            if conversation_context:
                # Look for add operation
                if 'add' in context_lower or 'insert' in context_lower or 'append' in context_lower:
                    operation = 'add'
                    # Extract value to add
                    quoted = re.findall(r'["\']([^"\']+)["\']', conversation_context)
                    if not quoted:
                        # Try to extract from patterns like "add the link X" or "add X to"
                        patterns = [
                            r'add\s+(?:the\s+)?(?:link\s+)?([a-zA-Z0-9\-_\.]+(?:\.com|\.org|://)?[a-zA-Z0-9\-_\.]*)',
                            r'add\s+([a-zA-Z0-9\-_\.]+)\s+to',
                            r'insert\s+([a-zA-Z0-9\-_\.]+)',
                            r'append\s+([a-zA-Z0-9\-_\.]+)'
                        ]
                        for pattern in patterns:
                            matches = re.findall(pattern, conversation_context, re.IGNORECASE)
                            if matches:
                                value_to_operate = matches[-1]
                                break
                    else:
                        value_to_operate = quoted[-1]
                
                # Look for remove operation
                elif 'remove' in context_lower or 'get rid of' in context_lower or 'delete' in context_lower or 'eliminate' in context_lower:
                    operation = 'remove'
                    quoted = re.findall(r'["\']([^"\']+)["\']', conversation_context)
                    if not quoted:
                        patterns = [
                            r'remove\s+(?:the\s+)?(?:link\s+)?([a-zA-Z0-9\-_\.]+(?:\.com|\.org|://)?[a-zA-Z0-9\-_\.]*)',
                            r'get rid of\s+(?:the\s+)?([a-zA-Z0-9\-_\.]+)',
                            r'delete\s+([a-zA-Z0-9\-_\.]+)',
                            r'eliminate\s+([a-zA-Z0-9\-_\.]+)'
                        ]
                        for pattern in patterns:
                            matches = re.findall(pattern, conversation_context, re.IGNORECASE)
                            if matches:
                                value_to_operate = matches[-1]
                                break
                    else:
                        value_to_operate = quoted[-1]
                
                # Look for set/update operation (for non-array fields)
                elif 'set' in context_lower or 'update' in context_lower or 'change' in context_lower:
                    # For non-array operations, extract the new value
                    operation = 'set'
                    # Try to extract value from patterns
                    quoted = re.findall(r'["\']([^"\']+)["\']', conversation_context)
                    if quoted:
                        value_to_operate = quoted[-1]
                    else:
                        # Look for patterns like "set to X" or "change to X"
                        patterns = [
                            r'set\s+to\s+([a-zA-Z0-9\-_\.]+)',
                            r'change\s+to\s+([a-zA-Z0-9\-_\.]+)',
                            r'update\s+to\s+([a-zA-Z0-9\-_\.]+)'
                        ]
                        for pattern in patterns:
                            matches = re.findall(pattern, conversation_context, re.IGNORECASE)
                            if matches:
                                value_to_operate = matches[-1]
                                break
            
            # Only proceed if we have enough information
            if product_hint and operation and field_path:
                # For add/remove operations, we need value_to_operate
                # For set operations, value_to_operate is optional (could be in the original request)
                if operation in ['add', 'remove'] and not value_to_operate:
                    logger.warning(f"Confirmation detected but missing value_to_operate for {operation} operation")
                    # Still proceed - let LLM extract from context
                elif operation == 'set' and not value_to_operate:
                    # For set operations, value might be in the original request - proceed anyway
                    pass
                matching_items = find_matching_items(query.materials, product_hint)
                if len(matching_items) > 1:
                    items_list = "\n".join([f"{i+1}. {m['section_label']} - {m['product']} (section_id: {m['section_id']}, index: {m['item_index']})" for i, m in enumerate(matching_items)])
                    
                    # Build operation description
                    operation_desc = f"{operation.upper()}"
                    if value_to_operate:
                        operation_desc += f" '{value_to_operate}'"
                    if operation in ['add', 'remove']:
                        operation_desc += " to/from array"
                    elif operation == 'set':
                        operation_desc += " value"
                    
                    context_addendum = (
                        f"\n\n🚨🚨🚨 CONFIRMATION DETECTED - EXECUTE IMMEDIATELY 🚨🚨🚨\n"
                        f"\nUser confirmed to update ALL {len(matching_items)} items matching '{product_hint}'.\n"
                        f"\nItems to update:\n{items_list}\n"
                        f"\nOperation: {operation_desc}\n"
                        f"Field: {field_path}\n"
                    )
                    
                    if value_to_operate:
                        context_addendum += f"Value: '{value_to_operate}'\n"
                    
                    context_addendum += (
                        f"\n⚠️ ACTION REQUIRED - DO THIS NOW: ⚠️\n"
                        f"1. For EACH item in the list above, call update_cell with:\n"
                        f"   - section_id: (from item list)\n"
                        f"   - item_index: (from item list)\n"
                        f"   - field_path: '{field_path}'\n"
                    )
                    
                    if operation in ['add', 'remove']:
                        if value_to_operate:
                            context_addendum += (
                                f"   - old_value: (read current array from that item)\n"
                                f"   - new_value: (apply {operation} operation to {'add' if operation == 'add' else 'remove'} '{value_to_operate}')\n"
                            )
                        else:
                            context_addendum += (
                                f"   - old_value: (read current array from that item)\n"
                                f"   - new_value: (apply {operation} operation - extract value from conversation context)\n"
                            )
                    elif operation == 'set':
                        if value_to_operate:
                            context_addendum += f"   - new_value: '{value_to_operate}'\n"
                        else:
                            context_addendum += f"   - new_value: (extract from conversation context)\n"
                    
                    context_addendum += (
                        f"\n2. After ALL updates complete, respond with:\n"
                        f"   'Successfully updated {len(matching_items)} items: [list the items]'\n"
                        f"\n❌ DO NOT:\n"
                        f"   - Ask for confirmation again\n"
                        f"   - List items again\n"
                        f"   - Search for new items\n"
                        f"   - Ask any questions\n"
                        f"\n✅ DO:\n"
                        f"   - Call update_cell for each item NOW\n"
                        f"   - Execute the updates immediately\n"
                    )
                    user_content = context_addendum + "\n\n" + user_content
                elif len(matching_items) == 1:
                    # Only one match - still provide context but simpler
                    item = matching_items[0]
                    logger.info(f"Confirmation detected for single item: {item['product']}")
                    # Let LLM handle single item updates normally

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]

        response = client.chat.completions.create(
            model=default_model,
            messages=messages,
            tools=tools,
            tool_choice="auto",
            temperature=0.2
        )

        response_message = response.choices[0].message

        if response_message.tool_calls:
            messages.append({
                "role": "assistant",
                "content": response_message.content or "",
                "tool_calls": [tc.dict() for tc in response_message.tool_calls]
            })

            for tool_call in response_message.tool_calls:
                function_name = tool_call.function.name
                if function_name != "update_cell":
                    tool_response_content = json.dumps({"error": f"Unknown tool {function_name}"})
                else:
                    try:
                        arguments = json.loads(tool_call.function.arguments)
                    except json.JSONDecodeError as exc:
                        tool_response_content = json.dumps({"error": f"Invalid arguments: {exc}"})
                    else:
                        try:
                            # Extract product hint from user's prompt for validation
                            # Look for product identifiers in the prompt
                            prompt_lower = query.prompt.lower()
                            product_hint = None
                            
                            # Extract product hint from user's prompt
                            # Priority: 1) Quoted strings (most specific), 2) Validation/approval patterns, 3) Other patterns
                            quoted_matches = re.findall(r'["\']([^"\']+)["\']', query.prompt)
                            if quoted_matches:
                                # Use the first quoted string as product hint
                                product_hint = quoted_matches[0].lower().strip()
                            else:
                                # Check for validation/approval patterns first (most common for validation actions)
                                # Pattern: "validate [product] as [role]" or "approve [product] as [role]"
                                # This captures the product name before "as"
                                validate_pattern = r'(?:validate|approve)\s+(?:the\s+)?([a-zA-Z0-9\-_\s]+?)(?:\s+as\s+|\s+item|\s+in\s+|$)'
                                validate_match = re.search(validate_pattern, query.prompt, re.IGNORECASE)
                                if validate_match:
                                    candidate = validate_match.group(1).strip().lower()
                                    # Filter out common words that aren't products
                                    if candidate and candidate not in ['all', 'them', 'items', 'update', 'the', 'this', 'that', 'client', 'cray', 'a', 'an']:
                                        product_hint = candidate
                                
                                # If validation pattern didn't match, try other patterns
                                if not product_hint:
                                    product_patterns = [
                                        r'the\s+([a-zA-Z0-9\-_]+(?:\s+[a-zA-Z0-9\-_]+)?)',  # "the [product]"
                                        r'([a-zA-Z0-9\-_]+(?:\s+[a-zA-Z0-9\-_]+)?)\s+in',  # "[product] in"
                                        r'([a-zA-Z0-9\-_]+(?:\s+[a-zA-Z0-9\-_]+)?)\s+row'  # "[product] row"
                                    ]
                                    for pattern in product_patterns:
                                        matches = re.findall(pattern, query.prompt, re.IGNORECASE)
                                        if matches:
                                            candidate = matches[-1].lower().strip()
                                            # Filter out common words that aren't products
                                            if candidate and candidate not in ['all', 'them', 'items', 'update', 'the', 'this', 'that', 'client', 'cray', 'a', 'an']:
                                                product_hint = candidate
                                                break
                            
                            # Check for multiple matching items BEFORE updating
                            materials_data = load_materials_data()
                            matching_items = []
                            
                            if product_hint:
                                matching_items = find_matching_items(materials_data, product_hint)
                                
                                # If multiple matches and user hasn't confirmed "all", return error asking for confirmation
                                all_phrases = ['all of them', 'all items', f'all {product_hint}', 'yes, all', 'update all', 'all', 'yes all']
                                user_confirmed_all = any(phrase in prompt_lower for phrase in all_phrases)
                                
                                if len(matching_items) > 1 and not user_confirmed_all:
                                    # Multiple matches but no confirmation - ask for clarification
                                    items_list = "\n".join([f"{i+1}. {m['section_label']} - {m['product']}" for i, m in enumerate(matching_items)])
                                    tool_response_content = json.dumps({
                                        "status": "needs_confirmation",
                                        "message": f"I found {len(matching_items)} items matching '{product_hint}':\n{items_list}\n\nDo you want to update all of them, or a specific one? Please specify.",
                                        "matching_items": [
                                            {
                                                "product": m['product'], 
                                                "section": m['section_label'],
                                                "section_id": m['section_id'],
                                                "item_index": m['item_index']
                                            } for m in matching_items
                                        ],
                                        "product_hint": product_hint,
                                        "field_path": arguments["field_path"],
                                        "requested_new_value": arguments["new_value"],
                                        "operation_context": query.prompt  # Store what user originally requested
                                    })
                                    messages.append({
                                        "role": "tool",
                                        "tool_call_id": tool_call.id,
                                        "content": tool_response_content
                                    })
                                    continue  # Skip the update, wait for user confirmation
                            
                            # Check if user confirmed "all" items should be updated
                            
                            if product_hint:
                                # Check if prompt indicates "all" confirmation
                                all_phrases = ['all of them', 'all items', f'all {product_hint}', 'yes, all', 'update all', 'all', 'yes all']
                                if any(phrase in prompt_lower for phrase in all_phrases):
                                    # Find all matching items
                                    matching_items = find_matching_items(materials_data, product_hint)
                                    if len(matching_items) > 1:
                                        # Update all matching items
                                        updated_items = []
                                        errors = []
                                        
                                        for match in matching_items:
                                            try:
                                                # Read current value for this item
                                                old_value_match = get_nested_value(match['item'], arguments["field_path"])
                                                
                                                # Apply the same modification to this item's current value
                                                if isinstance(old_value_match, list) and isinstance(arguments["new_value"], list):
                                                    # For arrays, apply the same operation
                                                    # If adding, add to current array
                                                    # If removing, remove from current array
                                                    prompt_lower = query.prompt.lower()
                                                    if "add" in prompt_lower or "insert" in prompt_lower:
                                                        # Extract what to add
                                                        quoted = re.findall(r'["\']([^"\']+)["\']', query.prompt)
                                                        if quoted:
                                                            url_to_add = quoted[-1]
                                                            new_array = old_value_match + [url_to_add] if url_to_add not in old_value_match else old_value_match
                                                        else:
                                                            new_array = arguments["new_value"]  # Use provided value
                                                    elif "remove" in prompt_lower or "get rid of" in prompt_lower or "delete" in prompt_lower:
                                                        # Extract what to remove
                                                        quoted = re.findall(r'["\']([^"\']+)["\']', query.prompt)
                                                        if quoted:
                                                            url_to_remove = quoted[-1]
                                                            new_array = [x for x in old_value_match if x != url_to_remove]
                                                        else:
                                                            # Try to infer from the difference
                                                            new_array = arguments["new_value"]
                                                    else:
                                                        new_array = arguments["new_value"]
                                                else:
                                                    new_array = arguments["new_value"]
                                                
                                                _, updated_item = update_cell(
                                                    section_id=match['section_id'],
                                                    item_index=match['item_index'],
                                                    field_path=arguments["field_path"],
                                                    new_value=new_array,
                                                    expected_product_hint=product_hint
                                                )
                                                updated_items.append({
                                                    'product': updated_item.get('product', ''),
                                                    'section': match['section_label']
                                                })
                                            except Exception as e:
                                                errors.append(f"{match['product']}: {str(e)}")
                                                log_suspicious_activity(
                                                    prompt=query.prompt,
                                                    error_type="batch_update_error",
                                                    error_detail=f"Error updating {match['product']}: {str(e)}",
                                                    attempted_action={
                                                        "section_id": match['section_id'],
                                                        "item_index": match['item_index'],
                                                        "field_path": arguments["field_path"],
                                                        "new_value": arguments["new_value"]
                                                    }
                                                )
                                        
                                        # Return success with all updated items
                                        tool_response_content = json.dumps({
                                            "status": "success",
                                            "updated_count": len(updated_items),
                                            "updated_items": updated_items,
                                            "errors": errors if errors else None,
                                            "field_path": arguments["field_path"],
                                            "batch_update": True
                                        })
                                        messages.append({
                                            "role": "tool",
                                            "tool_call_id": tool_call.id,
                                            "content": tool_response_content
                                        })
                                        continue  # Skip the single update below
                            
                            # Single item update (default behavior)
                            _, updated_item = update_cell(
                                section_id=arguments["section_id"],
                                item_index=arguments["item_index"],
                                field_path=arguments["field_path"],
                                new_value=arguments["new_value"],
                                expected_product_hint=product_hint
                            )
                        except Exception as exc:
                            # Log suspicious activity silently
                            error_str = str(exc)
                            error_type = "unknown_error"
                            
                            if "Product mismatch" in error_str:
                                error_type = "product_mismatch"
                            elif "no change" in error_str.lower() or "identical" in error_str.lower():
                                error_type = "no_change_update"
                            elif "array" in error_str.lower() and ("suspicious" in error_str.lower() or "unexpectedly" in error_str.lower()):
                                error_type = "array_operation_error"
                            
                            log_suspicious_activity(
                                prompt=query.prompt,
                                error_type=error_type,
                                error_detail=error_str,
                                attempted_action={
                                    "section_id": arguments.get("section_id"),
                                    "item_index": arguments.get("item_index"),
                                    "field_path": arguments.get("field_path"),
                                    "new_value": arguments.get("new_value")
                                }
                            )
                            
                            tool_response_content = json.dumps({"status": "error", "detail": str(exc)})
                        else:
                            # WORST CASE SCENARIO: Check if update succeeded but might be wrong
                            # This catches cases where validation passed but the action was still incorrect
                            suspicious = False
                            suspicious_reasons = []
                            
                            # Get the old value before update (we need to reload to check)
                            data_check = load_materials_data()
                            section_check = match_section(data_check.get('sections', []), arguments["section_id"])
                            if section_check:
                                items_check = section_check.get('items', [])
                                if arguments["item_index"] < len(items_check):
                                    item_before = items_check[arguments["item_index"]]
                                    old_value_check = get_nested_value(item_before, arguments["field_path"])
                                    
                                    # Check 1: Verify product hint matches (if provided)
                                    if product_hint:
                                        updated_product = updated_item.get('product', '').lower()
                                        hint_lower = product_hint.lower()
                                        if hint_lower not in updated_product and updated_product not in hint_lower:
                                            suspicious = True
                                            suspicious_reasons.append(
                                                f"Product mismatch: User mentioned '{product_hint}' but updated '{updated_item.get('product', '')}'"
                                            )
                                    
                                    # Check 2: For array operations, verify the operation makes sense
                                    if arguments.get("field_path", "").endswith("replacementUrls"):
                                        prompt_lower = query.prompt.lower()
                                        old_array = old_value_check if isinstance(old_value_check, list) else []
                                        new_array = arguments.get("new_value", [])
                                        
                                        # Check if user asked to remove something
                                        if "remove" in prompt_lower or "get rid of" in prompt_lower or "delete" in prompt_lower:
                                            # Extract what they wanted to remove
                                            url_to_remove = None
                                            quoted = re.findall(r'["\']([^"\']+)["\']', query.prompt)
                                            if quoted:
                                                url_to_remove = quoted[-1]  # Usually the last quoted item
                                            # Also try to extract from context (e.g., "hellocat123")
                                            if not url_to_remove:
                                                # Look for common patterns
                                                url_pattern = r'\b([a-zA-Z0-9\-_\.]+(?:\.com|\.org|\.net|://|\d+))\b'
                                                urls_found = re.findall(url_pattern, query.prompt)
                                                if urls_found:
                                                    url_to_remove = urls_found[-1]
                                            
                                            if url_to_remove and isinstance(old_array, list):
                                                # Check if the URL they wanted to remove is still in the new array
                                                if url_to_remove in old_array and url_to_remove in new_array:
                                                    suspicious = True
                                                    suspicious_reasons.append(
                                                        f"⚠️ CRITICAL: Requested to remove '{url_to_remove}' but it's still in the array after update"
                                                    )
                                                # Check if they removed something that wasn't requested
                                                if url_to_remove in old_array and url_to_remove not in new_array:
                                                    # This is correct, but check if something unexpected was also removed
                                                    removed_items = [x for x in old_array if x not in new_array]
                                                    if len(removed_items) > 1 or (removed_items and removed_items[0] != url_to_remove):
                                                        suspicious = True
                                                        suspicious_reasons.append(
                                                            f"⚠️ CRITICAL: Requested to remove '{url_to_remove}' but also removed: {removed_items}"
                                                        )
                                        
                                        # Check if user asked to add something
                                        elif "add" in prompt_lower:
                                            url_to_add = None
                                            quoted = re.findall(r'["\']([^"\']+)["\']', query.prompt)
                                            if quoted:
                                                url_to_add = quoted[-1]
                                            if not url_to_add:
                                                url_pattern = r'\b([a-zA-Z0-9\-_\.]+(?:\.com|\.org|\.net|://))\b'
                                                urls_found = re.findall(url_pattern, query.prompt)
                                                if urls_found:
                                                    url_to_add = urls_found[-1]
                                            
                                            if url_to_add and isinstance(new_array, list):
                                                if url_to_add not in new_array:
                                                    suspicious = True
                                                    suspicious_reasons.append(
                                                        f"⚠️ CRITICAL: Requested to add '{url_to_add}' but it's not in the final array"
                                                    )
                            
                            # If suspicious, log it explicitly as WORST CASE
                            if suspicious:
                                log_suspicious_activity(
                                    prompt=query.prompt,
                                    error_type="WORST_CASE_UNDETECTED_ERROR",
                                    error_detail="🚨 CRITICAL: Update succeeded but appears to be INCORRECT. Validation did NOT catch this error.\n\n" + 
                                               "\n".join(f"- {reason}" for reason in suspicious_reasons) +
                                               f"\n\nOld value: {old_value_check}\nNew value: {arguments.get('new_value')}",
                                    attempted_action={
                                        "section_id": arguments["section_id"],
                                        "item_index": arguments["item_index"],
                                        "field_path": arguments["field_path"],
                                        "new_value": arguments["new_value"],
                                        "old_value": old_value_check,
                                        "updated_product": updated_item.get('product', ''),
                                        "expected_product_hint": product_hint
                                    }
                                )
                            
                            tool_response_content = json.dumps({
                                "status": "success",
                                "section_id": arguments["section_id"],
                                "item_index": arguments["item_index"],
                                "field_path": arguments["field_path"],
                                "new_value": arguments["new_value"],
                                "updated_item": updated_item,
                                "suspicious": suspicious,  # Flag for LLM to mention in response
                                "suspicious_reasons": suspicious_reasons if suspicious else []
                            })

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": tool_response_content
                })

            final_response = client.chat.completions.create(
                model=default_model,
                messages=messages,
                temperature=0.2
            )
            final_message = final_response.choices[0].message
            answer = final_message.content
            
            # Check if any tool responses flagged suspicious activity
            for msg in messages:
                if msg.get("role") == "tool":
                    try:
                        tool_result = json.loads(msg.get("content", "{}"))
                        if tool_result.get("suspicious"):
                            # Add warning to answer if not already present
                            if "⚠️" not in answer and "WARNING" not in answer.upper():
                                warning = "\n\n⚠️ WARNING: The update completed, but there may be an issue. Please verify the result."
                                answer = answer + warning if answer else warning
                    except:
                        pass
        else:
            answer = response_message.content

        if not answer:
            raise HTTPException(status_code=500, detail="Empty response from OpenAI")

        # Parse the response to extract English and French versions
        answer_text = answer.strip()
        english_answer = answer_text  # Default fallback
        french_answer = answer_text   # Default fallback
        
        # Try to extract EN and FR versions
        # Look for "EN:" and "FR:" markers (case-insensitive, but prefer exact match)
        en_index = answer_text.find("EN:")
        if en_index == -1:
            en_index = answer_text.find("en:")
        fr_index = answer_text.find("FR:")
        if fr_index == -1:
            fr_index = answer_text.find("fr:")
        
        if en_index != -1 and fr_index != -1:
            # Both markers found
            if en_index < fr_index:
                # Format: EN: ... FR: ...
                english_part = answer_text[en_index + 3:fr_index].strip()
                french_part = answer_text[fr_index + 3:].strip()
            else:
                # Format: FR: ... EN: ... (unusual but handle it)
                french_part = answer_text[fr_index + 3:en_index].strip()
                english_part = answer_text[en_index + 3:].strip()
            
            # Clean up whitespace but preserve structure (don't collapse all newlines)
            # Remove excessive whitespace but keep single newlines for readability
            english_part = '\n'.join(line.strip() for line in english_part.split('\n') if line.strip())
            french_part = '\n'.join(line.strip() for line in french_part.split('\n') if line.strip())
            
            if english_part:
                english_answer = english_part
            if french_part:
                french_answer = french_part
        elif en_index != -1:
            # Only EN: found
            english_part = answer_text[en_index + 3:].strip()
            english_part = '\n'.join(line.strip() for line in english_part.split('\n') if line.strip())
            if english_part:
                english_answer = english_part
                french_answer = english_part  # Fallback: use English for both
        elif fr_index != -1:
            # Only FR: found - this is a problem, but handle it
            french_part = answer_text[fr_index + 3:].strip()
            french_part = '\n'.join(line.strip() for line in french_part.split('\n') if line.strip())
            if french_part:
                french_answer = french_part
                english_answer = french_part  # Fallback: use French for both (shouldn't happen)

        return {
            "answer": english_answer,
            "answer_fr": french_answer
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error querying assistant: {str(e)}"
        )


@app.post("/api/translate")
async def translate_text(request: TranslationRequest):
    """
    Translate text from English to target language using OpenAI.
    """
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="Translation endpoint is unavailable because OPENAI_API_KEY is not configured."
        )
    try:
        if request.target_language == 'en':
            return {"translated_text": request.text}
        
        # Map language codes to full names
        language_map = {
            'fr': 'French',
            'es': 'Spanish',
            'de': 'German',
            # Add more as needed
        }
        target_lang_name = language_map.get(request.target_language, 'French')
        
        translation_prompt = f"Translate the following English text to {target_lang_name}. Only return the translation, no explanations:\n\n{request.text}"
        
        response = client.chat.completions.create(
            model=default_model,
            messages=[
                {"role": "system", "content": f"You are a professional translator. Translate English text to {target_lang_name} accurately and naturally."},
                {"role": "user", "content": translation_prompt}
            ],
            temperature=0.3
        )
        
        translated_text = response.choices[0].message.content.strip()
        if not translated_text:
            raise HTTPException(status_code=500, detail="Empty translation from OpenAI")
        
        return {"translated_text": translated_text}
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error translating text: {str(e)}"
        )


@app.post("/api/extract-product-image")
async def extract_product_image(request: ImageExtractionRequest):
    """
    Extract product image URL from a product page.
    Works with Reuter.com and other sites that use standard HTML img tags.
    For Reuter.com, can construct image URL directly from product reference.
    """
    try:
        url = request.url.strip() if request.url else ''
        reference = request.reference.strip() if request.reference else None
        
        # For Reuter.com, try to construct image URL directly from reference
        # Pattern: https://img.reuter.com/products/fg/400x400/fg-{reference}0.jpg
        # From the HTML we saw: reference "31574SD1" -> image "fg-31574sd10.jpg" (lowercase + trailing 0)
        if reference and len(reference) > 0:
            # Clean reference (remove spaces, convert to lowercase)
            reference_clean = reference.strip().lower().replace(' ', '').replace('-', '')
            
            # Primary pattern: lowercase reference + trailing "0" (most common)
            # Return this directly - browser will handle 404s
            image_url = f"https://img.reuter.com/products/fg/400x400/fg-{reference_clean}0.jpg"
            return {"image_url": image_url}
        
        # If no reference provided or patterns didn't work, try extracting from URL
        if 'reuter.com' in url.lower() and not url.endswith('-') and url.endswith('.php'):
            # Extract product code from URL
            # For Reuter URLs like: .../grohe-k700-evier-de-cuisine-actionnement-manuel-l-54-p-44-cm-acier-inoxydable-satine-a935827.php
            ref_match = re.search(r'-([a-z])(\d+)\.php$', url, re.IGNORECASE)
            if ref_match:
                # Extract the product code (like a935827)
                product_code = (ref_match.group(1) + ref_match.group(2)).lower()
                # Try the code-based pattern
                image_url = f"https://img.reuter.com/products/fg/400x400/fg-{product_code}.jpg"
                try:
                    async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
                        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
                        response = await client.head(image_url, headers=headers)
                        if response.status_code == 200:
                            return {"image_url": image_url}
                except:
                    pass
        
        # Fallback: Fetch the HTML page if URL is valid
        if not url or not url.startswith(('http://', 'https://')):
            return {"image_url": None, "error": "Invalid URL"}
        
        # Skip fetching if URL looks truncated (ends with -)
        if url.endswith('-') or url.endswith('reuter.com'):
            return {"image_url": None, "error": "URL appears to be truncated"}
        
        # Fetch the HTML page
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            html_content = response.text
        
        # Extract image URL using multiple strategies
        image_url = None
        
        # Strategy 1: Look for og:image meta tag
        og_image_match = re.search(r'<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']', html_content, re.IGNORECASE)
        if og_image_match:
            image_url = og_image_match.group(1)
        
        # Strategy 2: Look for img.reuter.com pattern (Reuter-specific)
        if not image_url:
            reuter_img_match = re.search(r'https://img\.reuter\.com/products/[^"\'\s<>]+\.jpg', html_content, re.IGNORECASE)
            if reuter_img_match:
                image_url = reuter_img_match.group(0)
        
        # Strategy 3: Look for first product image in gallery (data-qa="productGalleryGrid-thumbnail-0" or similar)
        if not image_url:
            gallery_img_match = re.search(r'<img[^>]*data-qa=["\']productGalleryGrid-thumbnail-0["\'][^>]*src=["\']([^"\']+)["\']', html_content, re.IGNORECASE)
            if gallery_img_match:
                image_url = gallery_img_match.group(1)
        
        # Strategy 4: Look for img tag with product-related classes or alt text
        if not image_url:
            # Find img tags and look for ones that might be product images
            img_matches = re.finditer(r'<img[^>]*src=["\']([^"\']+)["\'][^>]*>', html_content, re.IGNORECASE)
            for match in img_matches:
                img_src = match.group(1)
                img_tag = match.group(0)
                # Check if it looks like a product image (has width/height, or contains "product" in URL)
                if ('width' in img_tag and 'height' in img_tag) or 'product' in img_src.lower():
                    # Prefer images from img.reuter.com or similar CDN
                    if 'img.reuter.com' in img_src or 'cdn' in img_src.lower() or 'image' in img_src.lower():
                        image_url = img_src
                        break
        
        if not image_url:
            return {"image_url": None, "error": "No product image found on page"}
        
        # Clean up the URL (remove query params that might cause issues, but keep the path)
        if '?' in image_url:
            image_url = image_url.split('?')[0]
        
        return {"image_url": image_url}
    
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch product page: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error extracting product image: {str(e)}"
        )


@app.put("/api/materials")
async def update_materials(update: MaterialsUpdate):
    """
    Update the materials.json file with new data.
    Validates the structure before saving.
    """
    try:
        # Basic validation - check required top-level fields
        if not isinstance(update.materials, dict):
            raise HTTPException(status_code=400, detail="Materials must be a JSON object")
        
        if 'sections' not in update.materials:
            raise HTTPException(status_code=400, detail="Missing 'sections' field")
        
        if not isinstance(update.materials['sections'], list):
            raise HTTPException(status_code=400, detail="'sections' must be an array")
        
        # Write to database and/or JSON (dual-write)
        write_materials_data(update.materials)
        
        return {"message": "Materials updated successfully", "status": "ok"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error updating materials: {str(e)}"
        )


@app.post("/api/edit-history/log")
async def log_edit_entry(edit_log: EditLogRequest):
    """
    Log an edit to the edit history.
    """
    try:
        log_edit(
            section_id=edit_log.section_id,
            section_label=edit_log.section_label,
            item_index=edit_log.item_index,
            product=edit_log.product,
            field_path=edit_log.field_path,
            old_value=edit_log.old_value,
            new_value=edit_log.new_value,
            source=edit_log.source
        )
        return {"message": "Edit logged successfully", "status": "ok"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error logging edit: {str(e)}"
        )


@app.get("/api/edit-history")
async def get_edit_history(limit: Optional[int] = 100):
    """
    Get edit history, optionally limited to the most recent entries.
    """
    try:
        history = load_edit_history()
        # Return most recent entries first
        history.reverse()
        if limit and limit > 0:
            history = history[:limit]
        return {"history": history, "count": len(history)}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving edit history: {str(e)}"
        )


# ============================================================================
# Projects API Endpoints
# ============================================================================

class ProjectCreate(BaseModel):
    name: str
    address: Optional[str] = None
    status: Optional[str] = "draft"
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    invoiceCount: Optional[int] = 0
    percentagePaid: Optional[int] = 0
    hasData: Optional[bool] = False
    devisStatus: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    invoiceCount: Optional[int] = None
    percentagePaid: Optional[int] = None
    hasData: Optional[bool] = None
    devisStatus: Optional[str] = None


@app.get("/api/projects")
async def get_projects():
    """
    Get all projects from database.
    Returns 501 if database not enabled (frontend should use localStorage fallback).
    """
    use_database = os.getenv("USE_DATABASE", "false").lower() == "true"
    
    if not use_database:
        raise HTTPException(
            status_code=501,
            detail="Database not enabled. Use localStorage fallback."
        )
    
    try:
        with db_readonly_session() as session:
            projects = projects_service.get_all_projects(session)
            return {"projects": projects, "count": len(projects)}
    except Exception as e:
        logger.error(f"Error getting projects: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving projects: {str(e)}"
        )


@app.get("/api/projects/{project_id}")
async def get_project(project_id: str):
    """Get a single project by ID."""
    use_database = os.getenv("USE_DATABASE", "false").lower() == "true"
    
    if not use_database:
        raise HTTPException(
            status_code=501,
            detail="Database not enabled. Use localStorage fallback."
        )
    
    try:
        with db_readonly_session() as session:
            project = projects_service.get_project(session, project_id)
            if not project:
                raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
            return project
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving project: {str(e)}"
        )


@app.post("/api/projects")
async def create_project(project: ProjectCreate):
    """Create a new project."""
    use_database = os.getenv("USE_DATABASE", "false").lower() == "true"
    
    if not use_database:
        raise HTTPException(
            status_code=501,
            detail="Database not enabled. Use localStorage fallback."
        )
    
    try:
        project_data = project.dict()
        project_data["id"] = f"project-{datetime.utcnow().timestamp() * 1000:.0f}"
        
        with db_session() as session:
            created_project = projects_service.create_project(session, project_data)
            return created_project
    except Exception as e:
        logger.error(f"Error creating project: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error creating project: {str(e)}"
        )


@app.put("/api/projects/{project_id}")
async def update_project(project_id: str, updates: ProjectUpdate):
    """Update an existing project."""
    use_database = os.getenv("USE_DATABASE", "false").lower() == "true"
    
    if not use_database:
        raise HTTPException(
            status_code=501,
            detail="Database not enabled. Use localStorage fallback."
        )
    
    try:
        # Convert None values to actual None (not missing keys)
        update_dict = {k: v for k, v in updates.dict().items() if v is not None}
        
        with db_session() as session:
            updated_project = projects_service.update_project(session, project_id, update_dict)
            if not updated_project:
                raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
            return updated_project
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating project: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error updating project: {str(e)}"
        )


@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str):
    """Delete a project."""
    use_database = os.getenv("USE_DATABASE", "false").lower() == "true"
    
    if not use_database:
        raise HTTPException(
            status_code=501,
            detail="Database not enabled. Use localStorage fallback."
        )
    
    try:
        with db_session() as session:
            deleted = projects_service.delete_project(session, project_id)
            if not deleted:
                raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
            return {"message": "Project deleted successfully", "status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting project: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting project: {str(e)}"
        )


# ============================================================================
# Workers API Endpoints
# ============================================================================

class WorkerCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    jobs: Optional[List[dict]] = []


class WorkerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    jobs: Optional[List[dict]] = None


@app.get("/api/workers")
async def get_workers():
    """
    Get all workers from database.
    Returns 501 if database not enabled (frontend should use localStorage fallback).
    """
    use_database = os.getenv("USE_DATABASE", "false").lower() == "true"
    
    if not use_database:
        raise HTTPException(
            status_code=501,
            detail="Database not enabled. Use localStorage fallback."
        )
    
    try:
        with db_readonly_session() as session:
            workers = workers_service.get_all_workers(session)
            return {"workers": workers, "count": len(workers)}
    except Exception as e:
        logger.error(f"Error getting workers: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving workers: {str(e)}"
        )


@app.get("/api/workers/{worker_id}")
async def get_worker(worker_id: str):
    """Get a single worker by ID."""
    use_database = os.getenv("USE_DATABASE", "false").lower() == "true"
    
    if not use_database:
        raise HTTPException(
            status_code=501,
            detail="Database not enabled. Use localStorage fallback."
        )
    
    try:
        with db_readonly_session() as session:
            worker = workers_service.get_worker(session, worker_id)
            if not worker:
                raise HTTPException(status_code=404, detail=f"Worker '{worker_id}' not found")
            return worker
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting worker: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving worker: {str(e)}"
        )


@app.post("/api/workers")
async def create_worker(worker: WorkerCreate):
    """Create a new worker."""
    use_database = os.getenv("USE_DATABASE", "false").lower() == "true"
    
    if not use_database:
        raise HTTPException(
            status_code=501,
            detail="Database not enabled. Use localStorage fallback."
        )
    
    try:
        worker_data = worker.dict()
        worker_data["id"] = f"worker-{datetime.utcnow().timestamp() * 1000:.0f}"
        
        with db_session() as session:
            created_worker = workers_service.create_worker(session, worker_data)
            return created_worker
    except Exception as e:
        logger.error(f"Error creating worker: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error creating worker: {str(e)}"
        )


@app.put("/api/workers/{worker_id}")
async def update_worker(worker_id: str, updates: WorkerUpdate):
    """Update an existing worker."""
    use_database = os.getenv("USE_DATABASE", "false").lower() == "true"
    
    if not use_database:
        raise HTTPException(
            status_code=501,
            detail="Database not enabled. Use localStorage fallback."
        )
    
    try:
        # Convert None values to actual None (not missing keys)
        update_dict = {k: v for k, v in updates.dict().items() if v is not None}
        
        with db_session() as session:
            updated_worker = workers_service.update_worker(session, worker_id, update_dict)
            if not updated_worker:
                raise HTTPException(status_code=404, detail=f"Worker '{worker_id}' not found")
            return updated_worker
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating worker: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error updating worker: {str(e)}"
        )


@app.delete("/api/workers/{worker_id}")
async def delete_worker(worker_id: str):
    """Delete a worker."""
    use_database = os.getenv("USE_DATABASE", "false").lower() == "true"
    
    if not use_database:
        raise HTTPException(
            status_code=501,
            detail="Database not enabled. Use localStorage fallback."
        )
    
    try:
        with db_session() as session:
            deleted = workers_service.delete_worker(session, worker_id)
            if not deleted:
                raise HTTPException(status_code=404, detail=f"Worker '{worker_id}' not found")
            return {"message": "Worker deleted successfully", "status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting worker: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting worker: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

