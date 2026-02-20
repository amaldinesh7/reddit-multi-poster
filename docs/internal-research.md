# Internal Research Miner (Local-Only)

This internal tool scans selected subreddits, analyzes user posting patterns, and outputs candidate users for manual outreach research.

## Safety and exposure

- Tool is disabled by default.
- Routes return `404` unless both flags are enabled:
  - `ENABLE_INTERNAL_RESEARCH=true`
  - `NEXT_PUBLIC_ENABLE_INTERNAL_RESEARCH=true`
- No nav links are added; route is direct URL only.

## Required setup

1. Install dependencies:
   - `npm install`
2. Set local env flags in `.env.local`:
   - `ENABLE_INTERNAL_RESEARCH=true`
   - `NEXT_PUBLIC_ENABLE_INTERNAL_RESEARCH=true`
3. Log in with your dedicated Reddit research account through existing OAuth.

## How to run

1. Start app:
   - `npm run dev`
2. Open:
   - `/internal/research`
3. Enter subreddits in the Subreddits tab.
4. In Pipeline, run **Collect Posts** in predefined batches (`5`, `10`, `20`, `50` pending subreddits per run).
5. Run **Profile Users** and **Score & Rank**.
6. In Results, select leads and send bulk Reddit PM outreach messages.
7. Use **Sync Replies** (manual) to pull inbox replies and update outreach status.
8. Open **Analytics** tab to analyze posting time/frequency and engagement correlations.
9. Click **Refresh Engagement** to backfill missing upvote/comment metrics, then **Recompute**.
10. Polling updates progress in UI.
11. If a run fails (network/rate-limit), start again with the same config:
   - the latest failed/cancelled job is resumed,
   - cached subreddit posts and profiled users are reused.

## Storage

- SQLite database path:
  - `out/internal-research/research.sqlite`
- Primary tables:
  - `research_jobs`
  - `research_subreddit_posts`
  - `research_user_profiles`
  - `research_user_patterns`
  - `research_outreach_notes`
  - `research_outreach_messages`
  - `research_outreach_replies`

## Analytics details

- Analytics is computed in-app from local SQLite data only.
- Controls:
  - `lookbackDays`: `30`, `60`, `90`, `180`
  - `minPostAgeHours`: `12`, `24`, `48`
  - `timezone`: `UTC`, `America/New_York`, `America/Los_Angeles`
  - `minPostsPerUser`: minimum posts required for user-level frequency/correlation
- Correlation method:
  - Spearman rho (non-parametric, robust to non-linear scales)
- Output includes:
  - hourly and day-of-week posting volume
  - hour×day heatmap
  - frequency bins and engagement summary
  - best posting windows
  - caveats when engagement coverage is low
- Engagement refresh:
  - manual only (`/workspace/analytics/refresh`)
  - no background polling or scheduler

## Notes

- This is for internal research only.
- Outreach sending uses Reddit private messages (`/api/compose`) and is manually triggered only.
- Reply tracking is manual sync only (`Sync Replies` button); no background polling.
- OAuth must include `privatemessages` scope for send/sync actions.
