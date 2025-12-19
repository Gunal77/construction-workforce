-- ============================================
-- Migration: Add MC Document and Stand-In Staff to Leave Requests
-- ============================================

-- Add MC document URL column for medical certificate uploads
ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS mc_document_url TEXT;

-- Add stand-in staff (replacement) employee ID
ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS stand_in_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;

-- Create index for stand-in employee lookups
CREATE INDEX IF NOT EXISTS idx_leave_requests_stand_in_employee_id ON leave_requests(stand_in_employee_id);

-- Add comment for documentation
COMMENT ON COLUMN leave_requests.mc_document_url IS 'URL/path to uploaded medical certificate document (required for MC leave type)';
COMMENT ON COLUMN leave_requests.stand_in_employee_id IS 'Optional employee ID of stand-in replacement staff';

