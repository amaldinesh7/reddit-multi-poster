/**
 * UserEligibilityIndicator Component
 * 
 * Displays user stats and eligibility status in a compact card format.
 * Shows karma, account age, verification status, and potential warnings.
 */

import { RedditUser } from '../utils/reddit';
import { Tooltip } from './ui/tooltip';
import { Crown, CircleWavyCheck, LockKey, TrendDown, HourglassLow } from 'phosphor-react';

// ============================================================================
// Types
// ============================================================================

interface UserEligibilityIndicatorProps {
  user: RedditUser | null;
  className?: string;
  compact?: boolean;
}

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  status?: 'good' | 'warning' | 'error';
  tooltip?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculates account age from created_utc timestamp
 */
const getAccountAge = (createdUtc?: number): { days: number; label: string } => {
  if (!createdUtc) return { days: 0, label: 'Unknown' };
  
  const now = Date.now() / 1000;
  const ageSeconds = now - createdUtc;
  const days = Math.floor(ageSeconds / (60 * 60 * 24));
  
  if (days < 1) return { days, label: 'Today' };
  if (days === 1) return { days, label: '1 day' };
  if (days < 30) return { days, label: `${days} days` };
  if (days < 365) {
    const months = Math.floor(days / 30);
    return { days, label: `${months} month${months !== 1 ? 's' : ''}` };
  }
  const years = Math.floor(days / 365);
  return { days, label: `${years} year${years !== 1 ? 's' : ''}` };
};

/**
 * Determines the overall eligibility status based on user data
 */
const getOverallStatus = (user: RedditUser): 'good' | 'warning' | 'error' => {
  const karma = user.total_karma ?? 0;
  const accountAge = user.created_utc ? getAccountAge(user.created_utc).days : 0;
  const emailVerified = user.has_verified_email ?? false;
  
  // Check for potential issues
  const issues: string[] = [];
  
  if (karma < 10) issues.push('very low karma');
  else if (karma < 100) issues.push('low karma');
  
  if (accountAge < 3) issues.push('very new account');
  else if (accountAge < 7) issues.push('new account');
  
  if (!emailVerified) issues.push('email not verified');
  
  if (issues.length >= 2 || karma < 10 || accountAge < 3) return 'error';
  if (issues.length >= 1) return 'warning';
  return 'good';
};

// ============================================================================
// Subcomponents
// ============================================================================

const StatItem = ({ icon, label, value, status = 'good', tooltip }: StatItemProps) => {
  const statusColors = {
    good: 'text-emerald-500',
    warning: 'text-amber-500',
    error: 'text-red-500',
  };

  const content = (
    <div className="flex items-center gap-1.5 cursor-default">
      <span className={statusColors[status]}>{icon}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip content={<p className="text-xs">{tooltip}</p>} side="bottom">
        {content}
      </Tooltip>
    );
  }

  return content;
};

// ============================================================================
// Main Component
// ============================================================================

export const UserEligibilityIndicator = ({
  user,
  className = '',
  compact = false,
}: UserEligibilityIndicatorProps) => {
  if (!user) {
    return null;
  }

  const accountAge = getAccountAge(user.created_utc);
  const totalKarma = user.total_karma ?? 0;
  const emailVerified = user.has_verified_email ?? false;
  const overallStatus = getOverallStatus(user);

  // Determine status for each metric
  const karmaStatus: 'good' | 'warning' | 'error' = 
    totalKarma < 10 ? 'error' : totalKarma < 100 ? 'warning' : 'good';
  
  const ageStatus: 'good' | 'warning' | 'error' = 
    accountAge.days < 3 ? 'error' : accountAge.days < 7 ? 'warning' : 'good';
  
  const emailStatus: 'good' | 'warning' | 'error' = 
    emailVerified ? 'good' : 'warning';

  // Status indicator orb
  const StatusOrb = () => {
    const orbColors = {
      good: 'bg-emerald-500 animate-eligibility-pulse',
      warning: 'bg-amber-500 animate-eligibility-pulse-warning',
      error: 'bg-red-500 animate-eligibility-pulse-blocked',
    };
    
    const statusLabels = {
      good: 'Ready to post',
      warning: 'Some restrictions may apply',
      error: 'Posting may be restricted',
    };

    return (
      <Tooltip content={<p className="text-xs font-medium">{statusLabels[overallStatus]}</p>} side="bottom">
        <div className={`w-2 h-2 rounded-full ${orbColors[overallStatus]} cursor-default`} />
      </Tooltip>
    );
  };

  // Compact version - just shows status orb and karma
  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <StatusOrb />
        <span className="text-xs text-muted-foreground font-mono-admin">
          {totalKarma.toLocaleString()} karma
        </span>
      </div>
    );
  }

  // Full version - simplified single line
  const statusTooltip = overallStatus === 'good' 
    ? 'Ready to post' 
    : overallStatus === 'warning'
      ? 'Some restrictions may apply'
      : 'Posting may be restricted';

  return (
    <Tooltip 
      content={
        <div className="text-xs space-y-1">
          <p className="font-medium">{statusTooltip}</p>
          <p>Karma: {totalKarma.toLocaleString()}</p>
          <p>Account: {accountAge.label} old</p>
          <p>Email: {emailVerified ? 'Verified' : 'Not verified'}</p>
        </div>
      } 
      side="bottom"
    >
      <div className={`flex items-center gap-2 cursor-default ${className}`}>
        <StatusOrb />
        <span className="text-xs text-muted-foreground">
          {totalKarma.toLocaleString()} karma
        </span>
        <span className="text-xs text-muted-foreground/50">·</span>
        <span className="text-xs text-muted-foreground">
          {accountAge.label}
        </span>
        {!emailVerified && (
          <>
            <span className="text-xs text-muted-foreground/50">·</span>
            <span className="text-xs text-amber-500">Unverified</span>
          </>
        )}
      </div>
    </Tooltip>
  );
};

// ============================================================================
// Badge Component for SubredditRow
// ============================================================================

interface EligibilityBadgeProps {
  status: 'moderator' | 'verified' | 'needs_verification' | 'low_karma' | 'new_account';
  reason?: string;
  compact?: boolean;
}

export const EligibilityBadge = ({ status, reason, compact = false }: EligibilityBadgeProps) => {
  const config = {
    moderator: {
      icon: <Crown className="w-4 h-4" />,
      label: 'Moderator',
      className: 'text-violet-500',
    },
    verified: {
      icon: <CircleWavyCheck className="w-4 h-4" />,
      label: 'Verified',
      className: 'text-emerald-500',
    },
    needs_verification: {
      icon: <LockKey className="w-4 h-4" />,
      label: 'Needs verification',
      className: 'text-amber-500',
    },
    low_karma: {
      icon: <TrendDown className="w-4 h-4" />,
      label: 'Low karma',
      className: 'text-amber-500',
    },
    new_account: {
      icon: <HourglassLow className="w-4 h-4" />,
      label: 'New account',
      className: 'text-amber-500',
    },
  };

  const { icon, label, className } = config[status];

  const badge = (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] ${className} cursor-default`}
    >
      {icon}
      {!compact && <span>{label}</span>}
    </span>
  );

  if (reason) {
    return (
      <Tooltip content={<p className="text-xs">{reason}</p>} side="top">
        {badge}
      </Tooltip>
    );
  }

  return badge;
};

export default UserEligibilityIndicator;
