import React, { useState } from 'react';
import { Shield, QrCode, Key, Check, TriangleAlert, X, Loader2 } from 'lucide-react';
import { auth, getSession, saveSession } from '../authClient';

const API_URL = (import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL !== 'undefined') 
  ? import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '') 
  : '';

const MFASetup = ({ user, session, onMFAEnabled, onClose }) => {
  const [step, setStep] = useState('initial'); // initial, setup, verify, success
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [setupData, setSetupData] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState(false);

  // Check MFA status on mount
  React.useEffect(() => {
    checkMFAStatus();
  }, []);

  const checkMFAStatus = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_URL}/api/auth/mfa/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      setMfaEnabled(data.mfa_enabled);
    } catch (e) {
      console.error('Failed to check MFA status:', e);
    }
  };

  const startSetup = async () => {
    setLoading(true);
    setError(null);
    console.log('MFASetup: Starting MFA setup...');
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_URL}/api/auth/mfa/setup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('MFASetup: Setup response status:', res.status);
      if (!res.ok) {
        const err = await res.json();
        console.error('MFASetup: Setup failed:', err);
        throw new Error(err.detail || 'Failed to setup MFA');
      }
      
      const data = await res.json();
      console.log('MFASetup: Setup data received:', data);
      setSetupData(data);
      setStep('setup');
    } catch (e) {
      console.error('MFASetup: Setup error:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const verifySetup = async () => {
    if (verifyCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }
    
    setLoading(true);
    setError(null);
    console.log('MFASetup: Verifying MFA setup with code:', verifyCode);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_URL}/api/auth/mfa/verify-setup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: verifyCode })
      });
      
      console.log('MFASetup: Verify response status:', res.status);
      if (!res.ok) {
        const err = await res.json();
        console.error('MFASetup: Verify failed:', err);
        throw new Error(err.detail || 'Failed to verify MFA');
      }
      
      const data = await res.json();
      console.log('MFASetup: Verify success data:', data);
      if (data.success) {
        setStep('success');
        setMfaEnabled(true);
        // Update local session to indicate MFA is verified so they don't get logged out on refresh
        const currentSession = getSession();
        if (currentSession) {
          saveSession({ ...currentSession, mfa_verified: true });
        }
        if (onMFAEnabled) onMFAEnabled();
      }
    } catch (e) {
      console.error('MFASetup: Verify error:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeInput = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setVerifyCode(value);
  };

  if (user?.role !== 'admin') {
    return (
      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
        <div className="flex items-center gap-3 text-slate-400">
          <Shield className="w-5 h-5" />
          <span>MFA is only available for admin accounts</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-emerald-500" />
          <h3 className="text-xl font-bold text-white">Two-Factor Authentication</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
          <TriangleAlert className="w-5 h-5 text-red-400" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      {/* Initial State */}
      {step === 'initial' && (
        <div>
          <p className="text-slate-400 mb-6">
            Add an extra layer of security to your admin account by enabling two-factor authentication.
            You'll need an authenticator app like Google Authenticator or Authy.
          </p>
          
          {mfaEnabled ? (
            <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <Check className="w-5 h-5 text-emerald-500" />
              <span className="text-emerald-400">MFA is currently enabled</span>
            </div>
          ) : (
            <button
              onClick={startSetup}
              disabled={loading}
              className="w-full bg-emerald-500 text-slate-950 font-bold py-3 rounded-xl hover:bg-emerald-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Enable Two-Factor Authentication
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Setup State - Show QR Code */}
      {step === 'setup' && setupData && (
        <div>
          <div className="text-center mb-6">
            <p className="text-slate-400 mb-4">
              Scan this QR code with your authenticator app:
            </p>
            <div className="bg-white rounded-xl p-4 inline-block mb-4">
              <img 
                src={setupData.qr_code} 
                alt="MFA QR Code" 
                className="w-48 h-48"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
              <Key className="w-4 h-4" />
              <span>Manual entry key:</span>
            </div>
            <code className="text-emerald-400 font-mono text-sm break-all">
              {setupData.manual_entry_key}
            </code>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Enter the 6-digit code from your authenticator app:
            </label>
            <input
              type="text"
              value={verifyCode}
              onChange={handleCodeInput}
              placeholder="000000"
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest font-mono focus:outline-none focus:border-emerald-500"
              maxLength={6}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('initial')}
              className="flex-1 bg-slate-700 text-white font-bold py-3 rounded-xl hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={verifySetup}
              disabled={loading || verifyCode.length !== 6}
              className="flex-1 bg-emerald-500 text-slate-950 font-bold py-3 rounded-xl hover:bg-emerald-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Verify & Enable
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Success State */}
      {step === 'success' && (
        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-emerald-500" />
          </div>
          <h4 className="text-xl font-bold text-white mb-2">MFA Enabled Successfully!</h4>
          <p className="text-slate-400 mb-6">
            Your account is now protected with two-factor authentication.
            You'll need your authenticator app to log in from now on.
          </p>
          <button
            onClick={() => {
              setStep('initial');
              if (onClose) onClose();
            }}
            className="bg-emerald-500 text-slate-950 font-bold py-3 px-8 rounded-xl hover:bg-emerald-400 transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
};

export default MFASetup;
