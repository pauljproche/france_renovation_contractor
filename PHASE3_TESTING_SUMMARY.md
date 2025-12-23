# Phase 3 Testing Summary

## Quick Start Testing

### 1. Automated Test Script

Run the automated test script:

```bash
./test_phase3.sh
```

This script will:
- Check if backend is running
- Test API endpoints
- Verify JSON files exist
- Report test results

### 2. Manual Testing Steps

#### Test A: App Runs Without Database (Backward Compatibility)

1. **Ensure database is disabled:**
   ```bash
   # In backend/.env (or create it)
   USE_DATABASE=false
   ```

2. **Start the app:**
   ```bash
   ./start_app.sh
   # OR manually:
   # Terminal 1: cd backend && python main.py
   # Terminal 2: cd frontend && npm run dev
   ```

3. **Verify:**
   - Open http://localhost:5173
   - App loads normally
   - Demo projects appear
   - Materials page works
   - No errors in console

#### Test B: API Endpoints Return 501 When DB Disabled

With `USE_DATABASE=false`, test these endpoints:

```bash
# Should return 501 (Database not enabled)
curl http://localhost:8000/api/projects
curl http://localhost:8000/api/workers

# Should return 200 (always works, reads from JSON)
curl http://localhost:8000/api/materials
```

**Expected**: Projects and Workers return 501, Materials returns 200

#### Test C: Enable Database and Test Dual-Write

1. **Enable database:**
   ```bash
   # In backend/.env
   USE_DATABASE=true
   ```

2. **Restart backend**

3. **Test creating a project:**
   ```bash
   curl -X POST http://localhost:8000/api/projects \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Project",
       "address": "123 Test St",
       "status": "draft"
     }'
   ```

4. **Verify in database:**
   ```sql
   -- Connect to PostgreSQL
   psql -U postgres -d france_renovation
   
   -- Check project was created
   SELECT id, name, address, status FROM projects ORDER BY created_at DESC LIMIT 5;
   ```

5. **Update materials via frontend:**
   - Go to Materials page
   - Edit a price or approval status
   - Save
   - Verify both DB and JSON were updated

#### Test D: Frontend Fallback

1. **Stop backend server** (Ctrl+C)

2. **Refresh frontend** (F5)

3. **Expected**:
   - Projects/workers load from localStorage
   - No error crashes
   - Console shows fallback messages
   - App continues to work

#### Test E: Demo Data Preservation

1. With `USE_DATABASE=true`
2. Check Dashboard:
   - Demo projects appear (hardcoded)
   - Projects from DB also appear
   - No duplicates
3. Check Workers page:
   - Demo workers appear (hardcoded)
   - Workers from DB also appear

## Key Test Points

### ✅ Must Pass:

- [x] Backend imports successfully
- [ ] App runs without database (USE_DATABASE=false)
- [ ] App runs with database (USE_DATABASE=true)
- [ ] API returns 501 when DB disabled
- [ ] API works when DB enabled
- [ ] Dual-write updates both DB and JSON
- [ ] Frontend falls back to localStorage
- [ ] Demo projects/workers preserved
- [ ] No console errors
- [ ] Materials updates work via API and frontend
- [ ] Projects CRUD works
- [ ] Workers CRUD works

### 🔍 Detailed Testing:

See `test_phase3_manual.md` for comprehensive manual testing guide.

## Troubleshooting

### Backend won't start
- Check Python dependencies: `cd backend && pip install -r requirements.txt`
- Check database connection: `USE_DATABASE=true` requires PostgreSQL running
- Check port 8000 is available

### Frontend won't start
- Check Node dependencies: `cd frontend && npm install`
- Check port 5173 is available

### API returns errors
- Check `USE_DATABASE` setting in `backend/.env`
- Check backend logs: `logs/backend.log`
- Check database is running (if USE_DATABASE=true)

### Database connection errors
- Ensure Docker PostgreSQL is running: `docker ps`
- Check DATABASE_URL in `backend/.env`
- Verify database exists: `psql -U postgres -d france_renovation`

## Next Steps

Once all tests pass:
1. Review test results
2. Document any issues
3. Fix any bugs
4. Proceed to Phase 4 (Read from Database)
