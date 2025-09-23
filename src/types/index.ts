// src/types/index.ts - Complete and corrected type definitions
export * from './character';
import type { Character } from './character'; // Add this explicit import

// Basic interfaces
export interface Position {
  x: number;
  y: number;
}

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

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  addedBy: string; // GM who added the item
  addedAt: Date;
}
export type Stance = 'offensive' | 'defensive' | 'agile';

// Enhanced BattleToken interface to include AC
export interface BattleToken {
  id: string;
  characterId?: string;
  name: string;
  position: Position;
  type: 'player' | 'enemy' | 'npc';
  hp?: number;
  maxHp?: number;
  size?: number;
  speed?: number; // Add this line
  color?: string;
  ac?: number; // Make sure this exists for enemy tokens
  statusEffects?: {
    fire?: {
      turnsRemaining: number;
      damage: number;
      appliedOnRound: number;
    };
    ice?: {
      turnsRemaining: number;
      appliedOnRound: number;
    };
    blind?: {
      turnsRemaining: number;
      appliedOnRound: number;
    };
    // NEW: Add these two properties for Sciel's abilities
    advantage?: {
      turnsRemaining: number;
      source: string; // Who granted the advantage (e.g., "Sciel")
      appliedBy: string; // Ability name (e.g., "Glimpse Future")
      appliedOnRound: number;
    };
    disadvantage?: {
      turnsRemaining: number;
      source: string; // Who applied the disadvantage (e.g., "Sciel")
      appliedBy: string; // Ability name (e.g., "Rewrite Destiny")
      appliedOnRound: number;
    };
  };
}

export interface BattleMapPreset {
  id: string;
  name: string;
  description?: string;
  mapId: string; // References the map this preset is for
  tokens: Record<string, BattleToken>; // Snapshot of token positions
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // GM who created the preset
}

export interface PresetSaveData {
  name: string;
  description?: string;
  mapId: string;
  tokens: Record<string, BattleToken>;
}

// Enhanced enemy data interface
export interface EnemyData {
  id: string;
  name: string;
  ac: number;
  hp: number;
  maxHp: number;
  speed: number;
  saves: { [key: string]: number };
  resistances: string[];
  vulnerabilities: string[];
  conditionImmunities: string[];
  traits: string[];
  attacks: Array<{
    name: string;
    toHit: number;
    reach?: number;
    range?: string;
    damage: string;
    description?: string;
    recharge?: string;
  }>;
  deathBurst?: {
    name: string;
    radius: number;
    damage: string;
    save: 'Str' | 'Dex' | 'Con' | 'Int' | 'Wis' | 'Cha';
    saveDC: number;
    description: string;
  };
  size?: number;
  color?: string;
}

export interface EnemyCategory {
  name: string;
  description: string;
  enemies: string[];
}

export interface EnemyTemplate extends EnemyData {
  category: string;
  difficulty: 'Basic' | 'Tough' | 'Elite' | 'Boss';
}

// Combat targeting interface
export interface CombatTargeting {
  active: boolean;
  abilityId?: string;
  range?: number;
  validTargets?: string[];
  sourcePosition?: Position;
}

export interface EnemyTargetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  enemies: Array<{
    id: string;
    name: string;
    position: { x: number; y: number };
    hp: number;
    maxHp: number;
    ac: number;
  }>;
  playerPosition: { x: number; y: number };
  sessionId: string;
  playerId: string;
  onSelectEnemy: (enemy: {
    id: string;
    name: string;
    position: { x: number; y: number };
    hp: number;
    maxHp: number;
    ac: number;
  }) => void;
  selectedEnemyId: string;
  abilityName?: string;
  abilityRange: number;
  actionConfirmSection?: React.ReactNode; // ADD THIS PROPERTY
}

// Base combat action interface
export interface CombatAction {
  id: string;
  type: 'move' | 'attack' | 'ability' | 'end_turn' | 'turret_placement'; // ADD turret_placement here
  playerId: string;
  targetId?: string;
  targetPosition?: Position;
  sourcePosition: Position;
  acRoll?: number;
  damageRoll?: number;
  range: number;
  timestamp: Date;
  resolved: boolean;
  hit?: boolean; // NEW: Whether the attack hit
  damage?: number; // NEW: Actual damage dealt
  // NEW: GM popup properties
  playerName?: string;
  targetName?: string;
  abilityName?: string;
  needsDamageInput?: boolean;
  damageApplied?: boolean;
}

// Enhanced GM combat action interface for ultimate actions
export interface GMCombatAction extends CombatAction {
  // Override type to be more specific
  type: 'attack' | 'ability' | 'turret_placement';

