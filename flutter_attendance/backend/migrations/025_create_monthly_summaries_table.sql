-- ============================================
-- Migration: Create Monthly Summaries Table
-- Phase-2: Monthly Summary Approval with Staff Sign-off and Admin E-Signature
-- ============================================

CREATE TABLE IF NOT EXISTS monthly_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
  
  -- Summary Metrics
  total_working_days INTEGER DEFAULT 0,
  total_worked_hours DECIMAL(10, 2) DEFAULT 0,
  total_ot_hours DECIMAL(10, 2) DEFAULT 0,
  approved_leaves DECIMAL(10, 2) DEFAULT 0,
  absent_days INTEGER DEFAULT 0,
  
  -- Project-wise breakdown (stored as JSON)
  project_breakdown JSONB DEFAULT '[]'::jsonb,
  
  -- Status workflow: DRAFT -> SIGNED_BY_STAFF -> APPROVED/REJECTED
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SIGNED_BY_STAFF', 'APPROVED', 'REJECTED')),
  
  -- Staff Sign-off
  staff_signature TEXT, -- Base64 encoded signature image
  staff_signed_at TIMESTAMPTZ,
  staff_signed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Admin Approval
  admin_signature TEXT, -- Base64 encoded signature image
  admin_approved_at TIMESTAMPTZ,
  admin_approved_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  admin_remarks TEXT,
  
  -- Audit Trail
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  
  -- Ensure one summary per employee per month
  UNIQUE(employee_id, month, year)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_monthly_summaries_employee_id ON monthly_summaries(employee_id);
CREATE INDEX IF NOT EXISTS idx_monthly_summaries_month_year ON monthly_summaries(month, year);
CREATE INDEX IF NOT EXISTS idx_monthly_summaries_status ON monthly_summaries(status);
CREATE INDEX IF NOT EXISTS idx_monthly_summaries_employee_month_year ON monthly_summaries(employee_id, month, year);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_monthly_summary_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_monthly_summary_updated_at ON monthly_summaries;
CREATE TRIGGER trigger_update_monthly_summary_updated_at
  BEFORE UPDATE ON monthly_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_monthly_summary_updated_at();

-- Function to prevent editing approved summaries
CREATE OR REPLACE FUNCTION lock_approved_monthly_summary()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent editing if already approved or rejected
  IF OLD.status IN ('APPROVED', 'REJECTED') THEN
    -- Allow only status change from REJECTED back to DRAFT (if admin wants to regenerate)
    IF NEW.status != 'DRAFT' AND OLD.status = 'REJECTED' THEN
      RAISE EXCEPTION 'Cannot edit rejected summary. Regenerate to create new DRAFT.';
    END IF;
    
    -- Prevent editing metrics for approved summaries
    IF OLD.status = 'APPROVED' AND (
      NEW.total_working_days != OLD.total_working_days OR
      NEW.total_worked_hours != OLD.total_worked_hours OR
      NEW.total_ot_hours != OLD.total_ot_hours OR
      NEW.approved_leaves != OLD.approved_leaves OR
      NEW.absent_days != OLD.absent_days OR
      NEW.project_breakdown != OLD.project_breakdown
    ) THEN
      RAISE EXCEPTION 'Cannot edit approved monthly summary';
    END IF;
  END IF;
  
  -- Prevent editing staff signature after it's been signed
  IF OLD.staff_signed_at IS NOT NULL AND NEW.staff_signature != OLD.staff_signature THEN
    RAISE EXCEPTION 'Cannot modify staff signature after sign-off';
  END IF;
  
  -- Prevent editing admin signature after approval/rejection
  IF OLD.admin_approved_at IS NOT NULL AND NEW.admin_signature != OLD.admin_signature THEN
    RAISE EXCEPTION 'Cannot modify admin signature after approval';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to lock approved summaries
DROP TRIGGER IF EXISTS trigger_lock_approved_monthly_summary ON monthly_summaries;
CREATE TRIGGER trigger_lock_approved_monthly_summary
  BEFORE UPDATE ON monthly_summaries
  FOR EACH ROW
  EXECUTE FUNCTION lock_approved_monthly_summary();

-- Function to validate status transitions
CREATE OR REPLACE FUNCTION validate_monthly_summary_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate status transitions
  IF OLD.status = 'DRAFT' AND NEW.status NOT IN ('DRAFT', 'SIGNED_BY_STAFF') THEN
    RAISE EXCEPTION 'Invalid status transition from DRAFT. Must be signed by staff first.';
  END IF;
  
  IF OLD.status = 'SIGNED_BY_STAFF' AND NEW.status NOT IN ('SIGNED_BY_STAFF', 'APPROVED', 'REJECTED') THEN
    RAISE EXCEPTION 'Invalid status transition from SIGNED_BY_STAFF. Must be approved or rejected by admin.';
  END IF;
  
  IF OLD.status = 'APPROVED' AND NEW.status != 'APPROVED' THEN
    RAISE EXCEPTION 'Cannot change status from APPROVED';
  END IF;
  
  IF OLD.status = 'REJECTED' AND NEW.status NOT IN ('REJECTED', 'DRAFT') THEN
    RAISE EXCEPTION 'Invalid status transition from REJECTED. Can only regenerate as DRAFT.';
  END IF;
  
  -- Ensure staff signature is present when status is SIGNED_BY_STAFF
  IF NEW.status = 'SIGNED_BY_STAFF' AND (NEW.staff_signature IS NULL OR NEW.staff_signed_at IS NULL) THEN
    RAISE EXCEPTION 'Staff signature and signed_at timestamp are required for SIGNED_BY_STAFF status';
  END IF;
  
  -- Ensure admin signature is present when status is APPROVED or REJECTED
  IF NEW.status IN ('APPROVED', 'REJECTED') AND (NEW.admin_signature IS NULL OR NEW.admin_approved_at IS NULL) THEN
    RAISE EXCEPTION 'Admin signature and approved_at timestamp are required for approval/rejection';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate status transitions
DROP TRIGGER IF EXISTS trigger_validate_monthly_summary_status ON monthly_summaries;
CREATE TRIGGER trigger_validate_monthly_summary_status
  BEFORE UPDATE ON monthly_summaries
  FOR EACH ROW
  EXECUTE FUNCTION validate_monthly_summary_status_transition();

