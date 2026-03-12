import React from 'react';
import ReactMarkdown from 'react-markdown';
import SpotifyPlayer from './SpotifyPlayer';

interface ReviewEditorialProps {
  review: any;
  editMode: boolean;
  editedReview: any;
  setEditedReview: (review: any) => void;
  paragraphs: string[];
  shouldShowPodcastSection: boolean;
  hasPodcastData: boolean;
  podcastSource: string | null;
  onViewPodcast: () => void;
  setShowShareModal: (show: boolean) => void;
}

const ReviewEditorial: React.FC<ReviewEditorialProps> = ({
  review,
  editMode,
  editedReview,
  setEditedReview,
  paragraphs,
  shouldShowPodcastSection,
  hasPodcastData,
  podcastSource,
  onViewPodcast,
  setShowShareModal
}) => {
  return (
    <div className="lg:col-span-8">
      {/* Opening Quote */}
      {review.hook && (
        <div className="mb-12 border-y border-emerald-500/20 py-8">
          <p className="text-xl sm:text-2xl lg:text-3xl text-white font-bold leading-tight tracking-tight text-center italic">
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

      {/* Editorial Review Body */}
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
            <div className="text-slate-300 font-serif text-lg leading-relaxed max-w-none">
              {paragraphs.map((paragraph, i) => (
                <React.Fragment key={i}>
                  {i === 0 ? (
                    <div className="mb-6">
                      <span className="float-left mr-3 mt-1 bg-emerald-500 text-slate-950 font-black text-5xl leading-none px-4 py-2 rounded-lg">
                        {paragraph.charAt(0)}
                      </span>
                      <ReactMarkdown 
                        components={{ 
                          p: React.Fragment,
                          a: ({node, ...props}) => <a {...props} className="review-link" target="_blank" rel="noopener noreferrer" />
                        }}
                      >
                        {paragraph.slice(1)}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="mb-6">
                      <ReactMarkdown 
                        components={{ 
                          p: React.Fragment,
                          a: ({node, ...props}) => <a {...props} className="review-link" target="_blank" rel="noopener noreferrer" />
                        }}
                      >
                        {paragraph}
                      </ReactMarkdown>
                    </div>
                  )}
                  
                  {i === 1 && (review as any).artistPhotoUrl && (
                    <div className="my-8 md:my-12 rounded-[24px] md:rounded-[40px] overflow-hidden border border-white/5 shadow-2xl bg-slate-900">
                      <img src={(review as any).artistPhotoUrl} className="w-full object-cover" alt="Artist Portrait" />
                    </div>
                  )}

                  {i === paragraphs.length - 2 && shouldShowPodcastSection && (
                    <div className="my-10">
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
        review.breakdown && Object.entries(review.breakdown).map(([key, value]) => (
          value && (
            <div key={key} className="mb-10">
              <h3 className="text-sm font-black uppercase tracking-[0.3em] text-emerald-500 mb-4">{key.replace(/([A-Z])/g, ' $1').trim()}</h3>
              <p className="text-slate-300 font-serif text-lg leading-relaxed">{(value as any)}</p>
            </div>
          )
        ))
      )}

      {review.whoIsItFor && (
        <div className="mb-10 p-8 bg-slate-900/50 rounded-3xl border border-slate-800">
          <h3 className="text-sm font-black uppercase tracking-[0.3em] text-emerald-500 mb-4">Who Is It For</h3>
          <p className="text-slate-300 font-serif text-lg leading-relaxed">{review.whoIsItFor}</p>
        </div>
      )}

      {review.pullQuotes && review.pullQuotes.length > 0 && (
        <div className="my-12 md:my-16 bg-emerald-500 p-6 md:p-12 rounded-3xl shadow-2xl relative z-10">
          <blockquote className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-950 leading-tight text-center tracking-tight italic">
            "{review.pullQuotes[0]}"
          </blockquote>
        </div>
      )}

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
  );
};

export default ReviewEditorial;
