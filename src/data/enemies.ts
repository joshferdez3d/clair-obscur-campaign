
import type { EnemyData } from '../types';

export const enemies: { [key: string]: EnemyData } = {
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
        damage: '1d10+4 slashing',
        description: 'Melee weapon attack with 10 ft reach'
      },
      {
        name: 'Stamping Shock',
        toHit: 0,
        range: '15ft cone',
        damage: '2d6 bludgeoning + slowed',
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
    traits: ['Cinder Aura: creatures starting within 5 ft take 1 fire damage'],
    attacks: [
      {
        name: 'Flame Lash',
        toHit: 5,
        reach: 10,
        damage: '2d6 fire',
        description: 'Ranged fire attack with 10 ft reach'
      },
      {
        name: 'Cinder Rain',
        toHit: 0,
        range: '10ft radius',
        damage: '2d6 fire',
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
        damage: '1d8+3 piercing',
        description: 'Melee weapon attack with 10 ft reach'
      },
      {
        name: 'Line Charge',
        toHit: 0,
        range: '20ft line',
        damage: '2d6+2 piercing + prone',
        description: 'Dex 13 save or take damage and be knocked prone; half damage on save',
        recharge: '5-6'
      }
    ],
    size: 1,
    color: '#708090'
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
      'Massive Hand: reach 15 ft',
      'Void Shroud: ranged attacks beyond 30 ft have disadvantage',
      'Hover: can fly and hover'
    ],
    attacks: [
      {
        name: 'Grasp of the Void',
        toHit: 7,
        reach: 15,
        damage: '3d8 necrotic + restrained',
        description: 'Melee spell attack, Con 14 save or be restrained'
      },
      {
        name: 'Oblivion Wave',
        toHit: 0,
        range: '20ft radius',
        damage: '4d6 force + pushed 10 ft',
        description: 'Dex 14 save or take damage and be pushed; half damage on save',
        recharge: '6'
      },
      {
        name: 'Dreadful Presence',
        toHit: 0,
        range: '20ft aura',
        damage: 'disadvantage on attacks',
        description: 'Creatures starting turn within 20 ft: Wis 13 save or disadvantage on next attack'
      }
    ],
    size: 2, // Large creature
    color: '#2E0854'
  },

  // Portier — Shield Bulwark
  'portier': {
    id: 'portier',
    name: 'Portier',
    ac: 17,
    hp: 45,
    maxHp: 45,
    speed: 20,
    saves: { con: 3 },
    resistances: [],
    vulnerabilities: ['cold', 'ice'],
    conditionImmunities: ['prone'],
    traits: [
      'Shield Wall: +2 AC to adjacent allies',
      'Core Weakpoint: Perception 14 to spot; hit deals +1d8'
    ],
    attacks: [
      {
        name: 'Shield Bash',
        toHit: 5,
        reach: 5,
        damage: '1d8+3 bludgeoning + pushed 5 ft',
        description: 'Con 13 save or be pushed 5 ft'
      },
      {
        name: 'Quake Slam',
        toHit: 0,
        range: '10ft radius',
        damage: '2d6+3 thunder + prone',
        description: 'Dex 13 save or take damage and be knocked prone; half damage on save',
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
        damage: '1d8+2 piercing',
        description: 'Ranged weapon attack'
      },
      {
        name: 'Screech Line',
        toHit: 0,
        range: '30ft line',
        damage: '2d6 thunder + deafened',
        description: 'Con 13 save or take damage and be deafened; half damage on save'
      }
    ],
    size: 1,
    color: '#9370DB'
  }
};
export const ENEMY_TEMPLATES = enemies;

// Enemy categories for organization
export const ENEMY_CATEGORIES = {
  'Basic Enemies': ['benisseur', 'bruler', 'lancelier'],
  'Support/Tank': ['portier'],
  'Flying/Scout': ['volester'],
  'Boss/Elite': ['noir_harbinger']
};

// Helper function to get enemy by ID
export function getEnemyTemplate(enemyId: string): EnemyData | null {
  return ENEMY_TEMPLATES[enemyId] || null;
}

// Helper function to get all enemy IDs in a category
export function getEnemiesInCategory(category: string): string[] {
  return ENEMY_CATEGORIES[category as keyof typeof ENEMY_CATEGORIES] || [];
}