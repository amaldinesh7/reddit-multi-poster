# Reddit Multi-Poster

A web application that lets you post the same content to multiple Reddit communities at once, with automatic scheduling to respect Reddit's posting limits.

## What It Does

- **Upload Once, Post Everywhere**: Upload an image or paste a URL and post it to up to 30 different subreddits with a single click
- **Smart Scheduling**: Automatically spaces out your posts with 15-minute delays between each subreddit to avoid spam detection
- **Flair Management**: Automatically selects appropriate flairs for each subreddit, or lets you customize them
- **Queue System**: Shows you the status of all your posts in real-time as they're being submitted
- **Reddit OAuth**: Securely connects to your Reddit account - no password storage required

## How To Use

1. **Login**: Click "Login with Reddit" and authorize the app
2. **Upload Content**: Either upload an image file or paste a URL to content you want to share
3. **Choose Subreddits**: Select which communities you want to post to (the app comes pre-configured with popular subreddits)
4. **Write Your Post**: Add a title/caption for your post (100 character limit)
5. **Configure Options**: 
   - Set custom flairs for specific subreddits
6. **Start Posting**: Hit "Start Posting" and watch as your content gets submitted to each subreddit automatically

## Features

- **Bulk Posting**: Post to multiple subreddits simultaneously
- **Rate Limiting**: Built-in delays prevent you from hitting Reddit's spam filters
- **Flair Detection**: Automatically finds and applies appropriate flairs for each subreddit
- **Progress Tracking**: Real-time status updates for each post in your queue
- **Error Handling**: Shows you which posts succeeded and which failed, with reasons

## Quick Setup

1. Get Reddit API credentials (takes 2 minutes - see SETUP.md for details)
2. Create a `.env.local` file with your credentials
3. Run `npm install` and `npm run dev`
4. Open http://localhost:3000 and start posting!

---

## Local Development with Supabase

This project uses Supabase for data persistence. You can run Supabase locally for development.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed and running
- Node.js 18+ and npm

### Setup Local Supabase

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install supabase --save-dev
   ```

2. **Start Supabase locally**:
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

3. **Configure environment variables** in `.env.local`:
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

### Database Migrations

Migrations are stored in `supabase/migrations/` and are applied automatically when you run:

```bash
# Apply all migrations to local database
npx supabase db reset

# Or just push new migrations without resetting
npx supabase db push
```

**Current migrations:**
- `001_initial_schema.sql` - Core tables (users, categories, user_subreddits, subreddit_cache)
- `002_add_post_requirements.sql` - Adds post_requirements column for Reddit posting rules

### Useful Supabase Commands

```bash
# Check status of local Supabase
npx supabase status

# Stop local Supabase
npx supabase stop

# View database in browser (Supabase Studio)
# Open http://127.0.0.1:54323

# Generate TypeScript types from database schema
npx supabase gen types typescript --local > types/database.ts

# Create a new migration
npx supabase migration new <migration_name>

# View migration history
npx supabase migration list

# Connect to local database via psql
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres
```

### Production Deployment

Migrations are automatically deployed to production via GitHub Actions when you push to `main` branch. See `.github/workflows/deploy-supabase.yml`.

To manually deploy to production:
```bash
# Link to your Supabase project (one-time setup)
npx supabase link --project-ref YOUR_PROJECT_ID

# Push migrations to production
npx supabase db push
```

---

## Perfect For

- Content creators who want to share across multiple communities
- Anyone tired of manually posting the same content to different subreddits
- Users who want to maximize their content's reach while respecting Reddit's rules

---

**Note**: This tool respects Reddit's API terms of service and includes built-in rate limiting to prevent spam. Always follow individual subreddit rules and Reddit's content policy.
