# User Roles Proposal

## Proposed Role System

### Roles

1. **`admin`** (or `superuser`)
   - Full system access
   - Can manage all users (create, edit, delete)
   - Can manage all projects and data
   - Can access admin panel
   - Can change system settings

2. **`contractor`**
   - Can manage materials, approvals, orders
   - Can create and manage projects
   - Can assign workers
   - Can view all project data
   - Cannot manage users

3. **`client`**
   - Can view projects they're assigned to
   - Can approve/reject materials
   - Can view pricing and timelines
   - Read-only access to most data
   - Cannot manage users or projects

4. **`worker`**
   - Can view assigned tasks
   - Can update task status
   - Can view project materials (read-only)
   - Limited access to project data

5. **`subcontractor`**
   - Similar to contractor but for subcontractors
   - Can view assigned projects
   - Can update materials for assigned projects
   - Limited project management

6. **`viewer`** (optional)
   - Read-only access to all data
   - Cannot make any changes
   - Good for stakeholders who just need to view

## Current Roles (in database)

- `contractor`
- `client`
- `worker`
- `subcontractor`

## Proposed Addition

- `admin` - Add this new role

## Recommendation

**Use `admin` instead of `superuser`** - shorter, clearer, consistent with other role names.
