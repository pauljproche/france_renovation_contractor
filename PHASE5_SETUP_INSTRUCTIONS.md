# Phase 5 Setup Instructions

## Prerequisites

1. **Docker Desktop must be running**
   - Open Docker Desktop application
   - Wait for it to fully start (whale icon in menu bar)

2. **Database container must exist**
   - If you completed Phase 4, the container should already exist
   - If not, create it first (see below)

## Quick Setup (Automated)

Run the automated setup script:

```bash
cd backend/scripts
./setup_phase5.sh
```

This script will:
1. ✅ Check Docker is running
2. ✅ Start database container if needed
3. ✅ Apply SQL functions
4. ✅ Create agent_user role
5. ✅ Verify setup

## Manual Setup

If you prefer to do it manually:

### Step 1: Start Docker and Database

```bash
# Start Docker Desktop first, then:

# Check if container exists
docker ps -a | grep france-renovation-db

# If container exists but is stopped, start it:
docker start france-renovation-db

# If container doesn't exist, create it:
docker run -d \
  --name france-renovation-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=france_renovation \
  -p 5432:5432 \
  postgres:15

# Wait for PostgreSQL to be ready (10-20 seconds)
docker exec france-renovation-db pg_isready -U postgres
```

### Step 2: Apply SQL Functions

```bash
cd backend/scripts
./apply_agent_functions.sh
```

Or manually:
```bash
docker exec -i france-renovation-db psql -U postgres -d france_renovation < ../sql_functions/agent_functions.sql
```

### Step 3: Create Agent Role

```bash
docker exec -i france-renovation-db psql -U postgres -d france_renovation < setup_agent_role.sql
```

### Step 4: Update .env File

Add to `backend/.env`:

```bash
# Agent database connection (restricted role)
AGENT_DATABASE_URL=postgresql://agent_user:change_me_in_production@localhost:5432/france_renovation

# Main database connection (full privileges)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/france_renovation

# Enable database mode
USE_DATABASE=true
```

**Important**: Update the password in production:
```bash
docker exec -it france-renovation-db psql -U postgres -d france_renovation -c "ALTER ROLE agent_user WITH PASSWORD 'secure_password';"
```

Then update `AGENT_DATABASE_URL` in `.env` with the new password.

### Step 5: Verify Setup

```bash
# Check functions exist
docker exec france-renovation-db psql -U postgres -d france_renovation -c "\df" | grep -E "(preview|get_|search_|execute_)"

# Check role exists
docker exec france-renovation-db psql -U postgres -d france_renovation -c "\du agent_user"

# Test agent connection (should work)
docker exec france-renovation-db psql -U agent_user -d france_renovation -c "SELECT * FROM get_items_needing_validation('client') LIMIT 1;"
```

## Testing

### Test 1: Verify Agent Role Permissions

```bash
# Connect as agent_user
docker exec -it france-renovation-db psql -U agent_user -d france_renovation

# Try direct INSERT (should FAIL)
INSERT INTO items (section_id, product) VALUES ('test', 'test');
# Expected: ERROR: permission denied for table items

# Try function execution (should SUCCEED)
SELECT * FROM get_items_needing_validation('client') LIMIT 1;
# Expected: Returns results
```

### Test 2: Test Preview Function

```python
# In Python shell or test script
from backend.services import agent_tools

# Test preview (should return preview, not execute)
preview = agent_tools.preview_update_item_approval(
    item_id=1,
    role="client",
    status="approved"
)

print(f"Action ID: {preview['action_id']}")
print(f"NLP: {preview['preview']['nlp']}")
print(f"SQL: {preview['preview']['sql']['query']}")
```

### Test 3: Test Backend API

```bash
# Start backend
cd backend
python -m uvicorn main:app --reload

# In another terminal, test query endpoint
curl -X POST http://localhost:8000/api/assistant/query \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What items need client validation?",
    "language": "en"
  }'
```

## Troubleshooting

### Docker not running
- Open Docker Desktop
- Wait for it to fully start
- Run `docker ps` to verify

### Container not found
- Create container using command in Step 1
- Or check if it has a different name: `docker ps -a`

### Permission denied errors
- Verify agent_user role was created: `docker exec france-renovation-db psql -U postgres -d france_renovation -c "\du agent_user"`
- Re-run setup_agent_role.sql if needed

### Functions not found
- Verify SQL file was applied: `docker exec france-renovation-db psql -U postgres -d france_renovation -c "\df" | grep preview`
- Re-run apply_agent_functions.sh if needed

### Connection errors
- Check DATABASE_URL and AGENT_DATABASE_URL in .env
- Verify database is running: `docker ps | grep france-renovation-db`
- Check port 5432 is not in use: `lsof -i :5432`

## Next Steps After Setup

1. ✅ Test agent query tools
2. ✅ Test preview generation
3. ✅ Test confirmation flow
4. ✅ Verify token reduction
5. Proceed to Phase 6: Remove JSON writes


