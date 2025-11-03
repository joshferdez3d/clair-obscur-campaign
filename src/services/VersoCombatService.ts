// src/services/VersoCombatService.ts
// Updated to enforce once-per-turn usage for Modulation and Perfect Pitch

import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { MusicalNote, VersoState } from '../types/versoType';
import { detectHarmonyType, HARMONY_EFFECTS } from '../utils/harmonyDetection';

export class VersoCombatService {
  /**
   * Get current Verso state from Firebase
   */
  static async getVersoState(characterId: string = 'verso'): Promise<VersoState> {
    const characterRef = doc(db, 'characters', characterId);
    const characterDoc = await getDoc(characterRef);
    
    if (!characterDoc.exists()) {
      throw new Error('Character not found');
    }
    
    const data = characterDoc.data();
    const versoState = data?.combatState?.versoState || {
      activeNotes: [],
      perfectPitchCharges: 3,
      modulationCooldown: 0,
      songOfAliciaUsed: false,
      songOfAliciaActive: false,
      hasUsedModulationThisTurn: false,
      hasUsedPerfectPitchThisTurn: false
    };
    
    return versoState;
  }

  /**
   * Generate a random note (Harmonic Strike ability)
   */
  static async generateNote(characterId: string = 'verso'): Promise<MusicalNote> {
    const state = await this.getVersoState(characterId);
    
    if (state.activeNotes.length >= 3) {
      throw new Error('Already have 3 notes! Use Harmonic Resonance or Dissonant Purge first.');
    }
    
    const ALL_NOTES: MusicalNote[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const availableNotes = ALL_NOTES.filter(note => !state.activeNotes.includes(note));
    
    if (availableNotes.length === 0) {
      throw new Error('All notes have been generated! No duplicates allowed.');
    }
    
    const randomIndex = Math.floor(Math.random() * availableNotes.length);
    const newNote = availableNotes[randomIndex];
    const updatedNotes = [...state.activeNotes, newNote];
    
    const characterRef = doc(db, 'characters', characterId);
    await updateDoc(characterRef, {
      'combatState.versoState.activeNotes': updatedNotes,
      'combatState.versoState.perfectPitchCharges': state.perfectPitchCharges,
      'combatState.versoState.modulationCooldown': state.modulationCooldown,
      'combatState.versoState.songOfAliciaUsed': state.songOfAliciaUsed,
      'combatState.versoState.songOfAliciaActive': state.songOfAliciaActive,
      'combatState.versoState.hasUsedModulationThisTurn': state.hasUsedModulationThisTurn,
      'combatState.versoState.hasUsedPerfectPitchThisTurn': state.hasUsedPerfectPitchThisTurn,
      updatedAt: serverTimestamp()
    });
    
    console.log(`🎵 Generated unique note: ${newNote}. Active notes:`, updatedNotes);
    return newNote;
  }

  /**
   * Choose a specific note (Perfect Pitch ability) - NOW WITH ONCE-PER-TURN RESTRICTION
   */
  static async choosePerfectPitchNote(characterId: string = 'verso', chosenNote: MusicalNote): Promise<void> {
    const state = await this.getVersoState(characterId);
    
    // NEW: Check if already used this turn
    if (state.hasUsedPerfectPitchThisTurn) {
      throw new Error('Perfect Pitch can only be used once per turn!');
    }
    
    // Check charges
    if (state.perfectPitchCharges <= 0) {
      throw new Error('No Perfect Pitch charges remaining!');
    }
    
    // Check space
    if (state.activeNotes.length >= 3) {
      throw new Error('Already have 3 notes!');
    }
    
    // Check for duplicate
    if (state.activeNotes.includes(chosenNote)) {
      throw new Error(`${chosenNote} is already in your collection! Choose a different note.`);
    }
    
    const updatedNotes = [...state.activeNotes, chosenNote];
    const newCharges = state.perfectPitchCharges - 1;
    
    // Update Firebase - mark as used this turn
    const characterRef = doc(db, 'characters', characterId);
    await updateDoc(characterRef, {
      'combatState.versoState.activeNotes': updatedNotes,
      'combatState.versoState.perfectPitchCharges': newCharges,
      'combatState.versoState.hasUsedPerfectPitchThisTurn': true, // NEW: Mark as used
      updatedAt: serverTimestamp()
    });
    
    console.log(`🎯 Perfect Pitch: Added ${chosenNote}. Charges remaining: ${newCharges}`);
    console.log('Perfect Pitch is now disabled for this turn.');
  }
  
  /**
   * Change a note to an adjacent one (Modulation ability) - NOW WITH ONCE-PER-TURN RESTRICTION
   */
  static async modulateNote(characterId: string = 'verso', noteIndex: number, newNote: MusicalNote): Promise<void> {
    const state = await this.getVersoState(characterId);
    
    // NEW: Check if already used this turn
    if (state.hasUsedModulationThisTurn) {
      throw new Error('Modulation can only be used once per turn!');
    }
    
    // Check cooldown
    if (state.modulationCooldown > 0) {
      throw new Error(`Modulation on cooldown for ${state.modulationCooldown} more turn(s)!`);
    }
    
    // Check if note index is valid
    if (noteIndex < 0 || noteIndex >= state.activeNotes.length) {
      throw new Error('Invalid note index!');
    }
    
    const updatedNotes = [...state.activeNotes];
    updatedNotes[noteIndex] = newNote;
    
    // Update Firebase with 3-turn cooldown AND mark as used this turn
    const characterRef = doc(db, 'characters', characterId);
    await updateDoc(characterRef, {
      'combatState.versoState.activeNotes': updatedNotes,
      'combatState.versoState.modulationCooldown': 3,
      'combatState.versoState.hasUsedModulationThisTurn': true, // NEW: Mark as used
      updatedAt: serverTimestamp()
    });
    
    console.log(`🔄 Modulated note ${noteIndex} to ${newNote}`);
    console.log('Modulation is now disabled for this turn and on cooldown for 3 turns.');
  }
  
  /**
   * Use Harmonic Resonance (consume notes for effect)
   */
  static async executeHarmonicResonance(characterId: string = 'verso'): Promise<{
    harmonyType: string;
    damage: number;
    effect: string;
  }> {
    const state = await this.getVersoState(characterId);
    
    if (state.activeNotes.length === 0) {
      throw new Error('No notes to resonate!');
    }
    
    const harmonyType = detectHarmonyType(state.activeNotes);
    const harmonyEffect = HARMONY_EFFECTS[harmonyType];
    
    // Calculate damage (simulated - GM will roll actual dice)
    let baseDamageRoll = 0;
    switch (harmonyType) {
      case 'consonant':
        baseDamageRoll = Math.floor(Math.random() * 8) + 1 + Math.floor(Math.random() * 8) + 1 + Math.floor(Math.random() * 8) + 1;
        break;
      case 'dissonant':
      case 'supportive':
        baseDamageRoll = Math.floor(Math.random() * 8) + 1 + Math.floor(Math.random() * 8) + 1;
        break;
      case 'chaotic':
        baseDamageRoll = Math.floor(Math.random() * 8) + 1;
        break;
    }
    
    const charisma = 4; // +4 CHA modifier
    const totalDamage = state.songOfAliciaActive ? 
      (baseDamageRoll + charisma) * 2 : baseDamageRoll + charisma;
    
    // Clear notes and deactivate Song of Alicia if used
    const characterRef = doc(db, 'characters', characterId);
    await updateDoc(characterRef, {
      'combatState.versoState.activeNotes': [],
      'combatState.versoState.songOfAliciaActive': false,
      updatedAt: serverTimestamp()
    });
    
    console.log(`💥 Harmonic Resonance executed: ${harmonyType} harmony`);
    
    return {
      harmonyType: harmonyEffect.name,
      damage: totalDamage,
      effect: harmonyEffect.effect
    };
  }
  
  /**
   * Use Dissonant Purge (clear notes and deal AOE damage)
   */
  static async dissonantPurge(characterId: string = 'verso'): Promise<number> {
    const state = await this.getVersoState(characterId);
    
    if (state.activeNotes.length === 0) {
      throw new Error('No notes to purge!');
    }
    
    const noteCount = state.activeNotes.length;
    const totalDamage = noteCount * (Math.floor(Math.random() * 6) + 1);
    
    // Clear all notes
    const characterRef = doc(db, 'characters', characterId);
    await updateDoc(characterRef, {
      'combatState.versoState.activeNotes': [],
      updatedAt: serverTimestamp()
    });
    
    console.log(`💣 Dissonant Purge: Cleared ${noteCount} notes for ${totalDamage} damage`);
    return totalDamage;
  }
  
  /**
   * Activate Song of Alicia (ultimate)
   */
  static async activateSongOfAlicia(characterId: string = 'verso'): Promise<void> {
    const state = await this.getVersoState(characterId);
    
    if (state.songOfAliciaUsed) {
      throw new Error('Song of Alicia has already been used this battle!');
    }
    
    // Activate Song of Alicia
    const characterRef = doc(db, 'characters', characterId);
    await updateDoc(characterRef, {
      'combatState.versoState.songOfAliciaUsed': true,
      'combatState.versoState.songOfAliciaActive': true,
      updatedAt: serverTimestamp()
    });
    
    console.log('🎼 Song of Alicia activated! Next Harmonic Resonance will deal double damage!');
  }
  
  /**
   * UPDATED: Reset turn-based flags AND decrease cooldowns at turn start
   */
  static async startNewTurn(characterId: string = 'verso'): Promise<void> {
    const state = await this.getVersoState(characterId);
    
    const newCooldown = Math.max(0, state.modulationCooldown - 1);
    
    const characterRef = doc(db, 'characters', characterId);
    await updateDoc(characterRef, {
      'combatState.versoState.modulationCooldown': newCooldown,
      'combatState.versoState.hasUsedModulationThisTurn': false,  // NEW: Reset for new turn
      'combatState.versoState.hasUsedPerfectPitchThisTurn': false, // NEW: Reset for new turn
      updatedAt: serverTimestamp()
    });
    
    console.log(`⏳ New turn started for Verso`);
    console.log(`   - Modulation cooldown: ${newCooldown} turns remaining`);
    console.log(`   - Modulation and Perfect Pitch usage reset`);
  }
  
  /**
   * DEPRECATED: Use startNewTurn instead
   * @deprecated
   */
  static async decreaseCooldowns(characterId: string = 'verso'): Promise<void> {
    console.warn('decreaseCooldowns is deprecated. Use startNewTurn instead.');
    await this.startNewTurn(characterId);
  }
  
  /**
   * Reset state for new battle
   */
  static async resetForNewBattle(characterId: string = 'verso'): Promise<void> {
    const characterRef = doc(db, 'characters', characterId);
    await updateDoc(characterRef, {
      'combatState.versoState.activeNotes': [],
      'combatState.versoState.modulationCooldown': 0,
      'combatState.versoState.songOfAliciaUsed': false,
      'combatState.versoState.songOfAliciaActive': false,
      'combatState.versoState.hasUsedModulationThisTurn': false,  // NEW: Reset
      'combatState.versoState.hasUsedPerfectPitchThisTurn': false, // NEW: Reset
      // Don't reset Perfect Pitch charges - only long rest does that
      updatedAt: serverTimestamp()
    });
    
    console.log('🔄 Verso state reset for new battle');
  }
  
  /**
   * Long rest - restore everything
   */
  static async longRest(characterId: string = 'verso'): Promise<void> {
    const characterRef = doc(db, 'characters', characterId);
    await updateDoc(characterRef, {
      'combatState.versoState.activeNotes': [],
      'combatState.versoState.perfectPitchCharges': 3,
      'combatState.versoState.modulationCooldown': 0,
      'combatState.versoState.songOfAliciaUsed': false,
      'combatState.versoState.songOfAliciaActive': false,
      'combatState.versoState.hasUsedModulationThisTurn': false,  // NEW: Reset
      'combatState.versoState.hasUsedPerfectPitchThisTurn': false, // NEW: Reset
      updatedAt: serverTimestamp()
    });
    
    console.log('😴 Verso completed long rest - all resources restored');
  }
}