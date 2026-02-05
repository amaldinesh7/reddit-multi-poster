/**
 * ValidationWarnings Component
 * 
 * Displays pre-flight validation warnings and errors before posting.
 * Groups issues by severity and provides actionable suggestions.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
  X,
  Tag,
  FileText,
  Link as LinkIcon,
  Type,
} from 'lucide-react';
import { ValidationIssue, PreflightResult } from '@/lib/preflightValidation';

// ============================================================================
// Types
// ============================================================================

interface ValidationWarningsProps {
  result: PreflightResult;
  onDismiss?: () => void;
  /** Only show errors, not warnings */
  errorsOnly?: boolean;
  /** Compact mode for inline display */
  compact?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

const getFieldIcon = (field: ValidationIssue['field'], className: string = 'h-4 w-4') => {
  switch (field) {
    case 'title':
      return <Type className={className} />;
    case 'body':
      return <FileText className={className} />;
    case 'flair':
      return <Tag className={className} />;
    case 'url':
      return <LinkIcon className={className} />;
    default:
      return <AlertCircle className={className} />;
  }
};

const getSeverityStyles = (severity: ValidationIssue['severity']) => {
  switch (severity) {
    case 'error':
      return {
        container: 'bg-red-600/10 border-red-600/30 text-red-400',
        icon: 'text-red-500',
        badge: 'bg-red-600/20 text-red-400',
      };
    case 'warning':
      return {
        container: 'bg-yellow-600/10 border-yellow-600/30 text-yellow-400',
        icon: 'text-yellow-500',
        badge: 'bg-yellow-600/20 text-yellow-400',
      };
    case 'info':
      return {
        container: 'bg-blue-600/10 border-blue-600/30 text-blue-400',
        icon: 'text-blue-500',
        badge: 'bg-blue-600/20 text-blue-400',
      };
  }
};

const getSeverityIcon = (severity: ValidationIssue['severity'], className: string = 'h-4 w-4') => {
  switch (severity) {
    case 'error':
      return <AlertCircle className={`${className} text-red-500`} />;
    case 'warning':
      return <AlertTriangle className={`${className} text-yellow-500`} />;
    case 'info':
      return <Info className={`${className} text-blue-500`} />;
  }
};

// ============================================================================
// Sub-Components
// ============================================================================

interface IssueRowProps {
  issue: ValidationIssue;
  compact?: boolean;
}

const IssueRow: React.FC<IssueRowProps> = ({ issue, compact }) => {
  const styles = getSeverityStyles(issue.severity);

  if (compact) {
    return (
      <Tooltip
        content={
          <div className="max-w-xs">
            <p>{issue.message}</p>
            {issue.suggestion && (
              <p className="mt-1 text-xs opacity-75">{issue.suggestion}</p>
            )}
          </div>
        }
        side="top"
      >
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${styles.badge}`}>
          {getSeverityIcon(issue.severity, 'h-3 w-3')}
          {issue.subreddit && <span>r/{issue.subreddit}</span>}
          {issue.field && getFieldIcon(issue.field, 'h-3 w-3')}
        </div>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex-shrink-0 mt-0.5">
        {getSeverityIcon(issue.severity)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {issue.subreddit && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-zinc-700/50">
              r/{issue.subreddit}
            </span>
          )}
          {issue.field && (
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              {getFieldIcon(issue.field, 'h-3 w-3')}
              {issue.field}
            </span>
          )}
        </div>
        <p className="text-sm mt-0.5">{issue.message}</p>
        {issue.suggestion && (
          <p className="text-xs text-zinc-400 mt-1">{issue.suggestion}</p>
        )}
      </div>
    </div>
  );
};

interface IssueSectionProps {
  title: string;
  issues: ValidationIssue[];
  severity: ValidationIssue['severity'];
  defaultExpanded?: boolean;
  compact?: boolean;
}

const IssueSection: React.FC<IssueSectionProps> = ({
  title,
  issues,
  severity,
  defaultExpanded = true,
  compact,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const styles = getSeverityStyles(severity);

  if (issues.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {issues.map((issue, idx) => (
          <IssueRow key={`${issue.code}-${issue.subreddit || ''}-${idx}`} issue={issue} compact />
        ))}
      </div>
    );
  }

  return (
    <div className={`rounded-md border p-3 ${styles.container}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left cursor-pointer"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          {getSeverityIcon(severity)}
          <span className="font-medium text-sm">{title}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${styles.badge}`}>
            {issues.length}
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>
      
      {isExpanded && (
        <div className="mt-2 divide-y divide-current/10">
          {issues.map((issue, idx) => (
            <IssueRow 
              key={`${issue.code}-${issue.subreddit || ''}-${idx}`} 
              issue={issue} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const ValidationWarnings: React.FC<ValidationWarningsProps> = ({
  result,
  onDismiss,
  errorsOnly = false,
  compact = false,
}) => {
  const errors = result.issues.filter(i => i.severity === 'error');
  const warnings = result.issues.filter(i => i.severity === 'warning');
  const info = result.issues.filter(i => i.severity === 'info');

  const hasContent = errors.length > 0 || (!errorsOnly && (warnings.length > 0 || info.length > 0));

  if (!hasContent) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {errors.length > 0 && (
          <div className="flex items-center gap-1">
            {errors.slice(0, 3).map((issue, idx) => (
              <IssueRow 
                key={`${issue.code}-${issue.subreddit || ''}-${idx}`} 
                issue={issue} 
                compact 
              />
            ))}
            {errors.length > 3 && (
              <span className="text-xs text-red-400">+{errors.length - 3} more</span>
            )}
          </div>
        )}
        {!errorsOnly && warnings.length > 0 && (
          <div className="flex items-center gap-1">
            {warnings.slice(0, 2).map((issue, idx) => (
              <IssueRow 
                key={`${issue.code}-${issue.subreddit || ''}-${idx}`} 
                issue={issue} 
                compact 
              />
            ))}
            {warnings.length > 2 && (
              <span className="text-xs text-yellow-400">+{warnings.length - 2}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-medium">
            {result.canProceed ? 'Warnings before posting' : 'Please fix before posting'}
          </span>
        </div>
        {onDismiss && result.canProceed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-6 px-2 cursor-pointer"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Issue Sections */}
      <div className="space-y-2">
        <IssueSection
          title="Errors - must fix"
          issues={errors}
          severity="error"
          defaultExpanded={true}
        />
        
        {!errorsOnly && (
          <>
            <IssueSection
              title="Warnings"
              issues={warnings}
              severity="warning"
              defaultExpanded={errors.length === 0}
            />
            
            <IssueSection
              title="Info"
              issues={info}
              severity="info"
              defaultExpanded={false}
            />
          </>
        )}
      </div>

      {/* Summary */}
      {!result.canProceed && (
        <p className="text-xs text-zinc-400">
          Fix the errors above to enable posting
        </p>
      )}
    </div>
  );
};

export default ValidationWarnings;
