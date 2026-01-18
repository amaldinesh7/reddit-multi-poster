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
  url.searchParams.set('scope', 'identity submit read flair mysubreddits');
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
  return data;
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

export async function getFlairs(client: AxiosInstance, subreddit: string): Promise<{ flairs: FlairOption[]; required: boolean }> {
  try {
    // Get subreddit info to check flair requirements
    const [flairsResp, subredditResp] = await Promise.all([
      client.get(`/r/${subreddit}/api/link_flair_v2`, { params: { raw_json: 1 } }),
      client.get(`/r/${subreddit}/about`, { params: { raw_json: 1 } })
    ]);
    
    const flairs = (flairsResp.data as any[]).map((f) => ({ 
      id: f.id, 
      text: f.text, 
      text_editable: !!f.text_editable, 
      richtext: f.richtext 
    }));
    
    // Check if flair is required
    const subredditData = subredditResp.data?.data;
    const required = subredditData?.link_flair_enabled && subredditData?.link_flair_position !== null;
    
    return { flairs, required };
  } catch (error) {
    // Fallback - return empty flairs and assume not required
    return { flairs: [], required: false };
  }
}

export async function uploadMedia(client: AxiosInstance, file: File, subreddit: string): Promise<string> {
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
  const fields = leaseData.args.fields;
  
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
  
  return leaseData.asset.asset_id;
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
  // Handle different post types
  if (params.kind === 'self') {
    form.set('kind', 'self');
  } else if (params.kind === 'link') {
    form.set('kind', 'link');
    form.set('url', params.url || '');
  } else if (params.kind === 'image' || params.kind === 'video') {
    form.set('kind', 'image');
    if (mediaAssetId) {
      form.set('url', `https://reddit-uploaded-media.s3-accelerate.amazonaws.com/${mediaAssetId}`);
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