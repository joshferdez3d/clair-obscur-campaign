// src/services/enemyAIService.ts
import type { BattleToken, Position, EnemyData } from '../types';
import { ENEMY_TEMPLATES } from '../data/enemies';

export interface EnemyAction {
  enemyId: string;
  enemyName: string;
  type: 'move' | 'attack' | 'ability' | 'move_attack';
  movement?: {
    from: Position;
    to: Position;
    distance: number;
  };
  attack?: {
    type: 'melee' | 'ranged' | 'ability';
    targetId: string;
    targetName: string;
    attackName: string;
    toHit: number;
    damage: string;
    range: number;
    special?: string; // For special ability descriptions
  };
  description: string; // Human-readable description for GM
}

export interface EnemyTurnPlan {
  groupName: string;
  enemies: Array<{
    enemy: BattleToken;
    action: EnemyAction;
    priority: number; // Order within the group
  }>;
  totalActions: number;
}

export class EnemyAIService {
  // Calculate distance between two positions (in feet)
  static calculateDistance(from: Position, to: Position): number {
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    // Use Chebyshev distance (D&D 5e diagonal movement)
    return Math.max(dx, dy) * 5;
  }

  // Get all valid movement positions within range
  static getValidMovePositions(
    enemy: BattleToken,
    tokens: BattleToken[],
    maxMovement: number = 10 // 2 squares = 10 feet
  ): Position[] {
    const validPositions: Position[] = [];
    const maxSquares = maxMovement / 5; // Convert feet to squares

    for (let dx = -maxSquares; dx <= maxSquares; dx++) {
      for (let dy = -maxSquares; dy <= maxSquares; dy++) {
        if (dx === 0 && dy === 0) continue; // Skip current position
        
        const newPos: Position = {
          x: enemy.position.x + dx,
          y: enemy.position.y + dy
        };

        // Check if position is occupied
        const occupied = tokens.some(t => 
          t.id !== enemy.id && 
          t.position.x === newPos.x && 
          t.position.y === newPos.y &&
          (t.hp || 0) > 0
        );

        if (!occupied && 
            newPos.x >= 0 && newPos.x < 20 && // Assuming 20x15 grid
            newPos.y >= 0 && newPos.y < 15) {
          validPositions.push(newPos);
        }
      }
    }

    return validPositions;
  }

  // Find the best target for an enemy
  static findBestTarget(
    enemy: BattleToken,
    enemyData: EnemyData,
    potentialTargets: BattleToken[]
  ): BattleToken | null {
    if (potentialTargets.length === 0) return null;

    // Score each target based on various factors
    const scoredTargets = potentialTargets.map(target => {
      const distance = this.calculateDistance(enemy.position, target.position);
      let score = 0;

      // Prefer closer targets
      score += (100 - distance);

      // Prefer wounded targets
      const hpPercent = (target.hp || 0) / (target.maxHp || 1);
      score += (1 - hpPercent) * 30;

      // Prefer players over NPCs
      if (target.type === 'player') score += 20;

      // Specific enemy preferences
      if (enemyData.name === 'Lancelier') {
        // Lancelier prefers to keep distance for reach advantage
        if (distance === 10) score += 15;
      } else if (enemyData.name === 'Portier') {
        // Portier prefers to protect allies - target aggressive players
        if (target.type === 'player') score += 10;
      } else if (enemyData.name === 'Volester') {
        // Flying enemies prefer ranged attacks
        if (distance > 30) score += 10;
      }

      return { target, score, distance };
    });

    // Sort by score and return best target
    scoredTargets.sort((a, b) => b.score - a.score);
    return scoredTargets[0]?.target || null;
  }

