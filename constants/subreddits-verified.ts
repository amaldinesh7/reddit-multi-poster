import { SubredditData } from '../hooks/useSubreddits';

/**
 * VERIFIED list of NSFW Indian subreddits for posting
 * This list has been verified on October 1, 2025
 * All subreddits in this list are confirmed to exist and be accessible
 */
export const VERIFIED_INDIAN_NSFW_SUBREDDITS: SubredditData = {
  categories: [
    {
      id: 'indian-nsfw-verified',
      name: 'Indian NSFW Communities (Verified)',
      subreddits: [
        { id: 'indiansgetlaid', name: 'indiansgetlaid' }, // 289,506 subscribers
        { id: 'DesiNSFWSubs', name: 'DesiNSFWSubs' }, // 274,286 subscribers
        { id: 'BangaloreSluts', name: 'BangaloreSluts' }, // 137,282 subscribers
        { id: 'Desistree', name: 'Desistree' }, // 149,743 subscribers
        { id: 'DesiSlutGW', name: 'DesiSlutGW' }, // 146,191 subscribers
        { id: 'KeralaGW', name: 'KeralaGW' }, // 179,998 subscribers
        { id: 'Bangalorecouples', name: 'Bangalorecouples' }, // 88,696 subscribers
        { id: 'DelhiGone_Wild', name: 'DelhiGone_Wild' }, // 153,009 subscribers
        { id: 'KochiNSFW', name: 'KochiNSFW' }, // 47,384 subscribers
        { id: 'IndianHornyPeople', name: 'IndianHornyPeople' }, // 102,045 subscribers
        { id: 'mumbaiGWild', name: 'mumbaiGWild' }, // 106,229 subscribers
        { id: 'desiSlimNStacked', name: 'desiSlimNStacked' }, // 60,695 subscribers
        { id: 'tamilGW', name: 'tamilGW' }, // 101,495 subscribers
        { id: 'PuneGW', name: 'PuneGW' }, // 173,528 subscribers
        { id: 'DesiWhoreWife', name: 'DesiWhoreWife' }, // 68,534 subscribers
        { id: 'desiExhibitionistGW', name: 'desiExhibitionistGW' }, // 158,659 subscribers
        { id: 'ExhibitionistHotWife', name: 'ExhibitionistHotWife' }, // 149,124 subscribers
        { id: 'ExhibitionistFun', name: 'ExhibitionistFun' }, // 892,675 subscribers
        { id: 'HotwifeIndia', name: 'HotwifeIndia' }, // 126,055 subscribers
        { id: 'indian_exhibitionism', name: 'indian_exhibitionism' } // 160,736 subscribers
      ]
    }
  ]
};

/**
 * VERIFIED subreddit names as a simple array for quick access
 * Total: 20 verified subreddits
 */
export const VERIFIED_INDIAN_NSFW_SUBREDDIT_NAMES: string[] = [
  'indiansgetlaid',
  'DesiNSFWSubs',
  'BangaloreSluts',
  'Desistree',
  'DesiSlutGW',
  'KeralaGW',
  'Bangalorecouples',
  'DelhiGone_Wild',
  'KochiNSFW',
  'IndianHornyPeople',
  'mumbaiGWild',
  'desiSlimNStacked',
  'tamilGW',
  'PuneGW',
  'DesiWhoreWife',
  'desiExhibitionistGW',
  'ExhibitionistHotWife',
  'ExhibitionistFun',
  'HotwifeIndia',
  'indian_exhibitionism'
];

/**
 * REMOVED subreddits (not found during verification)
 * These were in the original list but don't exist or are inaccessible:
 */
export const REMOVED_SUBREDDITS = [
  'DesiGW', // Not found
  'MalayaliGoneWild', // Not found
  'bengali_gone_wild', // HTTP 302 redirect (possibly banned/private)
  'BangalorGWild', // HTTP 302 redirect (possibly banned/private)
  'blouseless_saree' // HTTP 302 redirect (possibly banned/private)
];

/**
 * Verification metadata
 */
export const VERIFICATION_INFO = {
  verifiedOn: '2025-10-01',
  totalChecked: 25,
  verified: 20,
  removed: 5,
  totalSubscribers: 3291506 // Combined subscribers of all verified subreddits
};

/**
 * Helper function to import verified subreddits into your existing data
 * Usage: updateData(mergeWithExistingSubreddits(data, VERIFIED_INDIAN_NSFW_SUBREDDITS))
 */
export function mergeWithExistingSubreddits(
  existingData: SubredditData, 
  newData: SubredditData
): SubredditData {
  const merged = { ...existingData };
  
  // Add new categories or merge with existing ones
  newData.categories.forEach(newCategory => {
    const existingCategoryIndex = merged.categories.findIndex(
      cat => cat.name === newCategory.name
    );
    
    if (existingCategoryIndex >= 0) {
      // Merge subreddits into existing category
      const existingCategory = merged.categories[existingCategoryIndex];
      newCategory.subreddits.forEach(newSub => {
        const exists = existingCategory.subreddits.some(
          sub => sub.name === newSub.name
        );
        if (!exists) {
          existingCategory.subreddits.push(newSub);
        }
      });
    } else {
      // Add new category
      merged.categories.push(newCategory);
    }
  });
  
  return merged;
}
