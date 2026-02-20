import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  CollectBatchSize,
  JobPayload,
  ResearchStep,
  WorkspaceStats,
} from './types';
import {
  STEP_DEFS,
  formatNumber,
  getStepCardStatus,
  stepStatusBadge,
  getStepStat,
} from './helpers';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PipelineTabProps {
  job: JobPayload | null;
  wsStats: WorkspaceStats | null;
  runningStep: ResearchStep | null;
  collectBatchSize: CollectBatchSize;
  setCollectBatchSize: (value: CollectBatchSize) => void;
  handleRunStep: (step: ResearchStep) => Promise<void>;
  handleCancel: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PipelineTab = ({
  job,
  wsStats,
  runningStep,
  collectBatchSize,
  setCollectBatchSize,
  handleRunStep,
  handleCancel,
}: PipelineTabProps) => {
  const pendingSubs = wsStats?.pendingSubreddits ?? 0;
  const scannedSubs = (wsStats?.totalSubreddits ?? 0) - pendingSubs;
  const totalProfiles = wsStats?.totalProfiles ?? 0;
  const totalPosts = wsStats?.totalPosts ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {STEP_DEFS.map((stepDef) => {
        const cardStatus = job
          ? getStepCardStatus(stepDef.key, job.currentStep, job.status)
          : 'ready';
        const badge = stepStatusBadge(cardStatus);
        const stat = job ? getStepStat(stepDef.key, job.stepStats) : '';
        const isRunning = cardStatus === 'running';
        const isDone = cardStatus === 'done';

        const pendingInfo = (() => {
          if (stepDef.key === 'collect_posts') {
            return pendingSubs > 0
              ? `${pendingSubs} pending to scan, ${scannedSubs} already scanned`
              : `${scannedSubs} subreddits scanned, ${formatNumber(totalPosts)} posts`;
          }
          if (stepDef.key === 'profile_users') {
            return totalProfiles > 0
              ? `${formatNumber(totalProfiles)} users profiled globally`
              : 'Profile post authors from collected posts';
          }
          if (stepDef.key === 'score_rank') {
            return wsStats?.totalCandidates
              ? `${wsStats.totalCandidates} candidates scored — re-run anytime`
              : 'Score users by posting patterns';
          }
          return '';
        })();

        return (
          <Card
            key={stepDef.key}
            className={`border-zinc-800 transition-all ${isRunning ? 'ring-1 ring-blue-500/30' : ''}`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StepCircle num={stepDef.num} isDone={isDone} isRunning={isRunning} />
                  <div>
                    <CardTitle className="text-sm font-semibold">{stepDef.label}</CardTitle>
                    <p className="text-xs text-muted-foreground">{pendingInfo || stepDef.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {stat && <span className="text-xs text-muted-foreground">{stat}</span>}
                  <span className={badge.className}>{badge.label}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {isRunning &&
                stepDef.key === 'profile_users' &&
                job?.stepStats &&
                job.stepStats.usersTotal > 0 && (
                  <StackedProgressBar stats={job.stepStats} message={job.message} />
                )}

              {isRunning &&
                (stepDef.key !== 'profile_users' ||
                  !job?.stepStats ||
                  (job.stepStats?.usersTotal ?? 0) === 0) && (
                  <StandardProgressBar percent={job?.progressPercent ?? 0} message={job?.message ?? null} />
                )}

              <div className="flex items-center gap-2">
                {!isRunning && stepDef.key === 'collect_posts' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Batch</span>
                    <Select
                      value={String(collectBatchSize)}
                      onValueChange={(value) => {
                        const parsed = Number(value);
                        if (parsed === 5 || parsed === 10 || parsed === 20 || parsed === 50) {
                          setCollectBatchSize(parsed as CollectBatchSize);
                        }
                      }}
                    >
                      <SelectTrigger
                        className="h-8 w-[120px] text-xs"
                        aria-label="Collect posts batch size"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 subreddits</SelectItem>
                        <SelectItem value="10">10 subreddits</SelectItem>
                        <SelectItem value="20">20 subreddits</SelectItem>
                        <SelectItem value="50">50 subreddits</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {!isRunning && (
                  <Button
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => handleRunStep(stepDef.key)}
                    disabled={runningStep !== null || (wsStats?.totalSubreddits ?? 0) === 0}
                  >
                    {stepDef.key === 'profile_users'
                      ? 'Run Profiling (3 workers)'
                      : stepDef.key === 'score_rank'
                        ? wsStats?.totalCandidates ? 'Re-Score' : 'Run Score & Rank'
                        : cardStatus === 'failed'
                          ? 'Retry Step'
                          : 'Run Step'}
                  </Button>
                )}
                {isRunning && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer border-yellow-600 text-yellow-500 hover:bg-yellow-600/10"
                    onClick={handleCancel}
                  >
                    Stop
                  </Button>
                )}
              </div>

              {stepDef.key === 'score_rank' && isDone && wsStats?.totalCandidates !== undefined && wsStats.totalCandidates > 0 && (
                <p className="text-xs text-emerald-400">
                  {wsStats.totalCandidates} candidate{wsStats.totalCandidates !== 1 ? 's' : ''} found — see Results tab.
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const StepCircle = ({
  num,
  isDone,
  isRunning,
}: {
  num: number;
  isDone: boolean;
  isRunning: boolean;
}) => (
  <div
    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
      isDone
        ? 'bg-emerald-500 text-white'
        : isRunning
          ? 'animate-pulse bg-blue-500 text-white'
          : 'bg-amber-500/80 text-white'
    }`}
    aria-label={`Step ${num}`}
  >
    {isDone ? (
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2.5}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    ) : (
      num
    )}
  </div>
);

const StackedProgressBar = ({
  stats,
  message,
}: {
  stats: NonNullable<JobPayload['stepStats']>;
  message: string | null;
}) => {
  const total = stats.usersTotal;
  const cached = stats.usersSkippedCached ?? 0;
  const fetched = stats.usersProfiled;
  const remaining = total - cached - fetched;
  const cachedPct = Math.round((cached / total) * 100);
  const fetchedPct = Math.round((fetched / total) * 100);

  return (
    <div className="space-y-2">
      <div
        className="relative h-3 w-full overflow-hidden rounded-full bg-zinc-800"
        title={`Total: ${total} unique post authors to profile`}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-l-full bg-emerald-500/70 transition-all duration-500 ease-out"
          style={{ width: `${cachedPct}%` }}
          title={`Cached: ${cached} users already profiled from previous runs (skipped)`}
        />
        <div
          className="absolute inset-y-0 bg-blue-500 transition-all duration-500 ease-out"
          style={{ left: `${cachedPct}%`, width: `${fetchedPct}%` }}
          title={`Fetched: ${fetched} users newly profiled in this run via Reddit API`}
        />
        <div className="absolute inset-0 animate-pulse rounded-full bg-white/5" />
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-3 text-muted-foreground">
          <span
            className="flex cursor-help items-center gap-1"
            title="Users already profiled from previous runs - their Reddit data is reused from cache"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500/70" />
            {formatNumber(cached)} cached
          </span>
          <span
            className="flex cursor-help items-center gap-1"
            title="Users newly fetched from the Reddit API during this profiling run"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
            {formatNumber(fetched)} fetched
          </span>
          <span
            className="flex cursor-help items-center gap-1"
            title="Users still waiting to be profiled"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-zinc-700" />
            {formatNumber(remaining)} remaining
          </span>
        </div>
        <span className="tabular-nums text-muted-foreground">
          {formatNumber(cached + fetched)}/{formatNumber(total)}
        </span>
      </div>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
};

const StandardProgressBar = ({
  percent,
  message,
}: {
  percent: number;
  message: string | null;
}) => (
  <div className="space-y-2">
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-800">
      <div
        className="h-full rounded-full bg-blue-500 transition-all duration-500 ease-out"
        style={{ width: `${Math.min(100, percent)}%` }}
      />
      <div className="absolute inset-0 animate-pulse rounded-full bg-white/5" />
    </div>
    {message && <p className="text-xs text-muted-foreground">{message}</p>}
  </div>
);
