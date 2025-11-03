// src/utils/harmonyDetection.ts
import type { MusicalNote, HarmonyType, HarmonyEffect, NoteInfo } from '../types/versoType';

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

// Three-note chord patterns (order doesn't matter)
const CHORD_PATTERNS = {
  // Major triads
  major_triads: [
    ['C', 'E', 'G'], // C Major
    ['F', 'A', 'C'], // F Major
    ['G', 'B', 'D']  // G Major
  ],
  // Minor triads
  minor_triads: [
    ['A', 'C', 'E'], // A Minor
    ['D', 'F', 'A'], // D Minor
    ['E', 'G', 'B']  // E Minor
  ],
  // Diminished
  diminished_triad: [['B', 'D', 'F']], // B Diminished
  // Suspended chords
  suspended_chords: [
    ['C', 'D', 'G'], // Csus2
    ['C', 'F', 'G'], // Csus4
    ['D', 'E', 'A']  // Dsus2
  ]
};

// Updated harmony effects including three-note chords
export const HARMONY_EFFECTS: Record<HarmonyType, HarmonyEffect> = {
  // Two-note harmonies (existing)
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
  },
  
  // THREE-NOTE CHORD HARMONIES (NEW)
  major_triad: {
    type: 'major_triad',
    name: '🌟 Triumphant Crescendo',
    description: 'Heroic chord of victory',
    baseDamage: '4d8 + CHA',
    effect: 'Radiant damage + all allies gain Inspiration (advantage on next roll)',
    color: '#ffd700',
    emoji: '🌟'
  },
  minor_triad: {
    type: 'minor_triad',
    name: '🌙 Melancholic Echo',
    description: 'Sorrowful chord of introspection',
    baseDamage: '3d8 + CHA',
    effect: 'Psychic damage + Sorrow (disadvantage on attacks for 2 turns, damage heals Versò 50%)',
    color: '#9370db',
    emoji: '🌙'
  },
  diminished_triad: {
    type: 'diminished_triad',
    name: '💀 Dissonant Collapse',
    description: 'Unstable chord of destruction',
    baseDamage: '3d10 + CHA',
    effect: 'Necrotic damage + Harmonic Breakdown (1d8 damage when using abilities for 3 turns)',
    color: '#8b0000',
    emoji: '💀'
  },
  suspended_chord: {
    type: 'suspended_chord',
    name: '⚡ Temporal Suspension',
    description: 'Unresolved chord of anticipation',
    baseDamage: '2d8 + CHA',
    effect: 'Force damage + Suspended Animation (skip turn but immune to damage)',
    color: '#00ced1',
    emoji: '⚡'
  },
  clustered_harmony: {
    type: 'clustered_harmony',
    name: '💫 Cascading Resonance',
    description: 'Flowing chord of connection',
    baseDamage: '3d6 + CHA',
    effect: 'Chain lightning: jumps to nearest enemy for 2d6, then 1d6',
    color: '#ff1493',
    emoji: '💫'
  },
  modal_mixture: {
    type: 'modal_mixture',
    name: '🎭 Emotional Whiplash',
    description: 'Conflicted chord of chaos',
    baseDamage: '3d8 + CHA',
    effect: 'Psychic damage + random: Joy/Rage/Fear/Despair',
    color: '#ff00ff',
    emoji: '🎭'
  }
};

/**
 * Check if notes match a chord pattern (order doesn't matter)
 */
function matchesChordPattern(notes: MusicalNote[], pattern: string[]): boolean {
  if (notes.length !== pattern.length) return false;
  const sortedNotes = [...notes].sort();
  const sortedPattern = [...pattern].sort();
  return sortedNotes.every((note, i) => note === sortedPattern[i]);
}

/**
 * Check if notes form a consecutive cluster (C-D-E, E-F-G, etc.)
 */
function isConsecutiveCluster(notes: MusicalNote[]): boolean {
  if (notes.length !== 3) return false;
  
  const noteOrder = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const indices = notes.map(n => noteOrder.indexOf(n)).sort((a, b) => a - b);
  
  // Check if indices are consecutive
  return indices[1] === indices[0] + 1 && indices[2] === indices[1] + 1;
}

/**
 * Detect specific three-note chord type
 */
function detectThreeNoteChordType(notes: MusicalNote[]): HarmonyType | null {
  if (notes.length !== 3) return null;
  
  // Check Major Triads
  for (const pattern of CHORD_PATTERNS.major_triads) {
    if (matchesChordPattern(notes, pattern)) {
      return 'major_triad';
    }
  }
  
  // Check Minor Triads
  for (const pattern of CHORD_PATTERNS.minor_triads) {
    if (matchesChordPattern(notes, pattern)) {
      return 'minor_triad';
    }
  }
  
  // Check Diminished
  if (matchesChordPattern(notes, CHORD_PATTERNS.diminished_triad[0])) {
    return 'diminished_triad';
  }
  
  // Check Suspended
  for (const pattern of CHORD_PATTERNS.suspended_chords) {
    if (matchesChordPattern(notes, pattern)) {
      return 'suspended_chord';
    }
  }
  
  // Check if it's a consecutive cluster
  if (isConsecutiveCluster(notes)) {
    return 'clustered_harmony';
  }
  
  // If no specific pattern matches, it's a modal mixture
  return 'modal_mixture';
}

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
  
  // THREE-NOTE CHORD DETECTION (NEW)
  if (uniqueNotes.length === 3) {
    const chordType = detectThreeNoteChordType(uniqueNotes);
    if (chordType) {
      return chordType;
    }
  }
  
  // TWO-NOTE HARMONY DETECTION (existing logic)
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
  if (uniqueNotes.length === 2) {
    const interval = semitones[1] - semitones[0];
    if (interval === 7 || interval === 4 || interval === 5) {
      return 'consonant';
    }
  }
  
  // DISSONANT: Minor 2nd (1 semitone) or Major 7th (11 semitones)
  const hasCloseInterval = intervals.some(i => i === 1 || i === 11);
  if (hasCloseInterval) return 'dissonant';
  
  // SUPPORTIVE: Major 2nd (2 semitones) or Major 6th (9 semitones)
  const hasSupportiveInterval = intervals.some(i => i === 2 || i === 9);
  if (hasSupportiveInterval) return 'supportive';
  
  // CHAOTIC: Everything else
  return 'chaotic';
}

/**
 * Generate a random note (1d7 roll) - Updated to prevent duplicates
 */
export function generateRandomNote(excludeNotes: MusicalNote[] = []): MusicalNote {
  const notes: MusicalNote[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const availableNotes = notes.filter(n => !excludeNotes.includes(n));
  
  if (availableNotes.length === 0) {
    throw new Error('No available notes to generate');
  }
  
  const roll = Math.floor(Math.random() * availableNotes.length);
  return availableNotes[roll];
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