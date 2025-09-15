// src/hooks/usePersistentCombatState.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore'; // Add onSnapshot here
import { db } from '../services/firebase';
import type { CharacterCombatState } from '../types/character';
import { CombatStateHelpers } from '../types/character';

interface PersistentCombatStateHook {
  // Current state
  combatState: CharacterCombatState;
  loading: boolean;
  error: string | null;
  
  // Gustave state
  overchargePoints: number;
  activeTurretId: string | null;
  turretsDeployedThisBattle: number;
  
  // Lune state
  elementalStains: Array<'fire' | 'ice' | 'nature' | 'light'>;
  
  // Sciel state
  foretellStacks: Record<string, number>;
  foretellChainCharged: boolean;
  
  // Universal state
  bonusActionCooldown: number;
  hasActedThisTurn: boolean;
  
  // Update functions
  setOverchargePoints: (points: number) => Promise<void>;
  setActiveTurretId: (id: string | null) => Promise<void>;
  setTurretsDeployedThisBattle: (count: number) => Promise<void>;
  setElementalStains: (stains: Array<'fire' | 'ice' | 'nature' | 'light'>) => Promise<void>;
  setForetellStacks: (stacks: Record<string, number>) => Promise<void>;
  setForetellChainCharged: (charged: boolean) => Promise<void>;
  setBonusActionCooldown: (cooldown: number) => Promise<void>;
  setHasActedThisTurn: (acted: boolean) => Promise<void>;
  
  // Batch update function
  updateMultiple: (updates: Partial<CharacterCombatState>) => Promise<void>;
  
  // Battle management
  resetForNewBattle: () => Promise<void>;
  syncWithCombatRound: (round: number, turn: string) => Promise<void>;
}

