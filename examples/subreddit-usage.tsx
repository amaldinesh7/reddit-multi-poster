/**
 * Example usage of the Indian NSFW subreddit constants
 * This file shows different ways to use the predefined subreddit lists
 */

import React from 'react';
import { INDIAN_NSFW_SUBREDDITS, INDIAN_NSFW_SUBREDDIT_NAMES, mergeWithExistingSubreddits } from '../constants/subreddits';
import { useSubreddits } from '../hooks/useSubreddits';

// Example 1: Using the simple array for quick posting
export function getSubredditsForPosting(): string[] {
  return INDIAN_NSFW_SUBREDDIT_NAMES;
}

// Example 2: Using in a React component to load predefined subreddits
export function ExampleComponent() {
  const { data, updateData } = useSubreddits();
  
  const loadPredefinedSubreddits = () => {
    // Option A: Replace all existing data
    updateData(INDIAN_NSFW_SUBREDDITS);
    
    // Option B: Merge with existing data (recommended)
    // updateData(mergeWithExistingSubreddits(data, INDIAN_NSFW_SUBREDDITS));
  };
  
  return (
    <button onClick={loadPredefinedSubreddits}>
      Load Indian NSFW Subreddits
    </button>
  );
}

// Example 3: Filter subreddits by specific criteria
export function getSubredditsByCity(city: string): string[] {
  return INDIAN_NSFW_SUBREDDIT_NAMES.filter(name => 
    name.toLowerCase().includes(city.toLowerCase())
  );
}

// Example 4: Get random subset for posting
export function getRandomSubreddits(count: number = 10): string[] {
  const shuffled = [...INDIAN_NSFW_SUBREDDIT_NAMES].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Example 5: Create posting queue with these subreddits
export function createPostingQueue(title: string, content: string) {
  return INDIAN_NSFW_SUBREDDIT_NAMES.map(subreddit => ({
    subreddit,
    title,
    kind: 'self' as const,
    text: content,
    status: 'queued' as const
  }));
}

// Example usage in your posting logic:
/*
// In your component:
const subredditsToPost = INDIAN_NSFW_SUBREDDIT_NAMES;

// Or get a random subset:
const randomSubreddits = getRandomSubreddits(15);

// Or filter by city:
const bangaloreSubreddits = getSubredditsByCity('bangalore');

// Use in posting:
const queue = createPostingQueue("My Post Title", "My post content");
*/
