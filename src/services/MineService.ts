// src/services/MineService.ts
import { FirestoreService } from './firestoreService';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { BattleToken, Position } from '../types';

export interface Mine {
  id: string;
  position: Position;
  isDetected: boolean;
  isTriggered: boolean;
  damage: number;
  aoERadius: number; // in feet (5ft = 1 square)
  spawnsEnemy: string; // enemy type ID (e.g., 'demineur')
  detectedBy?: string[]; // Character IDs who detected this mine
}

export class MineService {
  /**
   * Place a mine at a specific position
   */
  static async placeMine(
    sessionId: string,
    position: Position,
    options: {
      damage?: number;
      aoeRadius?: number;
      spawnsEnemy?: string;
    } = {}
  ): Promise<Mine> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session) throw new Error('Session not found');

    const mine: Mine = {
      id: `mine-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      position,
      isDetected: false,
      isTriggered: false,
      damage: options.damage ?? 6,
      aoERadius: options.aoeRadius ?? 5, // 5ft = 1 square radius
      spawnsEnemy: options.spawnsEnemy ?? 'demineur',
      detectedBy: []
    };

    const existingMines = session.mines || [];
    const updatedMines = [...existingMines, mine];

    await FirestoreService.updateBattleSession(sessionId, {
      mines: updatedMines,
      updatedAt: new Date()
    });

    console.log(`Mine placed at (${position.x}, ${position.y})`);
    return mine;
  }

  /**
   * Place multiple mines at once (for map setup)
   */
  static async placeMines(
    sessionId: string,
    positions: Position[],
    options: {
      damage?: number;
      aoeRadius?: number;
      spawnsEnemy?: string;
    } = {}
  ): Promise<Mine[]> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session) throw new Error('Session not found');

    const mines: Mine[] = positions.map(position => ({
      id: `mine-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      position,
      isDetected: false,
      isTriggered: false,
      damage: options.damage ?? 6,
      aoERadius: options.aoeRadius ?? 5,
      spawnsEnemy: options.spawnsEnemy ?? 'demineur',
      detectedBy: []
    }));

    const existingMines = session.mines || [];
    const updatedMines = [...existingMines, ...mines];

    await FirestoreService.updateBattleSession(sessionId, {
      mines: updatedMines,
      updatedAt: new Date()
    });

    console.log(`Placed ${mines.length} mines`);
    return mines;
  }

  /**
   * Check if a position has a mine
   */
  static hasMineAtPosition(session: any, position: Position): Mine | null {
    if (!session?.mines) return null;
    
    return session.mines.find((mine: Mine) => 
      mine.position.x === position.x && 
      mine.position.y === position.y &&
      !mine.isTriggered
    ) || null;
  }

  /**
   * Detect a mine (via skill check)
   */
  static async detectMine(
    sessionId: string,
    mineId: string,
    detectedByCharacterId: string
  ): Promise<void> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session?.mines) return;

    const updatedMines = session.mines.map((mine: Mine) => {
      if (mine.id === mineId) {
        return {
          ...mine,
          isDetected: true,
          detectedBy: [...(mine.detectedBy || []), detectedByCharacterId]
        };
      }
      return mine;
    });

    await FirestoreService.updateBattleSession(sessionId, {
      mines: updatedMines,
      updatedAt: new Date()
    });

    console.log(`Mine ${mineId} detected by ${detectedByCharacterId}`);
  }

  /**
   * Trigger a mine - deals AoE damage and spawns enemy
   */
  static async triggerMine(
    sessionId: string,
    mineId: string,
    triggeredByTokenId: string
  ): Promise<void> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session?.mines) return;

    const mine = session.mines.find((m: Mine) => m.id === mineId);
    if (!mine || mine.isTriggered) return;

    console.log(`MINE TRIGGERED at (${mine.position.x}, ${mine.position.y})!`);

    // Get all tokens within AoE radius
    const affectedTokens = this.getTokensInRadius(
      session.tokens,
      mine.position,
      mine.aoERadius
    );

    // Apply damage to all affected tokens
    const updatedTokens = { ...session.tokens };
    const damagedTokenNames: string[] = [];

    for (const token of affectedTokens) {
      const currentHP = token.hp || 0;
      const newHP = Math.max(0, currentHP - mine.damage);
      
      if (token.type === 'enemy' && newHP <= 0) {
        // Remove dead enemies
        delete updatedTokens[token.id];
        console.log(`${token.name} was killed by mine explosion`);
      } else {
        updatedTokens[token.id] = { ...token, hp: newHP };
        damagedTokenNames.push(`${token.name} (${mine.damage} damage)`);
        
        // Update character HP if it's a player
        if (token.characterId) {
          await FirestoreService.updateCharacterHP(token.characterId, newHP);
        }
      }
    }

    console.log(`Mine damaged: ${damagedTokenNames.join(', ')}`);

    // Spawn Demineur at mine location
    const demineureId = `enemy-${mine.spawnsEnemy}-${Date.now()}`;
    const demineurToken = await this.spawnEnemyAtMine(
      sessionId,
      mine.spawnsEnemy,
      mine.position,
      demineureId
    );

    if (demineurToken) {
      updatedTokens[demineureId] = demineurToken;
    }

    // Mark mine as triggered
    const updatedMines = session.mines.map((m: Mine) => 
      m.id === mineId ? { ...m, isTriggered: true } : m
    );

    // Add spawned enemy to initiative if combat is active
    let updateData: any = {
      tokens: updatedTokens,
      mines: updatedMines,
      updatedAt: new Date()
    };

    if (session.combatState?.isActive && demineurToken) {
      let currentInitiativeOrder = session.combatState.initiativeOrder || [];
      
      // Check if this enemy type already has a group
      const existingGroup = currentInitiativeOrder.find(
        (entry: any) => entry.type === 'enemy' && 
                       entry.name === demineurToken.name
      );
      
      if (!existingGroup) {
        // Create new initiative entry for this enemy type
        const initiativeRoll = Math.floor(Math.random() * 20) + 1;
        
        currentInitiativeOrder = [...currentInitiativeOrder, {
          id: `${mine.spawnsEnemy}-group-${Date.now()}`,
          name: demineurToken.name,
          initiative: initiativeRoll,
          type: 'enemy'as const,
          hasActed: false
        }].sort((a, b) => b.initiative - a.initiative);

        updateData['combatState.initiativeOrder'] = currentInitiativeOrder;
        updateData['combatState.turnOrder'] = currentInitiativeOrder.map((e: any) => e.id);
      }
    }

    // Update session
    await FirestoreService.updateBattleSession(sessionId, updateData);
  }

  /**
   * Get all tokens within radius of a position
   */
  private static getTokensInRadius(
    tokens: { [id: string]: BattleToken },
    center: Position,
    radiusFeet: number
  ): BattleToken[] {
    const radiusSquares = radiusFeet / 5; // Convert feet to grid squares
    
    return Object.values(tokens).filter(token => {
      const distance = Math.max(
        Math.abs(token.position.x - center.x),
        Math.abs(token.position.y - center.y)
      );
      return distance <= radiusSquares;
    });
  }

  /**
   * Spawn an enemy at the mine location
   */
  private static async spawnEnemyAtMine(
    sessionId: string,
    enemyTypeId: string,
    position: Position,
    enemyId: string
  ): Promise<BattleToken | null> {
    // Import enemies data
    const { enemies } = await import('../data/enemies');
    const enemyTemplate = enemies[enemyTypeId];
    
    if (!enemyTemplate) {
      console.error(`Unknown enemy type: ${enemyTypeId}`);
      return null;
    }

    const enemyToken: BattleToken = {
      id: enemyId,
      name: enemyTemplate.name,
      position,
      type: 'enemy',
      hp: enemyTemplate.hp,
      maxHp: enemyTemplate.maxHp,
      ac: enemyTemplate.ac,
      size: enemyTemplate.size || 1,
      color: enemyTemplate.color || '#dc2626'
    };

    console.log(`${enemyTemplate.name} spawned at (${position.x}, ${position.y})`);
    
    return enemyToken;
  }

  /**
   * Remove a mine (e.g., disarmed)
   */
  static async removeMine(sessionId: string, mineId: string): Promise<void> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session?.mines) return;

    const updatedMines = session.mines.filter((m: Mine) => m.id !== mineId);

    await FirestoreService.updateBattleSession(sessionId, {
      mines: updatedMines,
      updatedAt: new Date()
    });

    console.log(`Mine ${mineId} removed`);
  }

  /**
   * Clear all mines from the map
   */
  static async clearAllMines(sessionId: string): Promise<void> {
    await FirestoreService.updateBattleSession(sessionId, {
      mines: [],
      updatedAt: new Date()
    });

    console.log(`All mines cleared`);
  }

  /**
   * Get mines within detection range of a character
   */
  static getMinesInRange(
    session: any,
    characterPosition: Position,
    range: number
  ): Mine[] {
    if (!session?.mines) return [];
    
    const rangeSquares = range / 5;
    
    return session.mines.filter((mine: Mine) => {
      if (mine.isTriggered) return false;
      
      const distance = Math.max(
        Math.abs(mine.position.x - characterPosition.x),
        Math.abs(mine.position.y - characterPosition.y)
      );
      
      return distance <= rangeSquares;
    });
  }
}