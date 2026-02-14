import React, { useState, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import SaveToCategoryDropdown from './SaveToCategoryDropdown';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RefreshCw, Search, Plus, Loader2, X } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { useSubredditFlairData } from '../hooks/useSubredditFlairData';
import { SubredditCategoryList } from './subreddit-picker';
import SubredditRow from './subreddit-picker/SubredditRow';
import { FailedPost } from '@/hooks/useFailedPosts';
import { ValidationIssue } from '@/lib/preflightValidation';
import { PerSubredditOverride } from './subreddit-picker';
import { RedditUser } from '@/utils/reddit';
import { useAuthContext } from '@/contexts/AuthContext';
import { usePersistentState } from '@/hooks/usePersistentState';
import { normalizeSubredditKey } from '@/lib/subredditKey';

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
  /** If false, hide search and temporary subreddits. Default true */
  temporarySelectionEnabled?: boolean;
  /** Reset signal for UI state */
  resetSignal?: number;
  /** Communities view mode */
  viewMode?: 'grouped' | 'all';
  /** Array of failed posts to display inline errors */
  failedPosts?: FailedPost[];
  /** Callback when retry is clicked on a failed post */
  onRetryPost?: (id: string) => void;
  /** Callback when edit is clicked on a failed post */
  onEditPost?: (post: FailedPost) => void;
  /** Callback when remove/dismiss is clicked on a failed post */
  onRemovePost?: (id: string) => void;
  /** Validation issues grouped by subreddit for inline pre-flight display */
  validationIssuesBySubreddit?: Record<string, ValidationIssue[]>;
  /** Per-subreddit content overrides (PRO feature) */
  contentOverrides?: Record<string, PerSubredditOverride>;
  /** Callback when customize is clicked */
  onCustomize?: (name: string) => void;
  /** Whether customization is enabled (PRO feature) */
  customizationEnabled?: boolean;
  /** User data for eligibility checks */
  userData?: RedditUser;
  /** Post kind for eligibility checks - determines if submission type is valid */
  postKind?: 'self' | 'link' | 'image' | 'video' | 'gallery';
  /** Trigger upgrade flow for gated actions */
  onRequestUpgrade?: (context?: { title?: string; message: string }) => void;
  onIssueFieldInteraction?: () => void;
  onNavigateToSubredditIssue?: (subreddit: string) => void;
  navigationTargetSubreddit?: string | null;
  onNavigationHandled?: () => void;
  showInlineValidationHint?: boolean;
}

