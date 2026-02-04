import React, { useState, useMemo, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, ChevronDown, FileText, Hash } from 'lucide-react';
import { TitleTag } from '../../utils/subredditCache';
import { PostRequirements } from '@/utils/reddit';

export interface SubredditRules {
  requiresGenderTag: boolean;
  requiresContentTag: boolean;
  genderTags: string[];
  contentTags: string[];
  titleTags?: TitleTag[];
  submitText?: string;
}

export interface SubredditRowProps {
  name: string;
  hasError: boolean;
  isSelected: boolean;
  isLoading?: boolean;
  flairRequired?: boolean;
  flairOptions: { id: string; text: string }[];
  subredditRules?: SubredditRules;
  postRequirements?: PostRequirements;
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
  postRequirements,
  titleSuffix,
  flairValue,
  onToggle,
  onFlairChange,
  onTitleSuffixChange
}: SubredditRowProps) => {
  const checkboxId = `checkbox-${name}`;
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Get suffix options from title_required_strings
  const suffixOptions = useMemo(() => {
    const options: string[] = [];
    if (postRequirements?.title_required_strings) {
      options.push(...postRequirements.title_required_strings);
    }
    return options;
  }, [postRequirements]);

  // Check if current suffix is a custom value (not in options)
  const isCustomSuffix = useMemo(() => {
    if (!titleSuffix) return false;
    return suffixOptions.length > 0 && !suffixOptions.includes(titleSuffix);
  }, [titleSuffix, suffixOptions]);

  // Auto-show custom input when a custom suffix is persisted
  useEffect(() => {
    if (isCustomSuffix) {
      setShowCustomInput(true);
    }
  }, [isCustomSuffix]);

  // Title length constraints
  const titleMinLength = postRequirements?.title_text_min_length;
  const titleMaxLength = postRequirements?.title_text_max_length;
  const hasTitleLengthConstraint = titleMinLength !== undefined || titleMaxLength !== undefined;

  // Has guidelines
  const hasGuidelines = postRequirements?.guidelines_text && postRequirements.guidelines_text.trim().length > 0;

  // Has blacklisted strings
  const hasBlacklist = (postRequirements?.title_blacklisted_strings?.length ?? 0) > 0;

  // Has required title strings (gender tags etc)
  const hasRequiredStrings = (postRequirements?.title_required_strings?.length ?? 0) > 0;

  const handleRowClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('select') || target.closest('input') || target.closest('button') || target.closest('.expand-trigger') || target.closest('[data-radix-select-viewport]') || target.closest('[role="listbox"]')) {
      return;
    }
    onToggle(name);
  };

  const handleCheckboxContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  const handleControlsClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  const handleSuffixSelectChange = (value: string) => {
    if (value === '__custom__') {
      setShowCustomInput(true);
      // Don't clear existing custom value when switching to custom mode
      if (!isCustomSuffix) {
        onTitleSuffixChange(name, '');
      }
    } else if (value === '__none__') {
      setShowCustomInput(false);
      onTitleSuffixChange(name, '');
    } else {
      setShowCustomInput(false);
      onTitleSuffixChange(name, value);
    }
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  // Determine if we should show the expand button
  const canExpand = isSelected && (hasGuidelines || hasBlacklist || subredditRules?.submitText);

  // Determine if we should show tag controls (only when there are required strings)
  const showTagControls = isSelected && hasRequiredStrings;

  return (
    <div className="border-b border-border/50 last:border-b-0">
      {/* Main Row */}
      <div
        className={`
          flex flex-col sm:flex-row sm:items-center sm:justify-between px-3 sm:px-4 py-3 transition-colors cursor-pointer gap-2
          ${hasError ? 'bg-red-500/20 border-l-2 border-red-500' : 'hover:bg-secondary/50'}
        `}
        onClick={handleRowClick}
        role="button"
        tabIndex={0}
        aria-label={`Toggle r/${name}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle(name);
          }
        }}
      >
        <div className="flex items-center gap-2 flex-grow min-w-0 pr-2">
          <div className="flex items-center" onClick={handleCheckboxContainerClick}>
            <Checkbox
              id={checkboxId}
              checked={isSelected}
              onCheckedChange={() => onToggle(name)}
            />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
            {hasError && (
              <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" aria-hidden="true" />
            )}
            <span
              className={`text-sm truncate select-none font-medium ${hasError ? 'text-red-400' : ''}`}
            >
              r/{name}
            </span>

            {/* Loading indicator */}
            {isLoading && (
              <div className="w-3 h-3 border-2 border-muted border-t-primary rounded-full animate-spin" aria-label="Loading" />
            )}

            {/* Info Trigger */}
            {!isLoading && isSelected && canExpand && (
              <button
                onClick={handleExpandClick}
                className="bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground rounded-full w-4 h-4 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
                aria-label="Community rules"
                title="Community rules"
              >
                <span className="font-serif font-bold italic text-[10px]">i</span>
              </button>
            )}

            {/* Flair Required Badge - Subtler */}
            {!isLoading && isSelected && flairRequired && (
              <Badge variant="secondary" className="h-4 px-1 text-[9px] uppercase font-bold tracking-wider text-muted-foreground bg-muted hover:bg-muted flex-shrink-0" title="This community requires a flair">
                Flair
              </Badge>
            )}
          </div>
        </div>

        {/* Row 2: Controls (Flair/Tag Selection) - Only when selected */}
        {isSelected && (showTagControls || flairOptions.length > 0) && (
          <div className={`flex items-center gap-2 flex-nowrap sm:justify-end w-full sm:w-auto mt-1 sm:mt-0 flex-shrink-0 ${!isSelected ? 'hidden' : ''}`} onClick={handleControlsClick}>

            {/* Flair Dropdown - Only show when there are flair options */}
            {flairOptions.length > 0 && (
              <Select
                value={flairValue || '__none__'}
                onValueChange={(value) => onFlairChange(name, value === '__none__' ? '' : value)}
              >
                <SelectTrigger
                  className={`h-7 flex-1 w-full min-w-[80px] sm:max-w-[140px] text-xs cursor-pointer flex-shrink-0 ${hasError
                    ? 'border-red-500 bg-red-500/10 text-red-400'
                    : ''
                    }`}
                  aria-label={`Pick flair for r/${name}`}
                >
                  <SelectValue placeholder={flairRequired ? 'Flair (required)' : 'Flair'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{flairRequired ? 'Flair (required)' : 'Flair'}</SelectItem>
                  {flairOptions.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.text || '—'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

              {/* Title Suffix - Only show when required strings exist */}
              {showTagControls && (
              <>
                {!showCustomInput ? (
                  <Select
                    value={isCustomSuffix ? '__custom__' : (titleSuffix || '__none__')}
                    onValueChange={handleSuffixSelectChange}
                  >
                    <SelectTrigger
                      className="h-7 flex-1 w-full min-w-[70px] sm:min-w-[80px] text-xs cursor-pointer flex-shrink-0"
                      aria-label={`Title tag for r/${name}`}
                    >
                      <SelectValue placeholder="Title tag" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Title tag</SelectItem>
                      {suffixOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                      <SelectItem value="__custom__">Custom tag…</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-1 flex-shrink-0 flex-1">
                    <Input
                      className="h-7 flex-1 w-full text-xs px-1.5"
                      placeholder="e.g. (f), 25F, [OC]"
                      value={titleSuffix || ''}
                      onChange={(e) => onTitleSuffixChange(name, e.target.value)}
                      title="Add a tag to your title for this community"
                      aria-label={`Title suffix for r/${name}`}
                    />
                    <button
                      onClick={() => setShowCustomInput(false)}
                      className="text-xs text-muted-foreground hover:text-foreground cursor-pointer p-1"
                      aria-label="Switch to dropdown"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Expanded Details Section */}
      {isExpanded && isSelected && (
        <div className="px-4 py-3 bg-muted/30 border-t border-border/30 space-y-2 animate-in slide-in-from-top-2 duration-200">
          {/* Guidelines */}
          {hasGuidelines && (
            <div className="text-xs">
              <span className="font-medium text-foreground">📝 Guidelines:</span>
              <p className="mt-1 text-muted-foreground whitespace-pre-wrap break-words">
                {postRequirements?.guidelines_text}
              </p>
            </div>
          )}

          {/* Submit Text (from subreddit rules) */}
          {subredditRules?.submitText && !hasGuidelines && (
            <div className="text-xs">
              <span className="font-medium text-foreground">📝 Posting Rules:</span>
              <p className="mt-1 text-muted-foreground whitespace-pre-wrap break-words">
                {subredditRules.submitText}
              </p>
            </div>
          )}

          {/* Required Title Strings */}
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

          {/* Blacklisted Strings */}
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

          {/* Title Length Details */}
          {hasTitleLengthConstraint && (
            <div className="text-xs flex items-center gap-2">
              <span className="font-medium text-foreground">📏 Title Length:</span>
              <span className="text-muted-foreground">
                {titleMinLength || 0} - {titleMaxLength || 'unlimited'} characters
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

SubredditRow.displayName = 'SubredditRow';

export default SubredditRow;
