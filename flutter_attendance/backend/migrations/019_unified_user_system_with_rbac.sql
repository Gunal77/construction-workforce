-- ============================================
-- UNIFIED USER SYSTEM WITH PROPER RBAC
-- This migration unifies all authentication into the users table
-- ============================================

-- Step 1: Add role and metadata columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'staff',
ADD COLUMN IF NOT EXISTS user_type TEXT, -- admin, client, supervisor, staff
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS profile_id UUID, -- Links to specific profile table
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add constraint for valid roles
ALTER TABLE users 
ADD CONSTRAINT check_user_role 
CHECK (role IN ('admin', 'client', 'supervisor', 'staff'));

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Add comments
COMMENT ON COLUMN users.role IS 'User role for RBAC: admin, client, supervisor, staff';
COMMENT ON COLUMN users.user_type IS 'Type of user account';
COMMENT ON COLUMN users.profile_id IS 'UUID linking to role-specific profile table';

-- ============================================
-- Step 2: Add user_id to profile tables (linking back to users)
-- ============================================

-- Add user_id to admins table
ALTER TABLE admins 
ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE;

-- Add user_id to supervisors table
ALTER TABLE supervisors 
ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE;

-- Add user_id to employees table  
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE;

-- Create indexes for user_id foreign keys
CREATE INDEX IF NOT EXISTS idx_admins_user_id ON admins(user_id);
CREATE INDEX IF NOT EXISTS idx_supervisors_user_id ON supervisors(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);

-- ============================================
-- Step 3: Drop the separate clients table and use users
-- ============================================

-- Drop clients table (we'll recreate it as a profile table)
DROP TABLE IF EXISTS clients CASCADE;

-- Create clients as a profile table (no password_hash)
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  address TEXT,
  tax_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at);

COMMENT ON TABLE clients IS 'Client profile data (auth is in users table)';

-- ============================================
-- Step 4: Update foreign keys to reference users instead of role tables
-- ============================================

-- Update projects to reference users.id for client
-- First add the new column
ALTER TABLE projects 
DROP COLUMN IF EXISTS client_id CASCADE;

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS client_user_id UUID REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_projects_client_user_id ON projects(client_user_id);

-- Update supervisors client_id to reference users
ALTER TABLE supervisors 
DROP COLUMN IF EXISTS client_id CASCADE;

ALTER TABLE supervisors
ADD COLUMN IF NOT EXISTS client_user_id UUID REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_supervisors_client_user_id ON supervisors(client_user_id);

-- Update employees client_id to reference users
ALTER TABLE employees 
DROP COLUMN IF EXISTS client_id CASCADE;

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS client_user_id UUID REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_employees_client_user_id ON employees(client_user_id);

-- ============================================
-- Step 5: Migrate existing data to unified system
-- ============================================

-- Migrate admins to users table
INSERT INTO users (id, email, password_hash, role, user_type, name, phone, created_at)
SELECT 
  uuid_generate_v4() as id,
  a.email,
  a.password_hash,
  'admin' as role,
  'admin' as user_type,
  a.name,
  a.phone,
  a.created_at
FROM admins a
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.email = a.email)
ON CONFLICT (email) DO NOTHING;

-- Update admins table to link to users
UPDATE admins a
SET user_id = u.id
FROM users u
WHERE u.email = a.email AND a.user_id IS NULL;

-- Update users.profile_id to point to admins
UPDATE users u
SET profile_id = a.id
FROM admins a
WHERE a.user_id = u.id AND u.role = 'admin';

-- Migrate supervisors to users table
INSERT INTO users (id, email, password_hash, role, user_type, name, phone, created_at)
SELECT 
  uuid_generate_v4() as id,
  s.email,
  s.password_hash,
  'supervisor' as role,
  'supervisor' as user_type,
  s.name,
  s.phone,
  s.created_at
FROM supervisors s
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.email = s.email)
ON CONFLICT (email) DO NOTHING;

-- Update supervisors table to link to users
UPDATE supervisors s
SET user_id = u.id
FROM users u
WHERE u.email = s.email AND s.user_id IS NULL;

