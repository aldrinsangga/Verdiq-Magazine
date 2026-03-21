import React, { useState } from 'react';
import { Search, X } from 'lucide-react';

const Magazine = ({ reviews, onSelect, onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  const allPublished = reviews.filter(r => r.isPublished && !r.isDeleted);
  
  const publishedReviews = allPublished.filter(r => 
    r.songTitle?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.artistName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.headline?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.hook?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const featured = publishedReviews[0];
  const others = publishedReviews.slice(1);

  if (allPublished.length === 0) {
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
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-12" data-testid="magazine">
      {/* Magazine Header */}
      <div className="border-b-4 border-white pb-6 mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <h1 className="text-6xl sm:text-8xl md:text-[7.8125rem] font-black tracking-tighter leading-[0.8] mb-4">VERDIQ</h1>
          <p className="text-emerald-500 font-bold uppercase tracking-[0.5em] text-xs">THE FUTURE OF MUSIC CRITIC</p>
        </div>
        <div className="text-left md:text-right flex flex-col items-start md:items-end gap-4">
          {/* Search Bar */}
          <div className="relative w-full max-w-[220px] group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
            <input 
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-800 rounded-full py-1.5 pl-8 pr-8 text-[10px] text-white focus:outline-none focus:border-emerald-500/50 focus:bg-slate-900 transition-all placeholder:text-slate-600"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}

            {/* No Results Dropdown */}
            {searchQuery && publishedReviews.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-red-500/30 rounded-xl p-3 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2">
                <p className="text-[10px] font-black text-red-400 uppercase tracking-widest text-center">
                  No Results Found
                </p>
              </div>
            )}
          </div>

          <div>
            <p className="text-slate-500 font-black uppercase text-sm">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">Issue No. 001 — Vol. 1</p>
          </div>
        </div>
      </div>

      {/* Featured Headline */}
      {featured && (
        <a 
          href={`/review/${featured.id}`}
          onClick={(e) => {
            e.preventDefault();
            onSelect(featured);
          }}
          className="group block cursor-pointer mb-24 relative rounded-[32px] md:rounded-[60px] overflow-hidden min-h-[600px] md:min-h-[800px] flex items-end"
          data-testid="featured-review"
        >
          <div className="absolute inset-0">
            <img 
              src={featured.imageUrl || `https://picsum.photos/seed/${featured.id}/1200/800`} 
              alt={featured.songTitle}
              className="w-full h-full object-cover transition-all duration-1000 group-hover:scale-105 group-hover:opacity-70"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
          </div>
          
          <div className="relative z-10 p-8 md:p-20 max-w-5xl">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">Cover Story</span>
                <span className="text-white/60 text-[10px] font-black uppercase tracking-widest">{new Date(featured.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
              </div>
              <h2 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tighter leading-[0.8] transition-all review-title-split">
                {(featured.headline || 'Featured Story').toUpperCase()}
              </h2>
              <p className="text-slate-200 text-xl md:text-3xl font-light leading-relaxed line-clamp-3 italic max-w-3xl">
                "{featured.hook}"
              </p>
              <div className="flex items-center gap-8 pt-6">
                <div>
                  <p className="text-white font-black text-2xl uppercase tracking-tighter">{featured.artistName}</p>
                  <p className="text-[10px] text-emerald-500 uppercase font-black tracking-widest">Featured Artist</p>
                </div>
                <div className="h-12 w-px bg-white/20" />
                <div className="flex flex-col">
                  <span className="text-emerald-400 text-4xl font-black">{featured.rating}/10</span>
                  <span className="text-[10px] text-white/60 uppercase font-black tracking-widest">Verdiq Score</span>
                </div>
              </div>
            </div>
          </div>
        </a>
      )}

      {/* Editorial Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-10">
          <h3 className="text-sm font-black uppercase tracking-[0.5em] text-emerald-500 border-b border-slate-900 pb-2">Latest Reports</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
            {others.slice(0, 4).map(r => (
              <a 
                key={r.id} 
                href={`/review/${r.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  onSelect(r);
                }} 
                className="group block cursor-pointer"
              >
                <div className="aspect-[4/5] rounded-[32px] md:rounded-[40px] overflow-hidden mb-8 border border-white/5 shadow-xl relative bg-slate-900">
                  <img 
                    src={r.imageUrl} 
                    className="w-full h-full object-cover transition-all duration-1000 group-hover:scale-110 group-hover:opacity-50" 
                    alt={r.songTitle} 
                    referrerPolicy="no-referrer"
                  />
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
                  <h4 className="text-2xl md:text-3xl font-black transition-all leading-none mb-3 tracking-tighter review-title-split">{(r.headline || 'Latest Report').toUpperCase()}</h4>
                  <p className="text-slate-400 text-base font-light leading-relaxed line-clamp-2 italic">"{r.hook}"</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-4 border-l-0 lg:border-l border-slate-900 pl-0 lg:pl-12 mt-12 lg:mt-0">
          <h3 className="text-sm font-black uppercase tracking-[0.5em] text-emerald-500 border-b border-slate-900 pb-2 mb-6">Trending Now</h3>
          <div className="space-y-6">
            {publishedReviews.slice(0, 5).map((r, i) => (
              <a 
                key={r.id} 
                href={`/review/${r.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  onSelect(r);
                }} 
                className="flex items-start gap-4 cursor-pointer group block"
              >
                <span className="text-4xl font-black text-slate-800 group-hover:text-emerald-500 transition-colors">0{i+1}</span>
                <div>
                  <h5 className="font-black text-white group-hover:text-emerald-400 leading-none mb-1 uppercase tracking-tight">{r.songTitle}</h5>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{r.artistName}</p>
                </div>
              </a>
            ))}
          </div>
          
          <div className="mt-12 bg-emerald-500 p-8 rounded-3xl text-slate-950">
            <h4 className="text-3xl font-black leading-none mb-4 tracking-tighter">Submit Your Track</h4>
            <p className="text-sm font-bold mb-6 opacity-80">Get reviewed by the world's first Automated Music Journal. Technical data included.</p>
            <a 
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onNavigate?.('landing');
              }}
              className="w-full bg-slate-950 text-white font-black py-4 rounded-xl text-sm uppercase tracking-widest hover:bg-slate-800 transition-colors cursor-pointer block text-center"
              data-testid="submit-track-btn"
            >
              Submit Track
            </a>
          </div>
        </aside>
      </div>

      {/* More from Verdiq Magazine - Bottom Section */}
      <div className="mt-16 md:mt-32 pt-12 md:pt-24 border-t border-slate-900">
        <div className="flex items-center justify-between mb-12">
          <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-emerald-500">More from Verdiq Magazine</h3>
          <div className="h-px flex-grow mx-4 md:mx-8 bg-slate-900" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {publishedReviews.slice(0, 8).map(r => (
            <a 
              key={r.id} 
              href={`/review/${r.id}`}
              onClick={(e) => {
                e.preventDefault();
                onSelect(r);
              }} 
              className="group block cursor-pointer"
            >
              <div className="aspect-video rounded-2xl overflow-hidden mb-4 border border-white/5 relative bg-slate-900">
                <img 
                  src={r.imageUrl} 
                  className="w-full h-full object-cover transition-all duration-700 group-hover:opacity-50" 
                  alt={r.songTitle} 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent opacity-60" />
                <div className="absolute bottom-3 left-3">
                  <span className="text-[10px] font-black text-emerald-500">{r.rating}/10</span>
                </div>
              </div>
              <h4 className="font-black text-white group-hover:text-emerald-400 transition-colors leading-tight mb-1 uppercase tracking-tight text-sm">{r.songTitle}</h4>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{r.artistName}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Magazine;
