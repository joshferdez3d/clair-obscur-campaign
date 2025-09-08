// src/services/firestoreService.ts (REPLACE FILE)

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion
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
  InitiativeEntry
} from '../types';

// Enhanced GM action used by GM popup and service
export interface GMCombatAction extends CombatAction {
  // legacy single-target
  targetId?: string;
  targetName?: string;

  // NEW: AoE
  targetIds?: string[];
  targetNames?: string[];

  playerName?: string;
  abilityName?: string;
  hit?: boolean;
  needsDamageInput?: boolean;
  damageApplied?: boolean;

  // always present on our actions (even if not used by UI)
  sourcePosition: Position;
  range: number;
  timestamp: Date;
}

export class FirestoreService {
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

  // Add these methods to your FirestoreService class

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
  // In firestoreService.ts
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

  static async addToken(sessionId: string, token: BattleToken) {
    const ref = doc(db, 'battleSessions', sessionId);
    await updateDoc(ref, { [`tokens.${token.id}`]: token, updatedAt: serverTimestamp() });
  }

  static async removeToken(sessionId: string, tokenId: string) {
    const session = await this.getBattleSession(sessionId);
    if (!session?.tokens[tokenId]) return;
    const updated = { ...session.tokens };
    delete updated[tokenId];
    const ref = doc(db, 'battleSessions', sessionId);
    await updateDoc(ref, { tokens: updated, updatedAt: serverTimestamp() });
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

  static async endCombat(sessionId: string) {
    const ref = doc(db, 'battleSessions', sessionId);
    await updateDoc(ref, {
      'combatState.isActive': false,
      'combatState.phase': 'ended',
      'combatState.currentTurn': '',
      pendingActions: [],
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
        backgroundColor: '#4f46e5'
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
        'token-maelle': { id: 'token-maelle', characterId: 'maelle', name: 'Maelle', position: { x: 2, y: 2 }, type: 'player', hp: 25, maxHp: 25, color: '#4f46e5' },
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
