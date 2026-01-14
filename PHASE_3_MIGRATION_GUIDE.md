# Phase 3: Migration Guide for Existing Materials

## Overview

This guide explains how to migrate existing materials that have `project_id = NULL` to be associated with specific projects.

## Background

Before implementing project-specific materials, all materials were stored globally (without project associations). After the implementation, new materials are automatically associated with projects, but existing materials still have `project_id = NULL`.

## Migration Options

### Option 1: Leave as Global Materials (Recommended for now)

**When to use:** If you want to keep existing materials accessible across all projects.

**How it works:**
- Materials with `project_id = NULL` will appear when no project is selected
- They won't appear when filtering by a specific project
- This maintains backward compatibility

**No action needed** - this is the default behavior.

### Option 2: Assign to a Default Project

**When to use:** If you want all existing materials to belong to a specific project (e.g., a "Legacy" or "Archive" project).

**Steps:**
1. Create a project to hold legacy materials (optional):
   ```sql
   INSERT INTO projects (id, name, owner_id, status, created_at, updated_at)
   VALUES ('legacy-materials', 'Legacy Materials', 'your-user-id', 'active', NOW(), NOW());
   ```

2. Run the migration script:
   ```bash
   python backend/scripts/migrate_materials_to_projects.py --assign-to-project legacy-materials --no-dry-run
   ```

### Option 3: Assign by Chantier Matching (Future Enhancement)

**When to use:** If items have `chantier` fields that match project names/addresses.

**Status:** This requires additional implementation to extract chantier from items and match to projects. The framework is in place but needs to be completed based on your data structure.

**Future implementation:**
```bash
python backend/scripts/migrate_materials_to_projects.py --assign-by-chantier --no-dry-run
```

## Migration Script Usage

### List Materials Without Projects

```bash
python backend/scripts/migrate_materials_to_projects.py --list
```

This shows all sections that don't have a project_id assigned.

### Dry Run (Safe - No Changes)

All commands default to dry-run mode. Test first:

```bash
# See what would be assigned
python backend/scripts/migrate_materials_to_projects.py --assign-to-project your-project-id

# See chantier matching results
python backend/scripts/migrate_materials_to_projects.py --assign-by-chantier
```

### Apply Changes

Add `--no-dry-run` to actually apply changes:

```bash
python backend/scripts/migrate_materials_to_projects.py --assign-to-project your-project-id --no-dry-run
```

## Manual Assignment via Database

You can also manually assign materials using SQL:

```sql
-- Assign a specific section to a project
UPDATE sections SET project_id = 'your-project-id' WHERE id = 'section-id';

-- Assign all NULL sections to a project
UPDATE sections SET project_id = 'your-project-id' WHERE project_id IS NULL;

-- Check current assignments
SELECT s.id, s.label, s.project_id, p.name as project_name, COUNT(i.id) as item_count
FROM sections s
LEFT JOIN projects p ON s.project_id = p.id
LEFT JOIN items i ON i.section_id = s.id
GROUP BY s.id, s.label, s.project_id, p.name
ORDER BY s.project_id NULLS LAST;
```

## Testing After Migration

1. **Verify assignments:**
   ```bash
   python backend/scripts/migrate_materials_to_projects.py --list
   ```
   Should show no results (or only materials you intentionally left as global).

2. **Test API:**
   ```bash
   # Should return empty (no global materials)
   curl "http://localhost:8000/api/materials"
   
   # Should return materials for the project
   curl "http://localhost:8000/api/materials?project_id=your-project-id"
   ```

3. **Test in UI:**
   - Select a project → Materials page should show only that project's materials
   - Don't select a project → Should show only global materials (if any remain)

## Rollback

If you need to undo assignments:

```sql
-- Remove project assignment from specific sections
UPDATE sections SET project_id = NULL WHERE id IN ('section-1', 'section-2');

-- Remove all project assignments (make everything global again)
UPDATE sections SET project_id = NULL;
```

## Recommendations

1. **Start with Option 1** (leave as global) - safest, maintains backward compatibility
2. **Test thoroughly** before migrating production data
3. **Backup database** before running migrations
4. **Use dry-run mode** first to see what would change
5. **Migrate incrementally** - assign materials to projects as you work with them

## Next Steps

After migration:
- New materials will automatically be associated with the selected project
- Existing materials will be accessible based on their project_id assignment
- You can manually reassign materials through the UI (by editing the project association)
