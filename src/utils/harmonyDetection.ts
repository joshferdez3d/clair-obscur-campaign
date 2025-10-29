// src/utils/harmonyDetection.ts
import type { MusicalNote, HarmonyType, HarmonyEffect, NoteInfo } from '../types/verso';

// Note information mapping
export const NOTE_INFO: Record<MusicalNote, NoteInfo> = {
  'C': { note: 'C', color: '#ef4444', emoji: '🔴', number: 1 },
  'D': { note: 'D', color: '#f97316', emoji: '🟠', number: 2 },
  'E': { note: 'E', color: '#eab308', emoji: '🟡', number: 3 },
  'F': { note: 'F', color: '#22c55e', emoji: '🟢', number: 4 },
  'G': { note: 'G', color: '#3b82f6', emoji: '🔵', number: 5 },
  'A': { note: 'A', color: '#a855f7', emoji: '🟣', number: 6 },
  'B': { note: 'B', color: '#78350f', emoji: '🟤', number: 7 },
};

// Harmony effect definitions
export const HARMONY_EFFECTS: Record<HarmonyType, HarmonyEffect> = {
  consonant: {
    type: 'consonant',
    name: 'Consonant Harmony',
    description: 'Pure, powerful damage',
    baseDamage: '3d8 + CHA',
    effect: 'High single-target damage',
    color: '#3b82f6',
    emoji: '⚡'
  },
  dissonant: {
    type: 'dissonant',
    name: 'Dissonant Clash',
    description: 'Damage with crowd control',
    baseDamage: '2d8 + CHA',
    effect: 'Damage + Slow (1 turn) or Stun (high roll)',
    color: '#8b5cf6',
    emoji: '🌀'
  },
  supportive: {
    type: 'supportive',
    name: 'Supportive Resonance',
    description: 'Damage with ally benefits',
    baseDamage: '2d6 + CHA',
    effect: 'Damage + Heal nearby ally (1d6+CHA) or +2 AC',
    color: '#22c55e',
    emoji: '💫'
  },
  chaotic: {
    type: 'chaotic',
    name: 'Chaotic Burst',
    description: 'Area of effect damage',
    baseDamage: '1d8 + CHA per target',
    effect: 'Hits up to 3 enemies in 20ft',
    color: '#ef4444',
    emoji: '🎭'
  }
};

/**
 * Detects the harmony type from a set of notes using music theory rules
 */
export function detectHarmonyType(notes: MusicalNote[]): HarmonyType {
  if (notes.length === 0) return 'chaotic';
  if (notes.length === 1) return 'consonant'; // Single note = pure
  
  const noteSet = new Set(notes);
  const uniqueNotes = Array.from(noteSet);
  
  // All same note = pure consonant
  if (uniqueNotes.length === 1) return 'consonant';
  
  // Convert notes to semitones for interval calculation
  const noteToSemitone: Record<MusicalNote, number> = {
    'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11
  };
  
  const semitones = uniqueNotes.map(n => noteToSemitone[n]).sort((a, b) => a - b);
  
  // Calculate intervals between consecutive notes
  const intervals: number[] = [];
  for (let i = 1; i < semitones.length; i++) {
    intervals.push(semitones[i] - semitones[i - 1]);
  }
  
  // CONSONANT: Perfect intervals (Perfect 5th, Major 3rd, Perfect 4th)
  // Examples: C-G (7 semitones), C-E (4 semitones), C-F (5 semitones)
  if (uniqueNotes.length === 2) {
    const interval = semitones[1] - semitones[0];
    if (interval === 7 || interval === 4 || interval === 5) {
      return 'consonant';
    }
  }
  
  // Check for major/minor triads (consonant)
  if (uniqueNotes.length === 3) {
    const interval1 = semitones[1] - semitones[0];
    const interval2 = semitones[2] - semitones[1];
    
    // Major triad: 4 + 3 semitones (e.g., C-E-G)
    // Minor triad: 3 + 4 semitones (e.g., A-C-E)
    if ((interval1 === 4 && interval2 === 3) || (interval1 === 3 && interval2 === 4)) {
      return 'consonant';
    }
  }
  
  // DISSONANT: Minor 2nd (1 semitone) or Major 7th (11 semitones) - creates tension
  const hasCloseInterval = intervals.some(i => i === 1 || i === 11);
  if (hasCloseInterval) return 'dissonant';
  
  // SUPPORTIVE: Major 2nd (2 semitones) or Major 6th (9 semitones) - gentle, flowing
  const hasSupportiveInterval = intervals.some(i => i === 2 || i === 9);
  if (hasSupportiveInterval) return 'supportive';
  
  // CHAOTIC: Everything else (augmented/diminished intervals, complex patterns)
  return 'chaotic';
}

/**
 * Generate a random note (1d7 roll)
 */
export function generateRandomNote(): MusicalNote {
  const notes: MusicalNote[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const roll = Math.floor(Math.random() * 7);
  return notes[roll];
}

/**
 * Get adjacent notes for modulation
 */
export function getAdjacentNotes(note: MusicalNote): MusicalNote[] {
  const notes: MusicalNote[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const index = notes.indexOf(note);
  
  const adjacent: MusicalNote[] = [];
  if (index > 0) adjacent.push(notes[index - 1]);
  if (index < notes.length - 1) adjacent.push(notes[index + 1]);
  
  // Wrap around: C↔B
  if (note === 'C') adjacent.push('B');
  if (note === 'B') adjacent.push('C');
  
  return adjacent;
}

/**
 * Get all possible notes
 */
export function getAllNotes(): MusicalNote[] {
  return ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
}

/**
 * Format notes for display
 */
export function formatNotesDisplay(notes: MusicalNote[]): string {
  if (notes.length === 0) return 'No notes';
  return notes.map(n => `${NOTE_INFO[n].emoji} ${n}`).join(' + ');
}

/**
 * Get harmony effect for current notes
 */
export function getHarmonyEffect(notes: MusicalNote[]): HarmonyEffect | null {
  if (notes.length === 0) return null;
  const harmonyType = detectHarmonyType(notes);
  return HARMONY_EFFECTS[harmonyType];
}