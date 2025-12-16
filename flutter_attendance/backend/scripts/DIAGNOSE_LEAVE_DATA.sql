-- ============================================
-- Diagnose Leave Management Data Issues
-- ============================================
-- Run this to check what's wrong with leave data

-- 1. Check if data exists
SELECT '=== DATA COUNTS ===' AS info;
SELECT 'Leave Types' AS table_name, COUNT(*) AS count FROM leave_types
UNION ALL
SELECT 'Leave Balances' AS table_name, COUNT(*) AS count FROM leave_balances
UNION ALL
SELECT 'Leave Requests' AS table_name, COUNT(*) AS count FROM leave_requests;

-- 2. Check leave requests by year
SELECT '=== REQUESTS BY YEAR ===' AS info;
SELECT 
  EXTRACT(YEAR FROM start_date) AS year,
  status,
  COUNT(*) AS count
FROM leave_requests
GROUP BY EXTRACT(YEAR FROM start_date), status
ORDER BY year DESC, status;

-- 3. Check current year
SELECT '=== CURRENT YEAR ===' AS info;
SELECT EXTRACT(YEAR FROM CURRENT_DATE) AS current_year;

-- 4. Check if requests exist for current year
SELECT '=== REQUESTS FOR CURRENT YEAR ===' AS info;
SELECT 
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE status = 'approved') AS approved,
  COUNT(*) FILTER (WHERE status = 'rejected') AS rejected
FROM leave_requests
WHERE EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE);

-- 5. Sample requests (all years)
SELECT '=== SAMPLE REQUESTS (ALL YEARS) ===' AS info;
SELECT 
  lr.id,
  e.name AS employee_name,
  lt.name AS leave_type,
  lr.start_date,
  EXTRACT(YEAR FROM lr.start_date) AS year,
  lr.status,
  lr.reason
FROM leave_requests lr
JOIN employees e ON e.id = lr.employee_id
JOIN leave_types lt ON lt.id = lr.leave_type_id
ORDER BY lr.created_at DESC
LIMIT 10;

-- 6. Check leave balances by year
SELECT '=== BALANCES BY YEAR ===' AS info;
SELECT 
  year,
  COUNT(*) AS count
FROM leave_balances
GROUP BY year
ORDER BY year DESC;

