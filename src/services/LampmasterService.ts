// src/services/LampmasterService.ts
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
  sequence: number[]; // Array of lamp indices in order (e.g., [2, 0, 3, 1])
  playerAttempt: number[]; // Player's attempt at the sequence
  damageReduction: number; // 0%, 25%, 50%, 75%, or 100%
  createdOnRound: number;
  willTriggerOnRound: number;
}

export class LampmasterService {
  // Start the ritual sequence
  static async startLampRitual(sessionId: string, lampmasterId: string): Promise<number[]> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session) throw new Error('Session not found');

    // Generate random sequence of 4 lamps (each lamp 0-3)
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

    console.log('🔮 ===== LAMP RITUAL STARTED =====');
    console.log(`   Sequence: [${sequence.map(i => i + 1).join(', ')}]`);
    console.log(`   Players must attack lamps IN THIS ORDER`);
    console.log(`   Created: Round ${currentRound}`);
    console.log(`   Triggers: Round ${currentRound + 1}`);
    console.log('================================');

    // Trigger visual glow sequence
    await this.playGlowSequence(sessionId, sequence);

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
    
    await new Promise(resolve => setTimeout(resolve, 6000));
    console.log('✨ Starting glow sequence...');

    for (let i = 0; i < sequence.length; i++) {
      const lampIndex = sequence[i];
      
      // Set lamp to glowing
      await updateDoc(sessionRef, {
        [`lampGlowState.${lampIndex}`]: true,
        updatedAt: serverTimestamp()
      });

      // Wait for glow duration
      await new Promise(resolve => setTimeout(resolve, 600));

      // Turn off glow
      await updateDoc(sessionRef, {
        [`lampGlowState.${lampIndex}`]: false,
        updatedAt: serverTimestamp()
      });

      // Brief pause between lamps
      if (i < sequence.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.log('✨ Glow sequence completed');
  }

  // Record player's attack on a lamp
  static async recordLampAttack(sessionId: string, lampIndex: number, playerId: string): Promise<void> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session?.lampmasterRitual) {
      console.log('❌ No ritual exists');
      return;
    }

    if (!session.lampmasterRitual.isActive) {
      console.log('⚠️ Ritual is not active - attacks have no effect');
      return;
    }

    const ritual = session.lampmasterRitual as LampmasterRitual;
    
    // Check if already attempted all lamps
    if (ritual.playerAttempt.length >= 4) {
      console.log('⚠️ Already attempted 4 lamps - ritual complete');
      return;
    }
    
    ritual.playerAttempt.push(lampIndex);
    const attemptIndex = ritual.playerAttempt.length - 1;
    
    // Check if this lamp is correct for this position in sequence
    const expectedLamp = ritual.sequence[attemptIndex];
    const isCorrect = expectedLamp === lampIndex;

    console.log(`🎯 ===== LAMP ATTACK =====`);
    console.log(`   Player: ${playerId}`);
    console.log(`   Attempt: ${attemptIndex + 1}/4`);
    console.log(`   Attacked: Lamp ${lampIndex + 1}`);
    console.log(`   Expected: Lamp ${expectedLamp + 1}`);
    console.log(`   Result: ${isCorrect ? '✅ CORRECT' : '❌ WRONG'}`);
    console.log(`   Sequence so far: [${ritual.sequence.slice(0, attemptIndex + 1).map(i => i + 1).join(', ')}]`);
    console.log(`   Player attempt: [${ritual.playerAttempt.map(i => i + 1).join(', ')}]`);

    if (!isCorrect) {
      console.log(`❌ WRONG LAMP! Ritual stops here.`);
      ritual.isActive = false;
    } else if (ritual.playerAttempt.length >= 4) {
      console.log('🎉 ALL 4 LAMPS CORRECT! Ritual complete!');
      ritual.isActive = false;
    }

    // Calculate damage reduction based on correct attempts
    const correctCount = ritual.playerAttempt.filter((lamp, idx) => 
      lamp === ritual.sequence[idx]
    ).length;

    ritual.damageReduction = this.calculateDamageReduction(correctCount);
    
    console.log(`   Correct so far: ${correctCount}/4`);
    console.log(`   Damage reduction: ${ritual.damageReduction}%`);
    console.log(`   Remaining damage: ${100 - ritual.damageReduction}%`);
    console.log('========================');

    // Update session FIRST
    const sessionRef = doc(db, 'battleSessions', sessionId);
    await updateDoc(sessionRef, {
      lampmasterRitual: ritual,
      updatedAt: serverTimestamp()
    });

    // Then show visual feedback
    console.log(`🎨 About to show feedback for lamp ${lampIndex}`);
    await this.showAttackFeedback(sessionId, lampIndex, isCorrect);
  }

  // Calculate damage reduction percentage
  static calculateDamageReduction(correctLamps: number): number {
    switch (correctLamps) {
      case 0: return 0;    // 100% damage (27)
      case 1: return 25;   // 75% damage (20)
      case 2: return 50;   // 50% damage (13)
      case 3: return 75;   // 25% damage (6)
      case 4: return 100;  // 0% damage - CANCELED
      default: return 0;
    }
  }

  // Show visual feedback for lamp attack
  static async showAttackFeedback(sessionId: string, lampIndex: number, isCorrect: boolean): Promise<void> {
    const sessionRef = doc(db, 'battleSessions', sessionId);
    
    console.log(`🎨 Showing lamp feedback: ${lampIndex} - ${isCorrect ? 'correct' : 'incorrect'}`);
    
    await updateDoc(sessionRef, {
      [`lampFeedback.${lampIndex}`]: isCorrect ? 'correct' : 'incorrect',
      updatedAt: serverTimestamp()
    });

    // Clear feedback after animation completes (increased from 1500ms to 2000ms)
    setTimeout(async () => {
      try {
        await updateDoc(sessionRef, {
          [`lampFeedback.${lampIndex}`]: null,
          updatedAt: serverTimestamp()
        });
        console.log(`🎨 Cleared lamp feedback for ${lampIndex}`);
      } catch (error) {
        console.error('Failed to clear lamp feedback:', error);
      }
    }, 2000); // Increased time so animation is more visible
  }

  // Finalize the ritual
  static async finalizeRitual(sessionId: string): Promise<void> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session?.lampmasterRitual) {
      console.log('❌ No ritual to finalize');
      return;
    }

    const ritual = session.lampmasterRitual as LampmasterRitual;
    const correctCount = ritual.playerAttempt.filter((lamp, idx) => 
      lamp === ritual.sequence[idx]
    ).length;

    console.log(`🔮 ===== RITUAL FINALIZED =====`);
    console.log(`   Attempts made: ${ritual.playerAttempt.length}/4`);
    console.log(`   Correct lamps: ${correctCount}/4`);
    console.log(`   Damage reduction: ${ritual.damageReduction}%`);
    console.log(`   Remaining damage: ${100 - ritual.damageReduction}%`);
    console.log(`   Will trigger on round: ${ritual.willTriggerOnRound}`);
    
    if (correctCount === 4) {
      console.log(`   ✅ PERFECT! Sword of Light will be CANCELED!`);
    } else if (correctCount >= 2) {
      console.log(`   ⚠️ Partial success - significant damage reduction`);
    } else {
      console.log(`   💀 Failure - minimal damage reduction`);
    }
    console.log(`==============================`);

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
    console.log('❌ No ritual data found');
    return;
  }

  const ritual = session.lampmasterRitual as LampmasterRitual;
  const baseDamage = 27; // 4d10+5 average
  const damageMultiplier = (100 - ritual.damageReduction) / 100;
  const actualDamage = Math.floor(baseDamage * damageMultiplier);

  console.log(`⚔️ ===== SWORD OF LIGHT TRIGGERED =====`);
  console.log(`   Base damage: ${baseDamage}`);
  console.log(`   Reduction: ${ritual.damageReduction}%`);
  console.log(`   Actual damage: ${actualDamage}`);
  console.log(`   Correct lamps: ${ritual.playerAttempt.filter((l, i) => l === ritual.sequence[i]).length}/4`);
  console.log('====================================');

  if (ritual.damageReduction === 100) {
    console.log('✅ SWORD OF LIGHT CANCELED!');
    
    // Create ONE informational action (already resolved)
    const action: GMCombatAction = {
      id: `sword-canceled-${Date.now()}`,
      type: 'ability',
      playerId: lampmasterId,
      playerName: 'Lampmaster',
      targetId: 'all-players',
      targetName: 'All Players',
      sourcePosition: session.tokens[lampmasterId]?.position || { x: 0, y: 0 },
      range: 999,
      timestamp: new Date(),
      resolved: true, // ✅ CHANGED: Auto-resolved
      hit: false,
      abilityName: 'Sword of Light (CANCELED)',
      needsDamageInput: false,
      damageApplied: true, // ✅ CHANGED: Already handled
      description: '✅ Players perfectly disrupted the lamp ritual! Sword of Light was canceled!',
      ultimateType: 'sword_of_light_canceled'
    };
    
    await FirestoreService.addCombatAction(sessionId, action);
    
    // Clear ritual data
    await updateDoc(doc(db, 'battleSessions', sessionId), {
      lampmasterRitual: null,
      lampGlowState: {},
      lampFeedback: {},
      updatedAt: serverTimestamp()
    });
    
    return;
  }

  // Get all player tokens
  const playerTokens = Object.values(session.tokens).filter(t => t.type === 'player');
  
  console.log(`💥 Dealing ${actualDamage} damage to ${playerTokens.length} players`);
  
  // ✅ APPLY DAMAGE DIRECTLY - NO POPUPS
  const updates: any = {};
  for (const player of playerTokens) {
    const currentHP = player.hp || 0;
    const newHP = Math.max(0, currentHP - actualDamage);
    
    // Update token HP
    updates[`tokens.${player.id}.hp`] = newHP;
    
    // Update character HP if it's a player
    if (player.characterId) {
      await FirestoreService.updateCharacterHP(player.characterId, newHP);
    }
    
    console.log(`   ${player.name}: ${currentHP} → ${newHP} HP`);
  }

  // ✅ CREATE ONE INFORMATIONAL ACTION (already resolved)
  const summaryAction: GMCombatAction = {
    id: `sword-of-light-${Date.now()}`,
    type: 'ability',
    playerId: lampmasterId,
    playerName: 'Lampmaster',
    targetId: 'all-players',
    targetName: 'All Players',
    sourcePosition: session.tokens[lampmasterId]?.position || { x: 0, y: 0 },
    range: 999,
    timestamp: new Date(),
    resolved: true, // ✅ CHANGED: Auto-resolved
    hit: true,
    damage: actualDamage,
    abilityName: `Sword of Light (${ritual.damageReduction}% reduced)`,
    needsDamageInput: false,
    damageApplied: true, // ✅ CHANGED: Already handled
    ultimateType: 'sword_of_light',
    description: `Lampmaster unleashes Sword of Light dealing ${actualDamage} damage to all players! (${ritual.playerAttempt.filter((l, i) => l === ritual.sequence[i]).length}/4 lamps disrupted)`
  };

  // Apply all updates in one batch
  updates.pendingActions = arrayUnion(summaryAction);
  updates.lampmasterRitual = null;
  updates.lampGlowState = {};
  updates.lampFeedback = {};
  updates.updatedAt = serverTimestamp();

  await updateDoc(doc(db, 'battleSessions', sessionId), updates);
  
  console.log('✅ Sword of Light damage applied to all players!');
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

  // Get active lamps
  static async getActiveLamps(sessionId: string): Promise<LampToken[]> {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session) return [];

    return Object.values(session.tokens).filter(t => 
      t.id.startsWith('lamp-') && (t.hp || 0) > 0
    ) as LampToken[];
  }
}