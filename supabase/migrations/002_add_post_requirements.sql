-- ============================================
-- ADD POST REQUIREMENTS COLUMN TO SUBREDDIT CACHE
-- Stores Reddit's post_requirements API response
-- ============================================

-- Add the post_requirements column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subreddit_cache' 
    AND column_name = 'post_requirements'
  ) THEN
    ALTER TABLE subreddit_cache 
    ADD COLUMN post_requirements jsonb DEFAULT NULL;
  END IF;
END $$;

-- Update cache_version to 2 for entries that need re-fetching
-- (This will cause stale cache entries to be refreshed with the new data)
COMMENT ON COLUMN subreddit_cache.post_requirements IS 
  'Stores Reddit post requirements including title_required_strings, blacklisted words, length constraints, and guidelines';