const SubredditFlairPicker: React.FC<Props> = ({
  selected,
  onSelectedChange,
  flairValue,
  onFlairChange,
  titleSuffixValue,
  onTitleSuffixChange,
  onValidationChange,
  showValidationErrors,
  temporarySelectionEnabled = true,
  resetSignal,
  viewMode = 'grouped',
  failedPosts,
  onRetryPost,
  onEditPost,
  onRemovePost,
  validationIssuesBySubreddit,
  contentOverrides,
  onCustomize,
  customizationEnabled,
  userData,
  postKind,
  onRequestUpgrade,
  onIssueFieldInteraction,
  onNavigateToSubredditIssue,
  navigationTargetSubreddit,
  onNavigationHandled,
  showInlineValidationHint,
}) => {
  const [query, setQuery] = React.useState('');
  const [expandedCategories, setExpandedCategories] = usePersistentState<string[]>('rmp_expanded_categories', []);
  const { entitlement } = useAuthContext();

  const {
    allSubreddits,
    categorizedSubreddits,
    flairOptions,
    flairRequired,
    subredditRules,
    postRequirements,
    eligibilityData,
    parsedRequirements,
    isLoaded,
    cacheLoading,
    reloadSelectedData,
    isReloading,
    addSubreddit,
  } = useSubredditFlairData({
    eagerSubreddits: selected,
    loadAllOnMount: false,
    // Pass selected subreddits to auto-fetch user-specific status (userIsBanned, userIsContributor, etc.)
    selectedSubreddits: selected,
  });

  // Search & Temporary State
  const [temporarySubreddits, setTemporarySubreddits] = usePersistentState<string[]>('rmp_temporary_subreddits', []);
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<SearchResult[] | null>(null);
  const [hasSearched, setHasSearched] = React.useState(false);

  // Save to category state (for tracking saving subreddit name)
  const [savingSubreddit, setSavingSubreddit] = React.useState<string | null>(null);
  const [highlightedSubreddit, setHighlightedSubreddit] = React.useState<string | null>(null);

  // Debounce timer ref
  const searchTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const highlightTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const navigationRetryTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const rowRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

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
    if (!temporarySelectionEnabled || temporarySubreddits.length === 0) return categorizedSubreddits;
    return [
      { categoryName: 'Temporary', subreddits: temporarySubreddits },
      ...categorizedSubreddits
    ];
  }, [categorizedSubreddits, temporarySubreddits, temporarySelectionEnabled]);

  const flatSubreddits = useMemo(() => {
    return [...mergedSubreddits].sort((a, b) => a.localeCompare(b));
  }, [mergedSubreddits]);

  // Create a map of subreddit name to failed post for quick lookup
  const failedPostsBySubreddit = useMemo(() => {
    if (!failedPosts || failedPosts.length === 0) return {};
    return failedPosts.reduce((acc, post) => {
      acc[normalizeSubredditKey(post.subreddit)] = post;
      return acc;
    }, {} as Record<string, FailedPost>);
  }, [failedPosts]);

  // Clear temporary selections when temporarySelectionEnabled is toggled off
  React.useEffect(() => {
    if (!temporarySelectionEnabled && temporarySubreddits.length > 0) {
      // Remove temporary subreddits from selection
      const filtered = selected.filter(s => !temporarySubreddits.includes(s));
      if (filtered.length !== selected.length) {
        onSelectedChange(filtered);
      }
      // Clear the temporary subreddits list
      setTemporarySubreddits([]);
    }
  }, [temporarySelectionEnabled, temporarySubreddits, selected, onSelectedChange]);

  const hasMountedRef = useRef(false);
  React.useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (resetSignal !== undefined) {
      setExpandedCategories([]);
      setTemporarySubreddits([]);
    }
  }, [resetSignal, setExpandedCategories, setTemporarySubreddits]);

  const handleToggle = useCallback((name: string) => {
    const exists = selected.includes(name);
    if (exists) {
      onSelectedChange(selected.filter(s => s !== name));
    } else {
      onSelectedChange([...selected, name]);
    }
  }, [selected, onSelectedChange]);

  const handleToggleCategory = useCallback((categoryName: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryName)
        ? prev.filter(c => c !== categoryName)
        : [...prev, categoryName]
    );
  }, []);

  const handleSelectAllInCategory = useCallback((subreddits: string[], isAllSelected: boolean) => {
    if (isAllSelected) {
      onSelectedChange(selected.filter(s => !subreddits.includes(s)));
      return;
    }
    const combined = [...new Set([...selected, ...subreddits])];
    onSelectedChange(combined);
  }, [selected, onSelectedChange]);

  const handleFlairChange = useCallback((sr: string, id: string) => {
    const key = normalizeSubredditKey(sr);
    onFlairChange({ ...flairValue, [key]: id || undefined });
    onIssueFieldInteraction?.();
  }, [flairValue, onFlairChange, onIssueFieldInteraction]);

  const handleTitleSuffixChange = useCallback((sr: string, suffix: string) => {
    const key = normalizeSubredditKey(sr);
    onTitleSuffixChange({ ...titleSuffixValue, [key]: suffix || undefined });
    onIssueFieldInteraction?.();
  }, [titleSuffixValue, onTitleSuffixChange, onIssueFieldInteraction]);

  const hasMissingFlair = useCallback((subreddit: string) => {
    const key = normalizeSubredditKey(subreddit);
    const isSelected = selected.includes(subreddit);
    const isRequired = flairRequired[key];
    const hasFlairSelected = flairValue[key];
    return isSelected && isRequired && !hasFlairSelected;
  }, [selected, flairRequired, flairValue]);

  const handleReload = useCallback(() => {
    reloadSelectedData(selected);
  }, [reloadSelectedData, selected]);

  const registerRowRef = useCallback((name: string, node: HTMLDivElement | null) => {
    rowRefs.current[normalizeSubredditKey(name)] = node;
  }, []);

  const navigateToSubredditRow = useCallback((subreddit: string) => {
    const normalizedTarget = normalizeSubredditKey(subreddit);
    if (!normalizedTarget) {
      onNavigationHandled?.();
      return;
    }

    if (query.trim()) {
      setQuery('');
      setSearchResults(null);
      setHasSearched(false);
    }

    if (viewMode === 'grouped') {
      const containingCategory = displayCategories.find((category) =>
        category.subreddits.some((sub) => normalizeSubredditKey(sub) === normalizedTarget),
      );

      if (containingCategory) {
        setExpandedCategories((prev) => (
          prev.includes(containingCategory.categoryName)
            ? prev
            : [...prev, containingCategory.categoryName]
        ));
      }
    }

    const focusTarget = () => {
      const node = rowRefs.current[normalizedTarget];
      if (!node) return false;
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      node.focus({ preventScroll: true });
      setHighlightedSubreddit(normalizedTarget);
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedSubreddit((prev) => (prev === normalizedTarget ? null : prev));
      }, 1500);
      onNavigateToSubredditIssue?.(subreddit);
      onNavigationHandled?.();
      return true;
    };

    // Retry in a short window so category expansion + render can complete.
    if (focusTarget()) return;

    let attempts = 0;
    const maxAttempts = 8;
    const intervalMs = 120;
    if (navigationRetryTimerRef.current) {
      clearInterval(navigationRetryTimerRef.current);
    }

    navigationRetryTimerRef.current = setInterval(() => {
      attempts += 1;

      if (focusTarget()) {
        if (navigationRetryTimerRef.current) {
          clearInterval(navigationRetryTimerRef.current);
          navigationRetryTimerRef.current = null;
        }
        return;
      }

      if (attempts >= maxAttempts) {
        if (navigationRetryTimerRef.current) {
          clearInterval(navigationRetryTimerRef.current);
          navigationRetryTimerRef.current = null;
        }
        onNavigationHandled?.();
      }
    }, intervalMs);
  }, [
    viewMode,
    displayCategories,
    setExpandedCategories,
    onNavigateToSubredditIssue,
    onNavigationHandled,
    query,
  ]);

  React.useEffect(() => {
    if (!navigationTargetSubreddit) return;
    navigateToSubredditRow(navigationTargetSubreddit);
  }, [navigationTargetSubreddit, navigateToSubredditRow]);

  React.useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      if (navigationRetryTimerRef.current) {
        clearInterval(navigationRetryTimerRef.current);
        navigationRetryTimerRef.current = null;
      }
    };
  }, []);

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
      const { data } = await axios.get<{ subreddits: SearchResult[] }>(`/api/search-subreddits?q=${encodeURIComponent(searchQuery)}&limit=5`);
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

    if (!selected.includes(subredditName)) {
      const newSelected = [...selected, subredditName];
      onSelectedChange(newSelected);
      reloadSelectedData(newSelected);
    }

    // Reset search after adding
    setQuery('');
    setSearchResults(null);
    setHasSearched(false);
  }, [temporarySubreddits, allSubreddits, selected, onSelectedChange, reloadSelectedData]);

  const handleSaveToCategory = useCallback(async (subredditName: string, categoryId: string) => {
    try {
      if (entitlement === 'free' && onRequestUpgrade) {
        onRequestUpgrade({
          title: 'Save communities',
          message: 'Saving communities from search is a Pro feature. Upgrade to save unlimited lists.',
        });
        return;
      }

      setSavingSubreddit(subredditName);
      await addSubreddit(categoryId, subredditName);

      // Remove from temporary if it was there
      setTemporarySubreddits(prev => prev.filter(s => s !== subredditName));

      if (!selected.includes(subredditName)) {
        onSelectedChange([...selected, subredditName]);
      }

      // Reset search after saving
      setQuery('');
      setSearchResults(null);
      setHasSearched(false);
    } catch (error) {
      console.error('Failed to save subreddit', error);
      throw error; // Re-throw so dropdown can handle error state
    } finally {
      setSavingSubreddit(null);
    }
  }, [addSubreddit, selected, onSelectedChange, entitlement, onRequestUpgrade]);

  const handleClearSearch = useCallback(() => {
    setQuery('');
    setSearchResults(null);
    setHasSearched(false);
  }, []);

  // Run validation whenever dependencies change
  React.useEffect(() => {
    if (onValidationChange) {
      const missingFlairs = selected.filter(subreddit => {
        const key = normalizeSubredditKey(subreddit);
        const isRequired = flairRequired[key];
        const hasFlairSelected = flairValue[key];
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

  const showSearchUi = temporarySelectionEnabled;
  const showSearchResults = temporarySelectionEnabled && isSearchMode;

  return (
    <div className="space-y-4">
      {/* Search Bar (hidden for paid: temporary selection disabled) */}
      <div className="flex flex-col gap-3">
        {showSearchUi && (
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Find communities"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 pr-8 h-11 sm:h-10 md:h-9"
              aria-label="Find communities"
            />
            {query.length > 0 && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground md:transition-colors cursor-pointer p-1"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

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
      ) : showSearchResults ? (
        <div className="space-y-3">
          {/* Reddit Search Results Section - Show first */}
          {query.trim().length >= 2 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5 flex items-center gap-2">
                From Reddit
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
                        <SaveToCategoryDropdown
                          subredditName={sub.name}
                          onSave={(categoryId) => handleSaveToCategory(sub.name, categoryId)}
                          disabled={savingSubreddit === sub.name}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {hasSearched && !isSearching && !hasRedditResults && !hasLocalResults && (
                <div className="px-4 py-3 text-sm text-muted-foreground text-center border border-border rounded-md">
                  No communities found for &quot;{query}&quot;
                </div>
              )}
            </div>
          )}

          {/* Local Results Section - Show after Reddit results */}
          {hasLocalResults && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5">
                Your communities
              </div>
              <div className="space-y-2">
                {localFilteredSubreddits.map((name) => {
                  const key = normalizeSubredditKey(name);
                  const hasError = !!(showValidationErrors && hasMissingFlair(name));
                  const failedPost = failedPostsBySubreddit[key];
                  return (
                    <SubredditRow
                      key={name}
                      name={name}
                      hasError={hasError}
                      isSelected={selected.includes(name)}
                      isLoading={cacheLoading[key]}
                      flairRequired={flairRequired[key]}
                      flairOptions={flairOptions[key] || []}
                      subredditRules={subredditRules[key]}
                      postRequirements={postRequirements[key]}
                      titleSuffix={titleSuffixValue[key]}
                      flairValue={flairValue[key]}
                      onToggle={handleToggle}
                      onFlairChange={handleFlairChange}
                      onTitleSuffixChange={handleTitleSuffixChange}
                      failedPost={failedPost}
                      onRetryPost={onRetryPost}
                      onEditPost={onEditPost}
                      onRemovePost={onRemovePost}
                      validationIssues={
                        validationIssuesBySubreddit?.[name] ||
                        validationIssuesBySubreddit?.[key]
                      }
                      rowRef={(node) => registerRowRef(name, node)}
                      isHighlighted={normalizeSubredditKey(name) === highlightedSubreddit}
                      showInlineValidationHint={showInlineValidationHint}
                      onInlineHintClick={navigateToSubredditRow}
                      contentOverride={contentOverrides?.[name]}
                      onCustomize={onCustomize}
                      customizationEnabled={customizationEnabled}
                      eligibility={eligibilityData[key]}
                      userData={userData}
                      postKind={postKind}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* No Results At All */}
          {showNoResultsMessage && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground border border-border rounded-md">
              Nothing found for &quot;{query}&quot;
            </div>
          )}
        </div>
      ) : viewMode === 'all' ? (
        <div className="space-y-2">
          {flatSubreddits.map((name) => {
            const key = normalizeSubredditKey(name);
            const hasError = !!(showValidationErrors && hasMissingFlair(name));
            const failedPost = failedPostsBySubreddit[key];
            return (
              <SubredditRow
                key={name}
                name={name}
                hasError={hasError}
                isSelected={selected.includes(name)}
                isLoading={cacheLoading[key]}
                flairRequired={flairRequired[key]}
                flairOptions={flairOptions[key] || []}
                subredditRules={subredditRules[key]}
                postRequirements={postRequirements[key]}
                titleSuffix={titleSuffixValue[key]}
                flairValue={flairValue[key]}
                onToggle={handleToggle}
                onFlairChange={handleFlairChange}
                onTitleSuffixChange={handleTitleSuffixChange}
                failedPost={failedPost}
                onRetryPost={onRetryPost}
                onEditPost={onEditPost}
                onRemovePost={onRemovePost}
                validationIssues={
                  validationIssuesBySubreddit?.[name] ||
                  validationIssuesBySubreddit?.[key]
                }
                rowRef={(node) => registerRowRef(name, node)}
                isHighlighted={normalizeSubredditKey(name) === highlightedSubreddit}
                showInlineValidationHint={showInlineValidationHint}
                onInlineHintClick={navigateToSubredditRow}
                contentOverride={contentOverrides?.[name]}
                onCustomize={onCustomize}
                customizationEnabled={customizationEnabled}
                eligibility={eligibilityData[key]}
                userData={userData}
                postKind={postKind}
              />
            );
          })}
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
          eligibilityData={eligibilityData}
          userData={userData}
          postKind={postKind}
          cacheLoading={cacheLoading}
          showValidationErrors={showValidationErrors}
          failedPostsBySubreddit={failedPostsBySubreddit}
          onRetryPost={onRetryPost}
          onEditPost={onEditPost}
          onRemovePost={onRemovePost}
          validationIssuesBySubreddit={validationIssuesBySubreddit}
          highlightedSubreddit={highlightedSubreddit}
          showInlineValidationHint={showInlineValidationHint}
          onInlineHintClick={navigateToSubredditRow}
          registerRowRef={registerRowRef}
          contentOverrides={contentOverrides}
          onCustomize={onCustomize}
          customizationEnabled={customizationEnabled}
          onToggle={handleToggle}
          onToggleCategory={handleToggleCategory}
          onSelectAllInCategory={handleSelectAllInCategory}
          onFlairChange={handleFlairChange}
          onTitleSuffixChange={handleTitleSuffixChange}
          hasMissingFlair={hasMissingFlair}
        />
      )}

    </div>
  );
};

export default SubredditFlairPicker;
