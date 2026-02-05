/**
 * Queue Service
 * 
 * Server-side service for managing queue jobs.
 * Handles job creation, processing, cancellation, and cleanup.
 */

import { createServerSupabaseClient, deleteQueueJobFiles, downloadQueueFile } from './supabase';
import {
  QueueJob,
  QueueJobItem,
  QueueJobResult,
  QueueFileReference,
  QueueJobStatus,
  QUEUE_JOB_CONSTANTS,
} from './queueJob';

// ============================================================================
// Job Creation
// ============================================================================

/**
 * Create a new queue job in the database.
 */
export async function createQueueJob(
  userId: string,
  items: QueueJobItem[],
  caption: string,
  prefixes: { f?: boolean; c?: boolean },
  filePaths: QueueFileReference[]
): Promise<QueueJob> {
  const client = createServerSupabaseClient();
  
  // Auto-cancel any stale pending/processing jobs (older than 5 minutes)
  // This prevents users from getting permanently blocked by stuck jobs
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { error: cleanupError } = await client
    .from('queue_jobs')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .in('status', ['pending', 'processing'])
    .lt('created_at', staleThreshold);
  
  if (cleanupError) {
    console.error('Failed to cleanup stale jobs:', cleanupError);
    // Continue anyway - don't block job creation for cleanup failures
  }
  
  // Check if user already has an active job (single session model)
  const { count, error: countError } = await client
    .from('queue_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['pending', 'processing']);
  
  if (countError) {
    throw new Error(`Failed to check existing jobs: ${countError.message}`);
  }
  
  if (count && count >= QUEUE_JOB_CONSTANTS.MAX_JOBS_PER_USER) {
    throw new Error('You have an active post in progress. Wait for it to complete or cancel it first.');
  }
  
  const { data, error } = await client
    .from('queue_jobs')
    .insert({
      user_id: userId,
      status: 'pending',
      caption,
      prefixes,
      items,
      file_paths: filePaths,
      current_index: 0,
      results: [],
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create queue job: ${error.message}`);
  }
  
  return data as QueueJob;
}

// ============================================================================
// Job Retrieval
// ============================================================================

/**
 * Get a queue job by ID.
 */
export async function getQueueJob(jobId: string): Promise<QueueJob | null> {
  const client = createServerSupabaseClient();
  
  const { data, error } = await client
    .from('queue_jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get queue job: ${error.message}`);
  }
  
  return data as QueueJob;
}

/**
 * Get all jobs for a user.
 */
export async function getUserQueueJobs(
  userId: string,
  includeCompleted: boolean = false
): Promise<QueueJob[]> {
  const client = createServerSupabaseClient();
  
  let query = client
    .from('queue_jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (!includeCompleted) {
    query = query.in('status', ['pending', 'processing']);
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Failed to get user queue jobs: ${error.message}`);
  }
  
  return (data || []) as QueueJob[];
}

// ============================================================================
// Job Processing
// ============================================================================

/**
 * Claim a job for processing.
 * Uses database function to ensure atomic claim with SKIP LOCKED.
 */
export async function claimQueueJob(
  jobId: string,
  workerId: string
): Promise<QueueJob | null> {
  const client = createServerSupabaseClient();
  
  // Use the database function for atomic claim
  const { data, error } = await client.rpc('claim_queue_job', {
    p_job_id: jobId,
    p_worker_id: workerId,
  });
  
  if (error) {
    console.error('Failed to claim queue job:', error);
    return null;
  }
  
  return data as QueueJob | null;
}

/**
 * Update job progress after processing an item.
 */
export async function updateJobProgress(
  jobId: string,
  currentIndex: number,
  result: QueueJobResult
): Promise<QueueJob | null> {
  const client = createServerSupabaseClient();
  
  // Use the database function for atomic update
  const { data, error } = await client.rpc('update_queue_job_progress', {
    p_job_id: jobId,
    p_current_index: currentIndex,
    p_result: result,
  });
  
  if (error) {
    console.error('Failed to update job progress:', error);
    return null;
  }
  
  return data as QueueJob | null;
}

/**
 * Mark job as completed.
 */
export async function completeQueueJob(jobId: string): Promise<void> {
  const client = createServerSupabaseClient();
  
  const { error } = await client
    .from('queue_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      claimed_by: null,
      claimed_at: null,
    })
    .eq('id', jobId);
  
  if (error) {
    throw new Error(`Failed to complete queue job: ${error.message}`);
  }
  
  // Schedule file cleanup (don't await, run in background)
  cleanupJobFiles(jobId).catch(err => {
    console.error('Failed to cleanup job files:', err);
  });
}

/**
 * Mark job as failed.
 */
export async function failQueueJob(jobId: string, errorMessage: string): Promise<void> {
  const client = createServerSupabaseClient();
  
  const { error } = await client
    .from('queue_jobs')
    .update({
      status: 'failed',
      error: errorMessage,
      completed_at: new Date().toISOString(),
      claimed_by: null,
      claimed_at: null,
    })
    .eq('id', jobId);
  
  if (error) {
    throw new Error(`Failed to fail queue job: ${error.message}`);
  }
  
  // Schedule file cleanup
  cleanupJobFiles(jobId).catch(err => {
    console.error('Failed to cleanup job files:', err);
  });
}

// ============================================================================
// Job Cancellation
// ============================================================================

/**
 * Cancel a queue job.
 * Can only cancel pending or processing jobs.
 */
export async function cancelQueueJob(jobId: string, userId: string): Promise<boolean> {
  const client = createServerSupabaseClient();
  
  // Verify ownership and cancellable status
  const { data: job, error: fetchError } = await client
    .from('queue_jobs')
    .select('user_id, status')
    .eq('id', jobId)
    .single();
  
  if (fetchError || !job) {
    console.error('Job not found for cancellation:', jobId);
    return false;
  }
  
  if (job.user_id !== userId) {
    console.error('User does not own this job:', jobId);
    return false;
  }
  
  if (!['pending', 'processing'].includes(job.status)) {
    console.error('Job cannot be cancelled, status:', job.status);
    return false;
  }
  
  // Update status
  const { error: updateError } = await client
    .from('queue_jobs')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
      claimed_by: null,
      claimed_at: null,
    })
    .eq('id', jobId);
  
  if (updateError) {
    console.error('Failed to cancel queue job:', updateError);
    return false;
  }
  
  // Schedule file cleanup
  cleanupJobFiles(jobId).catch(err => {
    console.error('Failed to cleanup job files:', err);
  });
  
  return true;
}

/**
 * Check if a job is cancelled.
 */
export async function isJobCancelled(jobId: string): Promise<boolean> {
  const client = createServerSupabaseClient();
  
  const { data, error } = await client
    .from('queue_jobs')
    .select('status')
    .eq('id', jobId)
    .single();
  
  if (error || !data) {
    return true; // Assume cancelled if we can't fetch
  }
  
  return data.status === 'cancelled';
}

// ============================================================================
// File Operations
// ============================================================================

/**
 * Get files for a specific item in a job.
 */
export async function getJobItemFiles(
  job: QueueJob,
  itemIndex: number
): Promise<{ file: Blob; name: string; mimeType: string }[]> {
  const itemFiles = job.file_paths.filter(f => f.itemIndex === itemIndex);
  
  if (itemFiles.length === 0) {
    return [];
  }
  
  const files: { file: Blob; name: string; mimeType: string }[] = [];
  
  for (const fileRef of itemFiles) {
    try {
      const blob = await downloadQueueFile(fileRef.storagePath);
      files.push({
        file: blob,
        name: fileRef.originalName,
        mimeType: fileRef.mimeType,
      });
    } catch (err) {
      console.error(`Failed to download file ${fileRef.storagePath}:`, err);
      throw new Error(`Failed to download file: ${fileRef.originalName}`);
    }
  }
  
  return files;
}

/**
 * Clean up files for a completed/cancelled/failed job.
 */
export async function cleanupJobFiles(jobId: string): Promise<void> {
  try {
    await deleteQueueJobFiles(jobId);
    console.log(`Cleaned up files for job ${jobId}`);
  } catch (err) {
    console.error(`Failed to cleanup files for job ${jobId}:`, err);
  }
}

// ============================================================================
// Stale Job Cleanup
// ============================================================================

/**
 * Find and reset stale processing jobs.
 * Jobs that have been claimed for too long without completion.
 */
export async function resetStaleJobs(): Promise<number> {
  const client = createServerSupabaseClient();
  
  const staleThreshold = new Date(
    Date.now() - QUEUE_JOB_CONSTANTS.CLAIM_TIMEOUT_MS
  ).toISOString();
  
  const { data, error } = await client
    .from('queue_jobs')
    .update({
      status: 'pending',
      claimed_by: null,
      claimed_at: null,
    })
    .eq('status', 'processing')
    .lt('claimed_at', staleThreshold)
    .select('id');
  
  if (error) {
    console.error('Failed to reset stale jobs:', error);
    return 0;
  }
  
  if (data && data.length > 0) {
    console.log(`Reset ${data.length} stale jobs`);
  }
  
  return data?.length || 0;
}

/**
 * Delete old completed/failed/cancelled jobs and their files.
 * Should be called periodically (e.g., daily).
 */
export async function cleanupOldJobs(hoursOld: number = 24): Promise<number> {
  const client = createServerSupabaseClient();
  
  const threshold = new Date(
    Date.now() - hoursOld * 60 * 60 * 1000
  ).toISOString();
  
  // Get old jobs
  const { data: jobs, error: fetchError } = await client
    .from('queue_jobs')
    .select('id')
    .in('status', ['completed', 'failed', 'cancelled'])
    .lt('completed_at', threshold);
  
  if (fetchError || !jobs || jobs.length === 0) {
    return 0;
  }
  
  // Cleanup files for each job
  for (const job of jobs) {
    await cleanupJobFiles(job.id);
  }
  
  // Delete job records
  const { error: deleteError } = await client
    .from('queue_jobs')
    .delete()
    .in('id', jobs.map(j => j.id));
  
  if (deleteError) {
    console.error('Failed to delete old jobs:', deleteError);
    return 0;
  }
  
  console.log(`Cleaned up ${jobs.length} old jobs`);
  return jobs.length;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique worker ID for this request.
 */
export function generateWorkerId(): string {
  return `worker_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Check if a job can be processed (not completed, failed, or cancelled).
 */
export function canProcessJob(job: QueueJob): boolean {
  return ['pending', 'processing'].includes(job.status);
}

/**
 * Check if a job is fully processed (all items done).
 */
export function isJobFullyProcessed(job: QueueJob): boolean {
  return job.current_index >= job.items.length;
}

/**
 * Get the next item to process from a job.
 */
export function getNextJobItem(job: QueueJob): QueueJobItem | null {
  if (job.current_index >= job.items.length) {
    return null;
  }
  return job.items[job.current_index];
}
