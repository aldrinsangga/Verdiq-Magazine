import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Share2, TrendingUp, Clock, Headphones } from 'lucide-react';
import { api } from '../services/api';

const Podcasts = ({ reviews, onSelectReview, initialPodcastId, fetchReviewWithAudio }) => {
  // Filter reviews that have podcast and are published
  const podcastReviews = reviews.filter(r => (r.podcastAudio || r.hasPodcast || r.podcastAudioUrl) && r.isPublished && !r.isDeleted);
  const [activeId, setActiveId] = useState(initialPodcastId || podcastReviews[0]?.id || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrls, setAudioUrls] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [playCounts, setPlayCounts] = useState({});
  const audioRef = useRef(null);

  // Update URL when podcast changes
  useEffect(() => {
    if (activeId) {
      const newPath = `/podcasts/${activeId}`;
      if (window.location.pathname !== newPath) {
        window.history.pushState({ podcastId: activeId }, '', newPath);
      }
    }
  }, [activeId]);

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/podcasts/')) {
        const podcastId = path.split('/podcasts/')[1];
        if (podcastId && podcastId !== activeId) {
          setActiveId(podcastId);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeId]);

  // Load initial podcast from URL
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/podcasts/')) {
      const podcastId = path.split('/podcasts/')[1];
      if (podcastId) {
        setActiveId(podcastId);
      }
    } else if (initialPodcastId) {
      setActiveId(initialPodcastId);
    } else if (podcastReviews.length > 0 && !activeId) {
      setActiveId(podcastReviews[0].id);
    }
  }, [initialPodcastId, podcastReviews.length]);

  useEffect(() => {
    const fetchPlayCounts = async () => {
      try {
        const data = await api.getPodcastStats();
        if (data.play_counts) {
          setPlayCounts(data.play_counts);
        }
      } catch (e) {
        console.error('Failed to fetch play counts:', e);
      }
    };

    fetchPlayCounts();
    const interval = setInterval(fetchPlayCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  const trackPlay = async (reviewId) => {
    try {
      const data = await api.recordPodcastPlay(reviewId);
      setPlayCounts(prev => ({ ...prev, [reviewId]: data.play_count }));
    } catch (e) {
      console.error('Failed to track play:', e);
    }
  };

  const loadAudioForReview = async (reviewId) => {
    if (audioUrls[reviewId]) return audioUrls[reviewId];

    setIsLoading(true);
    try {
      const fullReview = await api.getReview(reviewId);
      if (fullReview) {
        let url = fullReview.podcastAudioUrl || fullReview.podcastAudio || fullReview.podcast_audio_path;

        if (url && typeof url === 'string' && !url.startsWith('http') && !url.startsWith('data:')) {
          url = `data:audio/wav;base64,${url}`;
        }

        if (url && typeof url === 'string') {
          setAudioUrls(prev => ({ ...prev, [reviewId]: url }));
          return url;
        }
      }
    } catch (e) {
      console.error('Failed to load audio:', e);
    } finally {
      setIsLoading(false);
    }
    return null;
  };

  const handlePlay = async (id) => {
    if (isLoading) return;

    if (id !== activeId) {
      setActiveId(id);
      setIsPlaying(false);
      setCurrentTime(0);
      
      const audioUrl = await loadAudioForReview(id);
      if (audioUrl && audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.load();
        try {
          await audioRef.current.play();
          setIsPlaying(true);
          // Track play in backend
          trackPlay(id);
        } catch (e) {
          console.error('Playback failed:', e);
        }
      }
    } else {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        const audioUrl = await loadAudioForReview(id);
        if (audioUrl && audioRef.current) {
          if (audioRef.current.src !== audioUrl) {
            audioRef.current.src = audioUrl;
          }
          try {
            await audioRef.current.play();
            setIsPlaying(true);
          } catch (e) {
            console.error('Playback failed:', e);
          }
        }
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const formatTime = (time) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleShare = async (review) => {
    const shareUrl = `${window.location.origin}/podcasts/${review.id}`;
    const shareData = {
      title: `${review.songTitle} by ${review.artistName} - Verdiq Session`,
      text: `Listen to the AI-generated review of "${review.songTitle}" by ${review.artistName}`,
      url: shareUrl
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (e) {
        if (e.name !== 'AbortError') {
          copyToClipboard(shareUrl);
        }
      }
    } else {
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Link copied to clipboard!');
  };

  if (podcastReviews.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-32 text-center" data-testid="empty-podcasts">
        <h2 className="text-5xl font-black mb-6">No Sessions Yet</h2>
        <p className="text-slate-400 text-xl font-light">
          No artists have created reviews with podcast audio. Be the first to create a Verdiq Session.
        </p>
      </div>
    );
  }

  const activeReview = podcastReviews.find(r => r.id === activeId) || podcastReviews[0];
  
  // Get latest episode (most recent by date)
  const latestEpisode = [...podcastReviews].sort((a, b) => 
    new Date(b.createdAt || b.created_at || 0).getTime() - new Date(a.createdAt || a.created_at || 0).getTime()
  )[0];
  
  // Get most played podcasts (top 5)
  const mostPlayed = [...podcastReviews]
    .sort((a, b) => (playCounts[b.id] || 0) - (playCounts[a.id] || 0))
    .slice(0, 5);

  // Sidebar podcasts (limit to 7, scrollable)
  const sidebarPodcasts = podcastReviews.slice(0, 7);

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-12 md:py-16" data-testid="podcasts">
      <audio 
        ref={audioRef} 
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        onError={(e) => {
          const target = e.target as HTMLAudioElement;
          console.error('Audio element error:', target.error);
          setIsPlaying(false);
          setIsLoading(false);
        }}
      />
      
      {/* Marketplace Header */}
      <div className="border-b border-slate-900 pb-6 mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <h1 className="text-4xl sm:text-7xl font-black tracking-tighter leading-none mb-4 uppercase">Verdiq Sessions</h1>
          <p className="text-emerald-500 font-bold uppercase tracking-[0.5em] text-xs">MUSIC REVIEW PODCAST</p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-slate-500 font-black uppercase text-sm">Global Feed</p>
          <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">{podcastReviews.length} Episodes Live</p>
        </div>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-12">
        {/* Main Player */}
        <div className="flex-1">
          {/* Active Episode */}
          <div className="card-premium !p-4 sm:!p-8 mb-10" data-testid="active-podcast">
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="w-full md:w-96 h-64 sm:h-96 rounded-[24px] md:rounded-[40px] overflow-hidden flex-shrink-0 shadow-2xl border border-white/5 relative group">
                <img 
                  src={activeReview?.featuredImage || activeReview?.imageUrl || `https://picsum.photos/seed/${activeReview?.id}/600/600`} 
                  alt={activeReview?.songTitle}
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
              </div>
              
              <div className="flex-1 w-full">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    <p className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.3em]">Now Playing</p>
                  </div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500/50 border border-emerald-500/20 px-2 py-0.5 rounded">Marketplace Session</span>
                </div>
                <h2 className="text-3xl sm:text-5xl font-black text-white mb-2 tracking-tighter leading-none uppercase">{activeReview?.songTitle}</h2>
                <p className="text-slate-400 text-lg sm:text-2xl font-light mb-6 italic">by {activeReview?.artistName}</p>
                
                {/* Player Controls */}
                <div className="space-y-6">
                  <div className="flex items-center gap-6">
                    <button
                      onClick={() => handlePlay(activeReview?.id)}
                      disabled={isLoading}
                      className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500 rounded-full flex items-center justify-center hover:bg-emerald-400 transition-all hover:scale-110 shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50"
                      data-testid="play-btn"
                    >
                      {isLoading ? (
                        <div className="w-6 h-6 sm:w-8 sm:h-8 border-3 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      ) : isPlaying && activeId === activeReview?.id ? (
                        <Pause className="w-6 h-6 sm:w-8 sm:h-8 text-slate-950 fill-current" />
                      ) : (
                        <Play className="w-6 h-6 sm:w-8 sm:h-8 text-slate-950 fill-current ml-1" />
                      )}
                    </button>
                    
                    <div className="flex-1">
                      <div 
                        className="h-1.5 bg-slate-800 rounded-full cursor-pointer overflow-hidden relative"
                        onClick={(e) => {
                          if (audioRef.current && duration) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const percent = (e.clientX - rect.left) / rect.width;
                            audioRef.current.currentTime = percent * duration;
                          }
                        }}
                      >
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                          style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 mt-3 font-black uppercase tracking-widest">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-6">
                    <button 
                      onClick={() => handleShare(activeReview)}
                      className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                      data-testid="share-podcast-btn"
                    >
                      <Share2 className="w-4 h-4" />
                      Share Episode
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* About This Session */}
          <div className="glass rounded-2xl p-6 mb-6" data-testid="about-session">
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l4.59-4.58L18 11l-6 6z" /></svg>
              About This Session
            </h3>
            <p className="text-slate-400 font-serif italic leading-relaxed mb-4">
              Join Wolf & Sloane as they break down "{activeReview?.songTitle || 'the track'}" 
              in an unfiltered discussion covering production techniques, market positioning, and artistic merit.
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="bg-slate-800/50 px-4 py-2 rounded-xl">
                <p className="text-[10px] font-black uppercase text-slate-500 mb-0.5">Energy</p>
                <p className="text-sm font-bold text-emerald-500">{activeReview?.analysis?.energy || 'Unknown'}</p>
              </div>
              <div className="bg-slate-800/50 px-4 py-2 rounded-xl">
                <p className="text-[10px] font-black uppercase text-slate-500 mb-0.5">Genre</p>
                <p className="text-sm font-bold text-white">{activeReview?.analysis?.genre || 'Unknown'}</p>
              </div>
              <div className="bg-slate-800/50 px-4 py-2 rounded-xl">
                <p className="text-[10px] font-black uppercase text-slate-500 mb-0.5">Rating</p>
                <p className="text-sm font-bold text-emerald-500">{activeReview?.rating || '--'}/10</p>
              </div>
            </div>
            
            {/* Read Full Review Button */}
            <button
              onClick={() => onSelectReview(activeReview)}
              className="mt-6 w-full bg-emerald-500 text-slate-950 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-400 transition-colors flex items-center justify-center gap-3"
              data-testid="read-full-review-btn"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Read Full Review
            </button>
          </div>

          {/* Latest Episode Section */}
          {latestEpisode && latestEpisode.id !== activeReview?.id && (
            <div className="mb-6">
              <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-500" />
                Latest Episode
              </h3>
              <div 
                onClick={() => handlePlay(latestEpisode.id)}
                className="glass rounded-2xl p-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
                data-testid="latest-episode"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                    <img 
                      src={latestEpisode.featuredImage || latestEpisode.imageUrl || `https://picsum.photos/seed/${latestEpisode.id}/100/100`} 
                      alt={latestEpisode.songTitle}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{latestEpisode.songTitle}</p>
                    <p className="text-sm text-slate-400 truncate">{latestEpisode.artistName}</p>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 text-xs">
                    <Headphones className="w-4 h-4" />
                    <span>{playCounts[latestEpisode.id] || 0}</span>
                  </div>
                  <button className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center hover:bg-emerald-500/20">
                    <Play className="w-4 h-4 text-emerald-500 ml-0.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Most Played Chart */}
          <div className="glass rounded-2xl p-6" data-testid="most-played-chart">
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Most Played
            </h3>
            <div className="space-y-3">
              {mostPlayed.map((review, index) => (
                <div 
                  key={review.id}
                  onClick={() => handlePlay(review.id)}
                  className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-colors ${activeId === review.id ? 'bg-emerald-500/10' : 'hover:bg-slate-800/50'}`}
                  data-testid={`chart-item-${index}`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-lg ${index < 3 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-400'}`}>
                    {index + 1}
                  </span>
                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                    <img 
                      src={review.featuredImage || review.imageUrl || `https://picsum.photos/seed/${review.id}/100/100`} 
                      alt={review.songTitle}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm truncate">{review.songTitle}</p>
                    <p className="text-xs text-slate-400 truncate">{review.artistName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white text-sm">{playCounts[review.id] || 0}</p>
                    <p className="text-xs text-slate-500">plays</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar - Episodes List (Limited to 7, Scrollable) */}
        <div className="lg:w-80">
          <div className="sticky top-24">
            <h3 className="text-lg font-black text-white mb-4">All Episodes</h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent" data-testid="episodes-sidebar">
              {podcastReviews.map((review, index) => (
                <div 
                  key={review.id}
                  onClick={() => handlePlay(review.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${activeId === review.id ? 'bg-emerald-500/10 border border-emerald-500/30' : 'glass hover:bg-slate-800/50'}`}
                  data-testid={`episode-${index}`}
                >
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                    <img 
                      src={review.featuredImage || review.imageUrl || `https://picsum.photos/seed/${review.id}/100/100`} 
                      alt={review.songTitle}
                      className="w-full h-full object-cover"
                    />
                    {activeId === review.id && isPlaying && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="flex gap-0.5">
                          <span className="w-1 h-4 bg-emerald-500 rounded animate-pulse [animation-delay:0ms]" />
                          <span className="w-1 h-4 bg-emerald-500 rounded animate-pulse [animation-delay:150ms]" />
                          <span className="w-1 h-4 bg-emerald-500 rounded animate-pulse [animation-delay:300ms]" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm truncate ${activeId === review.id ? 'text-emerald-500' : 'text-white'}`}>
                      {review.songTitle}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{review.artistName}</p>
                  </div>
                </div>
              ))}
            </div>
            
            {podcastReviews.length > 7 && (
              <p className="text-xs text-slate-500 text-center mt-3">
                Scroll for more episodes
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Podcasts;
