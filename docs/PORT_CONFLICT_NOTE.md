# PostgreSQL Port Conflict Resolution

## Issue

If you see errors like `FATAL: role "postgres" does not exist` when trying to connect to the Docker PostgreSQL container, it's likely because a local PostgreSQL service is running on port 5432 and intercepting connections.

## Solution

### Option 1: Stop Local PostgreSQL Service (Recommended)

**macOS:**
```bash
# Check if PostgreSQL is running
brew services list | grep postgresql

# Stop it
brew services stop postgresql
# OR
sudo launchctl unload -w /Library/LaunchDaemons/com.edb.launchd.postgresql-*.plist 2>/dev/null
```

**Linux:**
```bash
sudo systemctl stop postgresql
```

### Option 2: Use Different Port for Docker

Modify the Docker container to use a different port:

```bash
# Stop and remove existing container
docker stop france-renovation-db
docker rm france-renovation-db

# Start with different port (e.g., 5433)
docker run --name france-renovation-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=france_renovation \
  -e POSTGRES_USER=postgres \
  -p 5433:5432 \
  -v france-renovation-data:/var/lib/postgresql/data \
  -d postgres:15
```

Then update `DATABASE_URL` in `.env`:
```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/france_renovation
```

### Verify Docker Container is Accessible

```bash
# This should work regardless of local PostgreSQL
docker exec france-renovation-db psql -U postgres -d france_renovation -c "SELECT version();"
```

## For Migration

Once the port conflict is resolved, you can run:

```bash
cd backend
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/france_renovation"
alembic revision --autogenerate -m "Initial schema"
alembic upgrade head
```

