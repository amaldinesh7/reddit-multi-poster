import { SubredditData } from '../hooks/useSubreddits';

/**
 * Predefined list of NSFW Indian subreddits for posting
 * This constant can be used to quickly populate your subreddit list
 */
export const INDIAN_NSFW_SUBREDDITS: SubredditData = {
  categories: [
    {
      id: 'indian-nsfw-main',
      name: 'Indian NSFW Communities',
      subreddits: [
        { id: 'indiansgetlaid', name: 'indiansgetlaid' },
        { id: 'DesiNSFWSubs', name: 'DesiNSFWSubs' },
        { id: 'BangaloreSluts', name: 'Bangaloresluts' },
        { id: 'Desistree', name: 'DesiStree' },
        { id: 'DesiSlutGW', name: 'DesiSlutGW' },
        { id: 'DesiGW', name: 'DesiGW' },
        { id: 'KeralaGW', name: 'KeralaGW' },
        { id: 'KeralaFantasy', name: 'KeralaFantasy' },
        { id: 'Bangalorecouples', name: 'Bangalorecouples' },
        { id: 'DelhiGone_Wild', name: 'DelhiGone_Wild' },
        { id: 'KochiNSFW', name: 'KochiNSFW' },
        { id: 'Malayali_GoneWild', name: 'Malayali_GoneWild' },
        { id: 'IndianHornyPeople', name: 'IndianHornypeople' },
        { id: 'mumbaiGWild', name: 'mumbaiGWild' },
        { id: 'BengalisGoneWild', name: 'BengalisGoneWild' },
        { id: 'desiSlimNStacked', name: 'desiSlimnStacked' },
        { id: 'tamilGW', name: 'TamilGW' },
        { id: 'PuneGW', name: 'PuneGW' },
        { id: 'BangaloreGWild', name: 'BangaloreGWild' },
        { id: 'DesiWhoreWife', name: 'DesiWhoreWife' },
        { id: 'desiExhibitionistGW', name: 'DesiExhibitionistGW' },
        { id: 'ExhibitionistHotWife', name: 'ExhibitionistHotWife' },
        { id: 'ExhibitionistFun', name: 'Exhibitionistfun' },
        { id: 'HotwifeIndia', name: 'hotwifeindia' },
        { id: 'blouseless_saree', name: 'BlouselessSaree' }
      ]
    }
  ]
};

/**
 * Just the subreddit names as a simple array for quick access
 */
export const INDIAN_NSFW_SUBREDDIT_NAMES: string[] = [
  'indiansgetlaid',
  'DesiNSFWSubs',
  'Bangaloresluts',
  'DesiStree',
  'DesiSlutGW',
  'DesiGW',
  'KeralaGW',
  'KeralaFantasy',
  'Bangalorecouples',
  'DelhiGone_Wild',
  'KochiNSFW',
  'Malayali_GoneWild',
  'IndianHornypeople',
  'mumbaiGWild',
  'BengalisGoneWild',
  'desiSlimnStacked',
  'TamilGW',
  'PuneGW',
  'BangaloreGWild',
  'DesiWhoreWife',
  'DesiExhibitionistGW',
  'ExhibitionistHotWife',
  'Exhibitionistfun',
  'hotwifeindia',
  'BlouselessSaree'
];

/**
 * Helper function to import these subreddits into your existing data
 * Usage: updateData(mergeWithExistingSubreddits(data, INDIAN_NSFW_SUBREDDITS))
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
