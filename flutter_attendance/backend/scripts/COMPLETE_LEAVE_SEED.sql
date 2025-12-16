-- ============================================
-- COMPLETE Leave Management Seed Script
-- ============================================
-- This is an error-free, complete script that:
-- 1. Fixes the function parameter issue
-- 2. Initializes leave balances
-- 3. Creates sample leave requests
-- 
-- Run this ENTIRE script in Supabase SQL Editor
-- 
-- NOTE: If you want to start fresh, uncomment the cleanup section below
-- ============================================

-- ============================================
-- OPTIONAL: Cleanup existing seed data (uncomment if needed)
-- ============================================
-- DELETE FROM leave_requests WHERE reason IN (
--   'Family vacation', 'Medical appointment', 'Holiday break', 
--   'Personal time', 'Flu', 'Vacation request', 'Personal emergency',
--   'Family event', 'Medical checkup', 'Extended vacation'
-- );
-- ============================================

-- ============================================
-- STEP 1: Ensure required functions exist
-- ============================================
-- Create calculate_working_days function if it doesn't exist
CREATE OR REPLACE FUNCTION calculate_working_days(start_date DATE, end_date DATE)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  days_count DECIMAL(10, 2);
BEGIN
  -- Simple calculation: end_date - start_date + 1
  -- Excludes weekends (Saturday = 6, Sunday = 0)
  days_count := 0;
  
  FOR i IN 0..(end_date - start_date) LOOP
    IF EXTRACT(DOW FROM (start_date + i)) NOT IN (0, 6) THEN
      days_count := days_count + 1;
    END IF;
  END LOOP;
  
  RETURN days_count;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Drop the old function first (if it exists with old parameter names)
DROP FUNCTION IF EXISTS allocate_annual_leave_for_year(UUID, INTEGER);

-- Create the function with correct parameter names
CREATE FUNCTION allocate_annual_leave_for_year(p_employee_id UUID, p_year INTEGER)
RETURNS void AS $$
DECLARE
  annual_leave_type_id UUID;
  max_days INTEGER;
BEGIN
  -- Get annual leave type
  SELECT id, max_days_per_year INTO annual_leave_type_id, max_days
  FROM leave_types
  WHERE code = 'ANNUAL'
  LIMIT 1;
  
  IF annual_leave_type_id IS NULL THEN
    RAISE EXCEPTION 'Annual leave type not found';
  END IF;
  
  -- Insert or update leave balance (using p_ prefix to avoid ambiguity)
  INSERT INTO leave_balances (employee_id, leave_type_id, year, total_days, last_reset_date)
  VALUES (p_employee_id, annual_leave_type_id, p_year, COALESCE(max_days, 12), CURRENT_DATE)
  ON CONFLICT (employee_id, leave_type_id, year) 
  DO UPDATE SET
    total_days = EXCLUDED.total_days,
    last_reset_date = EXCLUDED.last_reset_date,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 2: Initialize leave balances for all employees
-- ============================================
SELECT initialize_leave_balances_for_current_year();

