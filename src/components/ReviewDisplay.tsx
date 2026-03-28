import React, { useState, useRef, useMemo } from 'react';
import html2pdf from 'html2pdf.js';
import { Clock } from 'lucide-react';
import ReviewHeader from './ReviewHeader';
import ReviewHero from './ReviewHero';
import ReviewEditorial from './ReviewEditorial';
import ReviewSidebar from './ReviewSidebar';
import ReviewModals from './ReviewModals';
import ReviewMoreFromMagazine from './ReviewMoreFromMagazine';
import { getAuthHeaders } from '../authClient';

const ReviewDisplay = ({ 
  review, 
  currentUser,
  onUpgrade, 
  onSave, 
  onPublish, 
  onViewPodcast, 
  onBack, 
  canPublish, 
  audioFile, 
  isSubscribed, 
  onSelectReview, 
  allReviews = [], 
  features = {}, 
  viewOnly = false,
  onNavigate
}) => {
  const [editMode, setEditMode] = useState(false);
  const [editedReview, setEditedReview] = useState(review);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [readCount, setReadCount] = useState(review.readCount || 0);
  const printRef = useRef(null);
  const hasTrackedRead = useRef(false);

  React.useEffect(() => {
    if (review?.id && !hasTrackedRead.current) {
      hasTrackedRead.current = true;
      const API_URL = (import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL !== 'undefined') 
        ? import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '') 
        : '';
      
      fetch(`${API_URL}/api/reviews/${review.id}/read`, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          if (data.read_count) {
            setReadCount(data.read_count);
          }
        })
        .catch(console.error);
    }
  }, [review?.id]);

  const isViewOnly = viewOnly || review.viewOnly;
  const isAuthor = currentUser && review && (review.userId === currentUser.id);
  const canEdit = !isViewOnly || isAuthor;
  const canPublishToMagazine = true; 

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const success = await onSave(editedReview);
      if (success) {
        setEditMode(false);
      }
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

  const handleDownloadPDF = async () => {
    if (!printRef.current) {
      console.error('PDF Download Error: printRef.current is null');
      return;
    }

    setIsDownloadingPDF(true);
    try {
      const opt = {
        margin: 0,
        filename: `${(review.songTitle || 'Review').replace(/\s+/g, '_')}_Verdiq_Review.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          logging: false,
          letterRendering: true,
          allowTaint: true,
          onclone: (clonedDoc: Document) => {
            // Remove sidebar and adjust layout for PDF
            const sidebar = clonedDoc.querySelector('aside');
            if (sidebar) sidebar.remove();

            const editorial = clonedDoc.querySelector('.lg\\:col-span-8');
            if (editorial) {
              editorial.classList.remove('lg:col-span-8');
              editorial.classList.add('lg:col-span-12');
              (editorial as HTMLElement).style.width = '100%';
            }

            // Remove "More from Magazine" section
            const moreFromMagazine = clonedDoc.querySelector('.bg-slate-900.border-t.border-white\\/5');
            if (moreFromMagazine) moreFromMagazine.remove();

            const styleTags = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
            styleTags.forEach(tag => tag.remove());

            const elements = clonedDoc.querySelectorAll('*');
            elements.forEach(node => {
              const el = node as HTMLElement;
              if (el.classList.contains('gradient-text')) {
                el.style.background = 'none';
                el.style.webkitBackgroundClip = 'initial';
                el.style.color = '#ffffff';
              }
              if (el.tagName === 'IMG') {
                (el as HTMLImageElement).crossOrigin = 'anonymous';
              }
            });

            const style = clonedDoc.createElement('style');
            style.innerHTML = `
              * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              body { background-color: #020617; color: #f1f5f9; font-family: sans-serif; }
              .bg-slate-950 { background-color: #020617 !important; }
              .bg-emerald-500 { background-color: #10b981 !important; }
              .bg-slate-800 { background-color: #1e293b !important; }
              .bg-slate-900 { background-color: #0f172a !important; }
              .text-white { color: #ffffff !important; }
              .text-slate-100 { color: #f1f5f9 !important; }
              .text-slate-400 { color: #94a3b8 !important; }
              .text-emerald-500 { color: #10b981 !important; }
              .font-black { font-weight: 900 !important; }
              .font-bold { font-weight: 700 !important; }
              .uppercase { text-transform: uppercase !important; }
              .italic { font-style: italic !important; }
              .relative { position: relative !important; }
              .absolute { position: absolute !important; }
              .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
              .w-full { width: 100% !important; }
              .h-full { height: 100% !important; }
              .object-cover { object-fit: cover !important; }
              .flex { display: flex !important; }
              .items-center { align-items: center !important; }
              .items-end { align-items: flex-end !important; }
              .justify-center { justify-content: center !important; }
              .gap-2 { gap: 0.5rem !important; }
              .gap-4 { gap: 1rem !important; }
              .gap-6 { gap: 1.5rem !important; }
              .p-4 { padding: 1rem !important; }
              .pb-12 { padding-bottom: 3rem !important; }
              .pt-32 { padding-top: 8rem !important; }
              .rounded-xl { border-radius: 0.75rem !important; }
              .rounded-full { border-radius: 9999px !important; }
              .text-xs { font-size: 0.75rem !important; }
              .text-sm { font-size: 0.875rem !important; }
              .text-base { font-size: 1rem !important; }
              .text-xl { font-size: 1.25rem !important; }
              .text-2xl { font-size: 1.5rem !important; }
              .text-3xl { font-size: 1.875rem !important; }
              .text-4xl { font-size: 2.25rem !important; }
              .text-6xl { font-size: 3.75rem !important; }
              .bg-gradient-to-t { background: linear-gradient(to top, #020617, rgba(2, 6, 23, 0.4), transparent) !important; }
              .bg-gradient-to-r { background: linear-gradient(to right, rgba(2, 6, 23, 0.6), transparent) !important; }
              .grid { display: grid !important; }
              .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
              .lg\\:grid-cols-12 { grid-template-columns: repeat(12, minmax(0, 1fr)) !important; }
              .lg\\:col-span-8 { grid-column: span 12 / span 12 !important; width: 100% !important; }
              .lg\\:col-span-12 { grid-column: span 12 / span 12 !important; width: 100% !important; }
              .lg\\:col-span-4 { display: none !important; }
            `;
            clonedDoc.head.appendChild(style);
          }
        },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const }
      };
      
      await html2pdf().from(printRef.current).set(opt).save();
    } catch (error) {
      console.error('PDF Download Error:', error);
    } finally {
      setIsDownloadingPDF(false);
    }
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
        if (e.name !== 'AbortError') console.error('Share failed:', e);
      }
    } else {
      handleCopyLink();
    }
  };

  const getPodcastSource = () => {
    let url = review.podcastAudioUrl || review.podcastAudio || review.podcast_audio_path;
    if (url && typeof url === 'string' && !url.startsWith('http') && !url.startsWith('data:')) {
      return `data:audio/wav;base64,${url}`;
    }
    return (typeof url === 'string' ? url : null);
  };

  const podcastSource = getPodcastSource();
  const hasPodcastData = !!podcastSource;
  const shouldShowPodcastSection = hasPodcastData || review.hasPodcast;
  const showTemporaryBanner = review.isTemporary && !isSubscribed && !review.isPublished;
  const paragraphs = useMemo(() => {
    return review.reviewBody 
      ? review.reviewBody.replace(/\\n/g, '\n').split(/\n+/).filter((p: string) => p.trim()) 
      : [];
  }, [review.reviewBody]);

  return (
    <div className="relative w-full overflow-x-hidden" data-testid="review-display">
      {showTemporaryBanner && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 py-2 px-4 flex items-center justify-center gap-2 text-amber-500 text-xs font-medium">
          <Clock size={14} />
          <span>This is a temporary review. It will expire in 24 hours unless published to the magazine.</span>
        </div>
      )}
      <ReviewModals 
        showSubscribeModal={showSubscribeModal}
        setShowSubscribeModal={setShowSubscribeModal}
        onUpgrade={onUpgrade}
        showShareModal={showShareModal}
        setShowShareModal={setShowShareModal}
        getShareUrl={getShareUrl}
        handleCopyLink={handleCopyLink}
        copySuccess={copySuccess}
        handleNativeShare={handleNativeShare}
      />

      <ReviewHeader 
        onBack={() => onBack ? onBack() : window.history.back()}
        isViewOnly={!canEdit}
        review={review}
        isPublishing={isPublishing}
        isSaving={isSaving}
        isDownloadingPDF={isDownloadingPDF}
        editMode={editMode}
        handlePublish={handlePublish}
        handleDownloadPDF={handleDownloadPDF}
        handleSave={handleSave}
        setEditMode={setEditMode}
      />

      <div ref={printRef} className="bg-slate-950">
        <ReviewHero 
          review={review}
          editMode={editMode}
          editedReview={editedReview}
          setEditedReview={setEditedReview}
          readCount={readCount}
        />

        <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-12 md:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-16">
            <ReviewEditorial 
              review={review}
              editMode={editMode}
              editedReview={editedReview}
              setEditedReview={setEditedReview}
              paragraphs={paragraphs}
              shouldShowPodcastSection={shouldShowPodcastSection}
              hasPodcastData={hasPodcastData}
              podcastSource={podcastSource}
              onViewPodcast={onViewPodcast}
              setShowShareModal={setShowShareModal}
            />

            <ReviewSidebar review={review} onNavigate={onNavigate} />
          </div>
        </div>

        <ReviewMoreFromMagazine 
          allReviews={allReviews}
          currentReviewId={review.id}
          onSelectReview={onSelectReview}
        />
      </div>
    </div>
  );
};

export default ReviewDisplay;

