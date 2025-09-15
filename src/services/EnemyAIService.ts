// src/services/EnemyAIService.ts
import { FirestoreService } from './firestoreService';
import { getEnemyBehavior, SPECIAL_BEHAVIORS } from '../data/enemyBehaviors';
import type { EnemyBehavior } from '../data/enemyBehaviors';
import type { 
  BattleToken, 
  BattleSession, 
  Position,
  InitiativeEntry,
  EnemyData 
} from '../types';

// Import enemy data - we'll need to export this from enemies.ts
// For now, we'll handle this differently
import { enemies } from '../data/enemies';

/**
 * Enemy AI Service - Orchestrates all enemy AI behaviors
 * Version: 0.1.0
 * Last Updated: January 15, 2025
 */
export class EnemyAIService {
  // Configuration
  private static readonly CONFIG = {
    TURN_DELAY: 2000,         // Time before AI acts (ms)
    ACTION_PREVIEW: 1000,     // Time to show AI intention (ms)
    MOVEMENT_SPEED: 500,      // Animation speed for movement (ms)
  };

  /**
   * Roll initiative for an enemy when added to combat
   */
  static rollInitiative(): number {
    return Math.floor(Math.random() * 20) + 1;
  }

  /**
   * Group enemies by base type for shared initiative
   * e.g., "Goblin Scout", "Goblin Warrior" -> "goblin"
   */
  static getEnemyBaseType(enemyName: string): string {
    // Extract base type from enemy name
    const baseTypes = [
      'goblin', 'lancelier', 'noir_harbinger', 'centurion',
      'flammèche', 'orc', 'skeleton', 'bandit'
    ];
    
    const lowerName = enemyName.toLowerCase();
    for (const type of baseTypes) {
      if (lowerName.includes(type)) {
        return type;
      }
    }
    
    return enemyName.toLowerCase().split(' ')[0];
  }

  /**
   * Create initiative entry for enemy group
   */
  static createEnemyInitiativeEntry(
    enemyTokens: BattleToken[],
    baseType: string
  ): InitiativeEntry {
    const initiative = this.rollInitiative();
    const representative = enemyTokens[0];
    
    return {
      id: `enemy-group-${baseType}-${Date.now()}`,
      name: enemyTokens.length > 1 
        ? `${baseType} (x${enemyTokens.length})`
        : representative.name,
      initiative,
      type: 'enemy',
      hasActed: false
    };
  }

  /**
   * Main AI execution for enemy turn
   */
  static async executeEnemyTurn(
    sessionId: string,
    enemyId: string,
    session: BattleSession
  ): Promise<void> {
    console.log(`🤖 AI: Starting turn for ${enemyId}`);
    
    // Add delay for visibility
    await this.delay(this.CONFIG.TURN_DELAY);
    
    try {
      // Get enemy token
      const enemyToken = this.getEnemyToken(session, enemyId);
      if (!enemyToken) {
        console.error(`Enemy ${enemyId} not found`);
        await FirestoreService.nextTurn(sessionId);
        return;
      }

      // Check if enemy is dead
      if ((enemyToken.hp || 0) <= 0) {
        console.log(`Enemy ${enemyId} is dead, skipping turn`);
        await FirestoreService.nextTurn(sessionId);
        return;
      }

      // Execute AI decision
      await this.makeAndExecuteDecision(sessionId, enemyToken, session);
      
      // Auto-advance turn after action
      setTimeout(() => {
        FirestoreService.nextTurn(sessionId);
      }, this.CONFIG.ACTION_PREVIEW);
      
    } catch (error) {
      console.error('AI Error:', error);
      // Always advance turn even on error
      await FirestoreService.nextTurn(sessionId);
    }
  }

  /**
   * Enhanced decision making using behavior profiles
   */
  private static async makeAndExecuteDecision(
    sessionId: string,
    enemy: BattleToken,
    session: BattleSession
  ): Promise<void> {
    // Get enemy behavior profile
    const behavior = getEnemyBehavior(enemy.name);
    
    // Get enemy data for abilities
    const enemyData = this.getEnemyData(enemy.name);
    
    // Apply special behaviors
    const behaviorModifiers = this.applySpecialBehaviors(
      behavior, 
      enemy, 
      session
    );
    
    // Get valid targets based on behavior
    const targets = this.getValidTargets(session);
    if (targets.length === 0) {
      console.log('No valid targets found');
      return;
    }

    // Select target based on behavior priority
    const target = this.selectTargetByBehavior(
      enemy, 
      targets, 
      behavior,
      session
    );
    
    if (!target) return;

    const distance = this.calculateDistance(enemy.position, target.position);
    
    // Decide action based on behavior and situation
    const action = this.decideAction(
      enemy,
      target,
      distance,
      behavior,
      enemyData,
      behaviorModifiers
    );
    
    // Execute the decided action
    await this.executeAction(sessionId, enemy, target, action, session);
  }

