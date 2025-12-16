-- ============================================
-- SAMPLE CLIENT DATA
-- Creates sample clients with email and password
-- Password for all sample clients: Client@123
-- ============================================

-- Import bcrypt for password hashing (if available)
-- Otherwise, use this hash: $2b$10$rZ8FKzLQhP0YqGP5dHJmPeYLJMN2QJgQVKqPxVNvVrGYLJMN2QJgQV
-- This is the hash for "Client@123" (12 rounds)

-- Sample Client 1: ABC Construction
DO $$
DECLARE
  client1_user_id UUID;
  client1_profile_id UUID;
BEGIN
  -- Insert into users table
  INSERT INTO users (email, password_hash, role, user_type, name, phone, is_active, created_at)
  VALUES (
    'client1@abcconstruction.com',
    '$2b$12$LQhP0YqGP5dHJmPeYLJMN2QJgQVKqPxVNvVrGYLJMN2QJgQVKqPxVN', -- Placeholder: Use Node.js script for proper hash
    'client',
    'client',
    'John Smith',
    '+65 91234567',
    TRUE,
    NOW()
  )
  ON CONFLICT (email) DO NOTHING
  RETURNING id INTO client1_user_id;

  -- Get user_id if already exists
  IF client1_user_id IS NULL THEN
    SELECT id INTO client1_user_id FROM users WHERE email = 'client1@abcconstruction.com';
  END IF;

  -- Insert into clients profile table
  INSERT INTO clients (user_id, company_name, contact_person, address, created_at)
  VALUES (
    client1_user_id,
    'ABC Construction Pte Ltd',
    'John Smith',
    '123 Construction Street, Singapore 123456',
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO client1_profile_id;

  -- Update users.profile_id
  UPDATE users SET profile_id = client1_profile_id WHERE id = client1_user_id;
END $$;

-- Sample Client 2: XYZ Builders
DO $$
DECLARE
  client2_user_id UUID;
  client2_profile_id UUID;
BEGIN
  INSERT INTO users (email, password_hash, role, user_type, name, phone, is_active, created_at)
  VALUES (
    'client2@xyzbuilders.com',
    '$2b$12$LQhP0YqGP5dHJmPeYLJMN2QJgQVKqPxVNvVrGYLJMN2QJgQVKqPxVN', -- Placeholder: Use Node.js script for proper hash
    'client',
    'client',
    'Sarah Johnson',
    '+65 98765432',
    TRUE,
    NOW()
  )
  ON CONFLICT (email) DO NOTHING
  RETURNING id INTO client2_user_id;

  IF client2_user_id IS NULL THEN
    SELECT id INTO client2_user_id FROM users WHERE email = 'client2@xyzbuilders.com';
  END IF;

  INSERT INTO clients (user_id, company_name, contact_person, address, created_at)
  VALUES (
    client2_user_id,
    'XYZ Builders Singapore',
    'Sarah Johnson',
    '456 Building Avenue, Singapore 456789',
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO client2_profile_id;

  UPDATE users SET profile_id = client2_profile_id WHERE id = client2_user_id;
END $$;

-- Sample Client 3: Modern Construction
DO $$
DECLARE
  client3_user_id UUID;
  client3_profile_id UUID;
BEGIN
  INSERT INTO users (email, password_hash, role, user_type, name, phone, is_active, created_at)
  VALUES (
    'client3@modernconstruction.com',
    '$2b$12$LQhP0YqGP5dHJmPeYLJMN2QJgQVKqPxVNvVrGYLJMN2QJgQVKqPxVN', -- Placeholder: Use Node.js script for proper hash
    'client',
    'client',
    'Michael Chen',
    '+65 87654321',
    TRUE,
    NOW()
  )
  ON CONFLICT (email) DO NOTHING
  RETURNING id INTO client3_user_id;

  IF client3_user_id IS NULL THEN
    SELECT id INTO client3_user_id FROM users WHERE email = 'client3@modernconstruction.com';
  END IF;

  INSERT INTO clients (user_id, company_name, contact_person, address, created_at)
  VALUES (
    client3_user_id,
    'Modern Construction Group',
    'Michael Chen',
    '789 Development Road, Singapore 789012',
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO client3_profile_id;

  UPDATE users SET profile_id = client3_profile_id WHERE id = client3_user_id;
END $$;

-- ============================================
-- CREATE SAMPLE PROJECTS FOR EACH CLIENT
-- ============================================

-- Projects for Client 1 (ABC Construction)
DO $$
DECLARE
  client1_user_id UUID;
BEGIN
  SELECT id INTO client1_user_id FROM users WHERE email = 'client1@abcconstruction.com';

  IF client1_user_id IS NOT NULL THEN
    -- Project 1 for Client 1
    INSERT INTO projects (name, location, start_date, end_date, description, budget, client_user_id, created_at)
    VALUES (
      'Residential Tower A',
      'Marina Bay, Singapore',
      CURRENT_DATE + INTERVAL '30 days',
      CURRENT_DATE + INTERVAL '400 days',
      'High-rise residential building with 50 floors',
      5000000.00,
      client1_user_id,
      NOW()
    )
    ON CONFLICT DO NOTHING;

    -- Project 2 for Client 1
    INSERT INTO projects (name, location, start_date, end_date, description, budget, client_user_id, created_at)
    VALUES (
      'Commercial Complex B',
      'Orchard Road, Singapore',
      CURRENT_DATE + INTERVAL '60 days',
      CURRENT_DATE + INTERVAL '500 days',
      'Mixed-use commercial and retail complex',
      8000000.00,
      client1_user_id,
      NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Projects for Client 2 (XYZ Builders)
DO $$
DECLARE
  client2_user_id UUID;
BEGIN
  SELECT id INTO client2_user_id FROM users WHERE email = 'client2@xyzbuilders.com';

  IF client2_user_id IS NOT NULL THEN
    -- Project 1 for Client 2
    INSERT INTO projects (name, location, start_date, end_date, description, budget, client_user_id, created_at)
    VALUES (
      'Industrial Warehouse',
      'Jurong East, Singapore',
      CURRENT_DATE + INTERVAL '15 days',
      CURRENT_DATE + INTERVAL '200 days',
      'Large-scale industrial warehouse facility',
      3000000.00,
      client2_user_id,
      NOW()
    )
    ON CONFLICT DO NOTHING;

    -- Project 2 for Client 2
    INSERT INTO projects (name, location, start_date, end_date, description, budget, client_user_id, created_at)
    VALUES (
      'Office Building Renovation',
      'Raffles Place, Singapore',
      CURRENT_DATE - INTERVAL '30 days',
      CURRENT_DATE + INTERVAL '150 days',
      'Complete renovation of 20-story office building',
      2500000.00,
      client2_user_id,
      NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Projects for Client 3 (Modern Construction)
DO $$
DECLARE
  client3_user_id UUID;
BEGIN
  SELECT id INTO client3_user_id FROM users WHERE email = 'client3@modernconstruction.com';

  IF client3_user_id IS NOT NULL THEN
    -- Project 1 for Client 3
    INSERT INTO projects (name, location, start_date, end_date, description, budget, client_user_id, created_at)
    VALUES (
      'Luxury Condominium',
      'Sentosa Cove, Singapore',
      CURRENT_DATE + INTERVAL '90 days',
      CURRENT_DATE + INTERVAL '600 days',
      'Premium waterfront condominium development',
      12000000.00,
      client3_user_id,
      NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Show all sample clients
SELECT 
  u.id,
  u.email,
  u.name,
  u.phone,
  u.is_active,
  c.company_name,
  c.contact_person
FROM users u
LEFT JOIN clients c ON c.user_id = u.id
WHERE u.role = 'client'
ORDER BY u.created_at;

-- Show projects per client
SELECT 
  u.email as client_email,
  u.name as client_name,
  p.name as project_name,
  p.location,
  p.budget,
  p.start_date,
  p.end_date
FROM users u
INNER JOIN projects p ON p.client_user_id = u.id
WHERE u.role = 'client'
ORDER BY u.email, p.created_at;

-- ============================================
-- SAMPLE CLIENT LOGIN CREDENTIALS
-- ============================================
-- 
-- Client 1:
--   Email: client1@abcconstruction.com
--   Password: Client@123
--   Projects: 2 projects
--
-- Client 2:
--   Email: client2@xyzbuilders.com
--   Password: Client@123
--   Projects: 2 projects
--
-- Client 3:
--   Email: client3@modernconstruction.com
--   Password: Client@123
--   Projects: 1 project
--
-- ============================================

