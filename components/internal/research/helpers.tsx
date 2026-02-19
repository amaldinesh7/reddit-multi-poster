import type { ResearchStep, ResearchStepStats, JobPhase, StepCardStatus } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const STEP_DEFS: { key: ResearchStep; label: string; num: number; description: string }[] = [
  { key: 'collect_posts', label: 'Collect Posts', num: 1, description: 'Fetch posts from target subreddits' },
  { key: 'profile_users', label: 'Profile Users', num: 2, description: 'Scan post authors for detailed profile data' },
  { key: 'score_rank', label: 'Score & Rank', num: 3, description: 'Score users by posting patterns and rank candidates' },
];

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

export const formatElapsed = (startIso: string): string => {
  const seconds = Math.floor((Date.now() - new Date(startIso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remaining}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
};

export const formatNumber = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

// ---------------------------------------------------------------------------
// Phase / status helpers
// ---------------------------------------------------------------------------

export const phaseFromStatus = (status: string | undefined): JobPhase => {
  if (!status) return 'idle';
  if (status === 'running' || status === 'queued') return 'running';
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'failed') return 'failed';
  return 'idle';
};

export const statusBadgeClass = (phase: JobPhase): string => {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';
  switch (phase) {
    case 'running':
      return `${base} bg-blue-500/20 text-blue-400`;
    case 'completed':
      return `${base} bg-emerald-500/20 text-emerald-400`;
    case 'failed':
      return `${base} bg-red-500/20 text-red-400`;
    case 'cancelled':
      return `${base} bg-yellow-500/20 text-yellow-400`;
    default:
      return `${base} bg-zinc-700 text-zinc-400`;
  }
};

export const getStepCardStatus = (
  stepKey: ResearchStep,
  currentStep: ResearchStep | null,
  jobStatus: string | undefined
): StepCardStatus => {
  if (jobStatus === 'running' && currentStep === stepKey) return 'running';
  if (jobStatus === 'completed' || currentStep === 'done') return 'done';
  if (jobStatus === 'failed' && currentStep === stepKey) return 'failed';
  return 'ready';
};

export const stepStatusBadge = (status: StepCardStatus): { label: string; className: string } => {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium';
  switch (status) {
    case 'done':
      return { label: 'Done', className: `${base} bg-emerald-500/20 text-emerald-400` };
    case 'running':
      return { label: 'Running', className: `${base} bg-blue-500/20 text-blue-400` };
    case 'failed':
      return { label: 'Failed', className: `${base} bg-red-500/20 text-red-400` };
    default:
      return { label: 'Ready', className: `${base} bg-amber-500/20 text-amber-400` };
  }
};

export const getStepStat = (stepKey: ResearchStep, stats: ResearchStepStats | null): string => {
  if (!stats) return '';
  switch (stepKey) {
    case 'collect_posts':
      return stats.subredditsScanned > 0
        ? `${stats.subredditsScanned} subs, ${formatNumber(stats.postsCollected)} posts`
        : '';
    case 'profile_users': {
      const profiled = stats.usersProfiled + (stats.usersSkippedCached ?? 0);
      return stats.usersTotal > 0
        ? `${profiled}/${formatNumber(stats.usersTotal)} users`
        : '';
    }
    case 'score_rank':
      return stats.candidatesFound > 0
        ? `${stats.candidatesFound} candidate${stats.candidatesFound !== 1 ? 's' : ''}`
        : '';
    default:
      return '';
  }
};

// ---------------------------------------------------------------------------
// StatCard presentational component
// ---------------------------------------------------------------------------

export const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-center">
    <p className="text-lg font-bold tabular-nums">{value}</p>
    <p className="text-[11px] text-muted-foreground">{label}</p>
  </div>
);
