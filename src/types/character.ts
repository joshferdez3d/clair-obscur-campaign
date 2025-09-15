// src/types/character.ts - EXTENDED FOR PERSISTENCE

// Import InventoryItem from index to fix the missing type error
import type { InventoryItem } from './index';

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

// FIXED: Add CharacterCombatState import and interface here
  export interface CharacterCombatState {
    // Gustave state
    overchargePoints: number;
    activeTurretId: string | null;
    turretsDeployedThisBattle: number;
    
    // Lune state
    elementalStains: Array<'fire' | 'ice' | 'nature' | 'light'>;
    
    // Sciel state
    foretellStacks: Record<string, number>;
    foretellChainCharged: boolean;
    
    // Maelle state - ADD THESE MISSING PROPERTIES
    afterimageStacks: number;
    phantomStrikeAvailable: boolean;
    
    // Universal state
    bonusActionCooldown: number;
    hasActedThisTurn: boolean;
    lastCombatRound: number;
    lastCombatTurn: string;
    lastUpdated: Date;
    lastSyncedAt: Date;
  }
export interface CombatState {
  isActive: boolean;
  round: number;
  currentTurn: string;     // characterId whose turn it is
  lastUpdated: Date;
  lastSyncedAt: Date;
}

// Shape as stored in Firestore (Timestamps instead of Date)
export interface CombatStateDoc {
  isActive?: boolean;
  round?: number;
  currentTurn?: string;
  lastUpdated?: any;       // Firebase Timestamp
  lastSyncedAt?: any;      // Firebase Timestamp
}


// src/types/character.ts
export interface Character {
  id: string;
  name: string;
  role: string;
  stats: Stats;
  currentHP: number;
  maxHP: number;
  abilities: Ability[];
  
  // Character-specific mechanics (existing)
  stance?: Stance; // Maelle only
  charges?: number; // Basic charges system
  maxCharges?: number;

  // NEW: Persistent combat state - ADD THIS PROPERTY
  combatState?: CharacterCombatState;
  
  // Maelle's Afterimage system - ADD THESE PROPERTIES
  afterimageStacks?: number;
  maxAfterimageStacks?: number;
  phantomStrikeUsed?: boolean;
  
  // Character progression
  level: number;
  
  // Display
  portraitUrl?: string;
  backgroundColor?: string;
  
  // Inventory (existing)
  inventory?: InventoryItem[];
  gold: number;
}

// src/types/character.ts - Update the CharacterDoc interface
export interface CharacterDoc {
  name: string;
  role: string;
  stats: Stats;
  currentHP: number;
  maxHP: number;
  abilities: Ability[];
  stance?: Stance;
  charges?: number;
  maxCharges?: number;
  level: number;
  portraitUrl?: string;
  backgroundColor?: string;
  inventory?: InventoryItem[];
  gold?: number;
  
  // ADD: Add persistent combat state in Firebase
  combatState?: {
    overchargePoints: number;
    activeTurretId: string | null;
    turretsDeployedThisBattle: number;
    elementalStains: Array<'fire' | 'ice' | 'nature' | 'light'>;
    foretellStacks: Record<string, number>;
    foretellChainCharged: boolean;
    bonusActionCooldown: number;
    hasActedThisTurn: boolean;
    lastCombatRound: number;
    lastCombatTurn: string;
    lastUpdated: any; // Firebase Timestamp
    lastSyncedAt: any; // Firebase Timestamp
  };
  
  // ADD: Add Maelle afterimage state to CharacterDoc
  afterimageStacks?: number;
  maxAfterimageStacks?: number;
  phantomStrikeUsed?: boolean;
  
  createdAt: any;
  updatedAt: any;
}

// NEW: Helper functions for combat state management
  export const CombatStateHelpers = {
    createDefaultCombatState: (): CharacterCombatState => ({
      overchargePoints: 0,
      activeTurretId: null,
      turretsDeployedThisBattle: 0,
      elementalStains: [],
      foretellStacks: {},
      foretellChainCharged: false,
      
      // ADD MISSING MAELLE PROPERTIES
      afterimageStacks: 0,
      phantomStrikeAvailable: true,
      
      bonusActionCooldown: 0,
      hasActedThisTurn: false,
      lastCombatRound: 0,
      lastCombatTurn: '',
      lastUpdated: new Date(),
      lastSyncedAt: new Date()
    }),
    
    resetForNewBattle: (currentState: CharacterCombatState): CharacterCombatState => ({
      ...currentState,
      overchargePoints: 0,
      activeTurretId: null,
      turretsDeployedThisBattle: 0,
      elementalStains: [],
      foretellStacks: {},
      foretellChainCharged: false,
      
      // RESET MAELLE STATE
      afterimageStacks: 0,
      phantomStrikeAvailable: true,
      
      bonusActionCooldown: 0,
      hasActedThisTurn: false,
      lastCombatRound: 0,
      lastCombatTurn: '',
      lastUpdated: new Date()
    }),

    shouldResetCombatState: (
      combatState: CharacterCombatState,
      currentRound: number,
      currentTurn: string
    ): boolean => {
      return currentRound === 1 && currentTurn !== combatState.lastCombatTurn;
    }
  };

export default Character;