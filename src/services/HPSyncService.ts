// HPSyncService.ts

import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { BattleToken } from '../types';

type AnyRecord = Record<string, any>;
type HPBatchUpdate = { characterId: string; sessionId: string; newHP: number };

export class HPSyncService {
  private static clamp(val: number, min: number, max: number) {
    return Math.max(min, Math.min(max, val));
  }

  static async setHP(characterId: string, sessionId: string, newHP: number): Promise<number> {
    const characterRef = doc(db, 'characters', characterId);
    const characterSnap = await getDoc(characterRef);
    const cdata = (characterSnap.exists() ? (characterSnap.data() as AnyRecord) : {}) || {};
    const maxHP = (cdata.maxHP ?? cdata.maxHp ?? 100) as number;

    const clampedHP = this.clamp(newHP, 0, maxHP);

    try {
      await updateDoc(characterRef, {
        currentHP: clampedHP,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // character doc may not exist yet; continue
    }

    const sessionRef = doc(db, 'battleSessions', sessionId);
    const sessionSnap = await getDoc(sessionRef);
    if (sessionSnap.exists()) {
      const sdata = (sessionSnap.data() as AnyRecord) || {};
      const tokensObj: AnyRecord = sdata.tokens ?? {};

      const playerTokens = Object.entries(tokensObj).filter(
        (entry): entry is [string, BattleToken] => {
          const [, t] = entry as [string, any];
          return t?.type === 'player' && typeof t?.characterId === 'string' && t.characterId === characterId;
        }
      );

      if (playerTokens.length > 0) {
        const [tokenId] = playerTokens[0];
        await updateDoc(sessionRef, {
          [`tokens.${tokenId}.hp`]: clampedHP,
          updatedAt: serverTimestamp(),
        });
      }
    }

    return clampedHP;
  }

  static async damage(characterId: string, sessionId: string, amount: number): Promise<number> {
    const characterRef = doc(db, 'characters', characterId);
    const snap = await getDoc(characterRef);
    const current = (snap.exists() ? (snap.data() as AnyRecord).currentHP : 0) ?? 0;
    return this.setHP(characterId, sessionId, current - Math.max(0, amount));
  }

  static async heal(characterId: string, sessionId: string, amount: number): Promise<number> {
    const characterRef = doc(db, 'characters', characterId);
    const snap = await getDoc(characterRef);
    const current = (snap.exists() ? (snap.data() as AnyRecord).currentHP : 0) ?? 0;
    return this.setHP(characterId, sessionId, current + Math.max(0, amount));
  }

  static async syncAllCharacterHPToTokens(sessionId: string): Promise<void> {
    try {
      const sessionRef = doc(db, 'battleSessions', sessionId);
      const sessionSnap = await getDoc(sessionRef);
      if (!sessionSnap.exists()) return;

      const sdata = (sessionSnap.data() as AnyRecord) || {};
      const tokensObj: AnyRecord = sdata.tokens ?? {};

      const playerTokens = Object.entries(tokensObj).filter(
        (entry): entry is [string, BattleToken] => {
          const [, t] = entry as [string, any];
          return t?.type === 'player' && typeof t?.characterId === 'string' && t.characterId.length > 0;
        }
      );

      for (const [tokenId, token] of playerTokens) {
        const characterRef = doc(db, 'characters', token.characterId!);
        const characterSnap = await getDoc(characterRef);
        if (!characterSnap.exists()) continue;

        const cdata = characterSnap.data() as AnyRecord;
        const hp = (cdata.currentHP ?? cdata.hp ?? 0) as number;

        await updateDoc(sessionRef, {
          [`tokens.${tokenId}.hp`]: hp,
          updatedAt: serverTimestamp(),
        });
      }
      console.log('✅ All character HPs synced to tokens');
    } catch (error) {
      console.error('❌ Error syncing HPs:', error);
      throw error;
    }
  }

  static async updateCharacterAndTokenHP(characterId: string, sessionId: string, newHP: number): Promise<void> {
    await this.setHP(characterId, sessionId, newHP);
  }

  // -----------------------------
  // 🔧 Added for useGMHPControl.ts
  // -----------------------------

  /** Reads the character's current HP (falls back to 0 if doc missing). */
  static async getCurrentHP(characterId: string): Promise<number> {
    const characterRef = doc(db, 'characters', characterId);
    const snap = await getDoc(characterRef);
    if (!snap.exists()) return 0;
    const data = snap.data() as AnyRecord;
    return (data.currentHP ?? data.hp ?? 0) as number;
  }

  /** Alias: matches hook name */
  static async applyDamage(characterId: string, sessionId: string, amount: number): Promise<number> {
    return this.damage(characterId, sessionId, amount);
  }

  /** Alias: matches hook name */
  static async applyHealing(characterId: string, sessionId: string, amount: number): Promise<number> {
    return this.heal(characterId, sessionId, amount);
  }

  /** Batch updater used by GM multi-target actions. */
  static async batchUpdateHP(updates: HPBatchUpdate[]): Promise<void> {
    // Accept some alternate field names just in case.
    const normalized = updates.map((u: any) => ({
      characterId: u.characterId as string,
      sessionId: u.sessionId as string,
      newHP: (u.newHP ?? u.hp ?? u.updatedHP) as number,
    }));

    await Promise.all(
      normalized.map(({ characterId, sessionId, newHP }) =>
        this.setHP(characterId, sessionId, Number(newHP))
      )
    );
  }

  /** Alias with pluralized name expected by the hook. */
  static async syncAllCharacterHPsToTokens(sessionId: string): Promise<void> {
    return this.syncAllCharacterHPToTokens(sessionId);
  }
}
