import { useState, useEffect, useCallback, useRef } from 'react';
import { PostRequirements } from '../utils/reddit';
import { fetchSubredditRequirements } from '../lib/api/reddit';

interface UseSubredditRequirementsReturn {
  requirements: Record<string, PostRequirements>;
  loading: Record<string, boolean>;
  errors: Record<string, string>;
}

export function useSubredditRequirements(selectedSubreddits: string[]): UseSubredditRequirementsReturn {
  const [requirements, setRequirements] = useState<Record<string, PostRequirements>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Track ongoing requests to avoid duplicates
  const ongoingRequests = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Identify subreddits that need fetching
    // We fetch if:
    // 1. It's selected
    // 2. We don't have it in requirements (or maybe we want to re-fetch on mount? assume persistence in session not needed for now)
    // 3. We are not currently fetching it
    const toFetch = selectedSubreddits.filter(sub => 
      !requirements[sub] && !ongoingRequests.current.has(sub)
    );

    if (toFetch.length === 0) return;

    // Fetch one by one or in parallel batches
    const fetchRequirement = async (subreddit: string) => {
      ongoingRequests.current.add(subreddit);
      setLoading(prev => ({ ...prev, [subreddit]: true }));
      
      try {
        const requirements = await fetchSubredditRequirements(subreddit);
        
        setRequirements(prev => ({ 
          ...prev, 
          [subreddit]: requirements 
        }));
      } catch (error: any) {
        console.error(`Failed to fetch requirements for ${subreddit}`, error);
        setErrors(prev => ({
          ...prev,
          [subreddit]: error.response?.data?.error || error.message || 'Failed to fetch'
        }));
        // If failed, we might want to set empty requirements so we don't retry immediately loop?
        // Or just leave it out of requirements to retry?
        // For safety, let's set empty requirements so UI doesn't look broken/retry loop
        setRequirements(prev => ({ ...prev, [subreddit]: {} })); 
      } finally {
        setLoading(prev => ({ ...prev, [subreddit]: false }));
        ongoingRequests.current.delete(subreddit);
      }
    };

    toFetch.forEach(sub => {
      fetchRequirement(sub);
    });

  }, [selectedSubreddits, requirements]);

  return { requirements, loading, errors };
}