  /**
   * Select target based on behavior priority
   */
  private static selectTargetByBehavior(
    enemy: BattleToken,
    targets: BattleToken[],
    behavior: EnemyBehavior,
    session: BattleSession
  ): BattleToken | null {
    switch (behavior.targetPriority) {
      case 'lowest-hp':
        return targets.sort((a, b) => (a.hp || 0) - (b.hp || 0))[0];
      
      case 'nearest':
        return this.getNearestTarget(enemy, targets);
      
      case 'highest-threat':
        // Target dealing most damage or healers
        return this.getHighestThreatTarget(targets, session);
      
      case 'weakest-ac':
        // Target with lowest AC (if known)
        return this.getWeakestACTarget(targets);
      
      case 'random':
      default:
        return targets[Math.floor(Math.random() * targets.length)];
    }
  }

  /**
   * Determine highest threat target
   */
  private static getHighestThreatTarget(
    targets: BattleToken[], 
    session: BattleSession
  ): BattleToken {
    // Priority: Healers > High damage dealers > Others
    const healers = targets.filter(t => 
      t.name.toLowerCase().includes('lune') || 
      t.name.toLowerCase().includes('sciel')
    );
    
    if (healers.length > 0) {
      return healers[0];
    }
    
    // Otherwise target highest damage dealer (Gustave/Maelle)
    const damageDealer = targets.find(t => 
      t.name.toLowerCase().includes('gustave') ||
      t.name.toLowerCase().includes('maelle')
    );
    
    return damageDealer || targets[0];
  }

  /**
   * Get target with weakest AC
   */
  private static getWeakestACTarget(targets: BattleToken[]): BattleToken {
    // Estimate AC based on character type
    const acEstimates: Record<string, number> = {
      'lune': 12,
      'sciel': 13,
      'maelle': 14,
      'gustave': 15
    };
    
    return targets.sort((a, b) => {
      const aAC = acEstimates[a.name.toLowerCase()] || 13;
      const bAC = acEstimates[b.name.toLowerCase()] || 13;
      return aAC - bAC;
    })[0];
  }

  /**
   * Decide what action to take
   */
  private static decideAction(
    enemy: BattleToken,
    target: BattleToken,
    distance: number,
    behavior: EnemyBehavior,
    enemyData: any,
    modifiers: any
  ): 'move' | 'attack' | 'ability' | 'move-and-attack' {
    const inMeleeRange = distance <= 5;
    const inPreferredRange = distance <= behavior.preferredRange;
    
    // Check if should retreat
    const hpPercent = (enemy.hp || 0) / (enemy.maxHp || 1);
    if (hpPercent < behavior.retreatThreshold) {
      return 'move'; // Retreat
    }
    
    // Check if should use ability
    if (behavior.abilityUsage.preferAbilities && enemyData?.attacks) {
      const hasUsableAbility = this.checkForUsableAbility(
        enemyData.attacks,
        distance
      );
      if (hasUsableAbility) {
        return 'ability';
      }
    }
    
    // Determine based on range and preference
    if (behavior.attackPreference === 'melee') {
      if (inMeleeRange) return 'attack';
      return 'move-and-attack';
    } else if (behavior.attackPreference === 'ranged') {
      if (distance > 30) return 'move';
      if (inMeleeRange && modifiers.avoidMelee) return 'move';
      return 'attack';
    }
    
    // Default
    return inPreferredRange ? 'attack' : 'move-and-attack';
  }

