# pgAdmin 4 Setup for Docker PostgreSQL

pgAdmin 4 has been installed and is ready to use!

## Quick Start

1. **Open pgAdmin 4**
   - Open from Applications folder, or
   - Use Spotlight: `Cmd + Space`, type "pgAdmin"

2. **Set Master Password** (first time only)
   - pgAdmin will prompt for a master password
   - This protects your saved server passwords
   - Choose a secure password and remember it

3. **Add New Server**

   Right-click "Servers" → "Register" → "Server..."

   **General Tab:**
   - **Name**: `France Renovation (Docker)`

   **Connection Tab:**
   - **Host name/address**: `localhost`
   - **Port**: `5432`
   - **Maintenance database**: `france_renovation`
   - **Username**: `postgres`
   - **Password**: `postgres`
   - ☑ **Save password** (optional, but convenient)

   **Click "Save"**

## Your Tables

Once connected, navigate to:
- `Servers` → `France Renovation (Docker)` → `Databases` → `france_renovation` → `Schemas` → `public` → `Tables`

You'll see all 12 tables:
- `alembic_version`
- `approvals`
- `comments`
- `custom_fields`
- `edit_history`
- `items`
- `orders`
- `projects`
- `replacement_urls`
- `sections`
- `worker_jobs`
- `workers`

## Useful Features

### View Table Data
- Right-click table → "View/Edit Data" → "All Rows"
- Or use the Query Tool: Right-click database → "Query Tool"

### Run SQL Queries
1. Right-click `france_renovation` database
2. Select "Query Tool"
3. Write your SQL:
   ```sql
   SELECT * FROM projects;
   SELECT COUNT(*) FROM items;
   SELECT * FROM sections;
   ```
4. Click "Execute" (F5) or "Execute/Refresh" (F5)

### View Table Structure
- Right-click table → "Properties"
- See columns, constraints, indexes, etc.

### Export Data
- Right-click table → "Export/Import" → "Export"
- Choose format (CSV, JSON, etc.)

## Connection Details Summary

```
Host: localhost
Port: 5432
Database: france_renovation
Username: postgres
Password: postgres
```

## Troubleshooting

**Can't connect?**
- Verify Docker container is running: `docker ps | grep france-renovation-db`
- Check port 5432 is not blocked
- Ensure local PostgreSQL service is stopped (if you had one running)

**Connection timeout?**
- Make sure Docker container is running: `./scripts/setup_docker_db.sh status`

**Wrong password?**
- Default password is `postgres`
- To reset: `docker exec -it france-renovation-db psql -U postgres -c "ALTER USER postgres PASSWORD 'newpassword';"`
