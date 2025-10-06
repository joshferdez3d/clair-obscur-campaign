// src/services/passiveEnemyAbilityService.ts
import { FirestoreService } from './firestoreService';

export class PassiveEnemyAbilityService {
  /**
   * Process Bruler's Cinder Aura passive ability
   * Deals 5 fire damage to all enemies within 5ft at the start of Bruler's turn
   */
  static async processBrulerCinderAura(sessionId: string, brulerId: string): Promise<void> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session?.tokens) return;

    const brulerToken = session.tokens[brulerId];
    if (!brulerToken || (brulerToken.hp ?? 0) <= 0) return;

    const BURN_DAMAGE = 5;
    const AURA_RANGE = 5; // 5 feet

    // Find all tokens within 5ft of this Bruler
    const affectedTokens: Array<{id: string, name: string, distance: number}> = [];
    
    Object.entries(session.tokens).forEach(([tokenId, token]: [string, any]) => {
      // Skip the Bruler itself and dead tokens
      if (tokenId === brulerId || (token.hp ?? 0) <= 0) return;
      
      // Calculate distance
      const distance = this.calculateDistance(brulerToken.position, token.position);
      
      // If within 5ft, add to affected list
      if (distance <= AURA_RANGE) {
        affectedTokens.push({
          id: tokenId,
          name: token.name,
          distance
        });
      }
    });

    // Apply burn damage to all affected tokens
    if (affectedTokens.length > 0) {
      console.log(`🔥 Bruler's Cinder Aura activates! ${affectedTokens.length} tokens affected.`);
      
      for (const affected of affectedTokens) {
        const token = session.tokens[affected.id];
        const newHP = Math.max(0, (token.hp || 0) - BURN_DAMAGE);
        
        await FirestoreService.updateBattleSession(sessionId, {
          [`tokens.${affected.id}.hp`]: newHP
        });

        // Update character HP if it's a player token
        if (token.characterId) {
          await FirestoreService.updateCharacterHP(token.characterId, newHP);
        }

        console.log(`🔥 ${affected.name} takes ${BURN_DAMAGE} burn damage from Cinder Aura (${affected.distance}ft away) - HP: ${token.hp} → ${newHP}`);
      }

      // Show notification to players about the burn damage
      console.log(`🔥 Cinder Aura affected: ${affectedTokens.map(t => t.name).join(', ')}`);
    }
  }


  /**
   * Calculate distance between two positions in feet
   */
  private static calculateDistance(pos1: {x: number, y: number}, pos2: {x: number, y: number}): number {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    return Math.max(dx, dy) * 5; // Convert grid squares to feet (each square = 5ft)
  }

  /**
   * Main processor for all passive enemy abilities
   * Call this at the start of each enemy's turn
   */
  static async processPassiveAbilities(sessionId: string, enemyId: string, enemyType: string): Promise<void> {
    // Check enemy type and process appropriate passive
    if (enemyType === 'bruler') {
      await this.processBrulerCinderAura(sessionId, enemyId);
    }
    
    // Add more passive abilities here as needed for other enemies
    // Example: if (enemyType === 'poisoner') { await this.processPoisonAura(...); }
  }
}