import React from 'react';

interface ReviewModalsProps {
  showSubscribeModal: boolean;
  setShowSubscribeModal: (show: boolean) => void;
  onUpgrade: () => void;
  showShareModal: boolean;
  setShowShareModal: (show: boolean) => void;
  getShareUrl: () => string;
  handleCopyLink: () => void;
  copySuccess: boolean;
  handleNativeShare: () => void;
}

const ReviewModals: React.FC<ReviewModalsProps> = ({
  showSubscribeModal,
  setShowSubscribeModal,
  onUpgrade,
  showShareModal,
  setShowShareModal,
  getShareUrl,
  handleCopyLink,
  copySuccess,
  handleNativeShare
}) => {
  return (
    <>
      {/* Subscribe Modal */}
      {showSubscribeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowSubscribeModal(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-2xl font-black text-center mb-2">Upgrade to Publish</h3>
            <p className="text-slate-400 text-center mb-6">
              Publishing to the Verdiq Magazine is available for Pro subscribers. Upgrade now to share your reviews with the world.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowSubscribeModal(false)}
                className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-700 transition-colors"
                data-testid="cancel-subscribe-btn"
              >
                Cancel
              </button>
              <button 
                onClick={() => { setShowSubscribeModal(false); onUpgrade(); }}
                className="flex-1 bg-emerald-500 text-slate-950 py-3 rounded-xl font-bold hover:bg-emerald-400 transition-colors"
                data-testid="upgrade-now-btn"
              >
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowShareModal(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-black text-center mb-6">Share Review</h3>
            
            <div className="mb-4">
              <label className="text-xs font-bold uppercase text-slate-500 mb-2 block">Review URL</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={getShareUrl()} 
                  readOnly 
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-300 outline-none"
                  data-testid="share-url-input"
                />
                <button 
                  onClick={handleCopyLink}
                  className={`px-4 py-3 rounded-xl font-bold transition-colors ${copySuccess ? 'bg-green-500 text-white' : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'}`}
                  data-testid="copy-url-btn"
                >
                  {copySuccess ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {navigator.share && (
              <button 
                onClick={handleNativeShare}
                className="w-full bg-slate-800 border border-slate-700 py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-700 transition-colors mb-4"
                data-testid="native-share-btn"
              >
                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span className="font-bold">Share via Apps</span>
              </button>
            )}

            <button 
              onClick={() => setShowShareModal(false)}
              className="w-full text-slate-400 py-3 font-bold hover:text-white transition-colors"
              data-testid="close-share-modal-btn"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ReviewModals;