-- Update users.profile_id to point to supervisors
UPDATE users u
SET profile_id = s.id
FROM supervisors s
WHERE s.user_id = u.id AND u.role = 'supervisor';

-- Migrate employees to users table
INSERT INTO users (id, email, password_hash, role, user_type, name, phone, created_at)
SELECT 
  uuid_generate_v4() as id,
  e.email,
  COALESCE(eu.password_hash, '$2b$10$rZ8FKzLQhP0YqGP5dHJmPeYLJMN2QJgQVKqPxVNvVrGYLJMN2QJgQV') as password_hash,
  'staff' as role,
  'staff' as user_type,
  e.name,
  e.phone,
  e.created_at
FROM employees e
LEFT JOIN users eu ON eu.email = e.email
WHERE e.email IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.email = e.email AND u2.role IN ('admin', 'supervisor'))
ON CONFLICT (email) DO NOTHING;

-- Update employees table to link to users
UPDATE employees e
SET user_id = u.id
FROM users u
WHERE u.email = e.email AND e.user_id IS NULL;

-- Update users.profile_id to point to employees
UPDATE users u
SET profile_id = e.id
FROM employees e
WHERE e.user_id = u.id AND u.role = 'staff';

-- ============================================
-- Step 6: Clean up - Remove password_hash from profile tables (optional, safer to keep for now)
-- ============================================

-- We keep password_hash in profile tables for now for backwards compatibility
-- Can remove later once migration is verified:
-- ALTER TABLE admins DROP COLUMN IF EXISTS password_hash;
-- ALTER TABLE supervisors DROP COLUMN IF EXISTS password_hash;

-- ============================================
-- Step 7: Create unified authentication view
-- ============================================

CREATE OR REPLACE VIEW user_auth_view AS
SELECT 
  u.id,
  u.email,
  u.password_hash,
  u.role,
  u.user_type,
  u.name,
  u.phone,
  u.is_active,
  u.profile_id,
  u.created_at,
  u.updated_at,
  -- Profile specific data
  CASE 
    WHEN u.role = 'admin' THEN (SELECT row_to_json(a.*) FROM admins a WHERE a.user_id = u.id)
    WHEN u.role = 'client' THEN (SELECT row_to_json(c.*) FROM clients c WHERE c.user_id = u.id)
    WHEN u.role = 'supervisor' THEN (SELECT row_to_json(s.*) FROM supervisors s WHERE s.user_id = u.id)
    WHEN u.role = 'staff' THEN (SELECT row_to_json(e.*) FROM employees e WHERE e.user_id = u.id)
  END as profile_data
FROM users u
WHERE u.is_active = TRUE;

COMMENT ON VIEW user_auth_view IS 'Unified view for authentication with role-specific profile data';

-- ============================================
-- Step 8: Create trigger to update updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_users_updated_at ON users;
CREATE TRIGGER trigger_update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();

-- ============================================
-- Verification Queries
-- ============================================

-- Show unified user structure
SELECT 
  role,
  user_type,
  COUNT(*) as user_count
FROM users
GROUP BY role, user_type
ORDER BY role;

-- Verify linking
SELECT 
  'Admins linked: ' || COUNT(*) as status
FROM admins 
WHERE user_id IS NOT NULL;

SELECT 
  'Supervisors linked: ' || COUNT(*) as status
FROM supervisors 
WHERE user_id IS NOT NULL;

SELECT 
  'Employees linked: ' || COUNT(*) as status
FROM employees 
WHERE user_id IS NOT NULL;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- 
-- New Structure:
-- ✅ users table = central auth with role-based access control
-- ✅ admins, supervisors, employees, clients = profile tables
-- ✅ All profile tables link to users via user_id
-- ✅ One authentication flow
-- ✅ Proper RBAC with role column
-- ✅ Hierarchical client assignments via client_user_id
--
-- Next Steps:
-- 1. Update backend auth routes to use unified login
-- 2. Update middleware to check users.role
-- 3. Test login for each role
-- ============================================

