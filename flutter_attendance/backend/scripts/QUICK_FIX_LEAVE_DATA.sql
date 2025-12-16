-- ============================================
-- QUICK FIX: Create Leave Data for Current Year
-- ============================================
-- Run this if you have no leave data or data in wrong year
-- This creates sample data specifically for the current year (2025)

-- Step 1: Ensure leave balances exist for current year
SELECT initialize_leave_balances_for_current_year();

-- Step 2: Delete old seed data (optional - comment out if you want to keep it)
-- DELETE FROM leave_requests WHERE reason IN (
--   'Family vacation', 'Medical appointment', 'Holiday break', 
--   'Personal time', 'Flu', 'Vacation request', 'Personal emergency',
--   'Family event', 'Medical checkup', 'Extended vacation'
-- );

-- Step 3: Create new leave requests for CURRENT YEAR
DO $$
DECLARE
  emp_record RECORD;
  annual_leave_type_id UUID;
  sick_leave_type_id UUID;
  unpaid_leave_type_id UUID;
  current_year INTEGER;
  year_start DATE;
  emp_count INTEGER := 0;
  admin_id_val UUID;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  year_start := DATE_TRUNC('year', CURRENT_DATE)::DATE;
  
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
    
    -- Employee 1-3: Create PENDING requests (future dates in current year)
    IF emp_count <= 3 THEN
      INSERT INTO leave_requests (
        employee_id, leave_type_id, start_date, end_date, number_of_days, reason, status, created_at
      ) VALUES (
        emp_record.id, annual_leave_type_id,
        year_start + INTERVAL '60 days', -- Feb 1st
        year_start + INTERVAL '62 days', -- Feb 3rd (3 working days)
        calculate_working_days((year_start + INTERVAL '60 days')::DATE, (year_start + INTERVAL '62 days')::DATE),
        'Family vacation', 'pending', CURRENT_TIMESTAMP
      );
      
      INSERT INTO leave_requests (
        employee_id, leave_type_id, start_date, end_date, number_of_days, reason, status, created_at
      ) VALUES (
        emp_record.id, sick_leave_type_id,
        year_start + INTERVAL '90 days', -- March 1st
        year_start + INTERVAL '91 days', -- March 2nd (2 working days)
        calculate_working_days((year_start + INTERVAL '90 days')::DATE, (year_start + INTERVAL '91 days')::DATE),
        'Medical appointment', 'pending', CURRENT_TIMESTAMP
      );
    END IF;
    
    -- Employee 4-6: Create APPROVED requests (past dates in current year)
    IF emp_count >= 4 AND emp_count <= 6 THEN
      INSERT INTO leave_requests (
        employee_id, leave_type_id, start_date, end_date, number_of_days, reason, status,
        approved_by, approved_at, created_at
      ) VALUES (
        emp_record.id, annual_leave_type_id,
        year_start + INTERVAL '10 days', -- Jan 11th
        year_start + INTERVAL '12 days', -- Jan 13th (3 working days)
        calculate_working_days((year_start + INTERVAL '10 days')::DATE, (year_start + INTERVAL '12 days')::DATE),
        'Holiday break', 'approved', admin_id_val, CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '10 days'
      );
      
      INSERT INTO leave_requests (
        employee_id, leave_type_id, start_date, end_date, number_of_days, reason, status,
        approved_by, approved_at, created_at
      ) VALUES (
        emp_record.id, annual_leave_type_id,
        year_start + INTERVAL '20 days', -- Jan 21st
        year_start + INTERVAL '22 days', -- Jan 23rd (3 working days)
        calculate_working_days((year_start + INTERVAL '20 days')::DATE, (year_start + INTERVAL '22 days')::DATE),
        'Personal time', 'approved', admin_id_val, CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '8 days'
      );
      
      INSERT INTO leave_requests (
        employee_id, leave_type_id, start_date, end_date, number_of_days, reason, status,
        approved_by, approved_at, created_at
      ) VALUES (
        emp_record.id, sick_leave_type_id,
        year_start + INTERVAL '5 days', -- Jan 6th
        year_start + INTERVAL '6 days', -- Jan 7th (2 working days)
        calculate_working_days((year_start + INTERVAL '5 days')::DATE, (year_start + INTERVAL '6 days')::DATE),
        'Flu', 'approved', admin_id_val, CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '10 days'
      );
    END IF;
    
    -- Employee 7-8: Create REJECTED requests
    IF emp_count >= 7 AND emp_count <= 8 THEN
      INSERT INTO leave_requests (
        employee_id, leave_type_id, start_date, end_date, number_of_days, reason, status,
        approved_by, rejection_reason, created_at
      ) VALUES (
        emp_record.id, annual_leave_type_id,
        year_start + INTERVAL '100 days', -- April 10th
        year_start + INTERVAL '103 days', -- April 13th (4 working days)
        calculate_working_days((year_start + INTERVAL '100 days')::DATE, (year_start + INTERVAL '103 days')::DATE),
        'Vacation request', 'rejected', admin_id_val, 'Project deadline conflicts', CURRENT_TIMESTAMP - INTERVAL '2 days'
      );
      
      INSERT INTO leave_requests (
        employee_id, leave_type_id, start_date, end_date, number_of_days, reason, status,
        approved_by, rejection_reason, created_at
      ) VALUES (
        emp_record.id, unpaid_leave_type_id,
        year_start + INTERVAL '80 days', -- March 21st
        year_start + INTERVAL '82 days', -- March 23rd (3 working days)
        calculate_working_days((year_start + INTERVAL '80 days')::DATE, (year_start + INTERVAL '82 days')::DATE),
        'Personal emergency', 'rejected', admin_id_val, 'Insufficient notice', CURRENT_TIMESTAMP - INTERVAL '1 day'
      );
    END IF;
    
    -- Employee 9-10: Create mix of statuses
    IF emp_count >= 9 AND emp_count <= 10 THEN
      INSERT INTO leave_requests (
        employee_id, leave_type_id, start_date, end_date, number_of_days, reason, status,
        approved_by, approved_at, created_at
      ) VALUES (
        emp_record.id, annual_leave_type_id,
        year_start + INTERVAL '15 days', -- Jan 16th
        year_start + INTERVAL '17 days', -- Jan 18th (3 working days)
        calculate_working_days((year_start + INTERVAL '15 days')::DATE, (year_start + INTERVAL '17 days')::DATE),
        'Family event', 'approved', admin_id_val, CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '9 days'
      );
      
      INSERT INTO leave_requests (
        employee_id, leave_type_id, start_date, end_date, number_of_days, reason, status, created_at
      ) VALUES (
        emp_record.id, sick_leave_type_id,
        year_start + INTERVAL '70 days', -- March 11th
        year_start + INTERVAL '71 days', -- March 12th (2 working days)
        calculate_working_days((year_start + INTERVAL '70 days')::DATE, (year_start + INTERVAL '71 days')::DATE),
        'Medical checkup', 'pending', CURRENT_TIMESTAMP - INTERVAL '1 day'
      );
      
      INSERT INTO leave_requests (
        employee_id, leave_type_id, start_date, end_date, number_of_days, reason, status,
        approved_by, rejection_reason, created_at
      ) VALUES (
        emp_record.id, annual_leave_type_id,
        year_start + INTERVAL '120 days', -- May 1st
        year_start + INTERVAL '124 days', -- May 5th (4 working days)
        calculate_working_days((year_start + INTERVAL '120 days')::DATE, (year_start + INTERVAL '124 days')::DATE),
        'Extended vacation', 'rejected', admin_id_val, 'Too many days requested', CURRENT_TIMESTAMP - INTERVAL '3 days'
      );
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Created leave requests for % employees in year %', emp_count, current_year;
END $$;

