import React from 'react';

const SubmissionGuide = ({ onNavigate }: { onNavigate?: (view: string) => void }) => {
  return (
    <div className="max-w-4xl mx-auto px-8 py-24">
      <h1 className="text-4xl font-black mb-8">Submission Guide</h1>
      
      <div className="space-y-12 text-slate-300">
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">1. Prepare Your Audio</h2>
          <p className="mb-4">For the best analysis, we recommend uploading high-quality, uncompressed audio files. The AI analyzes the spectral characteristics, mixing, and mastering of your track.</p>
          <ul className="list-disc pl-6 space-y-2 text-slate-400">
            <li><strong>Supported Formats:</strong> MP3, WAV, FLAC, AAC, OGG.</li>
            <li><strong>Max File Size:</strong> 50MB per track.</li>
            <li><strong>Quality:</strong> 320kbps MP3 or 16-bit/44.1kHz WAV recommended.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-white mb-4">2. Gather Your Metadata</h2>
          <p className="mb-4">The more context you provide, the better and more accurate the review and podcast will be.</p>
          <ul className="list-disc pl-6 space-y-2 text-slate-400">
            <li><strong>Track Name & Artist Name:</strong> Ensure these are spelled correctly.</li>
            <li><strong>Lyrics (Optional but recommended):</strong> Helps the AI analyze the thematic depth and vocal delivery.</li>
            <li><strong>Artist Bio (Optional):</strong> Gives the AI context about your background, genre, and artistic journey.</li>
            <li><strong>Cover Art & Artist Photo:</strong> Used for the magazine display and social sharing. High-resolution JPG or PNG preferred.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-white mb-4">3. Credit Costs</h2>
          <p className="mb-4">Verdiq operates on a credit system. Here is what you can expect to spend:</p>
          <ul className="list-disc pl-6 space-y-2 text-slate-400">
            <li><strong>Generate Review & Podcast:</strong> 10 Credits</li>
            <li><strong>Publish to Magazine:</strong> 5 Credits</li>
            <li><strong>Edit Generated Review:</strong> 3 Credits</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-white mb-4">4. What Happens Next?</h2>
          <p className="mb-4">Once you submit, our AI engine will process your track. This usually takes 1-3 minutes. You will receive:</p>
          <ul className="list-disc pl-6 space-y-2 text-slate-400">
            <li>A deep technical analysis of your mix and master.</li>
            <li>A beautifully written editorial review.</li>
            <li>A fully synthesized, multi-speaker podcast discussing your track.</li>
          </ul>
          <p className="mt-4">You can then choose to keep it private, edit it, or publish it to the Verdiq Magazine for the world to see.</p>
        </section>
        
        {onNavigate && (
          <div className="pt-8">
            <button 
              onClick={() => onNavigate('dashboard')}
              className="bg-emerald-500 text-slate-950 px-8 py-4 rounded-xl font-bold hover:bg-emerald-400 transition-colors"
            >
              Start Your Submission
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubmissionGuide;
