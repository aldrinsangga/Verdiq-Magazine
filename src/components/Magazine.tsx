import React from 'react';

const Magazine = ({ reviews, onSelect }) => {
  const publishedReviews = reviews.filter(r => r.isPublished);
  const featured = publishedReviews[0];
  const others = publishedReviews.slice(1);

  if (publishedReviews.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-32 text-center" data-testid="empty-magazine">
        <h2 className="text-5xl font-black mb-6">The Newsroom is Empty</h2>
        <p className="text-slate-400 text-xl font-light">
          No artists have published to the magazine yet. Be the first to headline.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-8 py-12" data-testid="magazine">
      {/* Magazine Header */}
      <div className="border-b-4 border-white pb-6 mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <h1 className="text-8xl md:text-[7.8125rem] font-black tracking-tighter leading-[0.8] mb-4">VERDIQ</h1>
          <p className="text-emerald-500 font-bold uppercase tracking-[0.5em] text-xs">Public Artist Marketplace</p>
        </div>
        <div className="text-right">
          <p className="text-slate-500 font-black uppercase text-sm">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">Issue No. 001 — Vol. 1</p>
        </div>
      </div>

      {/* Featured Headline */}
      {featured && (
        <section 
          onClick={() => onSelect(featured)}
          className="group cursor-pointer mb-24 relative"
          data-testid="featured-review"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7">
              <div className="relative rounded-[60px] overflow-hidden aspect-[16/9] shadow-2xl border border-white/5 bg-slate-900">
                <img 
                  src={featured.imageUrl || `https://picsum.photos/seed/${featured.id}/1200/800`} 
                  alt={featured.songTitle}
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 grayscale group-hover:grayscale-0"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
              </div>
            </div>
            <div className="lg:col-span-5">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">Cover Story</span>
                  <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{new Date(featured.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                </div>
                <h2 className="text-5xl md:text-6xl font-black text-white tracking-tighter leading-[0.85] group-hover:gradient-text transition-all">
                  {(featured.headline || 'Featured Story').toUpperCase()}
                </h2>
                <p className="text-slate-400 text-2xl font-light leading-relaxed line-clamp-3 italic">
                  "{featured.hook}"
                </p>
                <div className="flex items-center gap-6 pt-4">
                  <div>
                    <p className="text-white font-bold">{featured.artistName}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Artist</p>
                  </div>
                  <div className="h-8 w-px bg-slate-800" />
                  <div className="flex flex-col">
                    <span className="text-emerald-500 text-2xl font-black">{featured.rating}/10</span>
                    <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Verdiq Score</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Editorial Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-10">
          <h3 className="text-xs font-black uppercase tracking-[0.5em] text-slate-500 border-b border-slate-900 pb-2">Latest Reports</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {others.map(r => (
              <div key={r.id} onClick={() => onSelect(r)} className="group cursor-pointer">
                <div className="aspect-[4/5] rounded-[40px] overflow-hidden mb-8 border border-white/5 shadow-xl relative bg-slate-900">
                  <img src={r.imageUrl} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 group-hover:scale-110" alt={r.songTitle} />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
                  <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                      <span className="text-[10px] text-white font-black uppercase tracking-[0.2em]">{r.analysis?.genre || 'Unknown'}</span>
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500/50 border border-emerald-500/20 px-2 py-0.5 rounded">Marketplace Item</span>
                  </div>
                </div>
                <div className="px-2">
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">
                    {r.artistName} • {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                  <h4 className="text-3xl font-black group-hover:gradient-text transition-all leading-none mb-3 tracking-tighter">{(r.headline || 'Latest Report').toUpperCase()}</h4>
                  <p className="text-slate-400 text-base font-light leading-relaxed line-clamp-2 italic">"{r.hook}"</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-4 border-l border-slate-900 pl-12">
          <h3 className="text-xs font-black uppercase tracking-[0.5em] text-slate-500 border-b border-slate-900 pb-2 mb-6">Technical Radar</h3>
          <div className="space-y-6">
            {publishedReviews.slice(0, 5).map((r, i) => (
              <div key={r.id} onClick={() => onSelect(r)} className="flex items-start gap-4 cursor-pointer group">
                <span className="text-4xl font-black text-slate-800 group-hover:text-emerald-500 transition-colors">0{i+1}</span>
                <div>
                  <h5 className="font-black text-white group-hover:text-emerald-400 leading-none mb-1 uppercase tracking-tight">{r.songTitle}</h5>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{r.artistName}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded text-slate-400">{r.analysis?.tempo || 120} BPM</span>
                    <span className="text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded text-emerald-500 font-bold">{r.analysis?.key || 'C Major'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-12 bg-emerald-500 p-8 rounded-3xl text-slate-950">
            <h4 className="text-3xl font-black leading-none mb-4 tracking-tighter">Submit Your Track</h4>
            <p className="text-sm font-bold mb-6 opacity-80">Get reviewed by the world's first Automated Music Journal. Technical data included.</p>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = '/submit';
              }}
              className="w-full bg-slate-950 text-white font-black py-4 rounded-xl text-sm uppercase tracking-widest hover:bg-slate-800 transition-colors cursor-pointer"
              data-testid="submit-track-btn"
            >
              Submit Track
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Magazine;
