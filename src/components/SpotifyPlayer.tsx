import React, { useState, useRef, useEffect } from 'react';

/**
 * Spotify-styled audio player component
 * Uses official Spotify colors: #1DB954 (green), #121212 (background), #181818 (card), #b3b3b3 (secondary text)
 */
const SpotifyPlayer = ({ 
  audioSrc, 
  title, 
  artist, 
  imageUrl, 
  onPlaylistClick,
  onPlay,
  className = ""
}) => {
  const audioRef = useRef(null);
  const progressRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      if (!isDragging) {
        setCurrentTime(audio.currentTime);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [isDragging]);

  const togglePlay = async () => {
    console.log('=== SpotifyPlayer Debug ===');
    console.log('audioSrc prop:', audioSrc);
    console.log('audioRef.current:', !!audioRef.current);
    
    if (!audioRef.current || !audioSrc) {
      console.error('No audio source or ref:', { audioSrc, hasRef: !!audioRef.current });
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      const audio = audioRef.current;
      
      // If source is already set and ready, just play
      if (audio.src === audioSrc && audio.readyState >= 2) {
        console.log('Audio already loaded, playing...');
        try {
          await audio.play();
          setIsPlaying(true);
          onPlay?.();
        } catch (e) {
          console.error('Play failed:', e);
        }
        setIsLoading(false);
        return;
      }
      
      // Set up promise to wait for audio to be ready
      const playPromise = new Promise<void>((resolve, reject) => {
        const onCanPlay = () => {
          audio.removeEventListener('canplay', onCanPlay);
          audio.removeEventListener('error', onError);
          resolve();
        };
        
        const onError = (e) => {
          audio.removeEventListener('canplay', onCanPlay);
          audio.removeEventListener('error', onError);
          reject(new Error(`Audio load error: ${audio.error?.message || 'Unknown'}`));
        };
        
        audio.addEventListener('canplay', onCanPlay);
        audio.addEventListener('error', onError);
        
        // Set source and start loading
        console.log('Setting audio source and loading...');
        audio.src = audioSrc;
        audio.volume = isMuted ? 0 : volume;
        audio.load();
      });
      
      try {
        await playPromise;
        console.log('Audio loaded, attempting playback...');
        await audio.play();
        setIsPlaying(true);
        onPlay?.();
        console.log('Playback started successfully');
      } catch (e) {
        console.error('SpotifyPlayer playback failed:', e);
        console.error('Audio source was:', audioSrc);
      }
      setIsLoading(false);
    }
  };

  const handleProgressClick = (e) => {
    if (!audioRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleProgressDrag = (e) => {
    if (!isDragging || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setCurrentTime(percent * duration);
  };

  const handleDragStart = () => setIsDragging(true);
  
  const handleDragEnd = () => {
    if (isDragging && audioRef.current) {
      audioRef.current.currentTime = currentTime;
    }
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleProgressDrag);
      window.addEventListener('mouseup', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleProgressDrag);
        window.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, currentTime, duration]);

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume || 0.8;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const skipTime = (seconds) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
    }
  };

  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`bg-slate-800/50 backdrop-blur-xl rounded-2xl p-4 ${className}`} data-testid="spotify-player">
      <audio ref={audioRef} preload="metadata" />
      
      <div className="flex items-center gap-4">
        {/* Album Art */}
        <div className="relative w-14 h-14 flex-shrink-0 rounded-xl overflow-hidden shadow-lg border border-white/10">
          <img 
            src={imageUrl || 'https://picsum.photos/seed/podcast/200/200'} 
            alt={title}
            className="w-full h-full object-cover"
          />
          {isLoading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <svg className="w-5 h-5 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-bold text-sm truncate">{title || 'Podcast Session'}</h4>
          <p className="text-slate-400 text-xs truncate">{artist || 'Verdiq Editorial'}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          {/* Previous (Skip -15s) */}
          <button 
            onClick={() => skipTime(-15)}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            title="Back 15 seconds"
            data-testid="player-prev"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
              <text x="9" y="15" fontSize="6" fill="currentColor">15</text>
            </svg>
          </button>

          {/* Play/Pause - Verdiq style circular button */}
          <button 
            onClick={togglePlay}
            disabled={!audioSrc}
            className="w-10 h-10 flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 hover:scale-105 rounded-full text-slate-950 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="player-play"
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Next (Skip +15s) */}
          <button 
            onClick={() => skipTime(15)}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            title="Forward 15 seconds"
            data-testid="player-next"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
              <text x="9" y="15" fontSize="6" fill="currentColor">15</text>
            </svg>
          </button>
        </div>

        {/* Volume */}
        <div className="hidden sm:flex items-center gap-2 ml-2 group">
          <button onClick={toggleMute} className="text-slate-400 hover:text-white transition-colors">
            {isMuted || volume === 0 ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              </svg>
            ) : volume < 0.5 ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            )}
          </button>
          <div className="relative w-20 h-1 bg-slate-600 rounded-full">
            <div 
              className="absolute h-full bg-slate-300 group-hover:bg-emerald-500 rounded-full transition-colors"
              style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
            />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              data-testid="player-volume"
            />
          </div>
        </div>

        {/* Playlist Button */}
        {onPlaylistClick && (
          <button 
            onClick={onPlaylistClick}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-emerald-500 transition-colors ml-1"
            title="View in Podcasts"
            data-testid="player-playlist"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
            </svg>
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[10px] text-slate-500 w-10 text-right font-medium">{formatTime(currentTime)}</span>
        <div 
          ref={progressRef}
          onClick={handleProgressClick}
          onMouseDown={handleDragStart}
          className="flex-1 h-1 bg-slate-600 rounded-full cursor-pointer group relative"
          data-testid="player-progress"
        >
          <div 
            className="h-full bg-slate-300 group-hover:bg-emerald-500 rounded-full relative transition-colors"
            style={{ width: `${progress}%` }}
          >
            <div 
              className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              style={{ transform: 'translateY(-50%)' }}
            />
          </div>
        </div>
        <span className="text-[10px] text-slate-500 w-10 font-medium">{formatTime(duration)}</span>
      </div>
    </div>
  );
};

export default SpotifyPlayer;
