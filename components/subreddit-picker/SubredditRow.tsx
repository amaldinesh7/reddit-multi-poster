import React, { useState, useMemo } from 'react';
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
      onTitleSuffixChange(name, '');
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
          flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 transition-colors cursor-pointer
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
        <div className="flex items-center" onClick={handleCheckboxContainerClick}>
          <Checkbox
            id={checkboxId}
            checked={isSelected}
            onCheckedChange={() => onToggle(name)}
          />
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-1.5 sm:gap-2">
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

          {/* Info/Status Line (Mobile & Desktop) */}
          {!isLoading && isSelected && (
            <div className="flex items-center gap-2 mt-1 w-full basis-full sm:basis-auto sm:w-auto sm:mt-0">
              {/* Info Trigger (Mobile/Desktop) */}
              {canExpand && (
                <button
                  onClick={handleExpandClick}
                  className="bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground rounded-full w-5 h-5 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Show posting rules"
                  title="View posting rules"
                >
                  <span className="font-serif font-bold italic text-xs">i</span>
                </button>
              )}

              {/* Flair Required - Prominent */}
              {flairRequired && (
                <Badge variant="destructive" className="h-5 px-1.5 text-[10px] uppercase font-bold tracking-wider shadow-sm" title="Flair selection is required">
                  Flair Req
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0" onClick={handleControlsClick}>
          {/* Title Suffix */}

          {/* Title Suffix - Only show when required strings exist */}
          {showTagControls && (
            <>
              {!showCustomInput ? (
                <Select
                  value={isCustomSuffix ? '__custom__' : (titleSuffix || '__none__')}
                  onValueChange={handleSuffixSelectChange}
                >
                  <SelectTrigger
                    className="h-7 w-16 sm:w-20 text-xs cursor-pointer"
                    aria-label={`Title tag for r/${name}`}
                  >
                    <SelectValue placeholder="Tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Tag</SelectItem>
                    {suffixOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                    <SelectItem value="__custom__">Custom...</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-1">
                  <Input
                    className="h-7 w-14 sm:w-16 text-xs px-1.5"
                    placeholder="Tag"
                    value={titleSuffix || ''}
                    onChange={(e) => onTitleSuffixChange(name, e.target.value)}
                    title="Custom title suffix (e.g., (f), 25F, [OC])"
                    aria-label={`Title suffix for r/${name}`}
                  />
                  <button
                    onClick={() => setShowCustomInput(false)}
                    className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    aria-label="Switch to dropdown"
                  >
                    ✕
                  </button>
                </div>
              )}
            </>
          )}

          {/* Flair Dropdown - Only show when there are flair options */}
          {isSelected && flairOptions.length > 0 && (
            <Select
              value={flairValue || '__none__'}
              onValueChange={(value) => onFlairChange(name, value === '__none__' ? '' : value)}
            >
              <SelectTrigger
                className={`h-7 w-20 sm:w-28 text-xs cursor-pointer ${hasError
                  ? 'border-red-500 bg-red-500/10 text-red-400'
                  : ''
                  }`}
                aria-label={`Select flair for r/${name}`}
              >
                <SelectValue placeholder={flairRequired ? 'Flair*' : 'Flair'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{flairRequired ? 'Flair*' : 'Flair'}</SelectItem>
                {flairOptions.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.text || '—'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
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
