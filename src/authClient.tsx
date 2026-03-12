import { supabase } from './supabaseClient';
import { api } from './services/api';

const SESSION_KEY = 'verdiq_session';

export const saveSession = (userData: any) => {
  try {
    const { history, invoices, ...sessionData } = userData;
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  } catch (e) {
    console.error('Failed to save session', e);
  }
};

export const getSession = () => {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Failed to get session', e);
    return null;
  }
};

export const clearSession = () => {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    console.error('Failed to clear session', e);
  }
};

export const getAuthHeaders = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { 'Authorization': `Bearer ${session.access_token}` };
    }
    const storedSession = getSession();
    if (storedSession?.session?.access_token) {
      return { 'Authorization': `Bearer ${storedSession.session.access_token}` };
    }
    return {};
  } catch (e) {
    console.error('Failed to get auth headers:', e);
    return {};
  }
};

export const safeJson = async (response: Response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("JSON parse error:", text);
    throw new Error("Invalid JSON response");
  }
};

export const getCurrentUser = async () => {
  try {
    const session = getSession();
    if (!session?.id) return null;

    const { data: { session: supaSession } } = await supabase.auth.getSession();
    if (!supaSession) return null;

    return await api.getUser(session.id);
  } catch (e) {
    console.error('Failed to get current user', e);
    return null;
  }
};

export const login = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.session || !data.user) throw new Error('No session returned');

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    if (user?.mfaEnabled) {
      return { mfa_required: true, email };
    }

    const { data: reviews } = await supabase
      .from('reviews')
      .select('*')
      .eq('userId', data.user.id)
      .order('createdAt', { ascending: false });

    const { password: pw, ...safe } = (user || { id: data.user.id, email: data.user.email }) as any;
    const sessionData = {
      ...safe,
      history: reviews || [],
      session: { access_token: data.session.access_token }
    };
    saveSession(sessionData);
    return sessionData;
  } catch (error: any) {
    console.error('Login error:', error);
    throw error;
  }
};

export const signup = async (email: string, password: string, name: string) => {
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    if (!data.user) throw new Error('Signup failed');

    let session = data.session;
    if (!session) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error('Account created. Please try logging in.');
      session = signInData.session;
    }

    const newUser = {
      id: data.user.id,
      email,
      name: name || '',
      credits: 10,
      role: 'user',
      mfaEnabled: false,
      createdAt: new Date().toISOString()
    };

    await supabase.from('users').insert(newUser);

    const sessionData = {
      ...newUser,
      history: [],
      session: { access_token: session!.access_token }
    };
    saveSession(sessionData);
    return sessionData;
  } catch (error: any) {
    console.error('Signup error:', error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await supabase.auth.signOut();
    clearSession();
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

export const forgotPassword = async (email: string) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Password reset error:', error);
    throw error;
  }
};

export const requestPasswordReset = forgotPassword;

export const sendVerificationEmail = async () => {
  return { success: true };
};

export const updateUserProfile = async (userId: string, updates: any) => {
  try {
    const result = await api.updateUser(userId, updates);
    const currentSession = getSession();
    if (currentSession) {
      saveSession({ ...currentSession, ...result });
    }
    return result;
  } catch (error) {
    console.error('Update profile error:', error);
    throw error;
  }
};

export const verifyMFA = async (email: string, password: string, mfaCode: string) => {
  try {
    const userData = await api.verifyMFA(email, password, mfaCode);
    saveSession(userData);
    return userData;
  } catch (error: any) {
    console.error('MFA verification error:', error);
    throw error;
  }
};

export const setupMFA = async () => {
  try {
    return await api.setupMFA();
  } catch (error) {
    console.error('MFA setup error:', error);
    throw error;
  }
};

export const verifyMFASetup = async (code: string) => {
  try {
    return await api.verifyMFASetup(code);
  } catch (error) {
    console.error('MFA verification setup error:', error);
    throw error;
  }
};
