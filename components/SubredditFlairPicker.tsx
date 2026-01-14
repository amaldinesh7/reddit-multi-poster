import React, { useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import AddToCategoryDialog from './AddToCategoryDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RefreshCw, Search, Plus, Save, Loader2, X } from 'lucide-react';
import { useSubredditFlairData } from '../hooks/useSubredditFlairData';
import { SubredditCategoryList } from './subreddit-picker';
import SubredditRow from './subreddit-picker/SubredditRow';

interface SearchResult {
  name: string;
  title: string;
  subscribers: number;
  icon?: string;
}

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

const SubredditFlairPicker: React.FC<Props> = ({
  selected,
  onSelectedChange,
  flairValue,
  onFlairChange,
  titleSuffixValue,
  onTitleSuffixChange,
  onValidationChange,
  showValidationErrors
}) => {
  const {
    allSubreddits,
    categorizedSubreddits,
    flairOptions,
    flairRequired,
    subredditRules,
    postRequirements,
    isLoaded,
    cacheLoading,
    reloadSelectedData,
    isReloading,
    addSubreddit,
  } = useSubredditFlairData();

  const [query, setQuery] = React.useState('');
  const [expandedCategories, setExpandedCategories] = React.useState<string[]>([]);

  // Search & Temporary State
  const [temporarySubreddits, setTemporarySubreddits] = React.useState<string[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<SearchResult[] | null>(null);
  const [hasSearched, setHasSearched] = React.useState(false);

  // Dialog State
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [subredditToSave, setSubredditToSave] = React.useState<string | null>(null);

  // Debounce timer ref
  const searchTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const mergedSubreddits = useMemo(() => {
    return [...new Set([...allSubreddits, ...temporarySubreddits])];
  }, [allSubreddits, temporarySubreddits]);

  // Filter local subreddits based on query
  const localFilteredSubreddits = useMemo(() => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return mergedSubreddits.filter(o => o.toLowerCase().includes(lowerQuery));
  }, [mergedSubreddits, query]);

  // Filter Reddit search results to exclude already added subreddits
  const filteredSearchResults = useMemo(() => {
    if (!searchResults) return null;
    const existingSet = new Set(mergedSubreddits.map(s => s.toLowerCase()));
    return searchResults.filter(s => s?.name && !existingSet.has(s.name.toLowerCase()));
  }, [searchResults, mergedSubreddits]);

  const displayCategories = useMemo(() => {
    if (temporarySubreddits.length === 0) return categorizedSubreddits;
    return [
      { categoryName: 'Temporary', subreddits: temporarySubreddits },
      ...categorizedSubreddits
    ];
  }, [categorizedSubreddits, temporarySubreddits]);

  const handleToggle = useCallback((name: string) => {
    const exists = selected.includes(name);
    const next = exists ? selected.filter(s => s !== name) : (selected.length < 30 ? [...selected, name] : selected);
    onSelectedChange(next);
  }, [selected, onSelectedChange]);

  const handleToggleCategory = useCallback((categoryName: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryName)
        ? prev.filter(c => c !== categoryName)
        : [...prev, categoryName]
    );
  }, []);

  const handleSelectAllInCategory = useCallback((subreddits: string[]) => {
    const newSelected = [...new Set([...selected, ...subreddits])];
    if (newSelected.length <= 30) {
      onSelectedChange(newSelected);
    }
  }, [selected, onSelectedChange]);

  const handleFlairChange = useCallback((sr: string, id: string) => {
    onFlairChange({ ...flairValue, [sr]: id || undefined });
  }, [flairValue, onFlairChange]);

  const handleTitleSuffixChange = useCallback((sr: string, suffix: string) => {
    onTitleSuffixChange({ ...titleSuffixValue, [sr]: suffix || undefined });
  }, [titleSuffixValue, onTitleSuffixChange]);

  const hasMissingFlair = useCallback((subreddit: string) => {
    const isSelected = selected.includes(subreddit);
    const isRequired = flairRequired[subreddit];
    const hasFlairSelected = flairValue[subreddit];
    return isSelected && isRequired && !hasFlairSelected;
  }, [selected, flairRequired, flairValue]);

  const handleReload = useCallback(() => {
    reloadSelectedData(selected);
  }, [reloadSelectedData, selected]);

  // Search Reddit API with debounce
  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults(null);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const { data } = await axios.get<{ subreddits: SearchResult[] }>(`/api/search-subreddits?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(data.subreddits);
    } catch (error) {
      console.error('Search failed', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search on query change
  React.useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (!query.trim()) {
      setSearchResults(null);
      setHasSearched(false);
      return;
    }

    // Start Reddit search after a short delay
    if (query.trim().length >= 2) {
      searchTimerRef.current = setTimeout(() => {
        handleSearch(query);
      }, 500);
    }

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [query, handleSearch]);

  const handleAddTemporary = useCallback((subredditName: string) => {
    if (!temporarySubreddits.includes(subredditName) && !allSubreddits.includes(subredditName)) {
      setTemporarySubreddits(prev => [...prev, subredditName]);
    }

    if (!selected.includes(subredditName) && selected.length < 30) {
      const newSelected = [...selected, subredditName];
      onSelectedChange(newSelected);
      reloadSelectedData(newSelected);
    }
  }, [temporarySubreddits, allSubreddits, selected, onSelectedChange, reloadSelectedData]);

  const handleOpenSaveDialog = useCallback((subredditName: string) => {
    setSubredditToSave(subredditName);
    setDialogOpen(true);
  }, []);

  const handleSaveToCategory = useCallback(async (categoryId: string) => {
    if (!subredditToSave) return;

    try {
      await addSubreddit(categoryId, subredditToSave);

      // Remove from temporary if it was there
      setTemporarySubreddits(prev => prev.filter(s => s !== subredditToSave));

      if (!selected.includes(subredditToSave) && selected.length < 30) {
        onSelectedChange([...selected, subredditToSave]);
      }

      setDialogOpen(false);
      setSubredditToSave(null);
    } catch (error) {
      console.error('Failed to save subreddit', error);
    }
  }, [subredditToSave, addSubreddit, selected, onSelectedChange]);

  const handleClearSearch = useCallback(() => {
    setQuery('');
    setSearchResults(null);
    setHasSearched(false);
  }, []);

  // Run validation whenever dependencies change
  React.useEffect(() => {
    if (onValidationChange) {
      const missingFlairs = selected.filter(subreddit => {
        const isRequired = flairRequired[subreddit];
        const hasFlairSelected = flairValue[subreddit];
        return isRequired && !hasFlairSelected;
      });
      const hasErrors = missingFlairs.length > 0;
      onValidationChange(hasErrors, missingFlairs);
    }
  }, [selected, flairRequired, flairValue, onValidationChange]);

  const isSearchMode = query.trim().length > 0;
  const hasLocalResults = localFilteredSubreddits.length > 0;
  const hasRedditResults = filteredSearchResults && filteredSearchResults.length > 0;
  const showNoResultsMessage = isSearchMode && !hasLocalResults && hasSearched && !isSearching && (!filteredSearchResults || filteredSearchResults.length === 0);

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search subreddits..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-8"
            aria-label="Search subreddits"
          />
          {query.length > 0 && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground md:transition-colors cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
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
              onClick={handleReload}
              disabled={isReloading}
              className="h-9 w-9 p-0 rounded-lg cursor-pointer"
              title="Reload flair data"
              aria-label="Reload flair data for selected subreddits"
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
      ) : isSearchMode ? (
        <div className="space-y-3">
          {/* Local Results Section */}
          {hasLocalResults && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5">
                Your Subreddits
              </div>
              <div className="rounded-md border border-border overflow-hidden">
                {localFilteredSubreddits.map((name) => {
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
                      postRequirements={postRequirements[name]}
                      titleSuffix={titleSuffixValue[name]}
                      flairValue={flairValue[name]}
                      onToggle={handleToggle}
                      onFlairChange={handleFlairChange}
                      onTitleSuffixChange={handleTitleSuffixChange}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Reddit Search Results Section */}
          {query.trim().length >= 2 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5 flex items-center gap-2">
                Search Reddit
                {isSearching && <Loader2 className="w-3 h-3 animate-spin" />}
              </div>

              {isSearching && !hasRedditResults && (
                <div className="py-4 text-center text-muted-foreground flex items-center justify-center gap-2 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching Reddit...
                </div>
              )}

              {hasRedditResults && (
                <div className="rounded-md border border-border divide-y divide-border overflow-hidden">
                  {filteredSearchResults?.map((sub) => (
                    <div key={sub.name} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                      <div className="flex flex-col overflow-hidden min-w-0 flex-1">
                        <span className="font-medium truncate">r/{sub.name}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {sub.subscribers.toLocaleString()} members
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-3">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleAddTemporary(sub.name)}
                          className="h-8 text-xs whitespace-nowrap cursor-pointer"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenSaveDialog(sub.name)}
                          className="h-8 text-xs whitespace-nowrap cursor-pointer"
                        >
                          <Save className="w-3 h-3 mr-1" />
                          Save
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {hasSearched && !isSearching && !hasRedditResults && (
                <div className="px-4 py-3 text-sm text-muted-foreground text-center border border-border rounded-md">
                  No new subreddits found for &quot;{query}&quot;
                </div>
              )}
            </div>
          )}

          {/* No Results At All */}
          {showNoResultsMessage && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground border border-border rounded-md">
              No subreddits found matching &quot;{query}&quot;
            </div>
          )}
        </div>
      ) : (
        <SubredditCategoryList
          categorizedSubreddits={displayCategories}
          selected={selected}
          expandedCategories={expandedCategories}
          flairOptions={flairOptions}
          flairRequired={flairRequired}
          flairValue={flairValue}
          titleSuffixValue={titleSuffixValue}
          subredditRules={subredditRules}
          postRequirements={postRequirements}
          cacheLoading={cacheLoading}
          showValidationErrors={showValidationErrors}
          onToggle={handleToggle}
          onToggleCategory={handleToggleCategory}
          onSelectAllInCategory={handleSelectAllInCategory}
          onFlairChange={handleFlairChange}
          onTitleSuffixChange={handleTitleSuffixChange}
          hasMissingFlair={hasMissingFlair}
        />
      )}

      {/* Add To Category Dialog */}
      {subredditToSave && (
        <AddToCategoryDialog
          isOpen={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSave={handleSaveToCategory}
          subredditName={subredditToSave}
        />
      )}
    </div>
  );
};

export default SubredditFlairPicker;
