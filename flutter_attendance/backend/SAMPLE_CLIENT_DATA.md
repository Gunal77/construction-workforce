# Sample Client Data

This document explains how to create sample client data for testing the client portal.

## Quick Start

### Method 1: Node.js Script (Recommended - Proper Password Hashing)

```bash
cd flutter_attendance/backend
node scripts/createSampleClients.js
```

This script will:
- Create 3 sample clients with proper bcrypt password hashing
- Create sample projects for each client
- Link projects to clients via `client_user_id`

### Method 2: SQL Migration

Run the SQL file in Supabase SQL Editor:
```
migrations/020_create_sample_clients.sql
```

**Note:** The SQL version uses placeholder password hashes. For production-like testing, use the Node.js script.

## Sample Client Credentials

**Password for all clients:** `Client@123`

| Email | Name | Company | Projects |
|-------|------|---------|----------|
| `client1@abcconstruction.com` | John Smith | ABC Construction Pte Ltd | 2 projects |
| `client2@xyzbuilders.com` | Sarah Johnson | XYZ Builders Singapore | 2 projects |
| `client3@modernconstruction.com` | Michael Chen | Modern Construction Group | 1 project |

## Testing the Client Portal

1. **Go to client login:** `http://localhost:3000/client-login`

2. **Login with any sample client:**
   - Email: `client1@abcconstruction.com`
   - Password: `Client@123`

3. **Verify client isolation:**
   - Each client should only see their own projects
   - Projects are filtered by `client_user_id` matching the logged-in client's user ID
   - Client 1 sees 2 projects
   - Client 2 sees 2 projects  
   - Client 3 sees 1 project

## How Client Filtering Works

The client portal uses the following flow:

1. **Client logs in** → JWT token contains client's user ID
2. **Client requests projects** → API fetches all projects from backend
3. **Filter by client_user_id** → Only projects where `client_user_id` matches the logged-in client's ID are returned
4. **Display filtered projects** → Client only sees their own projects

This ensures complete data isolation between clients.

## Verification Queries

After creating sample data, verify with these SQL queries:

```sql
-- Check all clients
SELECT 
  u.email,
  u.name,
  c.company_name,
  COUNT(p.id) as project_count
FROM users u
LEFT JOIN clients c ON c.user_id = u.id
LEFT JOIN projects p ON p.client_user_id = u.id
WHERE u.role = 'client'
GROUP BY u.id, u.email, u.name, c.company_name;

-- Check projects per client
SELECT 
  u.email as client_email,
  u.name as client_name,
  p.name as project_name,
  p.location,
  p.budget
FROM users u
INNER JOIN projects p ON p.client_user_id = u.id
WHERE u.role = 'client'
ORDER BY u.email, p.name;
```

## Files Created

- `migrations/020_create_sample_clients.sql` - SQL migration for sample data
- `scripts/createSampleClients.js` - Node.js script with proper bcrypt hashing
- `scripts/README_SAMPLE_CLIENTS.md` - Detailed documentation

## Security Notes

⚠️ **Development Only:** The password `Client@123` is for testing purposes only.

For production:
- Use strong, unique passwords for each client
- Implement password reset functionality
- Never commit real passwords to version control
- Consider implementing 2FA for client accounts