  // Legacy single-target
  targetId?: string;
  targetName?: string;

  // AoE support
  targetIds?: string[];
  targetNames?: string[];

  // General action properties
  playerName?: string;
  abilityName?: string;
  hit?: boolean;
  needsDamageInput?: boolean;
  damageApplied?: boolean;

  // ENHANCED: Sciel's card system (updated to support new abilities)
  cardType?: 'explosive' | 'switch' | 'vanish';
  cardName?: string;
  primaryTargetId?: string;
  explosionCenter?: { x: number; y: number };
  description?: string;

  // NEW: Sciel's buff/debuff abilities
  abilityType?: 'rewrite_destiny' | 'glimpse_future' | 'fates_gambit';
  buffType?: 'advantage' | 'disadvantage';
  duration?: number; // For tracking how long buffs/debuffs last
  
  // NEW: Switch card data
  switchData?: {
    playerId: string;
    playerPosition: { x: number; y: number };
    targetPosition: { x: number; y: number };
  };
  
  // NEW: Vanish card data
  vanishData?: {
    targetId: string;
    targetName: string;
    returnsOnRound: number; // Which round the enemy returns
  };

  // Ultimate-specific properties (keep existing)
  ultimateType?: string;
  element?: 'fire' | 'ice' | 'nature' | 'light';
  effectName?: string;
  needsGMInteraction?: boolean;

  // Element-specific data (keep existing)
  healingTargets?: Array<{
    id: string;
    name: string;
    currentHP: number;
    maxHP: number;
    position: { x: number; y: number };
  }>;
  
  affectedSquares?: Array<{ x: number; y: number }>;
  affectedTokens?: string[];
  
  // Fire terrain (keep existing)
  terrainCenter?: { x: number; y: number };
  
  // Ice wall (keep existing)
  wallType?: 'row' | 'column';
  wallIndex?: number;
  wallSquares?: Array<{ x: number; y: number }>;
  
  // Light blind (keep existing)
  blindedSquares?: Array<{ x: number; y: number }>;

  // Turret placement data (keep existing)
  turretData?: {
    name: string;
    hp: number;
    maxHp: number;
    type: 'npc';
    color: string;
    size: number;
  };

  // Protection data (keep existing)
  protectionData?: {
    protectorName: string;
    activatedOnRound: number;
    duration: number;
    remainingRounds: number;
    protectedAlly: string;
    description: string;
  };
}

// NEW: Interface for tracking active buffs/debuffs in battle session
export interface ActiveBuff {
  id: string;
  type: 'advantage' | 'disadvantage';
  targetId: string; // Player or enemy ID
  targetName: string;
  sourcePlayer: string; // Who applied the buff/debuff
  appliedOnRound: number;
  duration: number; // How many turns it lasts
  turnsRemaining: number;
  createdAt: number;
}

// NEW: Interface for vanished enemies
export interface VanishedEnemy {
  id: string;
  enemyData: BattleToken; // Full token data to restore
  vanishedOnRound: number;
  returnsOnRound: number;
  vanishedBy: string; // Player who vanished them
}

// Fire terrain zone data
export interface FireTerrainZone {
  id: string;
  center: { x: number; y: number };
  radius: number;
  affectedSquares: Array<{ x: number; y: number }>;
  damagePerTurn: number;
  duration: number; // Total duration
  turnsRemaining: number; // Remaining turns
  createdBy: string;
  createdAt: number;
  createdOnRound: number; // Round when created
}

// Ice wall data
export interface IceWall {
  id: string;
  type: 'row' | 'column';
  index: number;
  squares: Array<{ x: number; y: number }>;
  duration: number; // Total duration
  turnsRemaining: number; // Remaining turns
  createdBy: string;
  createdAt: number;
  createdOnRound: number; // Round when created
}

// Light blind effect data
export interface LightBlindEffect {
  id: string;
  affectedSquares: Array<{ x: number; y: number }>;
  duration: number; // Total duration
  turnsRemaining: number; // Remaining turns
  createdBy: string;
  createdAt: number;
  createdOnRound: number; // Round when created
}


export interface BattleMap {
  id: string;
  name?: string;
  backgroundImage?: string;
  gridSize: { width: number; height: number };
  gridVisible?: boolean;
}

// Combat system types
export interface CombatState {
  isActive: boolean;
  currentTurn: string;
  turnOrder: string[];
  round: number;
  phase: 'setup' | 'combat' | 'ended';
  initiativeOrder: InitiativeEntry[];
}

export interface InitiativeEntry {
  id: string;
  name: string;
  initiative: number;
  type: 'player' | 'enemy';
  characterId?: string;
  hasActed: boolean;
}

