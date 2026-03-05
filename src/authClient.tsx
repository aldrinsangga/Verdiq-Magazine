/**
 * Auth Client for Verdiq - MongoDB/JWT Based Authentication
 * Replaces Supabase auth with localStorage-based session management
 */

const API_URL = import.meta.env.VITE_BACKEND_URL || '';

// Session storage key
const SESSION_KEY = 'verdiq_session';

/**
 * Save session data to localStorage
 */
export const saveSession = (userData) => {
  try {
    const { history, invoices, ...sessionData } = userData;
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  } catch (e) {
    console.error('Failed to save session:', e);
  }
};

/**
 * Get session data from localStorage
 */
export const getSession = () => {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Failed to get session:', e);
    return null;
  }
};

/**
 * Clear session from localStorage
 */
export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

/**
 * Get auth headers for API calls
 */
export const getAuthHeaders = () => {
  const session = getSession();
  if (session?.session?.access_token) {
    return { 'Authorization': `Bearer ${session.session.access_token}` };
  }
  return {};
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = () => {
  const session = getSession();
  return !!(session?.session?.access_token);
};

/**
 * Login user
 */
export const login = async (email, password) => {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await res.json();
  
  if (!res.ok) {
    throw new Error(data.detail || 'Login failed');
  }
  
  // Save session to localStorage
  saveSession(data);
  
  return data;
};

/**
 * Signup user
 */
export const signup = async (email, password, name) => {
  const res = await fetch(`${API_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: name || email.split('@')[0] })
  });
  
  const data = await res.json();
  
  if (!res.ok) {
    throw new Error(data.detail || 'Signup failed');
  }
  
  // Save session to localStorage
  saveSession(data);
  
  return data;
};

/**
 * Logout user
 */
export const logout = async () => {
  try {
    const headers = getAuthHeaders();
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers
    });
  } catch (e) {
    console.error('Logout API error:', e);
  }
  clearSession();
};

/**
 * Get current user from API
 */
export const getCurrentUser = async () => {
  const session = getSession();
  if (!session?.id || !session?.session?.access_token) {
    return null;
  }
  
  try {
    const res = await fetch(`${API_URL}/api/users/${session.id}`, {
      headers: getAuthHeaders()
    });
    
    if (res.ok) {
      const userData = await res.json();
      return { ...userData, session: session.session };
    }
  } catch (e) {
    console.error('Failed to get current user:', e);
  }
  
  return null;
};

/**
 * Request password reset (placeholder - would need backend implementation)
 */
export const requestPasswordReset = async (email) => {
  // For now, just inform user - actual implementation would require email service
  console.log('Password reset requested for:', email);
  return { success: true, message: 'If an account exists with this email, you will receive a reset link.' };
};

export default {
  saveSession,
  getSession,
  clearSession,
  getAuthHeaders,
  isAuthenticated,
  login,
  signup,
  logout,
  getCurrentUser,
  requestPasswordReset
};
