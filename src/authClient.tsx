/**
 * Auth Client for Verdiq - Firebase Based Authentication
 */
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  User,
  sendEmailVerification
} from 'firebase/auth';
import { auth } from './firebase';

const API_URL = (import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL !== 'undefined') 
  ? import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '') 
  : '';

// Session storage key
const SESSION_KEY = 'verdiq_session';

/**
 * Save session data to localStorage
 */
export const saveSession = (userData: any) => {
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
 * Helper to get ID token with retry logic for network errors
 */
export const getIdTokenWithRetry = async (user: User, forceRefresh = false, maxRetries = 3) => {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      return await user.getIdToken(forceRefresh);
    } catch (e: any) {
      retries++;
      console.error(`[getIdTokenWithRetry] Attempt ${retries} failed:`, e);
      
      // If it's a network error, wait a bit and retry
      if (e.code === 'auth/network-request-failed' && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        continue;
      }
      
      // If we failed after retries or it's not a network error, throw
      throw e;
    }
  }
  throw new Error('Failed to get ID token after retries');
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
export const getAuthHeaders = async (forceRefresh = false) => {
  // Wait for auth to initialize if it hasn't yet
  let user = auth.currentUser;
  
  if (!user) {
    // Wait for auth to initialize (max 5 seconds for slow connections)
    await new Promise(resolve => {
      const unsubscribe = onAuthStateChanged(auth, (u) => {
        user = u;
        unsubscribe();
        resolve(null);
      });
      // Increased timeout to 5 seconds
      setTimeout(() => {
        unsubscribe();
        resolve(null);
      }, 5000);
    });
  }

  if (user) {
    try {
      const token = await getIdTokenWithRetry(user, forceRefresh);
      return { 'Authorization': `Bearer ${token}` };
    } catch (e: any) {
      console.error(`[getAuthHeaders] Failed to get token:`, e);
    }
  }

  // Fallback to stored session token ONLY as a last resort if no Firebase user is available
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
 * Safely parse JSON from a response
 */
export const safeJson = async (res: Response) => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('Failed to parse JSON response:', text);
    throw new Error(`Server returned non-JSON response: ${res.status} ${res.statusText}`);
  }
};

/**
 * Login user
 */
export const login = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const token = await user.getIdToken();
    
    // Fetch user profile from our API
    const res = await fetch(`${API_URL}/api/users/${user.uid}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) {
      // If user doesn't exist in our DB but exists in Firebase Auth, create them
      const signupRes = await fetch(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email, password, name: user.displayName || email.split('@')[0], id: user.uid })
      });
      const signupData = await safeJson(signupRes);
      
      if (!signupRes.ok) {
        throw new Error(signupData.detail || signupData.message || 'Failed to create user profile');
      }
      
      saveSession({ ...signupData, session: { access_token: token } });
      return { ...signupData, session: { access_token: token } };
    }
    
    const userData = await safeJson(res);
    console.log(`[Login] User data fetched successfully for ${user.uid}`, { mfaEnabled: userData.mfaEnabled });
    
    // Check if MFA is enabled for this user
    if (userData.mfaEnabled) {
      console.log(`[Login] MFA is enabled for user ${user.uid}, returning mfa_required`);
      return { mfa_required: true, email: userData.email || user.email };
    }

    const sessionData = {
      ...userData,
      email: userData.email || user.email,
      session: { access_token: token }
    };
    
    saveSession(sessionData);
    return sessionData;
  } catch (error: any) {
    let errorMessage = error.message;
    if (error.code === 'auth/invalid-credential') {
      errorMessage = 'Invalid email or password. Please try again.';
    }
    
    console.error('Login error details:', {
      code: error.code,
      message: error.message,
      config: {
        projectId: auth.app.options.projectId,
        authDomain: auth.app.options.authDomain
      }
    });
    throw { ...error, message: errorMessage };
  }
};

/**
 * Signup user
 */
export const signup = async (email, password, name, website = "", referralCode = "") => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  await updateProfile(user, { displayName: name });
  
  // Send verification email
  await sendEmailVerification(user);
  
  const res = await fetch(`${API_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      email, 
      password, 
      name: name || email.split('@')[0],
      id: user.uid, // Use Firebase UID
      website, // Honeypot field
      referralCode
    })
  });
  
  const data = await safeJson(res);
  
  if (!res.ok) {
    throw new Error(data.detail || data.message || 'Signup failed');
  }
  
  saveSession(data);
  return data;
};

/**
 * Send verification email to current user
 */
export const sendVerificationEmail = async () => {
  if (auth.currentUser) {
    await sendEmailVerification(auth.currentUser);
  }
};

/**
 * Check if the current user's email is verified
 */
export const isEmailVerified = () => {
  return auth.currentUser?.emailVerified || false;
};

/**
 * Logout user
 */
export const logout = async () => {
  await signOut(auth);
  clearSession();
};

/**
 * Get current user from API
 */
export const getCurrentUser = async () => {
  return new Promise((resolve) => {
    let resolved = false;
    
    // Set a timeout to prevent hanging if onAuthStateChanged never fires
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (typeof unsubscribe === 'function') unsubscribe();
        console.warn('[getCurrentUser] Auth state check timed out');
        resolve(null);
      }
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      unsubscribe();
      
      if (user) {
        try {
          const token = await getIdTokenWithRetry(user);
          const res = await fetch(`${API_URL}/api/users/${user.uid}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (res.ok) {
            const userData = await safeJson(res);
            
            // Check if MFA is enabled but not verified in this session
            const session = getSession();
            if (userData.mfaEnabled && !session?.mfa_verified) {
              console.log(`[getCurrentUser] MFA is enabled but not verified in session for user ${user.uid}. Logging out.`);
              await signOut(auth);
              clearSession();
              resolve(null);
              return;
            }

            const fullUser = { 
              ...userData, 
              email: userData.email || user.email,
              session: { access_token: token } 
            };
            saveSession(fullUser);
            resolve(fullUser);
          } else {
            resolve(null);
          }
        } catch (e) {
          console.error('Failed to get current user:', e);
          resolve(null);
        }
      } else {
        clearSession();
        resolve(null);
      }
    });
  });
};

/**
 * Request password reset
 */
export const requestPasswordReset = async (email) => {
  await sendPasswordResetEmail(auth, email);
  return { success: true };
};

/**
 * Check if the user is an admin
 */
export const isAdmin = (user: any) => {
  if (!user) return false;
  
  const adminEmails = [
    'verdiqmag@gmail.com'
  ];
  
  const email = (user.email || auth.currentUser?.email || '').toLowerCase();
  
  return user.role === 'admin' || adminEmails.includes(email);
};

export { auth };

export default {
  saveSession,
  getSession,
  clearSession,
  getAuthHeaders,
  isAuthenticated,
  isAdmin,
  login,
  signup,
  logout,
  getCurrentUser,
  requestPasswordReset,
  sendVerificationEmail,
  isEmailVerified
};
