import { redditClient } from '@/utils/reddit';
import {
  listJobAuthors,
  listAttemptedUsers,
  listGlobalAttemptedUsers,
  listProfiledUsersWithSubmissions,
  upsertPatternAndNote,
  upsertUserProfile,
  updateResearchJob,
  getResearchJob,
  getJobStepStats,
  copyPostsFromPreviousJobs,
  copyProfilesFromPreviousJobs,
  copyMissingProfiles,
} from './db';
import { collectSubredditPosts, collectUserPosts, type ProfileFetchResult } from './collector';
import { buildCandidateFromPosts } from './patterns';
import type { ResearchJobConfig } from './types';
import { RedditRateLimiter } from './rateLimiter';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isCancelled = (jobId: string): boolean => {
  const job = getResearchJob(jobId);
  return job?.cancelRequested === 1;
};

const handleStepCancel = (jobId: string): void => {
  updateResearchJob(jobId, {
    status: 'cancelled',
    message: 'Cancelled — progress saved, can be resumed',
    finishedAt: new Date().toISOString(),
    stepStats: getJobStepStats(jobId),
  });
};

// ---------------------------------------------------------------------------
// Step 1: Collect Posts (independent, manually triggered)
// ---------------------------------------------------------------------------

export const runStepCollectPosts = async (
  jobId: string,
  token: string,
  config: ResearchJobConfig
): Promise<void> => {
  const limiter = new RedditRateLimiter(redditClient(token));

  updateResearchJob(jobId, {
    status: 'running',
    currentStep: 'collect_posts',
    progressPercent: 1,
    startedAt: getResearchJob(jobId)?.startedAt ?? new Date().toISOString(),
    message: 'Step 1: Copying cached posts from previous jobs…',
    error: null,
    stepStats: getJobStepStats(jobId),
  });

  try {
    const copiedPosts = copyPostsFromPreviousJobs(jobId, config.subreddits);

    updateResearchJob(jobId, {
      progressPercent: 5,
      message: `Step 1: Copied ${copiedPosts} cached post(s). Fetching new posts…`,
      stepStats: getJobStepStats(jobId),
    });

    await collectSubredditPosts(jobId, limiter, config, (progress, message) => {
      // Collector reports 0-100, scale to 5-100 (first 5% is cache copy)
      const scaledProgress = 5 + Math.round(progress * 0.95);
      updateResearchJob(jobId, {
        progressPercent: Math.min(99, scaledProgress),
        message: `Step 1: ${message}`,
        stepStats: getJobStepStats(jobId),
      });
    });

    if (isCancelled(jobId)) {
      handleStepCancel(jobId);
      return;
    }

    const stats = getJobStepStats(jobId);
    updateResearchJob(jobId, {
      status: 'queued',
      currentStep: 'profile_users',
      progressPercent: 100,
      message: `Step 1 complete — ${stats.postsCollected} posts from ${stats.subredditsScanned} subreddits (${copiedPosts} from cache)`,
      stepStats: stats,
    });
  } catch (error) {
    updateResearchJob(jobId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error in Step 1',
      message: 'Step 1 failed — can be retried',
      stepStats: getJobStepStats(jobId),
    });
  }
};

// ---------------------------------------------------------------------------
// Step 2: Profile Users — parallel worker pool, processes ALL pending users
// ---------------------------------------------------------------------------

const DEFAULT_CONCURRENCY = 3;
const PROGRESS_UPDATE_INTERVAL = 5;

