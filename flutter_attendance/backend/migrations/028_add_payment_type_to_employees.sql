-- ============================================
-- Migration: Add Payment Type Support to Employees
-- Adds payment_type and rate fields based on payment type
-- ============================================

-- Add payment_type column (hourly, daily, monthly, contract)
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS payment_type TEXT CHECK (payment_type IN ('hourly', 'daily', 'monthly', 'contract'));

-- Add rate fields based on payment type
-- hourly_rate: for hourly payment type
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10, 2) CHECK (hourly_rate >= 0);

-- daily_rate: for daily payment type
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(10, 2) CHECK (daily_rate >= 0);

-- monthly_rate: for monthly payment type
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS monthly_rate DECIMAL(10, 2) CHECK (monthly_rate >= 0);

-- contract_rate: for contract payment type
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS contract_rate DECIMAL(10, 2) CHECK (contract_rate >= 0);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_employees_payment_type ON employees(payment_type);

-- Add comment to document the fields
COMMENT ON COLUMN employees.payment_type IS 'Payment type: hourly, daily, monthly, or contract';
COMMENT ON COLUMN employees.hourly_rate IS 'Hourly rate (used when payment_type is hourly)';
COMMENT ON COLUMN employees.daily_rate IS 'Daily rate (used when payment_type is daily)';
COMMENT ON COLUMN employees.monthly_rate IS 'Monthly rate (used when payment_type is monthly)';
COMMENT ON COLUMN employees.contract_rate IS 'Contract rate (used when payment_type is contract)';

