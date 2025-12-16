-- ============================================
-- Create Timesheets Table
-- Individual timesheet tracking with OT support
-- ============================================

CREATE TABLE IF NOT EXISTS timesheets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  check_in TIMESTAMPTZ NOT NULL,
  check_out TIMESTAMPTZ,
  total_hours DECIMAL(5, 2) DEFAULT 0,
  overtime_hours DECIMAL(5, 2) DEFAULT 0,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  task_type TEXT,
  status TEXT NOT NULL DEFAULT 'Present' CHECK (status IN ('Present', 'Absent', 'Half-Day')),
  approval_status TEXT NOT NULL DEFAULT 'Draft' CHECK (approval_status IN ('Draft', 'Submitted', 'Approved', 'Rejected')),
  ot_approval_status TEXT DEFAULT NULL CHECK (ot_approval_status IN ('Pending', 'Approved', 'Rejected')),
  remarks TEXT,
  ot_justification TEXT,
  approved_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  ot_approved_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  ot_approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  UNIQUE(staff_id, work_date)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_timesheets_staff_id ON timesheets(staff_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_work_date ON timesheets(work_date);
CREATE INDEX IF NOT EXISTS idx_timesheets_project_id ON timesheets(project_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_approval_status ON timesheets(approval_status);
CREATE INDEX IF NOT EXISTS idx_timesheets_ot_approval_status ON timesheets(ot_approval_status);
CREATE INDEX IF NOT EXISTS idx_timesheets_staff_date ON timesheets(staff_id, work_date);

-- Function to auto-calculate total_hours
CREATE OR REPLACE FUNCTION calculate_timesheet_hours()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.check_out IS NOT NULL AND NEW.check_in IS NOT NULL THEN
    -- Calculate hours difference
    NEW.total_hours := EXTRACT(EPOCH FROM (NEW.check_out - NEW.check_in)) / 3600.0;
    
    -- Calculate overtime (only if positive and > 8 hours)
    IF NEW.total_hours > 8 THEN
      NEW.overtime_hours := NEW.total_hours - 8;
      -- Enforce max 4 hours OT per day
      IF NEW.overtime_hours > 4 THEN
        NEW.overtime_hours := 4;
      END IF;
    ELSE
      NEW.overtime_hours := 0;
    END IF;
    
    -- If OT exists, set OT approval status to Pending if not already set
    IF NEW.overtime_hours > 0 AND NEW.ot_approval_status IS NULL THEN
      NEW.ot_approval_status := 'Pending';
    END IF;
  ELSE
    NEW.total_hours := 0;
    NEW.overtime_hours := 0;
  END IF;
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate hours on insert/update
DROP TRIGGER IF EXISTS trigger_calculate_timesheet_hours ON timesheets;
CREATE TRIGGER trigger_calculate_timesheet_hours
  BEFORE INSERT OR UPDATE OF check_in, check_out ON timesheets
  FOR EACH ROW
  EXECUTE FUNCTION calculate_timesheet_hours();

-- Function to prevent overlapping time entries
CREATE OR REPLACE FUNCTION check_overlapping_timesheet()
RETURNS TRIGGER AS $$
DECLARE
  overlapping_count INTEGER;
BEGIN
  -- Check for overlapping time entries for the same staff on the same date
  SELECT COUNT(*) INTO overlapping_count
  FROM timesheets
  WHERE staff_id = NEW.staff_id
    AND work_date = NEW.work_date
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND check_out IS NOT NULL
    AND (
      (NEW.check_in >= check_in AND NEW.check_in < check_out) OR
      (NEW.check_out IS NOT NULL AND NEW.check_out > check_in AND NEW.check_out <= check_out) OR
      (NEW.check_in <= check_in AND (NEW.check_out IS NULL OR NEW.check_out >= check_out))
    );
  
  IF overlapping_count > 0 THEN
    RAISE EXCEPTION 'Overlapping time entry exists for this staff on this date';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent overlapping entries
DROP TRIGGER IF EXISTS trigger_check_overlapping_timesheet ON timesheets;
CREATE TRIGGER trigger_check_overlapping_timesheet
  BEFORE INSERT OR UPDATE OF check_in, check_out, work_date ON timesheets
  FOR EACH ROW
  EXECUTE FUNCTION check_overlapping_timesheet();

-- Function to prevent future date entries
CREATE OR REPLACE FUNCTION prevent_future_timesheet()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.work_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot create timesheet for future dates';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent future dates
DROP TRIGGER IF EXISTS trigger_prevent_future_timesheet ON timesheets;
CREATE TRIGGER trigger_prevent_future_timesheet
  BEFORE INSERT OR UPDATE OF work_date ON timesheets
  FOR EACH ROW
  EXECUTE FUNCTION prevent_future_timesheet();

-- Function to enforce max 12 hours per day
CREATE OR REPLACE FUNCTION enforce_max_hours()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total_hours > 12 THEN
    RAISE EXCEPTION 'Maximum working hours per day is 12 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce max hours
DROP TRIGGER IF EXISTS trigger_enforce_max_hours ON timesheets;
CREATE TRIGGER trigger_enforce_max_hours
  BEFORE INSERT OR UPDATE ON timesheets
  FOR EACH ROW
  EXECUTE FUNCTION enforce_max_hours();

-- Function to prevent check_out before check_in
CREATE OR REPLACE FUNCTION validate_checkout_time()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.check_out IS NOT NULL AND NEW.check_out <= NEW.check_in THEN
    RAISE EXCEPTION 'Check-out time must be after check-in time';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate checkout time
DROP TRIGGER IF EXISTS trigger_validate_checkout_time ON timesheets;
CREATE TRIGGER trigger_validate_checkout_time
  BEFORE INSERT OR UPDATE OF check_in, check_out ON timesheets
  FOR EACH ROW
  EXECUTE FUNCTION validate_checkout_time();

-- Function to lock timesheet after approval
CREATE OR REPLACE FUNCTION lock_approved_timesheet()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent editing if already approved
  IF OLD.approval_status = 'Approved' AND 
     (NEW.check_in != OLD.check_in OR 
      NEW.check_out != OLD.check_out OR 
      NEW.work_date != OLD.work_date OR
      NEW.total_hours != OLD.total_hours) THEN
    RAISE EXCEPTION 'Cannot edit approved timesheet';
  END IF;
  
  -- Prevent editing OT if OT is approved
  IF OLD.ot_approval_status = 'Approved' AND 
     (NEW.overtime_hours != OLD.overtime_hours OR
      NEW.ot_justification != OLD.ot_justification) THEN
    RAISE EXCEPTION 'Cannot edit approved overtime';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to lock approved timesheets
DROP TRIGGER IF EXISTS trigger_lock_approved_timesheet ON timesheets;
CREATE TRIGGER trigger_lock_approved_timesheet
  BEFORE UPDATE ON timesheets
  FOR EACH ROW
  EXECUTE FUNCTION lock_approved_timesheet();

