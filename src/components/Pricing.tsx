import React, { useState, useEffect } from 'react';
import { PayPalButtons } from "@paypal/react-paypal-js";
import { getAuthHeaders } from '../authClient';

const API_URL = (import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL !== 'undefined') 
  ? import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '') 
  : '';

const Pricing = ({ onUpgrade, currentUser, paypalClientId }) => {
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const createOrder = async (data, actions, packageId) => {
    setIsProcessing(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/paypal/create-order`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({ packageId })
      });
      
      const order = await res.json();
      if (order.id) {
        return order.id;
      } else {
        throw new Error(order.message || 'Failed to create order');
      }
    } catch (e) {
      setError(e.message || 'Failed to connect to PayPal');
      throw e;
    } finally {
      setIsProcessing(false);
    }
  };

  const onApprove = async (data, actions, packageId) => {
    setLoading('executing');
    setIsProcessing(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/paypal/capture-order`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({ orderId: data.orderID, packageId })
      });
      
      if (res.ok) {
        const result = await res.json();
        onUpgrade({ ...result, type: 'topup' });
      } else {
        const err = await res.json();
        setError(err.message || 'Payment capture failed');
      }
    } catch (e) {
      setError('Payment processing failed');
    } finally {
      setLoading(null);
      setIsProcessing(false);
    }
  };

  const topUpPackages = [
    { id: 'topup_15', credits: 15, price: '$15', bonus: null },
    { id: 'topup_35', credits: 35, price: '$25', bonus: '+10 bonus' },
    { id: 'topup_80', credits: 80, price: '$50', bonus: '+30 bonus' },
    { id: 'topup_140', credits: 140, price: '$85', bonus: '+55 bonus', popular: true }
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-8 py-20" data-testid="pricing-section">
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
            <div
              key={pkg.id}
              className={`relative p-8 rounded-[40px] text-center transition-all flex flex-col items-center bg-slate-900 border border-white/10 ${
                pkg.popular 
                  ? 'border-emerald-500 ring-1 ring-emerald-500/20 scale-105 z-10' 
                  : ''
              }`}
            >
              {pkg.popular && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-950 text-[10px] font-black px-6 py-1.5 rounded-full uppercase tracking-[0.2em] shadow-xl">
                  Best Value
                </span>
              )}
              <p className="text-6xl font-black text-white mb-2 tracking-tighter">{pkg.credits}</p>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-6">Credits</p>
              <p className="text-3xl font-black text-emerald-500 mb-8">{pkg.price}</p>
              
              <div className="mt-auto w-full min-h-[100px] flex flex-col gap-4">
                <div className="relative">
                  {isProcessing && loading === pkg.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-2xl z-10">
                      <div className="w-5 h-5 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                    </div>
                  )}
                  <PayPalButtons 
                    style={{ 
                      layout: "vertical", 
                      color: "gold", 
                      shape: "pill", 
                      label: "pay",
                      height: 40,
                      tagline: false
                    }}
                    createOrder={(data, actions) => {
                      setLoading(pkg.id);
                      return createOrder(data, actions, pkg.id);
                    }}
                    onApprove={(data, actions) => onApprove(data, actions, pkg.id)}
                    onCancel={() => setLoading(null)}
                    onError={(err) => {
                      console.error("PayPal Error:", err);
                      setError("Payment failed. Please try again.");
                      setLoading(null);
                    }}
                  />
                </div>
                {pkg.bonus && (
                  <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-widest">{pkg.bonus}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Credit Info */}
        <div className="max-w-3xl mx-auto text-center bg-slate-900/50 rounded-[40px] p-8 border border-slate-800">
          <h3 className="text-2xl font-black text-white mb-8 uppercase tracking-tighter">Credit Usage</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
            <div className="bg-slate-800/50 rounded-3xl p-8 border border-white/5">
              <p className="text-emerald-500 font-black text-5xl mb-2 tracking-tighter">10</p>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Credits per Analysis</p>
              <p className="text-slate-600 text-xs mt-4 leading-relaxed">Includes spectral analysis, editorial review, and podcast generation.</p>
            </div>
            <div className="bg-slate-800/50 rounded-3xl p-8 border border-white/5">
              <p className="text-emerald-500 font-black text-5xl mb-2 tracking-tighter">5</p>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Credits to Publish</p>
              <p className="text-slate-600 text-xs mt-4 leading-relaxed">Publish your review and podcast to the public magazine and global feed.</p>
            </div>
            <div className="bg-slate-800/50 rounded-3xl p-8 border border-white/5">
              <p className="text-emerald-500 font-black text-5xl mb-2 tracking-tighter">3</p>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Credits to Edit</p>
              <p className="text-slate-600 text-xs mt-4 leading-relaxed">Edit your generated reviews to perfect the narrative.</p>
            </div>
          </div>
          <p className="text-slate-500 text-xs mt-6 font-medium uppercase tracking-[0.2em]">Purchased credits never expire and stay in your studio forever.</p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
