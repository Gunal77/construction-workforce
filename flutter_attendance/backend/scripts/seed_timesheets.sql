-- ============================================
-- Seed Sample Timesheet Data
-- Run this after creating the timesheets table
-- ============================================

-- Check if we have employees and projects
DO $$
DECLARE
  emp_count INTEGER;
  proj_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO emp_count FROM employees;
  SELECT COUNT(*) INTO proj_count FROM projects;
  
  IF emp_count = 0 THEN
    RAISE EXCEPTION 'No employees found. Please seed employees first.';
  END IF;
  
  IF proj_count = 0 THEN
    RAISE EXCEPTION 'No projects found. Please seed projects first.';
  END IF;
  
  RAISE NOTICE 'Found % employees and % projects', emp_count, proj_count;
END $$;

-- Get sample employees and projects
DO $$
DECLARE
  emp_record RECORD;
  proj_record RECORD;
  v_work_date DATE;
  v_check_in_time TIMESTAMPTZ;
  v_check_out_time TIMESTAMPTZ;
  days_back INTEGER;
  rand_val NUMERIC;
  task_type_val TEXT;
  status_val TEXT;
  approval_status_val TEXT;
BEGIN
  -- Loop through employees and create timesheets for the last 30 days
  FOR emp_record IN SELECT id, name FROM employees LIMIT 10
  LOOP
    -- Get a random project for this employee
    SELECT id INTO proj_record FROM projects ORDER BY RANDOM() LIMIT 1;
    
    IF proj_record.id IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Create timesheets for the last 30 days (some days with attendance, some without)
    FOR days_back IN 0..29
    LOOP
      v_work_date := CURRENT_DATE - days_back;
      
      -- Skip weekends randomly (70% chance of working on weekdays, 30% on weekends)
      rand_val := RANDOM();
      IF EXTRACT(DOW FROM v_work_date) IN (0, 6) THEN
        -- Weekend - 30% chance of working
        IF rand_val > 0.3 THEN
          CONTINUE;
        END IF;
      ELSE
        -- Weekday - 70% chance of working
        IF rand_val > 0.7 THEN
          CONTINUE;
        END IF;
      END IF;
      
      -- Random check-in time between 7 AM and 9 AM
      v_check_in_time := v_work_date + (7 + RANDOM() * 2) * INTERVAL '1 hour' + RANDOM() * 60 * INTERVAL '1 minute';
      
      -- Random check-out time between 4 PM and 7 PM (8-10 hours later)
      v_check_out_time := v_check_in_time + (8 + RANDOM() * 2) * INTERVAL '1 hour' + RANDOM() * 60 * INTERVAL '1 minute';
      
      -- Determine task type
      rand_val := RANDOM();
      IF rand_val > 0.5 THEN
        task_type_val := 'Construction';
      ELSIF rand_val > 0.25 THEN
        task_type_val := 'Maintenance';
      ELSE
        task_type_val := 'Installation';
      END IF;
      
      -- Determine status
      rand_val := RANDOM();
      IF rand_val > 0.9 THEN
        status_val := 'Half-Day';
      ELSE
        status_val := 'Present';
      END IF;
      
      -- Determine approval status
      rand_val := RANDOM();
      IF rand_val > 0.7 THEN
        approval_status_val := 'Draft';
      ELSIF rand_val > 0.5 THEN
        approval_status_val := 'Submitted';
      ELSIF rand_val > 0.3 THEN
        approval_status_val := 'Approved';
      ELSE
        approval_status_val := 'Rejected';
      END IF;
      
      -- Insert timesheet
      INSERT INTO timesheets (
        staff_id,
        work_date,
        check_in,
        check_out,
        project_id,
        task_type,
        status,
        approval_status,
        remarks,
        created_at
      ) VALUES (
        emp_record.id,
        v_work_date,
        v_check_in_time,
        v_check_out_time,
        proj_record.id,
        task_type_val,
        status_val,
        approval_status_val,
        CASE WHEN RANDOM() > 0.8 THEN 'Regular work day' ELSE NULL END,
        NOW() - (days_back || ' days')::INTERVAL
      )
      ON CONFLICT (staff_id, work_date) DO NOTHING;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Timesheet seed data created successfully';
END $$;

-- Update OT approval status for timesheets with overtime
UPDATE timesheets
SET ot_approval_status = CASE 
  WHEN overtime_hours > 0 AND approval_status = 'Approved' THEN 
    CASE 
      WHEN RANDOM() > 0.3 THEN 'Approved'
      WHEN RANDOM() > 0.5 THEN 'Pending'
      ELSE 'Rejected'
    END
  ELSE NULL
END
WHERE overtime_hours > 0;

-- Add some OT justification for pending/rejected OT
UPDATE timesheets
SET ot_justification = CASE 
  WHEN ot_approval_status = 'Pending' THEN 'Urgent project deadline'
  WHEN ot_approval_status = 'Rejected' THEN 'Insufficient justification provided'
  ELSE ot_justification
END
WHERE overtime_hours > 0 AND ot_approval_status IN ('Pending', 'Rejected');

-- Display summary
DO $$
DECLARE
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM timesheets;
  RAISE NOTICE 'Timesheet seed completed with % total entries', total_count;
END $$;

