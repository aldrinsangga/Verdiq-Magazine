import React, { useState } from 'react';
import { login, signup, requestPasswordReset, saveSession, sendVerificationEmail } from '../authClient';
import MFAVerify from './MFAVerify';

const API_URL = (import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL !== 'undefined') 
  ? import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '') 
  : '';

const Auth = ({ onLogin, onClose, initialMode = 'login' }) => {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [website, setWebsite] = useState(''); // Honeypot field
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMFA, setShowMFA] = useState(false);
  const [mfaCredentials, setMfaCredentials] = useState(null);
  const [verificationSent, setVerificationSent] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'signup') {
        const referralCode = sessionStorage.getItem('referralCode') || '';
        const userData = await signup(email, password, name, website, referralCode);
        setVerificationSent(true);
        // Clear referral code after successful signup
        sessionStorage.removeItem('referralCode');
        // We don't call onLogin yet because they need to verify email
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
        setError('If an account exists with this email, you will receive a reset link shortly.');
        setMode('login');
      }
    } catch (err) {
      console.error('Auth error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password authentication is not enabled. Please contact the administrator.');
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

  // Show Verification Sent screen
  if (verificationSent) {
    return (
      <div className="max-w-lg mx-auto mt-32 p-12 glass rounded-[60px] border border-slate-800 text-center" data-testid="verification-sent">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
          <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-3xl font-black mb-4 tracking-tighter">Check Your Email</h2>
        <p className="text-slate-400 mb-8 leading-relaxed">
          We've sent a verification link to <span className="text-white font-bold">{email}</span>. 
          Please click the link to activate your account.
        </p>
        <div className="space-y-4">
          <button 
            onClick={() => {
              setVerificationSent(false);
              setMode('login');
            }}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 text-sm uppercase tracking-widest"
          >
            Go to Login
          </button>
          <button 
            onClick={async () => {
              try {
                await sendVerificationEmail();
                setError('Verification email resent! Please check your inbox.');
              } catch (err) {
                setError(err.message);
              }
            }}
            className="text-xs text-slate-500 hover:text-white transition-colors"
          >
            Didn't receive the email? <span className="font-bold">Resend</span>
          </button>
        </div>
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
          <>
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
            {/* Honeypot field - hidden from users */}
            <div className="hidden" aria-hidden="true">
              <input 
                type="text" 
                name="website" 
                tabIndex={-1} 
                autoComplete="off" 
                value={website}
                onChange={e => setWebsite(e.target.value)}
              />
            </div>
          </>
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
