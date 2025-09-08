// src/hooks/useCombat.ts
import { useState, useCallback } from 'react';
import { FirestoreService } from '../services/firestoreService';
import { useBattleSession } from './useBattleSession';
import type {
  CombatAction,
  Position,
  InitiativeEntry,
  BattleToken,
  Character,
} from '../types';

export function useCombat(sessionId: string) {
  const [pendingAction, setPendingAction] = useState<CombatAction | null>(null);
  const [targetingMode, setTargetingMode] = useState<{
    active: boolean;
    abilityId?: string;
    range?: number;
    validTargets?: string[];
    sourcePosition?: Position;
  }>({ active: false });

  const {
    session,
    loading,
    error,
    moveToken: baseMoveToken,
    addToken,
    removeToken,
  } = useBattleSession(sessionId);

  const attemptMove = useCallback(
    async (tokenId: string, newPosition: Position, characterId?: string): Promise<boolean> => {
      try {
        return await FirestoreService.validateAndMoveToken(
          sessionId,
          tokenId,
          newPosition,
          characterId
        );
      } catch (e) {
        console.error('Failed to move token:', e);
        return false;
      }
    },
    [sessionId]
  );

  const startCombat = useCallback(
    async (initiativeOrder: InitiativeEntry[]) => {
      await FirestoreService.startCombat(sessionId, initiativeOrder);
    },
    [sessionId]
  );

  const endCombat = useCallback(async () => {
    await FirestoreService.endCombat(sessionId);
    setTargetingMode({ active: false });
    setPendingAction(null);
  }, [sessionId]);

  const nextTurn = useCallback(async () => {
    await FirestoreService.nextTurn(sessionId);
    setPendingAction(null);
    setTargetingMode({ active: false });
  }, [sessionId]);

  const startTargeting = useCallback(
    (
      abilityId: string,
      sourcePosition: Position,
      tokens: BattleToken[],
      range: number,
      targetType: 'enemy' | 'ally' | 'any' = 'enemy'
    ) => {
      const validTargets = FirestoreService.getValidTargets(
        sourcePosition,
        tokens,
        range,
        targetType
      );

      setTargetingMode({
        active: true,
        abilityId,
        range,
        validTargets,
        sourcePosition,
      });
    },
    []
  );

  const cancelTargeting = useCallback(() => {
    setTargetingMode({ active: false });
    setPendingAction(null);
  }, []);

  const selectTarget = useCallback(
    async (targetId: string, playerId: string) => {
      if (!targetingMode.active || !targetingMode.abilityId || !targetingMode.sourcePosition) return;

      const action: CombatAction = {
        id: `action-${Date.now()}`,
        type: 'ability',
        playerId,
        targetId,
        sourcePosition: targetingMode.sourcePosition,
        range: targetingMode.range || 0,
        timestamp: new Date(),
        resolved: false,
      };

      try {
        await FirestoreService.addCombatAction(sessionId, action);
        setPendingAction(action);
        setTargetingMode({ active: false });
      } catch (e) {
        console.error('Failed to add combat action:', e);
      }
    },
    [sessionId, targetingMode]
  );

  const setInitiativeOrder = useCallback(
    async (initiativeOrder: InitiativeEntry[]) => {
      await FirestoreService.setInitiativeOrder(sessionId, initiativeOrder);
    },
    [sessionId]
  );

  const calculateRange = useCallback((from: Position, to: Position) => {
    return FirestoreService.calculateRange(from, to);
  }, []);

  const getMovementRange = useCallback((character: Character): number => {
    let movement = 30;
    if (character.name.toLowerCase() === 'maelle' && character.stance === 'agile') {
      movement = 60;
    }
    return movement;
  }, []);

  const resolveCombatAction = useCallback(
    async (actionId: string) => {
      try {
        await FirestoreService.resolveCombatAction(sessionId, actionId);
        if (pendingAction?.id === actionId) setPendingAction(null);
      } catch (e) {
        console.error('Failed to resolve combat action:', e);
      }
    },
    [sessionId, pendingAction]
  );

  const updateEnemyHP = useCallback(
    async (enemyId: string, currentHP: number) => {
      await FirestoreService.updateEnemyHP(sessionId, enemyId, currentHP);
    },
    [sessionId]
  );

  const createAttackAction = useCallback(
    async (
      playerId: string,
      targetId: string,
      sourcePosition: Position,
      acRoll: number,
      range: number,
      abilityName = 'Basic Attack'
    ) => {
      return await FirestoreService.createAttackAction(
        sessionId,
        playerId,
        targetId,
        sourcePosition,
        acRoll,
        abilityName
      );
    },
    [sessionId]
  );

  const getValidTargets = useCallback(
    (
      sourcePosition: Position,
      tokens: BattleToken[],
      range: number,
      targetType: 'enemy' | 'ally' | 'any' = 'enemy'
    ): string[] => {
      return FirestoreService.getValidTargets(sourcePosition, tokens, range, targetType);
    },
    []
  );

  const isPlayerTurn = useCallback(
    (playerId: string) => session?.combatState?.currentTurn === playerId,
    [session]
  );

  const isCombatActive = useCallback(() => !!session?.combatState?.isActive, [session]);

  const getCurrentRound = useCallback(() => session?.combatState?.round || 0, [session]);

  return {
    session,
    loading,
    error,

    // combat state
    startCombat,
    endCombat,
    nextTurn,
    setInitiativeOrder,
    isPlayerTurn,
    isCombatActive,
    getCurrentRound,

    // movement
    attemptMove,
    getMovementRange,
    calculateRange,

    // targeting
    targetingMode,
    startTargeting,
    cancelTargeting,
    selectTarget,
    getValidTargets,

    // actions
    pendingAction,
    createAttackAction,
    resolveCombatAction,

    // tokens
    addToken,
    removeToken,
    updateEnemyHP,
  };
}
