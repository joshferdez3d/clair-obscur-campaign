// src/services/AudioService.ts
export class AudioService {
  private audioInstance: HTMLAudioElement | null = null;
  private currentTrack: string | null = null;

  // Play a music track
  async playMusic(musicPath: string, loop: boolean = true, volume: number = 0.5): Promise<void> {
    try {
      // Stop current music if playing
      this.stopMusic();

      // Create new audio instance
      this.audioInstance = new Audio(musicPath);
      this.audioInstance.loop = loop;
      this.audioInstance.volume = volume;
      this.currentTrack = musicPath;

      // Wait for audio to load and play
      await new Promise((resolve, reject) => {
        if (!this.audioInstance) return reject(new Error('Audio instance not created'));

        const handleCanPlay = () => {
          this.audioInstance?.removeEventListener('canplay', handleCanPlay);
          this.audioInstance?.removeEventListener('error', handleError);
          resolve(void 0);
        };

        const handleError = (error: Event) => {
          this.audioInstance?.removeEventListener('canplay', handleCanPlay);
          this.audioInstance?.removeEventListener('error', handleError);
          reject(new Error(`Failed to load audio: ${musicPath}`));
        };

        this.audioInstance.addEventListener('canplay', handleCanPlay);
        this.audioInstance.addEventListener('error', handleError);
      });

      // Play the audio
      await this.audioInstance.play();
      console.log(`Now playing: ${musicPath}`);

    } catch (error) {
      console.error('Failed to play music:', error);
      this.cleanup();
      throw error;
    }
  }

  // Stop current music
  stopMusic(): void {
    if (this.audioInstance) {
      this.audioInstance.pause();
      this.audioInstance.currentTime = 0;
      this.cleanup();
    }
  }

  // Pause current music
  pauseMusic(): void {
    if (this.audioInstance && !this.audioInstance.paused) {
      this.audioInstance.pause();
    }
  }

  // Resume paused music
  resumeMusic(): void {
    if (this.audioInstance && this.audioInstance.paused) {
      this.audioInstance.play().catch(console.error);
    }
  }

  // Set volume (0.0 to 1.0)
  setVolume(volume: number): void {
    if (this.audioInstance) {
      this.audioInstance.volume = Math.max(0, Math.min(1, volume));
    }
  }

  // Get current playing status
  isPlaying(): boolean {
    return this.audioInstance ? !this.audioInstance.paused : false;
  }

  // Get current track
  getCurrentTrack(): string | null {
    return this.currentTrack;
  }

  // Fade out music over duration (in ms)
  async fadeOut(duration: number = 2000): Promise<void> {
    if (!this.audioInstance || this.audioInstance.paused) return;

    const startVolume = this.audioInstance.volume;
    const steps = 20;
    const stepDuration = duration / steps;
    const volumeStep = startVolume / steps;

    return new Promise((resolve) => {
      const fadeInterval = setInterval(() => {
        if (!this.audioInstance) {
          clearInterval(fadeInterval);
          resolve();
          return;
        }

        this.audioInstance.volume = Math.max(0, this.audioInstance.volume - volumeStep);

        if (this.audioInstance.volume <= 0) {
          clearInterval(fadeInterval);
          this.stopMusic();
          resolve();
        }
      }, stepDuration);
    });
  }

  // Clean up resources
  private cleanup(): void {
    if (this.audioInstance) {
      this.audioInstance.removeEventListener('canplay', () => {});
      this.audioInstance.removeEventListener('error', () => {});
      this.audioInstance = null;
    }
    this.currentTrack = null;
  }

  // Destroy service and clean up
  destroy(): void {
    this.stopMusic();
    this.cleanup();
  }
}

// Singleton instance for global audio management
let audioServiceInstance: AudioService | null = null;

export function getAudioService(): AudioService {
  if (!audioServiceInstance) {
    audioServiceInstance = new AudioService();
  }
  return audioServiceInstance;
}

// Cleanup function
export function cleanupAudioService(): void {
  if (audioServiceInstance) {
    audioServiceInstance.destroy();
    audioServiceInstance = null;
  }
}