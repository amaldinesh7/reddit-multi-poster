import React, { useState, useMemo, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItemPrimitive,
} from '@/components/ui/dropdown-menu';
import { AlertTriangle, AlertCircle, Info, ChevronDown, FileText, Hash, RefreshCw, Pencil, X, Tag, Clock, Ban, Key, Image, Wifi, Lock, Link as LinkIcon, Type, SlidersHorizontal } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { TitleTag } from '../../utils/subredditCache';
import { PostRequirements, SubredditEligibility, RedditUser } from '@/utils/reddit';
import { FailedPost } from '@/hooks/useFailedPosts';
import { ClassifiedError } from '@/lib/errorClassification';
import { ValidationIssue, getEligibilityForSubreddit, EligibilityResult } from '@/lib/preflightValidation';
import { PerSubredditOverride } from './CustomizePostDialog';
import { EligibilityBadge } from '../UserEligibilityIndicator';

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
  /** Failed post data for this subreddit (if any) */
  failedPost?: FailedPost;
  /** Callback when retry is clicked */
  onRetryPost?: (id: string) => void;
  /** Callback when edit is clicked */
  onEditPost?: (post: FailedPost) => void;
  /** Callback when remove is clicked */
  onRemovePost?: (id: string) => void;
  /** Validation issues for this subreddit (pre-flight validation) */
  validationIssues?: ValidationIssue[];
  /** Per-subreddit content override (PRO feature) */
  contentOverride?: PerSubredditOverride;
  /** Callback when customize button is clicked */
  onCustomize?: (name: string) => void;
  /** Whether customization is enabled (PRO feature) */
  customizationEnabled?: boolean;
  /** Eligibility data for this subreddit */
  eligibility?: SubredditEligibility;
  /** User data for eligibility checks */
  userData?: RedditUser;
  /** Post kind for eligibility checks */
  postKind?: 'self' | 'link' | 'image' | 'video' | 'gallery';
}

// Helper to get icon for error type
const getErrorIcon = (iconName: ClassifiedError['icon'], className: string = 'h-4 w-4') => {
  switch (iconName) {
    case 'tag': return <Tag className={className} />;
    case 'clock': return <Clock className={className} />;
    case 'ban': return <Ban className={className} />;
    case 'key': return <Key className={className} />;
    case 'text': return <FileText className={className} />;
    case 'lock': return <Lock className={className} />;
    case 'image': return <Image className={className} />;
    case 'wifi': return <Wifi className={className} />;
    default: return <AlertTriangle className={className} />;
  }
};

// Helper to get icon for validation field type
const getFieldIcon = (field: ValidationIssue['field'], className: string = 'h-4 w-4') => {
  switch (field) {
    case 'title': return <Type className={className} />;
    case 'body': return <FileText className={className} />;
    case 'flair': return <Tag className={className} />;
    case 'url': return <LinkIcon className={className} />;
    case 'media': return <Image className={className} />;
    default: return <AlertTriangle className={className} />;
  }
};

