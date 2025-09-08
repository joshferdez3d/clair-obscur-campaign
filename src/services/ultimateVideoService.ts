// src/services/ultimateVideoService.ts
import { doc, updateDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';

export interface UltimateVideoEvent {
  characterName: string;
  ultimateName: string;
  timestamp: number;
  isActive: boolean;
}

export class UltimateVideoService {
  private sessionId: string;
  private listeners: Map<string, (event: UltimateVideoEvent | null) => void> = new Map();
  private firestoreUnsubscribe: Unsubscribe | null = null; // RENAMED to avoid conflict

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.setupListener();
  }

  private setupListener() {
    const sessionRef = doc(db, 'battleSessions', this.sessionId);
    
    this.firestoreUnsubscribe = onSnapshot(sessionRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const ultimateEvent: UltimateVideoEvent | null = data.ultimateVideoEvent || null;
        
        // Notify all listeners
        this.listeners.forEach(callback => {
          callback(ultimateEvent);
        });
      }
    });
  }

  // Trigger an ultimate video for all connected clients
  async triggerUltimateVideo(characterName: string, ultimateName: string): Promise<void> {
    try {
      const sessionRef = doc(db, 'battleSessions', this.sessionId);
      
      const ultimateEvent: UltimateVideoEvent = {
        characterName: characterName.toLowerCase(),
        ultimateName,
        timestamp: Date.now(),
        isActive: true
      };

      await updateDoc(sessionRef, {
        ultimateVideoEvent: ultimateEvent
      });

      console.log(`Ultimate video triggered for ${characterName}: ${ultimateName}`);
    } catch (error) {
      console.error('Failed to trigger ultimate video:', error);
      throw error;
    }
  }

  // Clear the ultimate video event (called when video finishes)
  async clearUltimateVideo(): Promise<void> {
    try {
      const sessionRef = doc(db, 'battleSessions', this.sessionId);
      
      await updateDoc(sessionRef, {
        ultimateVideoEvent: null
      });

      console.log('Ultimate video event cleared');
    } catch (error) {
      console.error('Failed to clear ultimate video:', error);
      throw error;
    }
  }

  // Subscribe to ultimate video events
  subscribe(listenerId: string, callback: (event: UltimateVideoEvent | null) => void): void {
    this.listeners.set(listenerId, callback);
  }

  // Unsubscribe from ultimate video events - RENAMED method to be more specific
  unsubscribeListener(listenerId: string): void {
    this.listeners.delete(listenerId);
  }

  // Cleanup when service is no longer needed
  destroy(): void {
    if (this.firestoreUnsubscribe) {
      this.firestoreUnsubscribe();
      this.firestoreUnsubscribe = null;
    }
    this.listeners.clear();
  }
}

// Helper function to get ultimate video service instance
const serviceInstances = new Map<string, UltimateVideoService>();

export function getUltimateVideoService(sessionId: string): UltimateVideoService {
  if (!serviceInstances.has(sessionId)) {
    serviceInstances.set(sessionId, new UltimateVideoService(sessionId));
  }
  return serviceInstances.get(sessionId)!;
}

// Helper function to cleanup service instance
export function cleanupUltimateVideoService(sessionId: string): void {
  const service = serviceInstances.get(sessionId);
  if (service) {
    service.destroy();
    serviceInstances.delete(sessionId);
  }
}