export const runStepProfileUsers = async (
  jobId: string,
  token: string,
  config: ResearchJobConfig,
  concurrency: number = DEFAULT_CONCURRENCY
): Promise<void> => {
  const limiter = new RedditRateLimiter(redditClient(token));
  const workerCount = Math.max(1, Math.min(concurrency, 5));

  updateResearchJob(jobId, {
    status: 'running',
    currentStep: 'profile_users',
    progressPercent: 1,
    message: `Step 2: Copying cached profiles from previous jobs… (${workerCount} workers)`,
    error: null,
    stepStats: getJobStepStats(jobId),
  });

  try {
    const allAuthors = listJobAuthors(jobId).slice(0, config.maxUsersToAnalyze);
    const totalAuthors = allAuthors.length;
    const copiedProfiles = copyProfilesFromPreviousJobs(jobId, allAuthors);

    // Global dedup: check ALL jobs, not just the current one.
    // This prevents re-profiling users from previous phased scans even if
    // copyProfilesFromPreviousJobs didn't bring them into this job.
    const globalAttempted = listGlobalAttemptedUsers();
    const jobAttempted = listAttemptedUsers(jobId);

    // Users that exist globally but not in this job — copy them in now
    const missingInJob = allAuthors.filter((u) => globalAttempted.has(u) && !jobAttempted.has(u));
    const backfilled = missingInJob.length > 0 ? copyMissingProfiles(jobId, missingInJob) : 0;

    // Merge both sets for the final skip list
    const combinedAttempted = new Set([...jobAttempted, ...globalAttempted]);
    const allPending = allAuthors.filter((u) => !combinedAttempted.has(u));
    const skippedCached = totalAuthors - allPending.length;

    updateResearchJob(jobId, {
      progressPercent: 3,
      message: `Step 2: ${copiedProfiles} copied + ${backfilled} backfilled | ${skippedCached} cached, ${allPending.length} remaining of ${totalAuthors} total | ${workerCount} workers`,
      stepStats: { ...getJobStepStats(jobId), usersSkippedCached: skippedCached },
    });

    if (allPending.length === 0) {
      const stats = getJobStepStats(jobId);
      updateResearchJob(jobId, {
        status: 'queued',
        currentStep: 'profile_users',
        progressPercent: 100,
        message: `Step 2 complete — all ${totalAuthors} user(s) profiled (${skippedCached} from cache)`,
        stepStats: { ...stats, usersSkippedCached: skippedCached },
      });
      return;
    }

    // Shared state — safe because Node.js is single-threaded (only interleaves at await)
    let nextIndex = 0;
    let processedCount = 0;
    let successCount = 0;
    let aborted = false;
    const errorCounts: Record<number, number> = {};

    const getNextUser = (): string | undefined => {
      if (aborted) return undefined;
      const idx = nextIndex++;
      return idx < allPending.length ? allPending[idx] : undefined;
    };

    const updateProgress = (lastUser: string): void => {
      const doneOverall = skippedCached + processedCount;
      const remaining = totalAuthors - doneOverall;
      const pct = 3 + Math.round((processedCount / allPending.length) * 97);
      updateResearchJob(jobId, {
        progressPercent: Math.min(99, pct),
        message: `Step 2: ${doneOverall}/${totalAuthors} profiled (${skippedCached} cached + ${processedCount} fetched, ${remaining} remaining) | ${workerCount} workers | last: u/${lastUser}`,
        stepStats: { ...getJobStepStats(jobId), usersSkippedCached: skippedCached },
      });
    };

    const runWorker = async (): Promise<void> => {
      let user = getNextUser();
      while (user) {
        if (isCancelled(jobId)) return;

        const result: ProfileFetchResult = await collectUserPosts(limiter, user, config);
        const { submissions, hasProfileImage, profilePostsPublic, errorStatus } = result;
        const timestamps = submissions.map((s) => s.createdUtc).sort((a, b) => a - b);

        upsertUserProfile({
          jobId,
          username: user,
          hasProfileImage,
          profilePostsPublic,
          totalPostsScanned: submissions.length,
          firstSeenUtc: timestamps[0] ?? null,
          lastSeenUtc: timestamps[timestamps.length - 1] ?? null,
          submissions,
        });

        processedCount += 1;
        if (errorStatus > 0) {
          errorCounts[errorStatus] = (errorCounts[errorStatus] ?? 0) + 1;
        } else {
          successCount += 1;
        }

        // Early abort: if first 10 users ALL fail with same error
        if (processedCount === 10 && successCount === 0 && !aborted) {
          const dominant = Object.entries(errorCounts).sort((a, b) => b[1] - a[1])[0];
          if (dominant) {
            aborted = true;
            const errCode = dominant[0];
            const hint =
              errCode === '403'
                ? 'Likely missing OAuth "history" scope — re-authenticate with Reddit'
                : errCode === '401'
                  ? 'OAuth token expired or invalid — re-authenticate with Reddit'
                  : `Reddit API returning HTTP ${errCode}`;
            updateResearchJob(jobId, {
              status: 'failed',
              error: `All first 10 users failed with HTTP ${errCode}. ${hint}`,
              message: `Step 2 aborted — API error (HTTP ${errCode}). ${hint}`,
              stepStats: { ...getJobStepStats(jobId), usersSkippedCached: skippedCached },
            });
            return;
          }
        }

        // Update progress every N users or on the last user
        if (processedCount % PROGRESS_UPDATE_INTERVAL === 0 || processedCount === allPending.length) {
          updateProgress(user);
        }

        user = getNextUser();
      }
    };

    // Launch worker pool
    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

    // If early-abort already marked job as failed, exit
    if (aborted) return;

    if (isCancelled(jobId)) {
      handleStepCancel(jobId);
      return;
    }

    // Build completion summary with error breakdown
    const stats = getJobStepStats(jobId);
    const errorEntries = Object.entries(errorCounts);
    const doneTotal = skippedCached + processedCount;

    let completionMessage = `Step 2 complete — ${doneTotal}/${totalAuthors} profiled (${skippedCached} cached + ${processedCount} fetched) | ${workerCount} workers`;

    if (errorEntries.length > 0) {
      const errorParts = errorEntries.map(([code, count]) => `HTTP ${code}: ${count}`).join(', ');
      completionMessage += ` | Errors: ${errorParts}`;
      if (successCount === 0 && processedCount > 0) {
        completionMessage += ' (WARNING: 0 successes — likely an API/auth issue)';
      }
    }

    updateResearchJob(jobId, {
      status: 'queued',
      currentStep: 'profile_users',
      progressPercent: 100,
      message: completionMessage,
      stepStats: { ...stats, usersSkippedCached: skippedCached },
    });
  } catch (error) {
    updateResearchJob(jobId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error in Step 2',
      message: 'Step 2 failed — progress saved, can be retried from where it left off',
      stepStats: getJobStepStats(jobId),
    });
  }
};

