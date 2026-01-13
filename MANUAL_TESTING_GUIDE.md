# Phase 5 Manual Testing Guide

## 🚀 Servers Started

- **Backend**: http://localhost:8000
- **Frontend**: http://localhost:5173
- **API Docs**: http://localhost:8000/docs

## 📋 Testing Checklist

### Test 1: Query Tool Usage ✅

**Goal**: Verify agent uses database query tools instead of parsing materials text

**Steps:**
1. Open http://localhost:5173 in your browser
2. Open the AI Panel (if not already open)
3. Type: **"What items need client validation?"**
4. Click Send

**Expected Results:**
- ✅ Agent responds with list of items needing validation
- ✅ Response comes from database (not materials text)
- ✅ Response is fast (direct DB query)
- ✅ Check browser DevTools Network tab - request should be smaller (no full materials dataset)

**What to Check:**
- [ ] Response lists items from database
- [ ] Response is accurate (matches database)
- [ ] Response time is fast
- [ ] Request payload is smaller (check Network tab)

---

### Test 2: Preview Modal - Approval Action ✅

**Goal**: Verify preview modal appears when agent generates a write action

**Steps:**
1. In AI Panel, type: **"Approve beegcat as client"**
   - (Or use any item name from your database)
2. Click Send

**Expected Results:**
- ✅ Agent generates a preview (doesn't execute immediately)
- ✅ Preview modal appears automatically
- ✅ Modal shows:
  - Action type: "update_item_approval"
  - Affected item: Product name and section
  - Current value: Current approval status
  - New value: "approved"
  - Toggle buttons: "Description" and "SQL"

**What to Check:**
- [ ] Modal appears automatically
- [ ] Action type is shown correctly
- [ ] Affected items are listed
- [ ] Current/New values are shown
- [ ] Toggle buttons are visible

---

### Test 3: Preview Modal - SQL/NLP Toggle ✅

**Goal**: Verify you can toggle between SQL and NLP views

**Steps:**
1. With preview modal open (from Test 2)
2. Click **"Description"** button (should be active by default)
3. Verify you see: **"Approve 'beegcat' in Cuisine as client"**
4. Click **"SQL"** button
5. Verify you see the SQL query

**Expected Results:**
- ✅ Description view shows: Plain language interpretation
- ✅ SQL view shows: Actual SQL query with parameters
- ✅ Toggle works smoothly
- ✅ Both views are accurate

**What to Check:**
- [ ] Description view shows clear NLP interpretation
- [ ] SQL view shows actual SQL query
- [ ] SQL query looks correct (INSERT/UPDATE statement)
- [ ] Toggle works without errors

---

### Test 4: Confirmation Flow - Execute Action ✅

**Goal**: Verify action executes only after user confirmation

**Steps:**
1. With preview modal open (from Test 2)
2. Review the preview (check both Description and SQL)
3. Click **"Confirm"** button
4. Wait for response

**Expected Results:**
- ✅ Modal shows "Confirming..." state
- ✅ Action executes via API
- ✅ Success message appears in chat
- ✅ Modal closes
- ✅ Materials data updates (if viewing materials page)
- ✅ Database is updated

**What to Check:**
- [ ] Confirmation button works
- [ ] Action executes successfully
- [ ] Success message appears
- [ ] Database is updated (check via pgAdmin or query)
- [ ] Edit history is logged

---

### Test 5: Cancel Flow ✅

**Goal**: Verify action doesn't execute when cancelled

**Steps:**
1. Generate a new preview (ask to approve another item)
2. Click **"Cancel"** button instead of Confirm

**Expected Results:**
- ✅ Modal closes
- ✅ No action executed
- ✅ No database changes
- ✅ No success message

**What to Check:**
- [ ] Cancel button works
- [ ] Modal closes
- [ ] No database changes
- [ ] No error messages

---

### Test 6: Multiple Actions ✅

**Goal**: Verify system handles multiple previews correctly

**Steps:**
1. Ask: **"Approve item X as client"** (generate preview 1)
2. Cancel it
3. Ask: **"Approve item Y as client"** (generate preview 2)
4. Confirm it

**Expected Results:**
- ✅ Each preview has unique action_id
- ✅ Only confirmed action executes
- ✅ Cancelled action doesn't execute

**What to Check:**
- [ ] Multiple previews work
- [ ] Each has unique ID
- [ ] Only confirmed actions execute

---

## 🔍 Debugging Tips

### Check Backend Logs
```bash
tail -f /tmp/backend.log
```

### Check Frontend Logs
```bash
tail -f /tmp/frontend.log
```

### Check Browser Console
- Open DevTools (F12)
- Check Console tab for errors
- Check Network tab for API calls

### Verify Database Changes
```bash
docker exec france-renovation-db psql -U postgres -d france_renovation -c "SELECT * FROM approvals WHERE role = 'client' LIMIT 5;"
```

### Test API Directly
```bash
# Test query endpoint
curl -X POST http://localhost:8000/api/assistant/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What items need client validation?", "language": "en"}'
```

## 🐛 Common Issues

### Modal doesn't appear
- Check browser console for errors
- Verify backend is running
- Check Network tab for API responses
- Verify response contains `preview` field

### Preview API returns 404
- This is expected (in-memory storage)
- Preview is included in initial response
- Not a blocker for testing

### Agent doesn't use query tools
- Check system prompt is loaded
- Verify `USE_DATABASE=true` in .env
- Check backend logs for tool calls

## ✅ Success Criteria

Phase 5 is working correctly if:
1. ✅ Agent uses query tools for questions
2. ✅ Preview modal appears for write actions
3. ✅ SQL and NLP views work
4. ✅ Confirmation executes action
5. ✅ Cancel doesn't execute action
6. ✅ Database updates correctly

---

**Ready to test!** Open http://localhost:5173 and start with Test 1.



