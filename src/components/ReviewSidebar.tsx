import React from 'react';

interface ReviewSidebarProps {
  review: any;
}

const ReviewSidebar: React.FC<ReviewSidebarProps> = ({ review }) => {
  return (
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

      {/* Spectrally Similar */}
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

      {/* Market Score */}
      {review.marketScore && (
        <div className="glass p-6 rounded-3xl border border-emerald-500/20 bg-emerald-500/5">
          <h4 className="text-[10px] font-black uppercase tracking-[0.5em] text-emerald-500 mb-6">Verdiq Market Score</h4>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-6xl font-black text-white leading-none tracking-tighter">
              {typeof review.marketScore.overallScore === 'number' ? review.marketScore.overallScore.toFixed(0) : (review.marketScore.overallScore || '0')}
            </span>
            <span className="text-xl text-slate-700 font-black">/100</span>
          </div>
          
          <div className="space-y-1 mb-8">
            <p className="text-xl font-black text-emerald-500 uppercase tracking-tighter">{review.marketScore.marketStatus || 'Pending'}</p>
            <p className="text-xs text-slate-500 font-light leading-relaxed">{review.marketScore.releaseConfidence || ''}</p>
          </div>

          <div className="space-y-4 mb-8">
            {review.marketScore.breakdown && Object.entries(review.marketScore.breakdown).map(([key, data]: [string, any]) => (
              data && (
                <div key={key}>
                  <div className="flex justify-between text-[8px] uppercase font-black tracking-widest text-slate-500 mb-1.5">
                    <span>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span>{data.score}</span>
                  </div>
                  <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                      style={{ width: `${data.score}%` }}
                    />
                  </div>
                </div>
              )
            ))}
          </div>

          {review.marketScore.recommendations && (
            <div className="space-y-4 pt-4 border-t border-slate-800">
              {review.marketScore.recommendations.focus && (
                <div>
                  <h5 className="text-[8px] font-black uppercase tracking-widest text-emerald-500 mb-2">Focus On</h5>
                  <ul className="space-y-1">
                    {review.marketScore.recommendations.focus.slice(0, 2).map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-500 text-[10px] mt-0.5">•</span>
                        <span className="text-[10px] text-slate-400 leading-tight">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

export default ReviewSidebar;
