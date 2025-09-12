// src/hooks/useBattlePresets.ts
import { useState, useEffect, useCallback } from 'react';
import { FirestoreService } from '../services/firestoreService';
import type { BattleMapPreset, BattleToken, PresetSaveData } from '../types';

export function useBattlePresets(mapId: string) {
  const [presets, setPresets] = useState<BattleMapPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPresets = useCallback(async () => {
    if (!mapId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const mapPresets = await FirestoreService.getBattleMapPresets(mapId);
      setPresets(mapPresets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load presets');
      console.error('Failed to load presets:', err);
    } finally {
      setLoading(false);
    }
  }, [mapId]);

  const savePreset = useCallback(async (
    sessionId: string, 
    presetData: PresetSaveData
  ): Promise<string | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const presetId = await FirestoreService.saveBattleMapPreset(sessionId, presetData);
      await loadPresets(); // Refresh the list
      return presetId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preset');
      console.error('Failed to save preset:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [loadPresets]);

  const loadPreset = useCallback(async (
    sessionId: string, 
    presetId: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      await FirestoreService.loadBattleMapPreset(sessionId, presetId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preset');
      console.error('Failed to load preset:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deletePreset = useCallback(async (presetId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      await FirestoreService.deleteBattleMapPreset(presetId);
      await loadPresets(); // Refresh the list
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete preset');
      console.error('Failed to delete preset:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [loadPresets]);

  // Load presets when mapId changes
  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  return {
    presets,
    loading,
    error,
    loadPresets,
    savePreset,
    loadPreset,
    deletePreset
  };
}