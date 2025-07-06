import React, { useState, useRef, useEffect } from 'react';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  showTimer?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  src, 
  poster, 
  className = '',
  showTimer = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateDuration = () => setDuration(video.duration);
    const updateTime = () => setCurrentTime(video.currentTime);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container || duration === 0) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const targetTime = percentage * duration;

    video.currentTime = targetTime;
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
    const video = videoRef.current;
    if (video) {
      video.muted = true; // Ensure video is muted for preview
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0; // Reset to beginning when not hovering
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div 
      ref={containerRef}
      className={`relative ${className}`}
      onMouseMove={!showTimer ? handleMouseMove : undefined}
      onMouseEnter={!showTimer ? handleMouseEnter : undefined}
      onMouseLeave={!showTimer ? handleMouseLeave : undefined}
    >
      {showTimer ? (
        // Full video player with controls and timer
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          className="w-full h-full object-contain"
          controls
        />
      ) : (
        // Thumbnail preview mode
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          className="w-full h-full object-cover"
          muted
          preload="metadata"
        />
      )}

      {/* Minimalist Progress Bar - Only visible when hovering in thumbnail mode */}
      {!showTimer && isHovering && duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black bg-opacity-30">
          <div
            className="h-full bg-blue-500 transition-all duration-75"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      )}

      {/* Video Time Display - Only in full preview mode */}
      {showTimer && duration > 0 && (
        <div className="absolute bottom-4 right-4 bg-black bg-opacity-75 text-white px-3 py-1 rounded-lg text-sm font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;