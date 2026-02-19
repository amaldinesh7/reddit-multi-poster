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
3. Enter up to 20 subreddits and start a scan.
4. Polling updates progress in UI.
5. Review candidate table and export CSV.
6. If a run fails (network/rate-limit), start again with the same config:
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

## Notes

- This is for internal research only.
- Messaging/outreach is manual; no automated contact flow is included.
