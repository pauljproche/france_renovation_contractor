# Phase 3 Manual Testing Guide

This guide provides step-by-step instructions for manually testing Phase 3 implementation.

## Prerequisites

1. **Backend running**: `cd backend && python main.py`
2. **Frontend running**: `cd frontend && npm run dev`
3. **Database accessible**: Ensure Docker PostgreSQL is running (if using database)

## Test Scenarios

### Test 1: Verify App Still Runs (USE_DATABASE=false)

**Goal**: Ensure the app works without database (backward compatibility)

1. Ensure `USE_DATABASE=false` in `backend/.env` (or not set)
2. Start backend: `cd backend && python main.py`
3. Start frontend: `cd frontend && npm run dev`
4. Open browser to `http://localhost:5173`
5. **Expected**: App loads normally, shows demo projects, materials page works

**Check**:
- [ ] Landing page loads
- [ ] Login works
- [ ] Dashboard shows demo projects
- [ ] Materials page loads and shows data
- [ ] No console errors

---

### Test 2: API Endpoints Return 501 When DB Disabled

**Goal**: Verify frontend gets proper fallback signal

1. Ensure `USE_DATABASE=false` in `backend/.env`
2. Backend should be running
3. Test endpoints:

```bash
# Projects endpoint should return 501
curl http://localhost:8000/api/projects

# Workers endpoint should return 501
curl http://localhost:8000/api/workers

# Materials endpoint should work (always reads from JSON)
curl http://localhost:8000/api/materials
```

**Expected**:
- [ ] `/api/projects` returns `{"detail": "Database not enabled. Use localStorage."}` with status 501
- [ ] `/api/workers` returns `{"detail": "Database not enabled. Use localStorage."}` with status 501
- [ ] `/api/materials` returns materials data with status 200

---

### Test 3: Enable Database and Test Dual-Write

**Goal**: Verify dual-write works correctly

1. Set `USE_DATABASE=true` in `backend/.env`
2. Restart backend server
3. Open browser console (F12) to monitor network requests

#### Test 3a: Create Project via Frontend

1. Navigate to Dashboard
2. Create a new project (if UI has create button)
3. Or use API directly:

```bash
curl -X POST http://localhost:8000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project Phase 3",
    "address": "123 Test St",
    "status": "draft"
  }'
```

4. **Check**:
   - [ ] API returns project data (status 200)
   - [ ] Project appears in frontend (if created via UI)
   - [ ] Verify in database:
     ```sql
     SELECT * FROM projects WHERE name = 'Test Project Phase 3';
     ```

#### Test 3b: Update Materials via Frontend

1. Navigate to Materials page
2. Edit a material (e.g., change price, approval status)
3. Save changes
4. **Check**:
   - [ ] Change appears in UI
   - [ ] Verify in database:
     ```sql
     SELECT * FROM items WHERE product = '<your product name>';
     ```
   - [ ] Verify JSON backup updated:
     ```bash
     # Check materials.json has the change
     cat data/materials.json | grep -A 10 "<your product name>"
     ```

#### Test 3c: Verify Dual-Write (DB First, Then JSON)

1. Make a change to materials
2. **Check database immediately**:
   ```sql
   SELECT updated_at, product FROM items ORDER BY updated_at DESC LIMIT 5;
   ```
3. **Check JSON file**:
   ```bash
   ls -la data/materials.json  # Check modification time
   ```
4. **Expected**:
   - [ ] Database has the change
   - [ ] JSON file also has the change (after DB write succeeds)

---

### Test 4: Frontend Fallback Behavior

**Goal**: Verify frontend gracefully handles API failures

#### Test 4a: API Unavailable (Backend Stopped)

1. Stop backend server
2. Open frontend in browser
3. Try to load projects/workers
4. **Expected**:
   - [ ] Frontend falls back to localStorage
   - [ ] No error crashes
   - [ ] Console shows fallback message
   - [ ] Data still displays (from localStorage)

