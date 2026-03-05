import React, { useState } from 'react';
import { login, signup, requestPasswordReset, saveSession } from '../authClient';
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
      setError(err.message || 'Authentication failed. Please try again.');
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