  /**
   * Execute the chosen action
   */
  private static async executeAction(
    sessionId: string,
    enemy: BattleToken,
    target: BattleToken,
    action: string,
    session: BattleSession
  ): Promise<void> {
    switch (action) {
      case 'move':
        await this.executeMovement(sessionId, enemy, target, session, false);
        break;
      
      case 'attack':
        await this.executeAttack(sessionId, enemy, target);
        break;
      
      case 'ability':
        await this.executeAbility(sessionId, enemy, target, session);
        break;
      
      case 'move-and-attack':
        await this.executeMovement(sessionId, enemy, target, session, true);
        const newDistance = this.calculateDistance(enemy.position, target.position);
        if (newDistance <= 5) {
          await this.executeAttack(sessionId, enemy, target);
        }
        break;
    }
  }

  /**
   * Get enemy data from the enemies data file
   */
  private static getEnemyData(enemyName: string): any {
    const lowerName = enemyName.toLowerCase();
    for (const [key, data] of Object.entries(enemies)) {
      if (lowerName.includes(key)) {
        return data;
      }
    }
    return null;
  }

  /**
   * Apply special behavior modifiers
   */
  private static applySpecialBehaviors(
    behavior: EnemyBehavior,
    enemy: BattleToken,
    session: BattleSession
  ): any {
    const modifiers: any = {};
    
    for (const specialBehavior of behavior.specialBehaviors) {
      if (SPECIAL_BEHAVIORS[specialBehavior as keyof typeof SPECIAL_BEHAVIORS]) {
        const handler = SPECIAL_BEHAVIORS[specialBehavior as keyof typeof SPECIAL_BEHAVIORS];
        const allies = Object.values(session.tokens || {}).filter(
          t => t.type === 'enemy' && t.id !== enemy.id && (t.hp || 0) > 0
        );
        
        const result = handler(allies.length || enemy);
        Object.assign(modifiers, result);
      }
    }
    
    return modifiers;
  }

  /**
   * Check if enemy has a usable ability
   */
  private static checkForUsableAbility(
    attacks: any[],
    distance: number
  ): boolean {
    return attacks.some(attack => {
      if (attack.recharge && !this.isAbilityReady(attack)) {
        return false;
      }
      const range = parseInt(attack.range) || 5;
      return distance <= range;
    });
  }

  /**
   * Check if ability is off cooldown
   */
  private static isAbilityReady(ability: any): boolean {
    // For now, assume 33% chance ability is ready if it has recharge
    if (ability.recharge) {
      return Math.random() < 0.33;
    }
    return true;
  }

  /**
   * Enhanced movement with behavior patterns
   */
  private static async executeMovement(
    sessionId: string,
    enemy: BattleToken,
    target: BattleToken,
    session: BattleSession,
    towardsTarget: boolean = true
  ): Promise<void> {
    const behavior = getEnemyBehavior(enemy.name);
    const speed = enemy.speed || 30;
    const maxSquares = Math.floor(speed / 5);
    
    let newPosition: Position;
    
    switch (behavior.movementPattern) {
      case 'flanking':
        newPosition = this.calculateFlankingPosition(
          enemy.position,
          target.position,
          maxSquares,
          session
        );
        break;
      
      case 'kiting':
        newPosition = this.calculateKitingPosition(
          enemy.position,
          target.position,
          maxSquares,
          behavior.preferredRange
        );
        break;
      
      case 'defensive':
        newPosition = this.calculateDefensivePosition(
          enemy.position,
          target.position,
          maxSquares,
          session,
          enemy
        );
        break;
      
      case 'direct':
      default:
        newPosition = this.calculateDirectPath(
          enemy.position,
          target.position,
          maxSquares,
          towardsTarget
        );
        break;
    }
    
    // Check if position is valid (not occupied)
    const isOccupied = Object.values(session.tokens || {}).some(
      t => t.position.x === newPosition.x && 
           t.position.y === newPosition.y && 
           t.id !== enemy.id
    );
    
    if (!isOccupied) {
      await FirestoreService.updateTokenPosition(sessionId, enemy.id, newPosition);
      console.log(`🏃 AI: ${enemy.name} moved to (${newPosition.x}, ${newPosition.y})`);
    }
  }

  /**
   * Calculate direct path movement
   */
  private static calculateDirectPath(
    from: Position,
    to: Position,
    maxSquares: number,
    towards: boolean = true
  ): Position {
    const dx = Math.sign(to.x - from.x) * (towards ? 1 : -1);
    const dy = Math.sign(to.y - from.y) * (towards ? 1 : -1);
    
    let newX = from.x;
    let newY = from.y;
    let moved = 0;
    
    while (moved < maxSquares) {
      if (dx !== 0 && (towards ? newX !== to.x : true)) {
        newX += dx;
        moved++;
      }
      if (dy !== 0 && (towards ? newY !== to.y : true)) {
        newY += dy;
        moved++;
      }
      if (moved >= maxSquares || (towards && newX === to.x && newY === to.y)) {
        break;
      }
    }
    
    return { x: newX, y: newY };
  }

