# Data Structure Analysis & Refactoring Opportunities

## Current Data Architecture Overview

### Data Storage Locations

1. **localStorage** (11+ keys):
   - `renovationProjects` - Project data
   - `selectedProjectId` - Current project selection
   - `convertedDemoProjects` - Demo project conversion state
   - `hiddenFromRegularDemos` - Demo visibility state
   - `workers` - Worker and job data
   - `chat-history-{username}` - Per-user chat history
   - `language` - UI language preference
   - `customRoles` - Custom role definitions
   - `aiPanelOpen` - AI panel visibility
   - `theme` - UI theme preference
   - `materials-table-column-visibility` - Table column visibility
   - `materials-table-custom-columns` - Custom column definitions
   - `materials-table-column-order` - Column ordering
   - `ai-panel-sessions-{username}` - AI panel session data
   - `ai-panel-messages-{username}` - AI panel messages
   - `prompt-library-{username}` - Prompt library data

2. **JSON Files** (Backend/Data):
   - `data/materials.json` - Materials, items, approvals, orders
   - `data/edit-history.json` - Edit history logs
   - `data/materials-pending-approval.json` - Pending approvals (unused?)

3. **Backend API**:
   - Materials CRUD operations
   - Edit history logging
   - AI agent integration

### Context Providers (React State)

1. **ProjectsContext** - Manages projects, selected project, demo state
2. **WorkersContext** - Manages workers and jobs
3. **ChatHistoryContext** - Manages chat history
4. **AppContext** - Manages language, roles, theme, AI panel visibility
5. **CustomTableContext** - Manages table column configuration
6. **useMaterialsData** (hook) - Fetches and manages materials data

---

## 🔴 Critical Issues

### 1. **Fragmented localStorage**
**Problem**: 15+ separate localStorage keys with no organization
- Hard to backup/export all user data
- Hard to clear/reset user data
- No versioning or migration strategy
- Risk of localStorage quota exhaustion (5-10MB limit)

**Impact**: 
- User data scattered across many keys
- Difficult to implement data export/import
- Hard to handle data migrations

### 2. **No Centralized Data Access Layer**
**Problem**: Each context/hook directly accesses localStorage
- Inconsistent error handling
- No unified data validation
- Duplicate code for load/save operations
- Hard to track data changes

**Impact**: 
- Bugs can be inconsistent across different data stores
- Hard to add features like data sync, offline support

### 3. **Duplicate Demo Data Logic**
**Problem**: Demo data exists in:
- Hardcoded in `ProjectsContext.jsx` (DEMO_PROJECT, TIMELINE_DEMO_PROJECTS)
- Hardcoded in `WorkersContext.jsx` (DEMO_WORKERS)
- Merged with localStorage on load

**Impact**: 
- Maintenance burden (demo data in multiple places)
- Inconsistent demo data across app restarts
- Hard to update demo data

### 4. **String-Based Relationships**
**Problem**: 
- Projects ↔ Materials: String matching on `chantier` field
- Workers ↔ Projects: String matching on `chantierName`
- No foreign keys or referential integrity

**Impact**: 
- Easy to create orphaned data
- Fuzzy matching can miss relationships
- Hard to enforce data consistency

### 5. **No Data Normalization**
**Problem**: 
- Materials JSON has nested structures (approvals, orders, comments)
- Worker jobs nested in worker objects
- No separation of concerns

**Impact**: 
- Hard to query efficiently
- Redundant data storage
- Inconsistent update patterns

### 6. **Mixed Storage Patterns**
**Problem**: 
- Some data in localStorage (projects, workers)
- Some data in JSON files (materials)
- Some data in sessionStorage (justLoggedIn flag)
- Some UI state in localStorage (should be session-only)

**Impact**: 
- Unclear data lifecycle
- Session data persists across sessions
- Hard to reason about data persistence

---

## 🟡 Moderate Issues

### 7. **Inconsistent Error Handling**
**Problem**: Different patterns for handling localStorage errors
- Some contexts use try/catch with console.warn
- Some contexts don't handle errors at all
- No user-facing error notifications

### 8. **No Data Validation Layer**
**Problem**: Validation only added recently for dates
- No schema validation for most data
- No type checking on load
- Invalid data can persist

### 9. **Performance Concerns**
**Problem**: 
- Entire materials.json loaded on every fetch
- All projects loaded into memory (even if not needed)
- No pagination or lazy loading
- Large localStorage reads on every page load

### 10. **No Data Versioning**
**Problem**: 
- No schema versions
- Hard to migrate data when structure changes
- Breaking changes break existing data

---

## ✅ What's Good

