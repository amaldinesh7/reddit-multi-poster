import React from 'react';
import axios from 'axios';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RefreshCw, Search } from 'lucide-react';
import { useSubredditFlairData } from '../hooks/useSubredditFlairData';
import { SubredditCategoryList, SubredditSearchResults } from './subreddit-picker';

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
    isLoaded,
    cacheLoading,
    reloadSelectedData,
    isReloading,
  } = useSubredditFlairData();

  const [query, setQuery] = React.useState('');
  const [expandedCategories, setExpandedCategories] = React.useState<string[]>([]);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return allSubreddits;
    return allSubreddits.filter(o => o.toLowerCase().includes(query.toLowerCase()));
  }, [allSubreddits, query]);

  const handleToggle = (name: string) => {
    const exists = selected.includes(name);
    const next = exists ? selected.filter(s => s !== name) : (selected.length < 30 ? [...selected, name] : selected);
    onSelectedChange(next);
  };

  const handleToggleCategory = (categoryName: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryName)
        ? prev.filter(c => c !== categoryName)
        : [...prev, categoryName]
    );
  };

  const handleSelectAllInCategory = (subreddits: string[]) => {
    const newSelected = [...new Set([...selected, ...subreddits])];
    if (newSelected.length <= 30) {
      onSelectedChange(newSelected);
    }
  };

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

  const handleReload = () => {
    reloadSelectedData(selected);
  };

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

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Filter subreddits..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
            aria-label="Filter subreddits"
          />
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
      ) : query.trim() ? (
        <SubredditSearchResults
          filtered={filtered}
          query={query}
          selected={selected}
          flairOptions={flairOptions}
          flairRequired={flairRequired}
          flairValue={flairValue}
          titleSuffixValue={titleSuffixValue}
          subredditRules={subredditRules}
          cacheLoading={cacheLoading}
          showValidationErrors={showValidationErrors}
          onToggle={handleToggle}
          onFlairChange={handleFlairChange}
          onTitleSuffixChange={handleTitleSuffixChange}
          hasMissingFlair={hasMissingFlair}
        />
      ) : (
        <SubredditCategoryList
          categorizedSubreddits={categorizedSubreddits}
          selected={selected}
          expandedCategories={expandedCategories}
          flairOptions={flairOptions}
          flairRequired={flairRequired}
          flairValue={flairValue}
          titleSuffixValue={titleSuffixValue}
          subredditRules={subredditRules}
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
    </div>
  );
};

export default SubredditFlairPicker;
