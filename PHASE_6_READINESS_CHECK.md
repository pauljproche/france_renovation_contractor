# Phase 6 Readiness Check

## Phase 6: Remove JSON Writes (DB-Only Writes)

**Goal**: Stop dual-write, write only to database. JSON becomes read-only backup.

## Prerequisites for Phase 6

### ✅ Phase 4 Must Be Working
- [x] `USE_DATABASE=true` is set in `.env`
- [ ] **Backend server restarted** (to pick up the flag)
- [ ] **Database reads verified** (backend logs show DB reads, not JSON fallback)
- [ ] **Frontend works correctly** with database reads
- [ ] **No critical errors** in production

### ✅ Phase 5 Must Be Complete
- [x] SQL functions exist in database
- [x] Agent tools service implemented
- [x] Agent uses SQL functions

### Current Status Check

**Phase 4 Status**: ⚠️ **NEEDS VERIFICATION**
- ✅ `USE_DATABASE=true` is set
- ❓ Backend may not be restarted yet (logs show JSON fallback)
- ❓ Database reads not yet verified

**Current Code State**:
- `write_materials_data()` still has dual-write logic (writes to both DB and JSON)
- All API endpoints still write to JSON as backup

## What Phase 6 Requires

1. **Remove JSON Writes**
   - Update `write_materials_data()` to write DB only
   - Remove JSON writes from all API endpoints
   - Keep JSON read as fallback (for safety)

2. **Add Database Transactions**
   - Wrap all writes in transactions
   - Ensure atomicity (all or nothing)
   - Proper error handling with rollback

3. **Testing**
   - Verify writes go to DB only
   - Verify JSON file is not modified
   - Test transactions and rollback

## Recommendation

**NOT READY YET** - You should:

1. **First verify Phase 4 is working**:
   ```bash
   # Restart backend server
   # Check logs - should see database reads, not JSON fallback
   # Test API endpoints return data from database
   # Verify frontend works correctly
   ```

2. **Run Phase 4 for a while**:
   - Let it run in production/staging
   - Monitor for any issues
   - Ensure stability before removing JSON writes

3. **Then proceed to Phase 6**:
   - Once Phase 4 is stable and verified
   - Remove JSON writes
   - Add proper transactions
   - Test thoroughly

## Risk Assessment

**Phase 6 Risk**: Medium
- Removing JSON writes means losing backup during writes
- If database fails, no JSON backup will be updated
- However, JSON read fallback remains for reads

**Mitigation**:
- Keep JSON as read-only backup
- Ensure database backups are configured
- Test rollback procedure

## Next Steps

1. **Verify Phase 4** (if not done):
   - Restart backend server
   - Verify database reads work
   - Test everything works correctly

2. **Wait for stability**:
   - Run Phase 4 for a period (days/weeks)
   - Monitor for issues
   - Ensure confidence in database

3. **Proceed to Phase 6**:
   - Remove JSON writes
   - Add transactions
   - Test thoroughly


