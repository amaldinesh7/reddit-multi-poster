-- Add parsed_requirements column to subreddit_cache table
-- This stores parsed posting requirements (karma, account age, email verification) from subreddit rules

ALTER TABLE public.subreddit_cache
ADD COLUMN IF NOT EXISTS parsed_requirements jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.subreddit_cache.parsed_requirements IS 'Stores parsed posting requirements from subreddit rules including minKarma, minAccountAgeDays, requiresVerifiedEmail, and confidence level';
