-- ============================================
-- Migration: Add project_id to leave_requests
-- ============================================

-- Add project_id column to leave_requests table
ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_leave_requests_project_id ON leave_requests(project_id);

-- Add comment
COMMENT ON COLUMN leave_requests.project_id IS 'Project associated with this leave request';

