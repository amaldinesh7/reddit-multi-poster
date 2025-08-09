import React from 'react';
import axios from 'axios';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSubreddits } from '../hooks/useSubreddits';
import { useSubredditCache } from '../hooks/useSubredditCache';

interface Props {
  selected: string[];
  onSelectedChange: (next: string[]) => void;
  flairValue: Record<string, string | undefined>;
  onFlairChange: (v: Record<string, string | undefined>) => void;
}

export default function SubredditFlairPicker({ selected, onSelectedChange, flairValue, onFlairChange }: Props) {
  const { getSubredditsByCategory, getAllSubreddits, isLoaded } = useSubreddits();
  const { getCachedData, fetchAndCache, loading: cacheLoading } = useSubredditCache();
  
  const [query, setQuery] = React.useState('');
  const [flairOptions, setFlairOptions] = React.useState<Record<string, { id: string; text: string }[]>>({});
  const [flairRequired, setFlairRequired] = React.useState<Record<string, boolean>>({});
  const [subredditRules, setSubredditRules] = React.useState<Record<string, { requiresGenderTag: boolean; requiresContentTag: boolean; genderTags: string[]; contentTags: string[] }>>({});
  const [isInitialLoad, setIsInitialLoad] = React.useState(true);
  const [expandedCategories, setExpandedCategories] = React.useState<string[]>([]);
  
  const allSubreddits = getAllSubreddits();
  const categorizedSubreddits = getSubredditsByCategory();
  
  const filtered = React.useMemo(() => {
    if (!query.trim()) return allSubreddits;
    return allSubreddits.filter(o => o.toLowerCase().includes(query.toLowerCase()));
  }, [allSubreddits, query]);

  const toggle = (name: string) => {
    const exists = selected.includes(name);
    const next = exists ? selected.filter(s => s !== name) : (selected.length < 30 ? [...selected, name] : selected);
    onSelectedChange(next);
  };

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryName) 
        ? prev.filter(c => c !== categoryName)
        : [...prev, categoryName]
    );
  };

  const selectAllInCategory = (subreddits: string[]) => {
    const newSelected = [...new Set([...selected, ...subreddits])];
    if (newSelected.length <= 30) {
      onSelectedChange(newSelected);
    }
  };

  // Load cached data and fetch missing data
  React.useEffect(() => {
    if (!isLoaded) return;
    
    const loadFlairData = async () => {
      const newFlairOptions: Record<string, { id: string; text: string }[]> = {};
      const newFlairRequired: Record<string, boolean> = {};
      const newSubredditRules: Record<string, { requiresGenderTag: boolean; requiresContentTag: boolean; genderTags: string[]; contentTags: string[] }> = {};

      // First, load all available cached data
      for (const subreddit of allSubreddits) {
        const cached = getCachedData(subreddit);
        if (cached) {
          newFlairOptions[subreddit] = cached.flairs;
          newFlairRequired[subreddit] = cached.flairRequired;
          newSubredditRules[subreddit] = cached.rules;
        }
      }

      // Update state with cached data immediately
      setFlairOptions(prev => ({ ...prev, ...newFlairOptions }));
      setFlairRequired(prev => ({ ...prev, ...newFlairRequired }));
      setSubredditRules(prev => ({ ...prev, ...newSubredditRules }));

      // Find subreddits that need to be fetched
      const needsFetching = allSubreddits.filter(name => !getCachedData(name));
      
      if (needsFetching.length === 0) {
        setIsInitialLoad(false);
        return;
      }

      // Fetch missing data in background (rate-limited batches)
      const batchSize = 3;
      for (let i = 0; i < needsFetching.length; i += batchSize) {
        const batch = needsFetching.slice(i, i + batchSize);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (subreddit) => {
          try {
            const cached = await fetchAndCache(subreddit);
            return { subreddit, cached };
          } catch (error) {
            console.error(`Failed to fetch data for ${subreddit}:`, error);
            return { 
              subreddit, 
              cached: {
                flairs: [],
                flairRequired: false,
                rules: {
                  requiresGenderTag: false,
                  requiresContentTag: false,
                  genderTags: [],
                  contentTags: []
                },
                lastFetched: Date.now(),
                version: 1
              }
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);

        // Update state with batch results
        const batchFlairOptions: Record<string, { id: string; text: string }[]> = {};
        const batchFlairRequired: Record<string, boolean> = {};
        const batchSubredditRules: Record<string, { requiresGenderTag: boolean; requiresContentTag: boolean; genderTags: string[]; contentTags: string[] }> = {};

        batchResults.forEach(({ subreddit, cached }) => {
          batchFlairOptions[subreddit] = cached.flairs;
          batchFlairRequired[subreddit] = cached.flairRequired;
          batchSubredditRules[subreddit] = cached.rules;
        });

        setFlairOptions(prev => ({ ...prev, ...batchFlairOptions }));
        setFlairRequired(prev => ({ ...prev, ...batchFlairRequired }));
        setSubredditRules(prev => ({ ...prev, ...batchSubredditRules }));

        // Small delay between batches to respect rate limits
        if (i + batchSize < needsFetching.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setIsInitialLoad(false);
    };

    loadFlairData();
  }, [isLoaded, allSubreddits, getCachedData, fetchAndCache]);

  const handleFlairChange = (sr: string, id: string) => {
    onFlairChange({ ...flairValue, [sr]: id || undefined });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Filter subreddits"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
        />
        <span className="text-sm text-muted-foreground whitespace-nowrap">{selected.length}/30</span>
      </div>

      {!isLoaded ? (
        <div className="divide-y rounded-lg border animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-3">
              <div className="w-4 h-4 bg-muted rounded"></div>
              <div className="flex-1 h-4 bg-muted rounded"></div>
              <div className="w-48 h-8 bg-muted rounded"></div>
            </div>
          ))}
        </div>
      ) : query.trim() ? (
        // Search results view
        <div className="divide-y rounded-lg border">
          {filtered.map((name) => {
            const isSelected = selected.includes(name);
            return (
              <div key={name} className="flex items-center gap-3 px-3 py-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggle(name)}
                />
                <div className="flex-1 flex items-center gap-2">
                  <Label className="text-sm truncate cursor-pointer" onClick={() => toggle(name)}>
                    r/{name}
                  </Label>
                  {cacheLoading[name.toLowerCase()] && (
                    <div className="w-3 h-3 border border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                  )}
                  {!cacheLoading[name.toLowerCase()] && isSelected && flairRequired[name] && (
                    <>
                      <Badge variant="destructive" className="text-xs hidden sm:inline-flex px-1.5 py-0 text-xs scale-90">
                        Required
                      </Badge>
                      <span className="text-red-600 text-sm font-bold sm:hidden">*</span>
                    </>
                  )}
                  {!cacheLoading[name.toLowerCase()] && isSelected && flairRequired[name] === false && (
                    <Badge variant="secondary" className="text-xs hidden sm:inline-flex px-1.5 py-0 scale-90">
                      Optional
                    </Badge>
                  )}
                  {!cacheLoading[name.toLowerCase()] && isSelected && subredditRules[name]?.requiresGenderTag && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0 scale-90">
                      <span className="hidden sm:inline">Needs (f)/(c)</span>
                      <span className="sm:hidden">⚤</span>
                    </Badge>
                  )}
                  {!cacheLoading[name.toLowerCase()] && isSelected && subredditRules[name]?.requiresContentTag && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0 scale-90">
                      <span className="hidden sm:inline">Needs (c)</span>
                      <span className="sm:hidden">©</span>
                    </Badge>
                  )}
                </div>
                <div className="w-48">
                  {isSelected && (flairOptions[name] || []).length > 0 && (
                    <select
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={flairValue[name] || ''}
                      onChange={(e) => handleFlairChange(name, e.target.value)}
                    >
                      <option value="">{flairRequired[name] ? 'Select flair...' : 'No flair'}</option>
                      {(flairOptions[name] || []).map((f) => (
                        <option key={f.id} value={f.id}>{f.text || '—'}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">No results</div>
          )}
        </div>
      ) : (
        // Category view
        <div className="rounded-lg border">
          {categorizedSubreddits.map(({ categoryName, subreddits }) => (
            <div key={categoryName} className="border-b last:border-b-0">
              <button
                onClick={() => toggleCategory(categoryName)}
                className="w-full px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between hover:bg-muted/50"
              >
                <span className="font-medium text-sm">{categoryName} ({subreddits.length})</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      selectAllInCategory(subreddits);
                    }}
                    className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:opacity-80"
                  >
                    Select All
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {expandedCategories.includes(categoryName) ? '−' : '+'}
                  </span>
                </div>
              </button>
              
              {expandedCategories.includes(categoryName) && (
                <div className="divide-y">
                  {subreddits.map((name) => {
                    const isSelected = selected.includes(name);
                    return (
                      <div key={name} className="flex items-center gap-3 px-3 py-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggle(name)}
                        />
                        <div className="flex-1 flex items-center gap-2">
                          <Label className="text-sm truncate cursor-pointer" onClick={() => toggle(name)}>
                            r/{name}
                          </Label>
                                          {cacheLoading[name.toLowerCase()] && (
                  <div className="w-3 h-3 border border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                )}
                {!cacheLoading[name.toLowerCase()] && isSelected && flairRequired[name] && (
                            <>
                                                    <Badge variant="destructive" className="text-xs hidden sm:inline-flex px-1.5 py-0 scale-90">
                        Required
                      </Badge>
                              <span className="text-red-600 text-sm font-bold sm:hidden">*</span>
                            </>
                          )}
                                          {!cacheLoading[name.toLowerCase()] && isSelected && flairRequired[name] === false && (
                                      <Badge variant="secondary" className="text-xs hidden sm:inline-flex px-1.5 py-0 scale-90">
                      Optional
                    </Badge>
                )}
                {!cacheLoading[name.toLowerCase()] && isSelected && subredditRules[name]?.requiresGenderTag && (
                                      <Badge variant="outline" className="text-xs px-1.5 py-0 scale-90">
                      <span className="hidden sm:inline">Needs (f)/(c)</span>
                      <span className="sm:hidden">⚤</span>
                    </Badge>
                )}
                {!cacheLoading[name.toLowerCase()] && isSelected && subredditRules[name]?.requiresContentTag && (
                                      <Badge variant="outline" className="text-xs px-1.5 py-0 scale-90">
                      <span className="hidden sm:inline">Needs (c)</span>
                      <span className="sm:hidden">©</span>
                    </Badge>
                )}
                        </div>
                        <div className="w-48">
                          {isSelected && (flairOptions[name] || []).length > 0 && (
                            <select
                              className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              value={flairValue[name] || ''}
                              onChange={(e) => handleFlairChange(name, e.target.value)}
                            >
                              <option value="">{flairRequired[name] ? 'Select flair...' : 'No flair'}</option>
                              {(flairOptions[name] || []).map((f) => (
                                <option key={f.id} value={f.id}>{f.text || '—'}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          
          {categorizedSubreddits.length === 0 && (
            <div className="px-3 py-6 text-center text-muted-foreground">
              <p>No subreddits configured.</p>
              <p className="text-xs mt-1">Go to Settings to add subreddits.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 