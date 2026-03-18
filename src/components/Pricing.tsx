import React, { useState, useEffect } from 'react';
import { PayPalButtons } from "@paypal/react-paypal-js";
import { getAuthHeaders } from '../authClient';

const API_URL = (import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL !== 'undefined') 
  ? import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '') 
  : '';

const Pricing = ({ onUpgrade, currentUser, paypalClientId }) => {
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [checkoutItem, setCheckoutItem] = useState(null); // { id: string, name: string, price: string }
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset processing state when checkout item changes
  useEffect(() => {
    if (checkoutItem) {
      setIsProcessing(false);
    }
  }, [checkoutItem]);

  const handleTopUp = (packageId) => {
    const pkg = topUpPackages.find(p => p.id === packageId);
    setCheckoutItem({ id: packageId, name: `${pkg.credits} Credits`, price: pkg.price });
  };

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
        // Small delay before closing modal to allow PayPal SDK to finish cleanup
        setTimeout(() => {
          setCheckoutItem(null);
        }, 500);
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
              className={`relative p-8 rounded-[40px] text-center transition-all flex flex-col items-center justify-center bg-slate-900 border border-white/10 ${
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
              <p className="text-3xl font-black text-emerald-500 mb-6">{pkg.price}</p>
              
              <button
                onClick={() => handleTopUp(pkg.id)}
                className="mt-auto w-full py-4 bg-emerald-500 text-slate-950 rounded-full font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
              >
                Select
              </button>

              {pkg.bonus && (
                <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-widest mt-4">{pkg.bonus}</p>
              )}
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

      {/* Checkout Modal */}
      {checkoutItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={() => setCheckoutItem(null)}></div>
          <div className="relative w-full max-w-md max-h-[90vh] bg-slate-900 border border-white/10 rounded-[40px] p-10 shadow-2xl overflow-y-auto">
            <button 
              onClick={() => setCheckoutItem(null)}
              className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors z-10"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-8">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-400 mb-2">Secure Checkout</p>
              <h3 className="text-3xl font-black text-white uppercase tracking-tighter">{checkoutItem.name}</h3>
              <p className="text-slate-300 mt-2 text-sm font-medium">Complete your purchase via PayPal</p>
            </div>

            <div className="bg-slate-950/80 rounded-3xl p-6 mb-8 border border-white/10">
              <div className="flex justify-between items-center mb-3">
                <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Item</span>
                <span className="text-white font-bold text-sm">{checkoutItem.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Total Amount</span>
                <span className="text-emerald-400 font-black text-3xl tracking-tighter">{checkoutItem.price}</span>
              </div>
            </div>

            <div className="min-h-[150px] bg-white rounded-3xl p-6 shadow-inner relative">
              {isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-3xl z-10">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Processing...</p>
                  </div>
                </div>
              )}
              
              <PayPalButtons 
                style={{ 
                  layout: "vertical", 
                  color: "blue", 
                  shape: "pill", 
                  label: "pay",
                  height: 45
                }}
                createOrder={(data, actions) => createOrder(data, actions, checkoutItem.id)}
                onApprove={(data, actions) => onApprove(data, actions, checkoutItem.id)}
                onCancel={() => {
                  setTimeout(() => setCheckoutItem(null), 500);
                }}
                onError={(err) => {
                  console.error("PayPal Error:", err);
                  setError("PayPal checkout failed. Please try again.");
                  setTimeout(() => setCheckoutItem(null), 500);
                }}
              />
            </div>

            <p className="text-[10px] text-slate-400 text-center mt-8 font-bold uppercase tracking-widest">
              Secure encrypted transaction
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pricing;
