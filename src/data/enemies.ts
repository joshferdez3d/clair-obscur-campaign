// src/data/enemies.ts

import type { EnemyData } from '../types';

export const enemies: { [key: string]: EnemyData } = {
  // Demineur — Spore Construct (Basic Enemy)
  'demineur': {
    id: 'demineur',
    name: 'Demineur',
    ac: 12,
    hp: 15,
    maxHp: 15,
    speed: 25,
    saves: { con: 2 },
    resistances: ['fire', 'poison'],
    vulnerabilities: ['radiant'],
    conditionImmunities: ['poisoned'],
    traits: [
      'Born of Smoke: Explodes when slain (2d6 poison, 10ft radius)'
    ],
    attacks: [
      {
        name: 'Claw Swipe',
        toHit: 4,
        reach: 5,
        damage: '5',
        description: 'Melee weapon attack'
      }
    ],
    deathBurst: {
      name: 'Smoke Burst',
      radius: 10,
      damage: '7',
      save: 'Con',
      saveDC: 12,
      description: 'On death, explodes in 10ft radius. Con save DC 12 or take 2d6 poison damage (half on save)'
    },
    size: 1,
    color: '#7B68EE' // Purple-ish for spore/fungal creature
  },

  // Sentinel Luster — Crystal Guardian (Mini-Boss)
  'sentinel_luster': {
    id: 'sentinel_luster',
    name: 'Sentinel Luster',
    ac: 15,
    hp: 65,
    maxHp: 65,
    speed: 20,
    saves: { con: 4, str: 3 },
    resistances: ['nonmagical bludgeoning', 'nonmagical piercing', 'nonmagical slashing', 'earth'],
    vulnerabilities: ['thunder'],
    conditionImmunities: ['prone'],
    traits: [
      'Stationary Sentinel: Disadvantage on Dex saves, advantage on Con saves'
    ],
    attacks: [
      {
        name: 'Crystal Bolt',
        toHit: 6,
        range: '60 ft',
        damage: '8',
        description: 'Ranged attack, crystalline projectile'
      },
      {
        name: 'Rock Spike',
        toHit: 0,
        range: '20ft line',
        damage: '12',
        description: 'Dex save DC 14 or take damage; half on save',
        recharge: '5-6'
      },
      {
        name: 'Entangling Coral',
        toHit: 0,
        range: '15ft radius',
        damage: 'Restrained',
        description: 'Creates difficult terrain, Str save DC 14 or restrained',
        recharge: '6'
      }
    ],
    size: 1,
    color: '#4169E1' // Royal blue for crystal/luster theme
  },

  // Bénisseur — Burly Glaivebearer
  'benisseur': {
    id: 'benisseur',
    name: 'Bénisseur',
    ac: 13,
    hp: 38,
    maxHp: 38,
    speed: 30,
    saves: { str: 4 },
    resistances: ['nature', 'radiant'],
    vulnerabilities: ['cold', 'ice', 'necrotic'],
    conditionImmunities: [],
    traits: ['Summon Spear: bonus, +1d4 dmg for rest of battle once activated'],
    attacks: [
      {
        name: 'Glaive Sweep',
        toHit: 6,
        reach: 10,
        damage: '3',
        description: 'Melee weapon attack with 10 ft reach'
      },
      {
        name: 'Stamping Shock',
        toHit: 0,
        range: '15ft cone',
        damage: '5',
        description: 'Dex 13 save or take damage and be slowed; half damage on save'
      },
      {
        name: 'Harsh Benediction',
        toHit: 0,
        range: 'ally',
        damage: '10 HP healing',
        description: '1/encounter: heal ally 10 HP & give advantage on next attack',
        recharge: '1/encounter'
      }
    ],
    size: 1,
    color: '#8B4513'
  },

  // Brûler — Pyre Caster
  'bruler': {
    id: 'bruler',
    name: 'Brûler',
    ac: 13,
    hp: 30,
    maxHp: 30,
    speed: 25,
    saves: { con: 3 },
    resistances: ['fire'],
    vulnerabilities: ['lightning'],
    conditionImmunities: [],
    traits: ['Cinder Aura: creatures starting within 5 ft take 5 fire damage'],
    attacks: [
      {
        name: 'Flame Lash',
        toHit: 5,
        reach: 10,
        damage: '6',
        description: 'Ranged fire attack with 10 ft reach'
      },
      {
        name: 'Cinder Rain',
        toHit: 0,
        range: '10ft radius',
        damage: '6',
        description: 'Creates burning zone, Dex 13 save or take damage; half on save',
        recharge: '5-6'
      }
    ],
    size: 1,
    color: '#FF4500'
  },

  // Lancelier — Spear Skirmisher
  'lancelier': {
    id: 'lancelier',
    name: 'Lancelier',
    ac: 14,
    hp: 32,
    maxHp: 32,
    speed: 30,
    saves: { str: 3, con: 2 },
    resistances: [],
    vulnerabilities: ['cold', 'ice'],
    conditionImmunities: [],
    traits: [
      'Reach 10 ft',
      'Head Weakpoint: Perception 13 to spot; first hit that turn deals +2d6'
    ],
    attacks: [
      {
        name: 'Spear Lunge',
        toHit: 6,
        reach: 10,
        damage: '5',
        description: 'Melee weapon attack with 10 ft reach'
      },
      {
        name: 'Line Charge',
        toHit: 0,
        range: '20ft line',
        damage: '7',
        description: 'Dex 13 save or take damage and be knocked prone; half damage on save',
        recharge: '5-6'
      }
    ],
    size: 1,
    color: '#708090'
  },

  // Portier — Shield Bearer
  'portier': {
    id: 'portier',
    name: 'Portier',
    ac: 16,
    hp: 45,
    maxHp: 45,
    speed: 25,
    saves: { con: 4 },
    resistances: ['nature'],
    vulnerabilities: ['cold', 'ice'],
    conditionImmunities: [],
    traits: ['Shield Raise: can grant cover to adjacent allies'],
    attacks: [
      {
        name: 'Shield Bash',
        toHit: 5,
        reach: 5,
        damage: '5',
        description: 'Melee weapon attack, can push 5 ft'
      },
      {
        name: 'Rally',
        toHit: 0,
        range: '30ft',
        damage: 'Remove debuff',
        description: 'Remove one debuff from ally',
        recharge: '5-6'
      }
    ],
    size: 1,
    color: '#4682B4'
  },

  // Volester — Flying Scout
  'volester': {
    id: 'volester',
    name: 'Volester',
    ac: 15,
    hp: 22,
    maxHp: 22,
    speed: 40, // Flying speed
    saves: { dex: 4 },
    resistances: ['nonmagical melee'],
    vulnerabilities: ['cold', 'ice'],
    conditionImmunities: ['grappled'],
    traits: [
      'Hover: can fly and hover',
      'Head Weakpoint: Perception 13 to spot; ranged hit deals +2d6'
    ],
    attacks: [
      {
        name: 'Dive Bolt',
        toHit: 5,
        range: '80/240 ft',
        damage: '5',
        description: 'Ranged weapon attack'
      },
      {
        name: 'Screech Line',
        toHit: 0,
        range: '30ft line',
        damage: '6',
        description: 'Con 13 save or take damage and be deafened; half damage on save'
      }
    ],
    size: 1,
    color: '#9370DB'
  },

  // Noir Harbinger — Cataclysmic Shade (BOSS)
  'noir_harbinger': {
    id: 'noir_harbinger',
    name: 'Noir Harbinger',
    ac: 16,
    hp: 90,
    maxHp: 90,
    speed: 30,
    saves: { dex: 5, con: 4 },
    resistances: ['nonmagical bludgeoning', 'nonmagical piercing', 'nonmagical slashing', 'fire', 'cold', 'lightning', 'nature'],
    vulnerabilities: ['radiant'],
    conditionImmunities: ['charmed', 'frightened'],
    traits: [
      'Mythical Resistance: 3 legendary resistances per encounter',
      'Shadow Step: bonus action teleport 30 ft'
    ],
    attacks: [
      {
        name: 'Shadow Blade',
        toHit: 8,
        reach: 10,
        damage: '10',
        description: 'Melee weapon attack that drains life'
      },
      {
        name: 'Umbral Wave',
        toHit: 0,
        range: '30ft cone',
        damage: '9',
        description: 'Con 15 save or take damage and be blinded for 1 turn',
        recharge: '5-6'
      },
      {
        name: 'Dark Calling',
        toHit: 0,
        range: 'battlefield',
        damage: 'summon shadows',
        description: 'Summons 2 shadow minions',
        recharge: '1/encounter'
      }
    ],
    size: 1,
    color: '#2F003F'
  },
  'lampmaster': {
    id: 'lampmaster',
    name: 'Lampmaster',
    ac: 17, // 15 when lamps destroyed
    hp: 200,
    maxHp: 200,
    speed: 30,
    saves: { dex: 4, wis: 5 },
    resistances: ['radiant'],
    vulnerabilities: [],
    conditionImmunities: [],
    traits: [
      'Lamp Array: 4 floating lamps grant Light Shot ability. Destroying lamps reduces attacks.',
      'Sword of Light: Devastating ultimate if lamp ritual not disrupted.',
      'Lamp Ritual (Memory Minigame): Lamps glow in sequence. PCs must repeat sequence to cancel Sword of Light.'
    ],
    attacks: [
      {
        name: 'Light Shot',
        toHit: 6,
        range: '60',
        damage: '2d8 radiant',
        description: 'Telegraph: lamp glows before firing. Requires active lamps.'
      },
      {
        name: 'Arm Combo',
        toHit: 6,
        reach: 5,
        damage: '1d10+3 slashing',
        description: '3 melee strikes in succession'
      },
      {
        name: 'Jump Attack',
        toHit: 0,
        range: '15ft radius',
        damage: '3d8+2 bludgeoning',
        description: 'Dex save DC 14 or take damage & knocked prone',
        recharge: '5-6'
      },
      {
        name: 'Dark Explosion',
        toHit: 0,
        range: '20ft radius',
        damage: '2d8 necrotic',
        description: 'AoE blast. Con save DC 13 or blinded until end of next turn',
        recharge: '4-6'
      },
      {
        name: 'Sword of Light',
        toHit: 999, // Auto-hit ultimate
        range: 'battlefield',
        damage: '4d10+5 radiant',
        description: 'Ultimate: Wide slash. Damage reduced/canceled if lamp sequence solved.'
      }
    ],
    size: 2, // Boss size
    color: '#FFD700', // Gold color for the Lampmaster
  }
};

