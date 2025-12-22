-- ============================================
-- Migration: Add Subtotal to Monthly Summaries
-- Adds subtotal field calculated based on payment type and hours/days worked
-- ============================================

-- Add subtotal column
ALTER TABLE monthly_summaries 
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10, 2) DEFAULT 0 CHECK (subtotal >= 0);

-- Add comment to document the field
COMMENT ON COLUMN monthly_summaries.subtotal IS 'Calculated subtotal based on payment_type and hours/days worked (admin-only field)';