export function usePersistentCombatState(
  characterId: string,
  sessionId?: string
): PersistentCombatStateHook {
  const [combatState, setCombatState] = useState<CharacterCombatState>(
    CombatStateHelpers.createDefaultCombatState()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track if we're in the middle of an update to prevent loops
  const updatingRef = useRef(false);
  
  // Debounce timer for batching updates
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<Partial<CharacterCombatState>>({});

  // Initialize and listen to Firebase
  useEffect(() => {
    if (!characterId) {
      setLoading(false);
      return;
    }

    console.log(`🔄 Setting up persistent combat state for ${characterId}`);
    
    const characterRef = doc(db, 'characters', characterId);
    
    const unsubscribe = onSnapshot(
      characterRef,
        async (doc: any) => { // Add type annotation
          if (!doc.exists()) {
            setError(`Character ${characterId} not found`);
            setLoading(false);
            return;
          }

        const data = doc.data();
        
        // Get existing combat state or create default
        let newCombatState = data.combatState 
          ? {
              ...data.combatState,
              lastUpdated: data.combatState.lastUpdated?.toDate() || new Date(),
              lastSyncedAt: data.combatState.lastSyncedAt?.toDate() || new Date()
            }
          : CombatStateHelpers.createDefaultCombatState();

        // Initialize combat state in Firebase if it doesn't exist
        if (!data.combatState) {
          console.log(`📝 Initializing combat state for ${characterId}`);
          await updateDoc(characterRef, {
            combatState: {
              ...newCombatState,
              lastUpdated: serverTimestamp(),
              lastSyncedAt: serverTimestamp()
            }
          });
        }

        // Only update local state if we're not in the middle of our own update
        if (!updatingRef.current) {
          setCombatState(newCombatState);
          console.log(`✅ Combat state loaded for ${characterId}:`, newCombatState);
        }
        
        setLoading(false);
        setError(null);
      },
      (error: any) => { // Add type annotation
        console.error(`❌ Error loading combat state for ${characterId}:`, error);
        setError(error.message);
        setLoading(false);
      }
    );

    return () => {
      console.log(`🔌 Disconnecting combat state listener for ${characterId}`);
      unsubscribe();
      
      // Clear any pending updates
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, [characterId]);

  // Debounced update function to batch rapid changes
  const debouncedUpdate = useCallback(async () => {
    if (!characterId || Object.keys(pendingUpdatesRef.current).length === 0) {
      return;
    }

    const updates = { ...pendingUpdatesRef.current };
    pendingUpdatesRef.current = {};

    try {
      updatingRef.current = true;
      
      const characterRef = doc(db, 'characters', characterId);
      await updateDoc(characterRef, {
        combatState: {
          ...combatState,
          ...updates,
          lastUpdated: serverTimestamp(),
          lastSyncedAt: serverTimestamp()
        }
      });

      console.log(`💾 Saved combat state updates for ${characterId}:`, updates);
      
    } catch (error) {
      console.error(`❌ Failed to save combat state for ${characterId}:`, error);
      setError(error instanceof Error ? error.message : 'Failed to save combat state');
    } finally {
      updatingRef.current = false;
    }
  }, [characterId, combatState]);

  // Generic update function that batches changes
  const updateCombatState = useCallback((updates: Partial<CharacterCombatState>) => {
    // Update local state immediately (optimistic update)
    setCombatState(prev => ({ ...prev, ...updates }));
    
    // Add to pending updates
    pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates };
    
    // Clear existing timer and set new one
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
    }
    
    updateTimerRef.current = setTimeout(debouncedUpdate, 300); // 300ms debounce
  }, [debouncedUpdate]);

  // Individual setter functions
  const setOverchargePoints = useCallback(async (points: number) => {
    updateCombatState({ overchargePoints: Math.max(0, Math.min(3, points)) });
  }, [updateCombatState]);

  const setActiveTurretId = useCallback(async (id: string | null) => {
    updateCombatState({ activeTurretId: id });
  }, [updateCombatState]);

  const setTurretsDeployedThisBattle = useCallback(async (count: number) => {
    updateCombatState({ turretsDeployedThisBattle: Math.max(0, count) });
  }, [updateCombatState]);

  const setElementalStains = useCallback(async (stains: Array<'fire' | 'ice' | 'nature' | 'light'>) => {
    updateCombatState({ elementalStains: [...stains] });
  }, [updateCombatState]);

  const setForetellStacks = useCallback(async (stacks: Record<string, number>) => {
    updateCombatState({ foretellStacks: { ...stacks } });
  }, [updateCombatState]);

  const setForetellChainCharged = useCallback(async (charged: boolean) => {
    updateCombatState({ foretellChainCharged: charged });
  }, [updateCombatState]);

  const setBonusActionCooldown = useCallback(async (cooldown: number) => {
    updateCombatState({ bonusActionCooldown: Math.max(0, cooldown) });
  }, [updateCombatState]);

  const setHasActedThisTurn = useCallback(async (acted: boolean) => {
    updateCombatState({ hasActedThisTurn: acted });
  }, [updateCombatState]);

  // Batch update function
  const updateMultiple = useCallback(async (updates: Partial<CharacterCombatState>) => {
    updateCombatState(updates);
  }, [updateCombatState]);

  // Reset for new battle
  const resetForNewBattle = useCallback(async () => {
    console.log(`🔄 Resetting combat state for new battle: ${characterId}`);
    const resetState = CombatStateHelpers.resetForNewBattle(combatState);
    updateCombatState(resetState);
  }, [characterId, combatState, updateCombatState]);

  // Sync with combat round/turn
  const syncWithCombatRound = useCallback(async (round: number, turn: string) => {
    const shouldReset = CombatStateHelpers.shouldResetCombatState(combatState, round, turn);
    
    if (shouldReset) {
      console.log(`🔄 Auto-resetting combat state - new battle detected`);
      await resetForNewBattle();
    } else {
      updateCombatState({
        lastCombatRound: round,
        lastCombatTurn: turn
      });
    }
  }, [combatState, resetForNewBattle, updateCombatState]);

  return {
    // State
    combatState,
    loading,
    error,
    
    // Individual state values for easy access
    overchargePoints: combatState.overchargePoints,
    activeTurretId: combatState.activeTurretId,
    turretsDeployedThisBattle: combatState.turretsDeployedThisBattle,
    elementalStains: combatState.elementalStains,
    foretellStacks: combatState.foretellStacks,
    foretellChainCharged: combatState.foretellChainCharged,
    bonusActionCooldown: combatState.bonusActionCooldown,
    hasActedThisTurn: combatState.hasActedThisTurn,
    
    // Setters
    setOverchargePoints,
    setActiveTurretId,
    setTurretsDeployedThisBattle,
    setElementalStains,
    setForetellStacks,
    setForetellChainCharged,
    setBonusActionCooldown,
    setHasActedThisTurn,
    
    // Batch operations
    updateMultiple,
    resetForNewBattle,
    syncWithCombatRound
  };
}