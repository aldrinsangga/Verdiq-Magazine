import React from 'react';

interface ReviewHeaderProps {
  onBack: () => void;
  isViewOnly: boolean;
  review: any;
  isPublishing: boolean;
  isSaving: boolean;
  editMode: boolean;
  handlePublish: () => void;
  handleDownloadPDF: () => void;
  isDownloadingPDF?: boolean;
  handleSave: () => void;
  setEditMode: (mode: boolean) => void;
}

const ReviewHeader: React.FC<ReviewHeaderProps> = ({
  onBack,
  isViewOnly,
  review,
  isPublishing,
  isSaving,
  isDownloadingPDF,
  editMode,
  handlePublish,
  handleDownloadPDF,
  handleSave,
  setEditMode
}) => {
  return (
    <div className="sticky top-24 z-40 glass border-b border-slate-800 pdf-exclude">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="text-[10px] sm:text-xs font-black uppercase text-slate-500 hover:text-white transition-colors flex items-center gap-2"
            data-testid="back-btn"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Back to Magazine</span>
            <span className="sm:hidden">Back</span>
          </button>
        </div>
        {!isViewOnly && (
          <div className="flex items-center gap-2 sm:gap-3" data-testid="review-actions">
            {!review.isPublished && (
              <button 
                onClick={handlePublish}
                disabled={isPublishing}
                className="bg-emerald-500 text-slate-950 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                data-testid="publish-btn"
              >
                {isPublishing && (
                  <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                <div className="flex flex-col items-center">
                  <span>{isPublishing ? '...' : 'Publish'}</span>
                  <span className="text-[8px] opacity-60 font-black tracking-widest mt-0.5">5 CREDITS</span>
                </div>
              </button>
            )}
            <button 
              onClick={handleDownloadPDF} 
              disabled={isDownloadingPDF}
              className="bg-slate-800 text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" 
              data-testid="download-pdf-btn"
            >
              {isDownloadingPDF && (
                <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              <span>{isDownloadingPDF ? '...' : 'PDF'}</span>
            </button>
            {editMode ? (
              <button 
                onClick={handleSave} 
                disabled={isSaving}
                className="bg-emerald-500 text-slate-950 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                data-testid="save-changes-btn"
              >
                {isSaving && (
                  <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                <span>{isSaving ? '...' : 'Save'}</span>
              </button>
            ) : (
              <button 
                onClick={() => setEditMode(true)} 
                className="text-slate-400 hover:text-white text-[10px] sm:text-xs font-black uppercase tracking-widest flex flex-col items-center"
                data-testid="edit-btn"
              >
                <span>Edit</span>
                <span className="text-[8px] opacity-40 font-black tracking-widest mt-0.5">3 CREDITS</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewHeader;
