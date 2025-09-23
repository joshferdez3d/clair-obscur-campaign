// src/services/NPCCombatService.ts
// Pure TypeScript service for NPC combat mechanics (no JSX)

import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase'; // FIXED: Changed from '../config/firebase'
import type { BattleToken } from '../types';

interface NPCInitiativeEntry {
  id: string;
  name: string;
  type: 'npc';
  initiative: number;
  controlledBy: 'maelle' | 'sciel' | 'gm';
  tokenId: string;
  isActive: boolean;
  hasActed: boolean;
}

export class NPCCombatService {
  /**
   * Roll initiative for an NPC and add them to combat tracker
   */
  static async rollNPCInitiative(
    sessionId: string,
    npc: BattleToken
  ): Promise<number> {
    // Roll d20 for initiative
    const initiativeRoll = Math.floor(Math.random() * 20) + 1;
    
    try {
      const sessionRef = doc(db, 'sessions', sessionId);
      
      // Create initiative entry for NPC
      const initiativeEntry: NPCInitiativeEntry = {
        id: npc.id,
        name: npc.name,
        type: 'npc',
        initiative: initiativeRoll,
        controlledBy: npc.controlledBy || 'gm',
        tokenId: npc.id,
        isActive: true,
        hasActed: false
      };

      // Add to session's initiative tracker
      await updateDoc(sessionRef, {
        [`combatState.initiative.${npc.id}`]: initiativeEntry,
        [`tokens.${npc.id}`]: {
          ...npc,
          initiative: initiativeRoll
        }
      });

      console.log(`🎲 ${npc.name} rolled ${initiativeRoll} for initiative`);
      return initiativeRoll;
      
    } catch (error) {
      console.error('Failed to roll NPC initiative:', error);
      throw error;
    }
  }

  /**
   * Check if it's an NPC's turn
   */
  static isNPCTurn(
    currentTurnToken: BattleToken | null
  ): boolean {
    return currentTurnToken?.type === 'npc';
  }

  /**
   * Get the controller for the current NPC
   */
  static getNPCController(
    npc: BattleToken
  ): 'maelle' | 'sciel' | 'gm' {
    return npc.controlledBy || 'gm';
  }

  /**
   * Check if a player can control the current NPC
   */
  static canPlayerControlNPC(
    playerId: string,
    npc: BattleToken
  ): boolean {
    const controller = this.getNPCController(npc);
    
    // Map player IDs to their NPC control permissions
    const controlMap: { [key: string]: string[] } = {
      'maelle': ['maelle', 'the-child'],
      'sciel': ['sciel', 'farmhand'],
      'gm': ['gm'] // GM can control any NPC
    };

    return controlMap[playerId]?.includes(controller) || false;
  }

  /**
   * End an NPC's turn
   */
  static async endNPCTurn(
    sessionId: string,
    npcId: string
  ): Promise<void> {
    try {
      const sessionRef = doc(db, 'sessions', sessionId);
      
      await updateDoc(sessionRef, {
        [`combatState.initiative.${npcId}.hasActed`]: true,
        'combatState.waitingForAction': false
      });

      console.log(`✅ ${npcId}'s turn ended`);
      
    } catch (error) {
      console.error('Failed to end NPC turn:', error);
      throw error;
    }
  }

  /**
   * Handle NPC movement
   */
  static async moveNPC(
    sessionId: string,
    npcId: string,
    newPosition: { x: number; y: number }
  ): Promise<void> {
    try {
      const sessionRef = doc(db, 'sessions', sessionId);
      
      await updateDoc(sessionRef, {
        [`tokens.${npcId}.position`]: newPosition,
        [`tokens.${npcId}.hasMoved`]: true
      });

      console.log(`🚶 ${npcId} moved to (${newPosition.x}, ${newPosition.y})`);
      
    } catch (error) {
      console.error('Failed to move NPC:', error);
      throw error;
    }
  }

  /**
   * Execute NPC ability
   */
  static async executeNPCAbility(
    sessionId: string,
    npcId: string,
    abilityId: string,
    targetId: string,
    acRoll: number
  ): Promise<void> {
    try {
      const sessionRef = doc(db, 'sessions', sessionId);
      
      // Create combat action for NPC ability
      const action = {
        id: `npc-action-${Date.now()}`,
        npcId,
        abilityId,
        targetId,
        acRoll,
        timestamp: Date.now(),
        type: 'npc_ability'
      };

      await updateDoc(sessionRef, {
        'combatState.lastAction': action,
        [`combatState.initiative.${npcId}.hasActed`]: true
      });

      console.log(`⚔️ ${npcId} used ${abilityId} on ${targetId} with roll ${acRoll}`);
      
    } catch (error) {
      console.error('Failed to execute NPC ability:', error);
      throw error;
    }
  }
}