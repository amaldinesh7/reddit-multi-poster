import React from 'react';
import SubredditRow, { SubredditRules } from './SubredditRow';
import { PostRequirements } from '@/utils/reddit';

interface SubredditSearchResultsProps {
  filtered: string[];
  query: string;
  selected: string[];
  flairOptions: Record<string, { id: string; text: string }[]>;
  flairRequired: Record<string, boolean>;
  flairValue: Record<string, string | undefined>;
  titleSuffixValue: Record<string, string | undefined>;
  subredditRules: Record<string, SubredditRules>;
  postRequirements: Record<string, PostRequirements>;
  cacheLoading: Record<string, boolean>;
  showValidationErrors?: boolean;
  onToggle: (name: string) => void;
  onFlairChange: (name: string, id: string) => void;
  onTitleSuffixChange: (name: string, suffix: string) => void;
  hasMissingFlair: (subreddit: string) => boolean;
}

const SubredditSearchResults: React.FC<SubredditSearchResultsProps> = ({
  filtered,
  query,
  selected,
  flairOptions,
  flairRequired,
  flairValue,
  titleSuffixValue,
  subredditRules,
  postRequirements,
  cacheLoading,
  showValidationErrors,
  onToggle,
  onFlairChange,
  onTitleSuffixChange,
  hasMissingFlair,
}) => {
  return (
    <div className="rounded-md border border-border overflow-hidden">
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
            postRequirements={postRequirements[name]}
            titleSuffix={titleSuffixValue[name]}
            flairValue={flairValue[name]}
            onToggle={onToggle}
            onFlairChange={onFlairChange}
            onTitleSuffixChange={onTitleSuffixChange}
          />
        );
      })}
      {filtered.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No subreddits found matching &quot;{query}&quot;
        </div>
      )}
    </div>
  );
};

export default SubredditSearchResults;
