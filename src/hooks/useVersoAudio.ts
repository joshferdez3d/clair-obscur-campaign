// src/hooks/useVersoAudio.ts
import { useEffect, useRef } from 'react';
import type { MusicalNote } from '../types/versoType';
import { VersoAudioManager } from '../services/VersoAudioManager';

/**
 * Hook to manage Verso's harmonic audio system
 */
export function useVersoAudio(activeNotes: MusicalNote[], isEnabled: boolean = true) {
  const audioManagerRef = useRef<VersoAudioManager | null>(null);

  // Initialize audio manager
  useEffect(() => {
    if (!audioManagerRef.current) {
      audioManagerRef.current = VersoAudioManager.getInstance();
    }

    // Enable/disable audio based on prop
    if (audioManagerRef.current.getIsEnabled() !== isEnabled) {
      audioManagerRef.current.toggleEnabled();
    }

    return () => {
      // Cleanup when component unmounts
      if (audioManagerRef.current) {
        audioManagerRef.current.stopAllNotes();
      }
    };
  }, [isEnabled]);

  // Update playing notes whenever activeNotes changes
  useEffect(() => {
    if (audioManagerRef.current && isEnabled) {
      audioManagerRef.current.updateActiveNotes(activeNotes);
    }
  }, [activeNotes, isEnabled]);

  // Control functions
  const setVolume = (volume: number) => {
    if (audioManagerRef.current) {
      audioManagerRef.current.setVolume(volume);
    }
  };

  const toggleAudio = () => {
    if (audioManagerRef.current) {
      audioManagerRef.current.toggleEnabled();
    }
  };

  const getVolume = (): number => {
    return audioManagerRef.current ? audioManagerRef.current.getVolume() : 0.5;
  };

  const getIsEnabled = (): boolean => {
    return audioManagerRef.current ? audioManagerRef.current.getIsEnabled() : true;
  };

  return {
    setVolume,
    toggleAudio,
    getVolume,
    getIsEnabled,
  };
}