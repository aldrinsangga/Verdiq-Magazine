import React, { useState } from 'react';
import { Mail, RefreshCw, LogOut } from 'lucide-react';
import { sendVerificationEmail, logout } from '../authClient';
import { useNotification } from './NotificationContext';

interface VerificationRequiredProps {
  email: string;
  onLogout: () => void;
}

const VerificationRequired: React.FC<VerificationRequiredProps> = ({ email, onLogout }) => {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResend = async () => {
    setLoading(true);
    try {
      await sendVerificationEmail();
      setSent(true);
      setTimeout(() => setSent(false), 5000);
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto mt-20 p-12 glass rounded-[60px] border border-slate-800 text-center">
      <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
        <Mail className="w-10 h-10 text-amber-500" />
      </div>
      
      <h2 className="text-3xl font-black mb-4 tracking-tighter text-white">Verify Your Email</h2>
      <p className="text-slate-400 mb-8 leading-relaxed">
        We've sent a verification link to <span className="text-white font-bold">{email}</span>. 
        Please verify your email to access your studio.
      </p>

      <div className="space-y-4">
        <button 
          onClick={() => window.location.reload()}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 text-sm uppercase tracking-widest flex items-center justify-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          I've Verified My Email
        </button>

        <button 
          onClick={handleResend}
          disabled={loading || sent}
          className="text-xs text-slate-500 hover:text-white transition-colors disabled:opacity-50"
        >
          {sent ? 'Verification email sent!' : (
            <>Didn't receive the email? <span className="font-bold">Resend Link</span></>
          )}
        </button>

        <div className="pt-8 border-t border-slate-800/50">
          <button 
            onClick={onLogout}
            className="flex items-center justify-center gap-2 text-xs text-rose-500 hover:text-rose-400 transition-colors mx-auto"
          >
            <LogOut className="w-4 h-4" />
            Sign out and use another account
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerificationRequired;
