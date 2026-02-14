-- Add eligibility column to subreddit_cache table
-- This stores user's eligibility status for subreddits (banned, approved, moderator, etc.)

ALTER TABLE public.subreddit_cache
ADD COLUMN IF NOT EXISTS eligibility jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.subreddit_cache.eligibility IS 'Stores user eligibility data for the subreddit including userIsBanned, userIsContributor, userIsModerator, userIsSubscriber, submissionType, restrictPosting, and subredditType';
