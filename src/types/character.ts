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

export interface CharacterCombatState {
  // Gustave state
  overchargePoints: number;
  activeTurretId: string | null;
  turretsDeployedThisBattle: number;
  
  // Lune state
  elementalStains: Array<'fire' | 'ice' | 'nature' | 'light'>;
  
  // Sciel state - UPDATED: Remove old foretell properties, add new fate card system
  chargedFateCard: 'explosive' | 'switch' | 'vanish' | null;
  
  // Maelle state
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
    chargedFateCard: 'explosive' | 'switch' | 'vanish' | null;
    afterimageStacks: number;
    phantomStrikeAvailable: boolean;
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
export class CombatStateHelpers {
  static createDefaultCombatState(): CharacterCombatState {
    return {
      // Gustave defaults
      overchargePoints: 0,
      activeTurretId: null,
      turretsDeployedThisBattle: 0,
      
      // Lune defaults
      elementalStains: [],
      
      // Sciel defaults - UPDATED: Remove foretell, add fate card
      chargedFateCard: null,
      
      // Maelle defaults
      afterimageStacks: 0,
      phantomStrikeAvailable: true,
      
      // Universal defaults
      bonusActionCooldown: 0,
      hasActedThisTurn: false,
      lastCombatRound: 0,
      lastCombatTurn: '',
      lastUpdated: new Date(),
      lastSyncedAt: new Date(),
    };
  }

  static resetForNewBattle(currentState: CharacterCombatState): CharacterCombatState {
    return {
      ...currentState,
      // Reset combat-specific state but preserve progression
      overchargePoints: 0,
      activeTurretId: null,
      turretsDeployedThisBattle: 0,
      elementalStains: [],
      chargedFateCard: null, // UPDATED: Reset fate card instead of foretell
      afterimageStacks: 0,
      phantomStrikeAvailable: true,
      bonusActionCooldown: 0,
      hasActedThisTurn: false,
      lastCombatRound: 0,
      lastCombatTurn: '',
      lastUpdated: new Date(),
    };
  }

  // ADD this missing method that was referenced:
  static resetForNewCombat(currentState: CharacterCombatState): CharacterCombatState {
    // Alias for resetForNewBattle to maintain compatibility
    return this.resetForNewBattle(currentState);
  }

  static shouldResetCombatState(
    combatState: CharacterCombatState, 
    currentRound: number, 
    currentTurn: string
  ): boolean {
    return combatState.lastCombatRound !== currentRound || 
           combatState.lastCombatTurn !== currentTurn;
  }
}

export default Character;