-- ============================================
-- STEP 3: Create sample leave requests
-- ============================================
DO $$
DECLARE
  emp_record RECORD;
  annual_leave_type_id UUID;
  sick_leave_type_id UUID;
  unpaid_leave_type_id UUID;
  current_year INTEGER;
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
        DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '7 days', -- Ensure it's in current year
        DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '9 days',
        calculate_working_days(
          (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '7 days')::DATE, 
          (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '9 days')::DATE
        ),
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
        (CURRENT_DATE + INTERVAL '14 days')::DATE,
        (CURRENT_DATE + INTERVAL '15 days')::DATE,
        calculate_working_days((CURRENT_DATE + INTERVAL '14 days')::DATE, (CURRENT_DATE + INTERVAL '15 days')::DATE),
        'Medical appointment',
        'pending',
        CURRENT_TIMESTAMP - INTERVAL '1 day'
      );
    END IF;
    
    -- Employee 4-6: Create APPROVED requests
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
        (CURRENT_DATE - INTERVAL '30 days')::DATE,
        (CURRENT_DATE - INTERVAL '28 days')::DATE,
        calculate_working_days((CURRENT_DATE - INTERVAL '30 days')::DATE, (CURRENT_DATE - INTERVAL '28 days')::DATE),
        'Holiday break',
        'approved',
        admin_id_val,
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
        (CURRENT_DATE - INTERVAL '10 days')::DATE,
        (CURRENT_DATE - INTERVAL '8 days')::DATE,
        calculate_working_days((CURRENT_DATE - INTERVAL '10 days')::DATE, (CURRENT_DATE - INTERVAL '8 days')::DATE),
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
        (CURRENT_DATE - INTERVAL '5 days')::DATE,
        (CURRENT_DATE - INTERVAL '4 days')::DATE,
        calculate_working_days((CURRENT_DATE - INTERVAL '5 days')::DATE, (CURRENT_DATE - INTERVAL '4 days')::DATE),
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
        (CURRENT_DATE + INTERVAL '20 days')::DATE,
        (CURRENT_DATE + INTERVAL '25 days')::DATE,
        calculate_working_days((CURRENT_DATE + INTERVAL '20 days')::DATE, (CURRENT_DATE + INTERVAL '25 days')::DATE),
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
        (CURRENT_DATE + INTERVAL '10 days')::DATE,
        (CURRENT_DATE + INTERVAL '12 days')::DATE,
        calculate_working_days((CURRENT_DATE + INTERVAL '10 days')::DATE, (CURRENT_DATE + INTERVAL '12 days')::DATE),
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
        (CURRENT_DATE - INTERVAL '15 days')::DATE,
        (CURRENT_DATE - INTERVAL '13 days')::DATE,
        calculate_working_days((CURRENT_DATE - INTERVAL '15 days')::DATE, (CURRENT_DATE - INTERVAL '13 days')::DATE),
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
        (CURRENT_DATE + INTERVAL '5 days')::DATE,
        (CURRENT_DATE + INTERVAL '6 days')::DATE,
        calculate_working_days((CURRENT_DATE + INTERVAL '5 days')::DATE, (CURRENT_DATE + INTERVAL '6 days')::DATE),
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
        (CURRENT_DATE + INTERVAL '30 days')::DATE,
        (CURRENT_DATE + INTERVAL '35 days')::DATE,
        calculate_working_days((CURRENT_DATE + INTERVAL '30 days')::DATE, (CURRENT_DATE + INTERVAL '35 days')::DATE),
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

-- ============================================
-- STEP 4: Update leave balances to reflect approved requests
-- ============================================
DO $$
DECLARE
  balance_record RECORD;
  used_days_calc DECIMAL(10, 2);
  annual_leave_type_id UUID;
BEGIN
  -- Get annual leave type ID
  SELECT id INTO annual_leave_type_id FROM leave_types WHERE code = 'ANNUAL' LIMIT 1;
  
  FOR balance_record IN 
    SELECT 
      lb.id,
      lb.employee_id,
      lb.year
    FROM leave_balances lb
    WHERE lb.leave_type_id = annual_leave_type_id
  LOOP
    -- Calculate actual used days from approved requests
    SELECT COALESCE(SUM(number_of_days), 0) INTO used_days_calc
    FROM leave_requests
    WHERE employee_id = balance_record.employee_id
      AND leave_type_id = annual_leave_type_id
      AND status = 'approved'
      AND EXTRACT(YEAR FROM start_date) = balance_record.year;
    
    -- Update the balance
    UPDATE leave_balances
    SET used_days = used_days_calc,
        updated_at = NOW()
    WHERE id = balance_record.id;
  END LOOP;
END $$;

-- ============================================
-- STEP 5: Display summary
-- ============================================
SELECT 
  'Leave Management Data Seeded Successfully!' AS message,
  (SELECT COUNT(*) FROM leave_balances) AS total_leave_balances,
  (SELECT COUNT(*) FROM leave_requests) AS total_leave_requests,
  (SELECT COUNT(*) FROM leave_requests WHERE status = 'pending') AS pending_requests,
  (SELECT COUNT(*) FROM leave_requests WHERE status = 'approved') AS approved_requests,
  (SELECT COUNT(*) FROM leave_requests WHERE status = 'rejected') AS rejected_requests;

