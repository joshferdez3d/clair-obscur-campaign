// src/pages/PlayerView.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { CharacterSheet } from '../components/CharacterSheet/CharacterSheet';
import { GustaveCharacterSheet } from '../components/CharacterSheet/GustaveCharacterSheet';
import { LuneCharacterSheet } from '../components/CharacterSheet/LuneCharacterSheet';
import { ScielCharacterSheet } from '../components/CharacterSheet/ScielCharacterSheet';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { useCharacter } from '../hooks/useCharacter';
import { useCombat } from '../hooks/useCombat';
import type { Stance } from '../types';

export function PlayerView() {
  const { characterId } = useParams<{ characterId: string }>();
  const [hasActedThisTurn, setHasActedThisTurn] = useState(false);
  const [hasChangedStance, setHasChangedStance] = useState(false);
  
  // Character-specific state
  const [overchargePoints, setOverchargePoints] = useState(0); // Gustave-specific
  const [elementalStains, setElementalStains] = useState<Array<'fire' | 'ice' | 'nature' | 'light'>>([]); // Lune-specific
  const [foretellStacks, setForetellStacks] = useState<Record<string, number>>({}); // Sciel-specific
  const [foretellChainCharged, setForetellChainCharged] = useState(false); // Sciel-specific
  const [bonusActionCooldown, setBonusActionCooldown] = useState(0); // Sciel-specific
  
  const currentTurnRef = useRef<string>('');

  const {
    character,
    loading: characterLoading,
    error: characterError,
    // REMOVED: changeHP - players can no longer modify their HP
    updateStance,
    changeCharges,
  } = useCharacter(characterId || '');

  const {
    session,
    loading: combatLoading,
    error: combatError,
    targetingMode,
    cancelTargeting,
    nextTurn,
    isPlayerTurn,
    isCombatActive,
    createAttackAction,
    addToken, // for turret deployment
  } = useCombat('test-session');

  // Reset turn flags when the turn changes TO this player
  useEffect(() => {
    if (session?.combatState) {
      const currentTurn = session.combatState.currentTurn;
      const myTurn = isPlayerTurn(characterId || '');

      // Only reset if the actual turn changed (not just any combatState change)
      if (currentTurn !== currentTurnRef.current) {
        if (myTurn && currentTurn === characterId) {
          console.log('Turn changed TO this player, resetting flags');
          setHasActedThisTurn(false);
          setHasChangedStance(false);
          
          // Reduce Sciel's bonus action cooldown
          if (characterId === 'sciel' && bonusActionCooldown > 0) {
            setBonusActionCooldown(prev => Math.max(0, prev - 1));
          }
        }
        currentTurnRef.current = currentTurn;
      }
    }
  }, [session?.combatState?.currentTurn, characterId, isPlayerTurn, bonusActionCooldown]);

  // ----- Handlers -----
  const handleStanceChange = async (stance: Stance | 'stanceless') => {
    // Your UX wants "stanceless" tap to toggle to 'offensive'
    await updateStance(stance === 'stanceless' ? 'offensive' : stance);
    setHasChangedStance(true);
  };

  const handleAbilityPointsChange = async (delta: number) => {
    if (!character) return;
    await changeCharges(delta);
  };

  const handleOverchargePointsChange = (delta: number) => {
    setOverchargePoints(prev => Math.min(Math.max(0, prev + delta), 3));
  };

  // No-op HP change handler - players cannot modify HP
  const handleHPChange = async (delta: number) => {
    // Players cannot modify their HP - this is handled by the DM
    console.log(`Player attempted to change HP by ${delta}, but this is disabled`);
    return;
  };

  const handleTurretDeploy = async (position: { x: number; y: number }) => {
    if (!session) return;

    const turretToken = {
      id: `turret-${Date.now()}`,
      name: "Gustave's Turret",
      position,
      type: 'npc' as const,
      hp: 10,
      maxHp: 10,
      size: 1,
      color: '#8B4513',
    };

    try {
      await addToken(turretToken);
      setHasActedThisTurn(true);
    } catch (error) {
      console.error('Error deploying turret:', error);
    }
  };

  if (characterLoading || combatLoading) {
    return (
      <div className="min-h-screen bg-clair-shadow-900 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading character..." />
      </div>
    );
  }

  if (characterError || combatError || !character) {
    return (
      <div className="min-h-screen bg-clair-shadow-900 flex items-center justify-center p-4">
        <div className="bg-clair-shadow-700 border border-clair-gold-600 rounded-lg shadow-lg p-6 max-w-md w-full text-center">
          <h2 className="text-lg font-bold text-clair-gold-400 mb-2">Character Not Found</h2>
          <p className="text-clair-gold-300 mb-4">
            {characterError || combatError || 'The requested character could not be loaded.'}
          </p>
          <button
            onClick={() => (window.location.href = '/')}
            className="bg-clair-mystical-500 hover:bg-clair-mystical-600 text-white py-2 px-4 rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // ----- Derived session data (component scope, NOT inside a handler) -----
  const tokensArray = session ? Object.values(session.tokens) : [];
  const playerToken = tokensArray.find(t => t.characterId === characterId);
  const allTokens = tokensArray;

  const myTurn = isPlayerTurn(characterId || '');
  const combatActive = isCombatActive();

  const availableEnemies =
    tokensArray
      .filter(t => t.type === 'enemy')
      .map(t => ({
        id: t.id,
        name: t.name,
        position: t.position,
        hp: t.hp || 20,
        maxHp: t.maxHp || 20,
        ac: t.ac || 13,
      }));

  // Create attack (and manage points) from PlayerView
  const handleTargetSelect = async (
    targetId: string,
    acRoll: number,
    attackType?: string,
    _abilityId?: string
  ) => {
    console.log('handleTargetSelect called with:', { targetId, acRoll, attackType, _abilityId });

    if (!characterId || !session || !playerToken) {
      console.log('Missing required data:', { characterId, session: !!session, playerToken: !!playerToken });
      return;
    }
    
    if (targetId === 'action_taken') {
      console.log('Setting hasActedThisTurn to TRUE for', _abilityId);
      setHasActedThisTurn(true);
      return;
    }
    
    if (targetId === 'action_failed') {
      console.log('Setting hasActedThisTurn to FALSE due to failure');
      setHasActedThisTurn(false);
      return;
    }

    // Handle bonus action for Sciel
    if (targetId === 'bonus_action_used') {
      setHasActedThisTurn(true); // Mark that we've used our bonus action
      return;
    }

    // Handle heal notification for Crescendo of Fate
    if (targetId === 'crescendo_heal') {
      console.log('Heal action detected - sending to GM popup');
      // This will create a GM popup for healing
      try {
        await createAttackAction(characterId, 'crescendo_heal', playerToken.position, acRoll, 0);
      } catch (error) {
        console.error('Error creating heal action:', error);
      }
      return;
    }

    // AoE ultimate trigger (used by your UI shortcut)
    if (targetId === 'aoe_ultimate') {
      try {
        await createAttackAction(characterId, 'aoe_ultimate', playerToken.position, 999, 30);
        setHasActedThisTurn(true);
      } catch (error) {
        console.error('Error creating AoE action:', error);
      }
      return;
    }

    const targetEnemy = availableEnemies.find(e => e.id === targetId);
    if (!targetEnemy) return;

    const hit = acRoll >= targetEnemy.ac;
    setHasActedThisTurn(true);

    if (hit) {
      await handleAbilityPointsChange(1);
      if (character.name.toLowerCase() === 'gustave' && attackType !== 'ranged') {
        handleOverchargePointsChange(1);
      }
    }

    try {
      const range = attackType === 'ranged' ? 999 : 5;
      await createAttackAction(characterId, targetId, playerToken.position, acRoll, range);
    } catch (error) {
      console.error('Error creating attack action:', error);
    }
  };

  const handleEndTurn = async () => {
    setHasActedThisTurn(false);
    setHasChangedStance(false);
    await nextTurn();
  };

  // Debug trace
  console.log(
    `PlayerView ${characterId}: myTurn=${myTurn}, hasActed=${hasActedThisTurn}, overcharge=${overchargePoints}, stains=${elementalStains.length}, stacks=${Object.keys(foretellStacks).length}, bonusCD=${bonusActionCooldown}, currentTurn=${session?.combatState?.currentTurn}`
  );

  // ----- Render Character Sheets (WITH no-op HP controls) -----
  if (character.name.toLowerCase() === 'gustave') {
    return (
      <GustaveCharacterSheet
        character={character}
        onHPChange={handleHPChange} // No-op function - players cannot change HP
        onAbilityPointsChange={handleAbilityPointsChange}
        onOverchargePointsChange={handleOverchargePointsChange}
        onAbilityUse={() => {}}
        isMyTurn={myTurn}
        isLoading={false}
        combatActive={combatActive}
        availableEnemies={availableEnemies}
        playerPosition={playerToken?.position || { x: 0, y: 0 }}
        sessionId={session?.id || 'test-session'}
        allTokens={allTokens}
        onTargetSelect={handleTargetSelect}
        onTurretDeploy={handleTurretDeploy}
        onEndTurn={handleEndTurn}
        onCancelTargeting={cancelTargeting}
        hasActedThisTurn={hasActedThisTurn}
        overchargePoints={overchargePoints}
      />
    );
  }

  if (character.name.toLowerCase() === 'lune') {
    return (
      <LuneCharacterSheet
        character={character}
        onHPChange={handleHPChange} // No-op function - players cannot change HP
        onAbilityUse={() => {}}
        isMyTurn={myTurn}
        isLoading={false}
        combatActive={combatActive}
        availableEnemies={availableEnemies}
        playerPosition={playerToken?.position || { x: 0, y: 0 }}
        sessionId={session?.id || 'test-session'}
        allTokens={allTokens}
        onTargetSelect={handleTargetSelect}
        onEndTurn={handleEndTurn}
        onCancelTargeting={cancelTargeting}
        hasActedThisTurn={hasActedThisTurn}
        elementalStains={elementalStains}
        onStainsChange={setElementalStains}
      />
    );
  }

  if (character.name.toLowerCase() === 'sciel') {
    return (
      <ScielCharacterSheet
        character={character}
        onHPChange={handleHPChange} // No-op function - players cannot change HP
        onAbilityPointsChange={handleAbilityPointsChange}
        onAbilityUse={() => {}}
        isMyTurn={myTurn}
        isLoading={false}
        combatActive={combatActive}
        availableEnemies={availableEnemies}
        playerPosition={playerToken?.position || { x: 0, y: 0 }}
        sessionId={session?.id || 'test-session'}
        allTokens={allTokens}
        onTargetSelect={handleTargetSelect}
        onEndTurn={handleEndTurn}
        onCancelTargeting={cancelTargeting}
        hasActedThisTurn={hasActedThisTurn}
        foretellStacks={foretellStacks}
        onStacksChange={setForetellStacks}
        foretellChainCharged={foretellChainCharged}
        onChainChargedChange={setForetellChainCharged}
        bonusActionCooldown={bonusActionCooldown}
        onBonusActionCooldownChange={setBonusActionCooldown}
      />
    );
  }

  // Default for other characters (e.g., Maelle)
  const canSwitchStance =
    character.name.toLowerCase() === 'maelle' &&
    myTurn &&
    combatActive &&
    hasActedThisTurn &&
    !hasChangedStance;

  return (
    <CharacterSheet
      character={character}
      onHPChange={handleHPChange} // No-op function - players cannot change HP
      onStanceChange={handleStanceChange}
      onAbilityPointsChange={handleAbilityPointsChange}
      onAbilityUse={() => {}}
      isMyTurn={myTurn}
      isLoading={false}
      combatActive={combatActive}
      targetingMode={targetingMode}
      availableEnemies={availableEnemies}
      playerPosition={playerToken?.position || { x: 0, y: 0 }}
      onTargetSelect={handleTargetSelect}
      onEndTurn={handleEndTurn}
      onCancelTargeting={cancelTargeting}
      hasActedThisTurn={hasActedThisTurn}
      canSwitchStance={canSwitchStance}
      hasChangedStance={hasChangedStance}
    />
  );
}