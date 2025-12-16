# Sample Client Data Setup

This script creates sample client accounts with projects for testing the client portal.

## Quick Setup

### Option 1: Using Node.js Script (Recommended)

```bash
cd flutter_attendance/backend
node scripts/createSampleClients.js
```

### Option 2: Using SQL Migration

Run the SQL migration file in Supabase SQL Editor:
```
migrations/020_create_sample_clients.sql
```

**Note:** The SQL version uses a placeholder password hash. For proper security, use the Node.js script which generates correct bcrypt hashes.

## Sample Client Credentials

All sample clients use the same password: **`Client@123`**

### Client 1: ABC Construction
- **Email:** `client1@abcconstruction.com`
- **Password:** `Client@123`
- **Projects:** 2 projects
  - Residential Tower A
  - Commercial Complex B

### Client 2: XYZ Builders
- **Email:** `client2@xyzbuilders.com`
- **Password:** `Client@123`
- **Projects:** 2 projects
  - Industrial Warehouse
  - Office Building Renovation

### Client 3: Modern Construction
- **Email:** `client3@modernconstruction.com`
- **Password:** `Client@123`
- **Projects:** 1 project
  - Luxury Condominium

## Testing Client Portal

1. Go to `http://localhost:3000/client-login`
2. Login with any of the sample client credentials above
3. You should see only the projects assigned to that specific client
4. Each client will only see their own projects (filtered by `client_user_id`)

## Verification

After running the script, verify the data:

```sql
-- Check clients
SELECT u.email, u.name, c.company_name, COUNT(p.id) as project_count
FROM users u
LEFT JOIN clients c ON c.user_id = u.id
LEFT JOIN projects p ON p.client_user_id = u.id
WHERE u.role = 'client'
GROUP BY u.id, u.email, u.name, c.company_name;

-- Check projects per client
SELECT 
  u.email as client_email,
  p.name as project_name,
  p.location,
  p.budget
FROM users u
INNER JOIN projects p ON p.client_user_id = u.id
WHERE u.role = 'client'
ORDER BY u.email, p.name;
```

## Security Note

The password `Client@123` is for **development/testing only**. In production:
- Use strong, unique passwords for each client
- Consider implementing password reset functionality
- Never commit real passwords to version control

