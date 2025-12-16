-- ============================================
-- Migration: Create Leave Management Tables
-- ============================================

-- 1. Leave Types Table
CREATE TABLE IF NOT EXISTS leave_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  requires_approval BOOLEAN DEFAULT true,
  max_days_per_year INTEGER,
  auto_reset_annually BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default leave types
INSERT INTO leave_types (name, code, description, requires_approval, max_days_per_year, auto_reset_annually)
VALUES 
  ('Annual Leave', 'ANNUAL', 'Annual leave entitlement', true, 12, true),
  ('Sick Leave', 'SICK', 'Sick leave', true, NULL, false),
  ('Unpaid Leave', 'UNPAID', 'Unpaid leave', true, NULL, false)
ON CONFLICT (code) DO NOTHING;

-- 2. Leave Balances Table
CREATE TABLE IF NOT EXISTS leave_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  total_days DECIMAL(10, 2) NOT NULL DEFAULT 0,
  used_days DECIMAL(10, 2) NOT NULL DEFAULT 0,
  remaining_days DECIMAL(10, 2) GENERATED ALWAYS AS (total_days - used_days) STORED,
  last_reset_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, leave_type_id, year)
);

-- 3. Leave Requests Table
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  number_of_days DECIMAL(10, 2) NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, cancelled
  approved_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_date >= start_date),
  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_id ON leave_balances(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_year ON leave_balances(year);
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_year ON leave_balances(employee_id, year);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_created_at ON leave_requests(created_at);

-- 5. Function to calculate number of working days between two dates
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

-- 6. Function to auto-allocate annual leave for new year
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
  
  -- Insert or update leave balance
  INSERT INTO leave_balances (employee_id, leave_type_id, year, total_days, last_reset_date)
  VALUES (p_employee_id, annual_leave_type_id, p_year, COALESCE(max_days, 12), CURRENT_DATE)
  ON CONFLICT (employee_id, leave_type_id, year) 
  DO UPDATE SET
    total_days = EXCLUDED.total_days,
    last_reset_date = EXCLUDED.last_reset_date,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 7. Trigger to auto-deduct annual leave when approved
CREATE OR REPLACE FUNCTION deduct_annual_leave_on_approval()
RETURNS TRIGGER AS $$
DECLARE
  leave_type_code TEXT;
BEGIN
  -- Only process when status changes to approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Get leave type code
    SELECT code INTO leave_type_code
    FROM leave_types
    WHERE id = NEW.leave_type_id;
    
    -- Only deduct for annual leave
    IF leave_type_code = 'ANNUAL' THEN
      UPDATE leave_balances
      SET used_days = used_days + NEW.number_of_days,
          updated_at = NOW()
      WHERE employee_id = NEW.employee_id
        AND leave_type_id = NEW.leave_type_id
        AND year = EXTRACT(YEAR FROM NEW.start_date);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_deduct_annual_leave ON leave_requests;

CREATE TRIGGER trigger_deduct_annual_leave
AFTER UPDATE ON leave_requests
FOR EACH ROW
EXECUTE FUNCTION deduct_annual_leave_on_approval();

-- 8. Function to initialize leave balances for all employees for current year
CREATE OR REPLACE FUNCTION initialize_leave_balances_for_current_year()
RETURNS void AS $$
DECLARE
  current_year INTEGER;
  emp_record RECORD;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Loop through all employees and allocate annual leave
  FOR emp_record IN SELECT id FROM employees LOOP
    PERFORM allocate_annual_leave_for_year(emp_record.id, current_year);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

