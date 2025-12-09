-- Migration: Add admin request tracking to users table
-- This allows users to request admin access, which shows up in the admin management page

-- Add admin_requested_at column to track when a user requested admin access
-- NULL means no request, timestamp means request is pending
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS admin_requested_at timestamptz;

-- Add index for efficient querying of pending requests
CREATE INDEX IF NOT EXISTS idx_users_admin_requested_at 
ON public.users(admin_requested_at) 
WHERE admin_requested_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.users.admin_requested_at IS 'Timestamp when user requested admin access. NULL if no request, timestamp if request is pending.';
