# Development Guide

This document covers local development setup, architecture details, and deployment instructions for Reddit Multi Poster.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Database Setup (Supabase)](#database-setup-supabase)
- [Environment Variables](#environment-variables)
- [Database Migrations](#database-migrations)
- [Useful Commands](#useful-commands)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Deployment](#deployment)

---

## Prerequisites

- **Node.js 18+** and npm
- **Docker** (for local Supabase)
- **Reddit API credentials** ([Get them here](https://www.reddit.com/prefs/apps))

---

## Local Development Setup

```bash
# Clone the repository
git clone https://github.com/amaldinesh7/reddit-multi-poster.git
cd reddit-multi-poster

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Start local Supabase (requires Docker)
npx supabase start

# Apply database migrations
npx supabase db reset

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## Database Setup (Supabase)

This project uses Supabase for data persistence. You can run Supabase locally for development.

### Starting Local Supabase

```bash
npx supabase start
```

This will start all Supabase services (PostgreSQL, Auth, Storage, etc.) in Docker containers.

After starting, you'll see output like:
```
Studio URL: http://127.0.0.1:54323
API URL: http://127.0.0.1:54321
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

### Stopping Supabase

```bash
npx supabase stop
```

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
# Local Supabase
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key-from-supabase-start-output>

# Reddit OAuth (required)
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret
REDDIT_REDIRECT_URI=http://localhost:3000/api/auth/callback
REDDIT_USER_AGENT=reddit-multi-poster/1.0
```

For production environment variables, see [VERCEL_SETUP.md](./VERCEL_SETUP.md).

---

## Database Migrations

Migrations are stored in `supabase/migrations/` and are applied automatically when you run:

```bash
# Apply all migrations to local database (resets data)
npx supabase db reset

# Or just push new migrations without resetting
npx supabase db push
```

### Current Migrations

| Migration | Description |
|-----------|-------------|
| `001_initial_schema.sql` | Core tables (users, categories, user_subreddits, subreddit_cache) |
| `002_add_post_requirements.sql` | Adds post_requirements column for Reddit posting rules |
| `005_add_entitlements.sql` | User entitlements for free/paid tiers |
| `006_add_storage_bucket.sql` | Storage bucket for media uploads |
| `007_fix_queue_jobs_updated_at.sql` | Queue jobs timestamp fix |

### Creating New Migrations

```bash
npx supabase migration new <migration_name>
```

---

## Useful Commands

```bash
# Development
npm run dev                  # Start development server
npm run build                # Build for production
npm run start                # Start production server
npm run lint                 # Run ESLint

# Database
npx supabase status          # Check local Supabase status
npx supabase stop            # Stop local Supabase
npx supabase db reset        # Reset database with migrations
npx supabase db push         # Push migrations without reset
npx supabase migration list  # View migration history

# Type Generation
npx supabase gen types typescript --local > types/database.ts

# Database Access
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres

# Open Supabase Studio (GUI)
# Visit http://127.0.0.1:54323
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14, React 18, TypeScript |
| **Styling** | Tailwind CSS, shadcn/ui components |
| **Backend** | Next.js API Routes |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Reddit OAuth 2.0 |
| **Hosting** | Vercel |
| **Queue** | Custom queue system with Supabase |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Pages     │  │ Components  │  │    Hooks & Contexts     │  │
│  │  - index    │  │ - PostQueue │  │  - useAuth              │  │
│  │  - login    │  │ - MediaUp   │  │  - useQueueJob          │  │
│  │  - settings │  │ - SubPicker │  │  - useFailedPosts       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Routes (/api/*)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │    Auth     │  │   Queue     │  │      Settings           │  │
│  │ - callback  │  │ - submit    │  │  - subreddits           │  │
│  │ - logout    │  │ - status    │  │  - categories           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase (PostgreSQL)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Users     │  │  Queue Jobs │  │    Subreddit Cache      │  │
│  │             │  │             │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Reddit API                               │
│          OAuth 2.0 • Post Submission • Flair Fetching           │
└─────────────────────────────────────────────────────────────────┘
```

### Key Flows

**Posting Flow:**
1. User uploads content and selects subreddits
2. Frontend validates and submits to `/api/queue/submit`
3. Queue job is created in Supabase
4. Posts are submitted to Reddit with 15-min delays
5. Real-time progress updates via polling

**Auth Flow:**
1. User clicks "Continue with Reddit"
2. Redirected to Reddit OAuth consent
3. Callback saves tokens securely in Supabase
4. Session managed via HTTP-only cookies

---

## Deployment

### Vercel (Recommended)

Migrations auto-deploy via GitHub Actions on push to `main`. See `.github/workflows/deploy-supabase.yml`.

For complete Vercel setup, see [VERCEL_SETUP.md](./VERCEL_SETUP.md).

### Manual Supabase Deployment

```bash
# Link to your Supabase project (one-time setup)
npx supabase link --project-ref YOUR_PROJECT_ID

# Push migrations to production
npx supabase db push
```

### Preventing Supabase from Pausing

Supabase free tier projects pause after 7 days of inactivity. This project includes an automatic keep-alive solution using Vercel Cron Jobs.

The `/api/keep-alive` endpoint runs every 6 hours via Vercel Cron to perform a lightweight database query, keeping your Supabase instance active.

See [VERCEL_SETUP.md](./VERCEL_SETUP.md) for setup instructions.

---

## Related Documentation

- [VERCEL_SETUP.md](./VERCEL_SETUP.md) - Vercel deployment & cron setup
- [QUEUE_SETUP.md](./QUEUE_SETUP.md) - Queue system details
- [DODO_PAYMENTS_SETUP.md](./DODO_PAYMENTS_SETUP.md) - Payment integration
