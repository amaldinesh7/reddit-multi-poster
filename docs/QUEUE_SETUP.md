# Queue System Setup Guide

This document describes how to set up the Supabase-based queue system for production-ready multi-posting.

## Overview

The queue system allows users to:
- Submit posts to a persistent queue that survives page refresh/close
- Get real-time progress updates via Supabase Realtime
- Cancel jobs mid-processing
- Resume jobs after reconnection

## Prerequisites

- Supabase project (free tier works)
- Supabase CLI installed (for local development)

## Setup Steps

### 1. Run Database Migration

The migration creates the `queue_jobs` table with proper indexes, RLS policies, and Realtime support.

**Option A: Using Supabase CLI (Recommended)**

```bash
# From project root
npm run db:migrate

# Or directly
npx supabase migration up
```

**Option B: Using Supabase Dashboard**

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/004_add_queue_jobs.sql`
4. Run the SQL

### 2. Create Storage Bucket

The queue system stores uploaded files temporarily in Supabase Storage.

1. Go to your Supabase project dashboard
2. Navigate to **Storage**
3. Click **New bucket**
4. Configure:
   - **Name**: `queue-files`
   - **Public bucket**: **OFF** (unchecked - keep it private)
   - **File size limit**: `100MB` (or higher if needed)
5. Click **Create bucket**

### 3. Configure Storage Policies

Storage policies control who can access files. Since we use the service role key for all operations, we need a simple policy.

**Option A: Using Supabase Dashboard**

1. In Storage, click on the `queue-files` bucket
2. Click **Policies**
3. Click **New Policy**
4. Choose **For full customization**
5. Add the following policy:

**Policy Name**: `Service role full access`
**Allowed operations**: All (SELECT, INSERT, UPDATE, DELETE)
**Policy definition**:
```sql
(bucket_id = 'queue-files'::text)
```
**Target roles**: `service_role`

**Option B: Using SQL**

Run this in the SQL Editor:

```sql
-- Allow service role to manage queue files
CREATE POLICY "Service role full access to queue files"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'queue-files')
WITH CHECK (bucket_id = 'queue-files');
```

### 4. Verify Realtime is Enabled

The migration enables Realtime for the `queue_jobs` table. To verify:

1. Go to **Database** → **Replication**
2. Ensure `supabase_realtime` publication exists
3. Verify `queue_jobs` table is listed

If not, run:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE queue_jobs;
```

### 5. Environment Variables

Ensure these environment variables are set in your deployment:

```env
# Required for queue system
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SECRET_KEY=your-service-role-key  # or SUPABASE_SERVICE_ROLE_KEY
```

**Important**: The `SUPABASE_SECRET_KEY` (service role key) is required for:
- Uploading files to storage
- Creating and updating queue jobs
- Bypassing RLS policies

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           FRONTEND                               │
├─────────────────────────────────────────────────────────────────┤
│  useQueueJob hook                                                │
│  ├── submit() → POST /api/queue/submit                          │
│  ├── subscribeToJob() → Supabase Realtime                       │
│  ├── poll process() → POST /api/queue/process                   │
│  └── cancel() → POST /api/queue/cancel/[jobId]                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                            BACKEND                               │
├─────────────────────────────────────────────────────────────────┤
│  /api/queue/submit                                               │
│  ├── Upload files to Supabase Storage                           │
│  ├── Create queue_job record                                     │
│  └── Return job ID                                               │
│                                                                  │
│  /api/queue/process                                              │
│  ├── Claim job (atomic with SKIP LOCKED)                        │
│  ├── Download file from Storage                                 │
│  ├── Post to Reddit                                             │
│  ├── Update job progress (triggers Realtime)                    │
│  └── Stream results back                                        │
│                                                                  │
│  /api/queue/cancel/[jobId]                                      │
│  ├── Update job status to 'cancelled'                           │
│  └── Trigger file cleanup                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          SUPABASE                                │
├─────────────────────────────────────────────────────────────────┤
│  Database                                                        │
│  └── queue_jobs table (with Realtime enabled)                   │
│                                                                  │
│  Storage                                                         │
│  └── queue-files bucket (private)                               │
│                                                                  │
│  Realtime                                                        │
│  └── Broadcasts queue_jobs changes to subscribed clients        │
└─────────────────────────────────────────────────────────────────┘
```

## File Cleanup

Files are automatically cleaned up:

1. **After job completion**: When all items are posted
2. **After job cancellation**: When user cancels
3. **After job failure**: When job fails with error

Files are stored at: `queue-files/{jobId}/{itemIndex}_{fileIndex}_{filename}`

## Limits

| Limit | Value | Location |
|-------|-------|----------|
| Max items per job | 100 | `lib/queueLimits.ts` |
| Max single file size | 100 MB | `lib/queueLimits.ts` |
| Max concurrent jobs per user | 3 | `lib/queueJob.ts` |
| Job claim timeout | 5 minutes | `lib/queueJob.ts` |
| Polling interval | 3 seconds | `lib/queueJob.ts` |

## Troubleshooting

### "Failed to upload file" error

- Check that the `queue-files` bucket exists
- Verify storage policy allows service role access
- Check `SUPABASE_SECRET_KEY` is set correctly

### "Failed to claim job" error

- Job may already be processing by another request
- Check if job exists and is in `pending` status

### Realtime not updating

- Verify `queue_jobs` table is in `supabase_realtime` publication
- Check browser console for WebSocket connection errors
- Ensure `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correct

### Files not being cleaned up

- Check server logs for cleanup errors
- Manually delete old files: `DELETE FROM storage.objects WHERE bucket_id = 'queue-files' AND created_at < NOW() - INTERVAL '24 hours'`

## Local Development

1. Start local Supabase:
   ```bash
   npm run db:start
   ```

2. Run migrations:
   ```bash
   npm run db:migrate
   ```

3. Create the storage bucket via Studio:
   - Open http://127.0.0.1:54323
   - Go to Storage → Create bucket `queue-files`

4. Start the dev server:
   ```bash
   npm run dev
   ```
