import React from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, AlertTriangle, Settings } from 'lucide-react';
import SubredditRow, { SubredditRules } from './SubredditRow';
import { PostRequirements, SubredditEligibility, RedditUser } from '@/utils/reddit';
import { FailedPost } from '@/hooks/useFailedPosts';
import { ValidationIssue } from '@/lib/preflightValidation';
import { PerSubredditOverride } from './CustomizePostDialog';
import { normalizeSubredditKey } from '@/lib/subredditKey';

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
  postRequirements: Record<string, PostRequirements>;
  /** Eligibility data for each subreddit */
  eligibilityData?: Record<string, SubredditEligibility>;
  /** User data for eligibility checks */
  userData?: RedditUser;
  /** Post kind for eligibility checks - determines if submission type is valid */
  postKind?: 'self' | 'link' | 'image' | 'video' | 'gallery';
  cacheLoading: Record<string, boolean>;
  showValidationErrors?: boolean;
  /** Map of subreddit name to failed post data */
  failedPostsBySubreddit?: Record<string, FailedPost>;
  /** Callback when retry is clicked */
  onRetryPost?: (id: string) => void;
  /** Callback when edit is clicked */
  onEditPost?: (post: FailedPost) => void;
  /** Callback when remove is clicked */
  onRemovePost?: (id: string) => void;
  /** Validation issues grouped by subreddit */
  validationIssuesBySubreddit?: Record<string, ValidationIssue[]>;
  highlightedSubreddit?: string | null;
  showInlineValidationHint?: boolean;
  onInlineHintClick?: (name: string) => void;
  registerRowRef?: (name: string, node: HTMLDivElement | null) => void;
  /** Per-subreddit content overrides (PRO feature) */
  contentOverrides?: Record<string, PerSubredditOverride>;
  /** Callback when customize is clicked */
  onCustomize?: (name: string) => void;
  /** Whether customization is enabled (PRO feature) */
  customizationEnabled?: boolean;
  onToggle: (name: string) => void;
  onToggleCategory: (categoryName: string) => void;
  onSelectAllInCategory: (subreddits: string[], isAllSelected: boolean) => void;
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
  postRequirements,
  eligibilityData,
  userData,
  postKind,
  cacheLoading,
  showValidationErrors,
  failedPostsBySubreddit,
  onRetryPost,
  onEditPost,
  onRemovePost,
  validationIssuesBySubreddit,
  highlightedSubreddit,
  showInlineValidationHint,
  onInlineHintClick,
  registerRowRef,
  contentOverrides,
  onCustomize,
  customizationEnabled,
  onToggle,
  onToggleCategory,
  onSelectAllInCategory,
  onFlairChange,
  onTitleSuffixChange,
  hasMissingFlair,
}) => {
  const hasBlockingValidationErrors = (subreddit: string) => {
    const issues =
      validationIssuesBySubreddit?.[subreddit] ||
      validationIssuesBySubreddit?.[normalizeSubredditKey(subreddit)] ||
      [];
    return issues.some((issue) => issue.severity === 'error');
  };

  const categoryHasErrors = (subreddits: string[]) => {
    return showValidationErrors && subreddits.some(
      (subreddit) => hasMissingFlair(subreddit) || hasBlockingValidationErrors(subreddit),
    );
  };

  if (categorizedSubreddits.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-muted-foreground">
        <p className="text-sm">No communities added yet.</p>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer"
        >
          <Settings className="h-4 w-4" />
          Go to Settings
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {categorizedSubreddits.map(({ categoryName, subreddits }) => {
        const hasErrors = categoryHasErrors(subreddits);
        const isExpanded = expandedCategories.includes(categoryName);
        const selectedCount = subreddits.filter(s => selected.includes(s)).length;
        const allSelected = subreddits.length > 0 && selectedCount === subreddits.length;

        return (
          <div key={categoryName} className="space-y-3">
            <button
              onClick={() => onToggleCategory(categoryName)}
              className="w-full px-1 py-1.5 flex items-center justify-between hover:text-foreground transition-colors cursor-pointer"
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
                  ({selectedCount}/{subreddits.length})
                </span>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAllInCategory(subreddits, allSelected);
                }}
                className="text-xs text-primary hover:text-primary/80 font-medium px-2 py-1 rounded-md hover:bg-primary/10 transition-colors cursor-pointer"
                aria-label={`${allSelected ? 'Unselect' : 'Select'} all subreddits in ${categoryName}`}
              >
                {allSelected ? 'Unselect All' : 'Select All'}
              </button>
            </button>

            {isExpanded && (
              <div className="space-y-2">
                {subreddits.map((name) => {
                  const key = normalizeSubredditKey(name);
                  const hasError = !!(showValidationErrors && hasMissingFlair(name));
                  const failedPost = failedPostsBySubreddit?.[key];
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
                      onToggle={onToggle}
                      onFlairChange={onFlairChange}
                      onTitleSuffixChange={onTitleSuffixChange}
                      failedPost={failedPost}
                      onRetryPost={onRetryPost}
                      onEditPost={onEditPost}
                      onRemovePost={onRemovePost}
                      validationIssues={
                        validationIssuesBySubreddit?.[name] ||
                        validationIssuesBySubreddit?.[key]
                      }
                      rowRef={(node) => registerRowRef?.(name, node)}
                      isHighlighted={normalizeSubredditKey(name) === highlightedSubreddit}
                      showInlineValidationHint={showInlineValidationHint}
                      onInlineHintClick={onInlineHintClick}
                      contentOverride={contentOverrides?.[name]}
                      onCustomize={onCustomize}
                      customizationEnabled={customizationEnabled}
                      eligibility={eligibilityData?.[key]}
                      userData={userData}
                      postKind={postKind}
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
