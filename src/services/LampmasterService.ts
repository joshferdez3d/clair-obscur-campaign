// Create src/services/LampmasterService.ts
import { doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from './firebase'; 
import { BattleSession, BattleToken, GMCombatAction, Position } from '../types';
import { FirestoreService } from './firestoreService';

export interface LampToken extends BattleToken {
  lampIndex: number; // 0-3 for the 4 lamps
  isGlowing?: boolean;
  sequenceOrder?: number;
}

export interface LampmasterRitual {
  id: string;
  isActive: boolean;
  sequence: number[]; // Array of lamp indices in order
  playerAttempt: number[]; // Player's attempt at the sequence
  damageReduction: number; // 0%, 25%, 50%, 75%, or 100%
  createdOnRound: number;
  willTriggerOnRound: number;
}

export class LampmasterService {
  // Create lamp tokens when Lampmaster is spawned
  static async createLampTokens(sessionId: string, lampmasterPosition: Position): Promise<void> {
    const lampPositions = [
      { x: lampmasterPosition.x - 2, y: lampmasterPosition.y - 2 }, // Top-left
      { x: lampmasterPosition.x + 2, y: lampmasterPosition.y - 2 }, // Top-right
      { x: lampmasterPosition.x - 2, y: lampmasterPosition.y + 2 }, // Bottom-left
      { x: lampmasterPosition.x + 2, y: lampmasterPosition.y + 2 }, // Bottom-right
    ];

    const sessionRef = doc(db, 'battleSessions', sessionId);
    const updates: any = {};

    lampPositions.forEach((pos, index) => {
      const lampId = `lamp-${index}-${Date.now()}`;
      const lampToken: LampToken = {
        id: lampId,
        name: `Lamp ${index + 1}`,
        position: pos,
        type: 'enemy',
        hp: 25,
        maxHp: 25,
        ac: 10,
        size: 1,
        color: '#FFA500', // Orange color for lamps
        lampIndex: index,
        statusEffects: {}
      };
      updates[`tokens.${lampId}`] = lampToken;
    });

    updates.updatedAt = serverTimestamp();
    await updateDoc(sessionRef, updates);
    console.log('✨ Created 4 lamp tokens around Lampmaster');
  }

  // Start the ritual sequence
  static async startLampRitual(sessionId: string, lampmasterId: string): Promise<number[]> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session) throw new Error('Session not found');

    // Generate random sequence of 4 lamps
    const sequence = this.generateRandomSequence();
    const currentRound = session.combatState?.round || 1;

    const ritual: LampmasterRitual = {
      id: `ritual-${Date.now()}`,
      isActive: true,
      sequence,
      playerAttempt: [],
      damageReduction: 0,
      createdOnRound: currentRound,
      willTriggerOnRound: currentRound + 1
    };

    const sessionRef = doc(db, 'battleSessions', sessionId);
    await updateDoc(sessionRef, {
      lampmasterRitual: ritual,
      updatedAt: serverTimestamp()
    });

    // Trigger visual glow sequence
    await this.playGlowSequence(sessionId, sequence);

    console.log('🔮 Lampmaster ritual started with sequence:', sequence);
    return sequence;
  }

  // Generate random sequence of lamp indices
  static generateRandomSequence(): number[] {
    const sequence: number[] = [];
    for (let i = 0; i < 4; i++) {
      sequence.push(Math.floor(Math.random() * 4));
    }
    return sequence;
  }

  // Play the visual glow sequence
  static async playGlowSequence(sessionId: string, sequence: number[]): Promise<void> {
    const sessionRef = doc(db, 'battleSessions', sessionId);
    
    for (let i = 0; i < sequence.length; i++) {
      const lampIndex = sequence[i];
      
      // Set lamp to glowing
      await updateDoc(sessionRef, {
        [`lampGlowState.${lampIndex}`]: true,
        updatedAt: serverTimestamp()
      });

      // Wait for glow duration
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Turn off glow
      await updateDoc(sessionRef, {
        [`lampGlowState.${lampIndex}`]: false,
        updatedAt: serverTimestamp()
      });

      // Brief pause between lamps
      if (i < sequence.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log('✨ Glow sequence completed');
  }

  // Record player's attack on a lamp
  static async recordLampAttack(sessionId: string, lampIndex: number, playerId: string): Promise<void> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session?.lampmasterRitual || !session.lampmasterRitual.isActive) {
      console.log('No active ritual to record attack for');
      return;
    }

    const ritual = session.lampmasterRitual as LampmasterRitual;
    ritual.playerAttempt.push(lampIndex);

    // Check if attempt is correct so far
    const attemptIndex = ritual.playerAttempt.length - 1;
    const isCorrect = ritual.sequence[attemptIndex] === lampIndex;

    if (!isCorrect) {
      console.log(`❌ Wrong lamp! Expected ${ritual.sequence[attemptIndex]}, got ${lampIndex}`);
      // Stop recording further attempts on wrong selection
      ritual.isActive = false;
    }

    // Calculate damage reduction based on correct attempts
    const correctCount = ritual.playerAttempt.filter((lamp, idx) => 
      lamp === ritual.sequence[idx]
    ).length;

    ritual.damageReduction = this.calculateDamageReduction(correctCount);

    const sessionRef = doc(db, 'battleSessions', sessionId);
    await updateDoc(sessionRef, {
      lampmasterRitual: ritual,
      updatedAt: serverTimestamp()
    });

    // Visual feedback for correct/incorrect
    await this.showAttackFeedback(sessionId, lampIndex, isCorrect);

    // If all 4 lamps attempted or wrong lamp hit, finalize the ritual
    if (ritual.playerAttempt.length >= 4 || !isCorrect) {
      await this.finalizeRitual(sessionId);
    }
  }

  // Calculate damage reduction percentage
  static calculateDamageReduction(correctLamps: number): number {
    switch (correctLamps) {
      case 0: return 0;    // 100% damage
      case 1: return 25;   // 75% damage
      case 2: return 50;   // 50% damage
      case 3: return 75;   // 25% damage
      case 4: return 100;  // 0% damage (canceled)
      default: return 0;
    }
  }

  // Show visual feedback for lamp attack
  static async showAttackFeedback(sessionId: string, lampIndex: number, isCorrect: boolean): Promise<void> {
    const sessionRef = doc(db, 'battleSessions', sessionId);
    
    await updateDoc(sessionRef, {
      [`lampFeedback.${lampIndex}`]: isCorrect ? 'correct' : 'incorrect',
      updatedAt: serverTimestamp()
    });

    // Clear feedback after a moment
    setTimeout(async () => {
      await updateDoc(sessionRef, {
        [`lampFeedback.${lampIndex}`]: null,
        updatedAt: serverTimestamp()
      });
    }, 1500);
  }

  // Finalize the ritual and prepare for damage application
  static async finalizeRitual(sessionId: string): Promise<void> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session?.lampmasterRitual) return;

    const ritual = session.lampmasterRitual as LampmasterRitual;
    const correctCount = ritual.playerAttempt.filter((lamp, idx) => 
      lamp === ritual.sequence[idx]
    ).length;

    console.log(`🎯 Ritual complete! ${correctCount}/4 correct. Damage reduction: ${ritual.damageReduction}%`);

    const sessionRef = doc(db, 'battleSessions', sessionId);
    await updateDoc(sessionRef, {
      'lampmasterRitual.isActive': false,
      updatedAt: serverTimestamp()
    });
  }

  // Apply Sword of Light damage on Lampmaster's next turn
  static async applySwordOfLight(sessionId: string, lampmasterId: string): Promise<void> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session?.lampmasterRitual) {
      console.log('No ritual data found');
      return;
    }

    const ritual = session.lampmasterRitual as LampmasterRitual;
    const baseDamage = 45; // 4d10+5 average
    const damageMultiplier = (100 - ritual.damageReduction) / 100;
    const actualDamage = Math.floor(baseDamage * damageMultiplier);

    if (ritual.damageReduction === 100) {
      console.log('⚔️ Sword of Light CANCELED! Lampmaster\'s turn skipped.');
      
      // Skip Lampmaster's turn
      await FirestoreService.nextTurn(sessionId);
      return;
    }

    // Get all player tokens
    const playerTokens = Object.values(session.tokens).filter(t => t.type === 'player');
    
    // Apply damage to all players
    for (const player of playerTokens) {
      const action: GMCombatAction = {
        id: `sword-of-light-${Date.now()}-${player.id}`,
        type: 'ability',
        playerId: lampmasterId,
        playerName: 'Lampmaster',
        targetId: player.id,
        targetName: player.name,
        sourcePosition: session.tokens[lampmasterId]?.position || { x: 0, y: 0 },
        range: 999,
        timestamp: new Date(),
        resolved: false,
        hit: true,
        damage: actualDamage,
        abilityName: `Sword of Light (${ritual.damageReduction}% reduced)`,
        needsDamageInput: false,
        damageApplied: false,
        ultimateType: 'sword_of_light'
      };

      await FirestoreService.addCombatAction(sessionId, action);
    }

    console.log(`⚔️ Sword of Light deals ${actualDamage} damage to all players!`);

    // Clear the ritual data
    await updateDoc(doc(db, 'battleSessions', sessionId), {
      lampmasterRitual: null,
      lampGlowState: {},
      lampFeedback: {},
      updatedAt: serverTimestamp()
    });
  }

  // Check if lamps are destroyed and update Lampmaster's AC
  static async updateLampmasterAC(sessionId: string, lampmasterId: string): Promise<void> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session) return;

    const lampTokens = Object.values(session.tokens).filter(t => 
      t.id.startsWith('lamp-') && (t.hp || 0) > 0
    );

    const lampmasterToken = session.tokens[lampmasterId];
    if (!lampmasterToken) return;

    // AC is 17 with lamps, 15 without
    const newAC = lampTokens.length > 0 ? 17 : 15;

    if (lampmasterToken.ac !== newAC) {
      await updateDoc(doc(db, 'battleSessions', sessionId), {
        [`tokens.${lampmasterId}.ac`]: newAC,
        updatedAt: serverTimestamp()
      });
      
      console.log(`🛡️ Lampmaster AC updated to ${newAC} (${lampTokens.length} lamps active)`);
    }
  }

  // Get active lamps for Light Shot ability
  static async getActiveLamps(sessionId: string): Promise<LampToken[]> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session) return [];

    return Object.values(session.tokens).filter(t => 
      t.id.startsWith('lamp-') && (t.hp || 0) > 0
    ) as LampToken[];
  }
}