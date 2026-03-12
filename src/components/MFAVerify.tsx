import React, { useState } from 'react';
import { Shield, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';

const MFAVerify = ({ email, password, onSuccess, onCancel }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCodeInput = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
    setError(null);
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userData = await api.verifyMFA(email, password, code);
      onSuccess(userData);
    } catch (e: any) {
      setError(e.message);
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && code.length === 6) {
      handleVerify();
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Two-Factor Authentication</h2>
        <p className="text-slate-400">
          Enter the 6-digit code from your authenticator app
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      <div className="mb-6">
        <input
          type="text"
          value={code}
          onChange={handleCodeInput}
          onKeyPress={handleKeyPress}
          placeholder="000000"
          className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-4 text-white text-center text-3xl tracking-[0.5em] font-mono focus:outline-none focus:border-emerald-500 placeholder:tracking-[0.5em]"
          maxLength={6}
          autoFocus
          disabled={loading}
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex-1 bg-slate-700 text-white font-bold py-3 rounded-xl hover:bg-slate-600 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleVerify}
          disabled={loading || code.length !== 6}
          className="flex-1 bg-emerald-500 text-slate-950 font-bold py-3 rounded-xl hover:bg-emerald-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Verifying...
            </>
          ) : (
            'Verify'
          )}
        </button>
      </div>

      <p className="text-center text-slate-500 text-sm mt-6">
        Open your authenticator app to view your verification code
      </p>
    </div>
  );
};

export default MFAVerify;
