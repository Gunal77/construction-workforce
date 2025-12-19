-- ============================================
-- Add status field to admins and employees tables
-- ============================================

-- Add status to admins table
ALTER TABLE admins 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

-- Add status to employees table (if not exists)
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admins_status ON admins(status);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

-- Update existing records to active
UPDATE admins SET status = 'active' WHERE status IS NULL;
UPDATE employees SET status = 'active' WHERE status IS NULL;

COMMENT ON COLUMN admins.status IS 'Admin account status: active or inactive';
COMMENT ON COLUMN employees.status IS 'Employee account status: active or inactive';

