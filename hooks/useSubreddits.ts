import { useState, useEffect } from 'react';

export interface SubredditItem {
  id: string;
  name: string;
  displayName?: string;
}

export interface Category {
  id: string;
  name: string;
  subreddits: SubredditItem[];
  collapsed?: boolean;
}

export interface SubredditData {
  categories: Category[];
}

const DEFAULT_DATA: SubredditData = {
  categories: []
};

export function useSubreddits() {
  const [data, setData] = useState<SubredditData>(DEFAULT_DATA);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load data from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('reddit-multi-poster-subreddits');
    console.log('useSubreddits: Loading from localStorage:', stored);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        console.log('useSubreddits: Parsed data:', parsed);
        setData(parsed);
      } catch (e) {
        console.error('Failed to parse stored subreddit data:', e);
      }
    } else {
      console.log('useSubreddits: No stored data found, using default:', DEFAULT_DATA);
    }
    setIsLoaded(true);
  }, []);

  // Save data to localStorage whenever data changes (but only after initial load)
  useEffect(() => {
    if (isLoaded) {
      console.log('useSubreddits: Saving to localStorage:', data);
      localStorage.setItem('reddit-multi-poster-subreddits', JSON.stringify(data));
    }
  }, [data, isLoaded]);

  // Get flattened list of all subreddits in order
  const getAllSubreddits = (): string[] => {
    const subreddits: string[] = [];
    data.categories.forEach(category => {
      category.subreddits.forEach(subreddit => {
        subreddits.push(subreddit.name);
      });
    });
    return subreddits;
  };

  // Get subreddits grouped by category
  const getSubredditsByCategory = (): { categoryName: string; subreddits: string[] }[] => {
    return data.categories.map(category => ({
      categoryName: category.name,
      subreddits: category.subreddits.map(sub => sub.name)
    }));
  };

  const updateData = (newData: SubredditData) => {
    setData(newData);
  };

  return {
    data,
    isLoaded,
    getAllSubreddits,
    getSubredditsByCategory,
    updateData
  };
} 