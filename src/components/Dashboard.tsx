import React, { useState } from 'react';

const Dashboard = ({ reviews, onSelect, onUpdateReview, onDeleteReview, onNavigate }) => {
  const [activeTab, setActiveTab] = useState('draft');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteClick = (e, reviewId) => {
    e.stopPropagation();
    setDeleteConfirmId(reviewId);
  };

  const handleConfirmDelete = async (e, review) => {
    e.stopPropagation();
    setDeleteConfirmId(null);
    await onUpdateReview({ ...review, isDeleted: true });
  };

  const handlePermanentDelete = async (e, reviewId) => {
    e.stopPropagation();
    if (onDeleteReview) {
      await onDeleteReview(reviewId);
    }
  };

  const handleCancelDelete = (e) => {
    e.stopPropagation();
    setDeleteConfirmId(null);
  };

  const handleRestore = async (e, review) => {
    e.stopPropagation();
    await onUpdateReview({ ...review, isDeleted: false });
  };

  const handleUnpublish = async (e, review) => {
    e.stopPropagation();
    await onUpdateReview({ ...review, isPublished: false });
    setActiveTab('draft');
  };

  const handlePublish = async (e, review) => {
    e.stopPropagation();
    await onUpdateReview({ ...review, isPublished: true });
    setActiveTab('published');
  };

  const filteredReviews = reviews.filter(r => {
    if (activeTab === 'published') return r.isPublished && !r.isDeleted;
    if (activeTab === 'draft') return !r.isPublished && !r.isDeleted;
    if (activeTab === 'deleted') return r.isDeleted;
    return false;
  });

  const tabs = [
    { id: 'draft', label: 'Draft', count: reviews.filter(r => !r.isPublished && !r.isDeleted).length },
    { id: 'published', label: 'Published', count: reviews.filter(r => r.isPublished && !r.isDeleted).length },
    { id: 'deleted', label: 'Deleted', count: reviews.filter(r => r.isDeleted).length },
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-12 md:py-16" data-testid="dashboard">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b border-white/5 pb-6">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-emerald-500 mb-4">Studio Archives</h2>
          <h3 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase text-white">Your <span className="gradient-text">History</span></h3>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <button 
            onClick={() => onNavigate('referrals')}
            className="px-6 py-2 bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          >
            Get Free Credits
          </button>
          <div className="text-left md:text-right">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Artist Average</p>
            <p className="text-3xl sm:text-4xl font-black text-white">
              {reviews.length > 0 
                ? (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.length).toFixed(1) 
                : '0.0'}
              <span className="text-slate-700 text-xl">/10</span>
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-8 mb-12 border-b border-white/5">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${
              activeTab === tab.id ? 'text-emerald-500' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label} ({tab.count})
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            )}
          </button>
        ))}
      </div>

      {filteredReviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-[10px] font-black uppercase tracking-widest">No {activeTab} articles found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredReviews.map((r) => (
            <div 
              key={r.id} 
              onClick={() => onSelect(r)}
              className="group cursor-pointer"
              data-testid={`review-card-${r.id}`}
            >
              <div className="relative aspect-[4/5] rounded-[24px] md:rounded-[40px] overflow-hidden mb-8 shadow-2xl border border-white/5 bg-slate-900">
                <img 
                  src={r.imageUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745'} 
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
                  alt={r.songTitle} 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-80" />
                
                <div className="absolute top-4 md:top-6 right-4 md:right-6 flex gap-2">
                  {r.isPublished && (
                    <div className="glass px-3 md:px-4 py-1 md:py-1.5 rounded-full border border-emerald-500/30">
                      <span className="text-emerald-500 text-[8px] md:text-[10px] font-black uppercase tracking-widest">Published</span>
                    </div>
                  )}
                  
                  {activeTab === 'deleted' ? (
                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => handleRestore(e, r)}
                        className="glass p-2 rounded-full border border-white/10 hover:border-emerald-500/50 hover:text-emerald-500 transition-all"
                        title="Restore"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      </button>
                      <button 
                        onClick={(e) => handlePermanentDelete(e, r.id)}
                        className="glass p-2 rounded-full border border-white/10 hover:border-red-500/50 hover:text-red-500 transition-all"
                        title="Permanent Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  ) : deleteConfirmId === r.id ? (
                    <div className="glass px-3 py-1 rounded-full border border-red-500/50 flex items-center gap-2">
                      <span className="text-red-500 text-[10px] font-black uppercase tracking-widest">Delete?</span>
                      <button onClick={(e) => handleConfirmDelete(e, r)} className="text-white hover:text-red-500 text-[10px] font-bold">YES</button>
                      <span className="text-white/30">|</span>
                      <button onClick={handleCancelDelete} className="text-white hover:text-slate-300 text-[10px] font-bold">NO</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {activeTab === 'draft' && (
                        <button 
                          onClick={(e) => handlePublish(e, r)}
                          className="glass px-3 md:px-4 py-1 md:py-1.5 rounded-full border border-emerald-500/30 hover:bg-emerald-500/10 transition-all"
                          title="Publish"
                        >
                          <span className="text-emerald-500 text-[8px] md:text-[10px] font-black uppercase tracking-widest">Publish</span>
                        </button>
                      )}
                      {activeTab === 'published' && (
                        <button 
                          onClick={(e) => handleUnpublish(e, r)}
                          className="glass px-3 md:px-4 py-1 md:py-1.5 rounded-full border border-red-500/30 hover:bg-red-500/10 transition-all"
                          title="Unpublish"
                        >
                          <span className="text-red-500 text-[8px] md:text-[10px] font-black uppercase tracking-widest">Unpublish</span>
                        </button>
                      )}
                      <button 
                        onClick={(e) => handleDeleteClick(e, r.id)}
                        className="glass p-2 rounded-full border border-white/10 hover:border-red-500/50 hover:text-red-500 transition-all"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  )}
                </div>

                <div className="absolute bottom-6 md:bottom-8 left-6 md:left-8 right-6 md:right-8">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    <span className="text-[10px] text-white font-black uppercase tracking-[0.2em]">Score: {r.rating}</span>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black text-white tracking-tighter leading-none group-hover:gradient-text transition-all">
                    {r.songTitle.toUpperCase()}
                  </h3>
                </div>
              </div>
              <div className="px-2">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">
                  {r.artistName} • {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
                <p className="text-slate-400 text-base font-light leading-relaxed line-clamp-2 italic">
                  "{r.headline}"
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
