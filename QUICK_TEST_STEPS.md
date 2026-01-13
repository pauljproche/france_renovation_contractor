# Quick Test Steps - Phase 5

## 🚀 Servers Running

- Frontend: http://localhost:5173
- Backend: http://localhost:8000

## ⚡ Quick Test (5 minutes)

### Step 1: Test Query Tool (2 min)
1. Open http://localhost:5173
2. Open AI Panel
3. Ask: **"What items need client validation?"**
4. ✅ Should get list from database

### Step 2: Test Preview Modal (2 min)
1. Ask: **"Approve beegcat as client"**
   - (Or any item name from your database)
2. ✅ Preview modal should appear
3. ✅ Toggle between "Description" and "SQL" views
4. ✅ Review the preview

### Step 3: Test Confirmation (1 min)
1. Click **"Confirm"** button
2. ✅ Action executes
3. ✅ Success message appears
4. ✅ Database updates

## 🎯 What You're Testing

- ✅ Agent uses database queries (not materials text)
- ✅ Preview modal appears for write actions
- ✅ SQL and NLP views work
- ✅ Confirmation executes action
- ✅ Security: Agent can't directly write

## 📝 Notes

- Check browser console (F12) for any errors
- Check Network tab to see API calls
- Preview modal should appear automatically
- SQL view shows actual query
- Description view shows plain language

## 🐛 If Something Doesn't Work

1. Check backend logs: `tail -f /tmp/backend.log`
2. Check frontend logs: `tail -f /tmp/frontend.log`
3. Check browser console (F12)
4. Verify servers are running:
   - Backend: `curl http://localhost:8000/docs`
   - Frontend: Open http://localhost:5173

---

**Ready!** Open http://localhost:5173 and start testing! 🎉



