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
  categories: [
    {
      id: 'indian',
      name: 'Indian',
      subreddits: [
        { id: 'indianhotwife', name: 'IndianHotwife' },
        { id: 'indiansgetlaid', name: 'indiansgetlaid' },
        { id: 'desinsfwsubs', name: 'DesiNSFWSubs' },
        { id: 'bangaloresluts', name: 'Bangaloresluts' },
        { id: 'desistree', name: 'DesiStree' },
        { id: 'desislutgw', name: 'DesiSlutGW' },
        { id: 'desigw', name: 'DesiGW' },
        { id: 'keralagw', name: 'KeralaGW' },
        { id: 'bangalorecouples', name: 'Bangalorecouples' },
        { id: 'delhigone_wild', name: 'DelhiGone_Wild' },
        { id: 'kochinsfw', name: 'KochiNSFW' },
        { id: 'malayaligonewild', name: 'MalayaliGoneWild' },
        { id: 'indianhornypeople', name: 'IndianHornyPeople' },
        { id: 'mumbaigwild', name: 'mumbaiGWild' },
        { id: 'bengali_gone_wild', name: 'bengali_gone_wild' },
        { id: 'desislimnstacked', name: 'desiSlimnStacked' },
        { id: 'tamilgw', name: 'TamilGW' },
        { id: 'punegw', name: 'PuneGW' },
        { id: 'bangaloregwild', name: 'BangaloreGWild' },
        { id: 'desiwhorewife', name: 'DesiWhoreWife' },
        { id: 'desiexhibitionistgw', name: 'DesiExhibitionistGW' },
        { id: 'exhibitionisthotwife', name: 'ExhibitionistHotWife' },
        { id: 'exhibitionistfun', name: 'ExhibitionistFun' },
        { id: 'hotwifeindia', name: 'HotwifeIndia' },
        { id: 'indian_exhibitionism', name: 'indian_exhibitionism' },
        { id: 'blouseless_saree', name: 'blouseless_saree' },
        { id: 'bengalisgonewild', name: 'BengalisGoneWild' },
        { id: 'blouselesssaree', name: 'BlouselessSaree' },
      ]
    }
  ]
};

export function useSubreddits() {
  const [data, setData] = useState<SubredditData>(DEFAULT_DATA);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load data from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('reddit-multi-poster-subreddits');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setData(parsed);
      } catch (e) {
        console.error('Failed to parse stored subreddit data:', e);
      }
    }
    setIsLoaded(true);
  }, []);

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

  return {
    data,
    isLoaded,
    getAllSubreddits,
    getSubredditsByCategory
  };
} 