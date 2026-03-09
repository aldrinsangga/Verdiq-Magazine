import React, { useState } from 'react';
import { login, signup, requestPasswordReset, saveSession, loginWithGoogle } from '../authClient';
import MFAVerify from './MFAVerify';

const API_URL = import.meta.env.VITE_BACKEND_URL || '';

const Auth = ({ onLogin, onClose }) => {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMFA, setShowMFA] = useState(false);
  const [mfaCredentials, setMfaCredentials] = useState(null);

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError('');
    try {
      const userData = await loginWithGoogle();
      onLogin(userData);
    } catch (err) {
      console.error('Google Auth error:', err);
      setError(err.message || 'Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'signup') {
        const userData = await signup(email, password, name);
        
        // Get full user profile
        try {
          const profileRes = await fetch(`${API_URL}/api/users/${userData.id}`, {
            headers: { 'Authorization': `Bearer ${userData.session?.access_token}` }
          });
          
          if (profileRes.ok) {
            const fullUser = await profileRes.json();
            onLogin({ ...fullUser, session: userData.session });
          } else {
            onLogin(userData);
          }
        } catch (e) {
          console.error('Profile fetch error:', e);
          onLogin(userData);
        }
      } else if (mode === 'login') {
        try {
          const userData = await login(email, password);
          
          // Check if MFA is required
          if (userData.mfa_required) {
            setMfaCredentials({ email, password });
            setShowMFA(true);
            return;
          }
          
          onLogin(userData);
        } catch (err) {
          // Check if it's an MFA required response
          if (err.message && err.message.includes('MFA')) {
            setMfaCredentials({ email, password });
            setShowMFA(true);
            return;
          }
          throw err;
        }
      } else if (mode === 'forgot') {
        await requestPasswordReset(email);
        setError('');
        alert('If an account exists with this email, you will receive a reset link.');
        setMode('login');
      }
    } catch (err) {
      console.error('Auth error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password authentication is not enabled. Please contact the administrator or use Google Sign-In.');
      } else {
        setError(err.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle successful MFA verification
  const handleMFASuccess = async (userData) => {
    saveSession(userData);
    onLogin(userData);
  };

  // Show MFA verification screen
  if (showMFA && mfaCredentials) {
    return (
      <div className="max-w-lg mx-auto mt-32 p-12 glass rounded-[60px] border border-slate-800" data-testid="mfa-verify-form">
        <MFAVerify 
          email={mfaCredentials.email}
          password={mfaCredentials.password}
          onSuccess={handleMFASuccess}
          onCancel={() => {
            setShowMFA(false);
            setMfaCredentials(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto mt-32 p-12 glass rounded-[60px] border border-slate-800" data-testid="auth-form">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-black mb-3 tracking-tighter">
          {mode === 'login' && 'Welcome Back'}
          {mode === 'signup' && 'Create Account'}
          {mode === 'forgot' && 'Reset Password'}
        </h2>
        <p className="text-slate-500 text-sm font-medium">
          {mode === 'login' && 'Enter your credentials to access your studio.'}
          {mode === 'signup' && 'Join the next generation of music critics.'}
          {mode === 'forgot' && 'Enter your email to receive a reset link.'}
        </p>
      </div>

      <form onSubmit={handleAuth} className="space-y-4">
        {mode === 'signup' && (
          <div>
            <label className="block text-[10px] uppercase font-black text-emerald-500 mb-2 ml-1">Full Name</label>
            <input 
              required
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              placeholder="John Doe"
              data-testid="name-input"
            />
          </div>
        )}
        
        <div>
          <label className="block text-[10px] uppercase font-black text-emerald-500 mb-2 ml-1">Email Address</label>
          <input 
            required
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            placeholder="name@example.com"
            data-testid="email-input"
          />
        </div>

        {mode !== 'forgot' && (
          <div>
            <label className="block text-[10px] uppercase font-black text-emerald-500 mb-2 ml-1">Password</label>
            <input 
              required
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              placeholder="••••••••"
              minLength={6}
              data-testid="password-input"
            />
            {mode === 'signup' && (
              <p className="text-[10px] text-slate-500 mt-1 ml-1">Password must be at least 8 characters with uppercase, lowercase, and number</p>
            )}
          </div>
        )}

        {error && <p className="text-xs text-rose-500 font-bold ml-1" data-testid="auth-error">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 text-sm uppercase tracking-widest mt-4"
          data-testid="auth-submit-btn"
        >
          {loading ? 'Processing...' : (
            mode === 'login' ? 'Sign In' : 
            mode === 'signup' ? 'Create Account' : 
            'Send Reset Link'
          )}
        </button>

        {mode !== 'forgot' && (
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-4 text-slate-500 font-bold">Or continue with</span>
            </div>
          </div>
        )}

        {mode !== 'forgot' && (
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full bg-white hover:bg-slate-100 text-slate-950 font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-3 text-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 6.29l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>
        )}
      </form>

      <div className="mt-8 pt-6 border-t border-slate-800/50 text-center space-y-3">
        {mode === 'login' && (
          <>
            <button onClick={() => setMode('signup')} className="text-xs text-slate-400 hover:text-emerald-400 transition-colors border-none bg-transparent">Don't have an account? <span className="font-bold">Sign Up</span></button>
            <br />
            <button onClick={() => setMode('forgot')} className="text-xs text-slate-500 hover:text-white transition-colors border-none bg-transparent">Forgot password?</button>
          </>
        )}
        {mode === 'signup' && (
          <button onClick={() => setMode('login')} className="text-xs text-slate-400 hover:text-emerald-400 transition-colors border-none bg-transparent">Already have an account? <span className="font-bold">Sign In</span></button>
        )}
        {mode === 'forgot' && (
          <button onClick={() => setMode('login')} className="text-xs text-slate-400 hover:text-emerald-400 transition-colors border-none bg-transparent">Back to Login</button>
        )}
      </div>
    </div>
  );
};

export default Auth;
