import { useState, useEffect } from 'react';
import { FirestoreService } from '../services/firestoreService';
import type { StormState, PendingStormRoll } from '../types';

export const useStormSystem = (sessionId: string) => {
  const [stormState, setStormState] = useState<StormState | null>(null);
  const [pendingRoll, setPendingRoll] = useState<PendingStormRoll | null>(null);

  useEffect(() => {
    const unsubscribe = FirestoreService.subscribeToBattleSession(sessionId, (session) => {
      if (session) {
        setStormState(session.stormState || null);
        setPendingRoll(session.pendingStormRoll || null);
      }
    });

    return unsubscribe;
  }, [sessionId]);

  return {
    stormState,
    pendingRoll,
    isStormActive: stormState?.isActive || false
  };
};