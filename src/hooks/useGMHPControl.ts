// useGMHPControl.ts - Custom hook for GM HP management with sync

import { useState, useCallback } from 'react';
import { HPSyncService } from '../services/HPSyncService';

interface UseGMHPControlProps {
  sessionId: string;
}

interface HPOperation {
  characterId: string;
  type: 'damage' | 'heal' | 'set';
  amount: number;
  timestamp: Date;
}

export function useGMHPControl({ sessionId }: UseGMHPControlProps) {
  const [isLoading, setIsLoading] = useState<Set<string>>(new Set());
  const [recentOperations, setRecentOperations] = useState<HPOperation[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Track loading state for specific characters
  const setCharacterLoading = useCallback((characterId: string, loading: boolean) => {
    setIsLoading(prev => {
      const newSet = new Set(prev);
      if (loading) {
        newSet.add(characterId);
      } else {
        newSet.delete(characterId);
      }
      return newSet;
    });
  }, []);

  // Add operation to recent history (for undo functionality if needed later)
  const addRecentOperation = useCallback((operation: HPOperation) => {
    setRecentOperations(prev => [operation, ...prev.slice(0, 9)]); // Keep last 10 operations
  }, []);

  // Apply damage to a character
  const applyDamage = useCallback(async (characterId: string, damageAmount: number): Promise<number | null> => {
    if (damageAmount <= 0) {
      setError('Damage amount must be greater than 0');
      return null;
    }

    setCharacterLoading(characterId, true);
    setError(null);

    try {
      const newHP = await HPSyncService.applyDamage(characterId, sessionId, damageAmount);
      
      addRecentOperation({
        characterId,
        type: 'damage',
        amount: damageAmount,
        timestamp: new Date()
      });

      console.log(`💥 Applied ${damageAmount} damage to ${characterId}, new HP: ${newHP}`);
      return newHP;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply damage';
      setError(errorMessage);
      console.error('Error applying damage:', err);
      return null;
    } finally {
      setCharacterLoading(characterId, false);
    }
  }, [sessionId, setCharacterLoading, addRecentOperation]);

  // Apply healing to a character
  const applyHealing = useCallback(async (characterId: string, healAmount: number): Promise<number | null> => {
    if (healAmount <= 0) {
      setError('Heal amount must be greater than 0');
      return null;
    }

    setCharacterLoading(characterId, true);
    setError(null);

    try {
      const newHP = await HPSyncService.applyHealing(characterId, sessionId, healAmount);
      
      addRecentOperation({
        characterId,
        type: 'heal',
        amount: healAmount,
        timestamp: new Date()
      });

      console.log(`💚 Applied ${healAmount} healing to ${characterId}, new HP: ${newHP}`);
      return newHP;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply healing';
      setError(errorMessage);
      console.error('Error applying healing:', err);
      return null;
    } finally {
      setCharacterLoading(characterId, false);
    }
  }, [sessionId, setCharacterLoading, addRecentOperation]);

  // Set HP to a specific value
  const setHP = useCallback(async (characterId: string, targetHP: number): Promise<number | null> => {
    if (targetHP < 0) {
      setError('HP cannot be negative');
      return null;
    }

    setCharacterLoading(characterId, true);
    setError(null);

    try {
      const newHP = await HPSyncService.setHP(characterId, sessionId, targetHP);
      
      addRecentOperation({
        characterId,
        type: 'set',
        amount: targetHP,
        timestamp: new Date()
      });

      console.log(`⚡ Set ${characterId} HP to ${newHP}`);
      return newHP;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set HP';
      setError(errorMessage);
      console.error('Error setting HP:', err);
      return null;
    } finally {
      setCharacterLoading(characterId, false);
    }
  }, [sessionId, setCharacterLoading, addRecentOperation]);

  // Get current HP for a character
  const getCurrentHP = useCallback(async (characterId: string) => {
    try {
      return await HPSyncService.getCurrentHP(characterId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get current HP';
      setError(errorMessage);
      console.error('Error getting current HP:', err);
      return null;
    }
  }, []);

  // Quick action: Full heal
  const fullHeal = useCallback(async (characterId: string, maxHP: number): Promise<number | null> => {
    return await setHP(characterId, maxHP);
  }, [setHP]);

  // Quick action: Half HP
  const halfHP = useCallback(async (characterId: string, maxHP: number): Promise<number | null> => {
    return await setHP(characterId, Math.floor(maxHP / 2));
  }, [setHP]);

  // Quick action: Set to 0 (unconscious)
  const setUnconscious = useCallback(async (characterId: string): Promise<number | null> => {
    return await setHP(characterId, 0);
  }, [setHP]);

  // Batch operations for AoE damage/healing
  const batchApplyDamage = useCallback(async (
    characters: Array<{ characterId: string; damageAmount: number }>
  ): Promise<void> => {
    setError(null);
    
    // Set loading for all characters
    characters.forEach(({ characterId }) => setCharacterLoading(characterId, true));

    try {
    const promises = characters.map(async ({ characterId, damageAmount }) => {
      const currentHP = await HPSyncService.getCurrentHP(characterId);
      return {
        characterId,
        sessionId,
        newHP: Math.max(0, currentHP - damageAmount) // ⬅️ was currentHP.current
      };
    });


      const updates = await Promise.all(promises);
      await HPSyncService.batchUpdateHP(updates);

      // Add to recent operations
      characters.forEach(({ characterId, damageAmount }) => {
        addRecentOperation({
          characterId,
          type: 'damage',
          amount: damageAmount,
          timestamp: new Date()
        });
      });

      console.log(`💥 Applied batch damage to ${characters.length} characters`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply batch damage';
      setError(errorMessage);
      console.error('Error applying batch damage:', err);
    } finally {
      // Clear loading for all characters
      characters.forEach(({ characterId }) => setCharacterLoading(characterId, false));
    }
  }, [sessionId, setCharacterLoading, addRecentOperation]);

  // Emergency sync function
  const syncAllHPs = useCallback(async (): Promise<void> => {
    setError(null);
    
    try {
      await HPSyncService.syncAllCharacterHPsToTokens(sessionId);
      console.log('✅ All HPs synchronized');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync HPs';
      setError(errorMessage);
      console.error('Error syncing HPs:', err);
    }
  }, [sessionId]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // Core HP operations
    applyDamage,
    applyHealing,
    setHP,
    getCurrentHP,
    
    // Quick actions
    fullHeal,
    halfHP,
    setUnconscious,
    
    // Batch operations
    batchApplyDamage,
    
    // Utility
    syncAllHPs,
    clearError,
    
    // State
    isLoading: (characterId: string) => isLoading.has(characterId),
    recentOperations,
    error
  };
}