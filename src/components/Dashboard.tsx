import React from 'react';

const Dashboard = ({ reviews, onSelect }) => {
  if (!reviews || reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500" data-testid="empty-dashboard">
        <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
        <p>No tracks analyzed yet. Start by uploading a track above.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-8 py-16" data-testid="dashboard">
      <div className="flex items-end justify-between mb-12 border-b border-white/5 pb-6">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-emerald-500 mb-4">Studio Archives</h2>
          <h3 className="text-6xl font-black tracking-tighter uppercase text-white">Your <span className="gradient-text">History</span></h3>
        </div>
        <div className="text-right">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Artist Average</p>
          <p className="text-4xl font-black text-white">{(reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.length).toFixed(1)}<span className="text-slate-700 text-xl">/10</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {reviews.map((r) => (
          <div 
            key={r.id} 
            onClick={() => onSelect(r)}
            className="group cursor-pointer"
            data-testid={`review-card-${r.id}`}
          >
            <div className="relative aspect-[4/5] rounded-[40px] overflow-hidden mb-8 shadow-2xl border border-white/5 bg-slate-900">
              <img src={r.imageUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745'} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" alt={r.songTitle} />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-80" />
              
              {r.isPublished && (
                <div className="absolute top-6 right-6 glass px-4 py-1.5 rounded-full border border-emerald-500/30">
                  <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">Published</span>
                </div>
              )}

              <div className="absolute bottom-8 left-8 right-8">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  <span className="text-[10px] text-white font-black uppercase tracking-[0.2em]">Score: {r.rating}</span>
                </div>
                <h3 className="text-3xl font-black text-white tracking-tighter leading-none group-hover:gradient-text transition-all">
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
    </div>
  );
};

export default Dashboard;
