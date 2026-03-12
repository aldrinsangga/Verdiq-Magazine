/**
 * Auth Client for Verdiq - Supabase Authentication
 */
import { supabase } from './supabaseClient';

const API_URL = import.meta.env.VITE_BACKEND_URL || '';

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
    const headers = await getAuthHeaders();
    if (!headers.Authorization) return null;

    const response = await fetch(`${API_URL}/api/users/${getSession()?.id}`, { headers });
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (e) {
    console.error('Failed to get current user', e);
    return null;
  }
};

export const login = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    if (!data.session || !data.user) throw new Error('No session returned');

    const token = data.session.access_token;
    const headers = { 'Authorization': `Bearer ${token}` };

    const response = await fetch(`${API_URL}/api/users/${data.user.id}`, { headers });

    if (response.ok) {
      const userData = await response.json();
      const sessionData = {
        ...userData,
        session: { access_token: token }
      };
      saveSession(sessionData);
      return sessionData;
    } else {
      throw new Error('Failed to fetch user data from backend');
    }
  } catch (error: any) {
    console.error('Login error:', error);
    throw error;
  }
};

export const signup = async (email: string, password: string, name: string) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) throw error;
    if (!data.session || !data.user) throw new Error('Signup failed');

    const token = data.session.access_token;
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    const response = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password, name })
    });

    if (!response.ok) {
      throw new Error('Failed to create user profile');
    }

    const userData = await response.json();
    const sessionData = {
      ...userData,
      session: { access_token: token }
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
  console.log('Email verification is handled automatically by Supabase');
  return { success: true };
};

export const updateUserProfile = async (userId: string, updates: any) => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}/api/users/${userId}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    if (!response.ok) throw new Error('Failed to update profile');

    const updatedUser = await response.json();
    const currentSession = getSession();
    if (currentSession) {
      saveSession({ ...currentSession, ...updatedUser });
    }
    return updatedUser;
  } catch (error) {
    console.error('Update profile error:', error);
    throw error;
  }
};

export const verifyMFA = async (email: string, password: string, mfaCode: string) => {
  try {
    const response = await fetch(`${API_URL}/api/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, mfa_code: mfaCode })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'MFA verification failed');
    }

    const userData = await response.json();
    saveSession(userData);
    return userData;
  } catch (error: any) {
    console.error('MFA verification error:', error);
    throw error;
  }
};

export const setupMFA = async () => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}/api/auth/mfa/setup`, {
      method: 'POST',
      headers
    });

    if (!response.ok) throw new Error('MFA setup failed');
    return await response.json();
  } catch (error) {
    console.error('MFA setup error:', error);
    throw error;
  }
};

export const verifyMFASetup = async (code: string) => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_URL}/api/auth/mfa/verify-setup`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'MFA verification failed');
    }

    return await response.json();
  } catch (error) {
    console.error('MFA verification setup error:', error);
    throw error;
  }
};
