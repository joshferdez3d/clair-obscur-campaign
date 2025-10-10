import { LampmasterService } from './LampmasterService';
import { FirestoreService } from './firestoreService';

export const handlePlayerLampAttack = async (
  sessionId: string,
  playerId: string,
  targetLampId: string
) => {
  // Extract lamp index from ID (e.g., "lamp-2-timestamp" -> 2)
  const lampIndex = parseInt(targetLampId.split('-')[1]);
  
  if (isNaN(lampIndex)) {
    console.error('Invalid lamp ID:', targetLampId);
    return;
  }
  
  // Record the attack in the ritual system
  await LampmasterService.recordLampAttack(sessionId, lampIndex, playerId);
  
  // Provide feedback to player
  const session = await FirestoreService.getBattleSession(sessionId);
  const ritual = session?.lampmasterRitual;
  
  if (ritual && !ritual.isActive) {
    // Ritual ended (either completed or failed)
    const correctCount = ritual.playerAttempt.filter((lamp, idx) => 
      lamp === ritual.sequence[idx]
    ).length;
    
    alert(`Ritual ${correctCount === 4 ? 'COMPLETE' : 'FAILED'}! ${correctCount}/4 lamps correct. Damage reduction: ${ritual.damageReduction}%`);
  }
};