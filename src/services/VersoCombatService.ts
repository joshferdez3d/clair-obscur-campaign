// src/services/VersoCombatService.ts
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { MusicalNote, VersoState } from '../types/versoType';
import { generateRandomNote, detectHarmonyType, getHarmonyEffect, HARMONY_EFFECTS } from '../utils/harmonyDetection';

export class VersoCombatService {
  
  /**
   * Initialize Verso's state in Firebase (called once when character is created)
   */
  static async initializeVersoState(characterId: string = 'verso'): Promise<void> {
    const characterRef = doc(db, 'characters', characterId);
    
    const initialState: VersoState = {
      activeNotes: [],
      perfectPitchCharges: 3,
      modulationCooldown: 0,
      songOfAliciaUsed: false,
      songOfAliciaActive: false
    };
    
    await updateDoc(characterRef, {
      'combatState.versoState': initialState,
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Verso state initialized');
  }
  
  /**
   * Get current Verso state
   */
  static async getVersoState(characterId: string = 'verso'): Promise<VersoState> {
    const characterRef = doc(db, 'characters', characterId);
    const snap = await getDoc(characterRef);
    
    if (!snap.exists()) {
      throw new Error('Verso character not found');
    }
    
    const data = snap.data();
    return data.combatState?.versoState || {
      activeNotes: [],
      perfectPitchCharges: 3,
      modulationCooldown: 0,
      songOfAliciaUsed: false,
      songOfAliciaActive: false
    };
  }
  
  /**
   * Generate a random note (Harmonic Strike)
   */
  static async generateNote(characterId: string = 'verso'): Promise<MusicalNote> {
    const state = await this.getVersoState(characterId);
    
    // Check if we have space for a new note
    if (state.activeNotes.length >= 3) {
      throw new Error('Already have 3 notes! Use Harmonic Resonance or Dissonant Purge first.');
    }
    
    // Generate random note
    const newNote = generateRandomNote();
    const updatedNotes = [...state.activeNotes, newNote];
    
    // Update Firebase
    const characterRef = doc(db, 'characters', characterId);
    await updateDoc(characterRef, {
      'combatState.versoState.activeNotes': updatedNotes,
      updatedAt: serverTimestamp()
    });
    
    console.log(`🎵 Generated note: ${newNote}. Active notes:`, updatedNotes);
    return newNote;
  }
  
  /**
   * Choose a specific note (Perfect Pitch ability)
   */
  static async choosePerfectPitchNote(characterId: string = 'verso', chosenNote: MusicalNote): Promise<void> {
    const state = await this.getVersoState(characterId);
    
    // Check charges
    if (state.perfectPitchCharges <= 0) {
      throw new Error('No Perfect Pitch charges remaining!');
    }
    
    // Check space
    if (state.activeNotes.length >= 3) {
      throw new Error('Already have 3 notes!');
    }
    
    const updatedNotes = [...state.activeNotes, chosenNote];
    const newCharges = state.perfectPitchCharges - 1;
    
    // Update Firebase
    const characterRef = doc(db, 'characters', characterId);
    await updateDoc(characterRef, {
      'combatState.versoState.activeNotes': updatedNotes,
      'combatState.versoState.perfectPitchCharges': newCharges,
      updatedAt: serverTimestamp()
    });
    
    console.log(`🎯 Perfect Pitch: Added ${chosenNote}. Charges remaining: ${newCharges}`);
  }
  
  /**
   * Change a note to an adjacent one (Modulation ability)
   */
  static async modulateNote(characterId: string = 'verso', noteIndex: number, newNote: MusicalNote): Promise<void> {
    const state = await this.getVersoState(characterId);
    
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
    
    // Update Firebase with 3-turn cooldown
    const characterRef = doc(db, 'characters', characterId);
    await updateDoc(characterRef, {
      'combatState.versoState.activeNotes': updatedNotes,
      'combatState.versoState.modulationCooldown': 3,
      updatedAt: serverTimestamp()
    });
    
    console.log(`🔄 Modulated note ${noteIndex} to ${newNote}`);
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
    
    // Detect harmony
    const harmonyType = detectHarmonyType(state.activeNotes);
    const harmonyEffect = HARMONY_EFFECTS[harmonyType];
    
    // Calculate damage (simulated - GM will roll actual dice)
    let baseDamageRoll = 0;
    switch (harmonyType) {
      case 'consonant':
        baseDamageRoll = Math.floor(Math.random() * 8) + 1 + Math.floor(Math.random() * 8) + 1 + Math.floor(Math.random() * 8) + 1; // 3d8
        break;
      case 'dissonant':
      case 'supportive':
        baseDamageRoll = Math.floor(Math.random() * 8) + 1 + Math.floor(Math.random() * 8) + 1; // 2d8 or 2d6
        break;
      case 'chaotic':
        baseDamageRoll = Math.floor(Math.random() * 8) + 1; // 1d8 per target
        break;
    }
    
    const charisma = 4; // +4 CHA modifier
    const totalDamage = state.songOfAliciaActive ? (baseDamageRoll + charisma) * 2 : baseDamageRoll + charisma;
    
    // Clear notes and Song of Alicia active status
    const characterRef = doc(db, 'characters', characterId);
    await updateDoc(characterRef, {
      'combatState.versoState.activeNotes': [],
      'combatState.versoState.songOfAliciaActive': false,
      updatedAt: serverTimestamp()
    });
    
    console.log(`💥 Harmonic Resonance (${harmonyType}): ${totalDamage} damage`);
    
    return {
      harmonyType: harmonyEffect.name,
      damage: totalDamage,
      effect: harmonyEffect.effect
    };
  }
  
  /**
   * Clear all notes (Dissonant Purge)
   */
  static async dissonantPurge(characterId: string = 'verso'): Promise<number> {
    const state = await this.getVersoState(characterId);
    
    if (state.activeNotes.length === 0) {
      throw new Error('No notes to purge!');
    }
    
    // Damage = 1d6 per note
    const noteCount = state.activeNotes.length;
    let totalDamage = 0;
    for (let i = 0; i < noteCount; i++) {
      totalDamage += Math.floor(Math.random() * 6) + 1;
    }
    
    // Clear notes
    const characterRef = doc(db, 'characters', characterId);
    await updateDoc(characterRef, {
      'combatState.versoState.activeNotes': [],
      updatedAt: serverTimestamp()
    });
    
    console.log(`💣 Dissonant Purge: Cleared ${noteCount} notes for ${totalDamage} AOE damage`);
    return totalDamage;
  }
  
  /**
   * Activate Song of Alicia (ultimate)
   */
  static async activateSongOfAlicia(characterId: string = 'verso'): Promise<void> {
    const state = await this.getVersoState(characterId);
    
    if (state.songOfAliciaUsed) {
      throw new Error('Song of Alicia already used this battle!');
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
   * Decrease cooldowns at turn start
   */
  static async decreaseCooldowns(characterId: string = 'verso'): Promise<void> {
    const state = await this.getVersoState(characterId);
    
    if (state.modulationCooldown > 0) {
      const newCooldown = state.modulationCooldown - 1;
      
      const characterRef = doc(db, 'characters', characterId);
      await updateDoc(characterRef, {
        'combatState.versoState.modulationCooldown': newCooldown,
        updatedAt: serverTimestamp()
      });
      
      console.log(`⏳ Modulation cooldown: ${newCooldown} turns remaining`);
    }
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
      updatedAt: serverTimestamp()
    });
    
    console.log('😴 Verso completed long rest - all resources restored');
  }
}