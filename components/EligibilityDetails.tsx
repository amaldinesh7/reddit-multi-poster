/**
 * EligibilityDetails Component
 * 
 * Displays detailed eligibility information comparing user stats against
 * parsed subreddit requirements. Shown in an expandable panel within SubredditRow.
 */

import { 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle,
  TrendingUp,
  Clock,
  Mail,
  MessageSquare,
  FileText,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { Tooltip } from './ui/tooltip';
import { useState } from 'react';
import { ParsedRequirements, UserRequirementComparison } from '@/lib/parseSubredditRequirements';

// ============================================================================
// Types
// ============================================================================

interface EligibilityDetailsProps {
  /** User's current stats */
  userStats: {
    totalKarma: number;
    commentKarma: number;
    linkKarma: number;
    accountAgeDays: number;
    hasVerifiedEmail: boolean;
  };
  /** Parsed requirements from subreddit */
  parsedRequirements: ParsedRequirements | null;
  /** Comparison results */
  comparison: UserRequirementComparison | null;
  /** Whether to start expanded */
  defaultExpanded?: boolean;
  /** Additional CSS classes */
  className?: string;
}

interface RequirementRowProps {
  icon: React.ReactNode;
  label: string;
  userValue: string | number;
  requiredValue: string | number | null;
  status: 'ok' | 'low' | 'unknown' | 'missing';
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatAccountAge = (days: number): string => {
  if (days < 1) return 'Today';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} month${months !== 1 ? 's' : ''}`;
  }
  const years = Math.floor(days / 365);
  return `${years} year${years !== 1 ? 's' : ''}`;
};

const getStatusIcon = (status: 'ok' | 'low' | 'unknown' | 'missing') => {
  switch (status) {
    case 'ok':
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
    case 'low':
    case 'missing':
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
    case 'unknown':
    default:
      return <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />;
  }
};

const getStatusColor = (status: 'ok' | 'low' | 'unknown' | 'missing'): string => {
  switch (status) {
    case 'ok':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'low':
    case 'missing':
      return 'text-amber-600 dark:text-amber-400';
    case 'unknown':
    default:
      return 'text-zinc-500';
  }
};

// ============================================================================
// Subcomponents
// ============================================================================

const RequirementRow = ({ icon, label, userValue, requiredValue, status }: RequirementRowProps) => {
  const hasRequirement = requiredValue !== null;
  
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-zinc-400">{icon}</span>
        <span className="text-xs text-zinc-600 dark:text-zinc-400">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium ${hasRequirement ? getStatusColor(status) : 'text-zinc-500'}`}>
          {userValue}
        </span>
        {hasRequirement && (
          <>
            <span className="text-xs text-zinc-400">/</span>
            <span className="text-xs text-zinc-500">
              {requiredValue}+
            </span>
          </>
        )}
        {getStatusIcon(status)}
      </div>
    </div>
  );
};

