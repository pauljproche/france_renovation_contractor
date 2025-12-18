# Accessing PostgreSQL Tables in Docker

## Quick Commands

### List All Tables
```bash
docker exec france-renovation-db psql -U postgres -d france_renovation -c "\dt"
```

### List Tables with Details
```bash
docker exec france-renovation-db psql -U postgres -d france_renovation -c "\dt+"
```

### View Table Structure
```bash
docker exec france-renovation-db psql -U postgres -d france_renovation -c "\d table_name"
```

### Connect to Interactive Shell
```bash
docker exec -it france-renovation-db psql -U postgres -d france_renovation
```

Once in the interactive shell, you can use PostgreSQL commands:
- `\dt` - List tables
- `\d table_name` - Describe table structure
- `\di` - List indexes
- `\df` - List functions
- `SELECT * FROM table_name LIMIT 10;` - View data
- `\q` - Quit

## Query Examples

### Count Records in Each Table
```bash
docker exec france-renovation-db psql -U postgres -d france_renovation -c "
SELECT 
    schemaname,
    tablename,
    (SELECT COUNT(*) FROM information_schema.tables t2 WHERE t2.table_schema = t.schemaname AND t2.table_name = t.tablename) as row_count
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY tablename;"
```

### View All Tables and Row Counts
```bash
docker exec france-renovation-db psql -U postgres -d france_renovation -c "
SELECT 
    table_name,
    (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::int AS row_count
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;"
```

### View Data from a Specific Table
```bash
# View projects
docker exec france-renovation-db psql -U postgres -d france_renovation -c "SELECT * FROM projects LIMIT 5;"

# View items
docker exec france-renovation-db psql -U postgres -d france_renovation -c "SELECT id, product, price_ttc FROM items LIMIT 5;"

# View sections
docker exec france-renovation-db psql -U postgres -d france_renovation -c "SELECT * FROM sections;"
```

### View Indexes
```bash
docker exec france-renovation-db psql -U postgres -d france_renovation -c "\di"
```

### View Foreign Keys
```bash
docker exec france-renovation-db psql -U postgres -d france_renovation -c "
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;"
```

## Using GUI Tools

### pgAdmin (Recommended)
1. Install pgAdmin: https://www.pgadmin.org/download/
2. Add new server:
   - **Host**: `localhost`
   - **Port**: `5432`
   - **Database**: `france_renovation`
   - **Username**: `postgres`
   - **Password**: `postgres`

### DBeaver (Free, Cross-platform)
1. Install DBeaver: https://dbeaver.io/download/
2. Create new PostgreSQL connection:
   - **Host**: `localhost`
   - **Port**: `5432`
   - **Database**: `france_renovation`
   - **Username**: `postgres`
   - **Password**: `postgres`

### VS Code Extension
- Install "PostgreSQL" extension by Chris Kolkman
- Connect using: `postgresql://postgres:postgres@localhost:5432/france_renovation`

## Container Management

### View Container Logs
```bash
docker logs france-renovation-db
```

### Execute SQL File
```bash
docker exec -i france-renovation-db psql -U postgres -d france_renovation < script.sql
```

### Backup Database
```bash
docker exec france-renovation-db pg_dump -U postgres france_renovation > backup.sql
```

### Restore Database
```bash
docker exec -i france-renovation-db psql -U postgres -d france_renovation < backup.sql
```
