// src/hooks/useAudio.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { getAudioService } from '../services/AudioService';

export function useAudio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioServiceRef = useRef(getAudioService());

  // Update state based on audio service
  const updateAudioState = useCallback(() => {
    const service = audioServiceRef.current;
    setIsPlaying(service.isPlaying());
    setCurrentTrack(service.getCurrentTrack());
  }, []);

  // Play music
  const playMusic = useCallback(async (musicPath: string, options?: {
    loop?: boolean;
    volume?: number;
    fadeIn?: boolean;
  }) => {
    const { loop = true, volume = 0.5, fadeIn = false } = options || {};
    
    try {
      setIsLoading(true);
      setError(null);
      
      const service = audioServiceRef.current;
      await service.playMusic(musicPath, loop, fadeIn ? 0 : volume);
      
      // Fade in if requested
      if (fadeIn && volume > 0) {
        service.setVolume(0);
        const steps = 20;
        const stepDuration = 100; // 2 seconds total fade in
        const volumeStep = volume / steps;
        
        let currentStep = 0;
        const fadeInterval = setInterval(() => {
          currentStep++;
          service.setVolume(volumeStep * currentStep);
          
          if (currentStep >= steps) {
            clearInterval(fadeInterval);
          }
        }, stepDuration);
      }
      
      updateAudioState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to play music');
      console.error('Failed to play music:', err);
    } finally {
      setIsLoading(false);
    }
  }, [updateAudioState]);

  // Stop music
  const stopMusic = useCallback(async (fadeOut?: boolean, fadeOutDuration?: number) => {
    try {
      const service = audioServiceRef.current;
      
      if (fadeOut) {
        await service.fadeOut(fadeOutDuration);
      } else {
        service.stopMusic();
      }
      
      updateAudioState();
    } catch (err) {
      console.error('Failed to stop music:', err);
    }
  }, [updateAudioState]);

  // Pause music
  const pauseMusic = useCallback(() => {
    audioServiceRef.current.pauseMusic();
    updateAudioState();
  }, [updateAudioState]);

  // Resume music
  const resumeMusic = useCallback(() => {
    audioServiceRef.current.resumeMusic();
    updateAudioState();
  }, [updateAudioState]);

  // Set volume
  const setVolume = useCallback((volume: number) => {
    audioServiceRef.current.setVolume(volume);
  }, []);

  // Play battle music specifically
  const playBattleMusic = useCallback(async () => {
    await playMusic('/music/BattleMusic.mp3', {
      loop: true,
      volume: 0.6,
      fadeIn: true
    });
  }, [playMusic]);

  // Stop battle music specifically
  const stopBattleMusic = useCallback(async () => {
    await stopMusic(true, 2000); // Fade out over 2 seconds
  }, [stopMusic]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't cleanup the service on unmount since it's a singleton
      // The service will be cleaned up when the app unmounts
    };
  }, []);

  return {
    // State
    isPlaying,
    currentTrack,
    isLoading,
    error,
    
    // Controls
    playMusic,
    stopMusic,
    pauseMusic,
    resumeMusic,
    setVolume,
    
    // Convenience methods
    playBattleMusic,
    stopBattleMusic,
    
    // Status
    isBattleMusicPlaying: currentTrack === '/music/BattleMusic.mp3' && isPlaying
  };
}