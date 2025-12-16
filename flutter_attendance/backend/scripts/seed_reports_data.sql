-- ============================================
-- Seed Sample Data for Reports Page
-- Populates projects with budget, spent, completion
-- Assigns employees to projects
-- Creates attendance records with hours
-- ============================================

-- Step 1: Ensure projects have start_date and end_date, then update with budget
-- Note: Status is calculated dynamically in the frontend based on dates
DO $$
DECLARE
  proj_record RECORD;
  budget_val DOUBLE PRECISION;
  start_date_val DATE;
  end_date_val DATE;
  project_counter INTEGER := 0;
BEGIN
  FOR proj_record IN SELECT id, name, start_date, end_date FROM projects
  LOOP
    project_counter := project_counter + 1;
    
    -- Generate random budget between 500K and 10M
    budget_val := 500000 + (RANDOM() * 9500000);
    
    -- Set dates if missing
    IF proj_record.start_date IS NULL THEN
      -- Start date: between 6 months ago and 1 month ago
      start_date_val := CURRENT_DATE - (180 + (RANDOM() * 150))::INTEGER;
    ELSE
      start_date_val := proj_record.start_date;
    END IF;
    
    IF proj_record.end_date IS NULL THEN
      -- End date: between 3 months from start and 12 months from start
      end_date_val := start_date_val + (90 + (RANDOM() * 270))::INTEGER;
    ELSE
      end_date_val := proj_record.end_date;
    END IF;
    
    -- Update project with budget and dates
    -- Note: Status is calculated dynamically in the frontend based on dates
    UPDATE projects
    SET 
      budget = budget_val,
      start_date = start_date_val,
      end_date = end_date_val,
      description = COALESCE(description, 'Construction project')
    WHERE id = proj_record.id;
    
  END LOOP;
  
  RAISE NOTICE 'Updated % projects with budget and dates', project_counter;
END $$;

-- Step 2: Ensure employees have emails (create if missing)
DO $$
DECLARE
  emp_record RECORD;
  email_counter INTEGER := 0;
BEGIN
  FOR emp_record IN SELECT id, name, email FROM employees WHERE email IS NULL OR email = ''
  LOOP
    -- Generate email from name
    UPDATE employees
    SET email = LOWER(REPLACE(emp_record.name, ' ', '.') || '@construction.com')
    WHERE id = emp_record.id;
    email_counter := email_counter + 1;
  END LOOP;
  
  IF email_counter > 0 THEN
    RAISE NOTICE 'Created emails for % employees', email_counter;
  END IF;
END $$;

-- Step 3: Assign employees to projects (distribute evenly across projects)
DO $$
DECLARE
  emp_record RECORD;
  proj_record RECORD;
  project_list UUID[];
  project_index INTEGER;
  emp_counter INTEGER := 0;
BEGIN
  -- Get list of all project IDs
  SELECT ARRAY_AGG(id) INTO project_list FROM projects;
  
  IF project_list IS NULL OR array_length(project_list, 1) = 0 THEN
    RAISE NOTICE 'No projects found, skipping employee assignment';
    RETURN;
  END IF;
  
  -- Assign employees to projects (distribute evenly)
  project_index := 1;
  FOR emp_record IN SELECT id FROM employees WHERE project_id IS NULL OR project_id NOT IN (SELECT id FROM projects)
  LOOP
    -- Cycle through projects
    IF project_index > array_length(project_list, 1) THEN
      project_index := 1;
    END IF;
    
    UPDATE employees
    SET project_id = project_list[project_index]
    WHERE id = emp_record.id;
    
    project_index := project_index + 1;
    emp_counter := emp_counter + 1;
  END LOOP;
  
  -- Also ensure employees with projects are still valid
  UPDATE employees
  SET project_id = (SELECT id FROM projects ORDER BY RANDOM() LIMIT 1)
  WHERE project_id IS NOT NULL 
    AND project_id NOT IN (SELECT id FROM projects);
  
  RAISE NOTICE 'Assigned % employees to projects', emp_counter;
END $$;

