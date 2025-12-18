# Phase 0 Setup Instructions

## ✅ Completed Automatically

- [x] Database dependencies added to `requirements.txt`
- [x] Database connection modules created (`database.py`, `db_session.py`)
- [x] Docker setup script created
- [x] Python dependencies installed (SQLAlchemy 2.0.23, psycopg2-binary 2.9.9, Alembic 1.12.1)
- [x] Database modules verified (imports successfully)

**Note:** Dependencies installed to user site-packages. If using a virtual environment, install with `pip install -r requirements.txt` inside your venv.

## ⚠️ Manual Steps Required

### 1. Start Docker Daemon

**macOS/Linux:**
- Start Docker Desktop application
- Or: `sudo systemctl start docker` (Linux)

**Verify Docker is running:**
```bash
docker ps
```

### 2. Add Database Variables to `.env`

Add these lines to `backend/.env`:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/france_renovation
USE_DATABASE=false
AGENT_DATABASE_URL=postgresql://agent_user:secure_password@localhost:5432/france_renovation
```

**Note:** `.env` file is gitignored, so you need to add these manually.

### 3. Start PostgreSQL Container

Once Docker is running, execute:

```bash
./scripts/setup_docker_db.sh start
```

Or manually:
```bash
docker run --name france-renovation-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=france_renovation \
  -e POSTGRES_USER=postgres \
  -p 5432:5432 \
  -v france-renovation-data:/var/lib/postgresql/data \
  -d postgres:15
```

### 4. Verify Setup

```bash
# Check container status
./scripts/setup_docker_db.sh status

# Test database connection (if psql is installed)
psql -h localhost -U postgres -d france_renovation -c "SELECT version();"
```

## Phase 0 Completion Checklist

- [x] Dependencies installed
- [x] Database modules created
- [ ] Docker daemon running
- [ ] `.env` file configured
- [ ] PostgreSQL container running
- [ ] Database connection verified

**Once all checkboxes are complete, Phase 0 is done and ready for Phase 1!**
