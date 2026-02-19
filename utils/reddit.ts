import axios, { AxiosInstance } from 'axios';

export interface RedditToken {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface RedditUser {
  name: string;
  id: string;
  icon_img?: string;
  // Enhanced user data for eligibility checks
  comment_karma?: number;
  link_karma?: number;
  total_karma?: number;
  has_verified_email?: boolean;
  verified?: boolean;
  created_utc?: number;
  is_gold?: boolean;
  // Followers count (subscribers to user's profile)
  followers?: number;
}

// Subreddit settings - globally cacheable, not user-specific
export interface SubredditSettings {
  subreddit: string;
  subredditType: 'public' | 'private' | 'restricted' | 'gold_restricted' | 'archived' | 'user';
  restrictPosting: boolean;
  submissionType: 'any' | 'link' | 'self';
  // Media type allowances
  allowImages: boolean;
  allowVideos: boolean;
  allowGifs: boolean;
}

// User's relationship with a subreddit - per-user, client-only cache
export interface UserSubredditStatus {
  subreddit: string;
  userIsBanned: boolean;
  userIsContributor?: boolean;  // "Approved submitter" - optional, only present when Reddit explicitly returns it
  userIsSubscriber: boolean;
  userIsModerator: boolean;
}

// Combined eligibility data - user's relationship with a subreddit (for backward compatibility)
export interface SubredditEligibility extends SubredditSettings, Omit<UserSubredditStatus, 'subreddit'> {}

// Enhanced subreddit info including text content for parsing requirements
export interface EnhancedSubredditInfo extends SubredditEligibility {
  // Text content for parsing requirements
  publicDescription: string;      // Short description shown in search
  sidebarDescription: string;     // Full sidebar markdown (may contain rules)
  submitText: string;             // Text shown when clicking "Submit Post"
  // Metadata
  subscribers: number;
  activeUsers: number;
  wikiEnabled: boolean;
  over18: boolean;
  createdUtc: number;
}

export interface FlairOption {
  id: string;
  text: string;
  text_editable: boolean;
  richtext?: Array<{ e: string; t?: string }>;
}

export interface SubredditRules {
  requiresGenderTag: boolean;
  requiresContentTag: boolean;
  genderTags: string[];
  contentTags: string[];
  rules: string[];
  submitText: string; // Raw text shown on submit page with title requirements
}

export const REDDIT_OAUTH_AUTHORIZE = 'https://www.reddit.com/api/v1/authorize';
export const REDDIT_OAUTH_TOKEN = 'https://www.reddit.com/api/v1/access_token';
export const REDDIT_API = 'https://oauth.reddit.com';

const requiredEnv = ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'REDDIT_REDIRECT_URI', 'REDDIT_USER_AGENT'] as const;

export function assertEnv() {
  for (const key of requiredEnv) {
    if (!process.env[key]) {
      throw new Error(`Missing env ${key}`);
    }
  }
}

export function getAuthUrl(state: string) {
  assertEnv();
  const url = new URL(REDDIT_OAUTH_AUTHORIZE);
  url.searchParams.set('client_id', process.env.REDDIT_CLIENT_ID!);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  url.searchParams.set('redirect_uri', process.env.REDDIT_REDIRECT_URI!);
  url.searchParams.set('duration', 'permanent');
  url.searchParams.set('scope', 'identity submit read flair mysubreddits history');
  return url.toString();
}

