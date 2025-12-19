# Docker PostgreSQL Setup

This guide explains how to set up the PostgreSQL database using Docker for development.

## Prerequisites

- Docker installed and running
- Docker daemon accessible

## Quick Start

### 1. Start PostgreSQL Container

```bash
# Start PostgreSQL in Docker (first time)
docker run --name france-renovation-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=france_renovation \
  -e POSTGRES_USER=postgres \
  -p 5432:5432 \
  -v france-renovation-data:/var/lib/postgresql/data \
  -d postgres:15

# Verify container is running
docker ps | grep france-renovation-db
```

### 2. Stop Database

```bash
docker stop france-renovation-db
```

### 3. Start Existing Container

```bash
docker start france-renovation-db
```

### 4. Remove Database (Fresh Start)

⚠️ **WARNING**: This will delete all data!

```bash
docker stop france-renovation-db
docker rm -v france-renovation-db
```

Then run the `docker run` command again from step 1.

## Connection Details

- **Host**: localhost
- **Port**: 5432
- **Database**: france_renovation
- **User**: postgres
- **Password**: postgres (change in production!)

## Verify Connection

```bash
# Using psql (if installed)
psql -h localhost -U postgres -d france_renovation

# Or using docker exec
docker exec -it france-renovation-db psql -U postgres -d france_renovation
```

## Environment Variables

Add to `backend/.env`:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/france_renovation
USE_DATABASE=false  # Set to true when ready to use database
```

## Troubleshooting

### Container won't start
- Check if port 5432 is already in use: `lsof -i :5432`
- Check Docker daemon is running: `docker ps`

### Can't connect
- Verify container is running: `docker ps`
- Check logs: `docker logs france-renovation-db`
- Verify credentials match `.env` file

### Data persistence
- Data is stored in Docker volume `france-renovation-data`
- Volume persists even if container is removed (unless using `-v` flag)
- To completely remove data: `docker volume rm france-renovation-data`

## Why Docker?

- **Environment parity** with AWS RDS production
- **Easy cleanup** and reset during development
- **Consistent** across team members
- **Same PostgreSQL version** (15) as production

