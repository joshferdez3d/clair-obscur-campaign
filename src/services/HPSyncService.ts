// HPSyncService.ts - Enhanced with Max HP Management

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
      // IMPORTANT: Only update currentHP, never touch maxHP
      await updateDoc(characterRef, {
        currentHP: clampedHP,
        updatedAt: serverTimestamp(),
      });
      console.log(`💚 setHP: Updated ${characterId} current HP to ${clampedHP}, max HP remains ${maxHP}`);
    } catch (error) {
      console.error(`❌ setHP: Failed to update character document for ${characterId}:`, error);
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
        try {
          // IMPORTANT: Only update token HP, never touch maxHp
          await updateDoc(sessionRef, {
            [`tokens.${tokenId}.hp`]: clampedHP,
            updatedAt: serverTimestamp(),
          });
          console.log(`💚 setHP: Updated token ${tokenId} HP to ${clampedHP}, maxHp unchanged`);
        } catch (error) {
          console.error(`❌ setHP: Failed to update token HP for ${tokenId}:`, error);
        }
      }
    }

    return clampedHP;
  }

  // NEW: Set Max HP for a character and sync to tokens
  static async setMaxHP(characterId: string, sessionId: string, newMaxHP: number): Promise<number> {
    if (newMaxHP <= 0) {
      throw new Error('Max HP must be greater than 0');
    }

    const characterRef = doc(db, 'characters', characterId);
    const characterSnap = await getDoc(characterRef);
    const cdata = (characterSnap.exists() ? (characterSnap.data() as AnyRecord) : {}) || {};
    const currentHP = (cdata.currentHP ?? cdata.hp ?? 0) as number;

    // If current HP is higher than new max HP, adjust current HP down
    const adjustedCurrentHP = Math.min(currentHP, newMaxHP);

    try {
      await updateDoc(characterRef, {
        maxHP: newMaxHP,
        currentHP: adjustedCurrentHP, // Ensure current HP doesn't exceed new max
        updatedAt: serverTimestamp(),
      });
    } catch {
      // character doc may not exist yet; continue
    }

    // Update token maxHp and hp in battle session
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
          [`tokens.${tokenId}.maxHp`]: newMaxHP,
          [`tokens.${tokenId}.hp`]: adjustedCurrentHP,
          updatedAt: serverTimestamp(),
        });
      }
    }

    console.log(`⚡ Set ${characterId} Max HP to ${newMaxHP}, adjusted current HP to ${adjustedCurrentHP}`);
    return newMaxHP;
  }

  // NEW: Get Max HP for a character
  static async getMaxHP(characterId: string): Promise<number> {
    const characterRef = doc(db, 'characters', characterId);
    const snap = await getDoc(characterRef);
    if (!snap.exists()) return 0;
    const data = snap.data() as AnyRecord;
    return (data.maxHP ?? data.maxHp ?? 0) as number;
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
        const maxHp = (cdata.maxHP ?? cdata.maxHp ?? 100) as number;

        await updateDoc(sessionRef, {
          [`tokens.${tokenId}.hp`]: hp,
          [`tokens.${tokenId}.maxHp`]: maxHp,
          updatedAt: serverTimestamp(),
        });
      }
      console.log('✅ All character HPs and Max HPs synced to tokens');
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
      newHP: (u.newHP ?? u.hp ?? 0) as number,
    }));

    const promises = normalized.map(async ({ characterId, sessionId, newHP }) => {
      return this.setHP(characterId, sessionId, newHP);
    });

    await Promise.all(promises);
    console.log(`✅ Batch updated HP for ${normalized.length} characters`);
  }
}