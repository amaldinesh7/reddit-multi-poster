import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import type {
  AnalyticsRefreshMode,
  OutreachMessageStatus,
  OutreachStatus,
  OutreachTemplate,
  PatternEvidence,
  ResearchCandidate,
  ResearchJobConfig,
  ResearchJobRow,
  ResearchResultsQuery,
  ResearchStep,
  ResearchStepStats,
  UserSubmission,
} from './types';

const DB_DIR = path.join(process.cwd(), 'out', 'internal-research');
const DB_PATH = path.join(DB_DIR, 'research.sqlite');
const DEFAULT_OUTREACH_SUBJECT = 'Quick question about your posts in {{top_channel}}';
const DEFAULT_OUTREACH_BODY =
  'Hey u/{{username}},\n\nI saw your recent posts in {{top_channel}} and wanted to share a quick idea.\n\nWould you be open to a short chat?\n\nThanks!';

let dbInstance: Database.Database | null = null;

const ensureDb = (): Database.Database => {
  if (dbInstance) return dbInstance;
  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS research_jobs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      config_json TEXT NOT NULL,
      progress_percent INTEGER NOT NULL DEFAULT 0,
      message TEXT,
      started_at TEXT,
      finished_at TEXT,
      error TEXT,
      cancel_requested INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT,
      current_step TEXT,
      step_stats TEXT
    );
    CREATE TABLE IF NOT EXISTS research_subreddit_posts (
      job_id TEXT NOT NULL,
      subreddit TEXT NOT NULL,
      post_id TEXT NOT NULL,
      author TEXT NOT NULL,
      title TEXT NOT NULL,
      normalized_title TEXT NOT NULL,
      url TEXT NOT NULL,
      created_utc INTEGER NOT NULL,
      is_nsfw INTEGER NOT NULL,
      crosspost_parent TEXT,
      score INTEGER,
      num_comments INTEGER,
      upvote_ratio REAL,
      engagement_synced_at TEXT,
      PRIMARY KEY(job_id, post_id)
    );
    CREATE TABLE IF NOT EXISTS research_user_profiles (
      job_id TEXT NOT NULL,
      username TEXT NOT NULL,
      has_profile_image INTEGER NOT NULL,
      profile_posts_public INTEGER NOT NULL,
      total_posts_scanned INTEGER NOT NULL,
      first_seen_utc INTEGER,
      last_seen_utc INTEGER,
      submissions_json TEXT,
      PRIMARY KEY(job_id, username)
    );
    CREATE TABLE IF NOT EXISTS research_user_patterns (
      job_id TEXT NOT NULL,
      username TEXT NOT NULL,
      frequency_score REAL NOT NULL,
      duplicate_score REAL NOT NULL,
      cross_subreddit_score REAL NOT NULL,
      overall_score REAL NOT NULL,
      cluster_count INTEGER NOT NULL,
      max_cluster_size INTEGER NOT NULL,
      total_duplicate_posts INTEGER NOT NULL DEFAULT 0,
      avg_cluster_size REAL NOT NULL DEFAULT 0,
      subreddits_count INTEGER NOT NULL,
      evidence_json TEXT NOT NULL,
      PRIMARY KEY(job_id, username)
    );
    CREATE TABLE IF NOT EXISTS research_outreach_notes (
      job_id TEXT NOT NULL,
      username TEXT NOT NULL,
      suggested_channel TEXT NOT NULL,
      note_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY(job_id, username)
    );
    CREATE TABLE IF NOT EXISTS research_outreach_messages (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      status TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      suggested_channel TEXT NOT NULL,
      lead_score REAL NOT NULL,
      reddit_message_fullname TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS research_outreach_replies (
      reddit_reply_fullname TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      reddit_parent_fullname TEXT,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      created_utc INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_research_posts_job_subreddit
      ON research_subreddit_posts (job_id, subreddit);
    CREATE INDEX IF NOT EXISTS idx_research_profiles_job_user
      ON research_user_profiles (job_id, username);
    CREATE INDEX IF NOT EXISTS idx_research_patterns_job_user
      ON research_user_patterns (job_id, username);
    CREATE INDEX IF NOT EXISTS idx_research_patterns_job_score
      ON research_user_patterns (job_id, overall_score DESC);
    CREATE INDEX IF NOT EXISTS idx_research_outreach_messages_user_created
      ON research_outreach_messages (username, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_research_outreach_messages_fullname
      ON research_outreach_messages (reddit_message_fullname);
    CREATE INDEX IF NOT EXISTS idx_research_outreach_replies_user_created
      ON research_outreach_replies (username, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_research_outreach_replies_parent
      ON research_outreach_replies (reddit_parent_fullname);
  `);

  // Migrations for existing DBs
  try {
    const cols = db.pragma('table_info(research_jobs)') as Array<{ name: string }>;
    if (!cols.some((c) => c.name === 'updated_at')) {
      db.exec('ALTER TABLE research_jobs ADD COLUMN updated_at TEXT');
    }
    if (!cols.some((c) => c.name === 'current_step')) {
      db.exec('ALTER TABLE research_jobs ADD COLUMN current_step TEXT');
    }
    if (!cols.some((c) => c.name === 'step_stats')) {
      db.exec('ALTER TABLE research_jobs ADD COLUMN step_stats TEXT');
    }
  } catch {
    // table may not exist yet, CREATE TABLE above handles it
  }

  try {
    const postCols = db.pragma('table_info(research_subreddit_posts)') as Array<{ name: string }>;
    if (!postCols.some((c) => c.name === 'score')) {
      db.exec('ALTER TABLE research_subreddit_posts ADD COLUMN score INTEGER');
    }
    if (!postCols.some((c) => c.name === 'num_comments')) {
      db.exec('ALTER TABLE research_subreddit_posts ADD COLUMN num_comments INTEGER');
    }
    if (!postCols.some((c) => c.name === 'upvote_ratio')) {
      db.exec('ALTER TABLE research_subreddit_posts ADD COLUMN upvote_ratio REAL');
    }
    if (!postCols.some((c) => c.name === 'engagement_synced_at')) {
      db.exec('ALTER TABLE research_subreddit_posts ADD COLUMN engagement_synced_at TEXT');
    }
  } catch {
    // table may not exist yet
  }

  try {
    const profileCols = db.pragma('table_info(research_user_profiles)') as Array<{ name: string }>;
    if (!profileCols.some((c) => c.name === 'submissions_json')) {
      db.exec('ALTER TABLE research_user_profiles ADD COLUMN submissions_json TEXT');
    }
  } catch {
    // table may not exist yet
  }

  try {
    const patternCols = db.pragma('table_info(research_user_patterns)') as Array<{ name: string }>;
    if (!patternCols.some((c) => c.name === 'total_duplicate_posts')) {
      db.exec('ALTER TABLE research_user_patterns ADD COLUMN total_duplicate_posts INTEGER NOT NULL DEFAULT 0');
    }
    if (!patternCols.some((c) => c.name === 'avg_cluster_size')) {
      db.exec('ALTER TABLE research_user_patterns ADD COLUMN avg_cluster_size REAL NOT NULL DEFAULT 0');
    }
  } catch {
    // table may not exist yet
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_research_posts_created_utc
      ON research_subreddit_posts (created_utc DESC);
    CREATE INDEX IF NOT EXISTS idx_research_posts_author_created
      ON research_subreddit_posts (author, created_utc DESC);
    CREATE INDEX IF NOT EXISTS idx_research_posts_score
      ON research_subreddit_posts (score);
    CREATE INDEX IF NOT EXISTS idx_research_posts_num_comments
      ON research_subreddit_posts (num_comments);
  `);

  // ---- Workspace tables (global, not job-scoped) -------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS research_workspace_subreddits (
      subreddit TEXT PRIMARY KEY,
      added_at TEXT NOT NULL,
      scan_status TEXT NOT NULL DEFAULT 'pending',
      last_scanned_at TEXT,
      post_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS research_workspace_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Backfill workspace subreddits from existing job data (migration — idempotent)
  db.exec(`
    INSERT OR IGNORE INTO research_workspace_subreddits (subreddit, added_at, scan_status, last_scanned_at, post_count)
    SELECT
      subreddit,
      datetime('now') AS added_at,
      'scanned' AS scan_status,
      datetime('now') AS last_scanned_at,
      COUNT(DISTINCT post_id) AS post_count
    FROM research_subreddit_posts
    GROUP BY LOWER(subreddit)
  `);

  // Seed active_job_id from most recent job if not already set
  const existingState = db.prepare("SELECT value FROM research_workspace_state WHERE key = 'active_job_id'").get() as { value: string } | undefined;
  if (!existingState) {
    const latestJob = db.prepare("SELECT id FROM research_jobs ORDER BY COALESCE(started_at, '') DESC, id DESC LIMIT 1").get() as { id: string } | undefined;
    if (latestJob) {
      db.prepare("INSERT OR IGNORE INTO research_workspace_state (key, value) VALUES ('active_job_id', ?)").run(latestJob.id);
    }
  }

  dbInstance = db;
  return db;
};

// ---------------------------------------------------------------------------
// Job row mapper
// ---------------------------------------------------------------------------

const parseStepStats = (raw: unknown): ResearchStepStats | null => {
  if (!raw || typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as ResearchStepStats;
  } catch {
    return null;
  }
};

const mapJobRow = (row: Record<string, unknown>): ResearchJobRow => ({
  id: String(row.id),
  status: row.status as ResearchJobRow['status'],
  configJson: String(row.config_json),
  progressPercent: Number(row.progress_percent),
  message: row.message ? String(row.message) : null,
  startedAt: row.started_at ? String(row.started_at) : null,
  finishedAt: row.finished_at ? String(row.finished_at) : null,
  error: row.error ? String(row.error) : null,
  cancelRequested: Number(row.cancel_requested),
  updatedAt: row.updated_at ? String(row.updated_at) : null,
  currentStep: (row.current_step as ResearchStep) ?? null,
  stepStats: parseStepStats(row.step_stats),
});

// ---------------------------------------------------------------------------
// Job CRUD
// ---------------------------------------------------------------------------

export const createResearchJob = (id: string, config: ResearchJobConfig): void => {
  const db = ensureDb();
  db.prepare(
    `INSERT INTO research_jobs (id, status, config_json, progress_percent, message)
     VALUES (?, 'queued', ?, 0, 'Queued')`
  ).run(id, JSON.stringify(config));
};

export const updateResearchJob = (
  id: string,
  patch: Partial<{
    status: string;
    progressPercent: number;
    message: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    error: string | null;
    cancelRequested: number;
    currentStep: ResearchStep | null;
    stepStats: ResearchStepStats | null;
  }>
): void => {
  const db = ensureDb();
  const fields: string[] = [];
  const values: Array<string | number | null> = [];
  if (patch.status !== undefined) {
    fields.push('status = ?');
    values.push(patch.status);
  }
  if (patch.progressPercent !== undefined) {
    fields.push('progress_percent = ?');
    values.push(patch.progressPercent);
  }
  if (patch.message !== undefined) {
    fields.push('message = ?');
    values.push(patch.message);
  }
  if (patch.startedAt !== undefined) {
    fields.push('started_at = ?');
    values.push(patch.startedAt);
  }
  if (patch.finishedAt !== undefined) {
    fields.push('finished_at = ?');
    values.push(patch.finishedAt);
  }
  if (patch.error !== undefined) {
    fields.push('error = ?');
    values.push(patch.error);
  }
  if (patch.cancelRequested !== undefined) {
    fields.push('cancel_requested = ?');
    values.push(patch.cancelRequested);
  }
  if (patch.currentStep !== undefined) {
    fields.push('current_step = ?');
    values.push(patch.currentStep);
  }
  if (patch.stepStats !== undefined) {
    fields.push('step_stats = ?');
    values.push(patch.stepStats ? JSON.stringify(patch.stepStats) : null);
  }
  if (!fields.length) return;
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  db.prepare(`UPDATE research_jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
};

export const getResearchJob = (id: string): ResearchJobRow | null => {
  const db = ensureDb();
  const row = db.prepare('SELECT * FROM research_jobs WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return mapJobRow(row);
};

export const findLatestJobByConfig = (configJson: string): ResearchJobRow | null => {
  const db = ensureDb();
  const row = db
    .prepare(
      `SELECT * FROM research_jobs
       WHERE config_json = ?
       ORDER BY COALESCE(started_at, '') DESC, id DESC
       LIMIT 1`
    )
    .get(configJson) as Record<string, unknown> | undefined;
  if (!row) return null;
  return mapJobRow(row);
};

// ---------------------------------------------------------------------------
// Step stats helper (live counts from DB)
// ---------------------------------------------------------------------------

export const getJobStepStats = (jobId: string): ResearchStepStats => {
  const db = ensureDb();
  const posts = db.prepare(
    'SELECT COUNT(*) AS count FROM research_subreddit_posts WHERE job_id = ?'
  ).get(jobId) as { count: number };
  const subs = db.prepare(
    'SELECT COUNT(DISTINCT subreddit) AS count FROM research_subreddit_posts WHERE job_id = ?'
  ).get(jobId) as { count: number };
  const profiles = db.prepare(
    'SELECT COUNT(*) AS count FROM research_user_profiles WHERE job_id = ? AND total_posts_scanned > 0'
  ).get(jobId) as { count: number };
  const allAuthors = db.prepare(
    'SELECT COUNT(DISTINCT author) AS count FROM research_subreddit_posts WHERE job_id = ?'
  ).get(jobId) as { count: number };
  const patterns = db.prepare(
    'SELECT COUNT(*) AS count FROM research_user_patterns WHERE job_id = ?'
  ).get(jobId) as { count: number };
  return {
    postsCollected: posts?.count ?? 0,
    subredditsScanned: subs?.count ?? 0,
    usersTotal: allAuthors?.count ?? 0,
    usersProfiled: profiles?.count ?? 0,
    usersSkippedCached: 0,
    candidatesFound: patterns?.count ?? 0,
  };
};

// ---------------------------------------------------------------------------
// Subreddit posts
// ---------------------------------------------------------------------------

export const insertSubredditPost = (record: {
  jobId: string;
  subreddit: string;
  postId: string;
  author: string;
  title: string;
  normalizedTitle: string;
  url: string;
  createdUtc: number;
  isNsfw: number;
  crosspostParent: string | null;
  score: number | null;
  numComments: number | null;
  upvoteRatio: number | null;
}): void => {
  const db = ensureDb();
  db.prepare(`
    INSERT OR IGNORE INTO research_subreddit_posts
    (job_id, subreddit, post_id, author, title, normalized_title, url, created_utc, is_nsfw, crosspost_parent, score, num_comments, upvote_ratio, engagement_synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.jobId,
    record.subreddit,
    record.postId,
    record.author,
    record.title,
    record.normalizedTitle,
    record.url,
    record.createdUtc,
    record.isNsfw,
    record.crosspostParent,
    record.score,
    record.numComments,
    record.upvoteRatio,
    new Date().toISOString()
  );
};

export const listJobAuthors = (jobId: string): string[] => {
  const db = ensureDb();
  const rows = db.prepare('SELECT DISTINCT author FROM research_subreddit_posts WHERE job_id = ?').all(jobId) as Array<{ author: string }>;
  return rows.map((row) => row.author);
};

export const getSubredditPostCount = (jobId: string, subreddit: string): number => {
  const db = ensureDb();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM research_subreddit_posts
       WHERE job_id = ? AND LOWER(subreddit) = LOWER(?)`
    )
    .get(jobId, subreddit) as { count: number } | undefined;
  return row?.count ?? 0;
};

/** Total unique posts for a subreddit across ALL jobs — global dedup safety net. */
export const getGlobalSubredditPostCount = (subreddit: string): number => {
  const db = ensureDb();
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT post_id) AS count
       FROM research_subreddit_posts
       WHERE LOWER(subreddit) = LOWER(?)`
    )
    .get(subreddit) as { count: number } | undefined;
  return row?.count ?? 0;
};

export const listAnalyticsPosts = (filters: {
  lookbackDays: number;
  minPostAgeHours: number;
}): Array<{
  postId: string;
  author: string;
  createdUtc: number;
  score: number | null;
  numComments: number | null;
  upvoteRatio: number | null;
}> => {
  const db = ensureDb();
  const conditions: string[] = [];
  const values: number[] = [];
  const nowUtc = Math.floor(Date.now() / 1000);

  if (filters.lookbackDays > 0) {
    conditions.push('created_utc >= ?');
    values.push(nowUtc - filters.lookbackDays * 86400);
  }
  if (filters.minPostAgeHours > 0) {
    conditions.push('created_utc <= ?');
    values.push(nowUtc - filters.minPostAgeHours * 3600);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT
      post_id,
      MIN(author) AS author,
      MAX(created_utc) AS created_utc,
      MAX(score) AS score,
      MAX(num_comments) AS num_comments,
      MAX(upvote_ratio) AS upvote_ratio
    FROM research_subreddit_posts
    ${where}
    GROUP BY post_id
    ORDER BY created_utc DESC
  `).all(...values) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    postId: String(row.post_id),
    author: String(row.author),
    createdUtc: Number(row.created_utc),
    score: row.score === null || row.score === undefined ? null : Number(row.score),
    numComments: row.num_comments === null || row.num_comments === undefined
      ? null
      : Number(row.num_comments),
    upvoteRatio: row.upvote_ratio === null || row.upvote_ratio === undefined
      ? null
      : Number(row.upvote_ratio),
  }));
};

export const listPostIdsForEngagementRefresh = (
  mode: AnalyticsRefreshMode,
  maxPosts: number
): Array<{ postId: string; createdUtc: number }> => {
  const db = ensureDb();
  if (mode === 'recent_only') {
    const rows = db.prepare(`
      SELECT post_id, MAX(created_utc) AS created_utc
      FROM research_subreddit_posts
      GROUP BY post_id
      ORDER BY created_utc DESC
      LIMIT ?
    `).all(maxPosts) as Array<{ post_id: string; created_utc: number }>;
    return rows.map((row) => ({ postId: row.post_id, createdUtc: row.created_utc }));
  }

  const rows = db.prepare(`
    SELECT post_id, MAX(created_utc) AS created_utc
    FROM research_subreddit_posts
    GROUP BY post_id
    HAVING SUM(CASE WHEN score IS NULL OR num_comments IS NULL THEN 1 ELSE 0 END) > 0
    ORDER BY created_utc DESC
    LIMIT ?
  `).all(maxPosts) as Array<{ post_id: string; created_utc: number }>;
  return rows.map((row) => ({ postId: row.post_id, createdUtc: row.created_utc }));
};

export const updatePostEngagementByPostId = (record: {
  postId: string;
  score: number | null;
  numComments: number | null;
  upvoteRatio: number | null;
}): number => {
  const db = ensureDb();
  const result = db.prepare(`
    UPDATE research_subreddit_posts
    SET
      score = ?,
      num_comments = ?,
      upvote_ratio = ?,
      engagement_synced_at = ?
    WHERE post_id = ?
  `).run(
    record.score,
    record.numComments,
    record.upvoteRatio,
    new Date().toISOString(),
    record.postId
  );
  return result.changes;
};

export const countPostsMissingEngagement = (): number => {
  const db = ensureDb();
  const row = db.prepare(`
    SELECT COUNT(*) AS count
    FROM (
      SELECT post_id
      FROM research_subreddit_posts
      GROUP BY post_id
      HAVING SUM(CASE WHEN score IS NULL OR num_comments IS NULL THEN 1 ELSE 0 END) > 0
    ) missing
  `).get() as { count: number };
  return row?.count ?? 0;
};

// ---------------------------------------------------------------------------
// User profiles
// ---------------------------------------------------------------------------

/** Users with actual post data — used by Step 3 (scoring). */
export const listProfiledUsers = (jobId: string): Set<string> => {
  const db = ensureDb();
  const rows = db
    .prepare(
      `SELECT username
       FROM research_user_profiles
       WHERE job_id = ? AND total_posts_scanned > 0`
    )
    .all(jobId) as Array<{ username: string }>;
  return new Set(rows.map((row) => row.username));
};

/** All users we've already attempted to profile (including private/empty).
 *  Used by Step 2 to skip re-fetching users we already tried. */
export const listAttemptedUsers = (jobId: string): Set<string> => {
  const db = ensureDb();
  const rows = db
    .prepare('SELECT username FROM research_user_profiles WHERE job_id = ?')
    .all(jobId) as Array<{ username: string }>;
  return new Set(rows.map((row) => row.username));
};

/** All users attempted in ANY job — global dedup for phased scans. */
export const listGlobalAttemptedUsers = (): Set<string> => {
  const db = ensureDb();
  const rows = db
    .prepare('SELECT DISTINCT username FROM research_user_profiles')
    .all() as Array<{ username: string }>;
  return new Set(rows.map((row) => row.username));
};

/** Delete all profile rows for a job — used to clear bad cached data. */
export const clearJobProfiles = (jobId: string): number => {
  const db = ensureDb();
  const result = db
    .prepare('DELETE FROM research_user_profiles WHERE job_id = ?')
    .run(jobId);
  return result.changes;
};

export const upsertUserProfile = (record: {
  jobId: string;
  username: string;
  hasProfileImage: boolean;
  profilePostsPublic: boolean;
  totalPostsScanned: number;
  firstSeenUtc: number | null;
  lastSeenUtc: number | null;
  submissions?: UserSubmission[];
}): void => {
  const db = ensureDb();
  db.prepare(`
    INSERT INTO research_user_profiles
    (job_id, username, has_profile_image, profile_posts_public, total_posts_scanned, first_seen_utc, last_seen_utc, submissions_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(job_id, username) DO UPDATE SET
      has_profile_image = excluded.has_profile_image,
      profile_posts_public = excluded.profile_posts_public,
      total_posts_scanned = excluded.total_posts_scanned,
      first_seen_utc = excluded.first_seen_utc,
      last_seen_utc = excluded.last_seen_utc,
      submissions_json = excluded.submissions_json
  `).run(
    record.jobId,
    record.username,
    record.hasProfileImage ? 1 : 0,
    record.profilePostsPublic ? 1 : 0,
    record.totalPostsScanned,
    record.firstSeenUtc,
    record.lastSeenUtc,
    record.submissions ? JSON.stringify(record.submissions) : null
  );
};

/** Retrieve all profiled users with their cached submissions for the scoring pass. */
export const listProfiledUsersWithSubmissions = (
  jobId: string
): Array<{
  username: string;
  hasProfileImage: boolean;
  profilePostsPublic: boolean;
  submissions: UserSubmission[];
}> => {
  const db = ensureDb();
  const rows = db
    .prepare(
      `SELECT username, has_profile_image, profile_posts_public, submissions_json
       FROM research_user_profiles
       WHERE job_id = ? AND total_posts_scanned > 0`
    )
    .all(jobId) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    username: String(row.username),
    hasProfileImage: Number(row.has_profile_image) === 1,
    profilePostsPublic: Number(row.profile_posts_public) === 1,
    submissions: row.submissions_json
      ? (JSON.parse(String(row.submissions_json)) as UserSubmission[])
      : [],
  }));
};

// ---------------------------------------------------------------------------
// Patterns & notes
// ---------------------------------------------------------------------------

export const upsertPatternAndNote = (
  jobId: string,
  candidate: ResearchCandidate
): void => {
  const db = ensureDb();
  const timestamp = new Date().toISOString();
  db.prepare(`
    INSERT INTO research_user_patterns
    (job_id, username, frequency_score, duplicate_score, cross_subreddit_score, overall_score, cluster_count, max_cluster_size, total_duplicate_posts, avg_cluster_size, subreddits_count, evidence_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(job_id, username) DO UPDATE SET
      frequency_score = excluded.frequency_score,
      duplicate_score = excluded.duplicate_score,
      cross_subreddit_score = excluded.cross_subreddit_score,
      overall_score = excluded.overall_score,
      cluster_count = excluded.cluster_count,
      max_cluster_size = excluded.max_cluster_size,
      total_duplicate_posts = excluded.total_duplicate_posts,
      avg_cluster_size = excluded.avg_cluster_size,
      subreddits_count = excluded.subreddits_count,
      evidence_json = excluded.evidence_json
  `).run(
    jobId,
    candidate.username,
    candidate.frequencyScore,
    candidate.duplicateScore,
    candidate.crossSubredditScore,
    candidate.overallScore,
    candidate.clusterCount,
    candidate.maxClusterSize,
    candidate.totalDuplicatePosts,
    candidate.avgClusterSize,
    candidate.subredditsCount,
    JSON.stringify(candidate.evidence)
  );
  db.prepare(`
    INSERT INTO research_outreach_notes (job_id, username, suggested_channel, note_text, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(job_id, username) DO UPDATE SET
      suggested_channel = excluded.suggested_channel,
      note_text = excluded.note_text
  `).run(jobId, candidate.username, candidate.suggestedChannel, candidate.noteText, timestamp);
};

export const updateOutreachNote = (
  jobId: string,
  username: string,
  noteText: string
): void => {
  const db = ensureDb();
  db.prepare(`
    UPDATE research_outreach_notes
    SET note_text = ?
    WHERE job_id = ? AND username = ?
  `).run(noteText, jobId, username);
};

export const insertOutreachMessage = (record: {
  id: string;
  username: string;
  status: OutreachMessageStatus;
  subject: string;
  body: string;
  suggestedChannel: string;
  leadScore: number;
  redditMessageFullname: string | null;
  errorMessage: string | null;
}): void => {
  const db = ensureDb();
  db.prepare(`
    INSERT INTO research_outreach_messages
    (id, username, status, subject, body, suggested_channel, lead_score, reddit_message_fullname, error_message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id,
    record.username,
    record.status,
    record.subject,
    record.body,
    record.suggestedChannel,
    record.leadScore,
    record.redditMessageFullname,
    record.errorMessage,
    new Date().toISOString()
  );
};

export const upsertOutreachReply = (record: {
  redditReplyFullname: string;
  username: string;
  redditParentFullname: string | null;
  subject: string;
  body: string;
  createdUtc: number;
}): boolean => {
  const db = ensureDb();
  const result = db.prepare(`
    INSERT OR IGNORE INTO research_outreach_replies
    (reddit_reply_fullname, username, reddit_parent_fullname, subject, body, created_utc, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.redditReplyFullname,
    record.username,
    record.redditParentFullname,
    record.subject,
    record.body,
    record.createdUtc,
    new Date().toISOString()
  );
  return result.changes > 0;
};

export const listOutreachSentMessages = (
  limit: number = 500
): Array<{
  username: string;
  redditMessageFullname: string;
  subject: string;
  createdAt: string;
}> => {
  const db = ensureDb();
  const rows = db.prepare(`
    SELECT username, reddit_message_fullname, subject, created_at
    FROM research_outreach_messages
    WHERE status = 'sent' AND reddit_message_fullname IS NOT NULL
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    username: String(row.username),
    redditMessageFullname: String(row.reddit_message_fullname),
    subject: String(row.subject),
    createdAt: String(row.created_at),
  }));
};

export const getOutreachSummaryByUsernames = (
  usernames: string[]
): Map<string, {
  outreachStatus: OutreachStatus;
  lastSentAt: string | null;
  lastReplyAt: string | null;
  replyCount: number;
  lastReplyExcerpt: string;
}> => {
  const summary = new Map<string, {
    outreachStatus: OutreachStatus;
    lastSentAt: string | null;
    lastReplyAt: string | null;
    replyCount: number;
    lastReplyExcerpt: string;
  }>();

  if (usernames.length === 0) return summary;

  const db = ensureDb();
  const placeholders = usernames.map(() => '?').join(', ');

  const latestMessageRows = db.prepare(`
    SELECT username, status, created_at
    FROM (
      SELECT username, status, created_at,
             ROW_NUMBER() OVER (PARTITION BY username ORDER BY created_at DESC) AS rn
      FROM research_outreach_messages
      WHERE username IN (${placeholders})
    ) ranked
    WHERE rn = 1
  `).all(...usernames) as Array<Record<string, unknown>>;

  const replyRows = db.prepare(`
    SELECT username,
           COUNT(*) AS reply_count,
           MAX(created_at) AS last_reply_at,
           (
             SELECT substr(r2.body, 1, 140)
             FROM research_outreach_replies r2
             WHERE r2.username = r.username
             ORDER BY r2.created_utc DESC, r2.created_at DESC
             LIMIT 1
           ) AS last_reply_excerpt
    FROM research_outreach_replies r
    WHERE username IN (${placeholders})
    GROUP BY username
  `).all(...usernames) as Array<Record<string, unknown>>;

  for (const username of usernames) {
    summary.set(username, {
      outreachStatus: 'not_contacted',
      lastSentAt: null,
      lastReplyAt: null,
      replyCount: 0,
      lastReplyExcerpt: '',
    });
  }

  for (const row of latestMessageRows) {
    const username = String(row.username);
    const current = summary.get(username);
    if (!current) continue;
    const status = String(row.status) === 'failed' ? 'failed' : 'sent';
    summary.set(username, {
      ...current,
      outreachStatus: status,
      lastSentAt: row.created_at ? String(row.created_at) : null,
    });
  }

  for (const row of replyRows) {
    const username = String(row.username);
    const current = summary.get(username);
    if (!current) continue;
    const replyCount = Number(row.reply_count ?? 0);
    summary.set(username, {
      ...current,
      outreachStatus: replyCount > 0 ? 'replied' : current.outreachStatus,
      lastReplyAt: row.last_reply_at ? String(row.last_reply_at) : null,
      replyCount,
      lastReplyExcerpt: String(row.last_reply_excerpt ?? ''),
    });
  }

  return summary;
};

const addOutreachSummary = (rows: ResearchCandidate[]): ResearchCandidate[] => {
  const usernames = rows.map((row) => row.username);
  const summary = getOutreachSummaryByUsernames(usernames);
  return rows.map((row) => {
    const outreach = summary.get(row.username);
    if (!outreach) return row;
    return {
      ...row,
      outreachStatus: outreach.outreachStatus,
      lastSentAt: outreach.lastSentAt,
      lastReplyAt: outreach.lastReplyAt,
      replyCount: outreach.replyCount,
      lastReplyExcerpt: outreach.lastReplyExcerpt,
    };
  });
};

// ---------------------------------------------------------------------------
// Candidate query
// ---------------------------------------------------------------------------

export const queryCandidates = (
  jobId: string,
  query: ResearchResultsQuery
): { total: number; rows: ResearchCandidate[] } => {
  const db = ensureDb();
  const conditions = ['p.job_id = ?', 'p.overall_score >= ?', 'p.subreddits_count >= ?'];
  const values: Array<string | number> = [jobId, query.minScore, query.minSubreddits];
  if (query.duplicateOnly) {
    conditions.push('p.cluster_count >= 1');
  }
  if (query.nsfwOnly) {
    conditions.push(`json_extract(p.evidence_json, '$.hasNsfw') = 1`);
  }
  const where = conditions.join(' AND ');
  const totalRow = db.prepare(`
    SELECT COUNT(*) AS count
    FROM research_user_patterns p
    LEFT JOIN research_user_profiles up ON up.job_id = p.job_id AND up.username = p.username
    LEFT JOIN research_outreach_notes n ON n.job_id = p.job_id AND n.username = p.username
    WHERE ${where}
  `).get(...values) as { count: number };
  const offset = (query.page - 1) * query.pageSize;
  const rows = db.prepare(`
    SELECT p.*, up.has_profile_image, up.profile_posts_public, up.total_posts_scanned, n.suggested_channel, n.note_text
    FROM research_user_patterns p
    LEFT JOIN research_user_profiles up ON up.job_id = p.job_id AND up.username = p.username
    LEFT JOIN research_outreach_notes n ON n.job_id = p.job_id AND n.username = p.username
    WHERE ${where}
    ORDER BY p.overall_score DESC
    LIMIT ? OFFSET ?
  `).all(...values, query.pageSize, offset) as Array<Record<string, unknown>>;
  return {
    total: totalRow?.count ?? 0,
    rows: addOutreachSummary(rows.map((row) => ({
      username: String(row.username),
      frequencyScore: Number(row.frequency_score),
      duplicateScore: Number(row.duplicate_score),
      crossSubredditScore: Number(row.cross_subreddit_score),
      overallScore: Number(row.overall_score),
      clusterCount: Number(row.cluster_count),
      maxClusterSize: Number(row.max_cluster_size),
      totalDuplicatePosts: Number(row.total_duplicate_posts ?? 0),
      avgClusterSize: Number(row.avg_cluster_size ?? 0),
      subredditsCount: Number(row.subreddits_count),
      hasProfileImage: Number(row.has_profile_image ?? 0) === 1,
      profilePostsPublic: Number(row.profile_posts_public ?? 0) === 1,
      totalPostsScanned: Number(row.total_posts_scanned ?? 0),
      evidence: JSON.parse(String(row.evidence_json)) as PatternEvidence,
      suggestedChannel: String(row.suggested_channel ?? ''),
      noteText: String(row.note_text ?? ''),
    }))),
  };
};

// ---------------------------------------------------------------------------
// Cross-job caching helpers
// ---------------------------------------------------------------------------

/** Copy posts for the given subreddits from ALL previous jobs into the target job. */
export const copyPostsFromPreviousJobs = (
  targetJobId: string,
  subreddits: string[]
): number => {
  if (subreddits.length === 0) return 0;
  const db = ensureDb();
  const placeholders = subreddits.map(() => '?').join(', ');
  const lowerSubreddits = subreddits.map((s) => s.toLowerCase());
  const result = db.prepare(`
    INSERT OR IGNORE INTO research_subreddit_posts
      (job_id, subreddit, post_id, author, title, normalized_title, url, created_utc, is_nsfw, crosspost_parent, score, num_comments, upvote_ratio, engagement_synced_at)
    SELECT ?, subreddit, post_id, author, title, normalized_title, url, created_utc, is_nsfw, crosspost_parent, score, num_comments, upvote_ratio, engagement_synced_at
    FROM research_subreddit_posts
    WHERE job_id != ? AND LOWER(subreddit) IN (${placeholders})
  `).run(targetJobId, targetJobId, ...lowerSubreddits);
  return result.changes;
};

/** Copy user profiles (with submissions_json) from ALL previous jobs into the target job.
 *  For each username, picks the row with the highest total_posts_scanned.
 *  Includes users with 0 posts (private profiles) so they aren't re-fetched. */
export const copyProfilesFromPreviousJobs = (
  targetJobId: string,
  usernames: string[]
): number => {
  if (usernames.length === 0) return 0;
  const db = ensureDb();
  const batchSize = 500;
  let totalCopied = 0;
  for (let i = 0; i < usernames.length; i += batchSize) {
    const batch = usernames.slice(i, i + batchSize);
    const placeholders = batch.map(() => '?').join(', ');
    const result = db.prepare(`
      INSERT OR IGNORE INTO research_user_profiles
        (job_id, username, has_profile_image, profile_posts_public, total_posts_scanned, first_seen_utc, last_seen_utc, submissions_json)
      SELECT ?, p.username, p.has_profile_image, p.profile_posts_public, p.total_posts_scanned, p.first_seen_utc, p.last_seen_utc, p.submissions_json
      FROM research_user_profiles p
      INNER JOIN (
        SELECT username, MAX(total_posts_scanned) AS max_scanned
        FROM research_user_profiles
        WHERE job_id != ? AND username IN (${placeholders})
        GROUP BY username
      ) best ON p.username = best.username AND p.total_posts_scanned = best.max_scanned
      WHERE p.job_id != ?
      GROUP BY p.username
    `).run(targetJobId, targetJobId, ...batch, targetJobId);
    totalCopied += result.changes;
  }
  return totalCopied;
};

// ---------------------------------------------------------------------------
// Step output query helpers
// ---------------------------------------------------------------------------

/** Per-subreddit post count summary for Step 1 output. */
export const getPostsSummaryBySubreddit = (
  jobId: string
): Array<{ subreddit: string; postCount: number }> => {
  const db = ensureDb();
  const rows = db.prepare(`
    SELECT subreddit, COUNT(*) AS count
    FROM research_subreddit_posts
    WHERE job_id = ?
    GROUP BY subreddit
    ORDER BY count DESC
  `).all(jobId) as Array<{ subreddit: string; count: number }>;
  return rows.map((r) => ({ subreddit: r.subreddit, postCount: r.count }));
};

/** Paginated list of profiled users for Step 2 output. */
export const getProfilesList = (
  jobId: string,
  page: number,
  pageSize: number
): { total: number; rows: Array<{ username: string; hasProfileImage: boolean; profilePostsPublic: boolean; totalPostsScanned: number }> } => {
  const db = ensureDb();
  const totalRow = db.prepare(
    'SELECT COUNT(*) AS count FROM research_user_profiles WHERE job_id = ?'
  ).get(jobId) as { count: number };
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(`
    SELECT username, has_profile_image, profile_posts_public, total_posts_scanned
    FROM research_user_profiles
    WHERE job_id = ?
    ORDER BY total_posts_scanned DESC, username ASC
    LIMIT ? OFFSET ?
  `).all(jobId, pageSize, offset) as Array<Record<string, unknown>>;
  return {
    total: totalRow?.count ?? 0,
    rows: rows.map((r) => ({
      username: String(r.username),
      hasProfileImage: Number(r.has_profile_image) === 1,
      profilePostsPublic: Number(r.profile_posts_public) === 1,
      totalPostsScanned: Number(r.total_posts_scanned),
    })),
  };
};

// ---------------------------------------------------------------------------
// Subreddit Discovery
// ---------------------------------------------------------------------------

/**
 * Extract subreddits from all profiled users' submissions for a given job.
 * Returns subs where 2+ distinct users posted, excluding subs already in
 * the job config. Each result includes user count, post count, and NSFW flag.
 */
export const getDiscoveredSubreddits = (
  jobId: string,
  configSubreddits: string[]
): Array<{ subreddit: string; userCount: number; postCount: number; isNsfw: boolean }> => {
  const db = ensureDb();
  const rows = db
    .prepare(
      'SELECT username, submissions_json FROM research_user_profiles WHERE job_id = ? AND submissions_json IS NOT NULL'
    )
    .all(jobId) as Array<{ username: string; submissions_json: string }>;

  const configSet = new Set(configSubreddits.map((s) => s.toLowerCase()));

  // Aggregate: subreddit → { users: Set<string>, posts: number, nsfw: boolean }
  const subMap = new Map<string, { users: Set<string>; posts: number; nsfw: boolean }>();

  for (const row of rows) {
    try {
      const submissions = JSON.parse(row.submissions_json) as Array<{
        subreddit: string;
        over18?: boolean;
      }>;
      for (const sub of submissions) {
        const subName = sub.subreddit;
        if (!subName) continue;
        if (configSet.has(subName.toLowerCase())) continue;

        let entry = subMap.get(subName);
        if (!entry) {
          entry = { users: new Set(), posts: 0, nsfw: false };
          subMap.set(subName, entry);
        }
        entry.users.add(row.username);
        entry.posts += 1;
        if (sub.over18) entry.nsfw = true;
      }
    } catch {
      // Corrupted JSON, skip
    }
  }

  // Filter to 2+ users, sort by user count descending
  return Array.from(subMap.entries())
    .filter(([, v]) => v.users.size >= 2)
    .map(([subreddit, v]) => ({
      subreddit,
      userCount: v.users.size,
      postCount: v.posts,
      isNsfw: v.nsfw,
    }))
    .sort((a, b) => b.userCount - a.userCount || b.postCount - a.postCount);
};

/**
 * Update the config_json column for a research job.
 * Used to add newly discovered subreddits to the scan list.
 */
export const updateJobConfig = (jobId: string, config: ResearchJobConfig): void => {
  const db = ensureDb();
  db.prepare('UPDATE research_jobs SET config_json = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(config),
    new Date().toISOString(),
    jobId
  );
};

/** Copy the best profile for specific users from ANY other job into the target job.
 *  Returns the count of profiles actually copied. Used as a targeted fill when
 *  global dedup detects users that exist in other jobs but not in the current one. */
export const copyMissingProfiles = (
  targetJobId: string,
  usernames: string[]
): number => {
  if (usernames.length === 0) return 0;
  const db = ensureDb();
  const batchSize = 500;
  let totalCopied = 0;
  for (let i = 0; i < usernames.length; i += batchSize) {
    const batch = usernames.slice(i, i + batchSize);
    const placeholders = batch.map(() => '?').join(', ');
    const result = db.prepare(`
      INSERT OR IGNORE INTO research_user_profiles
        (job_id, username, has_profile_image, profile_posts_public, total_posts_scanned, first_seen_utc, last_seen_utc, submissions_json)
      SELECT ?, p.username, p.has_profile_image, p.profile_posts_public, p.total_posts_scanned, p.first_seen_utc, p.last_seen_utc, p.submissions_json
      FROM research_user_profiles p
      INNER JOIN (
        SELECT username, MAX(total_posts_scanned) AS max_scanned
        FROM research_user_profiles
        WHERE job_id != ? AND username IN (${placeholders})
        GROUP BY username
      ) best ON p.username = best.username AND p.total_posts_scanned = best.max_scanned
      WHERE p.job_id != ?
      GROUP BY p.username
    `).run(targetJobId, targetJobId, ...batch, targetJobId);
    totalCopied += result.changes;
  }
  return totalCopied;
};

export const getResearchDbPath = (): string => DB_PATH;

// ---------------------------------------------------------------------------
// Workspace-level helpers (global, not job-scoped)
// ---------------------------------------------------------------------------

export const getWorkspaceState = (key: string): string | null => {
  const db = ensureDb();
  const row = db.prepare('SELECT value FROM research_workspace_state WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
};

export const setWorkspaceState = (key: string, value: string): void => {
  const db = ensureDb();
  db.prepare('INSERT INTO research_workspace_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
};

export const getOutreachTemplate = (): OutreachTemplate => ({
  subjectTemplate: getWorkspaceState('outreach_template_subject') ?? DEFAULT_OUTREACH_SUBJECT,
  bodyTemplate: getWorkspaceState('outreach_template_body') ?? DEFAULT_OUTREACH_BODY,
});

export const updateOutreachTemplate = (template: OutreachTemplate): OutreachTemplate => {
  setWorkspaceState('outreach_template_subject', template.subjectTemplate);
  setWorkspaceState('outreach_template_body', template.bodyTemplate);
  return getOutreachTemplate();
};

export const getActiveJobId = (): string | null => getWorkspaceState('active_job_id');

export const setActiveJobId = (jobId: string): void => setWorkspaceState('active_job_id', jobId);

/** Return the full master subreddit list. */
export const getWorkspaceSubreddits = (): Array<{
  subreddit: string;
  addedAt: string;
  scanStatus: 'scanned' | 'pending';
  lastScannedAt: string | null;
  postCount: number;
}> => {
  const db = ensureDb();
  const rows = db.prepare('SELECT * FROM research_workspace_subreddits ORDER BY added_at DESC').all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    subreddit: String(r.subreddit),
    addedAt: String(r.added_at),
    scanStatus: r.scan_status === 'scanned' ? 'scanned' as const : 'pending' as const,
    lastScannedAt: r.last_scanned_at ? String(r.last_scanned_at) : null,
    postCount: Number(r.post_count ?? 0),
  }));
};

/** Add subreddits to the workspace master list (idempotent). Returns count of newly added. */
export const addWorkspaceSubreddits = (subreddits: string[]): number => {
  const db = ensureDb();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO research_workspace_subreddits (subreddit, added_at, scan_status, post_count)
     VALUES (?, datetime('now'), 'pending', 0)`
  );
  let added = 0;
  for (const sub of subreddits) {
    const result = stmt.run(sub);
    if (result.changes > 0) added += 1;
  }
  return added;
};

/** Remove a subreddit from the workspace master list. */
export const removeWorkspaceSubreddit = (subreddit: string): void => {
  const db = ensureDb();
  db.prepare('DELETE FROM research_workspace_subreddits WHERE LOWER(subreddit) = LOWER(?)').run(subreddit);
};

/** Mark a workspace subreddit as scanned and update its post count. */
export const markWorkspaceSubredditScanned = (subreddit: string, postCount: number): void => {
  const db = ensureDb();
  db.prepare(
    `UPDATE research_workspace_subreddits
     SET scan_status = 'scanned', last_scanned_at = datetime('now'), post_count = ?
     WHERE LOWER(subreddit) = LOWER(?)`
  ).run(postCount, subreddit);
};

/** Aggregate stats across ALL jobs for the workspace dashboard. */
export const getWorkspaceStats = (): {
  totalSubreddits: number;
  pendingSubreddits: number;
  totalPosts: number;
  totalProfiles: number;
  totalCandidates: number;
  lastScanAt: string | null;
} => {
  const db = ensureDb();

  const subStats = db.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN scan_status = 'pending' THEN 1 ELSE 0 END) AS pending
     FROM research_workspace_subreddits`
  ).get() as { total: number; pending: number };

  const postCount = db.prepare(
    'SELECT COUNT(DISTINCT post_id) AS count FROM research_subreddit_posts'
  ).get() as { count: number };

  const profileCount = db.prepare(
    `SELECT COUNT(DISTINCT username) AS count
     FROM research_user_profiles
     WHERE total_posts_scanned > 0`
  ).get() as { count: number };

  const candidateCount = db.prepare(
    'SELECT COUNT(DISTINCT username) AS count FROM research_user_patterns'
  ).get() as { count: number };

  const lastScan = db.prepare(
    `SELECT MAX(last_scanned_at) AS ts FROM research_workspace_subreddits WHERE last_scanned_at IS NOT NULL`
  ).get() as { ts: string | null };

  return {
    totalSubreddits: subStats?.total ?? 0,
    pendingSubreddits: subStats?.pending ?? 0,
    totalPosts: postCount?.count ?? 0,
    totalProfiles: profileCount?.count ?? 0,
    totalCandidates: candidateCount?.count ?? 0,
    lastScanAt: lastScan?.ts ?? null,
  };
};

/** Aggregated profiles across all jobs — best profile per user. */
export const getGlobalProfilesList = (
  page: number,
  pageSize: number
): { total: number; rows: Array<{ username: string; hasProfileImage: boolean; profilePostsPublic: boolean; totalPostsScanned: number }> } => {
  const db = ensureDb();
  const totalRow = db.prepare(
    'SELECT COUNT(DISTINCT username) AS count FROM research_user_profiles WHERE total_posts_scanned > 0'
  ).get() as { count: number };
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(`
    SELECT p.username, p.has_profile_image, p.profile_posts_public, p.total_posts_scanned
    FROM research_user_profiles p
    INNER JOIN (
      SELECT username, MAX(total_posts_scanned) AS max_scanned
      FROM research_user_profiles
      GROUP BY username
    ) best ON p.username = best.username AND p.total_posts_scanned = best.max_scanned
    WHERE p.total_posts_scanned > 0
    GROUP BY p.username
    ORDER BY p.total_posts_scanned DESC, p.username ASC
    LIMIT ? OFFSET ?
  `).all(pageSize, offset) as Array<Record<string, unknown>>;
  return {
    total: totalRow?.count ?? 0,
    rows: rows.map((r) => ({
      username: String(r.username),
      hasProfileImage: Number(r.has_profile_image) === 1,
      profilePostsPublic: Number(r.profile_posts_public) === 1,
      totalPostsScanned: Number(r.total_posts_scanned),
    })),
  };
};

/** Aggregated results across all jobs — best pattern per user. */
export const queryGlobalCandidates = (
  query: ResearchResultsQuery
): { total: number; rows: ResearchCandidate[] } => {
  const db = ensureDb();
  const conditions = ['agg.overall_score >= ?', 'agg.subreddits_count >= ?'];
  const values: Array<string | number> = [query.minScore, query.minSubreddits];
  if (query.duplicateOnly) conditions.push('agg.cluster_count >= 1');
  if (query.nsfwOnly) conditions.push(`json_extract(agg.evidence_json, '$.hasNsfw') = 1`);
  const where = conditions.join(' AND ');

  const totalRow = db.prepare(`
    SELECT COUNT(*) AS count FROM (
      SELECT p.username, MAX(p.overall_score) AS overall_score, p.subreddits_count, p.cluster_count, p.evidence_json
      FROM research_user_patterns p
      GROUP BY p.username
    ) agg WHERE ${where}
  `).get(...values) as { count: number };

  const offset = (query.page - 1) * query.pageSize;
  const rows = db.prepare(`
    SELECT agg.*, up.has_profile_image, up.profile_posts_public, up.total_posts_scanned, n.suggested_channel, n.note_text
    FROM (
      SELECT p.*,
             ROW_NUMBER() OVER (PARTITION BY p.username ORDER BY p.overall_score DESC) AS rn
      FROM research_user_patterns p
    ) agg
    LEFT JOIN (
      SELECT username, has_profile_image, profile_posts_public, total_posts_scanned,
             ROW_NUMBER() OVER (PARTITION BY username ORDER BY total_posts_scanned DESC) AS rn
      FROM research_user_profiles
    ) up ON up.username = agg.username AND up.rn = 1
    LEFT JOIN (
      SELECT username, suggested_channel, note_text,
             ROW_NUMBER() OVER (PARTITION BY username ORDER BY created_at DESC) AS rn
      FROM research_outreach_notes
    ) n ON n.username = agg.username AND n.rn = 1
    WHERE agg.rn = 1 AND ${where}
    ORDER BY agg.overall_score DESC
    LIMIT ? OFFSET ?
  `).all(...values, query.pageSize, offset) as Array<Record<string, unknown>>;

  return {
    total: totalRow?.count ?? 0,
    rows: addOutreachSummary(rows.map((row) => ({
      username: String(row.username),
      frequencyScore: Number(row.frequency_score),
      duplicateScore: Number(row.duplicate_score),
      crossSubredditScore: Number(row.cross_subreddit_score),
      overallScore: Number(row.overall_score),
      clusterCount: Number(row.cluster_count),
      maxClusterSize: Number(row.max_cluster_size),
      totalDuplicatePosts: Number(row.total_duplicate_posts ?? 0),
      avgClusterSize: Number(row.avg_cluster_size ?? 0),
      subredditsCount: Number(row.subreddits_count),
      hasProfileImage: Number(row.has_profile_image ?? 0) === 1,
      profilePostsPublic: Number(row.profile_posts_public ?? 0) === 1,
      totalPostsScanned: Number(row.total_posts_scanned ?? 0),
      evidence: JSON.parse(String(row.evidence_json || '{}')) as PatternEvidence,
      suggestedChannel: String(row.suggested_channel ?? ''),
      noteText: String(row.note_text ?? ''),
    }))),
  };
};

/** Global discovered subreddits — from ALL profiled users across ALL jobs. */
export const getGlobalDiscoveredSubreddits = (
  excludeSubreddits: string[]
): Array<{ subreddit: string; userCount: number; postCount: number; isNsfw: boolean }> => {
  const db = ensureDb();
  const rows = db.prepare(`
    SELECT p.username, p.submissions_json
    FROM research_user_profiles p
    INNER JOIN (
      SELECT username, MAX(total_posts_scanned) AS max_scanned
      FROM research_user_profiles
      WHERE submissions_json IS NOT NULL
      GROUP BY username
    ) best ON p.username = best.username AND p.total_posts_scanned = best.max_scanned
    WHERE p.submissions_json IS NOT NULL
    GROUP BY p.username
  `).all() as Array<{ username: string; submissions_json: string }>;

  const excludeSet = new Set(excludeSubreddits.map((s) => s.toLowerCase()));
  const subMap = new Map<string, { users: Set<string>; posts: number; nsfw: boolean }>();

  for (const row of rows) {
    try {
      const submissions = JSON.parse(row.submissions_json) as Array<{ subreddit: string; over18?: boolean }>;
      for (const sub of submissions) {
        const subName = sub.subreddit;
        if (!subName || excludeSet.has(subName.toLowerCase())) continue;
        let entry = subMap.get(subName);
        if (!entry) {
          entry = { users: new Set(), posts: 0, nsfw: false };
          subMap.set(subName, entry);
        }
        entry.users.add(row.username);
        entry.posts += 1;
        if (sub.over18) entry.nsfw = true;
      }
    } catch { /* corrupted JSON, skip */ }
  }

  return Array.from(subMap.entries())
    .filter(([, v]) => v.users.size >= 2)
    .map(([subreddit, v]) => ({ subreddit, userCount: v.users.size, postCount: v.posts, isNsfw: v.nsfw }))
    .sort((a, b) => b.userCount - a.userCount || b.postCount - a.postCount);
};
