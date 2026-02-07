# Codebase Practices & Module Structure

This document defines readability, modularity, and structure rules tailored to this repository.

## Goals

- Keep files small, readable, and purpose-specific.
- Separate UI, business logic, and data access.
- Make feature ownership obvious from paths and exports.
- Ensure new code matches existing UI patterns (Tailwind + shadcn/ui).

## Current Layout (Summary)

- `pages/` (Next.js Pages Router; screen composition + API routes under `pages/api/`)
- `components/` (UI + feature components, including `components/posting-queue/`, `components/settings/`, `components/admin/`)
- `hooks/` (domain hooks, e.g. `useQueueJob`, `useSubreddits`)
- `lib/` (services, API helpers, validation, queue logic)
- `contexts/` (global state providers)
- `types/` (shared types)
- `utils/` (shared pure helpers)

## Target Structure (What To Aim For)

Keep the current structure but enforce per-feature boundaries. For each feature:

- `components/<feature>/` contains **presentational UI only**.
- `hooks/<feature>/` contains **business logic** and state orchestration.
- `lib/<feature>/` contains **pure utilities**, parsing, validation, and IO-free helpers.
- `types/<feature>.ts` contains **shared types**.
- `components/<feature>/index.ts` exports the public UI surface.

Example for posting queue:

- `components/posting-queue/` UI only (no data fetch, no mutation)
- `hooks/posting-queue/` queue state, retry flows, validation orchestration
- `lib/posting-queue/` pure queue helpers and formatting
- `types/posting-queue.ts` shared types

## Readability Rules (Repository-Specific)

- **File size**: soft limit `200` lines, hard limit `300` lines.
- **One primary purpose per file** (e.g. “UI panel”, “hook”, “API handler”).
- **Early returns** for clarity.
- **No side effects in render**.
- **No API calls inside JSX**.
- **No business logic in render** (derive data before JSX).
- **Use Tailwind + shadcn/ui only** for styling.
- **Avoid custom UI components** when shadcn equivalents exist.

## Screen Composition (pages/)

Each `pages/*.tsx` should:

- Compose UI from feature components.
- Delegate all data fetching to hooks in `hooks/`.
- Avoid inline data transformations; move them to `lib/` or hooks.

## Hooks (hooks/)

- Hooks own state, orchestration, and side effects.
- Hooks should return **shape-stable** objects: `{ data, status, actions }`.
- Prefer isolated hooks per feature over giant “mega hooks.”

## Services & Data Access (lib/)

- `lib/api/*` should be the only place that directly talks to external services (Reddit, Supabase, payments).
- `pages/api/*` should be thin: parse input, call lib service, return response.
- Validation belongs in `lib/` (pure functions), not in page components.

## Components (components/)

- Presentational only.
- Accept data via props, emit events via callbacks.
- No IO, no fetching, no mutation.

## Exports & Imports

- Prefer `index.ts` barrel exports per feature folder.
- Avoid deep imports like `components/posting-queue/QueueProgressList`.
- Centralize shared types in `types/` and import from there.

## Priority Refactor Targets (By Size)

These files exceed the soft limit and should be split first:

- `components/PostingQueue.tsx` (~1050 lines)
- `pages/index.tsx` (~920 lines)
- `components/subreddit-picker/SubredditRow.tsx` (~640 lines)
- `components/SubredditFlairPicker.tsx` (~580 lines)
- `components/PwaOnboarding.tsx` (~560 lines)
- `pages/checkout/index.tsx` (~480 lines)
- `components/admin/UserManagementTab.tsx` (~470 lines)
- `pages/settings.tsx` (~470 lines)

Target outcome for each:

- Extract UI subcomponents into `components/<feature>/`.
- Move data/state orchestration to `hooks/<feature>/`.
- Move pure helpers to `lib/<feature>/`.
- Move shared types to `types/<feature>.ts`.

## Checklist For New Work

- [ ] File under 200 lines (or have a strong reason not to).
- [ ] UI is presentational, logic is in hooks, IO in lib.
- [ ] No inline styles, Tailwind only.
- [ ] Use existing shadcn/ui components.
- [ ] Types are explicit and shared from `types/`.
