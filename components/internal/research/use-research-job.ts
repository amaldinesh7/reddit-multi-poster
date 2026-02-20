import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AnalyticsRefreshMode,
  AnalyticsRefreshPayload,
  AnalyticsSummaryPayload,
  CollectBatchSize,
  JobPayload,
  OutreachRecipient,
  OutreachSyncPayload,
  OutreachTemplate,
  ProfileRow,
  DiscoveredSubredditRow,
  ResearchStep,
  ResearchCandidate,
  WorkspaceSubreddit,
  WorkspaceStats,
} from './types';
import { formatElapsed, phaseFromStatus } from './helpers';

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseResearchJobReturn {
  // Workspace data
  wsSubreddits: WorkspaceSubreddit[];
  wsStats: WorkspaceStats | null;

  // Add subreddits
  subredditsInput: string;
  setSubredditsInput: (v: string) => void;
  addingSubreddits: boolean;
  handleAddSubreddits: () => Promise<void>;
  handleRemoveSubreddit: (sub: string) => Promise<void>;

  // Active job
  job: JobPayload | null;
  runningStep: ResearchStep | null;
  phase: ReturnType<typeof phaseFromStatus>;
  isActive: boolean;
  elapsedText: string;
  error: string;
  collectBatchSize: CollectBatchSize;
  setCollectBatchSize: (value: CollectBatchSize) => void;

  // Profiles (global)
  profiles: ProfileRow[];
  profilesTotal: number;
  profilesPage: number;
  setProfilesPage: (v: number | ((p: number) => number)) => void;
  profilesPageSize: number;
  profilesTotalPages: number;

  // Discovered (global)
  discoveredSubs: DiscoveredSubredditRow[];
  addingSubs: Set<string>;
  discoveredPage: number;
  setDiscoveredPage: (v: number | ((p: number) => number)) => void;
  discoveredCollapsed: boolean;
  setDiscoveredCollapsed: (v: boolean | ((p: boolean) => boolean)) => void;
  discoveredPageSize: number;
  discoveredTotalPages: number;
  discoveredSubsSlice: DiscoveredSubredditRow[];

  // Results (global)
  results: ResearchCandidate[];
  totalResults: number;
  page: number;
  setPage: (v: number | ((p: number) => number)) => void;
  totalPages: number;
  minScore: string;
  setMinScore: (v: string) => void;
  minSubreddits: string;
  setMinSubreddits: (v: string) => void;
  duplicateOnly: boolean;
  setDuplicateOnly: (v: boolean) => void;
  nsfwOnly: boolean;
  setNsfwOnly: (v: boolean) => void;
  outreachTemplate: OutreachTemplate;
  analyticsSummary: AnalyticsSummaryPayload | null;
  analyticsLoading: boolean;
  analyticsSyncing: boolean;
  analyticsError: string;
  analyticsMessage: string;
  analyticsLookbackDays: number;
  setAnalyticsLookbackDays: (value: number) => void;
  analyticsMinPostAgeHours: number;
  setAnalyticsMinPostAgeHours: (value: number) => void;
  analyticsTimezone: string;
  setAnalyticsTimezone: (value: string) => void;
  analyticsMinPostsPerUser: string;
  setAnalyticsMinPostsPerUser: (value: string) => void;

  // Handlers
  handleRunStep: (step: ResearchStep) => Promise<void>;
  handleCancel: () => Promise<void>;
  handleForceRestart: () => Promise<void>;
  handleSaveNote: (username: string, noteText: string) => Promise<void>;
  handleCopyTopChannels: () => Promise<void>;
  handleAddDiscoveredSub: (sub: string) => Promise<void>;
  handleAddAllDiscovered: () => Promise<void>;
  handleSendOutreachMessages: (
    recipients: OutreachRecipient[],
    template: OutreachTemplate
  ) => Promise<{ sent: number; failed: number; total: number } | null>;
  handleSyncOutreachReplies: () => Promise<OutreachSyncPayload | null>;
  loadOutreachTemplate: () => Promise<void>;
  loadAnalyticsSummary: () => Promise<void>;
  handleRefreshAnalyticsSummary: () => Promise<void>;
  handleRefreshAnalyticsEngagement: (
    mode?: AnalyticsRefreshMode
  ) => Promise<AnalyticsRefreshPayload | null>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const PROFILES_PAGE_SIZE = 25;
const DISCOVERED_PAGE_SIZE = 20;
const RESULTS_PAGE_SIZE = 25;
const DEFAULT_ANALYTICS_LOOKBACK_DAYS = 90;
const DEFAULT_ANALYTICS_MIN_POST_AGE_HOURS = 24;
const DEFAULT_ANALYTICS_TIMEZONE = 'UTC';
const DEFAULT_ANALYTICS_MIN_POSTS_PER_USER = '5';

export const useResearchJob = (): UseResearchJobReturn => {
  // -- Workspace state
  const [wsSubreddits, setWsSubreddits] = useState<WorkspaceSubreddit[]>([]);
  const [wsStats, setWsStats] = useState<WorkspaceStats | null>(null);
  const [subredditsInput, setSubredditsInput] = useState('');
  const [addingSubreddits, setAddingSubreddits] = useState(false);

  // -- Active job state (derived from workspace stats)
  const [job, setJob] = useState<JobPayload | null>(null);
  const [runningStep, setRunningStep] = useState<ResearchStep | null>(null);
  const [collectBatchSize, setCollectBatchSize] = useState<CollectBatchSize>(10);

  // -- Profiles state (global)
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [profilesTotal, setProfilesTotal] = useState(0);
  const [profilesPage, setProfilesPage] = useState(1);

  // -- Discovered subreddits state (global)
  const [discoveredSubs, setDiscoveredSubs] = useState<DiscoveredSubredditRow[]>([]);
  const [addingSubs, setAddingSubs] = useState<Set<string>>(new Set());
  const [discoveredPage, setDiscoveredPage] = useState(1);
  const [discoveredCollapsed, setDiscoveredCollapsed] = useState(false);

  // -- Results state (global)
  const [results, setResults] = useState<ResearchCandidate[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [page, setPage] = useState(1);
  const [minScore, setMinScore] = useState('0');
  const [minSubreddits, setMinSubreddits] = useState('0');
  const [duplicateOnly, setDuplicateOnly] = useState(false);
  const [nsfwOnly, setNsfwOnly] = useState(false);
  const [outreachTemplate, setOutreachTemplate] = useState<OutreachTemplate>({
    subjectTemplate: '',
    bodyTemplate: '',
  });
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummaryPayload | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsSyncing, setAnalyticsSyncing] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  const [analyticsMessage, setAnalyticsMessage] = useState('');
  const [analyticsLookbackDays, setAnalyticsLookbackDays] = useState(DEFAULT_ANALYTICS_LOOKBACK_DAYS);
  const [analyticsMinPostAgeHours, setAnalyticsMinPostAgeHours] = useState(DEFAULT_ANALYTICS_MIN_POST_AGE_HOURS);
  const [analyticsTimezone, setAnalyticsTimezone] = useState(DEFAULT_ANALYTICS_TIMEZONE);
  const [analyticsMinPostsPerUser, setAnalyticsMinPostsPerUser] = useState(DEFAULT_ANALYTICS_MIN_POSTS_PER_USER);

  // -- UI state
  const [error, setError] = useState('');
  const [elapsedText, setElapsedText] = useState('');
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -- Derived
  const phase = phaseFromStatus(job?.status);
  const isActive = phase === 'running';
  const totalPages = Math.max(1, Math.ceil(totalResults / RESULTS_PAGE_SIZE));
  const profilesTotalPages = Math.max(1, Math.ceil(profilesTotal / PROFILES_PAGE_SIZE));
  const discoveredTotalPages = Math.max(1, Math.ceil(discoveredSubs.length / DISCOVERED_PAGE_SIZE));
  const discoveredSubsSlice = discoveredSubs.slice(
    (discoveredPage - 1) * DISCOVERED_PAGE_SIZE,
    discoveredPage * DISCOVERED_PAGE_SIZE
  );

  // -----------------------------------------------------------------------
  // Elapsed time ticker
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    if (isActive && job?.startedAt) {
      const tick = (): void => setElapsedText(formatElapsed(job.startedAt!));
      tick();
      elapsedTimerRef.current = setInterval(tick, 1000);
    } else {
      setElapsedText('');
    }
    return () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, [isActive, job?.startedAt]);

  // -----------------------------------------------------------------------
  // Workspace loaders
  // -----------------------------------------------------------------------
  const loadWorkspaceStats = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/internal/research/workspace/stats');
      const data = await response.json();
      if (response.ok) {
        setWsStats(data as WorkspaceStats);
        if (data.activeJob) {
          setJob(data.activeJob as JobPayload);
          if (data.activeJob.status !== 'running') setRunningStep(null);
        }
      }
    } catch { /* retry on next poll */ }
  }, []);

  const loadWorkspaceSubreddits = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/internal/research/workspace/subreddits');
      const data = await response.json();
      if (response.ok) setWsSubreddits(data.subreddits as WorkspaceSubreddit[]);
    } catch { /* retry */ }
  }, []);

  const loadProfiles = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(
        `/api/internal/research/workspace/profiles?page=${profilesPage}&pageSize=${PROFILES_PAGE_SIZE}`
      );
      const data = await response.json();
      if (response.ok) {
        setProfiles(data.rows as ProfileRow[]);
        setProfilesTotal(data.total as number);
      }
    } catch { /* retry */ }
  }, [profilesPage]);

  const loadResults = useCallback(async (): Promise<void> => {
    try {
      const query = new URLSearchParams({
        page: String(page),
        pageSize: String(RESULTS_PAGE_SIZE),
        minScore,
        minSubreddits,
        duplicateOnly: String(duplicateOnly),
        nsfwOnly: String(nsfwOnly),
      });
      const response = await fetch(`/api/internal/research/workspace/results?${query.toString()}`);
      const data = await response.json();
      if (response.ok) {
        setResults(data.rows as ResearchCandidate[]);
        setTotalResults(typeof data.total === 'number' ? data.total : 0);
      }
    } catch { /* retry */ }
  }, [page, minScore, minSubreddits, duplicateOnly, nsfwOnly]);

  const loadDiscoveredSubs = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/internal/research/workspace/discovered');
      const data = await response.json();
      if (response.ok) setDiscoveredSubs(data.subreddits as DiscoveredSubredditRow[]);
    } catch { /* retry */ }
  }, []);

  const loadOutreachTemplate = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/internal/research/workspace/outreach/template');
      const data = await response.json();
      if (response.ok) {
        setOutreachTemplate({
          subjectTemplate: typeof data.subjectTemplate === 'string' ? data.subjectTemplate : '',
          bodyTemplate: typeof data.bodyTemplate === 'string' ? data.bodyTemplate : '',
        });
      }
    } catch { /* retry */ }
  }, []);

  const loadAnalyticsSummary = useCallback(async (): Promise<void> => {
    const minPostsPerUserNumber = Math.max(1, Number(analyticsMinPostsPerUser) || 5);
    setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      const query = new URLSearchParams({
        lookbackDays: String(analyticsLookbackDays),
        minPostAgeHours: String(analyticsMinPostAgeHours),
        timezone: analyticsTimezone,
        minPostsPerUser: String(minPostsPerUserNumber),
      });
      const response = await fetch(`/api/internal/research/workspace/analytics/summary?${query.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        setAnalyticsError(data.error ?? 'Failed to load analytics summary');
        return;
      }
      setAnalyticsSummary(data as AnalyticsSummaryPayload);
    } catch {
      setAnalyticsError('Network error loading analytics summary');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsLookbackDays, analyticsMinPostAgeHours, analyticsTimezone, analyticsMinPostsPerUser]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------
  const handleAddSubreddits = async (): Promise<void> => {
    if (!subredditsInput.trim()) return;
    setAddingSubreddits(true);
    setError('');
    try {
      const response = await fetch('/api/internal/research/workspace/subreddits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subreddits: subredditsInput }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Failed to add subreddits');
      } else {
        setSubredditsInput('');
        await loadWorkspaceSubreddits();
        await loadWorkspaceStats();
      }
    } catch {
      setError('Network error adding subreddits');
    } finally {
      setAddingSubreddits(false);
    }
  };

  const handleRemoveSubreddit = async (sub: string): Promise<void> => {
    setError('');
    try {
      const response = await fetch('/api/internal/research/workspace/subreddits', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subreddit: sub }),
      });
      if (response.ok) {
        await loadWorkspaceSubreddits();
        await loadWorkspaceStats();
      }
    } catch {
      setError('Network error removing subreddit');
    }
  };

  const handleRunStep = useCallback(async (step: ResearchStep): Promise<void> => {
    setRunningStep(step);
    setError('');
    try {
      const body: Record<string, unknown> = { step };
      if (step === 'collect_posts') body.batchSize = collectBatchSize;
      if (step === 'profile_users') body.concurrency = 3;
      const response = await fetch('/api/internal/research/workspace/run-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? `Failed to start ${step}`);
        setRunningStep(null);
      }
    } catch {
      setError('Network error starting step');
      setRunningStep(null);
    }
  }, [collectBatchSize]);

  const handleCancel = async (): Promise<void> => {
    const activeJobId = wsStats?.activeJobId;
    if (!activeJobId) return;
    await fetch(`/api/internal/research/jobs/${activeJobId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    });
    await loadWorkspaceStats();
  };

  const handleForceRestart = async (): Promise<void> => {
    const activeJobId = wsStats?.activeJobId;
    if (!activeJobId) return;
    await fetch(`/api/internal/research/jobs/${activeJobId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'force-restart' }),
    });
    await loadWorkspaceStats();
  };

  const handleSaveNote = async (username: string, noteText: string): Promise<void> => {
    const activeJobId = wsStats?.activeJobId;
    if (!activeJobId) return;
    await fetch(`/api/internal/research/jobs/${activeJobId}/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, noteText }),
    });
  };

  const handleCopyTopChannels = async (): Promise<void> => {
    const channels = Array.from(new Set(results.map((item) => item.suggestedChannel).filter(Boolean))).join('\n');
    await navigator.clipboard.writeText(channels);
  };

  const handleAddDiscoveredSub = async (sub: string): Promise<void> => {
    setAddingSubs((prev) => new Set(prev).add(sub));
    setError('');
    try {
      const response = await fetch('/api/internal/research/workspace/subreddits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subreddits: sub }),
      });
      if (response.ok) {
        setDiscoveredSubs((prev) => prev.filter((d) => d.subreddit !== sub));
        await loadWorkspaceSubreddits();
        await loadWorkspaceStats();
      }
    } catch {
      setError('Network error adding subreddit');
    } finally {
      setAddingSubs((prev) => { const next = new Set(prev); next.delete(sub); return next; });
    }
  };

  const handleAddAllDiscovered = async (): Promise<void> => {
    if (discoveredSubs.length === 0) return;
    const subs = discoveredSubs.map((d) => d.subreddit);
    setAddingSubs(new Set(subs));
    setError('');
    try {
      const response = await fetch('/api/internal/research/workspace/subreddits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subreddits: subs.join(',') }),
      });
      if (response.ok) {
        setDiscoveredSubs([]);
        await loadWorkspaceSubreddits();
        await loadWorkspaceStats();
      }
    } catch {
      setError('Network error adding subreddits');
    } finally {
      setAddingSubs(new Set());
    }
  };

  const handleSendOutreachMessages = async (
    recipients: OutreachRecipient[],
    template: OutreachTemplate
  ): Promise<{ sent: number; failed: number; total: number } | null> => {
    setError('');
    try {
      const response = await fetch('/api/internal/research/workspace/outreach/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients,
          subjectTemplate: template.subjectTemplate,
          bodyTemplate: template.bodyTemplate,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Failed to send outreach messages');
        return null;
      }
      setOutreachTemplate(template);
      await loadResults();
      return {
        sent: Number(data.sent ?? 0),
        failed: Number(data.failed ?? 0),
        total: Number(data.total ?? recipients.length),
      };
    } catch {
      setError('Network error sending outreach messages');
      return null;
    }
  };

  const handleSyncOutreachReplies = async (): Promise<OutreachSyncPayload | null> => {
    setError('');
    try {
      const response = await fetch('/api/internal/research/workspace/outreach/sync', {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Failed to sync outreach replies');
        return null;
      }
      await loadResults();
      return {
        fetched: Number(data.fetched ?? 0),
        matched: Number(data.matched ?? 0),
        inserted: Number(data.inserted ?? 0),
      };
    } catch {
      setError('Network error syncing outreach replies');
      return null;
    }
  };

  const handleRefreshAnalyticsSummary = async (): Promise<void> => {
    await loadAnalyticsSummary();
  };

  const handleRefreshAnalyticsEngagement = async (
    mode: AnalyticsRefreshMode = 'missing_only'
  ): Promise<AnalyticsRefreshPayload | null> => {
    setAnalyticsSyncing(true);
    setAnalyticsError('');
    try {
      const response = await fetch('/api/internal/research/workspace/analytics/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          maxPosts: 500,
          batchSize: 25,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAnalyticsError(data.error ?? 'Failed to refresh analytics engagement');
        return null;
      }

      const payload: AnalyticsRefreshPayload = {
        scanned: Number(data.scanned ?? 0),
        updated: Number(data.updated ?? 0),
        skipped: Number(data.skipped ?? 0),
        failed: Number(data.failed ?? 0),
        remainingMissing: Number(data.remainingMissing ?? 0),
      };

      setAnalyticsMessage(
        `Refreshed ${payload.updated}/${payload.scanned} posts. Remaining missing: ${payload.remainingMissing}.`
      );
      await loadAnalyticsSummary();
      return payload;
    } catch {
      setAnalyticsError('Network error refreshing analytics engagement');
      return null;
    } finally {
      setAnalyticsSyncing(false);
    }
  };

  // -----------------------------------------------------------------------
  // Effects
  // -----------------------------------------------------------------------

  // Initial load
  useEffect(() => {
    loadWorkspaceStats().catch(() => undefined);
    loadWorkspaceSubreddits().catch(() => undefined);
    loadProfiles().catch(() => undefined);
    loadResults().catch(() => undefined);
    loadDiscoveredSubs().catch(() => undefined);
    loadOutreachTemplate().catch(() => undefined);
    loadAnalyticsSummary().catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll workspace stats while a step is running
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      loadWorkspaceStats().catch(() => undefined);
    }, 2000);
    return () => clearInterval(interval);
  }, [isActive, loadWorkspaceStats]);

  // Reload data when job status changes to non-running
  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    if (prevPhaseRef.current === 'running' && phase !== 'running') {
      loadWorkspaceSubreddits().catch(() => undefined);
      loadProfiles().catch(() => undefined);
      loadResults().catch(() => undefined);
      loadDiscoveredSubs().catch(() => undefined);
    }
    prevPhaseRef.current = phase;
  }, [phase, loadWorkspaceSubreddits, loadProfiles, loadResults, loadDiscoveredSubs]);

  // Reload results when filters change
  useEffect(() => {
    loadResults().catch(() => undefined);
  }, [loadResults]);

  // Reload profiles when page changes
  useEffect(() => {
    loadProfiles().catch(() => undefined);
  }, [loadProfiles]);

  return {
    wsSubreddits, wsStats,
    subredditsInput, setSubredditsInput, addingSubreddits,
    handleAddSubreddits, handleRemoveSubreddit,
    job, runningStep, phase, isActive, elapsedText, error,
    collectBatchSize, setCollectBatchSize,
    profiles, profilesTotal, profilesPage, setProfilesPage,
    profilesPageSize: PROFILES_PAGE_SIZE, profilesTotalPages,
    discoveredSubs, addingSubs, discoveredPage, setDiscoveredPage,
    discoveredCollapsed, setDiscoveredCollapsed,
    discoveredPageSize: DISCOVERED_PAGE_SIZE, discoveredTotalPages, discoveredSubsSlice,
    results, totalResults, page, setPage, totalPages,
    minScore, setMinScore, minSubreddits, setMinSubreddits,
    duplicateOnly, setDuplicateOnly, nsfwOnly, setNsfwOnly,
    outreachTemplate,
    analyticsSummary, analyticsLoading, analyticsSyncing, analyticsError, analyticsMessage,
    analyticsLookbackDays, setAnalyticsLookbackDays,
    analyticsMinPostAgeHours, setAnalyticsMinPostAgeHours,
    analyticsTimezone, setAnalyticsTimezone,
    analyticsMinPostsPerUser, setAnalyticsMinPostsPerUser,
    handleRunStep, handleCancel, handleForceRestart,
    handleSaveNote, handleCopyTopChannels,
    handleAddDiscoveredSub, handleAddAllDiscovered,
    handleSendOutreachMessages, handleSyncOutreachReplies, loadOutreachTemplate,
    loadAnalyticsSummary, handleRefreshAnalyticsSummary, handleRefreshAnalyticsEngagement,
  };
};
