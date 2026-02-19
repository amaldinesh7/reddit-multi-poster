import type { WorkspaceStats } from './types';
import { formatNumber } from './helpers';

interface WorkspaceStatsBarProps {
  stats: WorkspaceStats | null;
}

const formatTimeAgo = (iso: string | null): string => {
  if (!iso) return 'Never';
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export const WorkspaceStatsBar = ({ stats }: WorkspaceStatsBarProps) => {
  if (!stats) return null;

  const items = [
    {
      label: 'Subreddits',
      value: String(stats.totalSubreddits),
      extra: stats.pendingSubreddits > 0 ? `${stats.pendingSubreddits} pending` : undefined,
      extraClass: 'text-amber-400',
    },
    { label: 'Posts', value: formatNumber(stats.totalPosts) },
    { label: 'Profiles', value: formatNumber(stats.totalProfiles) },
    { label: 'Candidates', value: formatNumber(stats.totalCandidates) },
    { label: 'Last Scan', value: formatTimeAgo(stats.lastScanAt) },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
      {items.map((item, i) => (
        <div key={item.label} className="flex items-center gap-1 text-xs">
          {i > 0 && <span className="mx-1.5 text-zinc-700">|</span>}
          <span className="text-muted-foreground">{item.label}:</span>
          <span className="font-semibold tabular-nums">{item.value}</span>
          {item.extra && <span className={`ml-0.5 ${item.extraClass ?? ''}`}>({item.extra})</span>}
        </div>
      ))}
    </div>
  );
};
