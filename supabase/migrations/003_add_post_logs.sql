-- ============================================
-- POST LOGS TABLE (Privacy-First Analytics)
-- Tracks post metadata only - NO user content stored
-- ============================================

-- What we store: metadata about where/when posts were made
-- What we DO NOT store: images, videos, user URLs, text content

create table if not exists post_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  subreddit_name text not null,
  post_kind text not null, -- 'self', 'link', 'image', 'video', 'gallery' (category only)
  reddit_post_url text, -- link to view on Reddit (null if failed)
  status text not null, -- 'success', 'error'
  error_code text, -- generic error type (e.g., 'rate_limited', 'flair_required')
  created_at timestamptz default now()
);

-- Indexes for analytics queries
create index if not exists idx_post_logs_user_id on post_logs(user_id);
create index if not exists idx_post_logs_subreddit on post_logs(subreddit_name);
create index if not exists idx_post_logs_created_at on post_logs(created_at);
create index if not exists idx_post_logs_status on post_logs(status);

-- Composite index for common analytics queries (user + time range)
create index if not exists idx_post_logs_user_created on post_logs(user_id, created_at desc);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table post_logs enable row level security;

-- Service role full access (API routes handle auth)
create policy "Service role full access to post_logs"
  on post_logs for all
  to service_role
  using (true)
  with check (true);

-- ============================================
-- COMMENTS
-- ============================================

comment on table post_logs is 'Privacy-first post tracking. Stores metadata only - no user content (images, text, URLs) is persisted.';
comment on column post_logs.reddit_post_url is 'Public Reddit link. User can delete their post anytime, making this link invalid.';
comment on column post_logs.error_code is 'Generic error category without user data. E.g., rate_limited, flair_required, subreddit_private';
