-- ============================================
-- USERS TABLE
-- Links Reddit accounts to our system
-- ============================================
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  reddit_id text unique not null,
  reddit_username text not null,
  reddit_avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast lookup by reddit_id
create index if not exists idx_users_reddit_id on users(reddit_id);

-- ============================================
-- CATEGORIES TABLE
-- User-defined subreddit groupings
-- ============================================
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  name text not null,
  position int default 0,
  collapsed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fetching user's categories
create index if not exists idx_categories_user_id on categories(user_id);

-- ============================================
-- USER SUBREDDITS TABLE
-- Subreddits saved within user categories
-- ============================================
create table if not exists user_subreddits (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete cascade not null,
  subreddit_name text not null,
  display_name text,
  position int default 0,
  created_at timestamptz default now()
);

-- Index for fetching subreddits in a category
create index if not exists idx_user_subreddits_category_id on user_subreddits(category_id);

-- ============================================
-- SUBREDDIT CACHE TABLE (Shared across all users)
-- Caches subreddit metadata to reduce Reddit API calls
-- ============================================
create table if not exists subreddit_cache (
  subreddit_name text primary key,
  flairs jsonb default '[]'::jsonb,
  flair_required boolean default false,
  rules jsonb default '{}'::jsonb,
  title_tags jsonb default '[]'::jsonb,
  subscribers int,
  over_18 boolean default false,
  cached_at timestamptz default now(),
  cache_version int default 1
);

-- Index for cache expiry queries
create index if not exists idx_subreddit_cache_cached_at on subreddit_cache(cached_at);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
alter table users enable row level security;
alter table categories enable row level security;
alter table user_subreddits enable row level security;
alter table subreddit_cache enable row level security;

-- Users: Allow all operations for service role (API routes will handle auth)
create policy "Service role full access to users"
  on users for all
  to service_role
  using (true)
  with check (true);

-- Categories: Allow all operations for service role
create policy "Service role full access to categories"
  on categories for all
  to service_role
  using (true)
  with check (true);

-- User subreddits: Allow all operations for service role
create policy "Service role full access to user_subreddits"
  on user_subreddits for all
  to service_role
  using (true)
  with check (true);

-- Subreddit cache: readable by all, writable by service role
create policy "Anyone can read subreddit cache"
  on subreddit_cache for select
  to anon, authenticated
  using (true);

create policy "Service role can manage subreddit cache"
  on subreddit_cache for all
  to service_role
  using (true)
  with check (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update the updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger update_users_updated_at
  before update on users
  for each row
  execute function update_updated_at_column();

create trigger update_categories_updated_at
  before update on categories
  for each row
  execute function update_updated_at_column();
