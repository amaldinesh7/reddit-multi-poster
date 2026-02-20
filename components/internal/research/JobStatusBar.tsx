import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { JobPayload, JobPhase, ResearchStep } from './types';
import { formatNumber, statusBadgeClass, StatCard } from './helpers';

interface JobStatusBarProps {
  jobId: string;
  job: JobPayload | null;
  phase: JobPhase;
  isActive: boolean;
  elapsedText: string;
  runningStep: ResearchStep | null;
  handleCancel: () => Promise<void>;
  handleForceRestart: () => Promise<void>;
  handleRunStep: (step: ResearchStep) => Promise<void>;
}

export const JobStatusBar = ({
  jobId,
  job,
  phase,
  isActive,
  elapsedText,
  runningStep,
  handleCancel,
  handleForceRestart,
  handleRunStep,
}: JobStatusBarProps) => (
  <Card className="border-zinc-800">
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-base font-semibold">
          Job
          <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">{jobId.slice(0, 8)}</span>
        </CardTitle>
        <div className="flex items-center gap-3">
          {isActive && elapsedText && (
            <span className="text-xs text-muted-foreground">Elapsed: {elapsedText}</span>
          )}
          <span className={statusBadgeClass(phase)}>
            {job?.status ?? 'loading'}
          </span>
        </div>
      </div>
    </CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">{job?.message ?? 'Waiting for job status...'}</p>

      {job?.error && (
        <div className="rounded-md border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">Error</p>
              <p className="mt-1 text-xs">{job.error}</p>
            </div>
            {phase === 'failed' && (
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer shrink-0 border-red-700 text-red-300 hover:bg-red-600/10"
                onClick={handleForceRestart}
                aria-label="Force restart stalled job"
              >
                Force Restart
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Stats grid */}
      {job?.stepStats && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <StatCard label="Posts" value={formatNumber(job.stepStats.postsCollected)} />
          <StatCard label="Subreddits" value={String(job.stepStats.subredditsScanned)} />
          <StatCard label="Total Users" value={formatNumber(job.stepStats.usersTotal)} />
          <StatCard label="Profiled" value={formatNumber(job.stepStats.usersProfiled)} />
          <StatCard label="Cached" value={formatNumber(job.stepStats.usersSkippedCached)} />
          <StatCard label="Candidates" value={String(job.stepStats.candidatesFound)} />
        </div>
      )}

      {/* Running: stop button */}
      {isActive && (
        <div className="flex justify-end pt-1">
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer border-yellow-600 text-yellow-500 hover:bg-yellow-600/10"
            onClick={handleCancel}
          >
            Stop Current Step
          </Button>
        </div>
      )}

      {/* Not running: quick-action buttons */}
      {!isActive && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            size="sm"
            className="cursor-pointer"
            onClick={() => handleRunStep('collect_posts')}
            disabled={runningStep !== null}
          >
            Run Collect Posts
          </Button>
          <Button
            size="sm"
            className="cursor-pointer"
            onClick={() => handleRunStep('profile_users')}
            disabled={runningStep !== null}
          >
            Run Profiling
          </Button>
          <Button
            size="sm"
            className="cursor-pointer"
            onClick={() => handleRunStep('score_rank')}
            disabled={runningStep !== null}
          >
            Run Score &amp; Rank
          </Button>
        </div>
      )}
    </CardContent>
  </Card>
);