// ---------------------------------------------------------------------------
// Step 3: Score & Rank (CPU-only, no API calls, fast + idempotent)
// ---------------------------------------------------------------------------

export const runStepScoreAndRank = async (
  jobId: string,
  config: ResearchJobConfig
): Promise<void> => {
  updateResearchJob(jobId, {
    status: 'running',
    currentStep: 'score_rank',
    progressPercent: 1,
    message: 'Step 3: Scoring and ranking candidates…',
    error: null,
    stepStats: getJobStepStats(jobId),
  });

  try {
    const profiledUsers = listProfiledUsersWithSubmissions(jobId);
    const nowUtc = Math.floor(Date.now() / 1000);
    let candidatesFound = 0;

    for (let i = 0; i < profiledUsers.length; i += 1) {
      const { username, hasProfileImage, profilePostsPublic, submissions } = profiledUsers[i];

      const candidate = buildCandidateFromPosts(
        username,
        submissions,
        nowUtc,
        config.lookbackHours,
        config.lookbackDays,
        hasProfileImage,
        profilePostsPublic
      );

      if (candidate) {
        upsertPatternAndNote(jobId, candidate);
        candidatesFound += 1;
      }

      if ((i + 1) % 50 === 0 || i === profiledUsers.length - 1) {
        const scaledProgress = Math.round(((i + 1) / Math.max(1, profiledUsers.length)) * 100);
        updateResearchJob(jobId, {
          progressPercent: scaledProgress,
          message: `Step 3: Scored ${i + 1}/${profiledUsers.length} users, ${candidatesFound} candidate(s)`,
          stepStats: getJobStepStats(jobId),
        });
      }
    }

    const stats = getJobStepStats(jobId);
    updateResearchJob(jobId, {
      status: 'completed',
      currentStep: 'done',
      progressPercent: 100,
      message: `Step 3 complete — ${candidatesFound} candidate(s) found`,
      finishedAt: new Date().toISOString(),
      stepStats: stats,
    });
  } catch (error) {
    updateResearchJob(jobId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error in Step 3',
      message: 'Step 3 failed — can be retried',
      stepStats: getJobStepStats(jobId),
    });
  }
};
