-- ============================================
-- Migration: Add Last End Date Function
-- ============================================
-- This function calculates the last check-out date for each employee
-- Optimized with MAX() aggregation for performance

-- Create function to get last end date per employee
-- Employees and users are linked by email
CREATE OR REPLACE FUNCTION get_employee_last_end_date(employee_id UUID)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  employee_email TEXT;
  user_id_val UUID;
BEGIN
  -- Get employee email
  SELECT email INTO employee_email
  FROM employees
  WHERE id = employee_id;
  
  -- If no email, return NULL
  IF employee_email IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get user ID from email
  SELECT id INTO user_id_val
  FROM users
  WHERE email = employee_email;
  
  -- If no user found, return NULL
  IF user_id_val IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get last check-out time
  RETURN (
    SELECT MAX(check_out_time)
    FROM attendance_logs
    WHERE user_id = user_id_val
      AND check_out_time IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Create index for better performance on check_out_time queries
CREATE INDEX IF NOT EXISTS idx_attendance_logs_check_out_time_not_null 
ON attendance_logs(user_id, check_out_time) 
WHERE check_out_time IS NOT NULL;

-- Create a materialized view for faster last end date lookups (optional, can be refreshed periodically)
-- This is useful for large datasets
-- Employees and users are linked by email
-- Drop existing materialized view if it exists (to handle schema changes)
DROP MATERIALIZED VIEW IF EXISTS employee_last_end_dates;

-- Recreate materialized view with correct schema
CREATE MATERIALIZED VIEW employee_last_end_dates AS
SELECT 
  e.id AS employee_id,
  u.id AS user_id,
  e.name AS employee_name,
  e.email AS employee_email,
  MAX(al.check_out_time) AS last_end_date
FROM employees e
LEFT JOIN users u ON u.email = e.email
LEFT JOIN attendance_logs al ON al.user_id = u.id AND al.check_out_time IS NOT NULL
GROUP BY e.id, u.id, e.name, e.email;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_last_end_dates_employee_id 
ON employee_last_end_dates(employee_id);

-- Create function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_employee_last_end_dates()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY employee_last_end_dates;
END;
$$ LANGUAGE plpgsql;

