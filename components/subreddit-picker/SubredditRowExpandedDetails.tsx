import React from 'react';
import { PostRequirements } from '@/utils/reddit';
import { SubredditRules } from './subredditRow.types';

interface SubredditRowExpandedDetailsProps {
  isExpanded: boolean;
  isSelected: boolean;
  postRequirements?: PostRequirements;
  subredditRules?: SubredditRules;
}

const SubredditRowExpandedDetails: React.FC<SubredditRowExpandedDetailsProps> = ({
  isExpanded,
  isSelected,
  postRequirements,
  subredditRules,
}) => {
  const titleMinLength = postRequirements?.title_text_min_length;
  const titleMaxLength = postRequirements?.title_text_max_length;
  const hasTitleLengthConstraint = titleMinLength !== undefined || titleMaxLength !== undefined;
  const hasGuidelines = !!(postRequirements?.guidelines_text && postRequirements.guidelines_text.trim().length > 0);
  const hasBlacklist = (postRequirements?.title_blacklisted_strings?.length ?? 0) > 0;
  const hasRequiredStrings = (postRequirements?.title_required_strings?.length ?? 0) > 0;

  if (!isExpanded || !isSelected) {
    return null;
  }

  return (
    <div className="px-4 py-3 bg-muted/30 border-t border-border/30 space-y-2 animate-in slide-in-from-top-2 duration-200">
      {hasGuidelines && (
        <div className="text-xs">
          <span className="font-medium text-foreground">📝 Guidelines:</span>
          <p className="mt-1 text-muted-foreground whitespace-pre-wrap break-words">
            {postRequirements?.guidelines_text}
          </p>
        </div>
      )}

      {subredditRules?.submitText && !hasGuidelines && (
        <div className="text-xs">
          <span className="font-medium text-foreground">📝 Posting Rules:</span>
          <p className="mt-1 text-muted-foreground whitespace-pre-wrap break-words">
            {subredditRules.submitText}
          </p>
        </div>
      )}

      {hasRequiredStrings && (
        <div className="text-xs">
          <span className="font-medium text-foreground">✅ Required Tags (one of):</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {postRequirements?.title_required_strings?.map((tag) => (
              <span key={tag} className="px-1.5 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded text-[10px] font-mono">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasBlacklist && (
        <div className="text-xs">
          <span className="font-medium text-foreground">⚠️ Blacklisted Words:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {postRequirements?.title_blacklisted_strings?.map((word) => (
              <span key={word} className="px-1.5 py-0.5 bg-red-500/10 text-red-600 dark:text-red-400 rounded text-[10px] line-through">
                {word}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasTitleLengthConstraint && (
        <div className="text-xs flex items-center gap-2">
          <span className="font-medium text-foreground">📏 Title Length:</span>
          <span className="text-muted-foreground">
            {titleMinLength || 0} - {titleMaxLength || 'unlimited'} characters
          </span>
        </div>
      )}
    </div>
  );
};

export default SubredditRowExpandedDetails;