#### Test 4b: API Returns 501 (DB Disabled)

1. Set `USE_DATABASE=false` in `backend/.env`
2. Restart backend
3. Refresh frontend
4. **Expected**:
   - [ ] Projects load from localStorage
   - [ ] Workers load from localStorage
   - [ ] Demo projects still appear
   - [ ] Console shows fallback message

---

### Test 5: Demo Data Preservation

**Goal**: Verify demo projects/workers are not lost

1. With `USE_DATABASE=true`
2. Navigate to Dashboard
3. **Expected**:
   - [ ] Demo projects appear (hardcoded)
   - [ ] Projects from database also appear
   - [ ] No duplicates
   - [ ] Timeline demo projects visible

4. Navigate to Workers page
5. **Expected**:
   - [ ] Demo workers appear (hardcoded)
   - [ ] Workers from database also appear
   - [ ] No duplicates

---

### Test 6: Transaction Atomicity

**Goal**: Verify DB failures don't cause partial writes

#### Test 6a: Simulate DB Failure

1. Stop database (Docker stop)
2. Try to create/update via API:
   ```bash
   curl -X POST http://localhost:8000/api/projects \
     -H "Content-Type: application/json" \
     -d '{"name": "Should Fail"}'
   ```
3. **Expected**:
   - [ ] API returns error (status 500)
   - [ ] JSON file NOT updated (transaction rolled back)
   - [ ] No partial data in database

#### Test 6b: JSON Write Failure (DB Succeeds)

This is harder to simulate, but check logs:
- [ ] If JSON write fails, warning logged
- [ ] Data still in database (primary source)
- [ ] App continues to work

---

### Test 7: Materials update_cell with Database

**Goal**: Verify individual cell updates work with database

1. Set `USE_DATABASE=true`
2. Use AI assistant or manual edit to update a material field
3. **Check**:
   - [ ] Update succeeds
   - [ ] Database updated
   - [ ] JSON backup updated
   - [ ] Edit history logged

---

### Test 8: Workers CRUD Operations

**Goal**: Verify workers API endpoints work correctly

1. Set `USE_DATABASE=true`
2. Test via API:

```bash
# Create worker
curl -X POST http://localhost:8000/api/workers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Worker",
    "email": "test@example.com",
    "jobs": []
  }'

# Get workers
curl http://localhost:8000/api/workers

# Update worker (use ID from response)
curl -X PUT http://localhost:8000/api/workers/<worker-id> \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Worker"}'

# Delete worker
curl -X DELETE http://localhost:8000/api/workers/<worker-id>
```

**Expected**:
- [ ] All operations return appropriate status codes
- [ ] Worker appears/disappears in frontend
- [ ] Changes persist in database

---

## Verification Checklist

After running all tests, verify:

- [ ] App runs without database (USE_DATABASE=false)
- [ ] App runs with database (USE_DATABASE=true)
- [ ] API endpoints return 501 when DB disabled
- [ ] API endpoints work when DB enabled
- [ ] Dual-write works (DB and JSON updated)
- [ ] Frontend falls back to localStorage gracefully
- [ ] Demo projects/workers preserved
- [ ] No console errors
- [ ] Database transactions are atomic
- [ ] Materials, projects, and workers all work correctly

---

## Database Verification Queries

Use these SQL queries to verify data in the database:

```sql
-- Check projects
SELECT id, name, address, status FROM projects ORDER BY created_at DESC LIMIT 10;

-- Check workers
SELECT w.user_id, u.email FROM workers w JOIN users u ON w.user_id = u.id LIMIT 10;

-- Check materials (sections and items)
SELECT s.id as section_id, s.label, COUNT(i.id) as item_count 
FROM sections s 
LEFT JOIN items i ON s.id = i.section_id 
GROUP BY s.id, s.label;

-- Check recent updates
SELECT product, updated_at FROM items ORDER BY updated_at DESC LIMIT 10;
```
