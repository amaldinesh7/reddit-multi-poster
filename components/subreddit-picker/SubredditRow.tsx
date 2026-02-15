import React, { useState, useMemo, useEffect } from 'react';
import { SubredditRowProps, SubredditRules } from './subredditRow.types';
import SubredditRowMain from './SubredditRowMain';
import SubredditRowActions from './SubredditRowActions';
import SubredditRowControls from './SubredditRowControls';
import SubredditRowExpandedDetails from './SubredditRowExpandedDetails';

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
  onRequestUpgrade,
  eligibility,
  userData,
  postKind = 'self',
  rowRef,
  isHighlighted,
}: SubredditRowProps) => {
  const checkboxId = `checkbox-${name}`;
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [openValidationDetailsSignal, setOpenValidationDetailsSignal] = useState(0);

  const suffixOptions = useMemo(() => {
    const options: string[] = [];
    if (postRequirements?.title_required_strings) {
      options.push(...postRequirements.title_required_strings);
    }
    return options;
  }, [postRequirements]);

  const isCustomSuffix = useMemo(() => {
    if (!titleSuffix) return false;
    return suffixOptions.length > 0 && !suffixOptions.includes(titleSuffix);
  }, [titleSuffix, suffixOptions]);

  useEffect(() => {
    if (isCustomSuffix) {
      setShowCustomInput(true);
    }
  }, [isCustomSuffix]);

  const hasGuidelines = !!(postRequirements?.guidelines_text && postRequirements.guidelines_text.trim().length > 0);
  const hasBlacklist = (postRequirements?.title_blacklisted_strings?.length ?? 0) > 0;
  const hasRequiredStrings = (postRequirements?.title_required_strings?.length ?? 0) > 0;

  const validationErrors = useMemo(
    () => validationIssues?.filter((i) => i.severity === 'error') || [],
    [validationIssues],
  );
  const validationWarnings = useMemo(
    () => validationIssues?.filter((i) => i.severity === 'warning') || [],
    [validationIssues],
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

  const handleControlsClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  const handleSuffixSelectChange = (value: string) => {
    if (value === '__custom__') {
      setShowCustomInput(true);
      if (!isCustomSuffix) {
        onTitleSuffixChange(name, '');
      }
    } else if (value === '' || value === '__none__') {
      // Clear selection (empty = placeholder selected)
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

  const canExpand = isSelected && (hasGuidelines || hasBlacklist || !!subredditRules?.submitText);
  useEffect(() => {
    if (!isHighlighted) return;
    // Reveal details automatically when this row becomes the navigation target.
    setOpenValidationDetailsSignal((prev) => prev + 1);
  }, [isHighlighted]);

  return (
    <div
      ref={rowRef}
      tabIndex={-1}
      className={`rounded-lg border border-border/60 bg-card/50 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-1 focus-visible:ring-offset-background transition-[border-color,box-shadow] duration-200 ${
        isHighlighted ? 'issue-row-highlight' : ''
      }`}
      data-subreddit-row={name}
    >
      <div className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-2.5 transition-all duration-75 gap-2">
        <SubredditRowMain
          name={name}
          hasError={hasError}
          isSelected={isSelected}
          isLoading={isLoading}
          checkboxId={checkboxId}
          contentOverride={contentOverride}
          onToggle={onToggle}
        />

        <SubredditRowActions
          name={name}
          isSelected={isSelected}
          isLoading={isLoading}
          failedPost={failedPost}
          validationIssues={validationIssues}
          validationErrors={validationErrors}
          validationWarnings={validationWarnings}
          validationSummary={validationSummary}
          canExpand={canExpand}
          isExpanded={isExpanded}
          customizationEnabled={customizationEnabled}
          contentOverride={contentOverride}
          onCustomize={onCustomize}
          onRequestUpgrade={onRequestUpgrade}
          onRetryPost={onRetryPost}
          onEditPost={onEditPost}
          onRemovePost={onRemovePost}
          onExpandClick={handleExpandClick}
          onControlsClick={handleControlsClick}
          openValidationDetailsSignal={openValidationDetailsSignal}
        />
      </div>

      <SubredditRowControls
        name={name}
        isSelected={isSelected}
        flairRequired={flairRequired}
        flairOptions={flairOptions}
        flairValue={flairValue}
        titleSuffix={titleSuffix}
        hasRequiredStrings={hasRequiredStrings}
        suffixOptions={suffixOptions}
        showCustomInput={showCustomInput}
        isCustomSuffix={isCustomSuffix}
        onFlairChange={onFlairChange}
        onTitleSuffixChange={onTitleSuffixChange}
        onSuffixSelectChange={handleSuffixSelectChange}
        onShowCustomInputChange={setShowCustomInput}
        onControlsClick={handleControlsClick}
      />

      <SubredditRowExpandedDetails
        isExpanded={isExpanded}
        isSelected={isSelected}
        postRequirements={postRequirements}
        subredditRules={subredditRules}
      />
    </div>
  );
});

SubredditRow.displayName = 'SubredditRow';

export type { SubredditRowProps, SubredditRules };
export default SubredditRow;
