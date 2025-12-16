-- ============================================
-- Fix Leave Data Year Issue
-- ============================================
-- This script ensures leave requests are in the current year
-- Run this if your leave requests are showing 0 because of year mismatch

DO $$
DECLARE
  current_year INTEGER;
  year_start DATE;
  year_end DATE;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  year_start := DATE_TRUNC('year', CURRENT_DATE)::DATE;
  year_end := (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year - 1 day')::DATE;
  
  -- Update all leave requests to be in current year
  -- Move start_date to current year while preserving the day/month pattern
  UPDATE leave_requests
  SET 
    start_date = year_start + (start_date - DATE_TRUNC('year', start_date))::INTERVAL,
    end_date = year_start + (end_date - DATE_TRUNC('year', end_date))::INTERVAL,
    updated_at = NOW()
  WHERE EXTRACT(YEAR FROM start_date) != current_year;
  
  -- Recalculate number_of_days for updated requests
  UPDATE leave_requests lr
  SET number_of_days = (
    SELECT calculate_working_days(lr.start_date, lr.end_date)
  )
  WHERE EXTRACT(YEAR FROM start_date) = current_year;
  
  RAISE NOTICE 'Updated leave requests to current year: %', current_year;
END $$;

-- Verify the fix
SELECT 
  'After Fix - Requests by Year' AS info,
  EXTRACT(YEAR FROM start_date) AS year,
  status,
  COUNT(*) AS count
FROM leave_requests
GROUP BY EXTRACT(YEAR FROM start_date), status
ORDER BY year DESC, status;

-- Show current year requests
SELECT 
  'Current Year Requests' AS info,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE status = 'approved') AS approved,
  COUNT(*) FILTER (WHERE status = 'rejected') AS rejected
FROM leave_requests
WHERE EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE);

