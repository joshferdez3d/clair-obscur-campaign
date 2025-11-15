// src/types/versoType.ts
// COMPLETE FILE - Replace your entire versoType.ts with this

export type MusicalNote = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export type HarmonyType = 'consonant' | 'dissonant' | 'supportive' | 'chaotic' | 'major_triad'
  | 'minor_triad'
  | 'diminished_triad'
  | 'suspended_chord'
  | 'clustered_harmony'
  | 'modal_mixture';

export interface VersoState {
  activeNotes: MusicalNote[];          // Up to 3 notes
  perfectPitchCharges: number;         // 0-3
  modulationCooldown: number;          // Turns remaining
  songOfAliciaUsed: boolean;           // Once per battle
  songOfAliciaActive: boolean;         // Active until next resonance
  hasUsedModulationThisTurn: boolean;  // Reset at start of Verso's turn
  hasUsedPerfectPitchThisTurn: boolean;
  soundOfSilenceLastUsedRound: number; // NEW: Track which round Sound of Silence was last used (0 = never used)
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