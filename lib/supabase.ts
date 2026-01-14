import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Client-side Supabase client (uses anon key)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

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
  const serviceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
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
