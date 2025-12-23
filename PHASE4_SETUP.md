# Phase 4 Setup Instructions

## Prerequisites

Before starting Phase 4, you need:

1. **Database running** (PostgreSQL)
2. **Database has data** (from Phase 2 migration)
3. **USE_DATABASE=true** in backend/.env (✅ Already set)

## Current Status

✅ **USE_DATABASE=true** - Already configured
❌ **Database not running** - Needs to be started

## Step 1: Start Database

### Option A: Docker (Recommended)

If you're using Docker for PostgreSQL:

```bash
# Check if Docker container exists
docker ps -a | grep postgres

# If container exists but stopped, start it:
docker start <container_name>

# Or create and start a new container:
docker run -d \
  --name france-renovation-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=france_renovation \
  -p 5432:5432 \
  postgres:15

# Verify it's running:
docker ps | grep postgres
```

### Option B: Local PostgreSQL

If you have PostgreSQL installed locally:

```bash
# On macOS (Homebrew):
brew services start postgresql@15

# On Linux (systemd):
sudo systemctl start postgresql

# Verify:
psql -U postgres -d france_renovation -c "SELECT COUNT(*) FROM projects;"
```

## Step 2: Verify Database Connection

```bash
# Test connection
cd backend
python -c "
import os
from dotenv import load_dotenv
load_dotenv()
db_url = os.getenv('DATABASE_URL')
print(f'DATABASE_URL: {db_url}')

try:
    import psycopg2
    from urllib.parse import urlparse
    parsed = urlparse(db_url)
    conn = psycopg2.connect(
        host=parsed.hostname,
        port=parsed.port or 5432,
        database=parsed.path[1:],
        user=parsed.username,
        password=parsed.password
    )
    print('✅ Database connection successful!')
    conn.close()
except Exception as e:
    print(f'❌ Connection failed: {e}')
"
```

## Step 3: Start Backend

Once database is running:

```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

## Step 4: Test Phase 4

```bash
# Run automated tests
./test_phase4.sh

# Or manually test:
curl http://localhost:8000/api/projects  # Should return 200 (not 501)
curl http://localhost:8000/api/workers   # Should return 200 (not 501)
```

## Troubleshooting

### Database Connection Refused

**Error**: `connection to server at "127.0.0.1", port 5432 failed: Connection refused`

**Solution**:
- Start PostgreSQL service (see Step 1)
- Check if port 5432 is in use: `lsof -i :5432`
- Verify DATABASE_URL in `backend/.env` is correct

### Backend Won't Start with USE_DATABASE=true

**Error**: `ImportError: Cannot import database module`

**Solution**:
- Ensure database is running (see Step 1)
- Ensure `psycopg2` is installed: `pip install psycopg2-binary`
- Check backend logs for connection errors

### API Still Returns 501

**Error**: API returns 501 even with USE_DATABASE=true

**Solution**:
- Verify `USE_DATABASE=true` in `backend/.env`
- Restart backend after changing .env
- Check backend logs: `tail -f /tmp/backend_phase4.log`

## Next Steps After Database is Running

1. ✅ Database running
2. ✅ Backend started with USE_DATABASE=true
3. ✅ API endpoints return 200 (not 501)
4. ✅ Test frontend works
5. ✅ Performance testing
6. ✅ Phase 4 complete!