const ConfidenceBadge = ({ confidence }: { confidence: 'high' | 'medium' | 'low' }) => {
  const config = {
    high: {
      label: 'High confidence',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    },
    medium: {
      label: 'Medium confidence',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    },
    low: {
      label: 'Low confidence',
      className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
    },
  };

  const { label, className } = config[confidence];

  return (
    <Tooltip content={<p className="text-xs">Requirements parsed from subreddit rules - accuracy may vary</p>}>
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded ${className} cursor-help`}>
        <Info className="w-2.5 h-2.5" />
        {label}
      </span>
    </Tooltip>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const EligibilityDetails = ({
  userStats,
  parsedRequirements,
  comparison,
  defaultExpanded = false,
  className = '',
}: EligibilityDetailsProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // If no requirements were parsed, show minimal info
  const hasRequirements = parsedRequirements && (
    parsedRequirements.minKarma !== null ||
    parsedRequirements.minCommentKarma !== null ||
    parsedRequirements.minLinkKarma !== null ||
    parsedRequirements.minAccountAgeDays !== null ||
    parsedRequirements.requiresVerifiedEmail
  );

  // Determine if there are any warnings
  const hasWarnings = comparison && comparison.warnings.length > 0;

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={`${className}`}>
      {/* Header / Toggle */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between py-2 px-3 rounded-md bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? 'Collapse eligibility details' : 'Expand eligibility details'}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        <div className="flex items-center gap-2">
          {hasWarnings ? (
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          )}
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Eligibility Check
          </span>
          {hasWarnings && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {comparison.warnings.length} warning{comparison.warnings.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-zinc-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-2 px-3 pb-3">
          {/* Requirements comparison */}
          <div className="space-y-0.5">
            {/* Total Karma */}
            <RequirementRow
              icon={<TrendingUp className="w-3.5 h-3.5" />}
              label="Total Karma"
              userValue={userStats.totalKarma.toLocaleString()}
              requiredValue={parsedRequirements?.minKarma ?? null}
              status={comparison?.karmaStatus ?? 'unknown'}
            />

            {/* Comment Karma - only show if requirement exists */}
            {parsedRequirements?.minCommentKarma !== null && (
              <RequirementRow
                icon={<MessageSquare className="w-3.5 h-3.5" />}
                label="Comment Karma"
                userValue={userStats.commentKarma.toLocaleString()}
                requiredValue={parsedRequirements?.minCommentKarma ?? null}
                status={comparison?.commentKarmaStatus ?? 'unknown'}
              />
            )}

            {/* Link Karma - only show if requirement exists */}
            {parsedRequirements?.minLinkKarma !== null && (
              <RequirementRow
                icon={<FileText className="w-3.5 h-3.5" />}
                label="Post Karma"
                userValue={userStats.linkKarma.toLocaleString()}
                requiredValue={parsedRequirements?.minLinkKarma ?? null}
                status={comparison?.linkKarmaStatus ?? 'unknown'}
              />
            )}

            {/* Account Age */}
            <RequirementRow
              icon={<Clock className="w-3.5 h-3.5" />}
              label="Account Age"
              userValue={formatAccountAge(userStats.accountAgeDays)}
              requiredValue={parsedRequirements?.minAccountAgeDays ? `${parsedRequirements.minAccountAgeDays} days` : null}
              status={comparison?.ageStatus ?? 'unknown'}
            />

            {/* Email Verification */}
            <RequirementRow
              icon={<Mail className="w-3.5 h-3.5" />}
              label="Email"
              userValue={userStats.hasVerifiedEmail ? 'Verified' : 'Not verified'}
              requiredValue={parsedRequirements?.requiresVerifiedEmail ? 'Required' : null}
              status={
                parsedRequirements?.requiresVerifiedEmail
                  ? userStats.hasVerifiedEmail ? 'ok' : 'missing'
                  : 'unknown'
              }
            />
          </div>

          {/* Warnings list */}
          {hasWarnings && (
            <div className="mt-3 p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400 mb-1">
                Potential issues:
              </p>
              <ul className="space-y-1">
                {comparison.warnings.map((warning, index) => (
                  <li key={index} className="text-[11px] text-amber-600 dark:text-amber-300 flex items-start gap-1.5">
                    <span className="text-amber-400 mt-0.5">•</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Raw excerpt from rules */}
          {parsedRequirements?.rawExcerpt && (
            <div className="mt-3 p-2 rounded-md bg-zinc-100 dark:bg-zinc-800/50">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                  From subreddit rules:
                </p>
                {parsedRequirements.confidence && (
                  <ConfidenceBadge confidence={parsedRequirements.confidence} />
                )}
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-300 italic leading-relaxed">
                &quot;{parsedRequirements.rawExcerpt}&quot;
              </p>
            </div>
          )}

          {/* No requirements found message */}
          {!hasRequirements && (
            <div className="mt-2 p-2 rounded-md bg-zinc-100 dark:bg-zinc-800/50">
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Info className="w-3 h-3" />
                No specific requirements found in subreddit rules. General restrictions may still apply.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EligibilityDetails;
