# Data Integrity Fixes - Pre-Migration

This document outlines the critical data integrity fixes implemented before database migration.

## ✅ Implemented Fixes

### 1. Date Validation System

**Problem**: Projects could have `startDate > endDate`, causing timeline calculations to fail.

**Solution**: 
- Created `frontend/src/utils/projectValidation.js` with validation utilities
- Added real-time validation in Timeline edit form
- Added validation in `ProjectsContext` when creating/updating projects
- Prevents saving invalid date relationships

**Files Modified**:
- `frontend/src/utils/projectValidation.js` (new)
- `frontend/src/pages/Timeline.jsx`
- `frontend/src/contexts/ProjectsContext.jsx`

### 2. Real-Time Validation UI

**Features**:
- Visual feedback (red border) when dates are invalid
- Error messages shown below date inputs
- Save button blocked when validation fails
- `min` attribute on end date input to prevent selecting dates before start date

### 3. Data Validation Scripts

**Created**:
- `scripts/validateDataIntegrity.js` - CLI script to validate JSON files
- `scripts/validateProjectsInBrowser.js` - Browser console script to validate localStorage projects

## 🔍 How to Use Validation

### Validate JSON Files (CLI)

```bash
node scripts/validateDataIntegrity.js
```

This checks:
- Materials JSON structure
- Missing chantier fields
- Edit history integrity

**Note**: Project validation requires browser localStorage data (see below).

### Validate Projects (Browser Console)

1. Open your app in browser
2. Open Developer Console (F12)
3. Copy and paste the contents of `scripts/validateProjectsInBrowser.js`
4. Press Enter

This will:
- Check all projects for invalid dates
- Identify projects with `startDate > endDate`
- Find missing required fields
- Detect duplicate project names
- Provide detailed error report

### Fix Invalid Dates

1. Navigate to Timeline page (`/timeline`)
2. Click on a project row to edit
3. The validation will prevent saving if:
   - Start date is after end date
   - Dates are invalid
4. Correct the dates and save

## 📋 Validation Rules

### Project Date Validation

- ✅ `startDate` must be valid date string
- ✅ `endDate` must be valid date string
- ✅ `startDate` must be ≤ `endDate`
- ✅ If only one date exists, it must be valid

### Project Field Validation

- ✅ Project must have `id`
- ✅ Project must have `name` OR `address`
- ✅ `status` must be one of: `draft`, `ready`, `active`, `completed`, `archived`
- ✅ `percentagePaid` must be between 0 and 100

## 🚨 Known Issues (Not Fixed - Architectural)

These require database migration to fix properly:

1. **Fragmented Project-Materials Relationship**
   - Materials reference projects via `chantier` string matching
   - No foreign key relationship
   - **Solution**: Migration will add `project_id` foreign key

2. **No Auto-Calculation of Timeline Dates**
   - Project start dates not derived from material order dates
   - Manual entry only
   - **Solution**: Migration will add SQL functions to auto-calculate from materials

3. **No Referential Integrity**
   - Materials can reference non-existent projects
   - Projects can exist without materials
   - **Solution**: Migration will add database constraints

4. **Multiple localStorage Writes**
   - No transactions across related data
   - Risk of inconsistent state
   - **Solution**: Migration will use database transactions

## 📝 Pre-Migration Checklist

Before running migration:

- [ ] Run `validateDataIntegrity.js` to check JSON files
- [ ] Run browser validation script to check projects
- [ ] Fix all date validation errors
- [ ] Verify no projects have `startDate > endDate`
- [ ] Backup localStorage data (export to JSON)
- [ ] Backup `data/materials.json`
- [ ] Backup `data/edit-history.json`

## 🎯 What's Protected Now

✅ **Prevented**: Saving projects with invalid date relationships  
✅ **Prevented**: Creating projects with missing required fields  
✅ **Prevented**: Invalid date values in forms  
✅ **Detected**: Existing invalid dates (via validation scripts)

## 🔄 Next Steps (Post-Migration)

After database migration, these will be implemented:

1. Database constraints for `startDate < endDate`
2. Foreign keys linking materials to projects
3. Auto-calculation of project dates from material orders
4. Transaction-based updates for data consistency
5. SQL functions for timeline calculations
6. Referential integrity checks

---

**Last Updated**: Pre-Migration Phase  
**Status**: ✅ Critical date validation implemented

