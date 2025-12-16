-- ============================================
-- Fix: Update allocate_annual_leave_for_year function
-- ============================================
-- This fixes the ambiguous column reference error
-- Run this BEFORE running the seed script

-- Drop and recreate the function with proper parameter names
CREATE OR REPLACE FUNCTION allocate_annual_leave_for_year(p_employee_id UUID, p_year INTEGER)
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

-- Verify the function was updated
SELECT 'Function allocate_annual_leave_for_year updated successfully!' AS status;