export interface BattleState {
  isActive: boolean;
  currentTurn?: string;
  turnOrder: string[];
  round: number;
  mapId: string;
}

export interface BattleSession {
  id: string;
  name: string;
  characters: string[];
  battleState: BattleState;
  tokens: { [tokenId: string]: BattleToken };
  mapId: string;
  currentMap?: MapConfig
  createdAt: Date;
  updatedAt: Date;
  // Enhanced combat fields
  combatState?: CombatState;
  pendingActions?: GMCombatAction[]; // Updated to use GMCombatAction
  enemyHP?: { [enemyId: string]: { current: number, max: number } };
  enemyData?: { [enemyId: string]: EnemyData }; // Store full enemy stat blocks
  stormState?: StormState;
  pendingStormRoll?: PendingStormRoll;
  stormAttacks?: Record<string, StormAttack>;
  activeBuffs?: ActiveBuff[];
  vanishedEnemies?: VanishedEnemy[];

  luneElementalGenesisUsed?: boolean;

  // NEW: Terrain effects from Elemental Genesis
  fireTerrainZones?: FireTerrainZone[];
  iceWalls?: IceWall[];
  lightBlindEffects?: LightBlindEffect[];

    // NEW: Active protection effects tracking
  activeProtectionEffects?: Array<{
    id: string;
    protectorId: string;
    protectorName: string;
    activatedOnRound: number;
    remainingRounds: number;
    protectedAlly: string;
    type: 'leaders_sacrifice';
  }>;
}

export interface MapConfig {
  id: string;
  name: string;
  backgroundImage: string;
  gridSize: { width: number; height: number };
  gridVisible: boolean;
}

export interface UIState {
  isLoading: boolean;
  error?: string;
  selectedCharacter?: string;
  viewMode: 'player' | 'gm' | 'display';
  isConnected: boolean;
}

export interface PlayerAction {
  type: 'move' | 'attack' | 'ability' | 'hp_change' | 'stance_change';
  characterId: string;
  data: any;
  timestamp: Date;
}


// Enhanced BattleSessionDoc to include terrain effects
export interface BattleSessionDoc {
  name: string;
  characters: string[];
  battleState: BattleState;
  tokens: { [tokenId: string]: BattleToken };
  mapId: string;
  createdAt: any;
  updatedAt: any;
  combatState?: CombatState;
  pendingActions?: GMCombatAction[]; // Updated to use GMCombatAction
  enemyHP?: { [enemyId: string]: { current: number, max: number } };
  enemyData?: { [enemyId: string]: EnemyData };
  stormState?: StormState;
  pendingStormRoll?: PendingStormRoll;
  stormAttacks?: Record<string, StormAttack>;
  activeBuffs?: ActiveBuff[];
  vanishedEnemies?: VanishedEnemy[];

  // NEW: Terrain effects from Elemental Genesis
  fireTerrainZones?: FireTerrainZone[];
  iceWalls?: IceWall[];
  lightBlindEffects?: LightBlindEffect[];
}

// Elemental stain type
export type ElementalStain = 'fire' | 'ice' | 'nature' | 'light';

// Character-specific interfaces
export interface MaelleCharacter extends Character {
  stance: Stance;
  stanceChangedThisTurn: boolean;
}


export interface PlayerInventory {
  characterId: string;
  characterName: string;
  items: InventoryItem[];
  gold: number;
}

export interface GustaveCharacter extends Character {
  charges: number;
  maxCharges: 3;
  turretActive: boolean;
  turretPosition?: Position;
}

export interface LuneCharacter extends Character {
  charges: number;
  maxCharges: number;
  elementalStains: ElementalStain[];
  elementalGenesisUsed?: boolean;
  lastElementUsed?: ElementalStain;
}

export interface ScielCharacter extends Character {
  charges: number;
  foretellTargets: { [enemyId: string]: number };
}

export interface StormState {
  isActive: boolean;
  turnsRemaining: number;
  totalTurns: number;
  currentTurn: number;
  originalStacks: number;
  triggeredBy: string;
}

export interface StormAttack {
  id: string;
  turnNumber: number;
  targetId: string;
  damage: number;
  timestamp: number;
}

export interface PendingStormRoll {
  id: string;
  turnNumber: number;
  targetId: string;
  targetName: string;
  isActive: boolean;
  stacks: number;
}

export type CharacterType = 'maelle' | 'gustave' | 'lune' | 'sciel';

export interface CharacterTemplate {
  name: string;
  type: CharacterType;
  role: string;
  stats: Stats;
  maxHP: number;
  abilities: Ability[];
  maxCharges?: number;
  portraitUrl?: string;
  backgroundColor?: string;
}