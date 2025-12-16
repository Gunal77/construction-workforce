-- Add client_id to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);

-- Add client_id to supervisors table
ALTER TABLE supervisors 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_supervisors_client_id ON supervisors(client_id);

-- Add client_id to employees table (staff)
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_employees_client_id ON employees(client_id);

-- Add comments
COMMENT ON COLUMN projects.client_id IS 'References the client who owns this project';
COMMENT ON COLUMN supervisors.client_id IS 'References the client this supervisor works for';
COMMENT ON COLUMN employees.client_id IS 'References the client this employee/staff works for';