-- Step 4: Update leave balances to reflect approved requests
DO $$
DECLARE
  balance_record RECORD;
  used_days_calc DECIMAL(10, 2);
  annual_leave_type_id UUID;
  current_year INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  SELECT id INTO annual_leave_type_id FROM leave_types WHERE code = 'ANNUAL' LIMIT 1;
  
  FOR balance_record IN 
    SELECT lb.id, lb.employee_id, lb.year
    FROM leave_balances lb
    WHERE lb.leave_type_id = annual_leave_type_id AND lb.year = current_year
  LOOP
    SELECT COALESCE(SUM(number_of_days), 0) INTO used_days_calc
    FROM leave_requests
    WHERE employee_id = balance_record.employee_id
      AND leave_type_id = annual_leave_type_id
      AND status = 'approved'
      AND EXTRACT(YEAR FROM start_date) = current_year;
    
    UPDATE leave_balances
    SET used_days = used_days_calc, updated_at = NOW()
    WHERE id = balance_record.id;
  END LOOP;
END $$;

-- Step 5: Display summary
SELECT 
  'Leave Management Data Created Successfully!' AS message,
  (SELECT COUNT(*) FROM leave_balances WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)) AS total_leave_balances,
  (SELECT COUNT(*) FROM leave_requests WHERE EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE)) AS total_leave_requests,
  (SELECT COUNT(*) FROM leave_requests WHERE status = 'pending' AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE)) AS pending_requests,
  (SELECT COUNT(*) FROM leave_requests WHERE status = 'approved' AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE)) AS approved_requests,
  (SELECT COUNT(*) FROM leave_requests WHERE status = 'rejected' AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE)) AS rejected_requests;

