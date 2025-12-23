# Phase 3 Manual Testing Steps

## ✅ Testing with USE_DATABASE=false (Current - Safe)

This is the **backward-compatible mode**. Nothing will break.

### Test Steps:

1. **Open Frontend:**
   - Navigate to http://localhost:5173
   - Check browser console (F12)

2. **Verify API Fallback:**
   - Projects/Workers should load from localStorage
   - Console should show: "API returned 501 - database not enabled, using localStorage"
   - App should work normally

3. **Test Frontend Test Page:**
   - Open: test_frontend_phase3.html in browser
   - Click "Run All Tests"
   - All tests should pass

## ⚠️ Testing with USE_DATABASE=true (Optional - Safe)

**This will NOT break anything!** Phase 3 is designed to work both ways.

### What happens when you enable database:

- ✅ **Backend reads from database** (instead of JSON)
- ✅ **Backend still writes to JSON** (dual-write backup)
- ✅ **Frontend reads from API** (instead of localStorage)
- ✅ **Frontend still writes to localStorage** (backup)

### How to test safely:

1. **Ensure database is running:**
   ```bash
   docker ps | grep postgres
   # Or check your database connection
   ```

2. **Enable database:**
   ```bash
   # In backend/.env
   USE_DATABASE=true
   ```

3. **Restart backend:**
   ```bash
   # Stop current backend (Ctrl+C or kill process)
   cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000
   ```

4. **Verify it works:**
   - Check backend logs - should show no errors
   - Test API: `curl http://localhost:8000/api/projects` should return 200 (not 501)
   - Refresh frontend - should load projects from API

5. **Disable database (revert):**
   ```bash
   # In backend/.env
   USE_DATABASE=false
   # Restart backend
   ```

### Safety Guarantees:

- ✅ **No data loss**: JSON files are still updated as backup
- ✅ **Reversible**: Can switch back to USE_DATABASE=false anytime
- ✅ **Graceful fallback**: If database fails, system falls back to JSON/localStorage
- ✅ **Demo data preserved**: Demo projects/workers are hardcoded, never touched

## Manual Test Scenarios

### Scenario 1: Basic Frontend Load (USE_DATABASE=false)
1. Open http://localhost:5173
2. ✅ Should see login/landing page
3. ✅ Should see demo projects after login
4. ✅ Materials page should load
5. ✅ No console errors

### Scenario 2: API Fallback (USE_DATABASE=false)
1. Open browser console (F12)
2. Navigate to Dashboard
3. ✅ Console shows: "API returned 501 - database not enabled, using localStorage"
4. ✅ Projects load from localStorage
5. ✅ App functions normally

### Scenario 3: Create Project (USE_DATABASE=false)
1. Create a new project via frontend
2. ✅ Project appears in UI
3. ✅ Project saved to localStorage
4. ✅ Refresh page - project still there

### Scenario 4: With Database Enabled (USE_DATABASE=true)
1. Set USE_DATABASE=true
2. Restart backend
3. Open frontend
4. ✅ Console shows API calls succeed (no 501)
5. ✅ Projects load from database via API
6. ✅ Create project - saves to both DB and localStorage
7. ✅ Disable database - app still works (uses localStorage)

### Scenario 5: Materials Update (Both modes)
1. Go to Materials page
2. Edit a price or approval
3. ✅ Change saves
4. ✅ (With DB) Verify in database
5. ✅ Verify materials.json updated

