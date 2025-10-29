// src/data/verso.ts
import type { Character } from '../types';

export const VERSO_CHARACTER: Character = {
  id: 'verso',
  name: 'Verso',
  role: 'Musical Guardian',
  level: 5,
  
  stats: {
    str: 12,
    dex: 16,
    con: 14,
    int: 13,
    wis: 15,
    cha: 18
  },
  
  currentHP: 38,
  maxHP: 38,
  
  charges: 3, // Perfect Pitch charges
  maxCharges: 3,
  
  portraitUrl: '/tokens/characters/verso.jpg', // You'll need to add this
  backgroundColor: '#8b5cf6', // Purple theme
  
  inventory: [],
  gold: 0,
  
  abilities: [
    {
      id: 'harmonic_strike',
      name: 'Harmonic Strike',
      description: 'Basic melee attack. On hit, generate a random musical note (1d7).',
      type: 'action',
      damage: '1d12 + 2 bludgeoning',
      range: '5 ft',
      effect: 'Generate 1 random note (auto-rolled)'
    },
    {
      id: 'harmonic_resonance',
      name: 'Harmonic Resonance',
      description: 'Consume your active notes to create powerful effects based on harmony type.',
      type: 'action',
      range: '30 ft',
      effect: 'Auto-detects harmony: Consonant (damage), Dissonant (damage+control), Supportive (damage+heal), Chaotic (AOE)'
    },
    {
      id: 'perfect_pitch',
      name: 'Perfect Pitch',
      description: 'Choose a specific note instead of rolling randomly.',
      type: 'bonus_action',
      effect: 'Choose any note (C, D, E, F, G, A, B). 3 charges per long rest.',
      costsCharges: 1
    },
    {
      id: 'modulation',
      name: 'Modulation',
      description: 'Change one of your notes to an adjacent note.',
      type: 'bonus_action',
      effect: 'Change note to adjacent (e.g., C→D or B→C). 3-turn cooldown.',
      cooldown: 3
    },
    {
      id: 'dissonant_purge',
      name: 'Dissonant Purge',
      description: 'Clear all your notes to deal minor AOE damage.',
      type: 'bonus_action',
      range: '15 ft radius',
      damage: '1d6 per note cleared',
      effect: 'Emergency clear when stuck'
    },
    {
      id: 'song_of_alicia',
      name: "Song of Alicia (Ultimate)",
      description: "Channel your sister's memory. Next Harmonic Resonance deals double damage.",
      type: 'action',
      effect: 'Usable once per battle. Lasts until next Harmonic Resonance.',
      range: 'Self'
    }
  ],
  
  combatState: {
    overchargePoints: 0,
    activeTurretId: null,
    turretsDeployedThisBattle: 0,
    elementalStains: [],
    chargedFateCard: null,
    afterimageStacks: 0,
    phantomStrikeAvailable: false,
    bonusActionCooldown: 0,
    hasActedThisTurn: false,
    lastCombatRound: 0,
    lastCombatTurn: '',
    lastUpdated: new Date(),
    lastSyncedAt: new Date()
  }
};