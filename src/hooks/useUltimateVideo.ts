// src/hooks/useUltimateVideo.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { getUltimateVideoService, UltimateVideoEvent } from '../services/ultimateVideoService';

export function useUltimateVideo(sessionId: string) {
  const [currentEvent, setCurrentEvent] = useState<UltimateVideoEvent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const serviceRef = useRef(getUltimateVideoService(sessionId));
  const listenerIdRef = useRef(`listener_${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    const service = serviceRef.current;
    const listenerId = listenerIdRef.current;

    // Subscribe to ultimate video events
    service.subscribe(listenerId, (event) => {
      setCurrentEvent(event);
    });

    return () => {
      // FIXED: Use the renamed method
      service.unsubscribeListener(listenerId);
    };
  }, [sessionId]);

  // Trigger an ultimate video
  const triggerUltimate = useCallback(async (characterName: string, ultimateName: string) => {
    try {
      setIsLoading(true);
      await serviceRef.current.triggerUltimateVideo(characterName, ultimateName);
    } catch (error) {
      console.error('Failed to trigger ultimate:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Clear the current ultimate video
  const clearUltimate = useCallback(async () => {
    try {
      await serviceRef.current.clearUltimateVideo();
    } catch (error) {
      console.error('Failed to clear ultimate:', error);
      throw error;
    }
  }, []);

  // Check if a specific character's ultimate is currently playing
  const isUltimateActive = useCallback((characterName?: string) => {
    if (!currentEvent || !currentEvent.isActive) return false;
    if (!characterName) return true;
    return currentEvent.characterName.toLowerCase() === characterName.toLowerCase();
  }, [currentEvent]);

  return {
    currentEvent,
    isLoading,
    triggerUltimate,
    clearUltimate,
    isUltimateActive,
    // Helper to check if any ultimate is currently playing
    hasActiveUltimate: currentEvent?.isActive || false
  };
}