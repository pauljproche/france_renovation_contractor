# Admin Page Setup Guide

**Date**: January 2026  
**Status**: ✅ Complete

---

## What Was Created

### Backend

1. **Added ADMIN Role**
   - Updated `UserRoleEnum` in `backend/models.py` to include `ADMIN`
   - Created migration script: `backend/scripts/add_admin_role.py`

2. **User Management Service**
   - Created `backend/services/users_service.py`
   - Features:
     - Password hashing with bcrypt
     - User CRUD operations
     - Role management
     - Prevents deleting last admin user

3. **API Endpoints**
   - `GET /api/users` - List all users
   - `GET /api/users/{user_id}` - Get single user
   - `POST /api/users` - Create user
   - `PUT /api/users/{user_id}` - Update user
   - `DELETE /api/users/{user_id}` - Delete user
   - `GET /api/users/roles` - Get available roles

4. **Dependencies**
   - Added `passlib[bcrypt]==1.7.4` to `requirements.txt`

### Frontend

1. **Admin Page**
   - Created `frontend/src/pages/Admin.jsx`
   - Features:
     - List all users with roles
     - Create new users
     - Edit users (email, password, role)
     - Delete users
     - View user creation and last login dates

2. **Navigation**
   - Added Admin link to sidebar (only visible to admin users)
   - Added route `/admin` in `App.jsx`

---

## Role System

### Available Roles

1. **`admin`** ⭐ NEW
   - Full system access
   - Can manage all users
   - Can access admin panel
   - Cannot be deleted if it's the last admin

2. **`contractor`**
   - Can manage materials, approvals, orders
   - Can create and manage projects
   - Cannot manage users

3. **`client`**
   - Can view projects they're assigned to
   - Can approve/reject materials
   - Read-only access to most data

4. **`worker`**
   - Can view assigned tasks
   - Can update task status
   - Limited access

5. **`subcontractor`**
   - Similar to contractor but for subcontractors
   - Can view assigned projects

---

## Setup Instructions

### Step 1: Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

This will install `passlib[bcrypt]` for password hashing.

### Step 2: Add ADMIN Role to Database

Run the migration script to add the ADMIN role to the PostgreSQL enum:

```bash
cd backend
python3 scripts/add_admin_role.py
```

**Expected Output**:
```
Connecting to database: ...
Adding ADMIN role to user_role_enum...
✅ Successfully added ADMIN role to user_role_enum!

Available roles:
  - admin
  - contractor
  - client
  - worker
  - subcontractor
```

### Step 3: Create First Admin User

You can create the first admin user via the API or directly in the database:

**Via API** (after starting backend):
```bash
curl -X POST http://localhost:8000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-secure-password",
    "role": "admin"
  }'
```

**Via Database** (using users_service):
```python
from backend.db_session import db_session
from backend.services import users_service

with db_session() as session:
    user = users_service.create_user(
        session=session,
        email="admin@example.com",
        password="your-secure-password",
        role="admin"
    )
    print(f"Created admin user: {user['id']}")
```

### Step 4: Access Admin Page

1. Start backend and frontend
2. Navigate to `/admin` in your browser
3. You should see the user management interface

**Note**: The Admin link in the sidebar will only appear if your current role is set to `admin`. You may need to update your role in Settings or localStorage.

---

## Features

### User Management

- ✅ **List Users**: See all users with their roles, creation dates, and last login
- ✅ **Create Users**: Add new users with email, password, and role
- ✅ **Edit Users**: Update email, password (optional), and role
- ✅ **Delete Users**: Remove users (cannot delete last admin)
- ✅ **Password Security**: Passwords are hashed with bcrypt (never stored in plain text)

### Security Features

- ✅ **Password Hashing**: All passwords are hashed using bcrypt
- ✅ **Admin Protection**: Cannot delete the last admin user
- ✅ **Email Validation**: Email format is validated
- ✅ **Role Validation**: Only valid roles can be assigned

---

## API Usage Examples

### Get All Users
```bash
curl http://localhost:8000/api/users
```

### Create User
```bash
curl -X POST http://localhost:8000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "role": "contractor"
  }'
```

### Update User
```bash
curl -X PUT http://localhost:8000/api/users/user-abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newemail@example.com",
    "role": "client"
  }'
```

### Delete User
```bash
curl -X DELETE http://localhost:8000/api/users/user-abc123
```

### Get Available Roles
```bash
curl http://localhost:8000/api/users/roles
```

---

## Frontend Usage

1. **Access Admin Page**: Navigate to `/admin` (or click "Admin" in sidebar if you're an admin)
2. **Create User**: Click "+ Create User" button
3. **Edit User**: Click "Edit" button next to a user
4. **Delete User**: Click "Delete" button (with confirmation)
5. **View Users**: See all users in a table with their details

---

## Notes

- **Passwords**: Passwords are never returned in API responses (only `has_password` boolean)
- **Admin Role**: The admin role must be added to the database enum before creating admin users
- **Role Display**: Admin link in sidebar only shows if current role is `admin`
- **Last Admin**: System prevents deleting the last admin user to ensure admin access is always available

---

## Next Steps (Optional)

- Add authentication/authorization middleware to protect admin endpoints
- Add user activity logging
- Add password reset functionality
- Add user profile pages
- Add role-based permissions for different features

---

**Status**: ✅ Ready to use  
**Last Updated**: January 2026
