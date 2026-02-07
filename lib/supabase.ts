import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Client-side Supabase client (uses anon key)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not configured');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase client (uses service role key for admin operations)
// Supports both legacy SUPABASE_SERVICE_ROLE_KEY and new SUPABASE_SECRET_KEY (sb_secret_...)
// Local dev uses JWT-based service_role key, production can use new sb_secret key
let serverClient: SupabaseClient | null = null;

export function createServerSupabaseClient(): SupabaseClient {
  // Support both old service_role JWT key and new sb_secret key
  // New sb_secret keys are only available on Supabase Cloud, not local dev
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase server environment variables not configured. Set SUPABASE_SECRET_KEY (production) or SUPABASE_SERVICE_ROLE_KEY (local dev).');
  }
  
  if (!serverClient) {
    serverClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  
  return serverClient;
}

// User type for API responses
export interface SupabaseUser {
  id: string;
  reddit_id: string;
  reddit_username: string;
  reddit_avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

// Helper to get user ID from Reddit ID
export async function getUserByRedditId(redditId: string): Promise<SupabaseUser | null> {
  const client = createServerSupabaseClient();
  const { data, error } = await client
    .from('users')
    .select('*')
    .eq('reddit_id', redditId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  
  return data as SupabaseUser | null;
}

// Helper to create default category for a new user
async function createDefaultCategory(client: SupabaseClient, userId: string): Promise<void> {
  // Check if user already has categories
  const { data: existingCategories, error: checkError } = await client
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .limit(1);
  
  if (checkError) {
    console.error('Error checking existing categories:', checkError);
    return;
  }
  
  // Only create default category if user has none
  if (!existingCategories || existingCategories.length === 0) {
    const { error: insertError } = await client
      .from('categories')
      .insert({
        user_id: userId,
        name: 'General',
        position: 0,
        collapsed: false,
      });
    
    if (insertError) {
      console.error('Error creating default category:', insertError);
    } else {
      console.log('Created default "General" category for user:', userId);
    }
  }
}

// Helper to create or update user
// Post log type for analytics (privacy-first - no user content)
export interface PostLog {
  id: string;
  user_id: string;
  subreddit_name: string;
  post_kind: string;
  reddit_post_url: string | null;
  status: 'success' | 'error';
  error_code: string | null;
  created_at: string;
}

/**
 * Check if a user has any successful posts.
 * Used to determine if this is their first post (for activation tracking).
 */
export async function isUserFirstPost(userId: string): Promise<boolean> {
  try {
    const client = createServerSupabaseClient();
    const { count, error } = await client
      .from('post_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'success');

    if (error) {
      console.error('Failed to check user post history:', error);
      return false; // Assume not first post on error
    }

    return count === 0;
  } catch (err) {
    console.error('Error checking user post history:', err);
    return false;
  }
}

/**
 * Log a post attempt for analytics (privacy-first).
 * Only stores metadata - no user content (images, text, URLs).
 */
export async function logPostAttempt(data: {
  user_id: string;
  subreddit_name: string;
  post_kind: string;
  reddit_post_url?: string | null;
  status: 'success' | 'error';
  error_code?: string | null;
}): Promise<void> {
  try {
    const client = createServerSupabaseClient();
    const { error } = await client.from('post_logs').insert({
      user_id: data.user_id,
      subreddit_name: data.subreddit_name,
      post_kind: data.post_kind,
      reddit_post_url: data.reddit_post_url || null,
      status: data.status,
      error_code: data.error_code || null,
    });

    if (error) {
      console.error('Failed to log post attempt:', error);
    }
  } catch (err) {
    // Don't throw - analytics logging should not break posting
    console.error('Error logging post attempt:', err);
  }
}

/**
 * Classify Reddit error messages into generic error codes.
 * Strips user content to maintain privacy.
 */
export function classifyPostError(errorMessage: string): string {
  const msg = errorMessage.toLowerCase();
  
  if (msg.includes('rate limit') || msg.includes('try again')) {
    return 'rate_limited';
  }
  if (msg.includes('flair') || msg.includes('flair_required')) {
    return 'flair_required';
  }
  if (msg.includes('banned') || msg.includes('not allowed')) {
    return 'user_banned';
  }
  if (msg.includes('private') || msg.includes('restricted')) {
    return 'subreddit_private';
  }
  if (msg.includes('karma') || msg.includes('account age')) {
    return 'karma_required';
  }
  if (msg.includes('title') && (msg.includes('required') || msg.includes('invalid'))) {
    return 'title_invalid';
  }
  if (msg.includes('duplicate') || msg.includes('already posted')) {
    return 'duplicate_post';
  }
  if (msg.includes('nsfw') || msg.includes('over 18')) {
    return 'nsfw_error';
  }
  if (msg.includes('media') || msg.includes('image') || msg.includes('video')) {
    return 'media_error';
  }
  if (msg.includes('unauthorized') || msg.includes('login')) {
    return 'auth_error';
  }
  
  return 'unknown_error';
}

export async function upsertUser(userData: {
  reddit_id: string;
  reddit_username: string;
  reddit_avatar_url?: string;
}): Promise<SupabaseUser> {
  const client = createServerSupabaseClient();
  
  // Check if this is a new user
  const existingUser = await getUserByRedditId(userData.reddit_id);
  const isNewUser = !existingUser;
  
  const { data, error } = await client
    .from('users')
    .upsert(
      {
        reddit_id: userData.reddit_id,
        reddit_username: userData.reddit_username,
        reddit_avatar_url: userData.reddit_avatar_url,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'reddit_id',
      }
    )
    .select()
    .single();
  
  if (error) {
    throw error;
  }
  
  const user = data as SupabaseUser;
  
  // Create default category for new users
  if (isNewUser) {
    await createDefaultCategory(client, user.id);
  }
  
  return user;
}

// ============================================================================
// Storage Helpers (for Queue Files)
// ============================================================================

const QUEUE_FILES_BUCKET = 'queue-files';

/**
 * Upload a file to Supabase Storage for queue processing.
 * 
 * Folder structure: {username}/{date}/job_{shortId}/
 * File naming:
 *   - Shared files (itemIndex = -1): shared_{fileIndex}_{fileName}
 *   - Item-specific files: item_{itemIndex}_{fileIndex}_{fileName}
 * 
 * @param jobFolder - The job folder path (format: username/date/job_shortId)
 * @param itemIndex - Index of the item in the queue, or -1 for shared files
 * @param fileIndex - Index of the file within the item (for galleries)
 * @param file - The file buffer to upload
 * @param fileName - Original file name
 * @param mimeType - MIME type of the file
 * @returns The storage path of the uploaded file
 */
export async function uploadQueueFile(
  jobFolder: string,
  itemIndex: number,
  fileIndex: number,
  file: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const client = createServerSupabaseClient();
  
  // Use 'shared' prefix for shared files (itemIndex = -1), otherwise 'item_{index}'
  const prefix = itemIndex === -1 ? 'shared' : `item_${itemIndex}`;
  const storagePath = `${jobFolder}/${prefix}_${fileIndex}_${fileName}`;
  
  const { error } = await client.storage
    .from(QUEUE_FILES_BUCKET)
    .upload(storagePath, file, {
      contentType: mimeType,
      upsert: true,
    });
  
  if (error) {
    console.error('Failed to upload queue file:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
  
  return storagePath;
}

/**
 * Download a file from Supabase Storage.
 * @param storagePath - The storage path of the file
 * @returns The file as a Blob
 */
export async function downloadQueueFile(storagePath: string): Promise<Blob> {
  const client = createServerSupabaseClient();
  
  const { data, error } = await client.storage
    .from(QUEUE_FILES_BUCKET)
    .download(storagePath);
  
  if (error) {
    console.error('Failed to download queue file:', error);
    throw new Error(`Failed to download file: ${error.message}`);
  }
  
  return data;
}

/**
 * Delete a single file from Supabase Storage.
 * @param storagePath - The storage path of the file
 */
export async function deleteQueueFile(storagePath: string): Promise<void> {
  const client = createServerSupabaseClient();
  
  const { error } = await client.storage
    .from(QUEUE_FILES_BUCKET)
    .remove([storagePath]);
  
  if (error) {
    console.error('Failed to delete queue file:', error);
    // Don't throw - cleanup failures shouldn't break the flow
  }
}

/**
 * Delete all files for a queue job.
 * @param jobId - The queue job ID
 */
export async function deleteQueueJobFiles(jobId: string): Promise<void> {
  const client = createServerSupabaseClient();
  
  // List all files in the job folder
  const { data: files, error: listError } = await client.storage
    .from(QUEUE_FILES_BUCKET)
    .list(jobId);
  
  if (listError) {
    console.error('Failed to list queue job files:', listError);
    return;
  }
  
  if (!files || files.length === 0) {
    return;
  }
  
  // Delete all files
  const filePaths = files.map(f => `${jobId}/${f.name}`);
  const { error: deleteError } = await client.storage
    .from(QUEUE_FILES_BUCKET)
    .remove(filePaths);
  
  if (deleteError) {
    console.error('Failed to delete queue job files:', deleteError);
  }
}

/**
 * Get a signed URL for temporary file access.
 * @param storagePath - The storage path of the file
 * @param expiresIn - Expiration time in seconds (default 60)
 * @returns Signed URL
 */
export async function getQueueFileSignedUrl(
  storagePath: string,
  expiresIn: number = 60
): Promise<string> {
  const client = createServerSupabaseClient();
  
  const { data, error } = await client.storage
    .from(QUEUE_FILES_BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  
  if (error) {
    console.error('Failed to create signed URL:', error);
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }
  
  return data.signedUrl;
}
