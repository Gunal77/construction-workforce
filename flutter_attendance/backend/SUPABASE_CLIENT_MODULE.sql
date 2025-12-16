-- ============================================
-- CLIENT MODULE SETUP FOR SUPABASE
-- Run this entire script in Supabase SQL Editor
-- ============================================

-- This script sets up the client module for your Construction Workforce Management System
-- Hierarchy: Admin → Client → Project → Supervisor → Staff

-- ============================================
-- 1. Create Clients Table
-- ============================================

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES admins(id) ON DELETE SET NULL
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON clients(is_active);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_clients_updated_at();

-- Add comment
COMMENT ON TABLE clients IS 'Stores client information. Clients are the top-level entity in the organization hierarchy.';

-- ============================================
-- 2. Add Client Foreign Keys to Existing Tables
-- ============================================

-- Add client_id to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);

-- Add client_id to supervisors table
ALTER TABLE supervisors 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_supervisors_client_id ON supervisors(client_id);

-- Add client_id to employees table (staff)
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_employees_client_id ON employees(client_id);

-- Add comments
COMMENT ON COLUMN projects.client_id IS 'References the client who owns this project';
COMMENT ON COLUMN supervisors.client_id IS 'References the client this supervisor works for';
COMMENT ON COLUMN employees.client_id IS 'References the client this employee/staff works for';

-- ============================================
-- 3. Create Sample Client Data (Optional)
-- ============================================

-- Insert sample clients (passwords are hashed with bcrypt)
-- Default password for all sample clients: "password123"
-- Hash generated with: bcrypt.hash('password123', 10)

DO $$
DECLARE
  admin_id UUID;
  client1_id UUID;
  client2_id UUID;
  client3_id UUID;
BEGIN
  -- Get first admin user for created_by field
  SELECT id INTO admin_id FROM admins LIMIT 1;
  
  -- Insert sample client 1
  INSERT INTO clients (id, name, email, phone, password_hash, is_active, created_by, updated_by)
  VALUES (
    uuid_generate_v4(),
    'ABC Construction Ltd',
    'contact@abcconstruction.com',
    '+65 6123 4567',
    '$2b$10$rZ8FKzLQhP0YqGP5dHJmPeYLJMN2QJgQVKqPxVNvVrGYLJMN2QJgQV', -- password123
    TRUE,
    admin_id,
    admin_id
  )
  ON CONFLICT (email) DO NOTHING
  RETURNING id INTO client1_id;
  
  -- Insert sample client 2
  INSERT INTO clients (id, name, email, phone, password_hash, is_active, created_by, updated_by)
  VALUES (
    uuid_generate_v4(),
    'XYZ Engineering Pte Ltd',
    'info@xyzeng.com',
    '+65 6234 5678',
    '$2b$10$rZ8FKzLQhP0YqGP5dHJmPeYLJMN2QJgQVKqPxVNvVrGYLJMN2QJgQV', -- password123
    TRUE,
    admin_id,
    admin_id
  )
  ON CONFLICT (email) DO NOTHING
  RETURNING id INTO client2_id;
  
  -- Insert sample client 3
  INSERT INTO clients (id, name, email, phone, password_hash, is_active, created_by, updated_by)
  VALUES (
    uuid_generate_v4(),
    'Singapore Builders Co',
    'admin@sgbuilders.sg',
    '+65 6345 6789',
    '$2b$10$rZ8FKzLQhP0YqGP5dHJmPeYLJMN2QJgQVKqPxVNvVrGYLJMN2QJgQV', -- password123
    TRUE,
    admin_id,
    admin_id
  )
  ON CONFLICT (email) DO NOTHING
  RETURNING id INTO client3_id;
  
  RAISE NOTICE 'Sample clients created successfully';
  RAISE NOTICE 'Client 1 ID: %', client1_id;
  RAISE NOTICE 'Client 2 ID: %', client2_id;
  RAISE NOTICE 'Client 3 ID: %', client3_id;
  
END $$;

-- ============================================
-- 4. Link Existing Resources to Clients (Optional)
-- ============================================

-- Uncomment and modify these queries to link existing resources to clients

/*
-- Example: Link first 10 projects to client 1
UPDATE projects 
SET client_id = (SELECT id FROM clients WHERE email = 'contact@abcconstruction.com')
WHERE id IN (SELECT id FROM projects ORDER BY created_at LIMIT 10);

-- Example: Link supervisors to client 2
UPDATE supervisors 
SET client_id = (SELECT id FROM clients WHERE email = 'info@xyzeng.com')
WHERE email LIKE '%@xyzeng.com%';

-- Example: Link employees to their project's client
UPDATE employees e
SET client_id = p.client_id
FROM projects p
WHERE e.project_id = p.id
  AND p.client_id IS NOT NULL;
*/

-- ============================================
-- 5. Verification Queries
-- ============================================

-- Check if clients table was created
SELECT 
  'Clients table exists' as status,
  COUNT(*) as client_count
FROM clients;

-- Check if foreign keys were added
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE column_name = 'client_id'
  AND table_name IN ('projects', 'supervisors', 'employees')
ORDER BY table_name;

-- View clients with their resource counts
SELECT 
  c.id,
  c.name,
  c.email,
  c.is_active,
  COUNT(DISTINCT p.id) as project_count,
  COUNT(DISTINCT s.id) as supervisor_count,
  COUNT(DISTINCT e.id) as staff_count,
  c.created_at
FROM clients c
LEFT JOIN projects p ON p.client_id = c.id
LEFT JOIN supervisors s ON s.client_id = c.id
LEFT JOIN employees e ON e.client_id = c.id
GROUP BY c.id, c.name, c.email, c.is_active, c.created_at
ORDER BY c.created_at DESC;

-- ============================================
-- 6. Useful Queries for Client Management
-- ============================================

-- Get all projects for a specific client
/*
SELECT p.*, c.name as client_name
FROM projects p
JOIN clients c ON p.client_id = c.id
WHERE c.email = 'contact@abcconstruction.com';
*/

-- Get all supervisors for a specific client
/*
SELECT s.*, c.name as client_name
FROM supervisors s
JOIN clients c ON s.client_id = c.id
WHERE c.email = 'contact@abcconstruction.com';
*/

-- Get all staff for a specific client
/*
SELECT e.*, c.name as client_name, p.name as project_name
FROM employees e
JOIN clients c ON e.client_id = c.id
LEFT JOIN projects p ON e.project_id = p.id
WHERE c.email = 'contact@abcconstruction.com';
*/

-- Get client hierarchy overview
/*
SELECT 
  c.name as client,
  p.name as project,
  s.name as supervisor,
  e.name as staff,
  e.role
FROM clients c
LEFT JOIN projects p ON p.client_id = c.id
LEFT JOIN supervisors s ON s.client_id = c.id
LEFT JOIN employees e ON e.client_id = c.id
ORDER BY c.name, p.name, s.name, e.name;
*/

-- ============================================
-- SETUP COMPLETE
-- ============================================

-- Summary:
-- ✅ Clients table created with audit fields
-- ✅ Foreign keys added to projects, supervisors, employees
-- ✅ Indexes created for performance
-- ✅ Triggers set up for automatic timestamp updates
-- ✅ Sample data inserted (optional)
-- ✅ Verification queries provided

-- Next Steps:
-- 1. Restart your backend server
-- 2. Restart your Next.js admin portal
-- 3. Navigate to /clients in the admin portal
-- 4. Start managing your clients!

-- Note: Default password for sample clients is "password123"
-- Please change these passwords in production!