export const ENEMY_TEMPLATES = enemies;

// Enemy categories for organization
export const ENEMY_CATEGORIES = {
  'Basic Enemies': ['demineur', 'benisseur', 'bruler', 'lancelier'],
  'Mini-Boss': ['sentinel_luster'],
  'Support/Tank': ['portier'],
  'Flying/Scout': ['volester'],
  'Boss/Elite': ['noir_harbinger', 'lampmaster']
};

// Helper function to get enemy by ID
export function getEnemyTemplate(enemyId: string): EnemyData | null {
  return ENEMY_TEMPLATES[enemyId] || null;
}

// Helper function to get all enemy IDs in a category
export function getEnemiesInCategory(category: string): string[] {
  return ENEMY_CATEGORIES[category as keyof typeof ENEMY_CATEGORIES] || [];
}

// Helper function to create enemy token from template
export function createEnemyToken(enemyId: string, position: { x: number; y: number }): any {
  const template = getEnemyTemplate(enemyId);
  if (!template) return null;

  const tokenId = `enemy-${enemyId}-${Date.now()}`;
  
  return {
    id: tokenId,
    name: template.name,
    position,
    type: 'enemy',
    hp: template.hp,
    maxHp: template.maxHp,
    ac: template.ac,
    size: template.size || 1,
    speed: template.speed,
    color: template.color || '#DC143C',
    statusEffects: {}
  };
}