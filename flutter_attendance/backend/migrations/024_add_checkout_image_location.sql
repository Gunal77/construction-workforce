-- Migration: Add checkout image and location columns to attendance_logs
-- Date: 2025-12-19
-- Description: Add columns to store checkout image URL and location coordinates

ALTER TABLE attendance_logs
ADD COLUMN IF NOT EXISTS checkout_image_url TEXT,
ADD COLUMN IF NOT EXISTS checkout_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS checkout_longitude DOUBLE PRECISION;

-- Add comment for documentation
COMMENT ON COLUMN attendance_logs.checkout_image_url IS 'URL of the image captured during checkout';
COMMENT ON COLUMN attendance_logs.checkout_latitude IS 'Latitude coordinate captured during checkout';
COMMENT ON COLUMN attendance_logs.checkout_longitude IS 'Longitude coordinate captured during checkout';

