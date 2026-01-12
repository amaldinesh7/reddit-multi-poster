import React from 'react';
import axios from 'axios';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Info, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useSubreddits } from '../hooks/useSubreddits';
import { useSubredditCache } from '../hooks/useSubredditCache';
import { TitleTag } from '../utils/subredditCache';

interface SubredditRowProps {
  name: string;
  hasError: boolean;
  isSelected: boolean;
  isLoading?: boolean;
  flairRequired?: boolean;
  flairOptions: { id: string; text: string }[];
  subredditRules?: { requiresGenderTag: boolean; requiresContentTag: boolean; genderTags: string[]; contentTags: string[]; titleTags?: TitleTag[]; submitText?: string };
  titleSuffix?: string;
  flairValue?: string;
  onToggle: (name: string) => void;
  onFlairChange: (name: string, id: string) => void;
  onTitleSuffixChange: (name: string, suffix: string) => void;
}

const SubredditRow = React.memo(({
  name,
  hasError,
  isSelected,
  isLoading,
  flairRequired,
  flairOptions,
  subredditRules,
  titleSuffix,
  flairValue,
  onToggle,
  onFlairChange,
  onTitleSuffixChange
}: SubredditRowProps) => {
  const checkboxId = `checkbox-${name}`;

  return (
    <div
      className={`
        flex items-center gap-3 px-3 sm:px-4 py-3 transition-colors cursor-pointer
        ${hasError ? 'bg-red-500/20 border-l-2 border-red-500' : 'hover:bg-secondary'}
      `}
      onClick={(e) => {
        // Prevent toggle if clicking on specific interactive controls
        const target = e.target as HTMLElement;
        if (target.closest('select') || target.closest('input') || target.closest('button') || target.closest('.group')) {
          return;
        }
        onToggle(name);
      }}
    >
      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          id={checkboxId}
          checked={isSelected}
          onCheckedChange={() => onToggle(name)}
        />
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        {hasError && (
          <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
        )}
        <span
          className={`text-sm truncate select-none ${hasError ? 'text-red-400' : ''}`}
        >
          r/{name}
        </span>

        {/* Loading indicator */}
        {isLoading && (
          <div className="w-3 h-3 border-2 border-muted border-t-primary rounded-full animate-spin" />
        )}

        {/* Badges */}
        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          {!isLoading && isSelected && flairRequired && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              Required
            </Badge>
          )}
          {!isLoading && isSelected && flairRequired === false && flairOptions.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              Optional
            </Badge>
          )}
          {!isLoading && isSelected && subredditRules?.requiresGenderTag && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              (f)/(c)
            </Badge>
          )}
        </div>

        {/* Mobile badges */}
        <div className="flex sm:hidden items-center gap-1">
          {!isLoading && isSelected && flairRequired && (
            <span className="text-red-500 text-xs font-bold">*</span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {/* Rules Tooltip */}
        {isSelected && subredditRules?.submitText && (
          <div className="relative group hidden sm:block">
            <Info className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
            <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-lg border border-border shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 w-64 max-h-40 overflow-y-auto">
              <div className="font-medium mb-1 text-foreground">Posting Rules:</div>
              <div className="whitespace-pre-wrap break-words text-muted-foreground">{subredditRules.submitText}</div>
            </div>
          </div>
        )}

        {/* Custom Title Suffix Input */}
        {isSelected && (
          <Input
            className="h-8 w-16 sm:w-20 text-xs px-2"
            placeholder="Suffix"
            value={titleSuffix || ''}
            onChange={(e) => onTitleSuffixChange(name, e.target.value)}
            title="Custom title suffix (e.g., (f), 25F, [OC])"
          />
        )}

        {/* Flair Dropdown */}
        {isSelected && flairOptions.length > 0 && (
          <select
            className={`
              h-8 w-24 sm:w-32 rounded-md border px-2 text-xs bg-input text-foreground
              focus:outline-none focus:ring-2 focus:ring-primary
              ${hasError
                ? 'border-red-500 bg-red-500/10 text-red-400'
                : 'border-border'
              }
            `}
            value={flairValue || ''}
            onChange={(e) => onFlairChange(name, e.target.value)}
          >
            <option value="">{flairRequired ? 'Select flair...' : 'No flair'}</option>
            {flairOptions.map((f) => (
              <option key={f.id} value={f.id}>{f.text || '—'}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
});

SubredditRow.displayName = 'SubredditRow';

interface Props {
  selected: string[];
  onSelectedChange: (next: string[]) => void;
  flairValue: Record<string, string | undefined>;
  onFlairChange: (v: Record<string, string | undefined>) => void;
  titleSuffixValue: Record<string, string | undefined>;
  onTitleSuffixChange: (v: Record<string, string | undefined>) => void;
  onValidationChange?: (hasErrors: boolean, missingFlairs: string[]) => void;
  showValidationErrors?: boolean;
}

export default function SubredditFlairPicker({ selected, onSelectedChange, flairValue, onFlairChange, titleSuffixValue, onTitleSuffixChange, onValidationChange, showValidationErrors }: Props) {
  const { getSubredditsByCategory, getAllSubreddits, isLoaded } = useSubreddits();
  const { getCachedData, fetchAndCache, loading: cacheLoading } = useSubredditCache();

  const [query, setQuery] = React.useState('');
  const [flairOptions, setFlairOptions] = React.useState<Record<string, { id: string; text: string }[]>>({});
  const [flairRequired, setFlairRequired] = React.useState<Record<string, boolean>>({});
  const [subredditRules, setSubredditRules] = React.useState<Record<string, { requiresGenderTag: boolean; requiresContentTag: boolean; genderTags: string[]; contentTags: string[]; titleTags?: TitleTag[]; submitText?: string }>>({});
  const [isInitialLoad, setIsInitialLoad] = React.useState(true);
  const [expandedCategories, setExpandedCategories] = React.useState<string[]>([]);
  const [searchResults, setSearchResults] = React.useState<Array<{ name: string; title: string; description: string; subscribers: number; over18: boolean; icon: string; url: string }>>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [isReloading, setIsReloading] = React.useState(false);

  const allSubreddits = getAllSubreddits();
  const categorizedSubreddits = getSubredditsByCategory();

  const filtered = React.useMemo(() => {
    if (!query.trim()) return allSubreddits;
    return allSubreddits.filter(o => o.toLowerCase().includes(query.toLowerCase()));
  }, [allSubreddits, query]);

  // Search Reddit API when user types (debounced)
  React.useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const response = await axios.get('/api/search-subreddits', {
          params: { q: query.trim(), limit: 10 }
        });
        setSearchResults(response.data.subreddits || []);
      } catch (error: any) {
        console.error('Search failed:', error);
        setSearchError(error.response?.data?.error || 'Failed to search Reddit');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [query]);

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

  // Reload flair data for selected subreddits
  const reloadSelectedData = async () => {
    if (selected.length === 0 || isReloading) return;

    setIsReloading(true);

    try {
      const batchSize = 3;
      for (let i = 0; i < selected.length; i += batchSize) {
        const batch = selected.slice(i, i + batchSize);

        const batchPromises = batch.map(async (subreddit) => {
          try {
            const cached = await fetchAndCache(subreddit, true);
            return { subreddit, cached };
          } catch (error) {
            console.error(`Failed to reload data for ${subreddit}:`, error);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);

        const batchFlairOptions: Record<string, { id: string; text: string }[]> = {};
        const batchFlairRequired: Record<string, boolean> = {};
        const batchSubredditRules: Record<string, { requiresGenderTag: boolean; requiresContentTag: boolean; genderTags: string[]; contentTags: string[] }> = {};

        batchResults.forEach((result) => {
          if (result) {
            batchFlairOptions[result.subreddit] = result.cached.flairs;
            batchFlairRequired[result.subreddit] = result.cached.flairRequired;
            batchSubredditRules[result.subreddit] = result.cached.rules;
          }
        });

        setFlairOptions(prev => ({ ...prev, ...batchFlairOptions }));
        setFlairRequired(prev => ({ ...prev, ...batchFlairRequired }));
        setSubredditRules(prev => ({ ...prev, ...batchSubredditRules }));

        if (i + batchSize < selected.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } finally {
      setIsReloading(false);
    }
  };

  // Load cached data and fetch missing data
  React.useEffect(() => {
    if (!isLoaded) return;

    const loadFlairData = async () => {
      const newFlairOptions: Record<string, { id: string; text: string }[]> = {};
      const newFlairRequired: Record<string, boolean> = {};
      const newSubredditRules: Record<string, { requiresGenderTag: boolean; requiresContentTag: boolean; genderTags: string[]; contentTags: string[] }> = {};

      for (const subreddit of allSubreddits) {
        const cached = getCachedData(subreddit);
        if (cached) {
          newFlairOptions[subreddit] = cached.flairs;
          newFlairRequired[subreddit] = cached.flairRequired;
          newSubredditRules[subreddit] = cached.rules;
        }
      }

      setFlairOptions(prev => ({ ...prev, ...newFlairOptions }));
      setFlairRequired(prev => ({ ...prev, ...newFlairRequired }));
      setSubredditRules(prev => ({ ...prev, ...newSubredditRules }));

      const needsFetching = allSubreddits.filter(name => !getCachedData(name));

      if (needsFetching.length === 0) {
        setIsInitialLoad(false);
        return;
      }

      const batchSize = 3;
      for (let i = 0; i < needsFetching.length; i += batchSize) {
        const batch = needsFetching.slice(i, i + batchSize);

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

  const handleTitleSuffixChange = (sr: string, suffix: string) => {
    onTitleSuffixChange({ ...titleSuffixValue, [sr]: suffix || undefined });
  };

  const hasMissingFlair = (subreddit: string) => {
    const isSelected = selected.includes(subreddit);
    const isRequired = flairRequired[subreddit];
    const hasFlairSelected = flairValue[subreddit];
    return isSelected && isRequired && !hasFlairSelected;
  };

  const categoryHasErrors = (subreddits: string[]) => {
    return showValidationErrors && subreddits.some(subreddit => hasMissingFlair(subreddit));
  };

  React.useEffect(() => {
    if (onValidationChange) {
      const missingFlairs = selected.filter(subreddit => hasMissingFlair(subreddit));
      const hasErrors = missingFlairs.length > 0;
      onValidationChange(hasErrors, missingFlairs);
    }
  }, [selected, flairRequired, flairValue, onValidationChange]);

  const allSubreddits_ = allSubreddits; // to pass to rows if needed

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Filter subreddits..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" />
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap tabular-nums">
            {selected.length}<span className="text-muted-foreground/50">/30</span>
          </span>

          {selected.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={reloadSelectedData}
              disabled={isReloading}
              className="h-9 w-9 p-0 rounded-lg"
              title="Reload flair data"
            >
              <RefreshCw className={`h-4 w-4 ${isReloading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {!isLoaded ? (
        <div className="rounded-md border border-border overflow-hidden animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-b-0">
              <div className="w-4 h-4 bg-secondary rounded" />
              <div className="flex-1 h-4 bg-secondary rounded" />
              <div className="w-24 h-8 bg-secondary rounded" />
            </div>
          ))}
        </div>
      ) : query.trim() ? (
        // Search results view
        <div className="rounded-md border border-border overflow-hidden divide-y divide-border">
          {filtered.map((name) => {
            const hasError = !!(showValidationErrors && hasMissingFlair(name));
            return (
              <SubredditRow
                key={name}
                name={name}
                hasError={hasError}
                isSelected={selected.includes(name)}
                isLoading={cacheLoading[name.toLowerCase()]}
                flairRequired={flairRequired[name]}
                flairOptions={flairOptions[name] || []}
                subredditRules={subredditRules[name]}
                titleSuffix={titleSuffixValue[name]}
                flairValue={flairValue[name]}
                onToggle={toggle}
                onFlairChange={handleFlairChange}
                onTitleSuffixChange={handleTitleSuffixChange}
              />
            );
          })}
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No subreddits found matching "{query}"
            </div>
          )}
        </div>
      ) : (
        // Category view
        <div className="rounded-md border border-border overflow-hidden">
          {categorizedSubreddits.map(({ categoryName, subreddits }) => {
            const hasErrors = categoryHasErrors(subreddits);
            const isExpanded = expandedCategories.includes(categoryName);
            const selectedCount = subreddits.filter(s => selected.includes(s)).length;

            return (
              <div key={categoryName} className="border-b border-border last:border-b-0">
                <button
                  onClick={() => toggleCategory(categoryName)}
                  className="w-full px-4 py-3 bg-secondary flex items-center justify-between hover:bg-secondary/80 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    {hasErrors && (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="font-medium text-sm">{categoryName}</span>
                    <span className="text-xs text-muted-foreground">
                      ({subreddits.length})
                    </span>
                    {selectedCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                        {selectedCount} selected
                      </span>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      selectAllInCategory(subreddits);
                    }}
                    className="text-xs text-primary hover:text-primary/80 font-medium px-2 py-1 rounded-md hover:bg-primary/10 transition-colors"
                  >
                    Select All
                  </button>
                </button>

                {isExpanded && (
                  <div className="divide-y divide-border">
                    {subreddits.map((name) => {
                      const hasError = !!(showValidationErrors && hasMissingFlair(name));
                      return (
                        <SubredditRow
                          key={name}
                          name={name}
                          hasError={hasError}
                          isSelected={selected.includes(name)}
                          isLoading={cacheLoading[name.toLowerCase()]}
                          flairRequired={flairRequired[name]}
                          flairOptions={flairOptions[name] || []}
                          subredditRules={subredditRules[name]}
                          titleSuffix={titleSuffixValue[name]}
                          flairValue={flairValue[name]}
                          onToggle={toggle}
                          onFlairChange={handleFlairChange}
                          onTitleSuffixChange={handleTitleSuffixChange}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {categorizedSubreddits.length === 0 && (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <p className="text-sm">No subreddits configured.</p>
              <p className="text-xs mt-1">Go to Settings to add subreddits.</p>
            </div>
          )}
        </div>
      )}

      {/* Selected Tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {selected.slice(0, 8).map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md bg-primary text-white cursor-pointer hover:bg-primary/80 transition-colors"
              onClick={() => toggle(s)}
            >
              r/{s}
              <span className="opacity-70 hover:opacity-100">×</span>
            </span>
          ))}
          {selected.length > 8 && (
            <span className="px-2 py-1 text-xs rounded-md bg-secondary text-muted-foreground">
              +{selected.length - 8} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
