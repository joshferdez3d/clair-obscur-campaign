// src/hooks/usePersistentCombatState.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
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
  
  // Maelle state
  afterimageStacks: number;
  phantomStrikeAvailable: boolean;
  
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
  
  // Maelle update functions
  setAfterimageStacks: (stacks: number) => Promise<void>;
  setPhantomStrikeAvailable: (available: boolean) => Promise<void>;
  
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
  
  const updatingRef = useRef(false);
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<Partial<CharacterCombatState>>({});

  // Define debounced update function
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
    setCombatState(prev => ({ ...prev, ...updates }));
    pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates };
    
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
    }
    
    updateTimerRef.current = setTimeout(debouncedUpdate, 300);
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

  // Maelle setter functions
  const setAfterimageStacks = useCallback(async (stacks: number) => {
    updateCombatState({ afterimageStacks: Math.max(0, Math.min(3, stacks)) });
  }, [updateCombatState]);

  const setPhantomStrikeAvailable = useCallback(async (available: boolean) => {
    updateCombatState({ phantomStrikeAvailable: available });
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
    console.log(`🔄 Syncing ${characterId} with round ${round}, turn ${turn}`);
    
    if (CombatStateHelpers.shouldResetCombatState(combatState, round, turn)) {
      console.log(`🔄 Resetting combat state for new battle: ${characterId}`);
      await resetForNewBattle();
      return;
    }
    
    const updates: Partial<CharacterCombatState> = {
      lastCombatRound: round,
      lastCombatTurn: turn
    };
    
    if (turn !== combatState.lastCombatTurn) {
      updates.hasActedThisTurn = false;
      
      if (combatState.bonusActionCooldown > 0) {
        updates.bonusActionCooldown = Math.max(0, combatState.bonusActionCooldown - 1);
      }
    }
    
    updateCombatState(updates);
  }, [characterId, combatState, resetForNewBattle, updateCombatState]);

  // Firebase listener setup - CRITICAL MISSING PIECE
  useEffect(() => {
    if (!characterId) {
      setLoading(false);
      return;
    }

    console.log(`🔄 Setting up persistent combat state for ${characterId}`);
    
    const characterRef = doc(db, 'characters', characterId);
    
    const unsubscribe = onSnapshot(
      characterRef,
      async (doc) => {
        if (!doc.exists()) {
          setError(`Character ${characterId} not found`);
          setLoading(false);
          return;
        }

        const data = doc.data();
        
        // Get existing combat state or create default with ALL required properties
        let newCombatState: CharacterCombatState;
        
        if (data?.combatState) {
          newCombatState = {
            ...CombatStateHelpers.createDefaultCombatState(), // Start with defaults
            ...data.combatState, // Override with saved values
            lastUpdated: data.combatState.lastUpdated?.toDate() || new Date(),
            lastSyncedAt: data.combatState.lastSyncedAt?.toDate() || new Date()
          };
        } else {
          newCombatState = CombatStateHelpers.createDefaultCombatState();
        }

        // Initialize combat state in Firebase if it doesn't exist
        if (!data?.combatState) {
          console.log(`📝 Initializing combat state for ${characterId}`);
          await updateDoc(characterRef, {
            combatState: {
              ...newCombatState,
              lastUpdated: serverTimestamp(),
              lastSyncedAt: serverTimestamp()
            }
          });
        }

        if (!updatingRef.current) {
          setCombatState(newCombatState);
          console.log(`✅ Combat state loaded for ${characterId}:`, newCombatState);
        }
        
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error(`❌ Error loading combat state for ${characterId}:`, error);
        setError(error.message);
        setLoading(false);
      }
    );

    return () => {
      console.log(`🔌 Disconnecting combat state listener for ${characterId}`);
      unsubscribe();
      
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, [characterId]);

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
    
    // Maelle state values
    afterimageStacks: combatState.afterimageStacks,
    phantomStrikeAvailable: combatState.phantomStrikeAvailable,
    
    // Setters
    setOverchargePoints,
    setActiveTurretId,
    setTurretsDeployedThisBattle,
    setElementalStains,
    setForetellStacks,
    setForetellChainCharged,
    setBonusActionCooldown,
    setHasActedThisTurn,
    
    // Maelle setters
    setAfterimageStacks,
    setPhantomStrikeAvailable,
    
    // Batch operations
    updateMultiple,
    resetForNewBattle,
    syncWithCombatRound
  };
}