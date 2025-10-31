// src/hooks/usePersistentCombatState.ts - Updated for new character systems

import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, updateDoc, serverTimestamp, onSnapshot, getDoc } from 'firebase/firestore';
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
  
  // Sciel state - UPDATED: New fate card system
  chargedFateCard: 'explosive' | 'switch' | 'vanish' | null;
  
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
  
  // Sciel update functions - UPDATED
  setChargedFateCard: (card: 'explosive' | 'switch' | 'vanish' | null) => Promise<void>;
  
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
      const docSnap = await getDoc(characterRef);
    const currentData = docSnap.data();
    const currentVersoState = currentData?.combatState?.versoState;
     
      await updateDoc(characterRef, {
        combatState: {
          ...combatState,
          ...updates,
          ...(currentVersoState ? { versoState: currentVersoState } : {}),

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

  // UPDATED: New Sciel setter
  const setChargedFateCard = useCallback(async (card: 'explosive' | 'switch' | 'vanish' | null) => {
    updateCombatState({ chargedFateCard: card });
  }, [updateCombatState]);

  const setBonusActionCooldown = useCallback(async (cooldown: number) => {
    updateCombatState({ bonusActionCooldown: Math.max(0, cooldown) });
  }, [updateCombatState]);

  const setHasActedThisTurn = useCallback(async (acted: boolean) => {
    updateCombatState({ hasActedThisTurn: acted });
  }, [updateCombatState]);

  // Maelle setters
  const setAfterimageStacks = useCallback(async (stacks: number) => {
    updateCombatState({ afterimageStacks: Math.max(0, Math.min(5, stacks)) });
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
    const resetState = CombatStateHelpers.resetForNewBattle(combatState); // ✅ CORRECT METHOD NAME
    updateCombatState(resetState);
  }, [combatState, updateCombatState]);

  // Sync with combat round
  const syncWithCombatRound = useCallback(async (round: number, turn: string) => {
    if (combatState.lastCombatRound !== round || combatState.lastCombatTurn !== turn) {
      let updates: Partial<CharacterCombatState> = {
        lastCombatRound: round,
        lastCombatTurn: turn,
      };

      // Reset turn-specific state if it's a new turn
      if (combatState.lastCombatTurn !== turn) {
        updates = {
          ...updates,
          hasActedThisTurn: false,
          bonusActionCooldown: Math.max(0, combatState.bonusActionCooldown - 1),
        };
      }

      updateCombatState(updates);
    }
  }, [combatState, updateCombatState]);

  // Set up real-time listener
  useEffect(() => {
    if (!characterId) {
      setLoading(false);
      return;
    }

    console.log(`🔗 Setting up combat state listener for ${characterId}`);
    
    const characterRef = doc(db, 'characters', characterId);
    
    const unsubscribe = onSnapshot(
      characterRef,
      (docSnapshot) => {
        if (!docSnapshot.exists()) {
          console.warn(`⚠️ Character ${characterId} not found`);
          setError('Character not found');
          setLoading(false);
          return;
        }

        const data = docSnapshot.data();
        const newCombatState: CharacterCombatState = data.combatState
          ? {
              // Start with defaults to ensure all properties exist
              ...CombatStateHelpers.createDefaultCombatState(),
              // Override with saved values
              ...data.combatState,
              lastUpdated: data.combatState.lastUpdated?.toDate() || new Date(),
              lastSyncedAt: data.combatState.lastSyncedAt?.toDate() || new Date()
            }
          : CombatStateHelpers.createDefaultCombatState();

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
    
    // UPDATED: New Sciel state
    chargedFateCard: combatState.chargedFateCard,
    
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
    
    // UPDATED: New Sciel setter
    setChargedFateCard,
    
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