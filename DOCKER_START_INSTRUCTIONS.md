# Docker Database Setup for Phase 4

## Step 1: Start Docker Desktop

1. **Open Docker Desktop** application on your Mac
2. **Wait for Docker to fully start** - you'll see the Docker whale icon in your menu bar
3. Verify Docker is running:
   ```bash
   docker ps
   ```
   Should show an empty list (not an error)

## Step 2: Start PostgreSQL Container

Once Docker is running, execute:

```bash
docker run -d \
  --name france-renovation-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=france_renovation \
  -p 5432:5432 \
  postgres:15
```

## Step 3: Verify Container is Running

```bash
docker ps | grep france-renovation-db
```

Should show the container is running.

## Step 4: Wait for PostgreSQL to be Ready

PostgreSQL takes a few seconds to initialize:

```bash
# Check if ready (may take 10-20 seconds)
docker exec france-renovation-db pg_isready -U postgres
```

Once it returns `accepting connections`, you're ready!

## Step 5: Verify Database Has Schema

If this is a fresh container, you'll need to run migrations. Check if tables exist:

```bash
docker exec france-renovation-db psql -U postgres -d france_renovation -c "\dt"
```

If no tables, you'll need to run Phase 1 migrations first.

## Quick Start Script

Save this as `start_docker_db.sh`:

```bash
#!/bin/bash
echo "Starting PostgreSQL container..."
docker run -d \
  --name france-renovation-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=france_renovation \
  -p 5432:5432 \
  postgres:15

echo "Waiting for PostgreSQL to be ready..."
for i in {1..20}; do
  if docker exec france-renovation-db pg_isready -U postgres > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready!"
    break
  fi
  echo "Waiting... ($i/20)"
  sleep 1
done

echo "Database is ready at: postgresql://postgres:postgres@localhost:5432/france_renovation"
```

Run with: `chmod +x start_docker_db.sh && ./start_docker_db.sh`

## Troubleshooting

### Container Already Exists

If you see "container name already in use":

```bash
# Remove old container
docker rm -f france-renovation-db

# Then run the docker run command again
```

### Port Already in Use

If port 5432 is already in use:

```bash
# Check what's using it
lsof -i :5432

# Use a different port (e.g., 5433):
docker run -d \
  --name france-renovation-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=france_renovation \
  -p 5433:5432 \
  postgres:15

# Then update DATABASE_URL in backend/.env to use port 5433
```

### Container Won't Start

Check logs:
```bash
docker logs france-renovation-db
```

