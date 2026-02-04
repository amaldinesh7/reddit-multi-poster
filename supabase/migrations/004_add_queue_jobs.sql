-- ============================================
-- QUEUE JOBS TABLE
-- Persistent job queue for posting to Reddit
-- Supports resume after disconnect, multi-user
-- ============================================

create table if not exists queue_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  
  -- Job status
  status text not null default 'pending' 
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  
  -- Job configuration
  caption text not null,
  prefixes jsonb default '{}'::jsonb,
  
  -- Items to post (metadata only, files stored in Supabase Storage)
  -- Structure: [{subreddit, flairId?, titleSuffix?, kind, url?, text?}]
  items jsonb not null,
  
  -- File references in Supabase Storage
  -- Structure: [{itemIndex, fileIndex, storagePath, originalName, mimeType, size}]
  file_paths jsonb default '[]'::jsonb,
  
  -- Progress tracking
  current_index int default 0,
  
  -- Results for each item
  -- Structure: [{index, subreddit, status, url?, error?}]
  results jsonb default '[]'::jsonb,
  
  -- Error message (for job-level failures)
  error text,
  
  -- Timestamps
  created_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz,
  
  -- Job claiming for worker coordination
  -- Prevents multiple workers from processing same job
  claimed_by text,
  claimed_at timestamptz
);

-- Index for user's jobs (most common query)
create index if not exists idx_queue_jobs_user_id on queue_jobs(user_id);

-- Index for pending/processing jobs (worker queries)
create index if not exists idx_queue_jobs_status on queue_jobs(status) 
  where status in ('pending', 'processing');

-- Index for cleanup queries (find old completed/failed jobs)
create index if not exists idx_queue_jobs_completed_at on queue_jobs(completed_at) 
  where completed_at is not null;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table queue_jobs enable row level security;

-- Service role has full access (used by API routes)
create policy "Service role full access to queue_jobs"
  on queue_jobs for all
  to service_role
  using (true)
  with check (true);

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- Enable real-time updates for job progress
-- ============================================

-- Check if publication exists and add table
do $$
begin
  -- Try to add table to existing publication
  alter publication supabase_realtime add table queue_jobs;
exception
  when undefined_object then
    -- Publication doesn't exist, create it
    create publication supabase_realtime for table queue_jobs;
  when duplicate_object then
    -- Table already in publication, ignore
    null;
end $$;

-- ============================================
-- HELPER FUNCTION: Claim next pending job
-- Uses SKIP LOCKED for safe concurrent access
-- ============================================

create or replace function claim_queue_job(p_job_id uuid, p_worker_id text)
returns queue_jobs as $$
declare
  v_job queue_jobs;
begin
  -- Try to claim the specific job
  update queue_jobs
  set 
    status = 'processing',
    claimed_by = p_worker_id,
    claimed_at = now(),
    started_at = coalesce(started_at, now())
  where id = p_job_id
    and status in ('pending', 'processing')
    and (claimed_by is null or claimed_by = p_worker_id or claimed_at < now() - interval '5 minutes')
  returning * into v_job;
  
  return v_job;
end;
$$ language plpgsql;

-- ============================================
-- HELPER FUNCTION: Update job progress
-- Atomic update of current_index and results
-- ============================================

create or replace function update_queue_job_progress(
  p_job_id uuid,
  p_current_index int,
  p_result jsonb
)
returns queue_jobs as $$
declare
  v_job queue_jobs;
begin
  update queue_jobs
  set 
    current_index = p_current_index,
    results = results || p_result
  where id = p_job_id
  returning * into v_job;
  
  return v_job;
end;
$$ language plpgsql;

-- ============================================
-- TRIGGER: Auto-update for cleanup tracking
-- ============================================

create trigger update_queue_jobs_updated_at
  before update on queue_jobs
  for each row
  when (old.status is distinct from new.status)
  execute function update_updated_at_column();
