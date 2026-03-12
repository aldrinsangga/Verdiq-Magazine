import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    }

    _supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return _supabase;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as any)[prop];
  }
});

export const verifyJWT = async (token: string): Promise<{ userId: string; email?: string } | null> => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.warn('[Supabase] JWT verification failed:', error?.message);
      return null;
    }

    return {
      userId: user.id,
      email: user.email
    };
  } catch (error) {
    console.error('[Supabase] JWT verification error:', error);
    return null;
  }
};

export const getUserById = async (userId: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[Supabase] Error fetching user:', error);
    return null;
  }

  return data;
};

export const getUserByEmail = async (email: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('[Supabase] Error fetching user by email:', error);
    return null;
  }

  return data;
};

export const uploadToStorage = async (
  fileBuffer: Buffer,
  path: string,
  mimeType: string
): Promise<string> => {
  try {
    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(path, fileBuffer, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      throw error;
    }

    const { data: urlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(path);

    return urlData.publicUrl;
  } catch (error) {
    console.error('[Supabase] Storage upload error:', error);
    throw error;
  }
};

export default supabase;
