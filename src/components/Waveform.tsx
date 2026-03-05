import React from 'react';

const Waveform = () => {
  return (
    <div className="w-full h-12 bg-slate-800/50 rounded-lg flex items-center justify-center">
      <div className="flex gap-1">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="w-1 bg-emerald-500/50 rounded-full" style={{ height: `${Math.random() * 100}%` }} />
        ))}
      </div>
    </div>
  );
};

export default Waveform;
