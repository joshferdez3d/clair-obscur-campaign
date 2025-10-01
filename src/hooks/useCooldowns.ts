import { useState, useEffect, useCallback } from 'react';
import { CooldownService } from '../services/CooldownService';
import { FirestoreService } from '../services/firestoreService';

export function useCooldowns(sessionId: string | undefined, tokenId: string | undefined) {
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

  // Subscribe to token cooldowns
  useEffect(() => {
    if (!sessionId || !tokenId) return;

    const unsubscribe = FirestoreService.subscribeToBattleSession(sessionId, (session) => {
      const token = session?.tokens?.[tokenId];
      if (!token) return;

      // Convert cooldown data to simple number map for UI
      const cooldownMap: Record<string, number> = {};
      if (token.cooldowns) {
        Object.entries(token.cooldowns).forEach(([abilityId, data]: [string, any]) => {
          cooldownMap[abilityId] = data.turnsRemaining;
        });
      }

      setCooldowns(cooldownMap);
    });

    return () => unsubscribe();
  }, [sessionId, tokenId]);

  // Apply cooldown function
  const applyCooldown = useCallback(
    async (abilityId: string, abilityName: string, duration: number) => {
      if (!sessionId || !tokenId) return;
      await CooldownService.applyCooldown(sessionId, tokenId, abilityId, abilityName, duration);
    },
    [sessionId, tokenId]
  );

  // Get cooldown for specific ability
  const getCooldown = useCallback(
    (abilityId: string): number => {
      return cooldowns[abilityId] || 0;
    },
    [cooldowns]
  );

  // Check if ability is on cooldown
  const isOnCooldown = useCallback(
    (abilityId: string): boolean => {
      return getCooldown(abilityId) > 0;
    },
    [getCooldown]
  );

  return {
    cooldowns,
    applyCooldown,
    getCooldown,
    isOnCooldown
  };
}