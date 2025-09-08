export interface Stats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface Ability {
  id: string;
  name: string;
  description: string;
  type: 'action' | 'bonus_action' | 'reaction' | 'passive';
  damage?: string;
  effect?: string;
  range?: string;
  cooldown?: number;
  costsCharges?: number;
}

export type Stance = 'offensive' | 'defensive' | 'agile';

export interface Character {
  id: string;
  name: string;
  role: string;
  stats: Stats;
  currentHP: number;
  maxHP: number;
  abilities: Ability[];
  
  // Character-specific mechanics
  stance?: Stance; // Maelle only
  charges?: number; // Gustave: Overload, Lune: Stains, Sciel: Foretell
  maxCharges?: number;

  // NEW: Maelle's Afterimage system
  afterimageStacks?: number; // 0-5 (max 7 at higher levels)
  maxAfterimageStacks?: number; // Default 5, increases to 7 at level 7
  phantomStrikeUsed?: boolean; // Track ultimate usage per long rest
  
  // Character progression
  level: number;
  
  // Display
  portraitUrl?: string;
  backgroundColor?: string;
}

// NEW: Extended interface specifically for Maelle's combat state
export interface MaelleCombatState {
  afterimageStacks: number;
  maxAfterimageStacks: number;
  phantomStrikeAvailable: boolean;
  temporalEchoAvailable?: boolean; // Level 7+ ability
  phaseDashAvailable?: boolean; // Level 5+ ability
}

// NEW: Afterimage stack manipulation functions
export const AfterimageHelpers = {
  // Add stacks, respecting maximum
  addStacks: (current: number, toAdd: number, max: number = 5): number => {
    return Math.min(max, current + toAdd);
  },
  
  // Remove stacks, minimum 0
  removeStacks: (current: number, toRemove: number): number => {
    return Math.max(0, current - toRemove);
  },
  
  // Check if ability can be used
  canUseAbility: (stacksRequired: number, currentStacks: number): boolean => {
    return currentStacks >= stacksRequired;
  },
  
  // Check if Phantom Strike is available
  canUsePhantomStrike: (currentStacks: number, isAvailable: boolean): boolean => {
    return currentStacks >= 3 && isAvailable;
  }
};

// Update the existing character data to include Maelle's new system
export const updateMaelleCharacter = (character: Character): Character => {
  if (character.name.toLowerCase() === 'maelle') {
    return {
      ...character,
      role: 'Phantom Blade Duelist',
      afterimageStacks: 0,
      maxAfterimageStacks: character.level >= 7 ? 7 : 5,
      phantomStrikeUsed: false,
      // Remove old stance system
      stance: undefined,
      abilities: [
        {
          id: 'phantom_thrust',
          name: 'Phantom Thrust',
          description: 'Rapier attack that builds Afterimage stacks',
          type: 'action',
          damage: '1d8 + DEX piercing'
        },
        {
          id: 'spectral_feint',
          name: 'Spectral Feint',
          description: 'Mark target with disadvantage (Bonus Action)',
          type: 'bonus_action',
          damage: 'Mark target',
          costsCharges: 1
        },
        {
          id: 'blade_flurry',
          name: 'Blade Flurry',
          description: '3 attacks with escalating damage',
          type: 'action',
          damage: '3 attacks, +1d4 per hit after 1st',
          costsCharges: 2
        },
        {
          id: 'mirror_step',
          name: 'Mirror Step',
          description: 'Teleport to avoid attack (Reaction)',
          type: 'reaction',
          damage: 'Avoid attack + 15ft teleport',
          costsCharges: 1
        },
        {
          id: 'crescendo_strike',
          name: 'Crescendo Strike',
          description: 'Consume all stacks for massive damage',
          type: 'action',
          damage: '+1d6 per stack consumed',
          costsCharges: 99 // Special handling - costs all stacks
        },
        {
          id: 'phantom_strike',
          name: 'Phantom Strike',
          description: 'Ultimate: Teleport between all enemies',
          type: 'action',
          damage: '2d6 + DEX per enemy, scaling',
          costsCharges: 3 // Minimum requirement
        }
      ]
    };
  }
  return character;
};
