// src/hooks/useEnemyAI.ts
import { useEffect, useCallback, useRef } from 'react';
import { EnemyAIService } from '../services/EnemyAIService';
import { FirestoreService } from '../services/firestoreService';
import type { BattleSession, BattleToken, InitiativeEntry } from '../types';

interface UseEnemyAIProps {
  session: BattleSession | null;
  sessionId: string;
  isGM: boolean;
  aiEnabled?: boolean;
}

export function useEnemyAI({
  session,
  sessionId,
  isGM,
  aiEnabled = true
}: UseEnemyAIProps) {
  const processedEnemies = useRef<Set<string>>(new Set());
  const isProcessingTurn = useRef(false);

  /**
   * Auto-add enemies to initiative when they appear
   */
  const autoAddEnemyInitiative = useCallback(async () => {
    if (!session || !isGM || !aiEnabled) return;
    
    const enemies = Object.values(session.tokens || {}).filter(
      token => token.type === 'enemy'
    );
    
    // Group enemies by type
    const enemyGroups = new Map<string, BattleToken[]>();
    
    for (const enemy of enemies) {
      const baseType = EnemyAIService.getEnemyBaseType(enemy.name);
      
      // Skip if already processed
      if (processedEnemies.current.has(baseType)) continue;
      
      if (!enemyGroups.has(baseType)) {
        enemyGroups.set(baseType, []);
      }
      enemyGroups.get(baseType)!.push(enemy);
    }
    
    // Create initiative entries for new groups
    const newEntries: InitiativeEntry[] = [];
    
    // Convert Map to array for iteration
    const groupsArray = Array.from(enemyGroups.entries());
    for (const [baseType, tokens] of groupsArray) {
      if (!processedEnemies.current.has(baseType)) {
        const entry = EnemyAIService.createEnemyInitiativeEntry(tokens, baseType);
        newEntries.push(entry);
        processedEnemies.current.add(baseType);
        
        console.log(`🎲 Auto-added ${baseType} to initiative with roll: ${entry.initiative}`);
      }
    }
    
    // Add to existing initiative order
    if (newEntries.length > 0 && session.combatState) {
      const currentOrder = session.combatState.initiativeOrder || [];
      const updatedOrder = [...currentOrder, ...newEntries].sort(
        (a, b) => b.initiative - a.initiative
      );
      
      await FirestoreService.setInitiativeOrder(sessionId, updatedOrder);
    }
  }, [session, sessionId, isGM, aiEnabled]);

  // ... rest of the component remains the same
  
  /**
   * Handle enemy turns automatically
   */
  const handleEnemyTurn = useCallback(async () => {
    if (!session?.combatState?.isActive || !isGM || !aiEnabled) return;
    if (isProcessingTurn.current) return;
    
    const currentTurn = session.combatState.currentTurn;
    
    // Check if it's an enemy's turn
    if (currentTurn.startsWith('enemy-group-') || 
        session.tokens?.[currentTurn]?.type === 'enemy') {
      
      isProcessingTurn.current = true;
      
      console.log(`🤖 AI taking turn for: ${currentTurn}`);
      
      try {
        await EnemyAIService.executeEnemyTurn(
          sessionId,
          currentTurn,
          session
        );
      } catch (error) {
        console.error('AI turn error:', error);
        // Always advance turn on error
        await FirestoreService.nextTurn(sessionId);
      } finally {
        isProcessingTurn.current = false;
      }
    }
  }, [session, sessionId, isGM, aiEnabled]);

  // Watch for new enemies
  useEffect(() => {
    if (session && isGM) {
      autoAddEnemyInitiative();
    }
  }, [session?.tokens, autoAddEnemyInitiative, session, isGM]);

  // Watch for enemy turns
  useEffect(() => {
    if (session?.combatState?.isActive) {
      handleEnemyTurn();
    }
  }, [session?.combatState?.currentTurn, handleEnemyTurn, session?.combatState?.isActive]);

  // Reset when combat ends
  useEffect(() => {
    if (!session?.combatState?.isActive) {
      processedEnemies.current.clear();
      isProcessingTurn.current = false;
    }
  }, [session?.combatState?.isActive]);

  return {
    autoAddEnemyInitiative,
    handleEnemyTurn,
    processedEnemies: Array.from(processedEnemies.current)
  };
}