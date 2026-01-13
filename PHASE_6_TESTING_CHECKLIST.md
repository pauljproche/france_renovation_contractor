# Phase 6 Testing Checklist

**Date**: January 2026  
**Purpose**: Verify Phase 6 (DB-only writes) is working correctly

---

## ✅ Pre-Testing Setup

- [ ] Database is running (Docker or AWS RDS)
- [ ] `USE_DATABASE=true` is set in `backend/.env`
- [ ] Backend server is running
- [ ] Frontend is running
- [ ] Database has data (materials, sections, items)

---

## 1. Database Writes (Phase 6 Core Functionality)

### Test 1.1: Write to Database Only
- [ ] Make an edit in the frontend (e.g., change a product name)
- [ ] Check backend logs - should show "Materials written to database successfully"
- [ ] Check `data/materials.json` file timestamp - should NOT be updated
- [ ] Verify data is in database (query database directly)
- [ ] Refresh frontend - changes should persist

### Test 1.2: Verify JSON File Not Modified
- [ ] Note the timestamp of `data/materials.json`
- [ ] Make multiple edits via frontend
- [ ] Check `data/materials.json` timestamp again - should be unchanged
- [ ] Verify all changes are in database

### Test 1.3: Agent Tool Updates
- [ ] Use AI assistant to update a field (e.g., "change the reference for Mitigeur Grohe Blue to ABC123")
- [ ] Verify preview action shows correctly
- [ ] Confirm the change
- [ ] Verify change is in database
- [ ] Verify `data/materials.json` is NOT modified

---

## 2. Database Reads (Phase 4 Verification)

### Test 2.1: Read from Database
- [ ] Load frontend - materials should load from database
- [ ] Check backend logs - should show database reads, not JSON fallback
- [ ] Verify all sections and items are displayed correctly

### Test 2.2: JSON Fallback (Safety Net)
- [ ] Stop database (or simulate failure)
- [ ] Try to load materials
- [ ] Should fallback to JSON file
- [ ] Check backend logs - should show fallback warning
- [ ] Restart database - should work normally again

---

## 3. Agent Tools (Phase 5 Verification)

### Test 3.1: Search Items
- [ ] Ask AI: "What items need client approval?"
- [ ] Should return list of items
- [ ] Verify results are from database

### Test 3.2: Preview Update
- [ ] Ask AI: "Change the reference for [product] to XYZ789"
- [ ] Should show preview action
- [ ] Verify preview shows correct changes

### Test 3.3: Execute Update
- [ ] Confirm preview action
- [ ] Verify change is made in database
- [ ] Verify JSON file is NOT modified
- [ ] Verify change persists after refresh

### Test 3.4: Replacement URLs
- [ ] Ask AI: "Add replacement URL 'test-url' for [product] client approval"
- [ ] Confirm preview
- [ ] Verify URL is added in database
- [ ] Verify JSON file is NOT modified

---

## 4. Frontend Functionality

### Test 4.1: Materials Table
- [ ] Load materials page
- [ ] Verify all sections and items display correctly
- [ ] Make an edit in the table
- [ ] Verify edit saves and persists

### Test 4.2: Edit History
- [ ] Make an edit
- [ ] Check edit history is logged
- [ ] Verify edit history loads correctly

### Test 4.3: AI Assistant
- [ ] Open AI assistant
- [ ] Ask a question about materials
- [ ] Verify response is accurate
- [ ] Make an update via assistant
- [ ] Verify update works correctly

---

## 5. Backup Script (Cron Job Setup)

### Test 5.1: Manual Backup Script Run
- [ ] Run backup script manually: `./scripts/backup_to_json.sh`
- [ ] Verify script completes successfully
- [ ] Check `data/materials.json` is updated
- [ ] Verify JSON file contains all database data
- [ ] Check backup log file exists

### Test 5.2: Verify Backup Data Integrity
- [ ] Compare database data with JSON backup
- [ ] Verify all sections match
- [ ] Verify all items match
- [ ] Verify all approvals match
- [ ] Verify all orders match

---

## 6. Error Handling

### Test 6.1: Database Connection Failure
- [ ] Stop database
- [ ] Try to make an edit
- [ ] Should show appropriate error
- [ ] Should NOT write to JSON (Phase 6 behavior)

### Test 6.2: Invalid Data
- [ ] Try to update with invalid data
- [ ] Should show validation error
- [ ] Should NOT write to database
- [ ] Should NOT write to JSON

---

## 7. Performance

### Test 7.1: Write Performance
- [ ] Make multiple rapid edits
- [ ] Verify all edits complete successfully
- [ ] Check response times are acceptable
- [ ] Verify no JSON writes slow down operations

### Test 7.2: Read Performance
- [ ] Load materials page
- [ ] Verify load time is acceptable
- [ ] Check database query times in logs

---

## 8. AWS Deployment (If Applicable)

### Test 8.1: AWS Environment
- [ ] SSH into AWS EC2
- [ ] Verify `USE_DATABASE=true` is set
- [ ] Verify database connection works
- [ ] Test backup script on AWS

### Test 8.2: Cron Job Setup
- [ ] Set up cron job (see CRON_JOB_SETUP.md)
- [ ] Verify cron job is scheduled
- [ ] Wait for cron to run (or test manually)
- [ ] Verify backup log shows success
- [ ] Verify JSON file is updated on AWS

---

## ✅ Testing Summary

**Pass Criteria:**
- ✅ All writes go to database only (no JSON writes during normal operation)
- ✅ JSON file is only updated via backup script
- ✅ All reads come from database (with JSON fallback if DB fails)
- ✅ Agent tools work correctly
- ✅ Frontend works correctly
- ✅ Backup script works correctly
- ✅ Error handling works correctly

**Issues Found:**
- [ ] List any issues here

**Status**: ⬜ Not Started / 🟡 In Progress / ✅ Complete

---

## Notes

- JSON file should only be modified by the backup script, not during normal writes
- Database is the single source of truth for writes
- JSON is a read-only backup (updated daily via cron)