  // Determine the best action for an enemy
  static determineEnemyAction(
    enemy: BattleToken,
    enemyData: EnemyData,
    allTokens: BattleToken[],
    combatRound: number
  ): EnemyAction {
    // Get potential targets (players and allied NPCs)
    const potentialTargets = allTokens.filter(t => 
      (t.type === 'player' || (t.type === 'npc' && !t.name.includes('Turret'))) && 
      (t.hp || 0) > 0
    );

    const target = this.findBestTarget(enemy, enemyData, potentialTargets);
    
    if (!target) {
      // No valid targets - just stay in position
      return {
        enemyId: enemy.id,
        enemyName: enemy.name,
        type: 'move',
        movement: {
          from: enemy.position,
          to: enemy.position,
          distance: 0
        },
        description: `${enemy.name} holds position (no valid targets).`
      };
    }

    const distance = this.calculateDistance(enemy.position, target.position);
    
    // Check if any attacks are in range
    const primaryAttack = enemyData.attacks[0];
    const specialAttack = enemyData.attacks.find(a => a.recharge);
    
    // Determine attack range
    const meleeReach = primaryAttack.reach || 5;
    const hasRangedAttack = primaryAttack.range !== undefined;
    const rangedDistance = hasRangedAttack ? parseInt(primaryAttack.range?.split('/')[0] || '0') : 0;

    // Check if special ability is available (simplified recharge)
    const specialAvailable = specialAttack && (combatRound % 3 === 0); // Recharge roughly every 3 rounds

    // Decision tree for enemy action
    let action: EnemyAction;

    // If within melee range and has melee attack
    if (distance <= meleeReach && !hasRangedAttack) {
      // Use special ability if available and appropriate
      if (specialAvailable && specialAttack) {
        action = this.createAttackAction(enemy, target, specialAttack, distance, true);
      } else {
        action = this.createAttackAction(enemy, target, primaryAttack, distance, false);
      }
    }
    // If has ranged attack and in range
    else if (hasRangedAttack && distance <= rangedDistance) {
      action = this.createAttackAction(enemy, target, primaryAttack, distance, false);
    }
    // Need to move closer
    else {
      // Calculate best movement position
      const validMoves = this.getValidMovePositions(enemy, allTokens, 10);
      
      // Find move that gets closest to target
      let bestMove = enemy.position;
      let bestDistance = distance;
      
      for (const pos of validMoves) {
        const newDistance = this.calculateDistance(pos, target.position);
        if (newDistance < bestDistance) {
          bestDistance = newDistance;
          bestMove = pos;
        }
      }

      // After moving, check if can attack
      const canAttackAfterMove = bestDistance <= meleeReach || 
                                 (hasRangedAttack && bestDistance <= rangedDistance);

      if (canAttackAfterMove) {
        // Move and attack
        action = {
          enemyId: enemy.id,
          enemyName: enemy.name,
          type: 'move_attack',
          movement: {
            from: enemy.position,
            to: bestMove,
            distance: this.calculateDistance(enemy.position, bestMove)
          },
          attack: {
            type: hasRangedAttack ? 'ranged' : 'melee',
            targetId: target.id,
            targetName: target.name,
            attackName: primaryAttack.name,
            toHit: primaryAttack.toHit,
            damage: primaryAttack.damage,
            range: bestDistance,
          },
          description: `${enemy.name} moves to (${bestMove.x}, ${bestMove.y}) and attacks ${target.name} with ${primaryAttack.name}.`
        };
      } else {
        // Just move closer
        action = {
          enemyId: enemy.id,
          enemyName: enemy.name,
          type: 'move',
          movement: {
            from: enemy.position,
            to: bestMove,
            distance: this.calculateDistance(enemy.position, bestMove)
          },
          description: `${enemy.name} moves to (${bestMove.x}, ${bestMove.y}), getting closer to ${target.name}.`
        };
      }
    }

    return action;
  }

  // Create attack action helper
  private static createAttackAction(
    enemy: BattleToken,
    target: BattleToken,
    attack: any,
    distance: number,
    isSpecial: boolean
  ): EnemyAction {
    return {
      enemyId: enemy.id,
      enemyName: enemy.name,
      type: isSpecial ? 'ability' : 'attack',
      attack: {
        type: attack.range ? 'ranged' : 'melee',
        targetId: target.id,
        targetName: target.name,
        attackName: attack.name,
        toHit: attack.toHit,
        damage: attack.damage,
        range: distance,
        special: attack.description
      },
      description: `${enemy.name} ${isSpecial ? 'uses' : 'attacks'} ${target.name} with ${attack.name}${distance > 5 ? ` from ${distance}ft` : ''}.`
    };
  }

  // Plan all actions for an enemy group
  static planEnemyGroupTurn(
    groupName: string,
    enemies: BattleToken[],
    allTokens: BattleToken[],
    enemyData: Record<string, EnemyData>,
    combatRound: number
  ): EnemyTurnPlan {
    const plan: EnemyTurnPlan = {
      groupName,
      enemies: [],
      totalActions: 0
    };

    // Sort enemies by HP (wounded act first - self-preservation)
    const sortedEnemies = [...enemies].sort((a, b) => 
      (a.hp || 0) / (a.maxHp || 1) - (b.hp || 0) / (b.maxHp || 1)
    );

    sortedEnemies.forEach((enemy, index) => {
      const data = enemyData[enemy.id];
      if (!data) return;

      const action = this.determineEnemyAction(enemy, data, allTokens, combatRound);
      
      plan.enemies.push({
        enemy,
        action,
        priority: index
      });
      
      plan.totalActions++;
    });

    return plan;
  }
}