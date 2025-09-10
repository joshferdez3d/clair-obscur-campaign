// src/pages/PlayerView.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { GustaveCharacterSheet } from '../components/CharacterSheet/GustaveCharacterSheet';
import { LuneCharacterSheet } from '../components/CharacterSheet/LuneCharacterSheet';
import { ScielCharacterSheet } from '../components/CharacterSheet/ScielCharacterSheet';
import { MaelleCharacterSheet } from '../components/CharacterSheet/MaelleCharacterSheet';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { useCharacter } from '../hooks/useCharacter';
import { useCombat } from '../hooks/useCombat';
import type { Stance, BattleToken } from '../types';
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
  const [hasActedThisTurn, setHasActedThisTurn] = useState(false);
  
  // Character-specific state
  const [overchargePoints, setOverchargePoints] = useState(0);
  const [elementalStains, setElementalStains] = useState<Array<'fire' | 'ice' | 'nature' | 'light'>>([]);
  const [foretellStacks, setForetellStacks] = useState<Record<string, number>>({});
  const [foretellChainCharged, setForetellChainCharged] = useState(false);
  const [bonusActionCooldown, setBonusActionCooldown] = useState(0);
  const [activeTurretId, setActiveTurretId] = useState<string | null>(null);
  const [turretsDeployedThisBattle, setTurretsDeployedThisBattle] = useState<number>(0);

  const currentTurnRef = useRef<string>('');

  // Use different session sources for different characters
  const { session: firestoreSession } = useFirestoreListener(sessionId);
  const maelleAfterimage = useMaelleAfterimage(sessionId);

  const {
    character,
    loading: characterLoading,
    error: characterError,
    updateStance,
    changeCharges,
  } = useCharacter(characterId || '');

  const {
    session: combatSession,
    loading: combatLoading,
    error: combatError,
    cancelTargeting,
    nextTurn,
    isPlayerTurn,
    isCombatActive,
    createAttackAction,
    addToken,
  } = useCombat(sessionId);

  // Use the appropriate session based on character
  const session = character?.name.toLowerCase() === 'maelle' ? firestoreSession : combatSession;

  // Reset turn flags when the turn changes TO this player
  useEffect(() => {
    if (session?.combatState) {
      const currentTurn = session.combatState.currentTurn;
      const myTurn = isPlayerTurn(characterId || '');

      if (currentTurn !== currentTurnRef.current) {
        if (myTurn && currentTurn === characterId) {
          console.log('Turn changed TO this player, resetting flags');
          setHasActedThisTurn(false);
          
          if (characterId === 'sciel' && bonusActionCooldown > 0) {
            setBonusActionCooldown(prev => Math.max(0, prev - 1));
          }
        }
        currentTurnRef.current = currentTurn;
      }
    }
  }, [session?.combatState?.currentTurn, characterId, isPlayerTurn, bonusActionCooldown]);

  useEffect(() => {
    if (!session?.tokens) return;
    
    // Find all Gustave turrets (including destroyed ones by checking all session tokens)
    const allGustaveTurrets = Object.values(session.tokens).filter((token: any) => 
      token.type === 'npc' && 
      /turret/i.test(token.name) &&
      token.name.includes('Gustave')
      // Don't filter by HP here - we want to count all turrets ever placed
    ) as any[];
    
    // Find active turrets
    const activeGustaveTurrets = allGustaveTurrets.filter((token: any) => 
      (token.hp || 0) > 0
    );
    
    // Set active turret (should only be one active at a time)
    if (activeGustaveTurrets.length > 0) {
      setActiveTurretId(activeGustaveTurrets[0].id);
    } else {
      setActiveTurretId(null);
    }
    
    // Update the total count of turrets deployed this battle
    // This counts ALL turrets (active + destroyed) that have been placed
    setTurretsDeployedThisBattle(allGustaveTurrets.length);
    
  }, [session?.tokens]);

  // Reset turret count when combat ends or session resets
  useEffect(() => {
    if (!session?.combatState?.isActive) {
      // Reset turret count when combat is not active (combat ended)
      setTurretsDeployedThisBattle(0);
    }
  }, [session?.combatState?.isActive]);

  // 3. Add effect to reset turret count on new battle/session
  useEffect(() => {
    if (session?.metadata?.battleStarted) {
      // Reset turret count when new battle starts
      setTurretsDeployedThisBattle(0);
    }
  }, [session?.metadata?.battleStarted]);

  // ----- Handlers -----
  const handleAfterimageChange = async (newStacks: number) => {
    await maelleAfterimage.updateStacks(newStacks);
  };
  const handleAbilityUse = (ability: any) => {
  console.log(`Ability used: ${ability.name}`);
  // This can be empty for Gustave or implement specific logic if needed
};


  const handlePhantomStrikeUse = async () => {
    // Get available enemies for Maelle
    const tokensArray: SessionToken[] = session?.tokens ? Object.values(session.tokens) as SessionToken[] : [];
    const playerToken = tokensArray.find(t => t.characterId === characterId);
    const playerPosition = playerToken?.position || { x: 0, y: 0 };
    
    const availableEnemies = tokensArray
      .filter(t => t.type === 'enemy')
      .map(t => ({
        id: t.id,
        name: t.name,
        position: t.position,
        hp: t.hp || 20,
        maxHp: t.maxHp || 20,
        ac: t.ac || 13,
      }));

    const enemiesInRange = availableEnemies.filter(enemy => {
      const dx = Math.abs(playerPosition.x - enemy.position.x);
      const dy = Math.abs(playerPosition.y - enemy.position.y);
      const distance = Math.max(dx, dy) * 5;
      return distance <= 50;
    });
    
    if (enemiesInRange.length === 0) {
      alert('No enemies within 50ft for Phantom Strike!');
      return;
    }

    // Create AoE action using your existing FirestoreService method
    try {
      const targetIds = enemiesInRange.map(e => e.id);
      const targetNames = enemiesInRange.map(e => e.name);
      
      await FirestoreService.createAoEAction(sessionId, {
        playerId: characterId!,
        abilityName: 'Phantom Strike',
        targetIds,
        targetNames,
        center: playerPosition,
        radius: 50,
        acRoll: 999 // Auto-hit ultimate
      });
      
      // Mark as used and update afterimage stacks
      await maelleAfterimage.usePhantomStrike(enemiesInRange.length);
      
      // Mark as acted
      setHasActedThisTurn(true);
      
      console.log(`Phantom Strike will hit ${enemiesInRange.length} enemies:`, targetNames);
    } catch (error) {
      console.error('Error creating Phantom Strike AoE action:', error);
    }
  };

  const handleAbilityPointsChange = async (delta: number) => {
    if (!character) return;
    await changeCharges(delta);
  };

  const handleOverchargePointsChange = (delta: number) => {
    setOverchargePoints(prev => Math.min(Math.max(0, prev + delta), 3));
  };

  const handleHPChange = async (delta: number) => {
    console.log(`Player attempted to change HP by ${delta}, but this is disabled`);
    return;
  };

  const handleTurretDeploy = async (position: { x: number; y: number }) => {
      console.log('Turret deployment now handled via GM placement action');
      const incrementTurretCount = () => {
        setTurretsDeployedThisBattle(prev => prev + 1);
      }; 
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

  // ----- Derived session data with proper typing -----
  const tokensArray: SessionToken[] = session?.tokens ? Object.values(session.tokens) as SessionToken[] : [];
  const playerToken = tokensArray.find(t => t.characterId === characterId);
  const allTokens = tokensArray as BattleToken[]; // Cast for existing components

  const myTurn = isPlayerTurn(characterId || '');
  const combatActive = isCombatActive();

  const availableEnemies = tokensArray
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

    if (targetId === 'bonus_action_used') {
      setHasActedThisTurn(true);
      return;
    }

    if (targetId === 'crescendo_heal') {
      console.log('Heal action detected - sending to GM popup');
      try {
        await createAttackAction(characterId, 'crescendo_heal', playerToken.position, acRoll, 0);
      } catch (error) {
        console.error('Error creating heal action:', error);
      }
      return;
    }

    if (targetId === 'aoe_ultimate') {
      try {
        await createAttackAction(characterId, 'aoe_ultimate', playerToken.position, 999, 30);
        setHasActedThisTurn(true);
      } catch (error) {
        console.error('Error creating AoE action:', error);
      }
      return;
    }

    // Handle Maelle's Afterimage system
    if (character.name.toLowerCase() === 'maelle' && attackType === 'basic') {
      const enemy = availableEnemies.find(e => e.id === targetId);
      const hit = acRoll >= (enemy?.ac || 10);
      
      if (hit) {
        const wasCritical = acRoll === 20;
        await maelleAfterimage.onBasicAttackHit(wasCritical);
      }
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
    await nextTurn();
  };

  const handleCancelTargeting = () => {
    cancelTargeting();
  };

  // Debug trace
  console.log(
    `PlayerView ${characterId}: myTurn=${myTurn}, hasActed=${hasActedThisTurn}, overcharge=${overchargePoints}, stains=${elementalStains.length}, stacks=${Object.keys(foretellStacks).length}, bonusCD=${bonusActionCooldown}, currentTurn=${session?.combatState?.currentTurn}`
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
        hasActedThisTurn={hasActedThisTurn}
        afterimageStacks={maelleAfterimage.afterimageState.afterimageStacks}
        onAfterimageChange={handleAfterimageChange}
        phantomStrikeAvailable={maelleAfterimage.afterimageState.phantomStrikeAvailable}
        onPhantomStrikeUse={handlePhantomStrikeUse}
        sessionId={sessionId || 'test-session'}

      />
    );
  }

  if (character.name.toLowerCase() === 'gustave') {
    return (
      <GustaveCharacterSheet
        character={character}
        onHPChange={handleHPChange}
        onAbilityPointsChange={handleAbilityPointsChange}
        onAbilityUse={handleAbilityUse}  // ADD THIS MISSING PROP
        isMyTurn={myTurn}
        combatActive={combatActive}
        availableEnemies={availableEnemies}
        playerPosition={playerToken?.position || { x: 0, y: 0 }}
        onTargetSelect={handleTargetSelect}
        onEndTurn={handleEndTurn}
        onCancelTargeting={handleCancelTargeting}
        hasActedThisTurn={hasActedThisTurn}
        onTurretDeploy={handleTurretDeploy}
        overchargePoints={overchargePoints}
        onOverchargePointsChange={handleOverchargePointsChange}
        allTokens={tokensArray}
        sessionId={sessionId!}
        session={session}
        // Turret tracking props:
        activeTurretId={activeTurretId}
        turretsDeployedThisBattle={turretsDeployedThisBattle}
        // Optional callback (can be undefined):
        onSelfDestructTurret={undefined}
      />
    );
  }

  if (character.name.toLowerCase() === 'lune') {
    return (
      <LuneCharacterSheet
        character={character}
        onHPChange={handleHPChange}
        onAbilityUse={() => {}}
        isMyTurn={myTurn}
        isLoading={false}
        combatActive={combatActive}
        availableEnemies={availableEnemies}
        playerPosition={playerToken?.position || { x: 0, y: 0 }}
        sessionId={session?.id || sessionId}
        allTokens={allTokens}
        onTargetSelect={handleTargetSelect}
        onEndTurn={handleEndTurn}
        onCancelTargeting={cancelTargeting}
        hasActedThisTurn={hasActedThisTurn}
        elementalStains={elementalStains}
        onStainsChange={setElementalStains}
        session={session} // NEW: Pass session for ultimate cooldown tracking
      />
    );
  }

  if (character.name.toLowerCase() === 'sciel') {
    return (
      <ScielCharacterSheet
        character={character}
        onHPChange={handleHPChange}
        onAbilityPointsChange={handleAbilityPointsChange}
        onAbilityUse={() => {}}
        isMyTurn={myTurn}
        isLoading={false}
        combatActive={combatActive}
        availableEnemies={availableEnemies}
        playerPosition={playerToken?.position || { x: 0, y: 0 }}
        sessionId={session?.id || sessionId}
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

  // Fallback for any other characters
  return (
    <div className="min-h-screen bg-clair-shadow-900 flex items-center justify-center">
      <div className="text-white text-center">
        <h1 className="text-2xl font-bold mb-4">Character Sheet</h1>
        <p>Character sheet for: {character.name}</p>
      </div>
    </div>
  );
}