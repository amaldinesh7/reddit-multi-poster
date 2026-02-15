-- Fix: Add missing updated_at column to queue_jobs table
-- The trigger update_queue_jobs_updated_at references this column but it was never created

ALTER TABLE queue_jobs 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create index for cleanup queries that might use updated_at
CREATE INDEX IF NOT EXISTS idx_queue_jobs_updated_at ON queue_jobs(updated_at);
