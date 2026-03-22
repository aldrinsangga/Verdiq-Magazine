import React from 'react';

interface ReviewMoreFromMagazineProps {
  allReviews: any[];
  currentReviewId: string;
  onSelectReview: (review: any) => void;
}

const ReviewMoreFromMagazine: React.FC<ReviewMoreFromMagazineProps> = ({
  allReviews,
  currentReviewId,
  onSelectReview
}) => {
  if (allReviews.length === 0) return null;

  const filteredReviews = allReviews
    .filter(r => r.id !== currentReviewId)
    .slice(0, 8);

  if (filteredReviews.length === 0) return null;

  return (
    <div className="bg-slate-900 border-t border-white/5 py-12 md:py-24">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8">
        <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-emerald-500 mb-8 md:mb-12">
          More from Verdiq Magazine
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {filteredReviews.map(r => (
            <div 
              key={r.id} 
              onClick={() => onSelectReview(r)}
              className="group cursor-pointer"
            >
              <div className="relative aspect-video rounded-2xl overflow-hidden mb-4 border border-slate-800">
                <img 
                  src={r.imageUrl} 
                  alt={r.songTitle} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent opacity-60" />
                <div className="absolute bottom-4 left-4">
                  <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-2 py-1 rounded">
                    {r.rating}
                  </span>
                </div>
              </div>
              <h3 className="font-black text-emerald-500 [&::first-line]:text-white group-hover:text-emerald-400 transition-colors leading-tight uppercase tracking-tight text-base">
                {(r.headline || r.songTitle).toUpperCase()}
              </h3>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReviewMoreFromMagazine;
