// src/services/MineService.ts
import { FirestoreService } from './firestoreService';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { BattleToken, Position } from '../types';
import { cleanupDefeatedEnemies } from '../utils/enemyHelperUtil';

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
   * Toggle mine visibility (for GM skill check results)
   */
  static async toggleMineDetection(
    sessionId: string,
    mineId: string
  ): Promise<void> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session?.mines) return;

    const updatedMines = session.mines.map((mine: Mine) => {
      if (mine.id === mineId) {
        return {
          ...mine,
          isDetected: !mine.isDetected
        };
      }
      return mine;
    });

    await FirestoreService.updateBattleSession(sessionId, {
      mines: updatedMines,
      updatedAt: new Date()
    });

    console.log(`Mine ${mineId} detection toggled`);
  }

  /**
   * Temporarily reveal all mines (returns original states for restoration)
   */
  static async revealAllMinesTemporarily(
    sessionId: string,
    durationMs: number = 5000
  ): Promise<void> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session?.mines) return;

    // Store original detection states
    const originalStates = session.mines.map((mine: Mine) => ({
      id: mine.id,
      isDetected: mine.isDetected
    }));

    // Reveal all mines
    const revealedMines = session.mines.map((mine: Mine) => ({
      ...mine,
      isDetected: true
    }));

    await FirestoreService.updateBattleSession(sessionId, {
      mines: revealedMines,
      updatedAt: new Date()
    });

    console.log(`All mines revealed for ${durationMs}ms`);

    // Restore original states after duration
    setTimeout(async () => {
      const currentSession = await FirestoreService.getBattleSession(sessionId);
      if (!currentSession?.mines) return;

      const restoredMines = currentSession.mines.map((mine: Mine) => {
        const originalState = originalStates.find(s => s.id === mine.id);
        return {
          ...mine,
          isDetected: originalState ? originalState.isDetected : mine.isDetected
        };
      });

      await FirestoreService.updateBattleSession(sessionId, {
        mines: restoredMines,
        updatedAt: new Date()
      });

      console.log('Mines restored to original detection states');
    }, durationMs);
  }

   /**
   * Get count of adjacent mines (for Minesweeper reveal)
   */
  static getAdjacentMineCount(session: any, position: Position): number {
    if (!session?.mines) return 0;
    
    let count = 0;
    const directions = [
      {x: -1, y: -1}, {x: 0, y: -1}, {x: 1, y: -1},
      {x: -1, y: 0},                 {x: 1, y: 0},
      {x: -1, y: 1},  {x: 0, y: 1},  {x: 1, y: 1}
    ];
    
    directions.forEach(dir => {
      const checkPos = {x: position.x + dir.x, y: position.y + dir.y};
      const mine = session.mines.find((m: Mine) => 
        m.position.x === checkPos.x && 
        m.position.y === checkPos.y && 
        !m.isTriggered
      );
      if (mine) count++;
    });
    
    return count;
  }

    /**
   * Reveal a square (for Minesweeper mode)
   */
  static async revealSquare(
    sessionId: string,
    position: Position
  ): Promise<number> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session) throw new Error('Session not found');

    const posKey = `${position.x}-${position.y}`;
    const mineCount = this.getAdjacentMineCount(session, position);
    
    const revealedSquares = session.revealedSquares || {};
    revealedSquares[posKey] = mineCount;

    await FirestoreService.updateBattleSession(sessionId, {
      revealedSquares,
      updatedAt: new Date()
    });

    console.log(`Square (${position.x}, ${position.y}) revealed: ${mineCount} adjacent mines`);
    return mineCount;
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


    if (session.combatState?.isActive) {
      let currentInitiativeOrder = session.combatState.initiativeOrder || [];
      
      // First, clean up defeated enemies
      currentInitiativeOrder = cleanupDefeatedEnemies(updatedTokens, currentInitiativeOrder);
      
      // Then, add the newly spawned Demineur if it exists
      if (demineurToken) {
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
            type: 'enemy' as const,
            hasActed: false
          }].sort((a, b) => b.initiative - a.initiative);
        }
      }

      updateData['combatState.initiativeOrder'] = currentInitiativeOrder;
      updateData['combatState.turnOrder'] = currentInitiativeOrder.map((e: any) => e.id);
    }

    // Update session
    await FirestoreService.updateBattleSession(sessionId, updateData);
    console.log(`✅ Mine triggered - initiative tracker updated`);
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
      // Defensive checks - ensure token and position exist
      if (!token) {
        console.warn('Undefined token in getTokensInRadius');
        return false;
      }
      
      if (!token.position) {
        console.warn(`Token ${token.id || 'unknown'} has no position`);
        return false;
      }
      
      if (typeof token.position.x !== 'number' || typeof token.position.y !== 'number') {
        console.warn(`Token ${token.id} has invalid position:`, token.position);
        return false;
      }
      
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
      revealedSquares: {},
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