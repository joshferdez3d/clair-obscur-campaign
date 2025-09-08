import { useState, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { UIState } from '../types';

export function useGameState() {
  const [selectedCharacterId, setSelectedCharacterId] = useLocalStorage<string>('selectedCharacter', '');
  const [selectedSessionId, setSelectedSessionId] = useLocalStorage<string>('selectedSession', 'test-session');
  const [viewMode, setViewMode] = useLocalStorage<'player' | 'gm' | 'display'>('viewMode', 'player');
  
  const [uiState, setUIState] = useState<UIState>({
    isLoading: false,
    viewMode: viewMode,
    isConnected: true
  });

  const updateUIState = (updates: Partial<UIState>) => {
    setUIState(prev => ({ ...prev, ...updates }));
  };

  const setError = (error: string | undefined) => {
    setUIState(prev => ({ ...prev, error }));
  };

  const setLoading = (isLoading: boolean) => {
    setUIState(prev => ({ ...prev, isLoading }));
  };

  // Sync viewMode with localStorage
  useEffect(() => {
    setUIState(prev => ({ ...prev, viewMode }));
  }, [viewMode]);

  return {
    selectedCharacterId,
    setSelectedCharacterId,
    selectedSessionId,
    setSelectedSessionId,
    viewMode,
    setViewMode,
    uiState,
    updateUIState,
    setError,
    setLoading
  };
}