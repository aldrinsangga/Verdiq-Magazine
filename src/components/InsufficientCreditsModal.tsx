import React from 'react';

const InsufficientCreditsModal = ({ isOpen, onClose, requiredCredits, currentCredits, action, isFreeUser, onBuyCredits }: any) => {
  if (!isOpen) return null;
  
  const isMagazine = action === 'publish';
  const isEdit = action === 'edit';
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 p-8 rounded-[40px] border border-white/10 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-3xl font-black mb-4 tracking-tighter uppercase">Insufficient <span className="text-red-500">Credits.</span></h2>
        <p className="text-slate-400 mb-8 leading-relaxed">
          {isMagazine 
            ? `Publishing to the Magazine requires ${requiredCredits} credits. ` 
            : isEdit
            ? `Editing a review requires ${requiredCredits} credits. `
            : `Generating a review requires ${requiredCredits} credits. `}
          You currently have <span className="text-white font-bold">{currentCredits} credits</span>. 
          Top up your account to continue.
        </p>
        
        <div className="space-y-3">
          <button 
            onClick={() => { onBuyCredits(); onClose(); }} 
            className="w-full py-4 bg-emerald-500 text-slate-950 font-black rounded-2xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all uppercase tracking-widest text-xs"
          >
            Buy Credits
          </button>
          <button 
            onClick={onClose} 
            className="w-full py-4 bg-slate-800 text-slate-400 font-bold rounded-2xl hover:bg-slate-700 transition-all uppercase tracking-widest text-[10px]"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};

export default InsufficientCreditsModal;