-- Step 4: Create users for employees (if they don't exist)
DO $$
DECLARE
  emp_record RECORD;
  user_count INTEGER := 0;
  existing_count INTEGER;
BEGIN
  FOR emp_record IN SELECT DISTINCT email FROM employees WHERE email IS NOT NULL AND email != ''
  LOOP
    -- Check if user exists
    SELECT COUNT(*) INTO existing_count FROM users WHERE email = emp_record.email;
    
    IF existing_count = 0 THEN
      INSERT INTO users (id, email, password_hash, created_at)
      VALUES (
        gen_random_uuid(),
        emp_record.email,
        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyY5Y5Y5Y5Y5Y', -- password: worker123
        NOW()
      );
      user_count := user_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Created/verified users for employees (created % new users)', user_count;
END $$;

-- Step 5: Create attendance records with hours for the last 90 days
DO $$
DECLARE
  emp_record RECORD;
  proj_record RECORD;
  work_date DATE;
  check_in_time TIMESTAMPTZ;
  check_out_time TIMESTAMPTZ;
  days_back INTEGER;
  rand_val NUMERIC;
  user_record RECORD;
  user_id_val UUID;
BEGIN
  -- Loop through employees
  FOR emp_record IN SELECT e.id, e.email, e.project_id FROM employees e WHERE e.email IS NOT NULL LIMIT 50
  LOOP
    -- Find or create user for this employee
    SELECT u.id INTO user_record FROM users u WHERE u.email = emp_record.email LIMIT 1;
    
    IF user_record.id IS NULL THEN
      -- Create user if doesn't exist
      user_id_val := gen_random_uuid();
      INSERT INTO users (id, email, password_hash, created_at)
      VALUES (
        user_id_val,
        emp_record.email,
        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyY5Y5Y5Y5Y5Y', -- password: worker123
        NOW()
      )
      ON CONFLICT (email) DO UPDATE SET id = users.id
      RETURNING id INTO user_id_val;
      
      -- Get the user ID after insert/update
      SELECT u.id INTO user_record FROM users u WHERE u.email = emp_record.email LIMIT 1;
    ELSE
      user_id_val := user_record.id;
    END IF;
    
    -- Ensure employee has a project assigned
    IF emp_record.project_id IS NULL THEN
      -- Assign to random project
      SELECT id INTO proj_record FROM projects ORDER BY RANDOM() LIMIT 1;
      IF proj_record.id IS NOT NULL THEN
        UPDATE employees SET project_id = proj_record.id WHERE id = emp_record.id;
      END IF;
    END IF;
    
    -- Create attendance records for the last 90 days (but focus on last 30 for better data density)
    FOR days_back IN 0..89
    LOOP
      work_date := CURRENT_DATE - days_back;
      
      -- Skip weekends randomly (80% chance of working on weekdays, 20% on weekends)
      rand_val := RANDOM();
      IF EXTRACT(DOW FROM work_date) IN (0, 6) THEN
        -- Weekend - 20% chance of working
        IF rand_val > 0.2 THEN
          CONTINUE;
        END IF;
      ELSE
        -- Weekday - 80% chance of working
        IF rand_val > 0.8 THEN
          CONTINUE;
        END IF;
      END IF;
      
      -- Random check-in time between 7 AM and 9 AM
      check_in_time := work_date + (7 + RANDOM() * 2) * INTERVAL '1 hour' + RANDOM() * 60 * INTERVAL '1 minute';
      
      -- Random check-out time between 4 PM and 7 PM (8-10 hours later)
      check_out_time := check_in_time + (8 + RANDOM() * 2) * INTERVAL '1 hour' + RANDOM() * 60 * INTERVAL '1 minute';
      
      -- Insert attendance record (avoid duplicates)
      INSERT INTO attendance_logs (
        id,
        user_id,
        check_in_time,
        check_out_time,
        latitude,
        longitude,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        user_id_val,
        check_in_time,
        check_out_time,
        1.3521 + (RANDOM() * 0.1), -- Singapore latitude range
        103.8198 + (RANDOM() * 0.1), -- Singapore longitude range
        work_date
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Created attendance records with hours';
END $$;

-- Step 6: Final cleanup (status is calculated dynamically in frontend)
-- No action needed - status is determined by dates in the reports page

-- Step 7: Ensure all projects have budget data
UPDATE projects
SET budget = 500000 + (RANDOM() * 2000000)
WHERE budget IS NULL;

-- Step 8: Display summary
DO $$
DECLARE
  total_projects INTEGER;
  projects_with_budget INTEGER;
  projects_with_staff INTEGER;
  total_attendance_records INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_projects FROM projects;
  SELECT COUNT(*) INTO projects_with_budget FROM projects WHERE budget IS NOT NULL AND budget > 0;
  SELECT COUNT(DISTINCT project_id) INTO projects_with_staff FROM employees WHERE project_id IS NOT NULL;
  SELECT COUNT(*) INTO total_attendance_records FROM attendance_logs WHERE check_out_time IS NOT NULL;
  
  RAISE NOTICE 'Reports seed completed:';
  RAISE NOTICE '  Total projects: %', total_projects;
  RAISE NOTICE '  Projects with budget: %', projects_with_budget;
  RAISE NOTICE '  Projects with staff: %', projects_with_staff;
  RAISE NOTICE '  Total attendance records: %', total_attendance_records;
END $$;
