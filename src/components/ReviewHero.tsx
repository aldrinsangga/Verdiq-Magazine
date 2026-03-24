import React from 'react';
import { Eye } from 'lucide-react';

interface ReviewHeroProps {
  review: any;
  editMode: boolean;
  editedReview: any;
  setEditedReview: (review: any) => void;
  readCount?: number;
}

const ReviewHero: React.FC<ReviewHeroProps> = ({
  review,
  editMode,
  editedReview,
  setEditedReview,
  readCount = 0
}) => {
  const displayReview = editMode ? editedReview : review;
  const imageUrl = displayReview.imageUrl || `https://picsum.photos/seed/${displayReview.id}/1200/800`;

  return (
    <div className="relative min-h-[60vh] md:min-h-[85vh] flex items-end bg-slate-900">
      <div className="absolute inset-0 z-0">
        <img 
          src={imageUrl} 
          className="w-full h-full object-cover" 
          alt={displayReview.songTitle} 
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/40 to-transparent" />
      </div>
      
      <div className="relative z-10 max-w-[1440px] mx-auto px-4 md:px-8 pb-12 md:pb-20 pt-32 md:pt-48 w-full">
        <div className="max-w-5xl">
          <div className="flex items-center gap-4 mb-6">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.5em] text-emerald-500">
              {review.analysis?.genre || 'Unknown'}
            </span>
            <span className="w-1 h-1 bg-emerald-500 rounded-full" />
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400">
              {new Date(review.createdAt).toLocaleDateString()}
            </span>
          </div>
          
          {editMode ? (
            <input 
              value={editedReview.headline}
              onChange={e => setEditedReview({...editedReview, headline: e.target.value})}
              className="w-full bg-transparent border-b-2 border-emerald-500 text-2xl sm:text-4xl font-black outline-none mb-4"
              data-testid="edit-headline-input"
            />
          ) : (
            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-black leading-tight tracking-tight mb-6 review-title-split uppercase">
              {(review.headline || '').toUpperCase()}
            </h1>
          )}
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-500 text-slate-950 font-black text-2xl sm:text-4xl px-3 sm:px-5 py-2 sm:py-3 rounded-xl">
                {review.rating}
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-white">{review.songTitle}</p>
                <p className="text-emerald-500 font-bold uppercase tracking-widest text-xs sm:text-base">{review.artistName}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-6">
            <span className="text-slate-400 text-sm">By</span>
            <span className="text-white font-bold text-sm">Verdiq Critic Team</span>
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="#3B82F6" />
              <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <div className="flex items-center gap-1.5 ml-4 text-slate-400">
              <Eye className="w-4 h-4" />
              <span className="text-sm font-bold">{readCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewHero;
