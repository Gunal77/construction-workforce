-- ============================================
-- Seed Leave Management Data
-- ============================================
-- This script creates sample leave balances and requests for testing

-- Step 1: Initialize leave balances for all employees for current year
-- This will create balances for Annual Leave (12 days), Sick Leave, and Unpaid Leave
SELECT initialize_leave_balances_for_current_year();

-- Step 2: Create sample leave requests with different statuses
-- Get some employee IDs (we'll use the first few employees)
DO $$
DECLARE
  emp_record RECORD;
  annual_leave_type_id UUID;
  sick_leave_type_id UUID;
  unpaid_leave_type_id UUID;
  current_year INTEGER;
  request_id UUID;
  emp_count INTEGER := 0;
  admin_id_val UUID;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Get leave type IDs
  SELECT id INTO annual_leave_type_id FROM leave_types WHERE code = 'ANNUAL' LIMIT 1;
  SELECT id INTO sick_leave_type_id FROM leave_types WHERE code = 'SICK' LIMIT 1;
  SELECT id INTO unpaid_leave_type_id FROM leave_types WHERE code = 'UNPAID' LIMIT 1;
  
  -- Get first admin ID (if exists)
  SELECT id INTO admin_id_val FROM admins ORDER BY created_at LIMIT 1;
  
  -- Create sample leave requests for first 10 employees
  FOR emp_record IN 
    SELECT id, name, email 
    FROM employees 
    ORDER BY created_at 
    LIMIT 10
  LOOP
    emp_count := emp_count + 1;
    
    -- Employee 1-3: Create PENDING requests
    IF emp_count <= 3 THEN
      -- Pending Annual Leave Request (future dates)
      INSERT INTO leave_requests (
        employee_id,
        leave_type_id,
        start_date,
        end_date,
        number_of_days,
        reason,
        status,
        created_at
      ) VALUES (
        emp_record.id,
        annual_leave_type_id,
        CURRENT_DATE + INTERVAL '7 days', -- Start in 7 days
        CURRENT_DATE + INTERVAL '9 days', -- 3 working days
        calculate_working_days(CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE + INTERVAL '9 days'),
        'Family vacation',
        'pending',
        CURRENT_TIMESTAMP - INTERVAL '2 days'
      );
      
      -- Pending Sick Leave Request
      INSERT INTO leave_requests (
        employee_id,
        leave_type_id,
        start_date,
        end_date,
        number_of_days,
        reason,
        status,
        created_at
      ) VALUES (
        emp_record.id,
        sick_leave_type_id,
        CURRENT_DATE + INTERVAL '14 days',
        CURRENT_DATE + INTERVAL '15 days', -- 2 working days
        calculate_working_days(CURRENT_DATE + INTERVAL '14 days', CURRENT_DATE + INTERVAL '15 days'),
        'Medical appointment',
        'pending',
        CURRENT_TIMESTAMP - INTERVAL '1 day'
      );
    END IF;
    
    -- Employee 4-6: Create APPROVED requests (these will auto-deduct annual leave)
    IF emp_count >= 4 AND emp_count <= 6 THEN
      -- Approved Annual Leave Request (past dates)
      INSERT INTO leave_requests (
        employee_id,
        leave_type_id,
        start_date,
        end_date,
        number_of_days,
        reason,
        status,
        approved_by,
        approved_at,
        created_at
      ) VALUES (
        emp_record.id,
        annual_leave_type_id,
        CURRENT_DATE - INTERVAL '30 days', -- 30 days ago
        CURRENT_DATE - INTERVAL '28 days', -- 3 working days
        calculate_working_days(CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE - INTERVAL '28 days'),
        'Holiday break',
        'approved',
        admin_id_val, -- Use first admin if exists
        CURRENT_TIMESTAMP - INTERVAL '35 days',
        CURRENT_TIMESTAMP - INTERVAL '40 days'
      );
      
      -- Another approved request (more recent)
      INSERT INTO leave_requests (
        employee_id,
        leave_type_id,
        start_date,
        end_date,
        number_of_days,
        reason,
        status,
        approved_by,
        approved_at,
        created_at
      ) VALUES (
        emp_record.id,
        annual_leave_type_id,
        CURRENT_DATE - INTERVAL '10 days',
        CURRENT_DATE - INTERVAL '8 days', -- 3 working days
        calculate_working_days(CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE - INTERVAL '8 days'),
        'Personal time',
        'approved',
        admin_id_val,
        CURRENT_TIMESTAMP - INTERVAL '15 days',
        CURRENT_TIMESTAMP - INTERVAL '20 days'
      );
      
      -- Approved Sick Leave
      INSERT INTO leave_requests (
        employee_id,
        leave_type_id,
        start_date,
        end_date,
        number_of_days,
        reason,
        status,
        approved_by,
        approved_at,
        created_at
      ) VALUES (
        emp_record.id,
        sick_leave_type_id,
        CURRENT_DATE - INTERVAL '5 days',
        CURRENT_DATE - INTERVAL '4 days', -- 2 working days
        calculate_working_days(CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '4 days'),
        'Flu',
        'approved',
        admin_id_val,
        CURRENT_TIMESTAMP - INTERVAL '6 days',
        CURRENT_TIMESTAMP - INTERVAL '7 days'
      );
    END IF;
    
    -- Employee 7-8: Create REJECTED requests
    IF emp_count >= 7 AND emp_count <= 8 THEN
      -- Rejected Annual Leave Request
      INSERT INTO leave_requests (
        employee_id,
        leave_type_id,
        start_date,
        end_date,
        number_of_days,
        reason,
        status,
        approved_by,
        rejection_reason,
        created_at
      ) VALUES (
        emp_record.id,
        annual_leave_type_id,
        CURRENT_DATE + INTERVAL '20 days',
        CURRENT_DATE + INTERVAL '25 days', -- 4 working days
        calculate_working_days(CURRENT_DATE + INTERVAL '20 days', CURRENT_DATE + INTERVAL '25 days'),
        'Vacation request',
        'rejected',
        admin_id_val,
        'Project deadline conflicts',
        CURRENT_TIMESTAMP - INTERVAL '3 days'
      );
      
      -- Rejected Unpaid Leave
      INSERT INTO leave_requests (
        employee_id,
        leave_type_id,
        start_date,
        end_date,
        number_of_days,
        reason,
        status,
        approved_by,
        rejection_reason,
        created_at
      ) VALUES (
        emp_record.id,
        unpaid_leave_type_id,
        CURRENT_DATE + INTERVAL '10 days',
        CURRENT_DATE + INTERVAL '12 days', -- 3 working days
        calculate_working_days(CURRENT_DATE + INTERVAL '10 days', CURRENT_DATE + INTERVAL '12 days'),
        'Personal emergency',
        'rejected',
        admin_id_val,
        'Insufficient notice',
        CURRENT_TIMESTAMP - INTERVAL '1 day'
      );
    END IF;
    
    -- Employee 9-10: Create mix of statuses
    IF emp_count >= 9 AND emp_count <= 10 THEN
      -- One approved, one pending, one rejected
      INSERT INTO leave_requests (
        employee_id,
        leave_type_id,
        start_date,
        end_date,
        number_of_days,
        reason,
        status,
        approved_by,
        approved_at,
        created_at
      ) VALUES (
        emp_record.id,
        annual_leave_type_id,
        CURRENT_DATE - INTERVAL '15 days',
        CURRENT_DATE - INTERVAL '13 days', -- 3 working days
        calculate_working_days(CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE - INTERVAL '13 days'),
        'Family event',
        'approved',
        admin_id_val,
        CURRENT_TIMESTAMP - INTERVAL '20 days',
        CURRENT_TIMESTAMP - INTERVAL '25 days'
      );
      
      INSERT INTO leave_requests (
        employee_id,
        leave_type_id,
        start_date,
        end_date,
        number_of_days,
        reason,
        status,
        created_at
      ) VALUES (
        emp_record.id,
        sick_leave_type_id,
        CURRENT_DATE + INTERVAL '5 days',
        CURRENT_DATE + INTERVAL '6 days', -- 2 working days
        calculate_working_days(CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE + INTERVAL '6 days'),
        'Medical checkup',
        'pending',
        CURRENT_TIMESTAMP - INTERVAL '2 days'
      );
      
      INSERT INTO leave_requests (
        employee_id,
        leave_type_id,
        start_date,
        end_date,
        number_of_days,
        reason,
        status,
        approved_by,
        rejection_reason,
        created_at
      ) VALUES (
        emp_record.id,
        annual_leave_type_id,
        CURRENT_DATE + INTERVAL '30 days',
        CURRENT_DATE + INTERVAL '35 days', -- 4 working days
        calculate_working_days(CURRENT_DATE + INTERVAL '30 days', CURRENT_DATE + INTERVAL '35 days'),
        'Extended vacation',
        'rejected',
        admin_id_val,
        'Too many days requested',
        CURRENT_TIMESTAMP - INTERVAL '5 days'
      );
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Created sample leave requests for % employees', emp_count;
END $$;

-- Step 3: Update leave balances to reflect approved requests
-- The trigger should have already done this, but let's verify and fix if needed
DO $$
DECLARE
  balance_record RECORD;
  used_days_calc DECIMAL(10, 2);
BEGIN
  FOR balance_record IN 
    SELECT 
      lb.id,
      lb.employee_id,
      lb.leave_type_id,
      lb.year
    FROM leave_balances lb
    WHERE lb.leave_type_id = (SELECT id FROM leave_types WHERE code = 'ANNUAL' LIMIT 1)
  LOOP
    -- Calculate actual used days from approved requests
    SELECT COALESCE(SUM(number_of_days), 0) INTO used_days_calc
    FROM leave_requests
    WHERE employee_id = balance_record.employee_id
      AND leave_type_id = balance_record.leave_type_id
      AND status = 'approved'
      AND EXTRACT(YEAR FROM start_date) = balance_record.year;
    
    -- Update the balance
    UPDATE leave_balances
    SET used_days = used_days_calc,
        updated_at = NOW()
    WHERE id = balance_record.id;
  END LOOP;
END $$;

-- Step 4: Display summary
SELECT 
  'Leave Management Data Seeded Successfully!' AS message,
  (SELECT COUNT(*) FROM leave_balances) AS total_leave_balances,
  (SELECT COUNT(*) FROM leave_requests) AS total_leave_requests,
  (SELECT COUNT(*) FROM leave_requests WHERE status = 'pending') AS pending_requests,
  (SELECT COUNT(*) FROM leave_requests WHERE status = 'approved') AS approved_requests,
  (SELECT COUNT(*) FROM leave_requests WHERE status = 'rejected') AS rejected_requests;

