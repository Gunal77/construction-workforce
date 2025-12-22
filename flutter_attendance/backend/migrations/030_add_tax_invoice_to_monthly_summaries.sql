-- ============================================
-- Migration: Add Tax Invoice Fields to Monthly Summaries
-- Adds tax calculation fields and invoice number generation
-- ============================================

-- Add tax-related columns
ALTER TABLE monthly_summaries 
ADD COLUMN IF NOT EXISTS tax_percentage DECIMAL(5, 2) DEFAULT 0 CHECK (tax_percentage >= 0 AND tax_percentage <= 100);

ALTER TABLE monthly_summaries 
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10, 2) DEFAULT 0 CHECK (tax_amount >= 0);

ALTER TABLE monthly_summaries 
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2) DEFAULT 0 CHECK (total_amount >= 0);

-- Add invoice number column
ALTER TABLE monthly_summaries 
ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- Create index for faster invoice number lookups
CREATE INDEX IF NOT EXISTS idx_monthly_summaries_invoice_number ON monthly_summaries(invoice_number);
CREATE INDEX IF NOT EXISTS idx_monthly_summaries_month_year_invoice ON monthly_summaries(month, year, invoice_number);

-- Add comments to document the fields
COMMENT ON COLUMN monthly_summaries.tax_percentage IS 'Tax percentage (e.g., 7.00 for 7%)';
COMMENT ON COLUMN monthly_summaries.tax_amount IS 'Calculated tax amount based on subtotal and tax_percentage';
COMMENT ON COLUMN monthly_summaries.total_amount IS 'Final total amount (subtotal + tax_amount), rounded to 2 decimal places';
COMMENT ON COLUMN monthly_summaries.invoice_number IS 'Unique invoice number generated per month (format: INV-YYYY-MM-####)';

