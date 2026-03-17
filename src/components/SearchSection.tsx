import React, { useState, useRef, useEffect } from 'react';
import { Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Waveform from './Waveform';
import { storage, auth } from '../firebase';
import { ref, getDownloadURL, uploadBytes } from 'firebase/storage';

const SearchSection = ({ onAnalyze, isLoading, credits, status, isSubscribed, onNavigate }) => {
  const [formData, setFormData] = useState({
    trackName: '',
    artistName: '',
    lyrics: '',
    bio: '',
    stylePreset: 'dark'
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [featuredPhoto, setFeaturedPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [artistPhoto, setArtistPhoto] = useState(null);
  const [artistPhotoPreview, setArtistPhotoPreview] = useState(null);
  
  const [hasConsented, setHasConsented] = useState(false);
  const [showConsentError, setShowConsentError] = useState(false);
  
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const artistPhotoInputRef = useRef(null);

  const [progress, setProgress] = useState(0);

  // Storage Image URLs
  const [editorialUrl, setEditorialUrl] = useState('/editorial-feature.jpg');
  const [podcastUrl, setPodcastUrl] = useState('/podcast-feature.jpg');

  useEffect(() => {
    const loadStorageImages = async () => {
      try {
        // Try multiple possible paths in storage
        const paths = ['assets/editorial-feature.jpg', 'editorial-feature.jpg'];
        const podcastPaths = ['assets/podcast-feature.jpg', 'podcast-feature.jpg'];
        
        let eUrl = '/editorial-feature.jpg';
        let pUrl = '/podcast-feature.jpg';

        // Try to find editorial image
        for (const path of paths) {
          try {
            const r = ref(storage, path);
            eUrl = await getDownloadURL(r);
            console.log(`[Storage] Found editorial at ${path}: ${eUrl}`);
            break;
          } catch (e) {
            console.log(`[Storage] Not found at ${path}`);
          }
        }

        // Try to find podcast image
        for (const path of podcastPaths) {
          try {
            const r = ref(storage, path);
            pUrl = await getDownloadURL(r);
            console.log(`[Storage] Found podcast at ${path}: ${pUrl}`);
            break;
          } catch (e) {
            console.log(`[Storage] Not found at ${path}`);
          }
        }
        
        setEditorialUrl(eUrl);
        setPodcastUrl(pUrl);
      } catch (error) {
        console.error("Error loading storage images", error);
      }
    };
    
    loadStorageImages();
  }, []);

  useEffect(() => {
    if (isLoading) {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 99) return 99;
          const increment = prev < 30 ? 0.3 : prev < 70 ? 0.8 : 1.5;
          return Math.min(prev + increment, 99);
        });
      }, 150);
      return () => clearInterval(interval);
    } else {
      setProgress(0);
    }
  }, [isLoading]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handlePhotoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFeaturedPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleArtistPhotoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setArtistPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setArtistPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!hasConsented) {
      setShowConsentError(true);
      setTimeout(() => setShowConsentError(false), 4000);
      return;
    }

    // Validate required fields: track file, track name, artist name, cover art
    if (!selectedFile) {
      alert('Please upload a track file');
      return;
    }
    if (!formData.trackName.trim()) {
      alert('Please enter a track name');
      return;
    }
    if (!formData.artistName.trim()) {
      alert('Please enter an artist name');
      return;
    }
    if (!featuredPhoto) {
      alert('Please upload cover art');
      return;
    }
    if (!artistPhoto) {
      alert('Please upload an artist photo');
      return;
    }
    
    onAnalyze({
      ...formData,
      audioFile: selectedFile,
      featuredPhoto: featuredPhoto,
      artistPhoto: artistPhoto
    });
  };

  const testimonials = [
    {
      name: "Marcus Vane",
      role: "Electronic Producer",
      text: "The spectral analysis caught a phase issue in my low-end that I had completely missed. This is a must-have tool for finishing a track.",
      avatar: "https://images.unsplash.com/photo-1526218626217-dc65a29bb444?auto=format&fit=crop&q=80&w=200"
    },
    {
      name: "Elena Rossi",
      role: "Indie Singer-Songwriter",
      text: "Verdiq's editorial reviews are spooky. It picked up on the 'nostalgic melancholy' in my lyrics and matched it perfectly to the synth pads.",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200"
    },
    {
      name: "David K.",
      role: "Label A&R",
      text: "We use Verdiq to screen demos. It gives us a standardized technical baseline before we ever hit play. Saves us hours every week.",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200"
    },
    {
      name: "Sarah J.",
      role: "Folk Artist",
      text: "The genre tagging is actually useful. It identified 'Neo-Folk' elements I didn't even realize I was leaning into. Great for metadata and DSP pitching.",
      avatar: "https://images.unsplash.com/photo-1516575334481-f85287c2c82d?auto=format&fit=crop&q=80&w=200"
    },
    {
      name: "Kev Beats",
      role: "Hip Hop Producer",
      text: "I used the Verdiq score to negotiate my last distribution deal. Numbers don't lie, and labels respect the data. It's an essential edge for independent producers.",
      avatar: "https://images.unsplash.com/photo-1520333789090-1afc82db536a?auto=format&fit=crop&q=80&w=200"
    },
    {
      name: "Mia Thorne",
      role: "Vocalist",
      text: "The podcast session feels so real. It's like having two professional managers discussing your career over coffee. Incredibly insightful for performance growth.",
      avatar: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&q=80&w=200"
    }
  ];

  return (
    <div className="relative pt-32 pb-12 px-6 overflow-hidden" data-testid="search-section">
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee-slow {
          animation: marquee 50s linear infinite;
        }
        .animate-marquee-slow:hover {
          animation-play-state: paused;
        }
        @keyframes progress-pulse {
          0% { width: 10%; }
          50% { width: 85%; }
          100% { width: 40%; }
        }
        .animate-progress {
          animation: progress-pulse 4s ease-in-out infinite;
        }
      `}</style>

      {/* Hero / Submission Section */}
      <div className="max-w-6xl mx-auto relative z-10 mb-24">
        <div className="text-center mb-12">
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-extrabold mb-6 tracking-tighter leading-none">
            <span className="gradient-text">Submit Your Track</span>
          </h1>
          <p className="text-lg sm:text-2xl text-slate-400 font-light max-w-3xl mx-auto leading-relaxed px-4">
            Upload your track for a magazine-style review, podcast feature, and technical music audit.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6 card-premium !p-6 md:!p-8 relative overflow-hidden group" data-testid="submission-form">
          <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          
          <div className="space-y-3 relative z-10 min-w-0">
            {/* Audio Upload */}
            <div>
              <label className="block text-[10px] uppercase font-black tracking-[0.2em] text-emerald-500 mb-4 ml-1">
                Upload Track
              </label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-[32px] p-6 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 group/upload ${selectedFile ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-800 hover:border-emerald-500/30 bg-slate-900/30'}`}
                data-testid="audio-upload"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept="audio/*"
                  data-testid="audio-upload-input"
                />
                <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center group-hover/upload:scale-110 transition-transform shadow-2xl border border-white/5">
                  <Upload className="w-8 h-8 text-emerald-500" />
                </div>
                <div className="text-center w-full px-4">
                  <p className="text-lg font-bold text-white truncate max-w-full">{selectedFile ? selectedFile.name : 'Upload Master Track'}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-[0.1em] mt-1">WAV, MP3, AIFF Max 20MB</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-black tracking-[0.2em] text-emerald-500 mb-3 ml-1">
                  Track Name
                </label>
                <input 
                  required
                  value={formData.trackName}
                  onChange={e => setFormData({...formData, trackName: e.target.value})}
                  className="input-field"
                  placeholder="e.g. Midnight City"
                  data-testid="track-name-input"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-black tracking-[0.2em] text-emerald-500 mb-3 ml-1">
                  Artist Name
                </label>
                <input 
                  required
                  value={formData.artistName}
                  onChange={e => setFormData({...formData, artistName: e.target.value})}
                  className="input-field"
                  placeholder="e.g. M83"
                  data-testid="artist-name-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Featured Photo Upload */}
              <div>
                <label className="block text-[10px] uppercase font-black tracking-[0.2em] text-emerald-500 mb-4 ml-1">
                  Cover Art
                </label>
                <div 
                  onClick={() => photoInputRef.current?.click()}
                  className={`relative border border-slate-800 rounded-2xl p-4 transition-all cursor-pointer flex items-center gap-4 group/photo hover:border-emerald-500/30 ${photoPreview ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-900/50'}`}
                  data-testid="photo-upload"
                >
                  <input 
                    type="file" 
                    ref={photoInputRef} 
                    onChange={handlePhotoChange} 
                    className="hidden" 
                    accept="image/*"
                  />
                  <div className="w-16 h-16 bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 border border-white/5">
                    {photoPreview ? (
                      <img src={photoPreview} className="w-full h-full object-cover" alt="Preview" />
                    ) : (
                      <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-base font-bold text-white truncate">{featuredPhoto ? featuredPhoto.name : 'Cover Art'}</p>
                    <p className="text-xs text-slate-500 mt-1">JPG, PNG, or WebP</p>
                  </div>
                </div>
              </div>

              {/* Artist Photo Upload */}
              <div>
                <label className="block text-[10px] uppercase font-black tracking-[0.2em] text-emerald-500 mb-4 ml-1">
                  Artist Photo
                </label>
                <div 
                  onClick={() => artistPhotoInputRef.current?.click()}
                  className={`relative border border-slate-800 rounded-2xl p-4 transition-all cursor-pointer flex items-center gap-4 group/artist-photo hover:border-emerald-500/30 ${artistPhotoPreview ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-900/50'}`}
                  data-testid="artist-photo-upload"
                >
                  <input 
                    type="file" 
                    ref={artistPhotoInputRef} 
                    onChange={handleArtistPhotoChange} 
                    className="hidden" 
                    accept="image/*"
                  />
                  <div className="w-16 h-16 bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 border border-white/5">
                    {artistPhotoPreview ? (
                      <img src={artistPhotoPreview} className="w-full h-full object-cover" alt="Artist Preview" />
                    ) : (
                      <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-base font-bold text-white truncate">{artistPhoto ? artistPhoto.name : 'Artist Photo'}</p>
                    <p className="text-xs text-slate-500 mt-1">JPG, PNG, or WebP</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col relative z-10">
            <div className="flex-grow">
              <label className="block text-[10px] uppercase font-black tracking-[0.2em] text-emerald-500 mb-3 ml-1">Lyrics & Bio (Recommended)</label>
              <textarea 
                rows={12}
                value={formData.lyrics}
                onChange={e => setFormData({...formData, lyrics: e.target.value})}
                className="input-field h-[calc(100%-3rem)] resize-none font-serif !text-lg !leading-relaxed"
                placeholder="Paste lyrics and context for deeper semantic analysis..."
                data-testid="lyrics-textarea"
              />
            </div>

            <div className="mt-6 flex items-start gap-3 px-1">
              <div className="flex items-center h-5">
                <input
                  id="consent"
                  type="checkbox"
                  checked={hasConsented}
                  onChange={(e) => setHasConsented(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-800 bg-slate-900 text-emerald-500 focus:ring-emerald-500/50 focus:ring-offset-0 transition-colors cursor-pointer"
                />
              </div>
              <label htmlFor="consent" className="text-[11px] text-slate-400 leading-tight cursor-pointer select-none">
                I represent that I own or have all necessary rights to this track and its assets. I agree to the 
                <button type="button" onClick={() => onNavigate?.('terms')} className="text-emerald-500 hover:underline mx-1">Terms & Conditions</button> 
                and 
                <button type="button" onClick={() => onNavigate?.('privacy')} className="text-emerald-500 hover:underline ml-1">Privacy Policy</button>.
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading || !selectedFile || !formData.trackName || !formData.artistName || !featuredPhoto}
              className={`btn-primary !py-6 !text-xl !rounded-[24px] mt-6 transition-all duration-500 ${isLoading ? 'bg-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.4)]' : ''}`}
              data-testid="analyze-btn"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-3">
                  <svg className="animate-spin h-6 w-6 text-slate-950" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-slate-950 font-black uppercase tracking-widest">{status || 'Initializing Studio...'}</span>
                </span>
              ) : (
                <span>Run Analysis</span>
              )}
            </button>

            <AnimatePresence>
              {showConsentError && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="mt-4 px-4 py-2 bg-red-500/10 border border-red-500/40 rounded-full flex items-center gap-2 shadow-lg shadow-red-500/5 w-fit mx-auto"
                >
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-red-400 text-[10px] font-black uppercase tracking-widest">Check consent to proceed</p>
                </motion.div>
              )}
            </AnimatePresence>

            {isLoading && (
              <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1">Studio Status</span>
                      <span className="text-sm font-black text-emerald-400 uppercase tracking-tight">{status || 'Initializing...'}</span>
                    </div>
                    <span className="text-xl font-black text-emerald-500 font-mono">{Math.floor(progress)}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 p-0.5">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Spectral Analysis', min: 0 },
                    { label: 'Editorial Review', min: 25 },
                    { label: 'Cover Art Treatment', min: 50 },
                    { label: 'Podcast Session', min: 75 },
                  ].map((task, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${progress > task.min ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-800'}`} />
                      <span className={`text-[9px] font-black uppercase tracking-tighter transition-colors duration-500 ${progress > task.min ? 'text-slate-300' : 'text-slate-600'}`}>
                        {task.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>

        {isLoading && (
          <div className="mt-12 max-w-2xl mx-auto">
            <Waveform />
            <p className="text-emerald-400 mt-6 text-center animate-pulse font-mono uppercase tracking-[0.3em] text-[10px]">
              Extracting Spectral Features & Semantic Mapping...
            </p>
          </div>
        )}
      </div>

      {/* The Verdiq Experience Section */}
      <section className="max-w-[1440px] mx-auto px-4 md:px-8 mb-40 py-12 md:py-24 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
          <div className="order-2 lg:order-1 relative py-10">
            {/* Magazine Screenshot Simulation */}
            <div className="relative z-10 rounded-[24px] overflow-hidden border border-white/10 shadow-2xl bg-slate-950 transform -rotate-2 hover:rotate-0 transition-transform duration-700 group/mag min-h-[400px] flex items-center justify-center">
              <img 
                src={editorialUrl} 
                alt="Editorial Feature" 
                className="w-full h-auto block object-contain"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                data-fallback-tried="false"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.getAttribute('data-fallback-tried') === 'false') {
                    target.setAttribute('data-fallback-tried', 'true');
                    const fallbackSrc = '/editorial-feature.jpg';
                    console.log(`[Image Fallback] Retrying editorial image from local path: ${fallbackSrc}`);
                    target.src = fallbackSrc;
                    return;
                  }
                  
                  // If already tried fallback and still failing, show error UI
                  console.error(`[Image Error] Editorial image failed to load even after fallback. Current src: ${target.src}`);
                  target.style.display = 'none';
                  const container = target.parentElement;
                  if (container) {
                    container.innerHTML = `
                      <div class="flex flex-col items-center justify-center p-12 text-center">
                        <div class="w-16 h-16 mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                          <svg class="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                        <p class="text-emerald-500 font-black uppercase tracking-widest text-xs mb-2">Image Not Found</p>
                        <p class="text-slate-500 text-[10px] leading-relaxed max-w-[200px]">
                          The editorial feature image could not be loaded from Storage or the local public folder.
                        </p>
                      </div>
                    `;
                  }
                }}
              />
            </div>
            
            {/* Podcast Screenshot Simulation */}
            <div className="absolute -bottom-4 -right-2 md:-right-8 z-20 w-3/4 rounded-[32px] overflow-hidden border border-emerald-500/30 shadow-[0_20px_50px_rgba(16,185,129,0.2)] bg-slate-950 transform rotate-3 hover:rotate-0 transition-transform duration-700 group/pod">
              <div className="relative p-6 md:p-8 min-h-[220px] flex flex-col justify-end">
                <img 
                  src={podcastUrl} 
                  alt="Podcast Feature" 
                  className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover/pod:opacity-60 transition-opacity"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  data-fallback-tried="false"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.getAttribute('data-fallback-tried') === 'false') {
                      target.setAttribute('data-fallback-tried', 'true');
                      const fallbackSrc = '/podcast-feature.jpg';
                      console.log(`[Image Fallback] Retrying podcast image from local path: ${fallbackSrc}`);
                      target.src = fallbackSrc;
                      return;
                    }
                    
                    // If already tried fallback and still failing, show error UI
                    console.error(`[Image Error] Podcast image failed to load even after fallback. Current src: ${target.src}`);
                    target.style.display = 'none';
                    const container = target.parentElement;
                    if (container) {
                      container.innerHTML = `
                        <div class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                          <p class="text-emerald-500 font-black uppercase tracking-widest text-[8px] mb-1">Podcast Image Missing</p>
                          <p class="text-slate-500 text-[8px] leading-tight max-w-[120px]">
                            Upload to <b>public</b> as <b>podcast-feature.jpg</b>
                          </p>
                        </div>
                      `;
                    }
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
                
                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <svg className="w-6 h-6 text-slate-950 animate-pulse" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">The Verdiq Session</p>
                      <p className="text-white font-bold text-sm">Wolf & Sloane Debate</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 animate-progress" />
                    </div>
                    <div className="flex justify-between text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      <span>01:24</span>
                      <span>03:45</span>
                    </div>
                    <p className="text-xs text-slate-400 italic leading-relaxed">
                      "Sloane: The way the vocal sits in that 2kHz pocket is exactly what labels are looking for right now..."
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute top-0 -left-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-[80px] -z-10" />
          </div>

          <div className="order-1 lg:order-2">
            <h2 className="text-4xl md:text-6xl font-black text-white mb-10 tracking-tighter leading-none">YOUR MUSIC, <br/><span className="gradient-text">IMMORTALIZED.</span></h2>
            <p className="text-slate-400 text-xl md:text-2xl font-light leading-relaxed mb-12">
              Every analysis generates a professional-grade media package designed to impress labels and engage your fanbase.
            </p>
            <div className="space-y-8">
              {[
                { 
                  title: "The Editorial Feature", 
                  desc: "A professional magazine feature that puts your music into words. Ready for your EPK, social media, or pitching to curators.",
                  icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 01.707.293l5.414 5.414a1 1 0 01.293.707V18a2 2 0 01-2 2z" /></svg>
                },
                { 
                  title: "The Verdiq Session Podcast", 
                  desc: "Listen to Wolf & Sloane—our virtual industry veterans—debate your track's market potential in a high-fidelity audio session.",
                  icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                }
              ].map((item, idx) => (
                <div key={idx} className="flex gap-6 group/item">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-1 border border-emerald-500/20 group-hover/item:bg-emerald-500 group-hover/item:text-slate-950 transition-all duration-500 shadow-lg shadow-emerald-500/5">
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="text-white text-xl font-bold mb-2 group-hover/item:text-emerald-400 transition-colors">{item.title}</h4>
                    <p className="text-slate-500 text-base leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 flex flex-wrap gap-4">
              <button 
                type="button"
                onClick={() => onNavigate?.('magazine')}
                className="px-8 py-4 bg-white text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-500 transition-all shadow-xl shadow-white/5"
              >
                View Magazine
              </button>
              <button 
                type="button"
                onClick={() => onNavigate?.('podcasts')}
                className="px-8 py-4 bg-slate-900 text-white border border-white/10 font-black uppercase tracking-widest text-xs rounded-2xl hover:border-emerald-500/50 transition-all"
              >
                View Podcasts
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-slate-900/30 border-y border-slate-900 py-16 md:py-24 mb-24 overflow-hidden">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tighter uppercase">THE STUDIO <span className="text-emerald-500">WORKFLOW.</span></h2>
            <p className="text-slate-500 text-lg md:text-xl max-w-2xl mx-auto">From raw master to professional editorial in under 60 seconds.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {[
              { 
                step: "01", 
                title: "Spectral Upload", 
                desc: "Drop your WAV or high-bitrate MP3. Our engine scans every sample.",
                img: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&q=80&w=600"
              },
              { 
                step: "02", 
                title: "Semantic Mapping", 
                desc: "We analyze lyrics and bio to find the 'Synergy Score' between words and sound.",
                img: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&q=80&w=600"
              },
              { 
                step: "03", 
                title: "Editorial Logic", 
                desc: "Verdiq writes a long-form, magazine-style critique based on technical data.",
                img: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&q=80&w=600"
              },
              { 
                step: "04", 
                title: "The Radio Mix", 
                desc: "Wolf & Sloane debate your track in a short podcast session.",
                img: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?auto=format&fit=crop&q=80&w=600"
              }
            ].map((step, idx) => (
              <div key={idx} className="group cursor-default">
                <div className="relative h-64 rounded-3xl overflow-hidden mb-6 border border-slate-800 transition-all group-hover:border-emerald-500/50">
                  <img 
                    src={step.img} 
                    className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500" 
                    alt={step.title} 
                  />
                  <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-transparent transition-colors" />
                  <span className="absolute top-4 left-4 bg-emerald-500 text-slate-950 font-black px-3 py-1 rounded-lg text-xs">{step.step}</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">{step.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Helps Your Music (Artist Benefits) */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 mb-20">
        <div className="bg-emerald-500 rounded-[32px] md:rounded-[60px] p-6 sm:p-8 lg:p-16 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none rotate-12 translate-x-20">
            <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
          </div>
          
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h2 className="text-4xl sm:text-5xl lg:text-7xl font-black text-slate-950 tracking-tighter leading-none mb-6">BUILD YOUR <br/>PRESS KIT <br/>WITH DATA.</h2>
              <div className="space-y-6">
                <div className="flex gap-4 sm:gap-6">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-950 rounded-2xl flex items-center justify-center flex-shrink-0 text-emerald-500 shadow-2xl">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div>
                    <h4 className="text-slate-900 text-xl sm:text-2xl font-black mb-2">Long-form PR Assets</h4>
                    <p className="text-slate-800 font-bold opacity-80 text-sm sm:text-base">Stop struggling with bios. Use our editorial reviews as the foundation for your next EPK.</p>
                  </div>
                </div>
                <div className="flex gap-4 sm:gap-6">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-950 rounded-2xl flex items-center justify-center flex-shrink-0 text-emerald-500 shadow-2xl">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                  </div>
                  <div>
                    <h4 className="text-slate-900 text-xl sm:text-2xl font-black mb-2">DSP Optimization</h4>
                    <p className="text-slate-800 font-bold opacity-80 text-sm sm:text-base">Get the exact BPM, Key, and Energy mood mapping required for Spotify for Artists and Apple Music.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-slate-950 p-6 sm:p-8 rounded-[32px] md:rounded-[40px] shadow-2xl rotate-2">
                <div className="flex items-center gap-4 mb-6">
                   <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500 rounded-full" />
                   <div>
                     <div className="h-4 w-24 sm:w-32 bg-slate-800 rounded mb-2" />
                     <div className="h-3 w-16 sm:w-20 bg-slate-800 rounded opacity-50" />
                   </div>
                </div>
                <div className="space-y-4">
                  <div className="h-8 w-full bg-emerald-500/10 rounded-xl" />
                  <div className="h-24 w-full bg-slate-900 rounded-xl border border-slate-800 p-4">
                    <div className="h-2 w-full bg-slate-800 rounded mb-2" />
                    <div className="h-2 w-4/5 bg-slate-800 rounded mb-2" />
                    <div className="h-2 w-3/4 bg-slate-800 rounded" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-10 bg-slate-900 rounded-xl border border-slate-800" />
                    <div className="h-10 bg-slate-900 rounded-xl border border-slate-800" />
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-6 -right-6 sm:-bottom-10 sm:-right-10 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-2xl -rotate-6 hidden sm:block">
                 <p className="text-slate-950 font-black text-2xl sm:text-3xl">9.4/10</p>
                 <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Verdiq Score</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="w-full overflow-hidden px-4 md:px-8 mb-24">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-emerald-500 mb-6">The Verdict from the Industry</h2>
          <h3 className="text-4xl md:text-6xl font-black text-white tracking-tighter">Loved by Creators, <br/><span className="gradient-text">Trusted by Critics.</span></h3>
        </div>

        <div className="relative overflow-hidden py-10">
          <div className="flex gap-10 animate-marquee-slow w-max">
            {[...testimonials, ...testimonials].map((t, i) => (
              <div 
                key={i} 
                className="card-premium flex flex-col w-[350px] md:w-[500px] flex-shrink-0 !p-10"
              >
                <div className="flex items-center gap-5 mb-8">
                  <img src={t.avatar} className="w-16 h-16 rounded-2xl object-cover grayscale border border-white/5" alt={t.name} />
                  <div>
                    <h5 className="text-white text-lg font-bold leading-tight">{t.name}</h5>
                    <p className="text-[10px] text-emerald-500 font-black uppercase tracking-[0.2em] mt-1">{t.role}</p>
                  </div>
                </div>
                <p className="text-slate-400 italic font-serif text-lg leading-relaxed flex-grow">"{t.text}"</p>
                <div className="flex gap-1.5 mt-8">
                  {[...Array(5)].map((_, star) => (
                    <svg key={star} className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-0 pointer-events-none opacity-20">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-500/30 rounded-full blur-[160px]" />
        <div className="absolute top-3/4 left-1/2 w-[800px] h-[800px] bg-emerald-900/10 rounded-full blur-[200px]" />
      </div>
    </div>
  );
};

export default SearchSection;
