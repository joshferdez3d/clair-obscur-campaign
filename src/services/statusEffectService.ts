import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { FirestoreService } from './firestoreService';

export class StatusEffectService {
  // Apply fire damage at start of Lune's turn
  static async processBurnDamage(sessionId: string, currentCharacterId: string) {
    if (currentCharacterId !== 'lune') return;
    
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session?.tokens) return;
    
    const updates: any = {};
    let hasUpdates = false;
    
    Object.entries(session.tokens).forEach(([tokenId, token]: [string, any]) => {
      if (token.statusEffects?.fire && token.statusEffects.fire.turnsRemaining > 0) {
        const damage = token.statusEffects.fire.damage || 5;
        const newHP = Math.max(0, (token.hp || 0) - damage);
        
        updates[`tokens.${tokenId}.hp`] = newHP;
        
        // Create damage popup notification
        console.log(`🔥 Burn damage: ${token.name} takes ${damage} fire damage`);
        hasUpdates = true;
        
        // Remove token if dead
        if (newHP <= 0) {
          delete session.tokens[tokenId];
          updates[`tokens`] = session.tokens;
        }
      }
    });
    
    if (hasUpdates) {
      const ref = doc(db, 'battleSessions', sessionId);
      await updateDoc(ref, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    }
  }
  
  // Decrement status effect durations at end of round
  static async updateStatusEffectDurations(sessionId: string) {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session?.tokens) return;
    
    const updates: any = {};
    let hasUpdates = false;
    
    Object.entries(session.tokens).forEach(([tokenId, token]: [string, any]) => {
      if (token.statusEffects) {
        // Start with existing effects to preserve special effects like rallyingCry
        const updatedEffects: any = { ...token.statusEffects };
        
        // Process ONLY Lune's elemental status effects
        ['fire', 'ice', 'blind'].forEach(effect => {
          if (updatedEffects[effect]) {
            const remaining = updatedEffects[effect].turnsRemaining - 1;
            
            if (remaining > 0) {
              updatedEffects[effect] = {
                ...updatedEffects[effect],
                turnsRemaining: remaining
              };
            } else {
              // Remove expired effect
              delete updatedEffects[effect];
            }
          }
        });
        
        // Only update if there are status effects (don't wipe out the entire object)
        if (Object.keys(updatedEffects).length > 0) {
          updates[`tokens.${tokenId}.statusEffects`] = updatedEffects;
          hasUpdates = true;
        }
      }
    });
    
    // THIS PART WAS MISSING - Apply the updates to Firebase
    if (hasUpdates) {
      const ref = doc(db, 'battleSessions', sessionId);
      await updateDoc(ref, {
        ...updates,
        updatedAt: serverTimestamp()
      });
      console.log('✅ Status effect durations updated');
    }
  }
}