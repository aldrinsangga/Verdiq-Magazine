import React, { useState, useRef, useEffect } from 'react';
import { getAuthHeaders } from '../authClient';

const API_URL = (import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL !== 'undefined') 
  ? import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '') 
  : '';

const CreditCounter = ({ credits, monthlyCredits, plan, isSubscribed, onBuyCredits, onManageSubscription, onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [creditStatus, setCreditStatus] = useState(null);
  const dropdownRef = useRef(null);

  // Use creditStatus from API if available, otherwise fall back to props
  const effectivePlan = creditStatus?.plan || plan || 'curious';
  const effectiveIsSubscribed = creditStatus?.isSubscribed ?? isSubscribed ?? false;
  const effectiveMonthlyCredits = creditStatus?.monthlyCredits || monthlyCredits || 0;
  const effectiveCredits = creditStatus?.credits ?? credits ?? 0;
  
  const lowCredits = effectiveIsSubscribed && effectiveCredits === 0;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchCreditStatus();
  }, [credits]);

  const fetchCreditStatus = async () => {
    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) return;
      
      const res = await fetch(`${API_URL}/api/credits/status`, { headers });
      if (res.ok) {
        const data = await res.json();
        setCreditStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch credit status:', e);
    }
  };

  const getPlanDisplay = () => {
    return 'Artist';
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Credit Counter Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
          lowCredits 
            ? 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20' 
            : 'bg-slate-800 border border-slate-700 text-white hover:bg-slate-700'
        }`}
        data-testid="credit-counter-btn"
      >
        <svg className={`w-4 h-4 ${lowCredits ? 'text-red-500' : 'text-emerald-500'}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
        </svg>
        <span className="font-bold text-sm">
          {effectiveCredits}
        </span>
        {lowCredits && (
          <span className="text-[10px] font-black uppercase bg-red-500 text-white px-2 py-0.5 rounded-full">
            Low
          </span>
        )}
        <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50" data-testid="credit-dropdown">
          {/* Header */}
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">Account Status</span>
              <span className="text-xs font-black uppercase px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500">
                Active
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">
                {effectiveCredits}
              </span>
              <span className="text-sm text-slate-500">credits available</span>
            </div>
          </div>

          {/* Credit Costs */}
          <div className="px-4 py-3 border-b border-slate-800">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Credit Costs</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Review Generation</span>
              <span className="font-bold text-white">10 credits</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-slate-400">Magazine Submission</span>
              <span className="font-bold text-white">5 credits</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-slate-400">Edit Review</span>
              <span className="font-bold text-white">3 credits</span>
            </div>
          </div>

          {/* Low Credits Warning */}
          {lowCredits && (
            <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/20">
              <p className="text-red-400 text-sm font-bold">
                You're out of credits! Buy more to continue generating reviews.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="p-3 space-y-2">
            <button
              onClick={() => { setIsOpen(false); onBuyCredits?.(); }}
              className="w-full bg-emerald-500 text-slate-950 py-3 rounded-xl font-bold hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              data-testid="buy-credits-btn"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Buy More Credits
            </button>
            
            <button
              onClick={() => { setIsOpen(false); onNavigate?.('account'); }}
              className="w-full text-slate-400 py-2 text-sm font-bold hover:text-white transition-colors"
              data-testid="billing-history-btn"
            >
              Billing History
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditCounter;
