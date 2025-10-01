import { FirestoreService } from './firestoreService';
import { doc, updateDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { db } from './firebase';

export interface ProtectionEffect {
  id: string;
  protectorId: string;
  protectorName: string;
  protectedAllyId: string;
  protectedAllyName: string;
  abilityName: string;
  activatedOnRound: number;
  expiresOnProtectorTurn: boolean;
  range?: number;
}

export class ProtectionService {
  /**
   * Activate protection on an ally
   */
  static async activateProtection(
    sessionId: string,
    protectorId: string,
    protectorName: string,
    protectedAllyId: string,
    abilityName: string
  ): Promise<void> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session) throw new Error('Session not found');

    const currentRound = session.combatState?.round || 1;
    const protectedToken = session.tokens[protectedAllyId];
    
    if (!protectedToken) {
      throw new Error('Protected ally not found');
    }

    const protection: ProtectionEffect = {
      id: `protection-${Date.now()}`,
      protectorId,
      protectorName,
      protectedAllyId,
      protectedAllyName: protectedToken.name,
      abilityName,
      activatedOnRound: currentRound,
      expiresOnProtectorTurn: true
    };

    // Store on the protected ally's token
    await FirestoreService.updateTokenProperty(
      sessionId,
      protectedAllyId,
      'statusEffects.protection',
      {
        protectorId,
        protectorName,
        abilityName,
        activatedOnRound: currentRound,
        description: `Protected by ${protectorName}`
      }
    );

    // Also track in session for easy cleanup
    const sessionRef = doc(db, 'battleSessions', sessionId);
    await updateDoc(sessionRef, {
      [`activeProtections.${protectedAllyId}`]: protection,
      updatedAt: serverTimestamp()
    });

    console.log(`🛡️ ${protectorName} is now protecting ${protectedToken.name} with ${abilityName}`);
  }

  /**
   * Check if a character has active protection
   */
  static getProtection(session: any, characterId: string): ProtectionEffect | null {
    return session?.activeProtections?.[characterId] || null;
  }

  /**
   * Redirect damage from protected ally to protector
   */
  static async redirectDamage(
    sessionId: string,
    targetId: string,
    damage: number
  ): Promise<{ redirected: boolean; newTargetId: string; protectorName: string } | null> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session) return null;

    const protection = this.getProtection(session, targetId);
    
    if (!protection) return null;

    // Check if protector is still alive
    const protectorToken = session.tokens[protection.protectorId];
    if (!protectorToken || (protectorToken.hp !== undefined && protectorToken.hp <= 0)) {
      // Protector is dead, remove protection
      await this.removeProtection(sessionId, targetId);
      return null;
    }

    console.log(`🛡️ ${protection.protectorName} intercepts ${damage} damage for ${protection.protectedAllyName}!`);

    return {
      redirected: true,
      newTargetId: protection.protectorId,
      protectorName: protection.protectorName
    };
  }

  /**
   * Remove protection from an ally
   */
  static async removeProtection(sessionId: string, protectedAllyId: string): Promise<void> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session) return;

    const protection = this.getProtection(session, protectedAllyId);
    if (!protection) return;

    // Remove from token
    await FirestoreService.updateTokenProperty(
      sessionId,
      protectedAllyId,
      'statusEffects.protection',
      null
    );

    // Remove from session tracking
    const sessionRef = doc(db, 'battleSessions', sessionId);
    await updateDoc(sessionRef, {
      [`activeProtections.${protectedAllyId}`]: deleteField(),
      updatedAt: serverTimestamp()
    });

    console.log(`🛡️ Protection removed from ${protection.protectedAllyName}`);
  }

  /**
   * Remove all protections from a specific protector (when their turn starts)
   */
  static async removeProtectorEffects(sessionId: string, protectorId: string): Promise<void> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session?.activeProtections) return;

    const updates: Record<string, any> = {};
    let hasUpdates = false;

    // Find all protections by this protector
    Object.entries(session.activeProtections).forEach(([allyId, protection]: [string, any]) => {
      if (protection.protectorId === protectorId) {
        // Remove from token
        updates[`tokens.${allyId}.statusEffects.protection`] = deleteField();
        // Remove from tracking
        updates[`activeProtections.${allyId}`] = deleteField();
        hasUpdates = true;
        console.log(`🛡️ ${protection.protectorName}'s protection on ${protection.protectedAllyName} expired`);
      }
    });

    if (hasUpdates) {
      const sessionRef = doc(db, 'battleSessions', sessionId);
      await updateDoc(sessionRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    }
  }

  /**
   * Clear all protections (when combat ends)
   */
  static async clearAllProtections(sessionId: string): Promise<void> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session?.activeProtections) return;

    const updates: Record<string, any> = {};

    // Remove from all tokens
    Object.keys(session.activeProtections).forEach(allyId => {
      updates[`tokens.${allyId}.statusEffects.protection`] = deleteField();
    });

    // Clear tracking
    updates['activeProtections'] = deleteField();

    const sessionRef = doc(db, 'battleSessions', sessionId);
    await updateDoc(sessionRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });

    console.log('🛡️ All protections cleared');
  }
}