import React from 'react';

const Waveform = () => {
  return (
    <div className="w-full h-24 bg-slate-900/50 rounded-[32px] flex items-center justify-center px-12 border border-emerald-500/20 overflow-hidden relative group">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-emerald-500/5" />
      <div className="flex items-center gap-1 h-16 relative z-10">
        {[...Array(60)].map((_, i) => (
          <div 
            key={i} 
            className="w-1 bg-emerald-500 rounded-full" 
            style={{ 
              height: `${10 + Math.random() * 90}%`,
              opacity: 0.3 + Math.random() * 0.7,
              animation: `spectral-pulse ${0.5 + Math.random() * 1.5}s ease-in-out ${i * 0.02}s infinite`
            }} 
          />
        ))}
      </div>
      <style>{`
        @keyframes spectral-pulse {
          0%, 100% { transform: scaleY(1); opacity: 0.3; }
          50% { transform: scaleY(1.5); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Waveform;
