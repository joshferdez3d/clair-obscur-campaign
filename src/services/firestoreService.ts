// src/services/firestoreService.ts - COMPLETE VERSION WITH NPC MANAGEMENT

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  deleteField  // Add this import

} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Character,
  CharacterDoc,
  BattleSession,
  BattleSessionDoc,
  BattleToken,
  Position,
  CombatAction,
  InitiativeEntry,
  GMCombatAction // Import from types file
} from '../types';

export class FirestoreService {
  // ========== ENHANCED RESET METHOD WITH SAMPLE DATA INITIALIZATION ==========
  static async resetBattleSession(sessionId: string) {
    console.log('🔄 Starting battle session reset with sample data initialization...');
    
    try {
      const session = await this.getBattleSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      console.log('🗑️ Clearing battle session...');

      // 1. Clear the session completely first
      const ref = doc(db, 'battleSessions', sessionId);
      await updateDoc(ref, {
        tokens: {},
        combatState: {
          isActive: false,
          currentTurn: '',
          turnOrder: [],
          round: 1,
          phase: 'setup',
          initiativeOrder: [],
        },
        pendingActions: [],
        enemyData: {},
        stormState: {
          isActive: false,
          currentTurn: 0,
          totalTurns: 0,
          pendingRolls: [],
        },
        updatedAt: serverTimestamp(),
      });

      console.log('📊 Reinitializing sample data...');

      // 2. Reinitialize sample data to recreate characters and proper battle session
      await this.initializeSampleData();

      console.log('✅ Battle session reset complete with sample data');
      console.log('- Cleared all tokens, combat state, and pending actions');
      console.log('- Recreated character documents with full stats');
      console.log('- Restored proper initiative order with characterIds');
      console.log('- Reset player HP to maximum values');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to reset battle session:', error);
      throw error;
    }
  }

