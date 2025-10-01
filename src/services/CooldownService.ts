import { FirestoreService } from './firestoreService';

export interface CooldownData {
  turnsRemaining: number;
  appliedOnRound: number;
  abilityName: string;
  originalDuration: number;
}

export class CooldownService {
  /**
   * Applies a cooldown to a token
   */
  static async applyCooldown(
    sessionId: string,
    tokenId: string,
    abilityId: string,
    abilityName: string,
    duration: number
  ): Promise<void> {
    const session = await FirestoreService.getBattleSession(sessionId);
    const currentRound = session?.combatState?.round || 1;

    const cooldownData: CooldownData = {
      turnsRemaining: duration,
      appliedOnRound: currentRound,
      abilityName,
      originalDuration: duration
    };

    await FirestoreService.updateTokenProperty(
      sessionId,
      tokenId,
      `cooldowns.${abilityId}`,
      cooldownData
    );

    console.log(`⏳ Applied ${duration}-turn cooldown to ${abilityName}`);
  }

  /**
   * Decrements all cooldowns for a token at the start of their turn
   */
  static async decrementCooldowns(
    sessionId: string,
    tokenId: string
  ): Promise<void> {
    const session = await FirestoreService.getBattleSession(sessionId);
    const token = session?.tokens[tokenId];
    const currentRound = session?.combatState?.round || 1;

    if (!token?.cooldowns) return;

    const updates: Record<string, any> = {};
    let hasUpdates = false;

    Object.entries(token.cooldowns).forEach(([abilityId, cooldown]: [string, any]) => {
      // Skip if cooldown was applied this round
      if (cooldown.appliedOnRound === currentRound) {
        console.log(`⏸️ Skipping ${cooldown.abilityName} - applied this round`);
        return;
      }

      const newRemaining = Math.max(0, cooldown.turnsRemaining - 1);

      if (newRemaining === 0) {
        // Remove cooldown when expired
        updates[`cooldowns.${abilityId}`] = null;
        console.log(`✅ ${cooldown.abilityName} cooldown expired`);
      } else {
        // Decrement cooldown
        updates[`cooldowns.${abilityId}.turnsRemaining`] = newRemaining;
        console.log(`⏳ ${cooldown.abilityName}: ${newRemaining} turns remaining`);
      }

      hasUpdates = true;
    });

    if (hasUpdates) {
      await FirestoreService.updateTokenProperties(sessionId, tokenId, updates);
    }
  }

  /**
   * Clears all cooldowns for a token (used when combat ends)
   */
  static async clearAllCooldowns(
    sessionId: string,
    tokenId: string
  ): Promise<void> {
    await FirestoreService.updateTokenProperty(
      sessionId,
      tokenId,
      'cooldowns',
      {}
    );
    console.log(`🔄 Cleared all cooldowns for token ${tokenId}`);
  }

  /**
   * Clears all cooldowns for all tokens when combat ends
   */
  static async clearAllTokenCooldowns(sessionId: string): Promise<void> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session?.tokens) return;

    const promises = Object.keys(session.tokens).map(tokenId =>
      this.clearAllCooldowns(sessionId, tokenId)
    );

    await Promise.all(promises);
    console.log('🔄 Cleared all cooldowns for all tokens');
  }

  /**
   * Gets the remaining cooldown for a specific ability
   */
  static getCooldown(
    token: any,
    abilityId: string
  ): number {
    return token?.cooldowns?.[abilityId]?.turnsRemaining || 0;
  }

  /**
   * Checks if an ability is on cooldown
   */
  static isOnCooldown(token: any, abilityId: string): boolean {
    return this.getCooldown(token, abilityId) > 0;
  }
}