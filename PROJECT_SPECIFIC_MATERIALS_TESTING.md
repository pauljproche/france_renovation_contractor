# Project-Specific Materials Testing Guide

## Overview
This feature decouples materials data so each project has its own materials. Previously, all projects shared the same materials data.

## What Changed

### Backend
- `/api/materials` GET endpoint now accepts optional `project_id` query parameter
- `/api/materials` PUT endpoint now accepts optional `project_id` query parameter
- When `project_id` is provided, materials are filtered/associated with that project
- When `project_id` is NOT provided, behavior is backward compatible (returns all materials)

### Frontend
- `useMaterialsData` hook automatically passes `selectedProject.id` to API calls
- Materials are now project-specific when a project is selected

## Testing Steps

### 1. Test Backward Compatibility (No project_id)
- **Test**: Access materials without selecting a project
- **Expected**: Should work as before, returning all materials
- **How to test**: 
  - Don't select a project (or select a demo project that uses static files)
  - Navigate to Materials page
  - Should see all materials

### 2. Test Project-Specific Materials (With project_id)
- **Test**: Select a project and view/edit materials
- **Expected**: Should only see/save materials for that specific project
- **How to test**:
  1. Select a project (e.g., "testing123 cat")
  2. Navigate to Materials page
  3. Should only see materials associated with that project
  4. Add/edit a material
  5. Save changes
  6. Switch to another project
  7. Should see different materials (or empty if no materials for that project)

### 3. Test Multiple Projects
- **Test**: Create materials for different projects
- **Expected**: Each project should have its own materials
- **How to test**:
  1. Select Project A
  2. Add some materials
  3. Save
  4. Select Project B
  5. Add different materials
  6. Save
  7. Switch back to Project A
  8. Should see only Project A's materials

### 4. Test Client Approval Metric
- **Test**: Client approval metric on global dashboard
- **Expected**: Should correctly count projects where all items are approved
- **How to test**:
  1. Select a project
  2. Go to Client Materials page
  3. Approve all items for that project
  4. Go to Global Dashboard
  5. Check "Client Approved" metric
  6. Should reflect the approved project

### 5. Test API Directly (Optional)
- **Test**: API endpoints with/without project_id
- **How to test**:
  ```bash
  # Get all materials (backward compatible)
  curl "http://localhost:8000/api/materials"
  
  # Get materials for specific project
  curl "http://localhost:8000/api/materials?project_id=testing123-cat"
  ```

## Known Limitations (To be addressed in Phase 3)

- **Existing materials with NULL project_id**: Materials created before this change have `project_id = NULL`
  - These will appear in "all materials" view (when no project_id is provided)
  - They won't appear when filtering by a specific project
  - Phase 3 will address migration of these materials

## What to Look For

### ✅ Success Indicators
- Different projects show different materials
- Materials saved in one project don't appear in another
- Client approval metric works correctly
- No errors in browser console
- No errors in backend logs

### ⚠️ Potential Issues
- Materials not appearing: Check if `project_id` is being passed correctly
- Materials appearing in wrong project: Check database `project_id` values
- Client approval not updating: Check if materials have `project_id` set correctly

## Database Verification

To check materials in database:
```sql
-- See all sections with their project_id
SELECT id, label, project_id FROM sections;

-- See materials for a specific project
SELECT s.id, s.label, s.project_id, COUNT(i.id) as item_count
FROM sections s
LEFT JOIN items i ON i.section_id = s.id
WHERE s.project_id = 'your-project-id'
GROUP BY s.id, s.label, s.project_id;
```

## Rollback Plan

If issues are found, you can:
1. Revert the branch: `git checkout main`
2. Or disable project filtering by not passing `project_id` in frontend
3. The backend is backward compatible, so old behavior still works
