# Client Module Setup Guide

## Overview

The Client Module introduces a hierarchical structure to your Construction Workforce Management System:

```
Admin → Client → Project → Supervisor → Staff
```

This allows admins to manage multiple clients, where each client can have their own projects, supervisors, and staff members.

## Features Implemented

### 1. **Database Schema**
- ✅ `clients` table with full audit trail (created_at, created_by, updated_at, updated_by)
- ✅ Email as unique identifier
- ✅ Password-protected client accounts
- ✅ Active/Inactive status
- ✅ Foreign key relationships to projects, supervisors, and employees

### 2. **Backend API**
- ✅ GET `/api/admin/clients` - List all clients with search and filters
- ✅ GET `/api/admin/clients/:id` - Get client details with associated resources
- ✅ POST `/api/admin/clients` - Create new client
- ✅ PUT `/api/admin/clients/:id` - Update client
- ✅ DELETE `/api/admin/clients/:id` - Delete client (with validation)
- ✅ GET `/api/admin/clients/:id/stats` - Get client statistics

### 3. **Frontend Interface**
- ✅ Clients list page with search and filters
- ✅ Client detail page showing all associated resources
- ✅ Add/Edit client form with validation
- ✅ Client statistics dashboard
- ✅ Beautiful, modern UI with responsive design

### 4. **Navigation**
- ✅ Added "Clients" menu item in sidebar (positioned after Dashboard)

## Database Setup

### Step 1: Run Migrations

Execute the following SQL files in order in your Supabase SQL Editor:

1. **Create Clients Table:**
```sql
-- File: backend/migrations/017_create_clients_table.sql
```

2. **Add Client Foreign Keys:**
```sql
-- File: backend/migrations/018_add_client_id_to_tables.sql
```

### Step 2: Verify Setup

Run this query to verify the setup:

```sql
-- Check if clients table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'clients';

-- Check if foreign keys were added
SELECT column_name, table_name
FROM information_schema.columns
WHERE column_name = 'client_id'
  AND table_name IN ('projects', 'supervisors', 'employees');
```

## Backend Setup

### Step 1: Install Dependencies

The backend already has all required dependencies (bcrypt, express, pg).

### Step 2: Restart Backend Server

```bash
cd backend
npm start
```

The new client routes will be automatically loaded.

## Frontend Setup

### Step 1: No Additional Dependencies Needed

All required dependencies are already installed.

### Step 2: Restart Next.js Dev Server

```bash
cd admin-portal
npm run dev
```

## Usage Guide

### Creating a Client

1. Navigate to **Clients** from the sidebar
2. Click **Add Client** button
3. Fill in the form:
   - **Name**: Client's company name
   - **Email**: Unique email (used for login)
   - **Phone**: Contact number (optional)
   - **Password**: Secure password for client portal access
4. Click **Create Client**

### Viewing Client Details

1. Go to **Clients** page
2. Click on any client card
3. View:
   - Client information (email, phone, dates)
   - Statistics (projects, supervisors, staff)
   - Associated projects list
   - Associated supervisors list
   - Associated staff list

### Editing a Client

1. Open client detail page
2. Click **Edit** button
3. Modify fields (leave password blank to keep current)
4. Toggle **Active client** checkbox to activate/deactivate
5. Click **Update Client**

### Deleting a Client

1. Open client detail page
2. Click **Delete** button
3. Confirm deletion

**Note**: You cannot delete a client that has associated projects, supervisors, or staff. You must first reassign or remove these resources.

### Searching and Filtering

On the Clients page, you can:
- **Search**: By name, email, or phone
- **Filter by Status**: All, Active, or Inactive
- **Sort by**: Date, Name, or Email

## Hierarchy Management

### Linking Resources to Clients

When creating or editing resources, you can now assign them to clients:

#### Projects
```sql
-- Update a project to belong to a client
UPDATE projects 
SET client_id = '<client-uuid>' 
WHERE id = '<project-uuid>';
```

#### Supervisors
```sql
-- Update a supervisor to belong to a client
UPDATE supervisors 
SET client_id = '<client-uuid>' 
WHERE id = '<supervisor-uuid>';
```

#### Staff/Employees
```sql
-- Update staff to belong to a client
UPDATE employees 
SET client_id = '<client-uuid>' 
WHERE id = '<employee-uuid>';
```

## API Endpoints

### Client Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/clients` | Get all clients with counts |
| GET | `/api/admin/clients/:id` | Get client details with associated resources |
| POST | `/api/admin/clients` | Create new client |
| PUT | `/api/admin/clients/:id` | Update client |
| DELETE | `/api/admin/clients/:id` | Delete client |
| GET | `/api/admin/clients/:id/stats` | Get client statistics |

### Query Parameters (GET /api/admin/clients)

- `search`: Search by name, email, or phone
- `isActive`: Filter by active status (true/false)
- `sortBy`: Sort field (name, email, created_at)
- `sortOrder`: Sort order (ASC, DESC)

## Security Features

1. **Password Hashing**: Client passwords are hashed using bcrypt
2. **Email Validation**: Email format is validated
3. **Unique Constraints**: Email must be unique
4. **Cascade Protection**: Cannot delete clients with associated resources
5. **Audit Trail**: Tracks who created/updated each client

## Data Model

### Clients Table

```sql
clients (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES admins(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES admins(id)
)
```

### Relationships

- **One-to-Many**: Client → Projects
- **One-to-Many**: Client → Supervisors
- **One-to-Many**: Client → Staff/Employees

## Future Enhancements

Consider these improvements:

1. **Client Portal**: Separate login portal for clients to view their data
2. **Client Dashboards**: Custom dashboards per client
3. **Client Reports**: Generate reports specific to each client
4. **Multi-tenant**: Full multi-tenancy with data isolation
5. **Client Billing**: Track billing and invoicing per client
6. **Client Documents**: Upload and manage client-specific documents

## Troubleshooting

### Issue: Cannot create client

**Solution**: 
- Check if email already exists
- Ensure password is at least 6 characters
- Verify backend is running and connected to database

### Issue: Cannot delete client

**Solution**: 
- Check if client has associated projects, supervisors, or staff
- Reassign or delete these resources first
- Or update the foreign keys to SET NULL instead of CASCADE

### Issue: Client not showing in list

**Solution**: 
- Check if filters are applied (Active/Inactive)
- Try clearing search query
- Verify client exists in database: `SELECT * FROM clients;`

## Support

For issues or questions:
1. Check the backend logs: `backend/server.js`
2. Check browser console for frontend errors
3. Verify database migrations were run successfully
4. Ensure environment variables are set correctly

---

**Version**: 1.0.0  
**Last Updated**: December 16, 2025

