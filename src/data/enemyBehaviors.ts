// src/data/enemyBehaviors.ts
import type { Position } from '../types';

export type AggressionLevel = 'passive' | 'defensive' | 'aggressive' | 'berserk';
export type TargetPriority = 'lowest-hp' | 'nearest' | 'highest-threat' | 'random' | 'weakest-ac';
export type MovementPattern = 'direct' | 'flanking' | 'kiting' | 'defensive' | 'surround';
export type AttackPreference = 'melee' | 'ranged' | 'mixed' | 'abilities-first';

export interface EnemyBehavior {
  id: string;
  aggressiveness: AggressionLevel;
  targetPriority: TargetPriority;
  movementPattern: MovementPattern;
  attackPreference: AttackPreference;
  preferredRange: number; // in feet
  retreatThreshold: number; // HP percentage to start retreating
  abilityUsage: {
    preferAbilities: boolean;
    saveAbilitiesUntilHurt: boolean;
    abilityPriority: string[]; // ordered list of ability names
  };
  specialBehaviors: string[];
  smartness: number; // 0-1, affects decision quality
}

/**
 * Behavior profiles for different enemy types
 * These determine how enemies act in combat
 */
export const ENEMY_BEHAVIORS: Record<string, EnemyBehavior> = {
  // Basic melee attacker - charges straight at nearest enemy
  'goblin': {
    id: 'goblin',
    aggressiveness: 'aggressive',
    targetPriority: 'lowest-hp',
    movementPattern: 'direct',
    attackPreference: 'melee',
    preferredRange: 5,
    retreatThreshold: 0.2,
    abilityUsage: {
      preferAbilities: false,
      saveAbilitiesUntilHurt: false,
      abilityPriority: ['Goblin Slash']
    },
    specialBehaviors: ['mob-tactics'], // Gets braver with more goblins
    smartness: 0.4
  },

  // Tactical spear user - uses reach advantage
  'lancelier': {
    id: 'lancelier',
    aggressiveness: 'defensive',
    targetPriority: 'nearest',
    movementPattern: 'defensive',
    attackPreference: 'mixed',
    preferredRange: 10, // Has reach weapon
    retreatThreshold: 0.3,
    abilityUsage: {
      preferAbilities: true,
      saveAbilitiesUntilHurt: false,
      abilityPriority: ['Line Charge', 'Spear Lunge']
    },
    specialBehaviors: ['maintain-reach', 'zone-control'],
    smartness: 0.7
  },

  // Fire elemental - prefers ranged attacks
  'flammeche': {
    id: 'flammeche',
    aggressiveness: 'aggressive',
    targetPriority: 'random',
    movementPattern: 'kiting',
    attackPreference: 'ranged',
    preferredRange: 20,
    retreatThreshold: 0.4,
    abilityUsage: {
      preferAbilities: true,
      saveAbilitiesUntilHurt: false,
      abilityPriority: ['Cinder Rain', 'Fire Blast']
    },
    specialBehaviors: ['avoid-melee', 'area-denial'],
    smartness: 0.6
  },

  // Support/healer type
  'centurion': {
    id: 'centurion',
    aggressiveness: 'defensive',
    targetPriority: 'highest-threat',
    movementPattern: 'defensive',
    attackPreference: 'mixed',
    preferredRange: 10,
    retreatThreshold: 0.5,
    abilityUsage: {
      preferAbilities: true,
      saveAbilitiesUntilHurt: false,
      abilityPriority: ['Harsh Benediction', 'Stamping Shock', 'Glaive Sweep']
    },
    specialBehaviors: ['heal-allies', 'protect-weakest'],
    smartness: 0.8
  },

  // Boss - complex behavior
  'noir_harbinger': {
    id: 'noir_harbinger',
    aggressiveness: 'berserk',
    targetPriority: 'highest-threat',
    movementPattern: 'flanking',
    attackPreference: 'abilities-first',
    preferredRange: 15,
    retreatThreshold: 0,
    abilityUsage: {
      preferAbilities: true,
      saveAbilitiesUntilHurt: false,
      abilityPriority: ['Oblivion Wave', 'Grasp of the Void', 'Dreadful Presence']
    },
    specialBehaviors: ['phase-change', 'summon-minions', 'aoe-preference'],
    smartness: 0.95
  },

  // Default behavior for unknown enemies
  'default': {
    id: 'default',
    aggressiveness: 'defensive',
    targetPriority: 'nearest',
    movementPattern: 'direct',
    attackPreference: 'melee',
    preferredRange: 5,
    retreatThreshold: 0.3,
    abilityUsage: {
      preferAbilities: false,
      saveAbilitiesUntilHurt: false,
      abilityPriority: []
    },
    specialBehaviors: [],
    smartness: 0.5
  }
};

/**
 * Get behavior for an enemy based on its name/type
 */
export function getEnemyBehavior(enemyName: string): EnemyBehavior {
  const lowerName = enemyName.toLowerCase();
  
  // Check each behavior key
  for (const [key, behavior] of Object.entries(ENEMY_BEHAVIORS)) {
    if (lowerName.includes(key)) {
      return behavior;
    }
  }
  
  // Return default if no match
  return ENEMY_BEHAVIORS.default;
}

/**
 * Special behavior handlers
 */
export const SPECIAL_BEHAVIORS = {
  'mob-tactics': (allyCount: number) => {
    // Goblins get braver with more allies
    return { aggressionBonus: allyCount * 0.1 };
  },
  
  'maintain-reach': () => {
    // Try to stay at optimal reach distance
    return { preferredDistance: 10 };
  },
  
  'zone-control': () => {
    // Block player movement paths
    return { blockPaths: true };
  },
  
  'avoid-melee': () => {
    // Stay away from melee range
    return { minDistance: 10 };
  },
  
  'area-denial': () => {
    // Prefer AoE abilities to control space
    return { preferAoE: true };
  },
  
  'heal-allies': (allies: any[]) => {
    // Prioritize healing hurt allies
    const hurtAllies = allies.filter(a => a.hp < a.maxHp * 0.5);
    return { shouldHeal: hurtAllies.length > 0 };
  },
  
  'protect-weakest': (allies: any[]) => {
    // Move to protect low HP allies
    const weakest = allies.sort((a, b) => a.hp - b.hp)[0];
    return { protectTarget: weakest };
  },
  
  'phase-change': (self: any) => {
    // Change behavior at HP thresholds
    if (self.hp < self.maxHp * 0.5) {
      return { aggressiveness: 'berserk' };
    }
    return {};
  },
  
  'summon-minions': (self: any) => {
    // Summon helpers when hurt
    if (self.hp < self.maxHp * 0.6) {
      return { shouldSummon: true };
    }
    return {};
  },
  
  'aoe-preference': () => {
    // Prefer abilities that hit multiple targets
    return { preferAoE: true };
  }
};