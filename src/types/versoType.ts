// src/types/verso.ts
// Add these types to your existing types/index.ts or keep as separate file

export type MusicalNote = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export type HarmonyType = 'consonant' | 'dissonant' | 'supportive' | 'chaotic';

export interface VersoState {
  activeNotes: MusicalNote[];          // Up to 3 notes
  perfectPitchCharges: number;         // 0-3
  modulationCooldown: number;          // Turns remaining
  songOfAliciaUsed: boolean;           // Once per battle
  songOfAliciaActive: boolean;         // Active until next resonance
}

export interface HarmonyEffect {
  type: HarmonyType;
  name: string;
  description: string;
  baseDamage: string;
  effect: string;
  color: string;
  emoji: string;
}

export interface NoteInfo {
  note: MusicalNote;
  color: string;
  emoji: string;
  number: number; // 1-7 for d7 roll
}

// Extend CharacterCombatState to include Verso
declare module '../types' {
  interface CharacterCombatState {
    versoState?: VersoState;
  }
}