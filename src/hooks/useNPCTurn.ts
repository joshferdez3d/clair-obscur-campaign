// src/hooks/useNPCTurn.ts
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

interface UseNPCTurnProps {
  sessionId: string;
  characterId: string; // The player character (maelle/sciel)
  npcId?: string; // The NPC type they control (the-child/farmhand)
}

export function useNPCTurn({ sessionId, characterId, npcId }: UseNPCTurnProps) {
  const [isNPCTurn, setIsNPCTurn] = useState(false);
  const [shouldAutoSwitch, setShouldAutoSwitch] = useState(true);
  const [currentTurnName, setCurrentTurnName] = useState<string>('');

  useEffect(() => {
    if (!sessionId || !npcId) return;

    const unsubscribe = onSnapshot(
      doc(db, 'battleSessions', sessionId),
      (snapshot) => {
        const data = snapshot.data();
        const combatState = data?.combatState;
        
        if (!combatState || !combatState.isActive) {
          setIsNPCTurn(false);
          return;
        }

        // Get current turn info
        const currentTurnId = combatState.currentTurn;
        const turnOrder = combatState.initiativeOrder || [];
        const tokens = data?.tokens || {};
        
        // Find the current turn entry
        const currentTurnEntry = turnOrder.find((entry: any) => entry.id === currentTurnId);
        
        if (!currentTurnEntry) {
          setIsNPCTurn(false);
          return;
        }
        
        // Check if the current turn is an NPC token
        const currentToken = tokens[currentTurnId];
        
        if (!currentToken || currentToken.type !== 'npc') {
          setIsNPCTurn(false);
          return;
        }
        
        // Check if this NPC is controlled by the current character
        // Method 1: Check controlledBy field
        if (currentToken.controlledBy === characterId) {
          console.log(`🎯 It's ${currentToken.name}'s turn! Controlled by ${characterId}`);
          setIsNPCTurn(true);
          setCurrentTurnName(currentToken.name);
          
          if (shouldAutoSwitch) {
            console.log(`🔄 Auto-switching to ${currentToken.name}'s tab`);
          }
          return;
        }
        
        // Method 2: Check by NPC name pattern (fallback)
        const npcNameToController: { [key: string]: { controller: string, npcType: string } } = {
          'The Child': { controller: 'maelle', npcType: 'the-child' },
          'Farmhand': { controller: 'sciel', npcType: 'farmhand' },
          'The Farmhand': { controller: 'sciel', npcType: 'farmhand' },
        };
        
        const npcInfo = npcNameToController[currentToken.name];
        
        if (npcInfo && npcInfo.controller === characterId && npcInfo.npcType === npcId) {
          console.log(`🎯 It's ${currentToken.name}'s turn! Controlled by ${characterId} (detected by name)`);
          setIsNPCTurn(true);
          setCurrentTurnName(currentToken.name);
          
          if (shouldAutoSwitch) {
            console.log(`🔄 Auto-switching to ${currentToken.name}'s tab`);
          }
        } else {
          setIsNPCTurn(false);
        }
      },
      (error) => {
        console.error('Error in useNPCTurn:', error);
        setIsNPCTurn(false);
      }
    );

    return () => unsubscribe();
  }, [sessionId, npcId, characterId, shouldAutoSwitch]);

  return {
    isNPCTurn,
    shouldAutoSwitch,
    setShouldAutoSwitch,
    currentTurnName
  };
}