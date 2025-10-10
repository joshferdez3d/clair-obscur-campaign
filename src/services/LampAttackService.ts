// src/services/LampAttackService.ts
import { LampmasterService } from './LampmasterService';
import { FirestoreService } from './firestoreService';

export const handlePlayerLampAttack = async (
  sessionId: string,
  playerId: string,
  targetLampId: string
) => {
  console.log(`🔮 Player ${playerId} attacking lamp ${targetLampId}`);
  
  // Extract lamp index from ID (e.g., "lamp-2-timestamp" -> 2)
  const lampIndex = parseInt(targetLampId.split('-')[1]);
  
  if (isNaN(lampIndex)) {
    console.error('❌ Invalid lamp ID:', targetLampId);
    return;
  }
  
  // Check if ritual is active
  const session = await FirestoreService.getBattleSession(sessionId);
  if (!session?.lampmasterRitual) {
    console.log('⚠️ No active ritual - lamp attack has no effect');
    return;
  }
  
  if (!session.lampmasterRitual.isActive) {
    console.log('⚠️ Ritual is not active - too late to attack lamps');
    return;
  }
  
  // Record the attack in the ritual system
  await LampmasterService.recordLampAttack(sessionId, lampIndex, playerId);
  
  // Get updated ritual state
  const updatedSession = await FirestoreService.getBattleSession(sessionId);
  const ritual = updatedSession?.lampmasterRitual;
  
  if (!ritual) return;
  
  // Provide feedback
  const attemptIndex = ritual.playerAttempt.length - 1;
  const wasCorrect = ritual.sequence[attemptIndex] === lampIndex;
  const correctCount = ritual.playerAttempt.filter((lamp, idx) => 
    lamp === ritual.sequence[idx]
  ).length;
  
  console.log(`${wasCorrect ? '✅' : '❌'} Lamp ${lampIndex + 1} - ${wasCorrect ? 'CORRECT' : 'WRONG'}!`);
  console.log(`   Progress: ${correctCount}/${ritual.sequence.length} correct`);
  console.log(`   Current reduction: ${ritual.damageReduction}%`);
  
  if (!ritual.isActive) {
    // Ritual ended
    if (correctCount === 4) {
      console.log('🎉 RITUAL COMPLETE! Sword of Light will be canceled!');
    } else {
      console.log(`⚠️ RITUAL FAILED! Only ${correctCount}/4 correct. Damage: ${100 - ritual.damageReduction}%`);
    }
  }
};