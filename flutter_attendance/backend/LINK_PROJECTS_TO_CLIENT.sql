-- Link all existing projects to John Smith client
-- This script assigns all projects to the client user

-- Get John Smith's user ID
DO $$
DECLARE
  john_smith_id UUID;
BEGIN
  SELECT id INTO john_smith_id FROM users WHERE email = 'client1@abcconstruction.com' AND role = 'client';
  
  IF john_smith_id IS NULL THEN
    RAISE NOTICE 'John Smith client not found. Trying other clients...';
    SELECT id INTO john_smith_id FROM users WHERE role = 'client' LIMIT 1;
  END IF;
  
  IF john_smith_id IS NOT NULL THEN
    RAISE NOTICE 'Found client with ID: %', john_smith_id;
    
    -- Update all projects that don't have a client assigned
    UPDATE projects
    SET client_user_id = john_smith_id
    WHERE client_user_id IS NULL;
    
    RAISE NOTICE 'Linked projects to client';
    
    -- Update all supervisors that don't have a client assigned
    UPDATE supervisors
    SET client_user_id = john_smith_id
    WHERE client_user_id IS NULL;
    
    RAISE NOTICE 'Linked supervisors to client';
    
    -- Update all employees that don't have a client assigned
    UPDATE employees
    SET client_user_id = john_smith_id
    WHERE client_user_id IS NULL;
    
    RAISE NOTICE 'Linked employees/staff to client';
  ELSE
    RAISE NOTICE 'No client found!';
  END IF;
END $$;

-- Verify the links
SELECT 
  'Projects' as type,
  COUNT(*) as total_count,
  COUNT(client_user_id) as linked_count,
  COUNT(*) - COUNT(client_user_id) as unlinked_count
FROM projects
UNION ALL
SELECT 
  'Supervisors' as type,
  COUNT(*) as total_count,
  COUNT(client_user_id) as linked_count,
  COUNT(*) - COUNT(client_user_id) as unlinked_count
FROM supervisors
UNION ALL
SELECT 
  'Employees' as type,
  COUNT(*) as total_count,
  COUNT(client_user_id) as linked_count,
  COUNT(*) - COUNT(client_user_id) as unlinked_count
FROM employees;

-- Show client stats
SELECT 
  u.id,
  u.name,
  u.email,
  (SELECT COUNT(*) FROM projects WHERE client_user_id = u.id) as total_projects,
  (SELECT COUNT(*) FROM supervisors WHERE client_user_id = u.id) as total_supervisors,
  (SELECT COUNT(*) FROM employees WHERE client_user_id = u.id) as total_staff
FROM users u
WHERE u.role = 'client'
ORDER BY u.created_at DESC;

