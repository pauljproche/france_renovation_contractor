"""
Agent tools service - provides secure database access for AI agent.

All agent operations go through SQL functions with preview + confirmation.
Agent cannot directly modify tables - all writes go through SQL functions.

Security:
- Uses restricted database role (agent_user) with SELECT + EXECUTE only
- All modifications require preview + confirmation
- SQL functions perform permission checks
- Parameterized queries prevent SQL injection
"""
import os
import secrets
import json
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

# Configure SQL query logging
# Store in project logs directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGS_DIR = os.path.join(BASE_DIR, 'logs')
os.makedirs(LOGS_DIR, exist_ok=True)  # Create logs directory if it doesn't exist

SQL_LOG_FILE = os.getenv("SQL_LOG_FILE", os.path.join(LOGS_DIR, "sql_queries.log"))
sql_logger = logging.getLogger("sql_queries")
sql_logger.setLevel(logging.INFO)

# Create file handler if it doesn't exist
if not sql_logger.handlers:
    file_handler = logging.FileHandler(SQL_LOG_FILE, mode='a')
    file_handler.setLevel(logging.INFO)
    formatter = logging.Formatter(
        '%(asctime)s | %(funcName)s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(formatter)
    sql_logger.addHandler(file_handler)
    sql_logger.propagate = False  # Don't propagate to root logger

# Use restricted agent connection if available, otherwise use main connection
AGENT_DATABASE_URL = os.getenv("AGENT_DATABASE_URL")
DATABASE_URL = os.getenv("DATABASE_URL")

# Use agent connection if configured, otherwise fall back to main connection
# In production, agent_user should have restricted permissions
if AGENT_DATABASE_URL:
    agent_engine = create_engine(AGENT_DATABASE_URL, pool_pre_ping=True)
else:
    # Fallback: use main connection (for development)
    # In production, this should be the restricted agent_user connection
    agent_engine = create_engine(DATABASE_URL, pool_pre_ping=True) if DATABASE_URL else None

# In-memory storage for action previews (in production, use Redis or database)
# Format: {action_id: {preview_data, expires_at, sql_query, sql_params}}
_action_store: Dict[str, Dict[str, Any]] = {}


def _generate_action_id() -> str:
    """Generate secure, unpredictable action ID"""
    return secrets.token_urlsafe(32)


def _store_action_preview(preview_data: Dict[str, Any], sql_query: str, sql_params: Dict[str, Any]) -> str:
    """Store action preview for later execution"""
    action_id = _generate_action_id()
    _action_store[action_id] = {
        "preview": preview_data,
        "sql_query": sql_query,
        "sql_params": sql_params,
        "created_at": datetime.now(),
        "expires_at": datetime.now() + timedelta(minutes=5),  # Expires in 5 minutes
        "executed": False
    }
    return action_id


def _get_stored_action(action_id: str) -> Optional[Dict[str, Any]]:
    """Get stored action by ID"""
    if action_id not in _action_store:
        return None
    
    action = _action_store[action_id]
    
    # Check expiration
    if datetime.now() > action["expires_at"]:
        del _action_store[action_id]
        return None
    
    return action


def get_most_recent_unexecuted_action() -> Optional[Tuple[str, Dict[str, Any]]]:
    """
    Get the most recent unexecuted action preview.
    Returns (action_id, action_data) or None.
    Useful when user confirms via text instead of modal.
    """
    now = datetime.now()
    sql_logger.info(f"🔍 Checking action store: {len(_action_store)} total actions")
    
    recent_actions = [
        (action_id, action)
        for action_id, action in _action_store.items()
        if not action.get("executed", False) and now <= action["expires_at"]
    ]
    
    sql_logger.info(f"🔍 Found {len(recent_actions)} unexecuted, non-expired actions")
    
    if not recent_actions:
        # Log all actions for debugging
        for action_id, action in _action_store.items():
            age = (now - action["created_at"]).total_seconds()
            expired = now > action["expires_at"]
            executed = action.get("executed", False)
            sql_logger.info(f"   Action {action_id[:20]}...: age={age:.1f}s, expired={expired}, executed={executed}")
        return None
    
    # Sort by creation time (most recent first)
    recent_actions.sort(key=lambda x: x[1]["created_at"], reverse=True)
    most_recent = recent_actions[0]
    age = (now - most_recent[1]["created_at"]).total_seconds()
    sql_logger.info(f"✅ Most recent action: {most_recent[0][:20]}... (age: {age:.1f}s)")
    return most_recent


def _mark_action_executed(action_id: str, result: Any = None):
    """Mark action as executed"""
    if action_id in _action_store:
        _action_store[action_id]["executed"] = True
        _action_store[action_id]["result"] = result
        _action_store[action_id]["executed_at"] = datetime.now()


def _log_sql_query(function_name: str, sql_query: str, params: Dict[str, Any], result_count: Optional[int] = None):
    """Log SQL query to file for manual verification"""
    try:
        params_str = json.dumps(params, default=str) if params else "{}"
        result_info = f" | Rows: {result_count}" if result_count is not None else ""
        sql_logger.info(
            f"FUNCTION: {function_name} | "
            f"SQL: {sql_query} | "
            f"PARAMS: {params_str}{result_info}"
        )
    except Exception as e:
        # Don't fail if logging fails
        pass


# ============================================================================
# READ-ONLY QUERY FUNCTIONS (No confirmation needed)
# ============================================================================

def query_items_needing_validation(role: str, project_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Query items needing validation for a role (read-only, no confirmation)"""
    if not agent_engine:
        raise RuntimeError("Database connection not available")
    
    sql_query = "SELECT * FROM get_items_needing_validation(:role, :project_id)"
    params = {"role": role, "project_id": project_id}
    
    with agent_engine.connect() as conn:
        result = conn.execute(text(sql_query), params)
        conn.commit()
        
        rows = [
            {
                "item_id": row.item_id,
                "section_id": row.section_id,
                "section_label": row.section_label,
                "product": row.product,
                "status": row.status,
                "current_value": row.current_value
            }
            for row in result
        ]
        
        _log_sql_query("query_items_needing_validation", sql_query, params, len(rows))
        return rows


def query_todo_items(role: str, project_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Query TODO items for a role (read-only, no confirmation)"""
    if not agent_engine:
        raise RuntimeError("Database connection not available")
    
    sql_query = "SELECT * FROM get_todo_items(:role, :project_id)"
    params = {"role": role, "project_id": project_id}
    
    with agent_engine.connect() as conn:
        result = conn.execute(text(sql_query), params)
        conn.commit()
        
        rows = [
            {
                "item_id": row.item_id,
                "section_id": row.section_id,
                "section_label": row.section_label,
                "product": row.product,
                "action_reason": row.action_reason,
                "labor_type": row.labor_type
            }
            for row in result
        ]
        
        _log_sql_query("query_todo_items", sql_query, params, len(rows))
        return rows


def query_pricing_summary(project_id: Optional[str] = None) -> Dict[str, Any]:
    """Query pricing summary (read-only, no confirmation)"""
    if not agent_engine:
        raise RuntimeError("Database connection not available")
    
    sql_query = "SELECT * FROM get_pricing_summary(:project_id)"
    params = {"project_id": project_id}
    
    with agent_engine.connect() as conn:
        result = conn.execute(text(sql_query), params)
        conn.commit()
        
        row = result.first()
        result_data = {
            "total_ttc": float(row.total_ttc) if row and row.total_ttc else 0,
            "total_ht": float(row.total_ht) if row and row.total_ht else 0,
            "item_count": row.item_count if row else 0
        } if row else {"total_ttc": 0, "total_ht": 0, "item_count": 0}
        
        _log_sql_query("query_pricing_summary", sql_query, params, 1 if row else 0)
        return result_data


def query_items_by_section(section_id: str, project_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Query items by section (read-only, no confirmation)"""
    if not agent_engine:
        raise RuntimeError("Database connection not available")
    
    sql_query = "SELECT * FROM get_items_by_section(:section_id, :project_id)"
    params = {"section_id": section_id, "project_id": project_id}
    
    with agent_engine.connect() as conn:
        result = conn.execute(text(sql_query), params)
        conn.commit()
        
        rows = [
            {
                "item_id": row.item_id,
                "product": row.product,
                "reference": row.reference,
                "price_ttc": float(row.price_ttc) if row.price_ttc else None,
                "price_ht_quote": float(row.price_ht_quote) if row.price_ht_quote else None,
                "labor_type": row.labor_type,
                "client_status": row.client_status,
                "contractor_status": row.contractor_status,
                "ordered": row.ordered,
                "delivery_date": row.delivery_date
            }
            for row in result
        ]
        
        _log_sql_query("query_items_by_section", sql_query, params, len(rows))
        return rows


def search_items(product_search: str, project_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Search items by product name (read-only, no confirmation)"""
    if not agent_engine:
        raise RuntimeError("Database connection not available")
    
    sql_query = "SELECT * FROM search_items(:product_search, :project_id)"
    params = {"product_search": product_search, "project_id": project_id}
    
    with agent_engine.connect() as conn:
        result = conn.execute(text(sql_query), params)
        conn.commit()
        
        rows = [
            {
                "item_id": row.item_id,
                "section_id": row.section_id,
                "section_label": row.section_label,
                "product": row.product,
                "reference": row.reference
            }
            for row in result
        ]
        
        _log_sql_query("search_items", sql_query, params, len(rows))
        return rows


# ============================================================================
# PREVIEW FUNCTIONS (Generate query, return preview, don't execute)
# ============================================================================

def preview_update_item_approval(
    item_id: int, 
    role: str, 
    status: str,
    user_role: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generate preview of approval update (doesn't execute).
    Returns preview with SQL query and NLP interpretation.
    """
    if not agent_engine:
        raise RuntimeError("Database connection not available")
    
    # Input validation
    if not isinstance(item_id, int) or item_id <= 0:
        raise ValueError("Invalid item_id")
    if not isinstance(role, str) or not role.strip():
        raise ValueError("Invalid role")
    if status and not isinstance(status, str):
        raise ValueError("Invalid status")
    
    # Call SQL function to generate preview (doesn't execute)
    with agent_engine.connect() as conn:
        result = conn.execute(
            text("SELECT update_item_approval_preview(:item_id, :role, :status, :user_role)"),
            {
                "item_id": item_id,
                "role": role.strip(),
                "status": status.strip() if status else None,
                "user_role": user_role.strip() if user_role else None
            }
        )
        conn.commit()
        
        preview_json = result.scalar()
        preview_data = json.loads(preview_json) if isinstance(preview_json, str) else preview_json
        
        # Store action for later execution
        sql_query = preview_data["sql"]["query"]
        sql_params = preview_data["sql"]["params"]
        action_id = _store_action_preview(preview_data, sql_query, sql_params)
        
        return {
            "status": "requires_confirmation",
            "action_id": action_id,
            "preview": preview_data
        }


def preview_add_replacement_url(
    item_id: int,
    role: str,
    url: str
) -> Dict[str, Any]:
    """Generate preview of adding replacement URL (doesn't execute)"""
    if not agent_engine:
        raise RuntimeError("Database connection not available")
    
    # Input validation
    if not isinstance(item_id, int) or item_id <= 0:
        raise ValueError("Invalid item_id")
    if not isinstance(role, str) or not role.strip():
        raise ValueError("Invalid role")
    if not isinstance(url, str) or not url.strip():
        raise ValueError("Invalid URL")
    
    with agent_engine.connect() as conn:
        result = conn.execute(
            text("SELECT add_replacement_url_preview(:item_id, :role, :url)"),
            {
                "item_id": item_id,
                "role": role.strip(),
                "url": url.strip()
            }
        )
        conn.commit()
        
        preview_json = result.scalar()
        preview_data = json.loads(preview_json) if isinstance(preview_json, str) else preview_json
        
        sql_query = preview_data["sql"]["query"]
        sql_params = preview_data["sql"]["params"]
        action_id = _store_action_preview(preview_data, sql_query, sql_params)
        
        return {
            "status": "requires_confirmation",
            "action_id": action_id,
            "preview": preview_data
        }


def preview_remove_replacement_url(
    item_id: int,
    role: str,
    url: str
) -> Dict[str, Any]:
    """Generate preview of removing replacement URL (doesn't execute)"""
    if not agent_engine:
        raise RuntimeError("Database connection not available")
    
    # Input validation
    if not isinstance(item_id, int) or item_id <= 0:
        raise ValueError("Invalid item_id")
    if not isinstance(role, str) or not role.strip():
        raise ValueError("Invalid role")
    if not isinstance(url, str) or not url.strip():
        raise ValueError("Invalid URL")
    
    with agent_engine.connect() as conn:
        result = conn.execute(
            text("SELECT remove_replacement_url_preview(:item_id, :role, :url)"),
            {
                "item_id": item_id,
                "role": role.strip(),
                "url": url.strip()
            }
        )
        conn.commit()
        
        preview_json = result.scalar()
        preview_data = json.loads(preview_json) if isinstance(preview_json, str) else preview_json
        
        sql_query = preview_data["sql"]["query"]
        sql_params = preview_data["sql"]["params"]
        action_id = _store_action_preview(preview_data, sql_query, sql_params)
        
        return {
            "status": "requires_confirmation",
            "action_id": action_id,
            "preview": preview_data
        }


def preview_update_item_field(
    item_id: int,
    field_name: str,
    new_value: Any,
    expected_product_hint: Optional[str] = None
) -> Dict[str, Any]:
    """Generate preview of updating item field (doesn't execute)"""
    if not agent_engine:
        raise RuntimeError("Database connection not available")
    
    # Input validation
    if not isinstance(item_id, int) or item_id <= 0:
        raise ValueError("Invalid item_id")
    if not isinstance(field_name, str) or not field_name.strip():
        raise ValueError("Invalid field_name")
    
    # Convert new_value to JSONB string
    new_value_jsonb = json.dumps(new_value) if not isinstance(new_value, str) or new_value[0] != '{' else new_value
    
    with agent_engine.connect() as conn:
        # Use bindparam to properly handle the JSONB cast
        from sqlalchemy import bindparam
        result = conn.execute(
            text("SELECT update_item_field_preview(:item_id, :field_name, CAST(:new_value AS jsonb), :expected_product_hint)"),
            {
                "item_id": item_id,
                "field_name": field_name.strip(),
                "new_value": new_value_jsonb,
                "expected_product_hint": expected_product_hint.strip() if expected_product_hint else None
            }
        )
        conn.commit()
        
        preview_json = result.scalar()
        preview_data = json.loads(preview_json) if isinstance(preview_json, str) else preview_json
        
        sql_query = preview_data["sql"]["query"]
        sql_params = preview_data["sql"]["params"]
        action_id = _store_action_preview(preview_data, sql_query, sql_params)
        
        sql_logger.info(f"✅ Preview stored: action_id={action_id}, action={preview_data.get('action')}, item_id={item_id}, field={field_name}")
        sql_logger.info(f"   Action store now has {len(_action_store)} action(s)")
        
        return {
            "status": "requires_confirmation",
            "action_id": action_id,
            "preview": preview_data
        }


# ============================================================================
# EXECUTION FUNCTIONS (Called after user confirmation)
# ============================================================================

def execute_confirmed_action(action_id: str) -> Dict[str, Any]:
    """
    Execute a stored action after user confirmation.
    This is the ONLY way to execute write operations.
    """
    if not agent_engine:
        raise RuntimeError("Database connection not available")
    
    # Get stored action
    stored_action = _get_stored_action(action_id)
    if not stored_action:
        raise ValueError("Invalid or expired action_id")
    
    if stored_action["executed"]:
        return {
            "status": "already_executed",
            "result": stored_action.get("result")
        }
    
    preview_data = stored_action["preview"]
    action_type = preview_data.get("action")
    sql_query = stored_action["sql_query"]
    sql_params = stored_action["sql_params"]
    
    # Execute based on action type
    try:
        with agent_engine.begin() as conn:  # Use transaction
            if action_type == "update_item_approval":
                # Use SQL function for execution
                sql_query = "SELECT execute_update_item_approval(:item_id, :role, :status)"
                params = {
                    "item_id": sql_params["item_id"],
                    "role": sql_params["role"],
                    "status": sql_params["status"]
                }
                result = conn.execute(text(sql_query), params)
                success = result.scalar()
                _log_sql_query("execute_update_item_approval", sql_query, params, 1 if success else 0)
                
            elif action_type == "add_replacement_url":
                # The preview function stores approval_id, but execution function needs item_id
                # Get item_id from preview_data, role from field_path, url from sql_params
                item_id = preview_data.get("item_id")
                role = preview_data.get("field_path", "").split(".")[1] if "." in preview_data.get("field_path", "") else sql_params.get("role")
                url = sql_params.get("url")
                
                if not item_id:
                    raise ValueError("item_id not found in preview data")
                if not role:
                    raise ValueError("role not found in preview data or sql_params")
                if not url:
                    raise ValueError("url not found in sql_params")
                
                sql_query = "SELECT execute_add_replacement_url(:item_id, :role, :url)"
                params = {
                    "item_id": item_id,
                    "role": role,
                    "url": url
                }
                result = conn.execute(text(sql_query), params)
                success = result.scalar()
                _log_sql_query("execute_add_replacement_url", sql_query, params, 1 if success else 0)
                
            elif action_type == "remove_replacement_url":
                # The preview function stores approval_id, but execution function needs item_id
                # Get item_id from preview_data, role from field_path, url from sql_params
                item_id = preview_data.get("item_id")
                role = preview_data.get("field_path", "").split(".")[1] if "." in preview_data.get("field_path", "") else sql_params.get("role")
                url = sql_params.get("url")
                
                if not item_id:
                    raise ValueError("item_id not found in preview data")
                if not role:
                    raise ValueError("role not found in preview data or sql_params")
                if not url:
                    raise ValueError("url not found in sql_params")
                
                sql_query = "SELECT execute_remove_replacement_url(:item_id, :role, :url)"
                params = {
                    "item_id": item_id,
                    "role": role,
                    "url": url
                }
                result = conn.execute(text(sql_query), params)
                success = result.scalar()
                _log_sql_query("execute_remove_replacement_url", sql_query, params, 1 if success else 0)
                
            elif action_type == "update_item_field":
                # For generic field updates, execute SQL directly (but through function)
                # Use CAST instead of ::jsonb for SQLAlchemy compatibility
                # sql_params["new_value"] is already the actual value from the preview SQL function
                # The SQL function expects JSONB, so we need to convert the value to JSON
                # For strings: json.dumps("sink_ref") -> "\"sink_ref\"" (JSON string)
                # PostgreSQL JSONB will parse this and the SQL function extracts with ::text
                # But ::text on a JSONB string gives the string WITH quotes, so we need to extract properly
                new_value_param = sql_params["new_value"]
                
                # Convert to JSON string for JSONB
                # The SQL function does (p_new_value)::text which extracts text from JSONB
                # For a JSONB string "sink_ref", ::text gives "sink_ref" (the string value)
                # So we need to pass it as a JSON string
                new_value_json = json.dumps(new_value_param)
                
                sql_query = "SELECT execute_update_item_field(:item_id, :field_name, CAST(:new_value AS jsonb))"
                params = {
                    "item_id": sql_params["item_id"],
                    "field_name": preview_data["field_path"],
                    "new_value": new_value_json
                }
                result = conn.execute(text(sql_query), params)
                success = result.scalar()
                _log_sql_query("execute_update_item_field", sql_query, params, 1 if success else 0)
                
            else:
                raise ValueError(f"Unknown action type: {action_type}")
            
            # Transaction commits automatically on success
            _mark_action_executed(action_id, {"success": success})
            
            return {
                "status": "success",
                "action_id": action_id,
                "result": {"success": success},
                "preview": preview_data
            }
            
    except Exception as e:
        # Transaction rolls back automatically on exception
        raise ValueError(f"Failed to execute action: {str(e)}")


def get_action_preview(action_id: str) -> Optional[Dict[str, Any]]:
    """Get stored action preview by ID"""
    stored_action = _get_stored_action(action_id)
    if not stored_action:
        return None
    
    return {
        "action_id": action_id,
        "preview": stored_action["preview"],
        "executed": stored_action["executed"],
        "expires_at": stored_action["expires_at"].isoformat()
    }