1. **Separation of Concerns**: Contexts are well-separated by domain
2. **React Patterns**: Proper use of Context API and hooks
3. **Type Safety**: Recent validation additions (dates)
4. **Modularity**: Utils are separated into their own files

---

## 🎯 Refactoring Recommendations

### Priority 1: Before Migration (Quick Wins)

#### 1.1 Consolidate localStorage Access
Create a unified localStorage service:

```javascript
// frontend/src/services/storageService.js
class StorageService {
  constructor(prefix = 'frc') {
    this.prefix = prefix;
    this.version = '1.0.0';
  }
  
  // Unified get/set with error handling
  get(key, defaultValue = null) { ... }
  set(key, value) { ... }
  
  // Namespace management
  getAllUserData() { ... } // Export all user data
  clearUserData() { ... } // Clear all user data
  importUserData(data) { ... } // Import user data
}
```

**Benefits**: 
- Single point of control
- Easy to add versioning/migration
- Easy to backup/restore

#### 1.2 Separate UI State from Business Data
Move UI-only state to sessionStorage:
- `materials-table-column-visibility`
- `materials-table-custom-columns`
- `materials-table-column-order`
- `aiPanelOpen` (maybe keep in localStorage for persistence preference)

**Benefits**: 
- Clear separation of concerns
- Reduces localStorage usage
- UI state resets appropriately

#### 1.3 Centralize Demo Data
Create `frontend/src/data/demoData.js`:
```javascript
export const DEMO_PROJECTS = [...];
export const DEMO_WORKERS = [...];
```
Import in contexts instead of hardcoding.

**Benefits**: 
- Single source of truth
- Easy to update
- Testable

### Priority 2: During Migration (Architectural)

#### 2.1 Create Data Access Layer
```javascript
// frontend/src/services/dataService.js
class DataService {
  // Unified interface for all data operations
  async getProjects() { ... }
  async saveProject(project) { ... }
  async getMaterials(projectId) { ... }
  // etc.
}
```

**Benefits**: 
- Abstract storage mechanism (localStorage → DB)
- Consistent API
- Easy to add caching, sync, etc.

#### 2.2 Normalize Data Models
Create TypeScript types or PropTypes:
```javascript
// frontend/src/types/index.js
export const ProjectSchema = {
  id: string,
  name: string,
  address: string,
  startDate: date,
  endDate: date,
  // ...
};
```

**Benefits**: 
- Type safety
- Documentation
- Validation

#### 2.3 Implement Data Relationships
- Add `projectId` to materials (replacing `chantier` string matching)
- Add foreign key validation
- Use IDs instead of names for relationships

### Priority 3: Post-Migration (Optimization)

#### 3.1 Implement Caching Layer
- Cache materials data
- Invalidate on updates
- Reduce API calls

#### 3.2 Add Data Pagination
- Lazy load projects
- Paginate materials table
- Virtual scrolling for large lists

#### 3.3 Implement Optimistic Updates
- Update UI immediately
- Sync with backend
- Rollback on error

---

## 📋 Recommended Refactoring Order

### Phase 1: Pre-Migration (1-2 days)
1. ✅ Create `StorageService` (consolidate localStorage)
2. ✅ Move UI state to sessionStorage
3. ✅ Centralize demo data
4. ✅ Add data export/import utilities

### Phase 2: Migration Preparation (1 day)
1. Create `DataService` interface
2. Create TypeScript/PropTypes schemas
3. Document all data structures

### Phase 3: During Migration
1. Implement `DataService` with database backend
2. Normalize data relationships
3. Remove localStorage dependencies (except for UI state)

### Phase 4: Post-Migration (1-2 days)
1. Add caching layer
2. Implement pagination
3. Optimize data loading

---

## 🚀 Quick Win: Storage Service

Would you like me to implement the `StorageService` now? It would:
- Consolidate all localStorage access
- Add data export/import
- Add error handling
- Prepare for easy migration to backend

**Estimated time**: 2-3 hours
**Impact**: High (foundation for all other improvements)

---

## Summary

**Overall Assessment**: ⚠️ **Needs Refactoring**

The data structure is functional but has architectural issues that will make migration harder:
- Too many localStorage keys (fragmentation)
- No centralized data access (hard to migrate)
- String-based relationships (no integrity)
- Mixed storage patterns (unclear lifecycle)

**Recommendation**: 
1. **Quick wins now**: StorageService + UI state separation
2. **During migration**: Data access layer + normalization
3. **After migration**: Caching + pagination + optimization

The current structure works but will cause pain points during migration. Better to refactor incrementally than all at once.

