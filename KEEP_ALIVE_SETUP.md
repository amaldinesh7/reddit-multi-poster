# Supabase Keep-Alive Setup

Supabase free tier projects pause after **7 days of inactivity**. This guide shows you how to keep your Supabase instance active automatically.

## Solution Overview

We've created a keep-alive API endpoint (`/api/keep-alive`) that performs a lightweight database query to prevent your Supabase instance from pausing.

## Quick Setup

### 1. Add Environment Variable (Optional but Recommended)

Add a secret token to prevent unauthorized access to your keep-alive endpoint:

```env
# .env.local (for local) or your hosting platform's environment variables
KEEP_ALIVE_SECRET=your-random-secret-token-here
```

Generate a secure token:
```bash
# On macOS/Linux
openssl rand -hex 32

# Or use any random string generator
```

### 2. Choose a Cron Service

Pick one of the following options to call the endpoint periodically:

---

## Option 1: Vercel Cron Jobs (Recommended if using Vercel)

If you're deploying on Vercel, use their built-in cron jobs.

### Step 1: Create `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/keep-alive?secret=YOUR_SECRET_HERE",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

**Schedule Explanation:**
- `0 */6 * * *` = Every 6 hours (runs 4 times per day)
- `0 0 */6 * *` = Every 6 days at midnight
- `0 0 * * 0` = Every Sunday at midnight

**Recommendation:** Use `0 */6 * * *` (every 6 hours) to be safe, or `0 0 */6 * *` (every 6 days) to match Supabase's 7-day inactivity threshold.

### Step 2: Deploy

Just push to your repository. Vercel will automatically set up the cron job.

---

## Option 2: GitHub Actions (Free & Reliable)

Create a GitHub Actions workflow that runs on a schedule.

### Step 1: Create `.github/workflows/keep-alive.yml`

```yaml
name: Supabase Keep-Alive

on:
  schedule:
    # Run every 6 days at 2 AM UTC
    - cron: '0 2 */6 * *'
  workflow_dispatch: # Allows manual triggering

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Keep-Alive Endpoint
        run: |
          curl -X GET "${{ secrets.KEEP_ALIVE_URL }}?secret=${{ secrets.KEEP_ALIVE_SECRET }}"
```

### Step 2: Add GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions, and add:

- `KEEP_ALIVE_URL`: Your full endpoint URL (e.g., `https://yourdomain.com/api/keep-alive`)
- `KEEP_ALIVE_SECRET`: Your secret token (same as `KEEP_ALIVE_SECRET` env var)

### Step 3: Commit and Push

The workflow will run automatically on the schedule.

---

## Option 3: External Cron Services (Universal Solution)

Use a free external service to ping your endpoint.

### cron-job.org (Free)

1. Sign up at [cron-job.org](https://cron-job.org)
2. Create a new cron job:
   - **URL**: `https://yourdomain.com/api/keep-alive?secret=YOUR_SECRET`
   - **Schedule**: Every 6 days
   - **Request Method**: GET
3. Save and activate

### EasyCron (Free Tier Available)

1. Sign up at [EasyCron](https://www.easycron.com)
2. Create a new cron job with similar settings
3. Set schedule to run every 6 days

### UptimeRobot (Free - 50 monitors)

1. Sign up at [UptimeRobot](https://uptimerobot.com)
2. Add a new monitor:
   - **Type**: HTTP(s)
   - **URL**: `https://yourdomain.com/api/keep-alive?secret=YOUR_SECRET`
   - **Interval**: 6 days (or use their minimum interval and it will keep it active)

---

## Option 4: Manual Testing

Test the endpoint manually:

```bash
# Without secret
curl https://yourdomain.com/api/keep-alive

# With secret (if configured)
curl "https://yourdomain.com/api/keep-alive?secret=YOUR_SECRET"
```

Expected response:
```json
{
  "success": true,
  "message": "Supabase keep-alive successful",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "database": "active"
}
```

---

## Recommended Schedule

- **Minimum**: Every 6 days (to stay under the 7-day threshold)
- **Safe**: Every 3-4 days (gives you a buffer)
- **Very Safe**: Every 6 hours (ensures constant activity)

## Troubleshooting

### Endpoint Returns 401 Unauthorized
- Make sure `KEEP_ALIVE_SECRET` is set in your environment variables
- Ensure the secret in your cron job matches the environment variable

### Endpoint Returns 500 Error
- Check your Supabase environment variables are configured correctly
- Verify your Supabase project is not paused (you may need to manually wake it up first)
- Check your hosting platform's logs for detailed error messages

### Supabase Still Pauses
- Verify the cron job is actually running (check logs)
- Make sure the endpoint URL is correct and accessible
- Try reducing the interval (e.g., every 3 days instead of 6)

## Security Notes

- The keep-alive endpoint uses a secret token to prevent abuse
- If you don't set `KEEP_ALIVE_SECRET`, the endpoint will work but be publicly accessible
- For production, always use a secret token
- Consider using your hosting platform's environment variables for secrets

## Cost

- **Free**: All solutions above are free
- **Vercel Cron**: Free on all plans
- **GitHub Actions**: Free for public repos, 2000 minutes/month for private repos
- **External Services**: Free tiers available

---

## Quick Start Checklist

- [ ] Add `KEEP_ALIVE_SECRET` to your environment variables
- [ ] Choose a cron service (Vercel, GitHub Actions, or external)
- [ ] Set up the cron job to run every 6 days (or more frequently)
- [ ] Test the endpoint manually to verify it works
- [ ] Monitor the first few runs to ensure it's working

Your Supabase instance will now stay active! 🎉
