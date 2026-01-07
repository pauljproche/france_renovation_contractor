# Quick Start: Phase 5 Setup

## ⚠️ Docker Required

Phase 5 requires Docker to be running. Please start Docker Desktop first.

## Option 1: Automated Setup (Recommended)

```bash
# 1. Start Docker Desktop
# 2. Wait for Docker to be ready
# 3. Run setup script:
cd backend/scripts
./setup_phase5.sh
```

## Option 2: Manual Setup

### Step 1: Start Database

```bash
# Start Docker Desktop first, then:

# Check if container exists
docker ps -a | grep france-renovation-db

# If exists but stopped:
docker start france-renovation-db

# If doesn't exist:
docker run -d \
  --name france-renovation-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=france_renovation \
  -p 5432:5432 \
  postgres:15

# Wait for ready (10-20 seconds)
docker exec france-renovation-db pg_isready -U postgres
```

### Step 2: Apply SQL Functions

```bash
cd backend/scripts
docker exec -i france-renovation-db psql -U postgres -d france_renovation < ../sql_functions/agent_functions.sql
```

### Step 3: Create Agent Role

```bash
docker exec -i france-renovation-db psql -U postgres -d france_renovation < setup_agent_role.sql
```

### Step 4: Update .env

Add to `backend/.env`:

```bash
AGENT_DATABASE_URL=postgresql://agent_user:change_me_in_production@localhost:5432/france_renovation
USE_DATABASE=true
```

### Step 5: Test

```bash
# Test agent role can query
docker exec france-renovation-db psql -U agent_user -d france_renovation -c "SELECT * FROM get_items_needing_validation('client') LIMIT 1;"
```

## Current Status

Since Docker is not currently running, please:

1. **Start Docker Desktop**
2. **Run the setup script**: `cd backend/scripts && ./setup_phase5.sh`
3. **Update .env** with AGENT_DATABASE_URL
4. **Test the backend**

See `PHASE5_SETUP_INSTRUCTIONS.md` for detailed instructions.


