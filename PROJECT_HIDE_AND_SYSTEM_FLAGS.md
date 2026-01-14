# Project Hide and System Flags Feature

## Overview

This feature adds two capabilities to projects:
1. **Hide/Show Projects**: Projects can be hidden from the main project list (but still accessible via direct links)
2. **System Projects**: Certain projects (like "Legacy Materials" and "Demo Renovation Project") are marked as system projects and cannot be deleted

## Implementation

### Backend Changes

1. **Database Schema** (`backend/models.py`):
   - Added `hidden` column (Boolean, default False) - allows hiding projects from main list
   - Added `is_system` column (Boolean, default False) - marks system projects that cannot be deleted

2. **Service Layer** (`backend/services/projects_service.py`):
   - Updated `project_to_json()` to include `hidden` and `isSystem` fields
   - Updated `get_all_projects()` to accept `include_hidden` parameter (default: False)
   - Updated `update_project()` to handle `hidden` field (prevents hiding system projects)
   - Updated `delete_project()` to raise `ValueError` if attempting to delete a system project

3. **API Endpoints** (`backend/main.py`):
   - Updated `GET /api/projects` to accept `include_hidden` query parameter
   - Updated `DELETE /api/projects/{project_id}` to return 403 error if attempting to delete a system project

4. **Migration Script** (`backend/scripts/add_hidden_and_system_flags.py`):
   - Adds `hidden` and `is_system` columns to the `projects` table
   - Marks `legacy-materials` as a system project
   - Can be run with: `python backend/scripts/add_hidden_and_system_flags.py`

### Frontend Changes

1. **ProjectsContext** (`frontend/src/contexts/ProjectsContext.jsx`):
   - Added `toggleProjectHidden(id, hidden)` function to toggle project visibility
   - Updated `deleteProject()` to check for `isSystem` flag and prevent deletion

2. **ProjectCard Component** (`frontend/src/components/ProjectCard.jsx`):
   - Added hide/show button (eye icon) for all projects
   - Delete button only shows for non-system projects
   - Both buttons are in a new `project-card-actions` container

3. **Styling** (`frontend/src/styles/global.css`):
   - Added `.project-card-actions` container for action buttons
   - Added `.project-card-hide-btn` styling (gray, eye icon)
   - Updated `.project-card-delete-btn` styling (red, X icon)

4. **Translations** (`frontend/src/i18n/translations.js`):
   - Added `hideProject` and `showProject` keys in English and French

## Usage

### Hiding a Project

1. Hover over a project card
2. Click the eye icon (hide button) in the top-right corner
3. The project will be hidden from the main project list
4. Click the eye-with-slash icon to show it again

### System Projects

System projects (marked with `is_system = true`):
- Cannot be deleted (delete button doesn't appear)
- Cannot be hidden (hide button works, but system projects should remain visible)
- Currently includes:
  - `legacy-materials` (Legacy Materials project)

### Marking a Project as System

To mark a project as a system project (requires database access):

```sql
UPDATE projects SET is_system = true WHERE id = 'project-id';
```

Or use the migration script and add the project ID to the `system_project_ids` list.

## Testing

1. **Test Hide/Show**:
   - Hide a project → Should disappear from main list
   - Show it again → Should reappear

2. **Test System Project Protection**:
   - Try to delete "Legacy Materials" → Delete button should not appear
   - Try to delete a regular project → Delete button should appear

3. **Test API**:
   - `GET /api/projects?include_hidden=true` → Should return all projects including hidden ones
   - `GET /api/projects` → Should exclude hidden projects
   - `DELETE /api/projects/legacy-materials` → Should return 403 error

## Migration Status

✅ Migration script run successfully:
- Added `hidden` column
- Added `is_system` column
- Marked `legacy-materials` as system project

## Future Enhancements

- Add admin UI to mark/unmark projects as system projects
- Add bulk hide/show functionality
- Add "Show Hidden Projects" toggle in the UI
- Add visual indicator for hidden projects when viewing with `include_hidden=true`
