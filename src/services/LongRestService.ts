// src/services/LongRestService.ts
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { HPSyncService } from './HPSyncService'; // ADD THIS IMPORT

export class LongRestService {
  
  static async longRestCharacter(characterId: string): Promise<void> {
    const characterRef = doc(db, 'characters', characterId);
    const characterSnap = await getDoc(characterRef);
    
    if (!characterSnap.exists()) {
      throw new Error(`Character ${characterId} not found`);
    }
    
    const character = characterSnap.data();
    
    // Build base update object
    const updates: any = {
      currentHP: character.maxHP,
      charges: character.maxCharges || 0,
      afterimageStacks: 0,
      phantomStrikeUsed: false,
      'combatState.overchargePoints': 0,
      'combatState.elementalStains': [],
      'combatState.chargedFateCard': null,
      'combatState.afterimageStacks': 0,
      'combatState.bonusActionCooldown': 0,
    };
    
    // Only add stance for Maelle (fixing the undefined issue)
    if (characterId === 'maelle') {
      updates.stance = 'offensive';
    }
    
    // Update character - restore HP and reset states
    await updateDoc(characterRef, updates);
    
    console.log(`✅ ${character.name} completed long rest`);
  }
  
  static async longRestParty(sessionId: string = 'test-session'): Promise<void> {
    const characterIds = ['maelle', 'gustave', 'lune', 'sciel'];
    const promises = characterIds.map(id => this.longRestCharacter(id));
    await Promise.all(promises);
    
    // ✅ FIX: Sync all character HP back to their tokens in the session
    await HPSyncService.syncAllCharacterHPToTokens(sessionId);
    
    console.log(`✅ All characters completed long rest`);
  }
}