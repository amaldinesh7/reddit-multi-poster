# Vercel Keep-Alive Setup Guide

This guide will help you set up the Supabase keep-alive cron job on Vercel.

## ✅ What's Already Done

1. ✅ `vercel.json` - Cron job configuration (runs every 6 hours)
2. ✅ `/api/keep-alive` - Keep-alive endpoint
3. ✅ Automatic authentication via Vercel's `x-vercel-cron` header

## 🚀 Next Steps

### Step 1: Deploy to Vercel

If you haven't already deployed to Vercel:

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy your project**:
   ```bash
   vercel
   ```
   
   Or connect your GitHub repository:
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js and deploy

### Step 2: Configure Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add your Supabase environment variables (if not already added):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
   - `KEEP_ALIVE_SECRET` (optional, for additional security)

### Step 3: Verify Cron Job is Active

After deployment, Vercel will automatically:
- ✅ Detect the `vercel.json` file
- ✅ Set up the cron job
- ✅ Run it every 6 hours

**To verify:**

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Cron Jobs**
3. You should see:
   - **Path**: `/api/keep-alive`
   - **Schedule**: `0 */6 * * *` (every 6 hours)
   - **Status**: Active

### Step 4: Test the Endpoint Manually

Test that the endpoint works:

```bash
# Replace with your Vercel deployment URL
curl https://your-project.vercel.app/api/keep-alive
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

### Step 5: Monitor Cron Job Execution

1. Go to your Vercel project dashboard
2. Navigate to **Deployments** tab
3. Click on any deployment
4. Go to **Functions** tab
5. Look for `/api/keep-alive` function logs

You can also check the **Cron Jobs** section in Settings to see execution history.

## 📅 Schedule Options

The current schedule is `0 */6 * * *` (every 6 hours). You can modify it in `vercel.json`:

| Schedule | Cron Expression | Description |
|---------|----------------|-------------|
| Every 6 hours | `0 */6 * * *` | ✅ Current (very safe) |
| Every 12 hours | `0 */12 * * *` | Safe |
| Every day | `0 0 * * *` | Safe |
| Every 3 days | `0 0 */3 * *` | Safe |
| Every 6 days | `0 0 */6 * *` | Minimum (matches Supabase's 7-day threshold) |

**Recommendation**: Keep the current schedule (every 6 hours) to ensure your Supabase instance never pauses.

## 🔒 Security

- ✅ Vercel cron jobs are automatically authenticated via the `x-vercel-cron` header
- ✅ The endpoint verifies this header before processing
- ✅ Optional `KEEP_ALIVE_SECRET` can be added for additional security

## 🐛 Troubleshooting

### Cron Job Not Running

1. **Check vercel.json is deployed**:
   - Ensure `vercel.json` is in your repository root
   - Verify it was included in your deployment

2. **Check Vercel Dashboard**:
   - Go to Settings → Cron Jobs
   - Verify the cron job is listed and active

3. **Check Deployment Logs**:
   - Look for any errors in the function execution logs

### Endpoint Returns 500 Error

1. **Check Environment Variables**:
   - Verify `NEXT_PUBLIC_SUPABASE_URL` is set
   - Verify `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` is set

2. **Check Supabase Status**:
   - Your Supabase instance might be paused (wake it up manually first)
   - Verify your Supabase project is active

3. **Check Function Logs**:
   - Go to Vercel Dashboard → Deployments → Functions
   - Look for error messages in the logs

### Supabase Still Pauses

- Verify the cron job is actually running (check execution logs)
- Try reducing the interval (e.g., every 3 hours instead of 6)
- Check that your Vercel deployment is active and not paused

## 📊 Monitoring

You can monitor the keep-alive endpoint by:

1. **Vercel Dashboard**:
   - Settings → Cron Jobs → View execution history
   - Deployments → Functions → View logs

2. **Add Logging** (optional):
   - The endpoint already logs to console
   - Check Vercel function logs for execution details

## ✅ Verification Checklist

- [ ] Project deployed to Vercel
- [ ] Environment variables configured
- [ ] `vercel.json` is in repository root
- [ ] Cron job appears in Vercel dashboard (Settings → Cron Jobs)
- [ ] Manual test of `/api/keep-alive` endpoint succeeds
- [ ] First cron execution completed successfully (check logs)

Once all items are checked, your Supabase instance will stay active! 🎉

## 💡 Additional Notes

- Vercel Cron Jobs are available on all plans (including free tier)
- Cron jobs run on Vercel's infrastructure, so they're reliable
- The keep-alive query is lightweight and won't impact your Supabase usage
- You can manually trigger the endpoint anytime for testing
