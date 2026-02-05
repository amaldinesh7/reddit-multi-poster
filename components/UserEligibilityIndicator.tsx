/**
 * UserEligibilityIndicator Component
 * 
 * Displays user stats and eligibility status in a compact card format.
 * Shows karma, account age, verification status, and potential warnings.
 */

import { RedditUser } from '../utils/reddit';
import { Tooltip } from './ui/tooltip';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Shield, 
  Clock, 
  Star,
  Mail,
  TrendingUp,
} from 'lucide-react';

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
 * Formats karma number with abbreviation
 */
const formatKarma = (karma: number): string => {
  if (karma >= 1000000) return `${(karma / 1000000).toFixed(1)}M`;
  if (karma >= 1000) return `${(karma / 1000).toFixed(1)}K`;
  return karma.toString();
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
    <div className="flex items-center gap-1.5 cursor-help">
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
        <div className={`w-2 h-2 rounded-full ${orbColors[overallStatus]} cursor-help`} />
      </Tooltip>
    );
  };

  // Compact version - just shows status orb and karma
  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <StatusOrb />
        <span className="text-xs text-muted-foreground font-mono-admin">
          {formatKarma(totalKarma)} karma
        </span>
      </div>
    );
  }

  // Full version
  return (
    <div className={`flex items-center gap-4 px-3 py-2 rounded-lg bg-card/50 border border-border/50 ${className}`}>
      {/* Status Orb */}
      <StatusOrb />
      
      {/* Stats Row */}
      <div className="flex items-center gap-4 flex-wrap">
        <StatItem
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          label="Karma"
          value={formatKarma(totalKarma)}
          status={karmaStatus}
          tooltip={
            karmaStatus !== 'good'
              ? `Low karma (${totalKarma}) - some subreddits require higher karma to post`
              : `Total karma: ${totalKarma.toLocaleString()}`
          }
        />
        
        <StatItem
          icon={<Clock className="w-3.5 h-3.5" />}
          label="Account"
          value={accountAge.label}
          status={ageStatus}
          tooltip={
            ageStatus !== 'good'
              ? `New account (${accountAge.days} days) - some subreddits require older accounts`
              : `Account age: ${accountAge.days} days`
          }
        />
        
        <StatItem
          icon={<Mail className="w-3.5 h-3.5" />}
          label="Email"
          value={emailVerified ? 'Verified' : 'Not verified'}
          status={emailStatus}
          tooltip={
            !emailVerified
              ? 'Some subreddits require email verification to post'
              : 'Email verified - good standing'
          }
        />
        
        {user.is_gold && (
          <StatItem
            icon={<Star className="w-3.5 h-3.5 text-amber-400" />}
            label=""
            value="Premium"
            status="good"
            tooltip="Reddit Premium member"
          />
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Badge Component for SubredditRow
// ============================================================================

interface EligibilityBadgeProps {
  status: 'ready' | 'warning' | 'blocked' | 'approved' | 'moderator';
  reason?: string;
  compact?: boolean;
}

export const EligibilityBadge = ({ status, reason, compact = false }: EligibilityBadgeProps) => {
  const config = {
    ready: {
      icon: <CheckCircle2 className="w-3 h-3" />,
      label: 'Ready',
      className: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    },
    warning: {
      icon: <AlertTriangle className="w-3 h-3" />,
      label: 'Warning',
      className: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    },
    blocked: {
      icon: <XCircle className="w-3 h-3" />,
      label: 'Blocked',
      className: 'text-red-500 bg-red-500/10 border-red-500/20',
    },
    approved: {
      icon: <CheckCircle2 className="w-3 h-3" />,
      label: 'Approved',
      className: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    },
    moderator: {
      icon: <Shield className="w-3 h-3" />,
      label: 'Moderator',
      className: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
    },
  };

  const { icon, label, className } = config[status];

  const badge = (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border ${className} cursor-help`}
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
