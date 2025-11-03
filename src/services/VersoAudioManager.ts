// src/services/VersoAudioManager.ts
import type { MusicalNote } from '../types/versoType';

/**
 * Manages audio playback for Versò's harmonic notes system.
 * Each note plays a 2-minute drone sound that loops when active.
 */
export class VersoAudioManager {
  private static instance: VersoAudioManager | null = null;
  private audioElements: Map<MusicalNote, HTMLAudioElement> = new Map();
  private activeNotes: Set<MusicalNote> = new Set();
  private isEnabled: boolean = true;
  private volume: number = 0.5; // Default volume at 50%

  private constructor() {
    this.initializeAudioElements();
  }

  /**
   * Get singleton instance of VersoAudioManager
   */
  static getInstance(): VersoAudioManager {
    if (!VersoAudioManager.instance) {
      VersoAudioManager.instance = new VersoAudioManager();
    }
    return VersoAudioManager.instance;
  }

  /**
   * Initialize audio elements for each note
   */
  private initializeAudioElements() {
    const notes: MusicalNote[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    
    notes.forEach(note => {
      const audio = new Audio();
      audio.src = `/music/notes/TUNING_NOTE_-_${note}.mp3`;
      audio.loop = true; // Loop the 2-minute drone
      audio.volume = this.volume;
      audio.preload = 'none'; // Don't preload until needed
      
      // Add error handling
      audio.addEventListener('error', (e) => {
        console.error(`Failed to load audio for note ${note}:`, e);
      });

      // Add ended event handler in case loop fails
      audio.addEventListener('ended', () => {
        if (this.activeNotes.has(note)) {
          audio.play().catch(err => console.error(`Failed to loop note ${note}:`, err));
        }
      });

      this.audioElements.set(note, audio);
    });
  }

  /**
   * Play a specific note
   */
  async playNote(note: MusicalNote): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const audio = this.audioElements.get(note);
      if (!audio) {
        console.error(`No audio element for note ${note}`);
        return;
      }

      // If already playing, don't restart
      if (this.activeNotes.has(note)) {
        console.log(`Note ${note} is already playing`);
        return;
      }

      // Load the audio if not already loaded
      if (audio.readyState < 2) {
        audio.load();
        // Wait for audio to be ready
        await new Promise((resolve, reject) => {
          const handleCanPlay = () => {
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('error', handleError);
            resolve(undefined);
          };
          const handleError = () => {
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('error', handleError);
            reject(new Error(`Failed to load audio for note ${note}`));
          };
          audio.addEventListener('canplay', handleCanPlay, { once: true });
          audio.addEventListener('error', handleError, { once: true });
        });
      }

      // Play the note
      await audio.play();
      this.activeNotes.add(note);
      console.log(`🎵 Playing note ${note}`);
    } catch (error) {
      console.error(`Failed to play note ${note}:`, error);
    }
  }

  /**
   * Stop a specific note
   */
  stopNote(note: MusicalNote): void {
    const audio = this.audioElements.get(note);
    if (!audio) return;

    if (this.activeNotes.has(note)) {
      audio.pause();
      audio.currentTime = 0; // Reset to beginning
      this.activeNotes.delete(note);
      console.log(`🔇 Stopped note ${note}`);
    }
  }

  /**
   * Update playing notes based on current active notes array
   * This is the main method to sync audio with game state
   */
  async updateActiveNotes(newActiveNotes: MusicalNote[]): Promise<void> {
    const newNotesSet = new Set(newActiveNotes);

    // Stop notes that are no longer active
    const activeNotesArray = Array.from(this.activeNotes);
    for (const note of activeNotesArray) {
      if (!newNotesSet.has(note)) {
        this.stopNote(note);
      }
    }

    // Play new notes
    for (const note of newActiveNotes) {
      if (!this.activeNotes.has(note)) {
        await this.playNote(note);
      }
    }
  }

  /**
   * Stop all playing notes
   */
  stopAllNotes(): void {
    const activeNotesArray = Array.from(this.activeNotes);
    for (const note of activeNotesArray) {
      this.stopNote(note);
    }
  }

  /**
   * Set the volume for all notes (0-1)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    
    const audioArray = Array.from(this.audioElements.values());
    for (const audio of audioArray) {
      audio.volume = this.volume;
    }
  }

  /**
   * Toggle audio on/off
   */
  toggleEnabled(): void {
    this.isEnabled = !this.isEnabled;
    
    if (!this.isEnabled) {
      this.stopAllNotes();
    }
  }

  /**
   * Check if audio is enabled
   */
  getIsEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Get current volume level
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Cleanup when component unmounts or battle ends
   */
  cleanup(): void {
    this.stopAllNotes();
    
    // Remove all audio elements
    const audioArray = Array.from(this.audioElements.values());
    for (const audio of audioArray) {
      audio.pause();
      audio.src = '';
    }
    
    this.audioElements.clear();
    this.activeNotes.clear();
  }
}