  // ========== Characters ==========
  static async getCharacter(characterId: string): Promise<Character | null> {
    try {
      const ref = doc(db, 'characters', characterId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      const data = snap.data() as CharacterDoc;
      return { id: snap.id, ...data };
    } catch (e) {
      console.error('getCharacter error:', e);
      return null;
    }
  }

  static async updateCharacterHP(characterId: string, newHP: number) {
    const ref = doc(db, 'characters', characterId);
    await updateDoc(ref, {
      currentHP: Math.max(0, newHP),
      updatedAt: serverTimestamp()
    });
  }

  static async updateCharacterStance(characterId: string, stance: string) {
    const ref = doc(db, 'characters', characterId);
    await updateDoc(ref, { stance, updatedAt: serverTimestamp() });
  }

  static async updateCharacterCharges(characterId: string, charges: number) {
    const ref = doc(db, 'characters', characterId);
    await updateDoc(ref, {
      charges: Math.max(0, Math.min(charges, 5)),
      updatedAt: serverTimestamp()
    });
  }

  static async updateBattleSession(sessionId: string, updates: any): Promise<void> {
    const sessionRef = doc(db, 'battleSessions', sessionId);
    await updateDoc(sessionRef, updates);
  }

  static async updateCharacter(characterId: string, updates: any): Promise<void> {
    const characterRef = doc(db, 'characters', characterId);
    await updateDoc(characterRef, updates);
  }

  // Enhanced updateTokenHP that removes dead enemies (replace existing method)
  static async updateTokenHP(sessionId: string, tokenId: string, newHP: number) {
    const session = await this.getBattleSession(sessionId);
    if (!session?.tokens[tokenId]) return;

    const currentHP = Math.max(0, newHP);
    
    if (currentHP <= 0) {
      // Enemy is dead - remove the token entirely
      const updatedTokens = { ...session.tokens };
      delete updatedTokens[tokenId];
      
      const ref = doc(db, 'battleSessions', sessionId);
      await updateDoc(ref, { 
        tokens: updatedTokens,
        updatedAt: serverTimestamp() 
      });
      
      console.log(`Token ${tokenId} died and was removed`);
    } else {
      // Token survives - just update HP
      const ref = doc(db, 'battleSessions', sessionId);
      await updateDoc(ref, {
        [`tokens.${tokenId}.hp`]: currentHP,
        updatedAt: serverTimestamp()
      });
    }
  }

  // ========== ENHANCED TOKEN MANAGEMENT FOR EXPEDITION NPCS ==========
  
  /**
   * Enhanced addToken method with better error handling and validation
   */
  static async addToken(sessionId: string, token: BattleToken): Promise<void> {
    try {
      const ref = doc(db, 'battleSessions', sessionId);
      
      // Validate token data
      if (!token.id || !token.name || !token.position || !token.type) {
        throw new Error('Invalid token data: missing required fields');
      }

      // Ensure token has required properties for its type
      const tokenToAdd = {
        ...token,
        hp: token.hp ?? (token.type === 'npc' ? 20 : token.hp),
        maxHp: token.maxHp ?? (token.type === 'npc' ? 20 : token.maxHp),
        ac: token.ac ?? 13,
        size: token.size ?? 1,
        color: token.color ?? this.getDefaultColorForType(token.type)
      };

      await updateDoc(ref, { 
        [`tokens.${token.id}`]: tokenToAdd, 
        updatedAt: serverTimestamp() 
      });

      console.log(`✅ ${token.type.toUpperCase()} token added:`, token.name);
    } catch (error) {
      console.error('❌ Failed to add token:', error);
      throw error;
    }
  }

  /**
   * Enhanced removeToken method with type-aware logging
   */
  static async removeToken(sessionId: string, tokenId: string): Promise<void> {
    try {
      const session = await this.getBattleSession(sessionId);
      if (!session?.tokens[tokenId]) {
        console.warn(`Token ${tokenId} not found in session ${sessionId}`);
        return;
      }

      const tokenToRemove = session.tokens[tokenId];
      const updated = { ...session.tokens };
      delete updated[tokenId];
      
      const ref = doc(db, 'battleSessions', sessionId);
      await updateDoc(ref, { 
        tokens: updated, 
        updatedAt: serverTimestamp() 
      });

      console.log(`✅ ${tokenToRemove.type?.toUpperCase()} removed:`, tokenToRemove.name);
    } catch (error) {
      console.error('❌ Failed to remove token:', error);
      throw error;
    }
  }

  /**
   * Get tokens by type (useful for GM management)
   */
  static async getTokensByType(sessionId: string, tokenType: 'player' | 'enemy' | 'npc'): Promise<BattleToken[]> {
    try {
      const session = await this.getBattleSession(sessionId);
      if (!session?.tokens) return [];

      return Object.values(session.tokens).filter(token => token.type === tokenType);
    } catch (error) {
      console.error('❌ Failed to get tokens by type:', error);
      return [];
    }
  }

  /**
   * Bulk remove tokens by type (useful for clearing enemies/NPCs)
   */
  static async removeTokensByType(sessionId: string, tokenType: 'enemy' | 'npc'): Promise<void> {
    try {
      const session = await this.getBattleSession(sessionId);
      if (!session?.tokens) return;

      const tokensToKeep = Object.entries(session.tokens)
        .filter(([_, token]) => token.type !== tokenType)
        .reduce((acc, [id, token]) => ({ ...acc, [id]: token }), {});

      const ref = doc(db, 'battleSessions', sessionId);
      await updateDoc(ref, { 
        tokens: tokensToKeep, 
        updatedAt: serverTimestamp() 
      });

      console.log(`✅ All ${tokenType} tokens removed from session`);
    } catch (error) {
      console.error(`❌ Failed to remove ${tokenType} tokens:`, error);
      throw error;
    }
  }

  /**
   * Update token properties (HP, position, etc.)
   */
  static async updateTokenProperty(sessionId: string, tokenId: string, property: string, value: any): Promise<void> {
    try {
      const ref = doc(db, 'battleSessions', sessionId);
      await updateDoc(ref, {
        [`tokens.${tokenId}.${property}`]: value,
        updatedAt: serverTimestamp()
      });

      console.log(`✅ Token ${tokenId} ${property} updated to:`, value);
    } catch (error) {
      console.error(`❌ Failed to update token ${property}:`, error);
      throw error;
    }
  }

  /**
   * Get default color for token type
   */
  private static getDefaultColorForType(tokenType: 'player' | 'enemy' | 'npc'): string {
    switch (tokenType) {
      case 'player':
        return '#4f46e5'; // Blue
      case 'enemy':
        return '#dc2626'; // Red
      case 'npc':
        return '#16a34a'; // Green
      default:
        return '#6b7280'; // Gray
    }
  }

  /**
   * Validate token placement on the map
   */
  static validateTokenPlacement(
    position: Position, 
    mapWidth: number = 20, 
    mapHeight: number = 15, 
    existingTokens: BattleToken[] = []
  ): { valid: boolean; reason?: string } {
    // Check bounds
    if (position.x < 0 || position.x >= mapWidth || position.y < 0 || position.y >= mapHeight) {
      return { valid: false, reason: 'Position is outside map bounds' };
    }

    // Check for overlapping tokens (optional - remove if you allow stacking)
    const hasOverlap = existingTokens.some(token => 
      token.position.x === position.x && token.position.y === position.y
    );
    
    if (hasOverlap) {
      return { valid: false, reason: 'Another token is already at this position' };
    }

    return { valid: true };
  }

  // ========== GM Actions ==========
  // Single-target attack -> push into pendingActions
  static async createAttackAction(
    sessionId: string,
    playerId: string,
    targetId: string,
    sourcePosition: Position,
    acRoll: number,
    abilityName: string = 'Basic Attack'
  ): Promise<GMCombatAction> {
    const session = await this.getBattleSession(sessionId);
    if (!session) throw new Error('Session not found');

    const playerToken = Object.values(session.tokens).find(t => t.characterId === playerId);
    const targetToken = session.tokens[targetId];
    if (!playerToken || !targetToken) throw new Error('Player or target not found');

    const targetAC = targetToken.ac ?? 13;
    const hit = acRoll >= targetAC;

    const action: GMCombatAction = {
      id: `action-${Date.now()}`,
      type: 'attack',
      playerId,
      targetId,
      sourcePosition,
      acRoll,
      range: 5,
      timestamp: new Date(),
      resolved: false,
      hit,
      playerName: playerToken.name,
      targetName: targetToken.name,
      abilityName,
      needsDamageInput: hit,
      damageApplied: false
    };

    const ref = doc(db, 'battleSessions', sessionId);
    await updateDoc(ref, {
      pendingActions: arrayUnion(action),
      updatedAt: serverTimestamp()
    });

    return action;
  }

  // AoE action -> one GM action with many targets
  static async createAoEAction(
    sessionId: string,
    payload: {
      playerId: string;
      abilityName?: string;
      targetIds: string[];
      targetNames?: string[];
      center?: { x: number; y: number };
      radius?: number;
      acRoll?: number; // optional label for UI
    }
  ): Promise<GMCombatAction> {
    const session = await this.getBattleSession(sessionId);
    if (!session) throw new Error('Session not found');
    if (!payload.playerId) throw new Error('Player not found');
    if (!payload.targetIds?.length) throw new Error('No targets in range');

    const playerToken = Object.values(session.tokens).find(t => t.characterId === payload.playerId);

    const action: GMCombatAction = {
      id: `action-${Date.now()}`,
      type: 'ability',
      playerId: payload.playerId,
      sourcePosition: payload.center ?? playerToken?.position ?? { x: 0, y: 0 },
      acRoll: payload.acRoll ?? 999, // label only
      range: payload.radius ?? 30,
      timestamp: new Date(),
      resolved: false,
      // IMPORTANT: mark as hit & needsDamageInput so popup shows HIT without AC
      hit: true,
      needsDamageInput: true,
      damageApplied: false,
      playerName: playerToken?.name,
      abilityName: payload.abilityName ?? 'Overcharge Burst',
      targetIds: payload.targetIds,
      targetNames: payload.targetNames
    };

    const ref = doc(db, 'battleSessions', sessionId);
    await updateDoc(ref, {
      pendingActions: arrayUnion(action),
      updatedAt: serverTimestamp()
    });

    return action;
  }

  // Apply one damage number to all targets in an AoE action
  static async applyAoEDamage(sessionId: string, actionId: string, damage: number): Promise<void> {
    const session = await this.getBattleSession(sessionId);
    if (!session || !session.pendingActions) return;

    const action = session.pendingActions.find(a => a.id === actionId) as GMCombatAction | undefined;
    if (!action || !action.targetIds?.length || action.resolved) {
      console.log('Action already resolved or not found');
      return;
    }

    const updatedTokens = { ...session.tokens };
    const deadEnemyIds: string[] = []; // Track which enemies died

    for (const tid of action.targetIds) {
      const tok = updatedTokens[tid];
      if (!tok) continue;
      
      const currentHP = Number(tok.hp) || 0;
      const damageAmount = Number(damage) || 0;
      const newHP = Math.max(0, currentHP - damageAmount);
      
      console.log(`Applying ${damageAmount} damage to ${tok.name}: ${currentHP} -> ${newHP}`);
      
      if (newHP <= 0) {
        // Enemy is dead - mark for removal
        deadEnemyIds.push(tid);
        console.log(`${tok.name} died and will be removed`);
      } else {
        // Enemy survives - update HP
        updatedTokens[tid] = { ...tok, hp: newHP };
      }
    }

    // Remove dead enemies from the tokens object
    deadEnemyIds.forEach(id => {
      delete updatedTokens[id];
    });

    const updatedActions = session.pendingActions.map(a =>
      a.id === actionId ? { ...a, resolved: true, damageApplied: true, damage } : a
    );

    const ref = doc(db, 'battleSessions', sessionId);
    await updateDoc(ref, {
      tokens: updatedTokens,
      pendingActions: updatedActions,
      updatedAt: serverTimestamp()
    });

    console.log(`AoE damage applied. ${deadEnemyIds.length} enemies removed.`);
  }

  // Single-target damage resolution (from GM popup)
  static async applyDamageToEnemy(sessionId: string, actionId: string, damageAmount: number) {
    const session = await this.getBattleSession(sessionId);
    if (!session || !session.pendingActions) return;

    const action = session.pendingActions.find(a => a.id === actionId) as GMCombatAction | undefined;
    if (!action || !action.targetId) return;

    const targetToken = session.tokens[action.targetId];
    if (!targetToken) return;

    const currentHP = Number(targetToken.hp) || 0;
    const newHP = Math.max(0, currentHP - damageAmount);
    
    console.log(`Applying ${damageAmount} damage to ${targetToken.name}: ${currentHP} -> ${newHP}`);

    const updatedActions = session.pendingActions.map(a =>
      a.id === actionId ? { ...a, resolved: true, damage: damageAmount, damageApplied: true } : a
    );

    const ref = doc(db, 'battleSessions', sessionId);
    
    if (newHP <= 0) {
      // Enemy is dead - remove the token entirely
      const updatedTokens = { ...session.tokens };
      delete updatedTokens[action.targetId];
      
      await updateDoc(ref, { 
        tokens: updatedTokens,
        pendingActions: updatedActions, 
        updatedAt: serverTimestamp() 
      });
      
      console.log(`${targetToken.name} died and was removed`);
    } else {
      // Enemy survives - just update HP
      await updateDoc(ref, {
        [`tokens.${action.targetId}.hp`]: newHP,
        pendingActions: updatedActions,
        updatedAt: serverTimestamp()
      });
    }
  }

  // ========== NEW: Ultimate Actions for Elemental Genesis ==========
  static async createUltimateAction(
    sessionId: string,
    payload: {
      playerId: string;
      ultimateType: string;
      element: 'fire' | 'ice' | 'nature' | 'light';
      effectName: string;
      description: string;
      needsGMInteraction: boolean; // Fire and Ice need GM clicks
      wallType?: 'row' | 'column'; // ADD THIS LINE
      allPlayerTokens?: Array<{
        id: string;
        name: string;
        currentHP: number;
        maxHP: number;
        position: { x: number; y: number };
      }>;
    }
  ): Promise<GMCombatAction> {
    const session = await this.getBattleSession(sessionId);
    if (!session) throw new Error('Session not found');
    if (!payload.playerId) throw new Error('Player not found');

    const playerToken = Object.values(session.tokens).find(t => t.characterId === payload.playerId);
    if (!playerToken) throw new Error('Player token not found');

    const action: GMCombatAction = {
      id: `ultimate-${Date.now()}`,
      type: 'ability',
      playerId: payload.playerId,
      sourcePosition: playerToken.position,
      acRoll: 999, // Ultimates don't need AC
      range: 0, // Ultimate range varies by element
      timestamp: new Date(),
      resolved: false,
      hit: true, // Ultimates always "hit"
      needsDamageInput: false, // Most ultimates don't need damage input
      damageApplied: false,
      playerName: playerToken.name,
      abilityName: `${payload.effectName} (${payload.element.charAt(0).toUpperCase() + payload.element.slice(1)})`,
      
      // Ultimate-specific data
      ultimateType: payload.ultimateType,
      element: payload.element,
      effectName: payload.effectName,
      description: payload.description,
      needsGMInteraction: payload.needsGMInteraction,

      ...(payload.element === 'ice' && payload.wallType && {
        wallType: payload.wallType
      }),
      
      // For Nature element - healing data
      ...(payload.element === 'nature' && {
        healingTargets: payload.allPlayerTokens
      }),
      
      // For Light element - random square data  
      ...(payload.element === 'light' && {
        affectedSquares: this.generateRandomSquares(20) // Generate 20 random squares
      })
    };

    const ref = doc(db, 'battleSessions', sessionId);
    await updateDoc(ref, {
      pendingActions: arrayUnion(action),
      updatedAt: serverTimestamp()
    });

  if (!payload.needsGMInteraction) {
    
    if (payload.element === 'nature') {
      console.log('🌿 Processing nature healing...');
      // Apply healing immediately
      await this.applyNatureHealing(sessionId, payload.allPlayerTokens || []);
    }
    
    if (payload.element === 'light') {
      
      try {
        const lightSquares = this.generateRandomSquares(20);
        console.log('⚡ Generated light squares:', lightSquares);
        
        const lightBlindEffect = {
          id: `light-${Date.now()}`,
          affectedSquares: lightSquares,
          duration: 3,
          turnsRemaining: 3,
          createdBy: payload.playerId,
          createdAt: Date.now(),
          createdOnRound: session.combatState?.round || 1
        };
                
        // Update session with light blind effects
        await updateDoc(ref, {
          lightBlindEffects: arrayUnion(lightBlindEffect),
          updatedAt: serverTimestamp()
        });
        
        
        // 🔧 DEBUG: Verify the update worked
        setTimeout(async () => {
          const verifySession = await this.getBattleSession(sessionId);
          console.log('🔧 DEBUG: Verification - Light effects in session:', verifySession?.lightBlindEffects);
        }, 1000);
        
      } catch (error) {
        console.error('❌ LIGHT ULTIMATE: Failed to create light effects:', error);
        throw error; // Re-throw to see the full error
      }
    }
  } else {
    console.log('🔧 DEBUG: Element needs GM interaction, skipping immediate effects');
  }

    return action;
  }

  
  // Apply Nature healing to all player tokens
  static async applyNatureHealing(
    sessionId: string, 
    playerTokens: Array<{
      id: string;
      name: string;
      currentHP: number;
      maxHP: number;
      position: { x: number; y: number };
    }>
  ): Promise<void> {
    const session = await this.getBattleSession(sessionId);
    if (!session) return;

    const updatedTokens = { ...session.tokens };
    
    // Heal all player tokens by 50% of current HP
    for (const playerData of playerTokens) {
      const token = updatedTokens[playerData.id];
      if (token && token.type === 'player') {
        const healAmount = Math.floor(playerData.currentHP * 0.5);
        const newHP = Math.min(playerData.maxHP, playerData.currentHP + healAmount);
        
        // Update token HP
        updatedTokens[playerData.id] = {
          ...token,
          hp: newHP
        };
        
        // Also update character document
        if (token.characterId) {
          await this.updateCharacterHP(token.characterId, newHP);
        }
        
        console.log(`Nature Genesis: Healed ${playerData.name} for ${healAmount} (${playerData.currentHP} -> ${newHP})`);
      }
    }

    // Update session with new token HP values
    const ref = doc(db, 'battleSessions', sessionId);
    await updateDoc(ref, {
      tokens: updatedTokens,
      updatedAt: serverTimestamp()
    });
  }

  private static generateRandomSquares(count: number): Array<{ x: number; y: number }> {
    const squares: Array<{ x: number; y: number }> = [];
    const gridWidth = 20;  // Grid is 20 wide
    const gridHeight = 15; // Grid is 15 tall (not 20!)
    
    console.log(`🎯 Generating ${count} random squares on ${gridWidth}x${gridHeight} grid`);
    
    for (let i = 0; i < count; i++) {
      const square = {
        x: Math.floor(Math.random() * gridWidth),
        y: Math.floor(Math.random() * gridHeight)
      };
      squares.push(square);
      console.log(`  Square ${i + 1}: (${square.x}, ${square.y})`);
    }
    
    return squares;
  }

  // In src/services/firestoreService.ts, update createFireTerrain:
  static async createFireTerrain(
    sessionId: string,
    actionId: string,
    centerPosition: { x: number; y: number }
  ): Promise<void> {
    const session = await this.getBattleSession(sessionId);
    if (!session) return;

    const action = session.pendingActions?.find(a => a.id === actionId);
    if (!action) return;

    // Calculate affected squares in 15ft radius (3 squares) - UPDATED RADIUS
    const affectedSquares: Array<{ x: number; y: number }> = [];
    const radius = 3; // 15ft = 3 squares
    
    for (let x = centerPosition.x - radius; x <= centerPosition.x + radius; x++) {
      for (let y = centerPosition.y - radius; y <= centerPosition.y + radius; y++) {
        const distance = Math.sqrt(Math.pow(x - centerPosition.x, 2) + Math.pow(y - centerPosition.y, 2));
        if (distance <= radius) {
          affectedSquares.push({ x, y });
        }
      }
    }

    // Mark action as resolved and store terrain data
    const updatedActions = session.pendingActions?.map(a =>
      a.id === actionId 
        ? { 
            ...a, 
            resolved: true, 
            damageApplied: true,
            terrainCenter: centerPosition,
            affectedSquares 
          }
        : a
    );

    const ref = doc(db, 'battleSessions', sessionId);
    await updateDoc(ref, {
      pendingActions: updatedActions,
      // Store active fire terrain WITH DURATION TRACKING
      fireTerrainZones: arrayUnion({
        id: `fire_terrain_${Date.now()}`,
        center: centerPosition,
        radius: 15, // Updated to 15ft
        affectedSquares,
        damagePerTurn: 5,
        duration: 3, // 3 rounds
        turnsRemaining: 3,
        createdBy: action.playerId,
        createdAt: Date.now(),
        createdOnRound: session.combatState?.round || 1
      }),
      updatedAt: serverTimestamp()
    });
  }

  // Update createIceWall similarly:
  static async createIceWall(
    sessionId: string,
    actionId: string,
    wallData: {
      type: 'row' | 'column';
      index: number;
      squares: Array<{ x: number; y: number }>;
    }
  ): Promise<void> {
    const session = await this.getBattleSession(sessionId);
    if (!session) return;

    const action = session.pendingActions?.find(a => a.id === actionId);
    if (!action) return;

    // Mark action as resolved and store wall data
    const updatedActions = session.pendingActions?.map(a =>
      a.id === actionId 
        ? { 
            ...a, 
            resolved: true, 
            damageApplied: true,
            wallType: wallData.type,
            wallIndex: wallData.index,
            wallSquares: wallData.squares
          }
        : a
    );

    const ref = doc(db, 'battleSessions', sessionId);
    await updateDoc(ref, {
      pendingActions: updatedActions,
      // Store active ice walls WITH DURATION TRACKING
      iceWalls: arrayUnion({
        id: `ice_wall_${Date.now()}`,
        type: wallData.type,
        index: wallData.index,
        squares: wallData.squares,
        duration: 3, // 3 rounds
        turnsRemaining: 3,
        createdBy: action.playerId,
        createdAt: Date.now(),
        createdOnRound: session.combatState?.round || 1
      }),
      updatedAt: serverTimestamp()
    });
  }

  // In src/services/firestoreService.ts, replace the applyLightBlindEffects function with:
  static async createLightHighlights(
    sessionId: string,
    actionId: string
  ): Promise<void> {
    const session = await this.getBattleSession(sessionId);
    if (!session) return;

    const action = session.pendingActions?.find(a => a.id === actionId);
    if (!action) return;

    // Generate 20 random squares
    const affectedSquares = this.generateRandomSquares(20);

    // Mark action as resolved
    const updatedActions = session.pendingActions?.map(a =>
      a.id === actionId 
        ? { 
            ...a, 
            resolved: true, 
            damageApplied: true,
            affectedSquares
          }
        : a
    );

    const ref = doc(db, 'battleSessions', sessionId);
    await updateDoc(ref, {
      pendingActions: updatedActions,
      // Store active light highlights with turn tracking
      lightBlindEffects: arrayUnion({
        id: `light_highlight_${Date.now()}`,
        affectedSquares,
        duration: 3, // 3 rounds
        turnsRemaining: 3,
        createdBy: action.playerId,
        createdAt: Date.now(),
        createdOnRound: session.combatState?.round || 1
      }),
      updatedAt: serverTimestamp()
    });

    console.log(`Light Genesis: Highlighted ${affectedSquares.length} random squares for 3 rounds`);
  }

  static async cleanupExpiredTerrain(sessionId: string): Promise<void> {
    const session = await this.getBattleSession(sessionId);
    if (!session) return;

    const currentRound = session.combatState?.round || 1;
    let needsUpdate = false;
    const updates: any = {};

    console.log(`🔍 Checking terrain cleanup at round ${currentRound}`);

    // Clean up fire terrain
    if (session.fireTerrainZones) {
      const beforeCount = session.fireTerrainZones.length;
      const activeFire = session.fireTerrainZones.filter((zone: any) => {
        const roundsElapsed = currentRound - (zone.createdOnRound || 1);
        const shouldKeep = roundsElapsed < 3;
        console.log(`🔥 Fire terrain ${zone.id}: created round ${zone.createdOnRound}, elapsed ${roundsElapsed}, keep: ${shouldKeep}`);
        return shouldKeep;
      });
      if (activeFire.length !== beforeCount) {
        updates.fireTerrainZones = activeFire;
        needsUpdate = true;
        console.log(`🔥 Removed ${beforeCount - activeFire.length} expired fire terrain zones`);
      }
    }

    // Clean up ice walls
    if (session.iceWalls) {
      const beforeCount = session.iceWalls.length;
      const activeIce = session.iceWalls.filter((wall: any) => {
        const roundsElapsed = currentRound - (wall.createdOnRound || 1);
        const shouldKeep = roundsElapsed < 3;
        console.log(`🧊 Ice wall ${wall.id}: created round ${wall.createdOnRound}, elapsed ${roundsElapsed}, keep: ${shouldKeep}`);
        return shouldKeep;
      });
      if (activeIce.length !== beforeCount) {
        updates.iceWalls = activeIce;
        needsUpdate = true;
        console.log(`🧊 Removed ${beforeCount - activeIce.length} expired ice walls`);
      }
    }

    // Clean up light effects
    if (session.lightBlindEffects) {
      const beforeCount = session.lightBlindEffects.length;
      const activeLight = session.lightBlindEffects.filter((effect: any) => {
        const roundsElapsed = currentRound - (effect.createdOnRound || 1);
        const shouldKeep = roundsElapsed < 3;
        console.log(`⚡ Light effect ${effect.id}: created round ${effect.createdOnRound}, elapsed ${roundsElapsed}, keep: ${shouldKeep}`);
        return shouldKeep;
      });
      if (activeLight.length !== beforeCount) {
        updates.lightBlindEffects = activeLight;
        needsUpdate = true;
        console.log(`⚡ Removed ${beforeCount - activeLight.length} expired light effects`);
      }
    }

    if (needsUpdate) {
      const ref = doc(db, 'battleSessions', sessionId);
      await updateDoc(ref, {
        ...updates,
        updatedAt: serverTimestamp()
      });
      console.log('🧹 Successfully cleaned up expired terrain effects');
    } else {
      console.log('✅ No terrain effects needed cleanup');
    }
  }

  // Also add this helper function to manually verify terrain effects status:
  static logTerrainEffectsStatus(session: any): void {
    const currentRound = session?.combatState?.round || 1;
    
    console.log(`\n📊 TERRAIN STATUS REPORT - Round ${currentRound}`);
    console.log('='.repeat(50));
    
    if (session?.fireTerrainZones?.length > 0) {
      console.log('🔥 FIRE TERRAIN:');
      session.fireTerrainZones.forEach((zone: any, index: number) => {
        const elapsed = currentRound - (zone.createdOnRound || 1);
        const remaining = Math.max(0, 3 - elapsed);
        console.log(`  ${index + 1}. ${zone.id} - Created: Round ${zone.createdOnRound}, Remaining: ${remaining} rounds`);
      });
    } else {
      console.log('🔥 FIRE TERRAIN: None active');
    }
    
    if (session?.iceWalls?.length > 0) {
      console.log('🧊 ICE WALLS:');
      session.iceWalls.forEach((wall: any, index: number) => {
        const elapsed = currentRound - (wall.createdOnRound || 1);
        const remaining = Math.max(0, 3 - elapsed);
        console.log(`  ${index + 1}. ${wall.id} - Created: Round ${wall.createdOnRound}, Remaining: ${remaining} rounds`);
      });
    } else {
      console.log('🧊 ICE WALLS: None active');
    }
    
    if (session?.lightBlindEffects?.length > 0) {
      console.log('⚡ LIGHT EFFECTS:');
      session.lightBlindEffects.forEach((effect: any, index: number) => {
        const elapsed = currentRound - (effect.createdOnRound || 1);
        const remaining = Math.max(0, 3 - elapsed);
        console.log(`  ${index + 1}. ${effect.id} - Created: Round ${effect.createdOnRound}, Remaining: ${remaining} rounds`);
      });
    } else {
      console.log('⚡ LIGHT EFFECTS: None active');
    }
    
    console.log('='.repeat(50));
  }

  static async createTurretPlacementAction(
    sessionId: string,
    payload: {
      playerId: string;
      playerPosition: { x: number; y: number };
      turretName: string;
    }
  ): Promise<GMCombatAction> {
    const session = await this.getBattleSession(sessionId);
    if (!session) throw new Error('Session not found');
    
    const playerToken = Object.values(session.tokens).find(t => t.characterId === payload.playerId);
    if (!playerToken) throw new Error('Player token not found');

    const action: GMCombatAction = {
      id: `turret-placement-${Date.now()}`,
      type: 'turret_placement',
      playerId: payload.playerId,
      sourcePosition: payload.playerPosition,
      acRoll: 0, // Not used for placement
      range: 5, // 5ft placement radius
      timestamp: new Date(),
      resolved: false,
      hit: true, // Always succeeds
      needsDamageInput: false,
      damageApplied: false,
      playerName: playerToken.name,
      abilityName: `Deploy ${payload.turretName}`,
      targetIds: [], // No specific targets
      targetNames: [],
      // Custom data for turret placement
      turretData: {
        name: payload.turretName,
        hp: 10,
        maxHp: 10,
        type: 'npc',
        color: '#8B4513',
        size: 1
      }
    };

    const ref = doc(db, 'battleSessions', sessionId);
    await updateDoc(ref, {
      pendingActions: arrayUnion(action),
      updatedAt: serverTimestamp()
    });

    return action;
  }
  // Clean up expired protection effects
  static async cleanupExpiredProtectionEffects(sessionId: string): Promise<void> {
    const session = await this.getBattleSession(sessionId);
    if (!session) return;

    const currentRound = session.combatState?.round || 1;
    let needsUpdate = false;
    const updates: any = {};

    if (session.activeProtectionEffects) {
      const beforeCount = session.activeProtectionEffects.length;
      const activeProtections = session.activeProtectionEffects.filter((effect: any) => {
        const roundsElapsed = currentRound - (effect.activatedOnRound || 1);
        const shouldKeep = roundsElapsed < 2;
        return shouldKeep;
      });
      
      if (activeProtections.length !== beforeCount) {
        updates.activeProtectionEffects = activeProtections;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      const ref = doc(db, 'battleSessions', sessionId);
      await updateDoc(ref, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    }
  }
  // Create Leader's Sacrifice protection action
  static async createLeadersSacrificePAction(
    sessionId: string,
    payload: {
      playerId: string;
      playerName: string;
      currentRound: number;
    }
  ): Promise<GMCombatAction> {
    const session = await this.getBattleSession(sessionId);
    if (!session) throw new Error('Session not found');
    
    const playerToken = Object.values(session.tokens).find(t => t.characterId === payload.playerId);
    if (!playerToken) throw new Error('Player token not found');

    const action: GMCombatAction = {
      id: `leaders-sacrifice-${Date.now()}`,
      type: 'ability',
      playerId: payload.playerId,
      sourcePosition: playerToken.position,
      acRoll: 0,
      range: 0,
      timestamp: new Date(),
      resolved: false,
      hit: true,
      needsDamageInput: false,
      damageApplied: false,
      playerName: payload.playerName,
      abilityName: "Leader's Sacrifice",
      targetIds: [],
      targetNames: [],
      protectionData: {
        protectorName: payload.playerName,
        activatedOnRound: payload.currentRound,
        duration: 2,
        remainingRounds: 2,
        protectedAlly: 'TBD - GM to assign manually',
        description: 'Gustave redirects damage from protected ally to himself for 2 rounds'
      }
    };

    const ref = doc(db, 'battleSessions', sessionId);
    await updateDoc(ref, {
      pendingActions: arrayUnion(action),
      activeProtectionEffects: arrayUnion({
        id: action.id,
        protectorId: payload.playerId,
        protectorName: payload.playerName,
        activatedOnRound: payload.currentRound,
        remainingRounds: 2,
        protectedAlly: 'TBD - Call out to GM',
        type: 'leaders_sacrifice'
      }),
      updatedAt: serverTimestamp()
    });

    return action;
  }

  // src/services/firestoreService.ts

  // Add these methods to the FirestoreService class

  static async updateTargetingState(
    sessionId: string,
    targetingState: { selectedEnemyId: string; playerId: string }
  ): Promise<void> {
    const sessionRef = doc(db, 'battleSessions', sessionId);  // Changed from 'sessions' to 'battleSessions'
    await updateDoc(sessionRef, {
      targetingState,
      updatedAt: serverTimestamp()
    });
  }

  static subscribeToTargetingState(
    sessionId: string,
    callback: (targetingState: any) => void
  ): () => void {
    const sessionRef = doc(db, 'battleSessions', sessionId);  // Changed from 'sessions' to 'battleSessions'
    
    const unsubscribe = onSnapshot(sessionRef, (snapshot) => {
      const data = snapshot.data();
      callback(data?.targetingState || null);
    });
    
    return unsubscribe;
  }

  static async clearTargetingState(sessionId: string): Promise<void> {
    const sessionRef = doc(db, 'battleSessions', sessionId);  // Changed from 'sessions' to 'battleSessions'
    await updateDoc(sessionRef, {
      targetingState: deleteField(),
      updatedAt: serverTimestamp()
    });
  }

  // Create self destruct action - destroys turret and damages nearby enemies
  static async createSelfDestructAction(
    sessionId: string,
    payload: {
      playerId: string;
      turretId: string;
      turretPosition: { x: number; y: number };
    }
  ): Promise<void> {
    const session = await this.getBattleSession(sessionId);
    if (!session) throw new Error('Session not found');
    
    const turret = session.tokens[payload.turretId];
    if (!turret) throw new Error('Turret not found');
    
    // Find enemies within 10ft of turret
    const enemies = Object.values(session.tokens).filter(token => 
      token.type === 'enemy' && 
      (token.hp || 0) > 0
    );
    
    const calculateDistance = (pos1: { x: number; y: number }, pos2: { x: number; y: number }): number => {
      const dx = Math.abs(pos1.x - pos2.x);
      const dy = Math.abs(pos1.y - pos2.y);
      return Math.max(dx, dy) * 5;
    };
    
    const enemiesInRange = enemies.filter(enemy => 
      calculateDistance(payload.turretPosition, enemy.position) <= 10
    );
    
    const playerToken = Object.values(session.tokens).find(t => t.characterId === payload.playerId);
    
    // Remove the turret immediately
    const updatedTokens = { ...session.tokens };
    delete updatedTokens[payload.turretId];
    
    // If there are enemies in range, create AoE damage action
    if (enemiesInRange.length > 0) {
      const action: GMCombatAction = {
        id: `self-destruct-${Date.now()}`,
        type: 'ability',
        playerId: payload.playerId,
        sourcePosition: payload.turretPosition,
        acRoll: 999, // Auto-hit
        range: 10,
        timestamp: new Date(),
        resolved: false,
        hit: true,
        needsDamageInput: true,
        damageApplied: false,
        playerName: playerToken?.name || 'Gustave',
        abilityName: 'Turret Self Destruct (2d6 fire)',
        targetIds: enemiesInRange.map(e => e.id),
        targetNames: enemiesInRange.map(e => e.name)
      };
      
      const ref = doc(db, 'battleSessions', sessionId);
      await updateDoc(ref, {
        tokens: updatedTokens,
        pendingActions: arrayUnion(action),
        updatedAt: serverTimestamp()
      });
    } else {
      // No enemies in range, just remove turret
      const ref = doc(db, 'battleSessions', sessionId);
      await updateDoc(ref, {
        tokens: updatedTokens,
        updatedAt: serverTimestamp()
      });
    }
  }


  static async dismissMissAction(sessionId: string, actionId: string) {
    const session = await this.getBattleSession(sessionId);
    if (!session || !session.pendingActions) return;

    const updatedActions = session.pendingActions.map(a =>
      a.id === actionId ? { ...a, resolved: true } : a
    );

    const ref = doc(db, 'battleSessions', sessionId);
    await updateDoc(ref, { pendingActions: updatedActions, updatedAt: serverTimestamp() });
  }

  // Legacy support (used by useCombat)
  static async addCombatAction(sessionId: string, action: CombatAction) {
    const ref = doc(db, 'battleSessions', sessionId);
    await updateDoc(ref, {
      pendingActions: arrayUnion(action),
      updatedAt: serverTimestamp()
    });
  }

  static async resolveCombatAction(sessionId: string, actionId: string) {
    const session = await this.getBattleSession(sessionId);
    if (!session || !session.pendingActions) return;

    const updatedActions = session.pendingActions.map(a =>
      a.id === actionId ? { ...a, resolved: true } : a
    );

    const ref = doc(db, 'battleSessions', sessionId);
    await updateDoc(ref, { pendingActions: updatedActions, updatedAt: serverTimestamp() });
  }

  static async updateEnemyHP(sessionId: string, enemyId: string, currentHP: number) {
    const ref = doc(db, 'battleSessions', sessionId);
    await updateDoc(ref, {
      [`enemyHP.${enemyId}.current`]: Math.max(0, currentHP),
      updatedAt: serverTimestamp()
    });
    if (currentHP <= 0) await this.removeToken(sessionId, enemyId);
  }

  static async updateTokenPosition(sessionId: string, tokenId: string, position: Position) {
    const ref = doc(db, 'battleSessions', sessionId);
    await updateDoc(ref, { [`tokens.${tokenId}.position`]: position, updatedAt: serverTimestamp() });
  }

  // ========== Combat state ==========
  static async startCombat(sessionId: string, initiativeOrder: InitiativeEntry[]) {
    const ref = doc(db, 'battleSessions', sessionId);
    await updateDoc(ref, {
      'combatState.isActive': true,
      'combatState.phase': 'combat',
      'combatState.round': 1,
      'combatState.currentTurn': initiativeOrder[0]?.id ?? '',
      'combatState.turnOrder': initiativeOrder.map(e => e.id),
      'combatState.initiativeOrder': initiativeOrder,
      updatedAt: serverTimestamp()
    });
  }

  static async nextTurn(sessionId: string) {
    const session = await this.getBattleSession(sessionId);
    if (!session?.combatState) return;

    const { turnOrder, currentTurn, round } = session.combatState;
    const cur = turnOrder.indexOf(currentTurn);
    const nextIndex = cur + 1 >= turnOrder.length ? 0 : cur + 1;
    const nextRound = cur + 1 >= turnOrder.length ? round + 1 : round;
    const nextTurn = turnOrder[nextIndex];

    const ref = doc(db, 'battleSessions', sessionId);
    await updateDoc(ref, {
      'combatState.currentTurn': nextTurn,
      'combatState.round': nextRound,
      ...(nextIndex === 0 && {
        'combatState.initiativeOrder': session.combatState.initiativeOrder.map(e => ({
          ...e,
          hasActed: false
        }))
      }),
      updatedAt: serverTimestamp()
    });

    // 🔧 FIX: Clean up expired terrain effects after turn advancement
    await this.cleanupExpiredTerrain(sessionId);
    await this.cleanupExpiredProtectionEffects(sessionId); // ADD THIS LINE

    console.log('🔄 Turn advanced and terrain effects cleaned up');
  }
  static async setInitiativeOrder(sessionId: string, initiativeOrder: InitiativeEntry[]) {
    const ref = doc(db, 'battleSessions', sessionId);
    await updateDoc(ref, {
      'combatState.initiativeOrder': initiativeOrder,
      'combatState.turnOrder': initiativeOrder.map(e => e.id),
      'combatState.currentTurn': initiativeOrder[0]?.id ?? '',
      updatedAt: serverTimestamp()
    });
  }

  // ========== Movement ==========
  static calculateMovementDistance(from: Position, to: Position): number {
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    const diagonals = Math.min(dx, dy);
    const straight = Math.max(dx, dy) - diagonals;
    return diagonals * 5 + straight * 5;
  }

  static async validateAndMoveToken(
    sessionId: string,
    tokenId: string,
    newPosition: Position,
    characterId?: string
  ): Promise<boolean> {
    const session = await this.getBattleSession(sessionId);
    if (!session) return false;

    const token = session.tokens[tokenId];
    if (!token) return false;

    const distance = this.calculateMovementDistance(token.position, newPosition);

    let maxMovement = 30;
    if (characterId) {
      const c = await this.getCharacter(characterId);
      if (c && c.name.toLowerCase() === 'maelle' && c.stance === 'agile') maxMovement = 60;
    }

    if (distance > maxMovement) {
      console.log(`Move ${distance}ft exceeds ${maxMovement}ft`);
      return false;
    }

    await this.updateTokenPosition(sessionId, tokenId, newPosition);
    return true;
  }

  // ========== Ranging / Targeting ==========
  static calculateRange(from: Position, to: Position): number {
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    return Math.max(dx, dy) * 5;
  }

  static getValidTargets(
    sourcePosition: Position,
    tokens: BattleToken[],
    range: number,
    targetType: 'enemy' | 'ally' | 'any' = 'any'
  ): string[] {
    return tokens
      .filter(t => {
        const dist = this.calculateRange(sourcePosition, t.position);
        const within = dist <= range;
        let ok = true;
        if (targetType === 'enemy') ok = t.type === 'enemy';
        else if (targetType === 'ally') ok = t.type === 'player';
        return within && ok;
      })
      .map(t => t.id);
  }

  // ========== Sessions ==========
  static async getBattleSession(sessionId: string): Promise<BattleSession | null> {
    try {
      const ref = doc(db, 'battleSessions', sessionId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      const data = snap.data() as BattleSessionDoc;
      return {
        id: snap.id,
        ...data,
        createdAt: data.createdAt?.toDate() ?? new Date(),
        updatedAt: data.updatedAt?.toDate() ?? new Date()
      };
    } catch (e) {
      console.error('getBattleSession error:', e);
      return null;
    }
  }

  // Reset Lune's ultimate on combat end (instead of long rest)
  static async resetLuneUltimate(sessionId: string): Promise<void> {
    try {
      const ref = doc(db, 'battleSessions', sessionId);
      await updateDoc(ref, {
        'luneElementalGenesisUsed': false, // Reset ultimate cooldown
        updatedAt: serverTimestamp()
      });
      console.log('Lune ultimate cooldown reset');
    } catch (error) {
      console.error('Failed to reset Lune ultimate:', error);
      throw error;
    }
  }

  // Also update the existing endCombat method to include Lune reset:
  static async endCombat(sessionId: string) {
    const ref = doc(db, 'battleSessions', sessionId);
    await updateDoc(ref, {
      'combatState.isActive': false,
      'combatState.phase': 'ended',
      'combatState.currentTurn': '',
      pendingActions: [],
      'tokens.token-maelle.phantomStrikeUsed': false,
      'luneElementalGenesisUsed': false, // Reset Lune's ultimate on combat end
      updatedAt: serverTimestamp()
    });
  }


  static subscribeToBattleSession(
    sessionId: string,
    cb: (session: BattleSession | null) => void
  ) {
    const ref = doc(db, 'battleSessions', sessionId);
    return onSnapshot(
      ref,
      snap => {
        if (!snap.exists()) return cb(null);
        const data = snap.data() as BattleSessionDoc;
        cb({
          id: snap.id,
          ...data,
          createdAt: data.createdAt?.toDate() ?? new Date(),
          updatedAt: data.updatedAt?.toDate() ?? new Date()
        });
      },
      err => {
        console.error('Battle session listener error:', err);
        cb(null);
      }
    );
  }

  static subscribeToCharacter(
    characterId: string,
    cb: (character: Character | null) => void
  ) {
    const ref = doc(db, 'characters', characterId);
    return onSnapshot(
      ref,
      snap => {
        if (!snap.exists()) return cb(null);
        const data = snap.data() as CharacterDoc;
        cb({ id: snap.id, ...data });
      },
      err => {
        console.error('Character listener error:', err);
        cb(null);
      }
    );
  }

  // ========== Sample Data ==========
  static async initializeSampleData() {
    const characters = [
      {
        id: 'maelle',
        name: 'Maelle',
        role: 'Stance Fencer',
        stats: { str: 12, dex: 16, con: 13, int: 10, wis: 11, cha: 14 },
        currentHP: 25,
        maxHP: 25,
        stance: 'stanceless' as const,
        charges: 0,
        maxCharges: 5,
        level: 1,
        abilities: [
          {
            id: 'fencers_slash',
            name: "Fencer's Slash",
            description: 'Precise rapier strike. Changes stance after attack.',
            type: 'action' as const,
            damage: '1d8 + DEX slashing'
          },
          {
            id: 'flourish_chain',
            name: 'Flourish Chain',
            description: 'Two rapid strikes. If both hit, +1d6 radiant damage.',
            type: 'action' as const,
            damage: '2 attacks, +1d6 radiant if both hit'
          }
        ],
        portraitUrl: '/tokens/maelle.png',
        backgroundColor: '#3B82F6' // NEW: Royal blue (was '#6B46C1' purple)
      },
      {
        id: 'gustave',
        name: 'Gustave',
        role: 'Engineer',
        stats: { str: 16, dex: 12, con: 15, int: 14, wis: 11, cha: 10 },
        currentHP: 30,
        maxHP: 30,
        charges: 0,
        maxCharges: 5,
        level: 1,
        abilities: [
          { id: 'sword_slash', name: 'Sword Slash', description: 'Melee attack', type: 'action' as const, damage: '1d8 + STR' },
          { id: 'pistol_shot', name: 'Pistol Shot', description: 'Ranged attack', type: 'action' as const, damage: '1d10 + DEX' },
          { id: 'prosthetic_strike', name: 'Prosthetic Strike', description: 'Energy blast', type: 'action' as const, damage: '1d10' },
          { id: 'deploy_turret', name: 'Deploy Turret Prototype', description: 'Place turret', type: 'action' as const, damage: '—' },
          { id: 'overcharge_burst', name: 'Overcharge Burst', description: 'AoE lightning', type: 'action' as const, damage: '6d6 lightning' }
        ],
        portraitUrl: '/tokens/gustave.png',
        backgroundColor: '#dc2626'
      },
      {
        id: 'lune',
        name: 'Lune',
        role: 'Elemental Scholar',
        stats: { str: 10, dex: 12, con: 13, int: 16, wis: 14, cha: 11 },
        currentHP: 22,
        maxHP: 22,
        charges: 0,
        maxCharges: 5,
        level: 1,
        abilities: [{ id: 'elemental_bolt', name: 'Elemental Bolt', description: 'Ranged spell', type: 'action' as const, damage: '1d10 elemental' }],
        backgroundColor: '#7c3aed'
      },
      {
        id: 'sciel',
        name: 'Sciel',
        role: 'Tarot Warrior',
        stats: { str: 13, dex: 14, con: 12, int: 11, wis: 15, cha: 16 },
        currentHP: 24,
        maxHP: 24,
        charges: 0,
        maxCharges: 3,
        level: 1,
        abilities: [{ id: 'card_toss', name: 'Card Toss', description: 'Ranged spell', type: 'action' as const, damage: '1d6 + 1d4' }],
        backgroundColor: '#059669'
      }
    ];

    const battleSession: BattleSessionDoc = {
      name: 'Test Session',
      characters: ['maelle', 'gustave', 'lune', 'sciel'],
      battleState: { isActive: false, currentTurn: 'maelle', turnOrder: ['maelle', 'gustave', 'lune', 'sciel'], round: 1, mapId: 'test-map' },
      combatState: {
        isActive: false,
        currentTurn: 'maelle',
        turnOrder: ['maelle', 'gustave', 'lune', 'sciel'],
        round: 1,
        phase: 'setup',
        initiativeOrder: [
          { id: 'sciel', name: 'Sciel', initiative: 16, type: 'player', characterId: 'sciel', hasActed: false },
          { id: 'maelle', name: 'Maelle', initiative: 15, type: 'player', characterId: 'maelle', hasActed: false },
          { id: 'lune', name: 'Lune', initiative: 14, type: 'player', characterId: 'lune', hasActed: false },
          { id: 'gustave', name: 'Gustave', initiative: 12, type: 'player', characterId: 'gustave', hasActed: false }
        ]
      },
      pendingActions: [],
      enemyHP: {},
      tokens: {
        'token-maelle': { id: 'token-maelle', characterId: 'maelle', name: 'Maelle', position: { x: 2, y: 2 }, type: 'player', hp: 25, maxHp: 25, color: '#3B82F6'},
        'token-gustave': { id: 'token-gustave', characterId: 'gustave', name: 'Gustave', position: { x: 4, y: 2 }, type: 'player', hp: 30, maxHp: 30, color: '#dc2626' },
        'token-lune': { id: 'token-lune', characterId: 'lune', name: 'Lune', position: { x: 6, y: 2 }, type: 'player', hp: 22, maxHp: 22, color: '#7c3aed' },
        'token-sciel': { id: 'token-sciel', characterId: 'sciel', name: 'Sciel', position: { x: 8, y: 2 }, type: 'player', hp: 24, maxHp: 24, color: '#059669' }
      },
      mapId: 'test-map',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    for (const c of characters) {
      const { id, ...data } = c;
      await setDoc(doc(db, 'characters', id), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    await setDoc(doc(db, 'battleSessions', 'test-session'), battleSession);
    console.log('Sample data initialized');
  }
}