# Client Module - Quick Start Guide

## 🚀 Setup Steps

### 1. Database Setup (Supabase)

Run this SQL script in your Supabase SQL Editor:

```sql
-- Located at: backend/SUPABASE_CLIENT_MODULE.sql
```

Or run the individual migration files:
- `backend/migrations/017_create_clients_table.sql`
- `backend/migrations/018_add_client_id_to_tables.sql`

### 2. Restart Backend Server

```bash
cd c:/projects/Construction-Workforce/attendance-app/flutter_attendance/backend
npm start
```

**Important**: The backend MUST be restarted to load the new client routes!

### 3. Restart Admin Portal

```bash
cd c:/projects/Construction-Workforce/attendance-app/admin-portal
npm run dev
```

### 4. Test the Feature

1. **Login to Admin Portal**: http://localhost:3001 (or your port)
2. **Navigate to Clients**: Click "Clients" in the sidebar
3. **Add New Client**: Click "Add Client" button
4. **Fill Form**:
   - Name: Test Client Co.
   - Email: test@client.com
   - Phone: +65 1234 5678
   - Password: password123
5. **Click "Create Client"**

## ✅ Verification Checklist

- [ ] Backend server restarted successfully
- [ ] Admin portal restarted successfully
- [ ] Can see "Clients" menu item in sidebar
- [ ] Can access /clients page
- [ ] Can create a new client
- [ ] Can view client details
- [ ] Can edit client
- [ ] Can see client statistics

## 🔍 Troubleshooting

### Issue: "Unauthorized" Error

**Causes**:
1. Backend server not restarted after adding routes
2. Not logged in as admin
3. Token expired

**Solutions**:
```bash
# 1. Restart backend server
cd backend
npm start

# 2. Clear browser cookies and login again
# 3. Check backend logs for detailed error
```

### Issue: "Client routes not found"

**Solution**: 
- Verify `adminClients.js` is in `backend/routes/`
- Verify `server.js` includes the client routes
- Restart backend server

### Issue: Database errors

**Solution**:
```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('clients');

-- Check columns
SELECT column_name, table_name
FROM information_schema.columns
WHERE column_name = 'client_id';
```

## 📊 Test Data

After setup, you can create test clients with these details:

**Client 1**:
- Name: ABC Construction Ltd
- Email: contact@abcconstruction.com
- Phone: +65 6123 4567
- Password: password123

**Client 2**:
- Name: XYZ Engineering Pte Ltd
- Email: info@xyzeng.com
- Phone: +65 6234 5678
- Password: password123

## 🎯 Next Steps

1. **Link Projects to Clients**:
   - Go to Projects page
   - Edit a project
   - Assign it to a client

2. **Link Supervisors to Clients**:
   ```sql
   UPDATE supervisors 
   SET client_id = '<client-uuid>' 
   WHERE id = '<supervisor-uuid>';
   ```

3. **Link Staff to Clients**:
   ```sql
   UPDATE employees 
   SET client_id = '<client-uuid>' 
   WHERE id = '<employee-uuid>';
   ```

## 🔗 API Endpoints

Test these endpoints with Postman or curl:

```bash
# Get all clients
GET http://localhost:3000/api/admin/clients
Authorization: Bearer <your-token>

# Create client
POST http://localhost:3000/api/admin/clients
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "name": "Test Client",
  "email": "test@example.com",
  "phone": "+65 1234 5678",
  "password": "password123"
}

# Get client by ID
GET http://localhost:3000/api/admin/clients/:id
Authorization: Bearer <your-token>

# Update client
PUT http://localhost:3000/api/admin/clients/:id
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "name": "Updated Name",
  "is_active": true
}

# Delete client
DELETE http://localhost:3000/api/admin/clients/:id
Authorization: Bearer <your-token>

# Get client stats
GET http://localhost:3000/api/admin/clients/:id/stats
Authorization: Bearer <your-token>
```

## 📝 Features Implemented

✅ **Backend**:
- CRUD operations for clients
- Authentication with admin middleware
- Password hashing with bcrypt
- Email uniqueness validation
- Cascade delete protection
- Audit trail (created_by, updated_by)

✅ **Frontend**:
- Client list page with search & filters
- Client detail page with statistics
- Add/Edit client forms
- Delete with confirmation
- Responsive design
- Real-time statistics

✅ **Database**:
- Clients table with proper schema
- Foreign keys to projects, supervisors, employees
- Indexes for performance
- Auto-updating timestamps

## 🎨 UI Features

- **Search**: By name, email, or phone
- **Filters**: Active/Inactive status
- **Sort**: By name, email, or date
- **Cards**: Beautiful client cards with counts
- **Stats**: Real-time project, supervisor, staff counts
- **Details**: Complete client information page

---

**Need Help?** Check `CLIENT_MODULE_SETUP.md` for detailed documentation.

