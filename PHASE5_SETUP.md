# Phase 5: SQL Functions for Agent Tools - Setup Guide

## Overview

Phase 5 implements secure database access for the AI agent with preview + confirmation system. The agent can query the database and generate previews of write operations, but all writes require user confirmation.

## Key Features

1. **Restricted Database Role**: Agent uses `agent_user` role with SELECT + EXECUTE only (no direct table writes)
2. **SQL Functions**: All agent operations go through SQL functions with permission checks
3. **Preview + Confirmation**: All write operations generate previews that require user confirmation
4. **Query Tools**: Agent can query database directly (no confirmation needed for reads)
5. **Token Reduction**: Agent no longer needs full materials dataset - uses DB queries instead

## Setup Steps

### 1. Apply SQL Functions

```bash
cd backend/scripts
./apply_agent_functions.sh
```

Or manually:
```bash
psql -U postgres -d france_renovation -f backend/sql_functions/agent_functions.sql
```

### 2. Create Restricted Agent Role

```bash
psql -U postgres -d france_renovation -f backend/scripts/setup_agent_role.sql
```

**Important**: Update the password in production:
```sql
ALTER ROLE agent_user WITH PASSWORD 'secure_password';
```

### 3. Configure Environment Variables

Add to `backend/.env`:
```bash
# Agent database connection (restricted role)
AGENT_DATABASE_URL=postgresql://agent_user:change_me_in_production@localhost:5432/france_renovation

# Main database connection (full privileges)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/france_renovation

# Enable database mode
USE_DATABASE=true
```

### 4. Verify Setup

Test agent tools:
```python
from backend.services import agent_tools

# Test query (read-only, no confirmation)
results = agent_tools.query_items_needing_validation("client")
print(f"Found {len(results)} items needing validation")

# Test preview (requires confirmation)
preview = agent_tools.preview_update_item_approval(
    item_id=1,
    role="client",
    status="approved"
)
print(f"Preview generated: {preview['action_id']}")
print(f"NLP: {preview['preview']['nlp']}")
```

## Agent Tools

### Read-Only Query Tools (No Confirmation)

- `query_items_needing_validation(role, project_id=None)` - Get items needing validation
- `query_todo_items(role, project_id=None)` - Get TODO items for a role
- `query_pricing_summary(project_id=None)` - Get pricing summary
- `search_items(product_search, project_id=None)` - Search items by product name

### Preview Functions (Require Confirmation)

- `preview_update_item_approval(item_id, role, status)` - Preview approval update
- `preview_add_replacement_url(item_id, role, url)` - Preview adding URL
- `preview_remove_replacement_url(item_id, role, url)` - Preview removing URL
- `preview_update_item_field(item_id, field_name, new_value, expected_product_hint=None)` - Preview field update

### Confirmation Endpoint

After preview is generated, user must confirm via:
```
POST /api/assistant/confirm-action
{
  "action_id": "generated_action_id"
}
```

## Security Model

1. **Restricted Role**: `agent_user` can only SELECT and EXECUTE functions
2. **No Direct Writes**: Agent cannot INSERT/UPDATE/DELETE directly on tables
3. **Permission Checks**: SQL functions validate inputs and permissions
4. **Preview System**: All writes require user confirmation
5. **SQL Injection Prevention**: All queries use parameterized functions

## Testing

### Test Agent Role Permissions

```sql
-- Connect as agent_user
psql -U agent_user -d france_renovation

-- Should FAIL (no direct INSERT)
INSERT INTO items (section_id, product) VALUES ('test', 'test');

-- Should SUCCEED (can execute functions)
SELECT * FROM get_items_needing_validation('client');
```

### Test Preview + Confirmation

1. Agent calls `preview_update_item_approval()`
2. Returns `action_id` and preview data
3. Frontend shows preview with SQL + NLP
4. User confirms via `/api/assistant/confirm-action`
5. Action executes only after confirmation

## Migration Notes

- `update_cell` tool is kept for backward compatibility
- Agent will prefer preview functions when available
- Full materials dataset still sent but agent should use query tools instead
- System prompt updated to document new tools

## Next Steps

After Phase 5:
- Phase 6: Remove JSON writes (DB-only writes)
- Phase 7: Remove JSON reads (DB-only)
- Phase 8: Testing & Optimization
- Phase 9: Production Deployment

## Troubleshooting

### Agent tools not available

- Check `USE_DATABASE=true` in `.env`
- Verify `AGENT_DATABASE_URL` is set
- Check agent_user role exists and has permissions

### SQL functions not found

- Run `apply_agent_functions.sh` to create functions
- Verify functions exist: `\df` in psql

### Preview not generating

- Check agent_tools.py imports
- Verify SQL functions are created
- Check database connection


