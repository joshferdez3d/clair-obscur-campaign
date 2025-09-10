export const GRID_SIZE = 40; // pixels per grid square
export const DEFAULT_MAP_SIZE = { width: 20, height: 15 };
export const DEFAULT_SESSION_ID = 'test-session';

export const CHARACTER_COLORS = {
  maelle: '#4f46e5',
  gustave: '#dc2626', 
  lune: '#7c3aed',
  sciel: '#059669'
} as const;

export const ABILITY_TYPES = {
  ACTION: 'action',
  BONUS_ACTION: 'bonus_action',
  REACTION: 'reaction',
  PASSIVE: 'passive'
} as const;

export const TOKEN_TYPES = {
  PLAYER: 'player',
  ENEMY: 'enemy',
  NPC: 'npc'
} as const;

export const STANCES = {
  OFFENSIVE: 'offensive',
  DEFENSIVE: 'defensive',
  AGILE: 'agile'
} as const;

// utils/helpers.ts
import type { Stats, Position } from '../types';

export function calculateModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(modifier: number): string {
  return modifier >= 0 ? `+${modifier}` : `${modifier}`;
}

export function calculateDistance(pos1: Position, pos2: Position): number {
  const dx = Math.abs(pos1.x - pos2.x);
  const dy = Math.abs(pos1.y - pos2.y);
  // Use diagonal distance (Chebyshev distance) for D&D grid movement
  return Math.max(dx, dy);
}

export function isValidPosition(position: Position, mapWidth: number, mapHeight: number): boolean {
  return position.x >= 0 && position.x < mapWidth && 
         position.y >= 0 && position.y < mapHeight;
}

export function generateId(prefix: string = 'id'): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${randomStr}`;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getHPColor(currentHP: number, maxHP: number): string {
  const percentage = (currentHP / maxHP) * 100;
  if (percentage > 60) return '#10b981'; // green
  if (percentage > 30) return '#f59e0b'; // yellow
  return '#ef4444'; // red
}

export function formatHP(currentHP: number, maxHP: number): string {
  return `${currentHP}/${maxHP}`;
}

// Character-specific helpers
export function getStanceBonus(stance: string): string {
  switch (stance) {
    case 'offensive':
      return '+2 damage on next attack';
    case 'defensive':
      return '+2 AC until next turn';
    case 'agile':
      return '+10 ft movement';
    default:
      return '';
  }
}

export function getChargeDisplayName(characterName: string): string {
  switch (characterName.toLowerCase()) {
    case 'gustave':
      return 'Overload Charges';
    case 'lune':
      return 'Elemental Stains';
    case 'sciel':
      return 'Foretell Stacks';
    case 'maelle':
      return 'Momentum';
    default:
      return 'Charges';
  }
}