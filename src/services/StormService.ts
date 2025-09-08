import { FirestoreService } from './firestoreService';
import type { StormState, PendingStormRoll, StormAttack } from '../types';

export class StormService {
  static async activateStorm(sessionId: string, stacksConsumed: number): Promise<void> {
    const stormState: StormState = {
      isActive: true,
      turnsRemaining: 5,
      totalTurns: 5,
      currentTurn: 1,
      originalStacks: stacksConsumed,
      triggeredBy: 'sciel'
    };

    await FirestoreService.updateBattleSession(sessionId, {
      stormState,
      'combatState.scielUltimateActive': true
    });

    // Trigger first storm attack immediately
    await this.triggerStormTurn(sessionId);
  }

  static async triggerStormTurn(sessionId: string): Promise<void> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session?.stormState?.isActive) return;

    const { stormState } = session;
    
    // Get all enemy tokens for targeting
    const enemyTokens = Object.values(session.tokens || {})
      .filter(token => token.type === 'enemy' && (token.hp || 0) > 0);

    if (enemyTokens.length === 0) {
      // No enemies left, end storm
      await this.endStorm(sessionId);
      return;
    }

    // Select random enemy
    const randomEnemy = enemyTokens[Math.floor(Math.random() * enemyTokens.length)];
    
    // Create pending roll for GM
    const pendingRoll: PendingStormRoll = {
      id: `storm_${Date.now()}`,
      turnNumber: stormState.currentTurn,
      targetId: randomEnemy.id,
      targetName: randomEnemy.name,
      isActive: true,
      stacks: stormState.originalStacks
    };

    await FirestoreService.updateBattleSession(sessionId, {
      pendingStormRoll: pendingRoll
    });
  }

  static async resolveStormAttack(
    sessionId: string, 
    rollId: string, 
    damage: number
  ): Promise<void> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session?.pendingStormRoll || session.pendingStormRoll.id !== rollId) {
      return;
    }

    const { pendingStormRoll, stormState } = session;
    
    // Apply damage to target token
    if (pendingStormRoll.targetId && damage > 0) {
      await FirestoreService.updateTokenHP(sessionId, pendingStormRoll.targetId, 
        (session.tokens[pendingStormRoll.targetId]?.hp || 0) - damage);
    }

    // Record the attack
    const attack: StormAttack = {
      id: rollId,
      turnNumber: pendingStormRoll.turnNumber,
      targetId: pendingStormRoll.targetId,
      damage,
      timestamp: Date.now()
    };

    // Clear pending roll and advance storm
    const turnsRemaining = (stormState?.turnsRemaining || 1) - 1;
    const currentTurn = (stormState?.currentTurn || 1) + 1;

    const updates: any = {
      pendingStormRoll: null,
      [`stormAttacks.${rollId}`]: attack
    };

    if (turnsRemaining <= 0) {
      // Storm ends
      updates.stormState = {
        ...stormState,
        isActive: false,
        turnsRemaining: 0
      };
      updates['combatState.scielUltimateActive'] = false;
    } else {
      // Continue storm
      updates.stormState = {
        ...stormState,
        turnsRemaining,
        currentTurn
      };
    }

    await FirestoreService.updateBattleSession(sessionId, updates);
  }

  static async endStorm(sessionId: string): Promise<void> {
    await FirestoreService.updateBattleSession(sessionId, {
      'stormState.isActive': false,
      'combatState.scielUltimateActive': false,
      pendingStormRoll: null
    });
  }
}