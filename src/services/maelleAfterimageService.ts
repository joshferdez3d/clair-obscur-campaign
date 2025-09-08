// src/services/maelleAfterimageService.ts
import { doc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from './firebase'; // ✅ Correct path - you have firebase.ts
import { useState, useEffect } from 'react';

export interface MaelleCombatState {
  afterimageStacks: number;
  maxAfterimageStacks: number;
  phantomStrikeAvailable: boolean;
  temporalEchoAvailable?: boolean;
  phaseDashAvailable?: boolean;
}

export class MaelleAfterimageService {
  // Update Afterimage stacks in Firestore
  static async updateAfterimageStacks(
    sessionId: string, 
    newStacks: number, 
    maxStacks: number = 5
  ): Promise<void> {
    try {
      const clampedStacks = Math.max(0, Math.min(maxStacks, newStacks));
      const sessionRef = doc(db, 'battleSessions', sessionId);
      
      await updateDoc(sessionRef, {
        'tokens.token-maelle.afterimageStacks': clampedStacks,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating Afterimage stacks:', error);
      throw error;
    }
  }

  // Handle basic attack hit - gain stacks
  static async onBasicAttackHit(
    sessionId: string, 
    currentStacks: number, 
    wasCritical: boolean = false,
    maxStacks: number = 5
  ): Promise<void> {
    const stacksToAdd = wasCritical ? 2 : 1;
    const newStacks = Math.min(maxStacks, currentStacks + stacksToAdd);
    await this.updateAfterimageStacks(sessionId, newStacks, maxStacks);
  }

  // Handle ability use - consume stacks
  static async onAbilityUse(
    sessionId: string, 
    currentStacks: number, 
    stacksToConsume: number,
    maxStacks: number = 5
  ): Promise<void> {
    const newStacks = Math.max(0, currentStacks - stacksToConsume);
    await this.updateAfterimageStacks(sessionId, newStacks, maxStacks);
  }

  // Handle Phantom Strike usage
  static async usePhantomStrike(
    sessionId: string, 
    enemiesHit: number
  ): Promise<void> {
    try {
      const sessionRef = doc(db, 'battleSessions', sessionId);
      
      // Calculate stacks to regain (1 per 2 enemies hit, rounded up)
      const stacksRegained = Math.ceil(enemiesHit / 2);
      
      await updateDoc(sessionRef, {
        'tokens.token-maelle.afterimageStacks': stacksRegained,
        'tokens.token-maelle.phantomStrikeUsed': true,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error using Phantom Strike:', error);
      throw error;
    }
  }
}

// React hook for Maelle's Afterimage system
export function useMaelleAfterimage(sessionId: string) {
  const [afterimageState, setAfterimageState] = useState<MaelleCombatState>({
    afterimageStacks: 0,
    maxAfterimageStacks: 5,
    phantomStrikeAvailable: true
  });

  useEffect(() => {
    if (!sessionId) return;

    const sessionRef = doc(db, 'battleSessions', sessionId);
    
    const unsubscribe = onSnapshot(sessionRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const maelleToken = data.tokens?.['token-maelle'];
        
        if (maelleToken) {
          setAfterimageState({
            afterimageStacks: maelleToken.afterimageStacks || 0,
            maxAfterimageStacks: maelleToken.maxAfterimageStacks || 5,
            phantomStrikeAvailable: !maelleToken.phantomStrikeUsed
          });
        }
      }
    });

    return () => unsubscribe();
  }, [sessionId]);

  const updateStacks = async (newStacks: number) => {
    await MaelleAfterimageService.updateAfterimageStacks(
      sessionId, 
      newStacks, 
      afterimageState.maxAfterimageStacks
    );
  };

  const onBasicAttackHit = async (wasCritical: boolean = false) => {
    await MaelleAfterimageService.onBasicAttackHit(
      sessionId,
      afterimageState.afterimageStacks,
      wasCritical,
      afterimageState.maxAfterimageStacks
    );
  };

  const onAbilityUse = async (stacksToConsume: number) => {
    await MaelleAfterimageService.onAbilityUse(
      sessionId,
      afterimageState.afterimageStacks,
      stacksToConsume,
      afterimageState.maxAfterimageStacks
    );
  };

  const usePhantomStrike = async (enemiesHit: number) => {
    await MaelleAfterimageService.usePhantomStrike(sessionId, enemiesHit);
  };

  return {
    afterimageState,
    updateStacks,
    onBasicAttackHit,
    onAbilityUse,
    usePhantomStrike,
    canUseAbility: (stacksRequired: number) => 
      afterimageState.afterimageStacks >= stacksRequired,
    canUsePhantomStrike: () => 
      afterimageState.afterimageStacks >= 3 && afterimageState.phantomStrikeAvailable
  };
}