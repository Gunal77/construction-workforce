-- ============================================
-- Verify Leave Management Data
-- ============================================
-- Run this to check if leave data exists in the database

-- 1. Check leave types
SELECT 'Leave Types' AS check_type, COUNT(*) AS count FROM leave_types;

-- 2. Check leave balances
SELECT 'Leave Balances' AS check_type, COUNT(*) AS count FROM leave_balances;

-- 3. Check leave requests
SELECT 'Leave Requests' AS check_type, COUNT(*) AS count FROM leave_requests;

-- 4. Check leave requests by status
SELECT 
  'Leave Requests by Status' AS check_type,
  status,
  COUNT(*) AS count
FROM leave_requests
GROUP BY status;

-- 5. Sample leave requests (first 5)
SELECT 
  lr.id,
  e.name AS employee_name,
  lt.name AS leave_type,
  lr.start_date,
  lr.end_date,
  lr.number_of_days,
  lr.status,
  lr.reason
FROM leave_requests lr
JOIN employees e ON e.id = lr.employee_id
JOIN leave_types lt ON lt.id = lr.leave_type_id
ORDER BY lr.created_at DESC
LIMIT 5;

-- 6. Sample leave balances (first 5)
SELECT 
  lb.id,
  e.name AS employee_name,
  lt.name AS leave_type,
  lb.year,
  lb.total_days,
  lb.used_days,
  lb.remaining_days
FROM leave_balances lb
JOIN employees e ON e.id = lb.employee_id
JOIN leave_types lt ON lt.id = lb.leave_type_id
ORDER BY e.name, lb.year DESC
LIMIT 5;