  /**
   * Calculate flanking movement
   */
  private static calculateFlankingPosition(
    from: Position,
    to: Position,
    maxSquares: number,
    session: BattleSession
  ): Position {
    // Try to get behind or to the side of target
    const angles = [90, -90, 45, -45, 135, -135];
    
    for (const angle of angles) {
      const rad = (angle * Math.PI) / 180;
      const dx = Math.round(Math.cos(rad) * 2);
      const dy = Math.round(Math.sin(rad) * 2);
      
      const testPos = {
        x: to.x + dx,
        y: to.y + dy
      };
      
      // Check if position is valid and reachable
      const distance = Math.abs(testPos.x - from.x) + Math.abs(testPos.y - from.y);
      if (distance <= maxSquares) {
        return testPos;
      }
    }
    
    // Fallback to direct
    return this.calculateDirectPath(from, to, maxSquares, true);
  }

  /**
   * Calculate kiting position (stay at range)
   */
  private static calculateKitingPosition(
    from: Position,
    to: Position,
    maxSquares: number,
    preferredRange: number
  ): Position {
    const currentDistance = this.calculateDistance(from, to);
    const preferredSquares = Math.floor(preferredRange / 5);
    
    if (currentDistance < preferredRange) {
      // Move away
      return this.calculateDirectPath(from, to, maxSquares, false);
    } else if (currentDistance > preferredRange + 10) {
      // Move closer
      return this.calculateDirectPath(from, to, maxSquares, true);
    }
    
    // Stay at current range, move laterally
    const perpX = -(to.y - from.y);
    const perpY = to.x - from.x;
    const moveDir = Math.random() > 0.5 ? 1 : -1;
    
    return {
      x: from.x + Math.sign(perpX) * moveDir * Math.min(2, maxSquares),
      y: from.y + Math.sign(perpY) * moveDir * Math.min(2, maxSquares)
    };
  }

  /**
   * Calculate defensive position
   */
  private static calculateDefensivePosition(
    from: Position,
    to: Position,
    maxSquares: number,
    session: BattleSession,
    enemy: BattleToken  // Add this parameter
  ): Position {
    // Move towards allies or cover
    const allies = Object.values(session.tokens || {}).filter(
      t => t.type === 'enemy' && t.id !== enemy.id && (t.hp || 0) > 0
    );
    
    if (allies.length > 0) {
      // Move towards nearest ally
      const nearestAlly = this.getNearestTarget(
        { position: from } as BattleToken,
        allies
      );
      
      if (nearestAlly) {
        return this.calculateDirectPath(
          from,
          nearestAlly.position,
          Math.min(maxSquares, 2),
          true
        );
      }
    }
    
    // Otherwise retreat
    return this.calculateDirectPath(from, to, maxSquares, false);
  }

  /**
   * Execute ability instead of basic attack
   */
  private static async executeAbility(
    sessionId: string,
    attacker: BattleToken,
    target: BattleToken,
    session: BattleSession
  ): Promise<void> {
    const enemyData = this.getEnemyData(attacker.name);
    if (!enemyData?.attacks) {
      // Fallback to basic attack
      await this.executeAttack(sessionId, attacker, target);
      return;
    }
    
    const behavior = getEnemyBehavior(attacker.name);
    const distance = this.calculateDistance(attacker.position, target.position);
    
    // Find best ability to use
    let selectedAbility = null;
    
    for (const abilityName of behavior.abilityUsage.abilityPriority) {
      const ability = enemyData.attacks.find((a: any) => a.name === abilityName);
      if (ability && this.isAbilityReady(ability)) {
        const range = parseInt(ability.range) || 5;
        if (distance <= range) {
          selectedAbility = ability;
          break;
        }
      }
    }
    
    if (!selectedAbility) {
      // Use first available ability
      selectedAbility = enemyData.attacks.find((a: any) => {
        const range = parseInt(a.range) || 5;
        return distance <= range && this.isAbilityReady(a);
      });
    }
    
    if (selectedAbility) {
      const attackRoll = Math.floor(Math.random() * 20) + 1 + (selectedAbility.toHit || 0);
      
      await FirestoreService.createPendingAction(sessionId, {
        playerId: attacker.id,
        playerName: attacker.name,
        targetId: target.id,
        targetName: target.name,
        abilityName: selectedAbility.name,
        acRoll: attackRoll,
        damage: 0,
        type: 'ability',
        isEnemyAction: true,
        abilityDescription: selectedAbility.description
      });
      
      console.log(`🎯 AI: ${attacker.name} uses ${selectedAbility.name} on ${target.name}`);
    } else {
      // Fallback to basic attack
      await this.executeAttack(sessionId, attacker, target);
    }
  }