export async function exchangeCodeForToken(code: string): Promise<RedditToken> {
  assertEnv();
  const basic = Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString('base64');
  const form = new URLSearchParams();
  form.set('grant_type', 'authorization_code');
  form.set('code', code);
  form.set('redirect_uri', process.env.REDDIT_REDIRECT_URI!);
  
  try {
    const { data } = await axios.post<RedditToken>(REDDIT_OAUTH_TOKEN, form, {
      headers: {
        'Authorization': `Basic ${basic}`,
        'User-Agent': process.env.REDDIT_USER_AGENT!,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return data;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      console.error('Reddit Token Exchange Error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      throw new Error(`Reddit Token Exchange Failed: ${error.response?.data?.error || error.message}`);
    }
    throw error;
  }
}

export async function refreshAccessToken(refresh_token: string): Promise<RedditToken> {
  assertEnv();
  const basic = Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString('base64');
  const form = new URLSearchParams();
  form.set('grant_type', 'refresh_token');
  form.set('refresh_token', refresh_token);
  const { data } = await axios.post<RedditToken>(REDDIT_OAUTH_TOKEN, form, {
    headers: {
      'Authorization': `Basic ${basic}`,
      'User-Agent': process.env.REDDIT_USER_AGENT!,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  // Reddit may omit refresh_token on refresh; keep existing
  if (!data.refresh_token) data.refresh_token = refresh_token;
  return data;
}

export function redditClient(accessToken: string): AxiosInstance {
  assertEnv();
  const client = axios.create({
    baseURL: REDDIT_API,
    timeout: 15_000,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': process.env.REDDIT_USER_AGENT!,
    },
  });
  // Basic rate limit resilience
  client.interceptors.response.use(
    (res) => res,
    async (error) => {
      const status = error?.response?.status;
      if (status === 429) {
        const retryAfter = Number(error.response.headers['retry-after'] || 10);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        return client.request(error.config);
      }
      throw error;
    }
  );
  return client;
}

export async function getIdentity(client: AxiosInstance): Promise<RedditUser> {
  const { data } = await client.get('/api/v1/me');
  // Return enhanced user data including karma, account age, verification status, and followers
  return {
    name: data.name,
    id: data.id,
    icon_img: data.icon_img,
    comment_karma: data.comment_karma,
    link_karma: data.link_karma,
    total_karma: data.total_karma,
    has_verified_email: data.has_verified_email,
    verified: data.verified,
    created_utc: data.created_utc,
    is_gold: data.is_gold,
    followers: data.subreddit?.subscribers ?? 0,
  };
}

/**
 * Get subreddit settings (non-user-specific, globally cacheable)
 * This includes subreddit type, posting restrictions, and media allowances.
 */
export async function getSubredditSettings(
  client: AxiosInstance, 
  subreddit: string
): Promise<SubredditSettings> {
  try {
    const { data } = await client.get(`/r/${subreddit}/about`, { params: { raw_json: 1 } });
    const subData = data?.data || {};
    
    return {
      subreddit,
      subredditType: subData.subreddit_type || 'public',
      restrictPosting: subData.restrict_posting || false,
      submissionType: subData.submission_type || 'any',
      // Media type allowances - default to true if not specified
      allowImages: subData.allow_images !== false,
      allowVideos: subData.allow_videos !== false,
      allowGifs: subData.allow_videogifs !== false,
    };
  } catch (error) {
    // Return safe defaults if we can't fetch settings
    console.error(`Failed to get settings for r/${subreddit}:`, error);
    return {
      subreddit,
      subredditType: 'public',
      restrictPosting: false,
      submissionType: 'any',
      allowImages: true,
      allowVideos: true,
      allowGifs: true,
    };
  }
}

/**
 * Get user's relationship status with a specific subreddit (per-user, not cacheable globally)
 * This includes banned status, approved submitter status, subscriber status, etc.
 */
export async function getUserSubredditStatus(
  client: AxiosInstance, 
  subreddit: string
): Promise<UserSubredditStatus> {
  try {
    const { data } = await client.get(`/r/${subreddit}/about`, { params: { raw_json: 1 } });
    const subData = data?.data || {};
    
    return {
      subreddit,
      userIsBanned: subData.user_is_banned || false,
      // Only include userIsContributor if Reddit explicitly returns it
      ...(subData.user_is_contributor !== undefined && { userIsContributor: subData.user_is_contributor }),
      userIsSubscriber: subData.user_is_subscriber || false,
      userIsModerator: subData.user_is_moderator || false,
    };
  } catch (error) {
    // Return safe defaults if we can't fetch status
    console.error(`Failed to get user status for r/${subreddit}:`, error);
    return {
      subreddit,
      userIsBanned: false,
      // Don't include userIsContributor - we don't know if verification is required
      userIsSubscriber: false,
      userIsModerator: false,
    };
  }
}

/**
 * Get user's status for multiple subreddits in parallel with rate limiting
 */
export async function getUserSubredditStatusBatch(
  client: AxiosInstance, 
  subreddits: string[],
  batchSize: number = 3,
  delayMs: number = 300
): Promise<Record<string, UserSubredditStatus>> {
  const results: Record<string, UserSubredditStatus> = {};
  
  for (let i = 0; i < subreddits.length; i += batchSize) {
    const batch = subreddits.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(
      batch.map(async (subreddit) => {
        const status = await getUserSubredditStatus(client, subreddit);
        return { subreddit, status };
      })
    );
    
    batchResults.forEach(({ subreddit, status }) => {
      results[subreddit.toLowerCase()] = status;
    });
    
    // Add delay between batches to avoid rate limiting
    if (i + batchSize < subreddits.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
}

/**
 * Get user's eligibility status for a specific subreddit (combined settings + user status)
 * This includes banned status, approved submitter status, subscriber status, etc.
 * @deprecated Use getSubredditSettings for caching and getUserSubredditStatus for user-specific data
 */
export async function getSubredditEligibility(
  client: AxiosInstance, 
  subreddit: string
): Promise<SubredditEligibility> {
  try {
    const { data } = await client.get(`/r/${subreddit}/about`, { params: { raw_json: 1 } });
    const subData = data?.data || {};
    
    return {
      subreddit,
      subredditType: subData.subreddit_type || 'public',
      userIsBanned: subData.user_is_banned || false,
      // Only include userIsContributor if Reddit explicitly returns it
      ...(subData.user_is_contributor !== undefined && { userIsContributor: subData.user_is_contributor }),
      userIsSubscriber: subData.user_is_subscriber || false,
      userIsModerator: subData.user_is_moderator || false,
      restrictPosting: subData.restrict_posting || false,
      submissionType: subData.submission_type || 'any',
      // Media type allowances - default to true if not specified
      allowImages: subData.allow_images !== false,
      allowVideos: subData.allow_videos !== false,
      allowGifs: subData.allow_videogifs !== false,
    };
  } catch (error) {
    // Return safe defaults if we can't fetch eligibility
    console.error(`Failed to get eligibility for r/${subreddit}:`, error);
    return {
      subreddit,
      subredditType: 'public',
      userIsBanned: false,
      // Don't include userIsContributor - we don't know if verification is required
      userIsSubscriber: false,
      userIsModerator: false,
      restrictPosting: false,
      submissionType: 'any',
      allowImages: true,
      allowVideos: true,
      allowGifs: true,
    };
  }
}

export async function listMySubreddits(client: AxiosInstance, maxPages: number = 10): Promise<string[]> {
  const subs: string[] = [];
  let after: string | undefined = undefined;
  let pageCount = 0;
  
  do {
    const resp = await client.get<any>('/subreddits/mine/subscriber', { 
      params: { limit: 100, after } 
    });
    const data: any = resp.data;
    const children: any[] = data?.data?.children || [];
    
    for (const c of children) {
      if (c?.data?.display_name) {
        subs.push(c.data.display_name);
      }
    }
    
    after = data?.data?.after || undefined;
    pageCount++;
    
    // Limit to prevent infinite loops and improve performance
    if (pageCount >= maxPages) {
      console.log(`Fetched ${subs.length} subreddits (stopped at ${maxPages} pages)`);
      break;
    }
  } while (after);
  
  return subs.sort((a, b) => a.localeCompare(b));
}

/**
 * Wait for Reddit to process an uploaded video file.
 * Reddit needs time to transcode videos for v.redd.it before the post can be submitted.
 * This function polls to verify the upload is accessible before proceeding.
 * 
 * @param assetId - The Reddit media asset ID returned from the upload lease
 * @param maxWaitMs - Maximum time to wait for processing (default: 60 seconds)
 * @param pollIntervalMs - Time between polling attempts (default: 2 seconds)
 */
async function waitForVideoProcessing(
  assetId: string,
  maxWaitMs: number = 60000,
  pollIntervalMs: number = 2000
): Promise<void> {
  const startTime = Date.now();
  const mediaUrl = `https://reddit-uploaded-media.s3-accelerate.amazonaws.com/${assetId}`;
  
  console.log(`Starting video processing wait for asset: ${assetId}`);
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      // Try to verify the video is accessible via HEAD request
      const response = await fetch(mediaUrl, { method: 'HEAD' });
      
      if (response.ok) {
        const elapsedSec = Math.round((Date.now() - startTime) / 1000);
        console.log(`Video upload verified accessible after ${elapsedSec}s`);
        
        // Additional wait to ensure Reddit's internal processing completes
        // This accounts for transcoding time that happens after S3 upload
        console.log('Waiting additional 5s for Reddit transcoding...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('Video processing complete, ready for submission');
        return;
      }
    } catch (e) {
      // Video not ready yet or network error, continue polling
      console.log(`Video not ready yet, retrying... (error: ${e instanceof Error ? e.message : 'unknown'})`);
    }
    
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    console.log(`Waiting for video processing... (${elapsedSec}s elapsed)`);
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
  
  // Don't throw - video might still work, let the submit attempt proceed
  // Some videos may take longer but Reddit might still accept them
  console.warn(`Video processing wait timed out after ${maxWaitMs / 1000}s, attempting submit anyway`);
}

export async function getFlairs(client: AxiosInstance, subreddit: string): Promise<{ flairs: FlairOption[] }> {
  try {
    // Only fetch available flairs - requirement status comes from post_requirements endpoint
    const flairsResp = await client.get(`/r/${subreddit}/api/link_flair_v2`, { params: { raw_json: 1 } });
    
    const flairs = (flairsResp.data as any[]).map((f) => ({ 
      id: f.id, 
      text: f.text, 
      text_editable: !!f.text_editable, 
      richtext: f.richtext 
    }));
    
    return { flairs };
  } catch (error) {
    // Fallback - return empty flairs
    return { flairs: [] };
  }
}

export async function uploadMedia(client: AxiosInstance, file: File, subreddit: string): Promise<string> {
  const isVideo = file.type.startsWith('video/');
  
  console.log(`Starting ${isVideo ? 'video' : 'image'} upload: ${file.name} (${file.type}, ${Math.round(file.size / 1024)}KB)`);
  
  // Step 1: Request upload lease
  const leaseForm = new URLSearchParams();
  leaseForm.set('filepath', file.name);
  leaseForm.set('mimetype', file.type);
  leaseForm.set('sr', subreddit);
  
  const { data: leaseData } = await client.post('/api/media/asset.json', leaseForm, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  
  console.log('Lease data received:', JSON.stringify(leaseData, null, 2));
  
  if (!leaseData?.args?.action || !leaseData?.asset?.asset_id) {
    console.error('Invalid lease data:', leaseData);
    throw new Error('Failed to get media upload lease');
  }
  
  // Step 2: Upload file to Reddit's S3
  const uploadForm = new FormData();
  
  // Add all the required fields from Reddit in the correct order
  // S3 requires fields to be in a specific order, with 'key' before 'file'
  leaseData.args.fields.forEach((field: any) => {
    uploadForm.append(field.name, field.value);
  });
  
  // Add the file last (this is critical - file must be the last field)
  uploadForm.append('file', file);
  
  // Fix protocol-relative URL from Reddit
  let uploadUrl = leaseData.args.action;
  if (uploadUrl.startsWith('//')) {
    uploadUrl = `https:${uploadUrl}`;
  }
  
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    body: uploadForm,
  });
  
  if (!uploadResponse.ok) {
    const responseText = await uploadResponse.text();
    console.error('Upload failed:', {
      status: uploadResponse.status,
      statusText: uploadResponse.statusText,
      response: responseText,
      url: uploadUrl
    });
    throw new Error(`Failed to upload media to Reddit: ${uploadResponse.status} ${uploadResponse.statusText}`);
  }
  
  const assetId = leaseData.asset.asset_id;
  console.log(`File uploaded to S3 successfully, asset ID: ${assetId}`);
  
  // Step 3: For videos, wait for Reddit to process/transcode the upload
  // This is critical - Reddit needs time to process videos before submission
  if (isVideo) {
    console.log('Video uploaded to S3, waiting for Reddit processing/transcoding...');
    await waitForVideoProcessing(assetId);
  }
  
  return assetId;
}

export async function uploadMultipleMedia(client: AxiosInstance, files: File[], subreddit: string): Promise<string[]> {
  const assetIds: string[] = [];
  
  // Upload each file sequentially to avoid overwhelming Reddit's API
  for (const file of files) {
    console.log(`Uploading file ${assetIds.length + 1}/${files.length}: ${file.name}`);
    const assetId = await uploadMedia(client, file, subreddit);
    assetIds.push(assetId);
    
    // Small delay between uploads to be respectful to Reddit's servers
    if (assetIds.length < files.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Wait for Reddit to process all uploaded images before returning
  // This is critical - images need to be processed before gallery submission
  console.log('Waiting for Reddit to process uploaded images...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  return assetIds;
}

export async function getSubredditRules(client: AxiosInstance, subreddit: string): Promise<SubredditRules> {
  try {
    const [rulesResp, aboutResp] = await Promise.all([
      client.get(`/r/${subreddit}/about/rules`, { params: { raw_json: 1 } }),
      client.get(`/r/${subreddit}/about`, { params: { raw_json: 1 } })
    ]);
    
    const rules = rulesResp.data?.rules || [];
    const description = aboutResp.data?.data?.description || '';
    const publicDescription = aboutResp.data?.data?.public_description || '';
    const submitText = aboutResp.data?.data?.submit_text || '';
    
    // Combine all text to analyze
    const allText = [
      description,
      publicDescription,
      submitText,
      ...rules.map((r: any) => `${r.short_name} ${r.description}`)
    ].join(' ').toLowerCase();
    
    // Check for gender tag requirements - look for actual REQUIREMENTS, not just mentions
    const requiresGenderTag = 
      /title.*must.*include.*\(f\)|title.*must.*include.*\(m\)|title.*must.*include.*gender/.test(allText) ||
      /posts.*must.*include.*\(f\)|posts.*must.*include.*\(m\)|posts.*must.*include.*gender/.test(allText) ||
      /must.*tag.*\(f\)|must.*tag.*\(m\)|required.*\(f\)|required.*\(m\)/.test(allText) ||
      /use.*\(f\).*in.*title|use.*\(m\).*in.*title|add.*\(f\).*to.*title|add.*\(m\).*to.*title/.test(allText);
    
    // Check for content tag requirements - look for actual REQUIREMENTS, not just mentions
    const requiresContentTag =
      /title.*must.*include.*\(c\)|posts.*must.*include.*\(c\)|must.*tag.*\(c\)|required.*\(c\)/.test(allText) ||
      /use.*\(c\).*in.*title|add.*\(c\).*to.*title/.test(allText);
    
    // Extract common gender tags
    const genderTags = [];
    if (/\(f\)|\[f\]|female/i.test(allText)) genderTags.push('f');
    if (/\(m\)|\[m\]|male/i.test(allText)) genderTags.push('m');
    if (/\(c\)|\[c\]|couple/i.test(allText)) genderTags.push('c');
    
    // Extract common content tags
    const contentTags = [];
    if (/\(oc\)|\[oc\]|original.*content/i.test(allText)) contentTags.push('oc');
    if (/\(c\)|\[c\]|couple/i.test(allText)) contentTags.push('c');
    
    return {
      requiresGenderTag,
      requiresContentTag,
      genderTags,
      contentTags,
      rules: rules.map((r: any) => r.short_name),
      submitText: submitText // Include raw submit text for AI parsing
    };
  } catch (error) {
    // Fallback - assume no special requirements
    return {
      requiresGenderTag: false,
      requiresContentTag: false,
      genderTags: [],
      contentTags: [],
      rules: [],
      submitText: ''
    };
  }
}

export interface SubmitParams {
  subreddit: string;
  title: string;
  kind: 'self' | 'link' | 'image' | 'video' | 'gallery';
  text?: string;
  url?: string;
  flair_id?: string;
  nsfw?: boolean;
  spoiler?: boolean;
  video_poster_url?: string;
  // For file uploads
  file?: File;
  files?: File[]; // For gallery posts (multiple images)
  media_asset?: string; // Reddit media asset ID
  media_assets?: string[]; // For gallery posts
}

export async function submitPost(client: AxiosInstance, params: SubmitParams): Promise<{ url: string; id: string }>
{
  let mediaAssetId = params.media_asset;
  let mediaAssetIds = params.media_assets;
  
  // Handle multiple files for gallery posts
  if (params.files && params.files.length > 1 && !mediaAssetIds) {
    console.log(`Uploading ${params.files.length} files for gallery post to r/${params.subreddit}...`);
    console.log('File details:', params.files.map(f => ({ name: f.name, size: f.size, type: f.type })));
    mediaAssetIds = await uploadMultipleMedia(client, params.files, params.subreddit);
    console.log('Gallery files uploaded, asset IDs:', mediaAssetIds);
  }
  // Handle single file
  else if (params.file && !mediaAssetId) {
    console.log('Uploading file to Reddit...', params.file.name);
    mediaAssetId = await uploadMedia(client, params.file, params.subreddit);
    console.log('File uploaded, asset ID:', mediaAssetId);
  }
  // Handle single file from files array
  else if (params.files && params.files.length === 1 && !mediaAssetId) {
    console.log('Uploading single file from files array...', params.files[0].name);
    mediaAssetId = await uploadMedia(client, params.files[0], params.subreddit);
    console.log('File uploaded, asset ID:', mediaAssetId);
  }
  
  // Use Reddit's Gallery API for multiple images (separate endpoint)
  if (params.kind === 'gallery' && mediaAssetIds && mediaAssetIds.length > 1) {
    return submitGalleryPost(client, params, mediaAssetIds);
  }
  
  const form = new URLSearchParams();
  form.set('api_type', 'json');
  form.set('sr', params.subreddit);
  form.set('title', params.title);
  form.set('resubmit', 'true');
  form.set('sendreplies', 'true');
  
  // Handle different post types
  if (params.kind === 'self') {
    form.set('kind', 'self');
  } else if (params.kind === 'link') {
    // Validate URL is provided for link posts
    if (!params.url || params.url.trim() === '') {
      throw new Error('URL is required for link posts');
    }
    form.set('kind', 'link');
    form.set('url', params.url);
  } else if (params.kind === 'image' || params.kind === 'video') {
    // For image/video posts, we need a media asset ID from file upload
    if (!mediaAssetId) {
      throw new Error('Media upload failed - no media asset ID available. Please try uploading the file again.');
    }
    const sourceFile = params.file ?? params.files?.[0];
    const mediaKind = params.kind === 'video' && sourceFile?.type === 'image/gif'
      ? 'videogif'
      : params.kind;
    form.set('kind', mediaKind);
    const mediaUrl = `https://reddit-uploaded-media.s3-accelerate.amazonaws.com/${mediaAssetId}`;
    form.set('url', mediaUrl);
    if (mediaKind === 'video' || mediaKind === 'videogif') {
      form.set('video_poster_url', params.video_poster_url || mediaUrl);
      // Disable validation on submit for video posts to avoid timing issues
      // Reddit's video processing may not be fully complete even after our wait
      form.set('validate_on_submit', 'false');
      console.log(`Submitting ${mediaKind} post with asset: ${mediaAssetId}`);
    }
  } else {
    // Fallback
    form.set('kind', 'self');
  }

  // Always add text/body if present
  if (params.text) {
    form.set('text', params.text);
  } else if (params.kind === 'self') {
    // Ensure self posts have at least empty text if missing
    form.set('text', '');
  }
  
  if (params.flair_id) form.set('flair_id', params.flair_id);
  if (params.nsfw) form.set('nsfw', 'true');
  if (params.spoiler) form.set('spoiler', 'true');

  const { data } = await client.post('/api/submit', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  
  // Log the response for debugging
  console.log('Reddit API response:', JSON.stringify(data, null, 2));
  
  // Handle different response formats
  let json = data?.json;
  
  // Check for jQuery-style error responses (when success: false)
  if (data?.success === false) {
    // Extract error message from jQuery commands
    let errorMessage = 'Post failed';
    if (data?.jquery) {
      const commands = data.jquery as any[];
      for (const cmd of commands) {
        if (cmd[3] === 'text' && cmd[4] && cmd[4][0]) {
          errorMessage = cmd[4][0];
          break;
        }
      }
    }
    throw new Error(errorMessage);
  }
  
  // Handle traditional error format
  if (json?.errors?.length) {
    throw new Error(json.errors.map((e: any) => e.join(': ')).join('; '));
  }
  
  // Try different possible response structures
  let url = json?.data?.url as string;
  let id = json?.data?.id as string;
  
  // Fix protocol-relative URLs (e.g., //reddit-uploaded-media.s3-accelerate.amazonaws.com)
  if (url && url.startsWith('//')) {
    url = `https:${url}`;
  }
  
  // If URL is not present, construct it from the subreddit and id
  if (!url && id && params.subreddit) {
    url = `https://www.reddit.com/r/${params.subreddit}/comments/${id}/`;
  }
  
  // If still no URL, try alternative response structure
  if (!url && json?.data?.name) {
    const name = json.data.name as string;
    if (name.startsWith('t3_')) {
      const postId = name.substring(3);
      url = `https://www.reddit.com/r/${params.subreddit}/comments/${postId}/`;
      id = postId;
    }
  }
  
  return { url: url || '', id: id || '' };
}

/**
 * Submit a gallery post using Reddit's API.
 * This is required for posting multiple images as a single post.
 */
async function submitGalleryPost(
  client: AxiosInstance, 
  params: SubmitParams, 
  mediaAssetIds: string[]
): Promise<{ url: string; id: string }> {
  console.log(`Creating gallery post with ${mediaAssetIds.length} images to r/${params.subreddit}`);
  
  // Try the /api/submit endpoint with gallery_data first (more reliable for some subreddits)
  const form = new URLSearchParams();
  form.set('api_type', 'json');
  form.set('sr', params.subreddit);
  form.set('title', params.title);
  form.set('kind', 'self');  // Use 'self' with gallery_data
  form.set('resubmit', 'true');
  form.set('sendreplies', 'true');
  
  // Gallery data format - items array with media_id for each uploaded image
  const items = mediaAssetIds.map((mediaId, index) => ({
    media_id: mediaId,
    id: index + 1,
    caption: '',
  }));
  
  form.set('items', JSON.stringify(items));
  
  if (params.flair_id) form.set('flair_id', params.flair_id);
  if (params.nsfw) form.set('nsfw', 'true');
  if (params.spoiler) form.set('spoiler', 'true');
  
  console.log('Gallery form data:', {
    sr: params.subreddit,
    title: params.title,
    items: items,
    flair_id: params.flair_id
  });
  
  // First try the dedicated gallery endpoint
  try {
    const galleryPayload = {
      api_type: 'json',
      sr: params.subreddit,
      title: params.title,
      items: mediaAssetIds.map((assetId) => ({
        media_id: assetId,
        caption: '',
      })),
      sendreplies: true,
      resubmit: true,
      nsfw: params.nsfw || false,
      spoiler: params.spoiler || false,
      flair_id: params.flair_id || undefined,
      validate_on_submit: false,
      text: params.text || undefined,
    };
    
    console.log('Trying /api/submit_gallery_post.json endpoint...');
    console.log('Gallery payload:', JSON.stringify(galleryPayload, null, 2));
    
    const { data } = await client.post('/api/submit_gallery_post.json', galleryPayload, {
      headers: { 'Content-Type': 'application/json' },
    });
    
    console.log('Gallery API response:', JSON.stringify(data, null, 2));
    
    // Handle error responses
    if (data?.json?.errors?.length) {
      throw new Error(data.json.errors.map((e: any) => e.join(': ')).join('; '));
    }
    
    // Extract URL and ID from response
    let url = data?.json?.data?.url as string;
    let id = data?.json?.data?.id as string;
    
    // Fix protocol-relative URLs
    if (url && url.startsWith('//')) {
      url = `https:${url}`;
    }
    
    // If URL is not present, construct it from the subreddit and id
    if (!url && id && params.subreddit) {
      // Clean up the ID if it has t3_ prefix
      const cleanId = id.startsWith('t3_') ? id.substring(3) : id;
      url = `https://www.reddit.com/r/${params.subreddit}/comments/${cleanId}/`;
    }
    
    // Try alternative response structure (name field)
    if (!url && data?.json?.data?.name) {
      const name = data.json.data.name as string;
      if (name.startsWith('t3_')) {
        const postId = name.substring(3);
        url = `https://www.reddit.com/r/${params.subreddit}/comments/${postId}/`;
        id = postId;
      }
    }
    
    if (url) {
      return { url, id: id || '' };
    }
    
    throw new Error('No URL in gallery response');
  } catch (error) {
    console.log('Gallery endpoint failed, trying alternative /api/submit approach...');
    console.error('Gallery endpoint error:', error);
    
    // Fallback: Try the regular submit endpoint with gallery items
    const fallbackForm = new URLSearchParams();
    fallbackForm.set('api_type', 'json');
    fallbackForm.set('sr', params.subreddit);
    fallbackForm.set('title', params.title);
    fallbackForm.set('kind', 'image');
    fallbackForm.set('resubmit', 'true');
    fallbackForm.set('sendreplies', 'true');
    
    // Use the first image URL as the main media
    fallbackForm.set('url', `https://reddit-uploaded-media.s3-accelerate.amazonaws.com/${mediaAssetIds[0]}`);
    
    if (params.flair_id) fallbackForm.set('flair_id', params.flair_id);
    if (params.nsfw) fallbackForm.set('nsfw', 'true');
    if (params.spoiler) fallbackForm.set('spoiler', 'true');
    
    const { data: fallbackData } = await client.post('/api/submit', fallbackForm, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    
    console.log('Fallback API response:', JSON.stringify(fallbackData, null, 2));
    
    const json = fallbackData?.json;
    if (json?.errors?.length) {
      throw new Error(json.errors.map((e: any) => e.join(': ')).join('; '));
    }
    
    let url = json?.data?.url as string;
    let id = json?.data?.id as string;
    
    if (url && url.startsWith('//')) {
      url = `https:${url}`;
    }
    
    if (!url && id && params.subreddit) {
      url = `https://www.reddit.com/r/${params.subreddit}/comments/${id}/`;
    }
    
    return { url: url || '', id: id || '' };
  }
}

export function addPrefixesToTitle(title: string, opts: { f?: boolean; c?: boolean }): string {
  const parts: string[] = [];
  if (opts.f) parts.push('(f)');
  if (opts.c) parts.push('(c)');
  return [parts.join(' '), title].filter(Boolean).join(' ').trim().replace(/\s+/g, ' ');
}

export function addSmartPrefixesToTitle(
  title: string, 
  subreddit: string, 
  globalPrefixes: { f?: boolean; c?: boolean }, 
  subredditRules?: SubredditRules
): string {
  const parts: string[] = [];
  
  // Only add prefixes if the subreddit requires them OR if globally enabled
  if (globalPrefixes.f && (subredditRules?.requiresGenderTag || subredditRules?.genderTags.includes('f'))) {
    parts.push('(f)');
  }
  
  if (globalPrefixes.c && (subredditRules?.requiresContentTag || subredditRules?.genderTags.includes('c'))) {
    parts.push('(c)');
  }
  
  // Fallback: if no rules detected but user wants prefixes globally, apply them
  if (!subredditRules && globalPrefixes.f) parts.push('(f)');
  if (!subredditRules && globalPrefixes.c) parts.push('(c)');
  
  return [parts.join(' '), title].filter(Boolean).join(' ').trim().replace(/\s+/g, ' ');
}

// ... (previous code)

export interface PostRequirements {
  domain_blacklist?: string[];
  body_restriction_policy?: string;
  domain_whitelist?: string[];
  title_regexes?: string[];
  body_blacklisted_strings?: string[];
  body_required_strings?: string[];
  title_text_min_length?: number;
  is_flair_required?: boolean;
  title_text_max_length?: number;
  body_regexes?: string[];
  link_repost_age?: number;
  body_text_min_length?: number;
  body_text_max_length?: number;
  title_required_strings?: string[];
  title_blacklisted_strings?: string[];
  guidelines_text?: string | null;
  gallery_min_items?: number | null;
  gallery_max_items?: number | null;
  gallery_captions_requirement?: string;
  gallery_urls_requirement?: string;
}

export async function getPostRequirements(client: AxiosInstance, subreddit: string): Promise<PostRequirements> {
// ... (rest of function)
  try {
    const { data } = await client.get(`/api/v1/subreddit/post_requirements`, {
      params: { subreddit: subreddit },
    });
    return data;
  } catch (error) {
    console.error(`Failed to get post requirements for ${subreddit}`, error);
    return {};
  }
}

/**
 * Get list of wiki pages available for a subreddit
 * @param client - Axios client with Reddit OAuth
 * @param subreddit - Subreddit name (without r/)
 * @returns Array of wiki page names, or empty array if wiki is disabled/inaccessible
 */
export async function getWikiPages(client: AxiosInstance, subreddit: string): Promise<string[]> {
  try {
    const { data } = await client.get(`/r/${subreddit}/wiki/pages.json`, {
      params: { raw_json: 1 },
    });
    return data?.data || [];
  } catch (error) {
    // Wiki may be disabled or require special permissions
    console.log(`Wiki pages not available for r/${subreddit}`);
    return [];
  }
}

/**
 * Get content of a specific wiki page
 * @param client - Axios client with Reddit OAuth
 * @param subreddit - Subreddit name (without r/)
 * @param page - Wiki page name (e.g., 'index', 'rules', 'faq')
 * @returns Wiki page content as markdown string, or null if not accessible
 */
export async function getWikiPage(client: AxiosInstance, subreddit: string, page: string): Promise<string | null> {
  try {
    const { data } = await client.get(`/r/${subreddit}/wiki/${page}.json`, {
      params: { raw_json: 1 },
    });
    return data?.data?.content_md || null;
  } catch (error) {
    // Page may not exist or require special permissions
    console.log(`Wiki page "${page}" not available for r/${subreddit}`);
    return null;
  }
}

/**
 * Get enhanced subreddit information including text content for parsing requirements
 * Combines /about endpoint with wiki data for comprehensive eligibility checking
 * @param client - Axios client with Reddit OAuth  
 * @param subreddit - Subreddit name (without r/)
 * @returns Enhanced subreddit info with all text content for requirement parsing
 */
/**
 * Get user's recent submissions (posts) from Reddit
 * @param client - Axios client with Reddit OAuth
 * @param username - Reddit username
 * @param limit - Number of posts to fetch (max 100)
 * @returns Array of post titles with subreddit info
 */
export async function getUserSubmissions(
  client: AxiosInstance,
  username: string,
  limit: number = 10
): Promise<{ title: string; subreddit: string }[]> {
  try {
    const { data } = await client.get(`/user/${username}/submitted`, {
      params: { limit, sort: 'new', raw_json: 1 },
    });
    
    const children = data?.data?.children || [];
    return children.map((child: any) => ({
      title: child.data?.title || '',
      subreddit: child.data?.subreddit || '',
    })).filter((post: { title: string }) => post.title);
  } catch (error) {
    console.error(`Failed to get submissions for u/${username}:`, error);
    return [];
  }
}

export async function getEnhancedSubredditInfo(
  client: AxiosInstance, 
  subreddit: string
): Promise<EnhancedSubredditInfo> {
  try {
    // Fetch subreddit about data
    const { data } = await client.get(`/r/${subreddit}/about.json`, {
      params: { raw_json: 1 },
    });
    const subData = data?.data || {};

    // Also try to fetch wiki rules page if wiki is enabled
    let wikiRulesContent = '';
    if (subData.wiki_enabled) {
      const rulesContent = await getWikiPage(client, subreddit, 'rules');
      if (rulesContent) {
        wikiRulesContent = rulesContent;
      } else {
        // Try index page as fallback
        const indexContent = await getWikiPage(client, subreddit, 'index');
        if (indexContent) {
          wikiRulesContent = indexContent;
        }
      }
    }

    // Combine submit text with wiki content for comprehensive rules
    const combinedSubmitText = [
      subData.submit_text || '',
      wikiRulesContent,
    ].filter(Boolean).join('\n\n---\n\n');

    return {
      subreddit,
      subredditType: subData.subreddit_type || 'public',
      userIsBanned: subData.user_is_banned || false,
      // Only include userIsContributor if Reddit explicitly returns it
      ...(subData.user_is_contributor !== undefined && { userIsContributor: subData.user_is_contributor }),
      userIsSubscriber: subData.user_is_subscriber || false,
      userIsModerator: subData.user_is_moderator || false,
      restrictPosting: subData.restrict_posting || false,
      submissionType: subData.submission_type || 'any',
      allowImages: subData.allow_images !== false,
      allowVideos: subData.allow_videos !== false,
      allowGifs: subData.allow_videogifs !== false,
      // Enhanced text fields
      publicDescription: subData.public_description || '',
      sidebarDescription: subData.description || '',
      submitText: combinedSubmitText,
      // Metadata
      subscribers: subData.subscribers || 0,
      activeUsers: subData.accounts_active || 0,
      wikiEnabled: subData.wiki_enabled || false,
      over18: subData.over18 || false,
      createdUtc: subData.created_utc || 0,
    };
  } catch (error) {
    console.error(`Failed to get enhanced info for r/${subreddit}:`, error);
    // Return safe defaults
    return {
      subreddit,
      subredditType: 'public',
      userIsBanned: false,
      // Don't include userIsContributor - we don't know if verification is required
      userIsSubscriber: false,
      userIsModerator: false,
      restrictPosting: false,
      submissionType: 'any',
      allowImages: true,
      allowVideos: true,
      allowGifs: true,
      publicDescription: '',
      sidebarDescription: '',
      submitText: '',
      subscribers: 0,
      activeUsers: 0,
      wikiEnabled: false,
      over18: false,
      createdUtc: 0,
    };
  }
}
