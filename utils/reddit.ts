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
  const { data } = await axios.post<RedditToken>(REDDIT_OAUTH_TOKEN, form, {
    headers: {
      'Authorization': `Basic ${basic}`,
      'User-Agent': process.env.REDDIT_USER_AGENT!,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  return data;
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

export async function listMySubreddits(client: AxiosInstance): Promise<string[]> {
  const subs: string[] = [];
  let after: string | undefined = undefined;
  do {
    const resp = await client.get<any>('/subreddits/mine/subscriber', { params: { limit: 100, after } });
    const data: any = resp.data;
    const children: any[] = data?.data?.children || [];
    for (const c of children) subs.push(c?.data?.display_name);
    after = data?.data?.after || undefined;
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

export interface SubmitParams {
  subreddit: string;
  title: string;
  kind: 'self' | 'link' | 'image' | 'video';
  text?: string;
  url?: string;
  flair_id?: string;
  nsfw?: boolean;
  spoiler?: boolean;
  // For file uploads
  file?: File;
  media_asset?: string; // Reddit media asset ID
}

export async function submitPost(client: AxiosInstance, params: SubmitParams): Promise<{ url: string; id: string }>
{
  let mediaAssetId = params.media_asset;
  
  // If file is provided, upload it first
  if (params.file && !mediaAssetId) {
    console.log('Uploading file to Reddit...', params.file.name);
    mediaAssetId = await uploadMedia(client, params.file, params.subreddit);
    console.log('File uploaded, asset ID:', mediaAssetId);
  }
  
  const form = new URLSearchParams();
  form.set('api_type', 'json');
  form.set('sr', params.subreddit);
  form.set('title', params.title);
  form.set('resubmit', 'true');
  form.set('sendreplies', 'true');
  
  // Handle different post types
  if (params.kind === 'self' && params.text) {
    form.set('kind', 'self');
    form.set('text', params.text);
  } else if (params.kind === 'link' && params.url) {
    form.set('kind', 'link');
    form.set('url', params.url);
  } else if ((params.kind === 'image' || params.kind === 'video') && mediaAssetId) {
    form.set('kind', 'image');
    form.set('url', `https://reddit-uploaded-media.s3-accelerate.amazonaws.com/${mediaAssetId}`);
  } else {
    // Fallback to self post if no content
    form.set('kind', 'self');
    form.set('text', params.text || '');
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

export function addPrefixesToTitle(title: string, opts: { f?: boolean; c?: boolean; oc?: boolean }): string {
  const parts: string[] = [];
  if (opts.f) parts.push('(f)');
  if (opts.c) parts.push('(c)');
  if (opts.oc) parts.push('[OC]');
  return [parts.join(' '), title].filter(Boolean).join(' ').trim().replace(/\s+/g, ' ');
} 