// Helper to get severity icon and styles
const getSeverityStyles = (severity: ValidationIssue['severity']) => {
  switch (severity) {
    case 'error':
      return {
        icon: <AlertTriangle className="h-3.5 w-3.5" />,
        bgClass: 'bg-red-500/15',
        textClass: 'text-red-500',
        hoverClass: 'hover:bg-red-500/25',
      };
    case 'warning':
      return {
        icon: <AlertTriangle className="h-3.5 w-3.5" />,
        bgClass: 'bg-yellow-500/15',
        textClass: 'text-yellow-500',
        hoverClass: 'hover:bg-yellow-500/25',
      };
    case 'info':
      return {
        icon: <Info className="h-3.5 w-3.5" />,
        bgClass: 'bg-blue-500/15',
        textClass: 'text-blue-500',
        hoverClass: 'hover:bg-blue-500/25',
      };
  }
};

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
  onTitleSuffixChange,
  failedPost,
  onRetryPost,
  onEditPost,
  onRemovePost,
  validationIssues,
  contentOverride,
  onCustomize,
  customizationEnabled,
  eligibility,
  userData,
  postKind = 'self',
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

  // Validation issues computations
  const validationErrors = useMemo(() => 
    validationIssues?.filter(i => i.severity === 'error') || [],
    [validationIssues]
  );
  const validationWarnings = useMemo(() => 
    validationIssues?.filter(i => i.severity === 'warning') || [],
    [validationIssues]
  );
  const hasValidationIssues = (validationIssues?.length ?? 0) > 0;
  const hasValidationErrors = validationErrors.length > 0;
  const validationSummary = useMemo(() => {
    if (!hasValidationIssues) return null;
    if (hasValidationErrors) {
      return {
        severity: 'error' as const,
        count: validationErrors.length,
        label: validationErrors.length === 1 ? 'Fix required' : `${validationErrors.length} issues`,
      };
    }
    return {
      severity: 'warning' as const,
      count: validationWarnings.length,
      label: validationWarnings.length === 1 ? 'Warning' : `${validationWarnings.length} warnings`,
    };
  }, [hasValidationIssues, hasValidationErrors, validationErrors.length, validationWarnings.length]);

  // Compute eligibility result
  const eligibilityResult = useMemo((): EligibilityResult | null => {
    if (!isSelected) return null;
    return getEligibilityForSubreddit(name, eligibility, userData, postKind);
  }, [name, eligibility, userData, postKind, isSelected]);

  const needsVerification = useMemo(() => {
    if (!eligibilityResult) return false;
    const { checks } = eligibilityResult;
    const isRestricted = checks.subredditType === 'restricted' || checks.restrictedPosting;
    if (!isRestricted) return false;
    return !checks.approved && !checks.moderator;
  }, [eligibilityResult]);

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
    <div
      className={`
        rounded-lg border border-border/60 bg-card/50 overflow-hidden
        ${(hasError || hasValidationErrors) ? 'border-red-500/40' : ''}
      `}
    >
      {/* Main Row */}
      <div
        className={`
          flex items-center justify-between px-3 sm:px-4 py-4 sm:py-3.5 transition-colors cursor-pointer gap-2
          ${(hasError || hasValidationErrors) ? 'bg-red-500/10' : 'hover:bg-secondary/50 active:bg-secondary/80'}
          active:scale-[0.99] transition-transform duration-75
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
        {/* Left Side: Checkbox + Name + Badges */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-6 h-6 flex-shrink-0 cursor-pointer" onClick={handleCheckboxContainerClick}>
            <Checkbox
              id={checkboxId}
              checked={isSelected}
              onCheckedChange={() => onToggle(name)}
              className="h-5 w-5"
            />
          </div>

          <div className="flex items-center gap-2 min-w-0">
            {hasError && (
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" aria-hidden="true" />
            )}
            <span
              className={`text-[15px] sm:text-sm truncate select-none font-semibold sm:font-medium ${hasError ? 'text-red-400' : ''}`}
            >
              r/{name}
            </span>

            {/* Loading indicator */}
            {isLoading && (
              <div className="w-3.5 h-3.5 border-2 border-muted border-t-primary rounded-full animate-spin flex-shrink-0" aria-label="Loading" />
            )}

            {/* Info Trigger */}
            {!isLoading && isSelected && canExpand && (
              <button
                onClick={handleExpandClick}
                className="bg-secondary/80 hover:bg-secondary text-foreground/70 hover:text-foreground rounded-full w-5 h-5 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
                aria-label="Community rules"
                title="Community rules"
              >
                <span className="font-serif font-bold italic text-[11px]">i</span>
              </button>
            )}

            {/* Flair Required Badge - Subtler */}
            {!isLoading && isSelected && flairRequired && (
              <Badge variant="secondary" className="h-4.5 px-1.5 text-[9px] uppercase font-bold tracking-wider text-foreground/70 bg-secondary/80 hover:bg-secondary flex-shrink-0" title="This community requires a flair">
                Flair
              </Badge>
            )}

            {/* Custom Content Indicator */}
            {!isLoading && isSelected && contentOverride && (contentOverride.title || contentOverride.body) && (
              <Badge variant="secondary" className="h-4.5 px-1.5 text-[9px] uppercase font-bold tracking-wider text-primary bg-primary/10 hover:bg-primary/20 flex-shrink-0" title="Custom content for this community">
                Custom
              </Badge>
            )}

            {/* Eligibility Badge */}
            {!isLoading && isSelected && eligibilityResult && needsVerification && (
              <EligibilityBadge
                status="verification"
                reason={eligibilityResult.reasons[0]}
                compact={true}
              />
            )}
          </div>
        </div>

        {/* Right Side: Customize Button + Error/Warning Indicators */}
        {isSelected && (customizationEnabled || hasValidationIssues || failedPost) && (
          <div className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer" onClick={handleControlsClick}>
            {/* Customize Button (PRO feature) */}
            {customizationEnabled && onCustomize && (
              <Tooltip content="Customize title & description for this community" side="left">
                <button
                  onClick={() => onCustomize(name)}
                  className={`p-1.5 rounded-md cursor-pointer transition-colors ${
                    contentOverride && (contentOverride.title || contentOverride.body)
                      ? 'bg-violet-500/15 text-violet-400 hover:bg-violet-500/25'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  aria-label="Customize content for this community"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            )}
            {/* Validation Issues Alert Icon with Dropdown - Pre-flight validation */}
            {hasValidationIssues && validationSummary && !failedPost && (
              <DropdownMenuRoot>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-1 cursor-pointer hover:opacity-80 transition-opacity"
                    aria-label={`${validationSummary.count} validation ${validationSummary.severity === 'error' ? 'error' : 'warning'}${validationSummary.count > 1 ? 's' : ''}`}
                    title={validationSummary.label}
                  >
                    <AlertTriangle className={`h-4 w-4 ${hasValidationErrors ? 'text-red-500' : 'text-yellow-500'}`} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 p-0">
                  {/* Compact header */}
                  <div className="px-3 py-2 bg-muted/50 border-b border-border">
                    <span className="font-medium text-sm">
                      {hasValidationErrors 
                        ? `${validationErrors.length} issue${validationErrors.length > 1 ? 's' : ''} to fix` 
                        : `${validationWarnings.length} warning${validationWarnings.length > 1 ? 's' : ''}`
                      }
                    </span>
                  </div>
                  
                  {/* Issues list */}
                  <div className="py-1">
                    {validationErrors.map((issue, idx) => (
                      <div key={`error-${idx}`} className="px-3 py-2 flex items-start gap-2 text-xs">
                        {getFieldIcon(issue.field, 'h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5')}
                        <span className="text-foreground">{issue.message}</span>
                      </div>
                    ))}
                    {validationWarnings.length > 0 && validationErrors.length > 0 && (
                      <div className="border-t border-border my-1" />
                    )}
                    {validationWarnings.map((issue, idx) => (
                      <div key={`warning-${idx}`} className="px-3 py-2 flex items-start gap-2 text-xs">
                        {getFieldIcon(issue.field, 'h-3.5 w-3.5 text-yellow-500 flex-shrink-0 mt-0.5')}
                        <span className="text-muted-foreground">{issue.message}</span>
                      </div>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenuRoot>
            )}

            {/* Failed Post Alert Icon with Dropdown */}
            {failedPost && (
              <DropdownMenuRoot>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-1 cursor-pointer hover:opacity-80 transition-opacity"
                    aria-label={`Error: ${failedPost.error.userMessage}`}
                    title={failedPost.error.userMessage}
                  >
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 p-0">
                  {/* Compact Error Header */}
                  <div className="px-3 py-2 bg-muted/50 border-b border-border">
                    <div className="flex items-center gap-2 text-red-500">
                      {getErrorIcon(failedPost.error.icon, 'h-4 w-4 flex-shrink-0')}
                      <span className="font-medium text-sm truncate">{failedPost.error.userMessage}</span>
                    </div>
                    {(failedPost.error.details || failedPost.error.originalMessage) && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {failedPost.error.details || failedPost.error.originalMessage}
                      </p>
                    )}
                  </div>
                  
                  {/* Compact Action Buttons */}
                  <div className="p-1">
                    {failedPost.error.category !== 'unfixable' && onRetryPost && (
                      <DropdownMenuItemPrimitive
                        onClick={() => onRetryPost(failedPost.id)}
                        className="flex items-center gap-2 px-2 py-1.5 text-xs text-blue-500 hover:bg-blue-500/10 rounded cursor-pointer"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Retry</span>
                      </DropdownMenuItemPrimitive>
                    )}
                    {['edit_flair', 'edit_title', 'edit_content', 'change_media'].includes(failedPost.error.action) && onEditPost && (
                      <DropdownMenuItemPrimitive
                        onClick={() => onEditPost(failedPost)}
                        className="flex items-center gap-2 px-2 py-1.5 text-xs text-amber-500 hover:bg-amber-500/10 rounded cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Edit &amp; Retry</span>
                      </DropdownMenuItemPrimitive>
                    )}
                    {onRemovePost && (
                      <DropdownMenuItemPrimitive
                        onClick={() => onRemovePost(failedPost.id)}
                        className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/80 rounded cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Dismiss</span>
                      </DropdownMenuItemPrimitive>
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenuRoot>
            )}
          </div>
        )}
      </div>

      {/* Row 2: Controls (Flair/Tag Selection) - Only when selected */}
      {isSelected && (showTagControls || flairOptions.length > 0) && (
        <div
          className={`
            flex items-center gap-2 px-3 sm:px-4 pb-3 pt-3 border-t border-border/60
            ${(hasError || hasValidationErrors) ? 'bg-red-500/10 border-red-500/30' : 'bg-secondary/20'}
          `}
          onClick={handleControlsClick}
        >
            {/* Flair Dropdown - Only show when there are flair options */}
            {flairOptions.length > 0 && (
              <NativeSelect
                value={flairValue || ''}
                onValueChange={(value) => onFlairChange(name, value)}
                placeholder={flairRequired ? 'Flair (required)' : 'Flair'}
                options={flairOptions.map((f) => ({
                  value: f.id,
                  label: f.text || '—',
                }))}
                className="flex-1 min-w-[100px] sm:max-w-[140px] flex-shrink-0"
                triggerClassName={`h-9 sm:h-8 text-xs font-medium ${hasError
                  ? 'border-red-500 bg-red-500/10 text-red-400'
                  : 'bg-secondary/80 hover:bg-secondary'
                }`}
                aria-label={`Pick flair for r/${name}`}
              />
            )}

            {/* Title Suffix - Only show when required strings exist */}
            {showTagControls && (
              <>
                {!showCustomInput ? (
                  <NativeSelect
                    value={isCustomSuffix ? '__custom__' : (titleSuffix || '')}
                    onValueChange={handleSuffixSelectChange}
                    placeholder="Title tag"
                    options={[
                      ...suffixOptions.map((opt) => ({ value: opt, label: opt })),
                      { value: '__custom__', label: 'Custom tag…' },
                    ]}
                    className="flex-1 min-w-[90px] sm:min-w-[80px] flex-shrink-0"
                    triggerClassName="h-9 sm:h-8 text-xs font-medium bg-secondary/80 hover:bg-secondary"
                    aria-label={`Title tag for r/${name}`}
                  />
                ) : (
                  <div className="flex items-center gap-1 flex-shrink-0 flex-1">
                    <Input
                      className="h-9 sm:h-8 flex-1 w-full text-xs px-2.5"
                      placeholder="e.g. (f), 25F"
                      value={titleSuffix || ''}
                      onChange={(e) => onTitleSuffixChange(name, e.target.value)}
                      title="Add a tag to your title for this community"
                      aria-label={`Title suffix for r/${name}`}
                    />
                    <button
                      onClick={() => setShowCustomInput(false)}
                      className="text-xs text-muted-foreground hover:text-foreground cursor-pointer p-2"
                      aria-label="Switch to dropdown"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

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
