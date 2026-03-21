import React, { useState, useEffect } from 'react';
import { Users, Gift, Share2, Copy, CheckCircle2, Clock, ExternalLink, Twitter, Facebook, MessageSquare } from 'lucide-react';
import { getAuthHeaders } from '../authClient';

const API_URL = (import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL !== 'undefined') 
  ? import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '') 
  : '';

interface Referral {
  id: string;
  referredName: string;
  referredEmail: string;
  status: 'signed_up' | 'completed';
  creditsAwarded: boolean;
  createdAt: string;
}

interface ReferralStats {
  referralCode: string;
  totalReferred: number;
  totalCreditsEarned: number;
  referrals: Referral[];
}

const ReferralDashboard = ({ currentUser, onNavigate }) => {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_URL}/api/referral/stats`, { headers });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (e) {
        console.error('Failed to fetch referral stats:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const FRONTEND_URL = 'https://verdiqmag.com';
  const referralLink = stats ? `${FRONTEND_URL}/?ref=${stats.referralCode}` : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  const shareOnTwitter = () => {
    const text = `Join me on VERDIQ and get professional AI track reviews! Use my link to sign up: ${referralLink}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-16 text-center sticky top-24 z-10 bg-slate-950/80 backdrop-blur-md py-8 -mx-4 px-4 rounded-b-3xl border-b border-slate-800/50">
        <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tighter">Referral Program</h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">Invite other artists to VERDIQ and earn 5 credits for every successful referral.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Users size={20} />
            </div>
            <h3 className="text-slate-400 font-medium">Total Referred</h3>
          </div>
          <p className="text-3xl font-bold text-white">{stats?.totalReferred || 0}</p>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Gift size={20} />
            </div>
            <h3 className="text-slate-400 font-medium">Credits Earned</h3>
          </div>
          <p className="text-3xl font-bold text-white">{stats?.totalCreditsEarned || 0}</p>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Share2 size={20} />
            </div>
            <h3 className="text-slate-400 font-medium">Referral Code</h3>
          </div>
          <p className="text-3xl font-bold text-white tracking-wider">{stats?.referralCode || '---'}</p>
        </div>
      </div>

      {/* Referral Link Card */}
      <div className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-3xl p-8 mb-12">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold text-white mb-4">Share your unique link</h2>
          <p className="text-slate-300 mb-8">
            When an artist signs up using your link and makes their first credit purchase, 
            you'll automatically receive <span className="text-emerald-400 font-bold">5 credits</span>.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="flex-grow relative">
              <input 
                type="text" 
                readOnly 
                value={referralLink}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-slate-300 font-mono text-sm focus:outline-none"
              />
            </div>
            <button 
              onClick={copyToClipboard}
              className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                copying ? 'bg-emerald-500 text-slate-950' : 'bg-slate-100 text-slate-950 hover:bg-white'
              }`}
            >
              {copying ? <CheckCircle2 size={18} /> : <Copy size={18} />}
              {copying ? 'Copied!' : 'Copy Link'}
            </button>
          </div>

          <div className="flex flex-wrap gap-4">
            <button 
              onClick={shareOnTwitter}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <Twitter size={18} />
              Twitter
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
              <Facebook size={18} />
              Facebook
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
              <MessageSquare size={18} />
              WhatsApp
            </button>
          </div>
        </div>
      </div>

      {/* Referrals Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">Your Referrals</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-950/50">
                <th className="px-6 py-4 text-slate-400 font-medium text-sm uppercase tracking-wider">Artist</th>
                <th className="px-6 py-4 text-slate-400 font-medium text-sm uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-slate-400 font-medium text-sm uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-slate-400 font-medium text-sm uppercase tracking-wider">Reward</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {stats?.referrals && stats.referrals.length > 0 ? (
                stats.referrals.map((referral) => (
                  <tr key={referral.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-white font-medium">{referral.referredName || 'New Artist'}</span>
                        <span className="text-slate-500 text-xs">{referral.referredEmail}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-sm">
                      {new Date(referral.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      {referral.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500">
                          <CheckCircle2 size={12} />
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500">
                          <Clock size={12} />
                          Signed Up
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {referral.creditsAwarded ? (
                        <span className="text-emerald-500 font-bold">+5 Credits</span>
                      ) : (
                        <span className="text-slate-500">Pending</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <Users className="text-slate-700 mb-4" size={48} />
                      <p className="text-slate-500 font-medium">No referrals yet.</p>
                      <p className="text-slate-600 text-sm mt-1">Share your link to start earning credits!</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ / Info Section */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-slate-900/30 p-6 rounded-2xl border border-slate-800/50">
          <h3 className="text-white font-bold mb-3">How it works</h3>
          <ul className="space-y-3 text-sm text-slate-400">
            <li className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">1</span>
              Share your unique referral link with fellow artists and producers.
            </li>
            <li className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">2</span>
              They sign up for a VERDIQ account using your link.
            </li>
            <li className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">3</span>
              Once they purchase any credit pack, you get 5 credits instantly.
            </li>
          </ul>
        </div>
        <div className="bg-slate-900/30 p-6 rounded-2xl border border-slate-800/50">
          <h3 className="text-white font-bold mb-3">Rules & Limits</h3>
          <ul className="space-y-3 text-sm text-slate-400">
            <li className="flex gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>
              No limit on the number of artists you can refer.
            </li>
            <li className="flex gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>
              Credits are awarded only on the first purchase of the referred artist.
            </li>
            <li className="flex gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>
              Self-referrals are strictly prohibited and may lead to account suspension.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ReferralDashboard;
