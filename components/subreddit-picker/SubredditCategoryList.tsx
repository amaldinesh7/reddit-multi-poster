import React from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, Settings } from 'lucide-react';
import SubredditRow, { SubredditRules } from './SubredditRow';

interface CategoryData {
  categoryName: string;
  subreddits: string[];
}

interface SubredditCategoryListProps {
  categorizedSubreddits: CategoryData[];
  selected: string[];
  expandedCategories: string[];
  flairOptions: Record<string, { id: string; text: string }[]>;
  flairRequired: Record<string, boolean>;
  flairValue: Record<string, string | undefined>;
  titleSuffixValue: Record<string, string | undefined>;
  subredditRules: Record<string, SubredditRules>;
  cacheLoading: Record<string, boolean>;
  showValidationErrors?: boolean;
  onToggle: (name: string) => void;
  onToggleCategory: (categoryName: string) => void;
  onSelectAllInCategory: (subreddits: string[]) => void;
  onFlairChange: (name: string, id: string) => void;
  onTitleSuffixChange: (name: string, suffix: string) => void;
  hasMissingFlair: (subreddit: string) => boolean;
}

const SubredditCategoryList: React.FC<SubredditCategoryListProps> = ({
  categorizedSubreddits,
  selected,
  expandedCategories,
  flairOptions,
  flairRequired,
  flairValue,
  titleSuffixValue,
  subredditRules,
  cacheLoading,
  showValidationErrors,
  onToggle,
  onToggleCategory,
  onSelectAllInCategory,
  onFlairChange,
  onTitleSuffixChange,
  hasMissingFlair,
}) => {
  const categoryHasErrors = (subreddits: string[]) => {
    return showValidationErrors && subreddits.some(subreddit => hasMissingFlair(subreddit));
  };

  if (categorizedSubreddits.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-muted-foreground">
        <p className="text-sm">No subreddits configured.</p>
        <a 
          href="/settings" 
          className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer"
        >
          <Settings className="h-4 w-4" />
          Go to Settings
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border overflow-hidden">
      {categorizedSubreddits.map(({ categoryName, subreddits }) => {
        const hasErrors = categoryHasErrors(subreddits);
        const isExpanded = expandedCategories.includes(categoryName);
        const selectedCount = subreddits.filter(s => selected.includes(s)).length;

        return (
          <div key={categoryName} className="border-b border-border last:border-b-0">
            <button
              onClick={() => onToggleCategory(categoryName)}
              className="w-full px-4 py-3 bg-secondary flex items-center justify-between hover:bg-secondary/80 transition-colors cursor-pointer"
              aria-expanded={isExpanded}
              aria-label={`${categoryName} category, ${subreddits.length} subreddits`}
            >
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                )}
                {hasErrors && (
                  <AlertTriangle className="h-4 w-4 text-red-500" aria-label="Has validation errors" />
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
                  onSelectAllInCategory(subreddits);
                }}
                className="text-xs text-primary hover:text-primary/80 font-medium px-2 py-1 rounded-md hover:bg-primary/10 transition-colors cursor-pointer"
                aria-label={`Select all subreddits in ${categoryName}`}
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
                      onToggle={onToggle}
                      onFlairChange={onFlairChange}
                      onTitleSuffixChange={onTitleSuffixChange}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SubredditCategoryList;
