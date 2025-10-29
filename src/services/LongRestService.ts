// src/services/LongRestService.ts
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export class LongRestService {
  
  static async longRestCharacter(characterId: string): Promise<void> {
    const characterRef = doc(db, 'characters', characterId);
    const characterSnap = await getDoc(characterRef);
    
    if (!characterSnap.exists()) {
      throw new Error(`Character ${characterId} not found`);
    }
    
    const character = characterSnap.data();
    
    // Update character - restore HP and reset states
    await updateDoc(characterRef, {
      currentHP: character.maxHP,
      charges: character.maxCharges || 0,
      stance: characterId === 'maelle' ? 'offensive' : undefined,
      afterimageStacks: 0,
      phantomStrikeUsed: false,
      'combatState.overchargePoints': 0,
      'combatState.elementalStains': [],
      'combatState.chargedFateCard': null,
      'combatState.afterimageStacks': 0,
      'combatState.bonusActionCooldown': 0,
    });
    
    console.log(`✅ ${character.name} completed long rest`);
  }
  
  static async longRestParty(): Promise<void> {
    const characterIds = ['maelle', 'gustave', 'lune', 'sciel'];
    const promises = characterIds.map(id => this.longRestCharacter(id));
    await Promise.all(promises);
    console.log(`✅ All characters completed long rest`);
  }
}