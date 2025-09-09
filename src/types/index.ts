// src/types/index.ts - Complete and corrected type definitions

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
  color?: string;
  ac?: number; // Make sure this exists for enemy tokens
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

// Base combat action interface
export interface CombatAction {
  id: string;
  type: 'move' | 'attack' | 'ability' | 'end_turn';
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

  // Ultimate-specific properties
  ultimateType?: string; // 'elemental_genesis', etc.
  element?: 'fire' | 'ice' | 'nature' | 'light';
  effectName?: string;
  description?: string;
  needsGMInteraction?: boolean;

  // Element-specific data
  healingTargets?: Array<{
    id: string;
    name: string;
    currentHP: number;
    maxHP: number;
    position: { x: number; y: number };
  }>;
  
  affectedSquares?: Array<{ x: number; y: number }>;
  affectedTokens?: string[];
  
  // Fire terrain
  terrainCenter?: { x: number; y: number };
  
  // Ice wall
  wallType?: 'row' | 'column';
  wallIndex?: number;
  wallSquares?: Array<{ x: number; y: number }>;
  
  // Light blind
  blindedSquares?: Array<{ x: number; y: number }>;

  // Required properties
  sourcePosition: Position;
  range: number;
  timestamp: Date;
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

export interface Character {
  id: string;
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

  luneElementalGenesisUsed?: boolean;

  // NEW: Terrain effects from Elemental Genesis
  fireTerrainZones?: FireTerrainZone[];
  iceWalls?: IceWall[];
  lightBlindEffects?: LightBlindEffect[];
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

// Firebase document interfaces
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
  createdAt: any;
  updatedAt: any;
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