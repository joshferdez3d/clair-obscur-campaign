// src/pages/PlayerView.tsx - UPDATED WITH PERSISTENT COMBAT STATE
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { GustaveCharacterSheet } from '../components/CharacterSheet/GustaveCharacterSheet';
import { LuneCharacterSheet } from '../components/CharacterSheet/LuneCharacterSheet';
import { ScielCharacterSheet } from '../components/CharacterSheet/ScielCharacterSheet';
import { MaelleCharacterSheet } from '../components/CharacterSheet/MaelleCharacterSheet';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { useCharacter } from '../hooks/useCharacter';
import { useCombat } from '../hooks/useCombat';
import { usePersistentCombatState } from '../hooks/usePersistentCombatState';
import type { BattleToken } from '../types';
import { useMaelleAfterimage } from '../services/maelleAfterimageService';
import { useFirestoreListener } from '../hooks/useFirestoreListener';
import { FirestoreService } from '../services/firestoreService';

// Add proper interface for session tokens
interface SessionToken extends BattleToken {
  characterId?: string;
  position: { x: number; y: number };
  type: 'player' | 'enemy' | 'npc';
  hp: number;
  maxHp: number;
  ac?: number;
}

export function PlayerView() {
  const { characterId } = useParams<{ characterId: string }>();
  const sessionId = 'test-session';
  
  // NEW: Use persistent combat state hook
  const persistentCombatState = usePersistentCombatState(characterId || '', sessionId);
  
  // Simple UI state that doesn't need persistence
  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(null);
  const currentTurnRef = useRef<string>('');

  // Use different session sources for different characters
  const { session: firestoreSession } = useFirestoreListener(sessionId);
  const maelleAfterimage = useMaelleAfterimage(sessionId);

  const {
    character,
    loading: characterLoading,
    error: characterError,
    changeCharges,
  } = useCharacter(characterId || '');

  const {
    session: combatSession,
    loading: combatLoading,
    error: combatError,
    cancelTargeting,
    nextTurn,
    isPlayerTurn,
    createAttackAction,
    addToken,
  } = useCombat(sessionId);

  // FIXED: Use the appropriate session (maelleAfterimage doesn't have session property)
  const session = firestoreSession || combatSession;

  // NEW: Sync combat state with current battle round/turn
  useEffect(() => {
    if (session?.combatState?.isActive && characterId) {
      const currentRound = session.combatState.round || 1;
      const currentTurn = session.combatState.currentTurn || '';
      
      // Sync our persistent state with the current battle state
      persistentCombatState.syncWithCombatRound(currentRound, currentTurn);
    }
  }, [  session?.combatState?.isActive, session?.combatState?.round, session?.combatState?.currentTurn, characterId, persistentCombatState]);

  // NEW: Auto-reset hasActedThisTurn when it's a new turn
  useEffect(() => {
    const currentTurn = session?.combatState?.currentTurn || '';
    
    if (currentTurn !== currentTurnRef.current) {
      currentTurnRef.current = currentTurn;
      
      // If it's this character's turn and they previously acted, reset the flag
      if (currentTurn === characterId && persistentCombatState.hasActedThisTurn) {
        console.log(`New turn for ${characterId}, resetting hasActedThisTurn`);
        persistentCombatState.setHasActedThisTurn(false);
      }
    }
  }, [session?.combatState?.currentTurn, characterId, persistentCombatState]);

  // Extract commonly used values
  const loading = characterLoading || combatLoading || persistentCombatState.loading;
  const error = characterError || combatError || persistentCombatState.error;
  const combatActive = session?.combatState?.isActive || false;
  const myTurn = isPlayerTurn(characterId || '');

  // Token and enemy logic (unchanged)
  const tokensArray = Object.values(session?.tokens || {}) as SessionToken[];
  const playerToken = tokensArray.find((token) => token.characterId === characterId);
  const availableEnemies = tokensArray
    .filter((token) => token.type === 'enemy' && (token.hp || 0) > 0)
    .map((token) => ({
      id: token.id,
      name: token.name,
      position: token.position,
      hp: token.hp || 0,
      maxHp: token.maxHp || 0,
      ac: token.ac || 13,
    }));

  // UPDATED: Event handlers now use persistent state
  
  const handleHPChange = async (delta: number) => {
    if (!character) return;
    const newHP = Math.max(0, Math.min(character.maxHP, character.currentHP + delta));
    
    try {
      await FirestoreService.updateCharacterHP(characterId || '', newHP);
    } catch (error) {
      console.error('Error updating HP:', error);
    }
  };

  const handleAbilityPointsChange = async (delta: number) => {
    if (!character) return;
    await changeCharges(delta);
  };

  // NEW: Updated handlers using persistent state
  const handleOverchargePointsChange = async (delta: number) => {
    const newPoints = Math.max(0, Math.min(3, persistentCombatState.overchargePoints + delta));
    await persistentCombatState.setOverchargePoints(newPoints);
  };

  // FIXED: Use correct method name from maelleAfterimage hook
  const handleAfterimageChange = (delta: number) => {
    if (character?.name.toLowerCase() === 'maelle') {
      // Use updateStacks instead of updateAfterimageStacks
      maelleAfterimage.updateStacks(delta);
    }
  };

  // FIXED: Pass required parameter to usePhantomStrike
  const handlePhantomStrikeUse = () => {
    if (character?.name.toLowerCase() === 'maelle') {
      // usePhantomStrike expects enemiesHit parameter
      const enemiesInRange = availableEnemies.filter(enemy => {
        const distance = Math.abs(enemy.position.x - (playerToken?.position.x || 0)) + 
                        Math.abs(enemy.position.y - (playerToken?.position.y || 0));
        return distance <= 10; // 50ft range = 10 squares
      });
      maelleAfterimage.usePhantomStrike(enemiesInRange.length);
    }
  };

  const handleAbilityUse = async (ability: any) => {
    const abilityId = typeof ability === 'string' ? ability : ability.id;
    console.log(`${characterId} used ability: ${abilityId}`);
    
    // Mark that the player has acted this turn
    await persistentCombatState.setHasActedThisTurn(true);

    // Handle character-specific ability effects
    if (character?.name.toLowerCase() === 'gustave') {
      // Handle Gustave's abilities that affect overcharge, etc.
      if (abilityId === 'prosthetic-strike' && persistentCombatState.overchargePoints > 0) {
        await persistentCombatState.setOverchargePoints(persistentCombatState.overchargePoints - 1);
      }
    }
    
    // Handle bonus action cooldown
    const abilityObj = character?.abilities.find(a => a.id === abilityId);
    if (abilityObj?.type === 'bonus_action') {
      await persistentCombatState.setBonusActionCooldown(1);
    }
  };

  const handleTurretDeploy = async (position: { x: number; y: number }) => {
    if (character?.name.toLowerCase() !== 'gustave') return;

    const turretId = `turret-${Date.now()}`;
    const turretToken: BattleToken = {
      id: turretId,
      name: `Turret ${persistentCombatState.turretsDeployedThisBattle + 1}`,
      position,
      type: 'npc',
      hp: 15,
      maxHp: 15,
      ac: 12,
      characterId: 'gustave',
    };

    try {
      await addToken(turretToken);
      await persistentCombatState.setActiveTurretId(turretId);
      await persistentCombatState.setTurretsDeployedThisBattle(persistentCombatState.turretsDeployedThisBattle + 1);
      await persistentCombatState.setHasActedThisTurn(true);
      
      console.log(`Deployed turret ${turretId} at position`, position);
    } catch (error) {
      console.error('Error deploying turret:', error);
    }
  };

  // FIXED: Fix parameter type issue by ensuring characterId is not undefined and fix signature
  const handleTargetSelect = async (targetId: string, acRoll: number, attackType: string = 'melee', abilityId?: string) => {
    if (!playerToken || !characterId) return;

    try {
      const range = attackType === 'ranged' ? 30 : 5;
      await createAttackAction(characterId, targetId, playerToken.position, acRoll, range);
      
      // Mark as acted
      await persistentCombatState.setHasActedThisTurn(true);
    } catch (error) {
      console.error('Error creating attack action:', error);
    }
  };

  const handleEnemySelection = (enemyId: string) => {
    setSelectedEnemyId(enemyId);
  };

  const handleEndTurn = async () => {
    await persistentCombatState.setHasActedThisTurn(false);
    await nextTurn();
  };

  const handleCancelTargeting = () => {
    setSelectedEnemyId(null);
    cancelTargeting();
  };

  // Loading and error states
  if (loading) {
    return (
      <div className="min-h-screen bg-clair-dark flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-clair-dark flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Error</h2>
          <p className="text-clair-gray mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-clair-primary text-white rounded hover:bg-clair-primary-dark"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen bg-clair-dark flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Character Not Found</h2>
          <p className="text-clair-gray">Character ID: {characterId}</p>
        </div>
      </div>
    );
  }

  // Debug trace - now using persistent state values
  console.log(
    `PlayerView ${characterId}: myTurn=${myTurn}, hasActed=${persistentCombatState.hasActedThisTurn}, overcharge=${persistentCombatState.overchargePoints}, stains=${persistentCombatState.elementalStains.length}, stacks=${Object.keys(persistentCombatState.foretellStacks).length}, bonusCD=${persistentCombatState.bonusActionCooldown}, currentTurn=${session?.combatState?.currentTurn}`
  );

  // ----- Render Character Sheets -----
  
  // Maelle gets special treatment with the new system
  if (character.name.toLowerCase() === 'maelle') {
    return (
      <MaelleCharacterSheet
        character={character}
        onHPChange={handleHPChange}
        onAbilityPointsChange={handleAbilityPointsChange}
        isMyTurn={myTurn}
        combatActive={combatActive}
        availableEnemies={availableEnemies}
        playerPosition={playerToken?.position || { x: 0, y: 0 }}
        onTargetSelect={handleTargetSelect}
        onEndTurn={handleEndTurn}
        onCancelTargeting={handleCancelTargeting}
        hasActedThisTurn={persistentCombatState.hasActedThisTurn}
        afterimageStacks={maelleAfterimage.afterimageState.afterimageStacks}
        onAfterimageChange={handleAfterimageChange}
        phantomStrikeAvailable={maelleAfterimage.afterimageState.phantomStrikeAvailable}
        onPhantomStrikeUse={handlePhantomStrikeUse}
        sessionId={sessionId || 'test-session'}
        onActionComplete={() => {
          console.log('Maelle action completed, marking turn as acted');
          persistentCombatState.setHasActedThisTurn(true);
        }}
      />
    );
  }

  if (character.name.toLowerCase() === 'gustave') {
    return (
      <GustaveCharacterSheet
        character={character}
        onHPChange={handleHPChange}
        onAbilityPointsChange={handleAbilityPointsChange}
        onAbilityUse={handleAbilityUse}
        isMyTurn={myTurn}
        combatActive={combatActive}
        availableEnemies={availableEnemies}
        playerPosition={playerToken?.position || { x: 0, y: 0 }}
        onTargetSelect={handleTargetSelect}
        onEndTurn={handleEndTurn}
        onCancelTargeting={handleCancelTargeting}
        hasActedThisTurn={persistentCombatState.hasActedThisTurn}
        onTurretDeploy={handleTurretDeploy}
        overchargePoints={persistentCombatState.overchargePoints}
        onOverchargePointsChange={handleOverchargePointsChange}
        allTokens={tokensArray}
        sessionId={sessionId!}
        activeTurretId={persistentCombatState.activeTurretId}
        turretsDeployedThisBattle={persistentCombatState.turretsDeployedThisBattle}
      />
    );
  }

  if (character.name.toLowerCase() === 'lune') {
    return (
      <LuneCharacterSheet
        character={character}
        onHPChange={handleHPChange}
        onAbilityUse={handleAbilityUse}
        isMyTurn={myTurn}
        combatActive={combatActive}
        availableEnemies={availableEnemies}
        playerPosition={playerToken?.position || { x: 0, y: 0 }}
        onTargetSelect={handleTargetSelect}
        onEndTurn={handleEndTurn}
        onCancelTargeting={handleCancelTargeting}
        hasActedThisTurn={persistentCombatState.hasActedThisTurn}
        elementalStains={persistentCombatState.elementalStains}
        onStainsChange={persistentCombatState.setElementalStains}
        sessionId={sessionId}
        allTokens={tokensArray}
        session={session}
      />
    );
  }

  if (character.name.toLowerCase() === 'sciel') {
    return (
      <ScielCharacterSheet
        character={character}
        onHPChange={handleHPChange}
        onAbilityPointsChange={handleAbilityPointsChange} // Add this line
        onAbilityUse={handleAbilityUse}
        isMyTurn={myTurn}
        combatActive={combatActive}
        availableEnemies={availableEnemies}
        playerPosition={playerToken?.position || { x: 0, y: 0 }}
        onTargetSelect={handleTargetSelect}
        onEndTurn={handleEndTurn}
        onCancelTargeting={handleCancelTargeting}
        hasActedThisTurn={persistentCombatState.hasActedThisTurn}
        sessionId={sessionId}
        allTokens={tokensArray}
        onActionComplete={() => {
          console.log('Sciel action completed, marking turn as acted');
          persistentCombatState.setHasActedThisTurn(true);
        }}
      />
    );
  }
  // Fallback
  return (
    <div className="min-h-screen bg-clair-dark flex items-center justify-center">
      <div className="text-center text-white">
        <h2 className="text-2xl font-bold mb-4">Unknown Character</h2>
        <p className="text-clair-gray">Character: {character.name}</p>
      </div>
    </div>
  );
}