// src/components/Combat/UltimateVideoPopup.tsx
import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface UltimateVideoPopupProps {
  isOpen: boolean;
  characterName: string;
  onClose: () => void;
  autoClose?: boolean;
}

// Video file mapping for each character's ultimate
const VIDEO_MAPPING: Record<string, string> = {
  'sciel': '/ults/Ult_DarkWave.mp4',        // Sciel's ultimate
  'lune': '/ults/Ult_ElementalGenesis.mp4', // Lune's ultimate  
  'gustave': '/ults/Ult_Overcharge.mp4',    // Gustave's ultimate
  'maelle': '/ults/Ult_PhantomStrike.mp4',   // Maelle's ultimate
  'the-child': '/ults/Ult_ForMyBrother.mp4'
};

export function UltimateVideoPopup({ 
  isOpen, 
  characterName, 
  onClose, 
  autoClose = true 
}: UltimateVideoPopupProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const videoPath = VIDEO_MAPPING[characterName.toLowerCase()];

  useEffect(() => {
    if (!isOpen || !videoRef.current) return;

    const video = videoRef.current;
    
    const handleLoadedData = () => {
      setIsLoaded(true);
      setHasError(false);
      // Auto-play when loaded
      video.play().catch((error) => {
        console.error('Failed to auto-play video:', error);
        setHasError(true);
      });
    };

    const handleEnded = () => {
      if (autoClose) {
        // Small delay before closing for dramatic effect
        setTimeout(() => {
          onClose();
        }, 500);
      }
    };

    const handleError = () => {
      console.error('Video failed to load:', videoPath);
      setHasError(true);
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    // Reset states when opening
    setIsLoaded(false);
    setHasError(false);

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, [isOpen, videoPath, autoClose, onClose]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, onClose]);

  if (!isOpen || !videoPath) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-90 transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Video Container */}
      <div className="relative z-10 w-full h-full max-w-6xl max-h-screen p-4 flex items-center justify-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-20 bg-black bg-opacity-60 hover:bg-opacity-80 text-white rounded-full p-2 transition-all duration-200 hover:scale-110"
          aria-label="Close video"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Loading State */}
        {!isLoaded && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mb-4"></div>
              <p className="text-white font-bold text-xl">
                {characterName.toUpperCase()} ULTIMATE
              </p>
              <p className="text-yellow-400 text-sm">Loading...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-10">
            <div className="text-center text-white">
              <div className="text-6xl mb-4">⚠️</div>
              <p className="text-xl font-bold mb-2">Video Failed to Load</p>
              <p className="text-gray-400 mb-4">Could not load: {videoPath}</p>
              <button
                onClick={onClose}
                className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Video Element */}
        <video
          ref={videoRef}
          className="w-full h-full object-contain rounded-lg shadow-2xl"
          controls={false} // Remove controls for cinematic experience
          playsInline
          preload="auto"
          style={{
            maxWidth: '100%',
            maxHeight: '100%'
          }}
        >
          <source src={videoPath} type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {/* Character Name Overlay */}
        {isLoaded && !hasError && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
            <div className="bg-black bg-opacity-70 px-6 py-3 rounded-lg border-2 border-yellow-400">
              <p className="text-yellow-400 font-bold text-2xl tracking-wider uppercase">
                {characterName} Ultimate
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}