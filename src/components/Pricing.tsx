import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_BACKEND_URL || '';

const Pricing = ({ onUpgrade, currentUser, initialTab = 'plans' }) => {
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(initialTab);

  // Handle PayPal return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get('paymentId');
    const payerId = params.get('PayerID');
    const type = params.get('type');
    
    if (paymentId && payerId) {
      if (type === 'topup') {
        executeTopUp(paymentId, payerId);
      } else {
        executePayment(paymentId, payerId);
      }
    }
  }, []);

  const getAuthToken = () => localStorage.getItem('verdiq_token');

  const executePayment = async (paymentId, payerId) => {
    setLoading('executing');
    setError(null);
    
    try {
      const res = await fetch(`${API_URL}/api/subscription/execute`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ paymentId, payerId })
      });
      
      if (res.ok) {
        const data = await res.json();
        window.history.replaceState({}, document.title, window.location.pathname);
        onUpgrade(data);
      } else {
        const err = await res.json();
        setError(err.detail || 'Payment failed');
      }
    } catch (e) {
      setError('Payment processing failed');
    } finally {
      setLoading(null);
    }
  };

  const executeTopUp = async (paymentId, payerId) => {
    setLoading('executing');
    setError(null);
    
    try {
      const res = await fetch(`${API_URL}/api/credits/topup/execute`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ paymentId, payerId })
      });
      
      if (res.ok) {
        const data = await res.json();
        window.history.replaceState({}, document.title, window.location.pathname);
        onUpgrade({ ...data, type: 'topup' });
      } else {
        const err = await res.json();
        setError(err.detail || 'Top-up failed');
      }
    } catch (e) {
      setError('Top-up processing failed');
    } finally {
      setLoading(null);
    }
  };

  const handleSubscribe = async (planId) => {
    if (planId === 'curious') return;
    
    setLoading(planId);
    setError(null);
    
    try {
      const returnUrl = `${window.location.origin}${window.location.pathname}?view=pricing`;
      const cancelUrl = `${window.location.origin}${window.location.pathname}?view=pricing&cancelled=true`;
      
      const res = await fetch(`${API_URL}/api/subscription/create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ planId, returnUrl, cancelUrl })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.error) {
          setError(data.message || 'Payment service unavailable');
          return;
        }
        if (data.approval_url) {
          window.location.href = data.approval_url;
        } else {
          setError('Failed to get payment URL');
        }
      } else {
        const err = await res.json();
        setError(err.detail || 'Failed to create payment');
      }
    } catch (e) {
      setError('Failed to connect to payment service');
    } finally {
      setLoading(null);
    }
  };

  const handleTopUp = async (packageId) => {
    setLoading(packageId);
    setError(null);
    
    try {
      const returnUrl = `${window.location.origin}${window.location.pathname}?view=pricing&type=topup`;
      const cancelUrl = `${window.location.origin}${window.location.pathname}?view=pricing&cancelled=true`;
      
      const res = await fetch(`${API_URL}/api/credits/topup`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ packageId, returnUrl, cancelUrl })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.error) {
          setError(data.message || 'Payment service unavailable');
          return;
        }
        if (data.approval_url) {
          window.location.href = data.approval_url;
        }
      } else {
        const err = await res.json();
        setError(err.detail || 'Failed to create payment');
      }
    } catch (e) {
      setError('Failed to connect to payment service');
    } finally {
      setLoading(null);
    }
  };

  const plans = [
    {
      id: 'curious',
      name: 'Curious',
      price: '$0',
      period: '/month',
      features: [
        '3 credits on signup (one-time)',
        '1 full review to start',
        'Basic analysis only',
        'Web-view only',
      ],
      disabledFeatures: [
        'No PDF download',
        'No priority processing',
        'No magazine publishing'
      ],
      cta: 'Current Plan',
      popular: false,
      disabled: true
    },
    {
      id: 'artist',
      name: 'Artist',
      price: '$12',
      period: '/month',
      credits: '15 credits',
      features: [
        '15 Credits per month',
        'Deep Technical Analysis',
        'SEO Optimizer',
        'Download as PDF',
        'Priority Processing',
        'Publish to Magazine',
        'Podcast Review'
      ],
      cta: 'Upgrade to Artist',
      popular: true
    },
    {
      id: 'label',
      name: 'Label',
      price: '$49',
      period: '/month',
      credits: '60 credits',
      features: [
        '60 Credits per month',
        'Deep Technical Analysis',
        'SEO Optimizer',
        'Download as PDF',
        'Priority Processing',
        'Publish to Magazine',
        'Podcast Review'
      ],
      cta: 'Get Label Access',
      popular: false
    }
  ];

  const topUpPackages = [
    { id: 'topup_10', credits: 10, price: '$10', bonus: null },
    { id: 'topup_25', credits: 25, price: '$20', bonus: '+5 bonus' },
    { id: 'topup_55', credits: 55, price: '$40', bonus: '+15 bonus' },
    { id: 'topup_120', credits: 120, price: '$80', bonus: '+40 bonus', popular: true }
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-8 py-20" data-testid="pricing-section">
      <div className="text-center mb-20">
        <h1 className="text-7xl md:text-8xl font-extrabold mb-8 tracking-tighter leading-none">
          <span className="gradient-text">VERDIQ</span>
        </h1>
        <p className="text-slate-400 max-w-3xl mx-auto text-2xl font-light leading-relaxed italic">
          Professional-grade feedback. Real technical insights. Sharpen your sound and dominate the charts.
        </p>
      </div>

      {error && (
        <div className="max-w-md mx-auto mb-8 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {loading === 'executing' && (
        <div className="max-w-md mx-auto mb-8 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
          <div className="flex items-center justify-center gap-3">
            <svg className="w-5 h-5 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-emerald-400">Processing your payment...</p>
          </div>
        </div>
      )}

      {/* Credit Top-Up */}
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-5xl md:text-6xl font-black text-white mb-4 tracking-tighter uppercase">Buy <span className="text-emerald-500">Credits.</span></h2>
          <p className="text-slate-400 text-xl">Top up your account to generate more reviews and publish to the magazine.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {topUpPackages.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => handleTopUp(pkg.id)}
              disabled={loading === pkg.id}
              className={`relative p-8 rounded-[40px] text-center transition-all flex flex-col items-center justify-center bg-slate-900 border border-white/10 hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/10 hover:border-emerald-500/30 ${
                pkg.popular 
                  ? 'border-emerald-500 ring-1 ring-emerald-500/20 scale-105 z-10' 
                  : ''
              } disabled:opacity-50`}
              data-testid={`topup-${pkg.id}-btn`}
            >
              {pkg.popular && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-950 text-[10px] font-black px-6 py-1.5 rounded-full uppercase tracking-[0.2em] shadow-xl">
                  Best Value
                </span>
              )}
              <p className="text-6xl font-black text-white mb-2 tracking-tighter">{pkg.credits}</p>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-6">Credits</p>
              <p className="text-3xl font-black text-emerald-500 mb-2">{pkg.price}</p>
              {pkg.bonus && (
                <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-widest">{pkg.bonus}</p>
              )}
              {loading === pkg.id && (
                <div className="absolute inset-0 bg-slate-950/80 rounded-[40px] flex items-center justify-center">
                  <svg className="w-8 h-8 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Credit Info */}
        <div className="max-w-3xl mx-auto text-center bg-slate-900/50 rounded-[40px] p-8 border border-slate-800">
          <h3 className="text-2xl font-black text-white mb-8 uppercase tracking-tighter">Credit Usage</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
            <div className="bg-slate-800/50 rounded-3xl p-8 border border-white/5">
              <p className="text-emerald-500 font-black text-5xl mb-2 tracking-tighter">3</p>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Credits per Analysis</p>
              <p className="text-slate-600 text-xs mt-4 leading-relaxed">Includes spectral analysis, editorial review, and podcast generation.</p>
            </div>
            <div className="bg-slate-800/50 rounded-3xl p-8 border border-white/5">
              <p className="text-emerald-500 font-black text-5xl mb-2 tracking-tighter">3</p>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Credits to Publish</p>
              <p className="text-slate-600 text-xs mt-4 leading-relaxed">Publish your review and podcast to the public magazine and global feed.</p>
            </div>
          </div>
          <p className="text-slate-500 text-xs mt-6 font-medium uppercase tracking-[0.2em]">Purchased credits never expire and stay in your studio forever.</p>
        </div>
      </div>

      {/* PayPal Trust Badge */}
      <div className="flex items-center justify-center gap-4 mt-12">
        <div className="flex items-center gap-2 text-slate-500">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42c-.003.02-.007.038-.01.057-1.2 6.152-5.317 8.263-10.575 8.263h-2.678c-.636 0-1.178.466-1.276 1.1l-1.376 8.731-.39 2.476a.566.566 0 0 0 .559.652h3.915c.557 0 1.032-.404 1.12-.95l.046-.238.888-5.635.057-.31a1.136 1.136 0 0 1 1.12-.95h.705c4.564 0 8.135-1.852 9.177-7.207.435-2.24.21-4.11-.94-5.422-.347-.397-.77-.733-1.26-1.005z"/>
          </svg>
          <span className="text-xs font-bold uppercase tracking-widest">Secure payments via PayPal</span>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