  /**
   * Get all valid player/ally targets
   */
  private static getValidTargets(session: BattleSession): BattleToken[] {
    return Object.values(session.tokens || {}).filter(
      token => token.type === 'player' && (token.hp || 0) > 0
    );
  }

  /**
   * Find nearest target
   */
  private static getNearestTarget(
    enemy: BattleToken, 
    targets: BattleToken[]
  ): BattleToken | null {
    let nearest: BattleToken | null = null;
    let minDistance = Infinity;

    for (const target of targets) {
      const distance = this.calculateDistance(enemy.position, target.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = target;
      }
    }

    return nearest;
  }

  /**
   * Calculate grid distance (in feet)
   */
  private static calculateDistance(from: Position, to: Position): number {
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    return Math.max(dx, dy) * 5; // Chebyshev distance in feet
  }

  /**
   * Move enemy towards target
   */
  private static async moveTowardsTarget(
    sessionId: string,
    enemy: BattleToken,
    target: BattleToken,
    session: BattleSession
  ): Promise<void> {
    // Simple movement: move directly towards target
    const dx = Math.sign(target.position.x - enemy.position.x);
    const dy = Math.sign(target.position.y - enemy.position.y);
    
    // Calculate movement (up to speed limit)
    const speed = enemy.speed || 30;
    const maxSquares = Math.floor(speed / 5);
    
    let newX = enemy.position.x;
    let newY = enemy.position.y;
    let moveSquares = 0;

    // Move diagonally first, then straight
    while (moveSquares < maxSquares) {
      if (dx !== 0 && newX !== target.position.x) {
        newX += dx;
        moveSquares++;
      }
      if (dy !== 0 && newY !== target.position.y) {
        newY += dy;
        moveSquares++;
      }
      if (newX === target.position.x && newY === target.position.y) {
        break; // Reached target
      }
      if (moveSquares >= maxSquares) {
        break; // Used all movement
      }
    }

    // Update position
    await FirestoreService.updateTokenPosition(sessionId, enemy.id, {
      x: newX,
      y: newY
    });

    console.log(`🏃 AI: ${enemy.name} moved to (${newX}, ${newY})`);
  }

  /**
   * Execute enemy attack
   */
  private static async executeAttack(
    sessionId: string,
    attacker: BattleToken,
    target: BattleToken
  ): Promise<void> {
    // Roll attack
    const attackRoll = Math.floor(Math.random() * 20) + 1;
    
    // Create pending action for GM
    await FirestoreService.createPendingAction(sessionId, {
      playerId: attacker.id,
      playerName: attacker.name,
      targetId: target.id,
      targetName: target.name,
      abilityName: 'Basic Attack',
      acRoll: attackRoll,
      damage: 0, // GM will determine damage
      type: 'attack',
      isEnemyAction: true
    });

    console.log(`⚔️ AI: ${attacker.name} attacks ${target.name} (Roll: ${attackRoll})`);
  }

  /**
   * Helper: Get enemy token from session
   */
  private static getEnemyToken(
    session: BattleSession, 
    enemyId: string
  ): BattleToken | null {
    // Check if it's a group ID
    if (enemyId.startsWith('enemy-group-')) {
      // Find first enemy of this type
      const baseType = enemyId.split('-')[2];
      return Object.values(session.tokens || {}).find(
        token => token.type === 'enemy' && 
                 this.getEnemyBaseType(token.name) === baseType &&
                 (token.hp || 0) > 0
      ) || null;
    }
    
    return session.tokens?.[enemyId] || null;
  }

  /**
   * Utility: Delay function
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}