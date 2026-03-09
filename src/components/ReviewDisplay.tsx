import React, { useState, useRef } from 'react';
import SpotifyPlayer from './SpotifyPlayer';

const ReviewDisplay = ({ review, onUpgrade, onSave, onPublish, onViewPodcast, onBack, canPublish, audioFile, isSubscribed, onSelectReview, features = {} }) => {
  const [editMode, setEditMode] = useState(false);
  const [editedReview, setEditedReview] = useState(review);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const printRef = useRef(null);

  // Feature access - podcast is now available for all users (free tier included)
  const canDownloadPDF = (features as any).pdf_download !== false && isSubscribed;
  const canPublishToMagazine = true; // Credit-based publishing handled in App.tsx
  const hasPodcast = true; // Podcast is free for all users

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editedReview);
      setEditMode(false);
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (canPublishToMagazine) {
      setIsPublishing(true);
      try {
        await onPublish(review.id);
      } finally {
        setIsPublishing(false);
      }
    } else {
      setShowSubscribeModal(true);
    }
  };

  const handleDownloadPDF = () => {
    if (!(window as any).html2pdf || !printRef.current) return;
    
    const opt = {
      margin: 0,
      filename: `${(review.songTitle || 'Review').replace(/\s+/g, '_')}_Verdiq_Review.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    (window as any).html2pdf().from(printRef.current).set(opt).save();
  };

  const getShareUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/review/${review.id}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getShareUrl());
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${review.songTitle} - Verdiq Review`,
          text: review.headline,
          url: getShareUrl()
        });
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error('Share failed:', e);
        }
      }
    } else {
      handleCopyLink();
    }
  };

  // Get podcast audio source (URL or base64)
  const getPodcastSource = () => {
    let url = review.podcastAudioUrl || review.podcastAudio || review.podcast_audio_path;
    if (url && typeof url === 'string' && !url.startsWith('http') && !url.startsWith('data:')) {
      return `data:audio/wav;base64,${url}`;
    }
    return (typeof url === 'string' ? url : null);
  };

  // Check if podcast audio data actually exists
  const podcastSource = getPodcastSource();
  const hasPodcastData = !!podcastSource;
  
  // Show podcast section if review is marked as having podcast (even if audio missing)
  const shouldShowPodcastSection = hasPodcastData || review.hasPodcast;

  // Split review body into paragraphs for podcast player insertion
  const paragraphs = review.reviewBody ? review.reviewBody.split('\n\n').filter(p => p.trim()) : [];

  return (
    <div className="relative" data-testid="review-display">
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
            
            {/* Copy URL */}
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

            {/* Native Share Button */}
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

      {/* Action Bar */}
      <div className="sticky top-20 z-40 glass border-b border-slate-800 pdf-exclude">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => onBack ? onBack() : window.history.back()} 
              className="text-xs font-black uppercase text-slate-500 hover:text-white transition-colors flex items-center gap-2"
              data-testid="back-btn"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              Back to Magazine
            </button>
          </div>
          {/* Action buttons only shown when NOT in view-only mode (i.e., from user's own dashboard) */}
          {!review.viewOnly && (
            <div className="flex items-center gap-3" data-testid="review-actions">
              {!review.isPublished && (
                <button 
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="bg-emerald-500 text-slate-950 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  data-testid="publish-btn"
                >
                  {isPublishing && (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                  {isPublishing ? 'Publishing...' : 'Publish to Magazine'}
                </button>
              )}
              {canDownloadPDF ? (
                <button onClick={handleDownloadPDF} className="bg-slate-800 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-700 transition-colors" data-testid="download-pdf-btn">
                  Export PDF
                </button>
              ) : (
                <button 
                  onClick={onUpgrade} 
                  className="bg-slate-700 text-slate-400 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer hover:bg-slate-600 transition-colors" 
                  data-testid="download-pdf-btn"
                  title="Upgrade to download PDF"
                >
                  Export PDF (Pro)
                </button>
              )}
              {editMode ? (
                <button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="bg-emerald-500 text-slate-950 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  data-testid="save-changes-btn"
                >
                  {isSaving && (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              ) : (
                <button 
                  onClick={() => setEditMode(true)} 
                  className="text-slate-400 hover:text-white text-xs font-black uppercase tracking-widest"
                  data-testid="edit-btn"
                >
                  Edit
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div ref={printRef} className="bg-slate-950">
        {/* Hero Section */}
        <div className="relative min-h-[60vh] flex items-end">
          <div className="absolute inset-0">
            <img src={review.imageUrl} className="w-full h-full object-cover" alt={review.songTitle} />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 to-transparent" />
          </div>
          
          <div className="relative z-10 max-w-[1440px] mx-auto px-8 pb-16 pt-32 w-full">
            <div className="max-w-5xl">
              <div className="flex items-center gap-4 mb-6">
                <span className="text-xs font-black uppercase tracking-[0.5em] text-emerald-500">{review.analysis?.genre || 'Unknown'}</span>
                <span className="w-1 h-1 bg-emerald-500 rounded-full" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">{new Date(review.createdAt).toLocaleDateString()}</span>
              </div>
              
              {editMode ? (
                <input 
                  value={editedReview.headline}
                  onChange={e => setEditedReview({...editedReview, headline: e.target.value})}
                  className="w-full bg-transparent border-b-2 border-emerald-500 text-4xl font-black outline-none mb-4"
                  data-testid="edit-headline-input"
                />
              ) : (
                <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight tracking-tight mb-6 gradient-text">{review.headline}</h1>
              )}
              
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="bg-emerald-500 text-slate-950 font-black text-4xl px-5 py-3 rounded-xl">
                    {review.rating}
                  </div>
                  <div>
                    <p className="text-2xl font-black text-white">{review.songTitle}</p>
                    <p className="text-emerald-500 font-bold uppercase tracking-widest">{review.artistName}</p>
                  </div>
                </div>
              </div>
              
              {/* Author Credit */}
              <div className="flex items-center gap-2 mt-6">
                <span className="text-slate-400 text-sm">By</span>
                <span className="text-white font-bold text-sm">Verdiq Critic Team</span>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" fill="#3B82F6" />
                  <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Editorial Content */}
        <div className="max-w-[1440px] mx-auto px-8 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            <div className="lg:col-span-8">
              {/* Opening Quote - Short hook line */}
              {review.hook && (
                <div className="mb-12 border-y border-emerald-500/20 py-8">
                  <p className="text-2xl lg:text-3xl text-white font-bold leading-tight tracking-tight text-center italic">
                    {editMode ? (
                      <textarea 
                        value={editedReview.hook}
                        onChange={e => setEditedReview({...editedReview, hook: e.target.value})}
                        className="w-full bg-transparent border-b border-emerald-500 outline-none resize-none text-center"
                        rows={2}
                        data-testid="edit-hook-textarea"
                      />
                    ) : `"${review.hook}"`}
                  </p>
                </div>
              )}

              {/* NME-Style Editorial Review Body with Podcast Player after 2nd paragraph */}
              {paragraphs.length > 0 ? (
                <div className="mb-12">
                  {editMode ? (
                    <textarea 
                      value={editedReview.reviewBody}
                      onChange={e => setEditedReview({...editedReview, reviewBody: e.target.value})}
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-slate-300 font-serif text-lg leading-relaxed outline-none resize-none min-h-[400px]"
                      rows={20}
                      data-testid="edit-review-body-textarea"
                    />
                  ) : (
                    <div className="text-slate-300 font-serif text-lg leading-relaxed prose prose-invert prose-emerald max-w-none">
                      {paragraphs.map((paragraph, i) => (
                        <React.Fragment key={i}>
                          {i === 0 ? (
                            /* First paragraph with drop cap */
                            <p className="mb-6">
                              <span className="float-left mr-3 mt-1 bg-emerald-500 text-slate-950 font-black text-5xl leading-none px-4 py-2 rounded-lg">
                                {paragraph.charAt(0)}
                              </span>
                              {paragraph.slice(1)}
                            </p>
                          ) : (
                            <p className="mb-6">{paragraph}</p>
                          )}
                          
                          {/* Insert Podcast Player after 2nd paragraph OR after 1st if single paragraph */}
                          {((i === 1) || (paragraphs.length === 1 && i === 0)) && shouldShowPodcastSection && (
                            <div className="my-10 not-prose">
                              <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20 rounded-3xl border border-slate-800 p-6 shadow-2xl shadow-emerald-500/5 w-full">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                                    <svg className="w-3 h-3 text-slate-950" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                  </div>
                                  <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500">
                                    The Verdiq Session
                                  </h3>
                                </div>
                                {hasPodcastData ? (
                                  <SpotifyPlayer
                                    audioSrc={podcastSource}
                                    title={`${review.songTitle} - Review Session`}
                                    artist={review.artistName}
                                    imageUrl={review.imageUrl}
                                    onPlaylistClick={onViewPodcast}
                                  />
                                ) : (
                                  <div className="text-slate-400 text-sm py-4 text-center">
                                    Podcast audio unavailable. This review was created before podcast generation was required.
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Fallback to breakdown sections for older reviews */
                review.breakdown && Object.entries(review.breakdown).map(([key, value]) => (
                  value && (
                    <div key={key} className="mb-10">
                      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-emerald-500 mb-4">{key.replace(/([A-Z])/g, ' $1').trim()}</h3>
                      <p className="text-slate-300 font-serif text-lg leading-relaxed">{value}</p>
                    </div>
                  )
                ))
              )}

              {/* Who Is It For */}
              {review.whoIsItFor && (
                <div className="mb-10 p-8 bg-slate-900/50 rounded-3xl border border-slate-800">
                  <h3 className="text-sm font-black uppercase tracking-[0.3em] text-emerald-500 mb-4">Who Is It For</h3>
                  <p className="text-slate-300 font-serif text-lg leading-relaxed">{review.whoIsItFor}</p>
                </div>
              )}

              {/* Summary Quote - Solid green background at bottom of review */}
              {review.pullQuotes && review.pullQuotes.length > 0 && (
                <div className="my-16 bg-emerald-500 p-12 rounded-3xl shadow-2xl relative z-10">
                  <blockquote className="text-3xl lg:text-4xl font-black text-slate-950 leading-tight text-center tracking-tight italic">
                    "{review.pullQuotes[0]}"
                  </blockquote>
                </div>
              )}

              {/* Share Review Button */}
              <div className="mt-12 flex justify-center">
                <button 
                  onClick={() => setShowShareModal(true)}
                  className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 px-8 py-4 rounded-2xl transition-colors border border-slate-700"
                  data-testid="share-review-btn"
                >
                  <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <span className="text-lg font-bold text-white">Share This Review</span>
                </button>
              </div>
            </div>

            {/* Sidebar */}
            <aside className="lg:col-span-4 space-y-8">
              {/* Technical Analysis */}
              <div className="glass p-6 rounded-3xl border border-slate-700">
                <h4 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-500 mb-6">Technical Analysis</h4>
                <div className="space-y-4">
                  {[
                    { label: 'Genre', value: review.analysis?.genre || 'Unknown' },
                    { label: 'Energy', value: review.analysis?.energy || 'Medium' },
                    { label: 'Mood', value: review.analysis?.mood || 'Unknown' },
                    { label: 'Vocal Type', value: review.analysis?.vocalType || 'Unknown' },
                    { label: 'Dynamic Range', value: review.analysis?.dynamicRange || 'Unknown' },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between items-center">
                      <span className="text-xs text-slate-500 uppercase tracking-widest">{item.label}</span>
                      <span className="text-sm font-bold text-white">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Instruments */}
              {review.analysis?.instruments && review.analysis.instruments.length > 0 && (
                <div className="glass p-6 rounded-3xl border border-slate-700">
                  <h4 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-500 mb-4">Instruments Detected</h4>
                  <div className="flex flex-wrap gap-2">
                    {review.analysis.instruments.map((inst, i) => (
                      <span key={i} className="bg-slate-800 text-slate-300 px-3 py-1 rounded-full text-xs font-bold">
                        {inst}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Spectrally Similar - Under instruments detected */}
              <div className="glass p-6 rounded-3xl border border-slate-700" data-testid="spectrally-similar-section">
                <h4 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-500 mb-4">Spectrally Similar</h4>
                {review.soundsLike && review.soundsLike.length > 0 ? (
                  <div className="space-y-3">
                    {review.soundsLike.map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500 font-black text-xs flex-shrink-0">
                          {i + 1}
                        </div>
                        <span className="text-sm text-slate-300 leading-tight">{item}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 opacity-50">
                      <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-slate-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                      <span className="text-sm text-slate-500 italic">Analyzing spectral fingerprint...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Semantic Synergy */}
              {review.semanticSynergy && (
                <div className="glass p-6 rounded-3xl border border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-500">Synergy Score</h4>
                    <span className="text-3xl font-black text-emerald-500">{review.semanticSynergy.score}%</span>
                  </div>
                  <p className="text-sm text-slate-400 mb-4">{review.semanticSynergy.analysis}</p>
                  {review.semanticSynergy.keyThematicMatches && (
                    <div className="flex flex-wrap gap-2">
                      {review.semanticSynergy.keyThematicMatches.map((match, i) => (
                        <span key={i} className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-xs font-bold">
                          {match}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Best Moment */}
              {review.bestMoment && (
                <div className="bg-emerald-500/10 p-6 rounded-3xl border border-emerald-500/20">
                  <h4 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-500 mb-4">Best Moment</h4>
                  <p className="text-lg font-black text-white mb-2">{review.bestMoment.timestamp}</p>
                  <p className="text-sm text-slate-300">{review.bestMoment.description}</p>
                </div>
              )}
            </aside>
          </div>
        </div>

        {/* Market Score Section */}
        {review.marketScore && (
          <div className="bg-slate-900 border-y border-white/5 py-24">
            <div className="max-w-[1440px] mx-auto px-8">
              <div className="flex flex-col lg:flex-row items-start gap-16">
                <div className="lg:w-1/3">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-emerald-500 mb-8">Verdiq Market Score</h2>
                  <div className="flex items-baseline gap-4 mb-8">
                    <span className="text-[10rem] font-black text-white leading-none tracking-tighter">
                      {typeof review.marketScore.overallScore === 'number' ? review.marketScore.overallScore.toFixed(1) : (review.marketScore.overallScore || '0.0')}
                    </span>
                    <span className="text-4xl text-slate-700 font-black">/10</span>
                  </div>
                  <div className="space-y-4">
                    <p className="text-3xl font-black text-emerald-500 uppercase tracking-tighter">{review.marketScore.marketStatus || 'Pending'}</p>
                    <p className="text-lg text-slate-500 font-light leading-relaxed">{review.marketScore.releaseConfidence || ''}</p>
                  </div>
                </div>

                <div className="lg:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-10">
                  {review.marketScore.breakdown && Object.entries(review.marketScore.breakdown).map(([key, data]: [string, any]) => (
                    data && (
                      <div key={key} className="card-premium !p-10">
                        <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </h5>
                        {data.score !== undefined && (
                          <div className="flex items-center gap-6 mb-6">
                            <div className="flex-grow h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                style={{ width: `${(data.score / 10) * 100}%` }}
                              />
                            </div>
                            <span className="text-2xl font-black text-white">{data.score}</span>
                          </div>
                        )}
                        <p className="text-slate-400 text-base leading-relaxed">{data.insight || data.signal || data.profile || ''}</p>
                      </div>
                    )
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              {review.marketScore.recommendations && (
                <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                  {review.marketScore.recommendations.focus && (
                    <div>
                      <h5 className="text-xs font-black uppercase tracking-widest text-emerald-500 mb-4">Focus On</h5>
                      <ul className="space-y-2">
                        {review.marketScore.recommendations.focus.map((item, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm text-slate-300">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {review.marketScore.recommendations.avoid && (
                    <div>
                      <h5 className="text-xs font-black uppercase tracking-widest text-rose-500 mb-4">Avoid</h5>
                      <ul className="space-y-2">
                        {review.marketScore.recommendations.avoid.map((item, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm text-slate-300">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewDisplay;
