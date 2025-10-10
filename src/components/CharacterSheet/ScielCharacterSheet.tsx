// src/components/CharacterSheet/ScielCharacterSheet.tsx - STREAMLINED VERSION
import React, { useState, useEffect } from 'react';
import { User, Sparkles, Target, Eye, Zap, Circle, Heart, Shuffle, Shield } from 'lucide-react';
import { FirestoreService } from '../../services/firestoreService';
import { HPTracker } from './HPTracker';
import { StatDisplay } from './StatDisplay';
import { EnemyTargetingModal } from '../Combat/EnemyTargetingModal';
import { useStormSystem } from '../../hooks/useStormSystem';
import { StormService } from '../../services/StormService';
import { StormIndicator } from '../Combat/StormIndicator';
import type { Character, Position, BattleToken } from '../../types';
import { useUltimateVideo } from '../../hooks/useUltimateVideo';
import { Package } from 'lucide-react';
import { InventoryModal } from './InventoryModal';
import { InventoryService } from '../../services/inventoryService';
import type { InventoryItem } from '../../types';
import { useRealtimeInventory } from '../../hooks/useRealtimeInventory';
import { MovementInput } from '../Combat/MovementInput';
import { MovementService } from '../../services/movementService';
import { NPCTabSystem } from './NPCTabSystem';
import { handlePlayerLampAttack } from '../../services/LampAttackService';

interface ScielCharacterSheetProps {
  character: Character;
  onHPChange: (delta: number) => void;
  onAbilityUse: (ability: any) => void;
  isLoading?: boolean;
  isMyTurn?: boolean;
  combatActive?: boolean;
  availableEnemies?: Array<{
    id: string;
    name: string;
    position: { x: number; y: number };
    hp: number;
    maxHp: number;
    ac: number;
  }>;
    isGM?: boolean; // ADD THIS LINE

  playerPosition?: { x: number; y: number };
  onTargetSelect?: (targetId: string, acRoll: number, attackType: string, abilityId?: string) => void;
  onEndTurn?: () => void;
  onCancelTargeting?: () => void;
  // REMOVED: hasActedThisTurn - no longer needed
  sessionId?: string;
  allTokens?: BattleToken[];
  // REMOVED: onActionComplete - no longer needed
  session?: any;

  // Persistent state props
  chargedFateCard: 'explosive' | 'switch' | 'vanish' | null;
  setChargedFateCard: (card: 'explosive' | 'switch' | 'vanish' | null) => Promise<void>;
  abilityPoints: number;
  setAbilityPoints: (points: number) => Promise<void>;
}

type FateCard = 'explosive' | 'switch' | 'vanish' | null;

export function ScielCharacterSheet({
  character,
  onHPChange,
  onAbilityUse,
  isLoading = false,
  isMyTurn = false,
  combatActive = false,
  availableEnemies = [],
  playerPosition = { x: 0, y: 0 },
  onTargetSelect,
  onEndTurn,
  isGM,
  onCancelTargeting,
  // REMOVED: hasActedThisTurn = false,
  sessionId = 'test-session',
  allTokens = [],
  session,
  // REMOVED: onActionComplete,
  // Persistent state props
  chargedFateCard,
  setChargedFateCard,
  abilityPoints,
  setAbilityPoints,
}: ScielCharacterSheetProps) {
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [acRoll, setACRoll] = useState<string>('');
  const [showTargetingModal, setShowTargetingModal] = useState(false);
  const { triggerUltimate } = useUltimateVideo(sessionId);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const { gold: goldAmount, inventory, loading: inventoryLoading } = useRealtimeInventory(character?.id || '');
  const hasRallyingCryBuff = session?.tokens?.[`player-${character.id}`]?.statusEffects?.rallyingCry;

  const [selectedAction, setSelectedAction] = useState<{
    type: 'basic' | 'ability' | 'bonus';
    id: string;
    name: string;
    description: string;
    damage?: string;
    cost?: number;
    targetType?: 'enemy' | 'ally';
  } | null>(null);

  const handleOpenInventory = () => {
    setShowInventoryModal(true);
  };

  const playerToken = session?.tokens 
      ? Object.entries(session.tokens).find(([key, t]: [string, any]) => {
          console.log(`Checking token ${key}:`, {
            tokenCharacterId: t.characterId,
            tokenId: t.id,
            tokenName: t.name,
            tokenType: t.type,
          });
          
          // Try multiple matching strategies
          return t.characterId === character.id || 
                 t.id === character.id ||
                 key === character.id ||
                 t.name?.toLowerCase() === character.name?.toLowerCase();
        })?.[1] as BattleToken
      : null;

    console.log('Player token result:', playerToken);

    const handleMovement = async (newPosition: Position): Promise<boolean> => {
      if (!sessionId || !playerToken) return false;
      
      return await MovementService.moveToken(sessionId, playerToken.id, newPosition);
    };

  // Storm system integration
  const { stormState, isStormActive } = useStormSystem(sessionId);

  const getCharacterPortrait = (name: string) => {
    const portraitMap: { [key: string]: string } = {
      'gustave': '/tokens/characters/gustave.jpg',
      'lune': '/tokens/characters/lune.jpg',
      'maelle': '/tokens/characters/maelle.jpg',
      'sciel': '/tokens/characters/sciel.jpg'
    };
    return portraitMap[name.toLowerCase()] || null;
  };

  const portraitUrl = getCharacterPortrait(character.name);
  const getCharacterGradient = () => 'bg-gradient-to-br from-green-600 to-green-800';

  // Calculate distance for range validation and penalties
  const calculateDistance = (pos1: { x: number; y: number }, pos2: { x: number; y: number }): number => {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    return Math.max(dx, dy) * 5;
  };

  // Apply range penalty for attacks beyond 30ft
  const applyRangePenalty = (baseAC: number, distance: number): number => {
    if (distance <= 30) return baseAC;
    const extraDistance = distance - 30;
    const penalty = Math.floor(extraDistance / 5) * 2;
    return Math.max(1, baseAC - penalty);
  };

  // Get valid targets based on ability type
  const getValidTargets = (targetType: 'enemy' | 'ally' = 'enemy') => {
    if (targetType === 'ally') {
      return allTokens
        .filter(t => t.type === 'player' && t.id !== `token-${character.id}`)
        .map(t => ({
          id: t.id,
          name: t.name,
          position: t.position,
          hp: t.hp || 0,
          maxHp: t.maxHp || 100,
          ac: 10 // Not relevant for allies
        }));
    }
    return availableEnemies;
  };

  const handleFatesGambit = async () => {
    if (abilityPoints < 2) {
      alert('Not enough ability points for Fate\'s Gambit!');
      return;
    }

    // Consume ability points
    await setAbilityPoints(abilityPoints - 2);

    // Random fate card selection
    const fateCards: Array<'explosive' | 'switch' | 'vanish'> = ['explosive', 'switch', 'vanish'];
    const randomCard = fateCards[Math.floor(Math.random() * fateCards.length)];
    
    // Set the charged fate card
    await setChargedFateCard(randomCard);

    // Show feedback to player
    const cardNames = {
      explosive: '💥 Explosive',
      switch: '🔄 Switch',
      vanish: '👻 Vanish'
    };

    alert(`Fate chosen! Your next Card Toss will be enhanced with ${cardNames[randomCard]} power!`);
  };

  // Handle Crescendo of Fate activation
  const handleActivateUltimate = async () => {
    if (isStormActive) {
      alert('Storm is already active!');
      return;
    }

    if (abilityPoints < 3) {
      alert('Not enough ability points! Need 3, have ' + abilityPoints);
      return;
    }

    try {
      await triggerUltimate('sciel', 'Crescendo of Fate');
      await StormService.activateStorm(sessionId, 5);
      await setAbilityPoints(abilityPoints - 3);
      
      if (onTargetSelect) {
        onTargetSelect('storm_activated', 0, 'ultimate', 'crescendo_of_fate');
      }
      
      // STREAMLINED: Auto-end turn after ultimate
      if (onEndTurn) {
        onEndTurn();
      }
    } catch (error) {
      console.error('Failed to activate Crescendo of Fate:', error);
      alert('Failed to activate storm system!');
    }
  };

  // Handle action selection
  const handleActionSelect = (action: any) => {
    // REMOVED: hasActedThisTurn checks

    // Check ability point costs
    if (action.type === 'ability' && action.cost) {
      if (abilityPoints < action.cost) {
        alert(`Not enough ability points! Need ${action.cost}, have ${abilityPoints}`);
        return;
      }
    }

    setSelectedAction(action);
    setSelectedTarget('');
    setACRoll('');
  };

  // Handle confirming actions
  const handleConfirmAction = async () => {
    if (!selectedAction) return;
    
    if (sessionId) {
      FirestoreService.clearTargetingState(sessionId);
    }

    // Handle Card Toss (basic attack)
    if (selectedAction.id === 'card_toss') {
      if (!selectedTarget || !acRoll) {
        alert('Please select target and enter AC roll');
        return;
      }

    // ✅ ADD: Check if target is a lamp
    if (selectedTarget.startsWith('lamp-')) {
      console.log(`Sciel attacking lamp: ${selectedTarget}`);
      
      // Import the lamp attack handler at the top of the file:
      // import { handlePlayerLampAttack } from '../../services/LampAttackService';
      
      await handlePlayerLampAttack(sessionId, character.id, selectedTarget);
      
      setSelectedAction(null);
      setSelectedTarget('');
      setACRoll('');
      setShowTargetingModal(false);
      
      // Auto-end turn after lamp attack
      if (onEndTurn) {
        onEndTurn();
      }
      
      return; // Important: return early so it doesn't process as normal attack
    }

      const enemy = availableEnemies.find(e => e.id === selectedTarget);
      if (!enemy) return;

      const distance = calculateDistance(playerPosition, enemy.position);
      const finalAC = applyRangePenalty(parseInt(acRoll), distance);
      const hit = finalAC >= enemy.ac;

      

      // Generate ability point only for regular card toss hits
      if (hit && !chargedFateCard) {
        await setAbilityPoints(Math.min(3, abilityPoints + 1));
        console.log('Generated ability point for successful regular card toss');
      }

      // Handle different card types
      if (chargedFateCard) {
        if (chargedFateCard === 'explosive') {
          // Create AoE action for explosion - only if it hits
          if (hit) {
            const nearbyEnemies = availableEnemies.filter(e => {
              if (e.id === selectedTarget) return true;
              const distanceToTarget = calculateDistance(enemy.position, e.position);
              return distanceToTarget <= 10;
            });

            if (nearbyEnemies.length > 0) {
              await FirestoreService.createAoEAction(sessionId, {
                playerId: character.id,
                abilityName: `💥 Explosive Card Toss`,
                targetIds: nearbyEnemies.map(e => e.id),
                targetNames: nearbyEnemies.map(e => e.name),
                center: enemy.position,
                radius: 10,
                acRoll: finalAC
              });
            }
          } else {
            await FirestoreService.createAttackAction(
              sessionId,
              character.id,
              selectedTarget,
              playerPosition,
              finalAC,
              '💥 Explosive Card Toss (Miss)'
            );
          }
        } else if (chargedFateCard === 'switch') {
          await FirestoreService.createSwitchCardAction(sessionId, {
            playerId: character.id,
            targetId: selectedTarget,
            playerPosition: playerPosition,
            targetPosition: enemy.position,
            acRoll: finalAC
          });
        } else if (chargedFateCard === 'vanish') {
          await FirestoreService.createVanishCardAction(sessionId, {
            playerId: character.id,
            targetId: selectedTarget,
            acRoll: finalAC
          });
        }
        
        await setChargedFateCard(null);
      } else {
        // Regular card toss
        await FirestoreService.createAttackAction(
          sessionId,
          character.id,
          selectedTarget,
          playerPosition,
          finalAC,
          'Card Toss'
        );
      }

      setSelectedAction(null);
      setSelectedTarget('');
      setACRoll('');
      setShowTargetingModal(false);
      
      // STREAMLINED: Auto-end turn after card toss
      if (onEndTurn) {
        onEndTurn();
      }
      
      return;
    }

    // Handle Rewrite Destiny
    if (selectedAction.id === 'rewrite_destiny') {
      if (!selectedTarget) {
        alert('Please select an enemy to curse with disadvantage');
        return;
      }

      await FirestoreService.createBuffAction(sessionId, {
        playerId: character.id,
        targetId: selectedTarget,
        abilityName: 'Rewrite Destiny',
        buffType: 'disadvantage',
        duration: 1
      });

      await setAbilityPoints(abilityPoints - selectedAction.cost!);
      
      setSelectedAction(null);
      setSelectedTarget('');
      setShowTargetingModal(false);
      
      // STREAMLINED: Auto-end turn after ability
      if (onEndTurn) {
        onEndTurn();
      }
      
      return;
    }

    // Handle Glimpse Future
    if (selectedAction.id === 'glimpse_future') {
      if (!selectedTarget) {
        alert('Please select an ally to grant advantage');
        return;
      }

      await FirestoreService.createBuffAction(sessionId, {
        playerId: character.id,
        targetId: selectedTarget,
        abilityName: 'Glimpse Future',
        buffType: 'advantage',
        duration: 1
      });

      await setAbilityPoints(abilityPoints - selectedAction.cost!);
      
      setSelectedAction(null);
      setSelectedTarget('');
      setShowTargetingModal(false);
      
      // STREAMLINED: Auto-end turn after ability
      if (onEndTurn) {
        onEndTurn();
      }
      
      return;
    }

    // Handle Fate's Gambit
    if (selectedAction.id === 'fates_gambit') {
      handleFatesGambit();
      setSelectedAction(null);
      // NOTE: Fate's Gambit doesn't end turn - allows Card Toss same turn
      return;
    }
  };

  const handleCancelAction = () => {
    setSelectedAction(null);
    setSelectedTarget('');
    setACRoll('');
    setShowTargetingModal(false);
    onCancelTargeting?.();
  };

  // Define Sciel's actions
  const basicAttack = {
    type: 'basic' as const,
    id: 'card_toss',
    name: 'Card Toss',
    description: chargedFateCard 
      ? `Enhanced with ${chargedFateCard === 'explosive' ? '💥 Explosive' : chargedFateCard === 'switch' ? '🔄 Switch' : '👻 Vanish'} Card. Turn ends automatically.`
      : 'Ranged attack with magical cards. Turn ends automatically.',
    damage: '1d6 slashing + 1d4 radiant',
    icon: Circle,
    range: 'Unlimited',
  };

  const abilities = [
    {
      type: 'ability' as const,
      id: 'rewrite_destiny',
      name: 'Rewrite Destiny',
      description: 'Curse an enemy with disadvantage on their next turn. Turn ends automatically.',
      damage: 'Disadvantage debuff',
      cost: 1,
      range: 'Any enemy',
      targetType: 'enemy' as const,
    },
    {
      type: 'ability' as const,
      id: 'glimpse_future',
      name: 'Glimpse Future',
      description: 'Grant an ally advantage on their next turn. Turn ends automatically.',
      damage: 'Advantage buff',
      cost: 2,
      range: 'Any ally',
      targetType: 'ally' as const,
    },
    {
      type: 'ability' as const,
      id: 'fates_gambit',
      name: "Fate's Gambit",
      description: 'Randomly enhance your next Card Toss with a special effect. Allows Card Toss same turn.',
      damage: 'Card enhancement',
      cost: 2,
      range: 'Self',
    },
  ];


  return (
    <NPCTabSystem
      characterId="sciel"
      characterName="Sciel"
      sessionId={sessionId}
      isGM={isGM}
      availableEnemies={availableEnemies} // Add this
      availableAllies={allTokens?.filter(t => t.type === 'player')} // Add this
      session={session} // Add this
      isMyTurn={isMyTurn} // Add this
      combatActive={combatActive} // Add this
      playerPosition={playerPosition} // Add this
    >
    <div className="min-h-screen bg-clair-shadow-900">
      {/* CHARACTER HEADER */}
      <div className={`relative px-4 pt-6 pb-4 text-white ${getCharacterGradient()} shadow-shadow border-b border-clair-gold-600`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center border-2 border-clair-gold-400 overflow-hidden shadow-lg">
              {portraitUrl ? (
                <img 
                  src={portraitUrl} 
                  alt={character.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.error(`Failed to load image for ${character.name}`);
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              ) : (
                <User className="w-8 h-8 text-clair-gold-200" />
              )}
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold text-clair-gold-50">{character.name}</h1>
              <p className="font-serif italic text-clair-gold-200 text-sm">{character.role}</p>
            </div>
          </div>
          
          {/* Turn Indicator */}
          {isMyTurn && combatActive && (
            <div className="bg-clair-gold-500 text-clair-shadow-900 px-3 py-2 rounded-full font-sans text-sm font-bold animate-pulse shadow-clair">
              Your Turn
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-4">
        {portraitUrl && (
          <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 border border-clair-gold-600 mb-4">
            <h3 className="font-display text-lg font-bold text-clair-gold-400 mb-3">Character Portrait</h3>
            <div className="flex justify-center">
              <div className="w-32 h-32 rounded-lg overflow-hidden border-2 border-clair-gold-400 shadow-xl">
                <img 
                  src={portraitUrl} 
                  alt={`${character.name} portrait`}
                  className="w-full h-full object-cover"
                  style={{ imageRendering: 'crisp-edges' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Storm Status */}
        {stormState && isStormActive && (
          <div className="mb-4">
            <StormIndicator stormState={stormState} />
          </div>
        )}

        {/* REMOVED: Action Status display */}

        {/* STREAMLINED: Simple turn instruction */}
        {isMyTurn && combatActive && (
          <div className="mb-4 p-3 bg-green-900 bg-opacity-20 rounded-lg border border-green-600">
            <p className="text-green-200 text-sm font-bold">
              ⚡ Select any action below - your turn will end automatically after completion!
            </p>
            <p className="text-green-300 text-xs mt-1">
              Note: Only Fate's Gambit → Card Toss allows two actions per turn
            </p>
          </div>
        )}

        {/* HP TRACKER */}
        <HPTracker currentHP={character.currentHP} maxHP={character.maxHP} onHPChange={onHPChange} isLoading={isLoading} showControls={false}/>
        {hasRallyingCryBuff && (
          <div className="bg-green-900 bg-opacity-50 border border-green-500 rounded p-2 mb-2">
            <div className="flex items-center text-green-300 text-sm">
              <Shield className="w-4 h-4 mr-2" />
              <span>Rallying Cry: +1 AC (from Farmhand)</span>
            </div>
          </div>
        )}
        {/* ABILITY SCORES */}
        <StatDisplay stats={character.stats} />

        <div className="mb-6">
          <button
            onClick={handleOpenInventory}
            className="w-full bg-clair-shadow-600 hover:bg-clair-shadow-500 border border-clair-gold-600 text-clair-gold-200 p-3 rounded-lg transition-colors flex items-center justify-center"
          >
            <Package className="w-5 h-5 mr-2" />
            <span className="font-serif font-bold">Inventory</span>
            {inventory.length > 0 && (
              <span className="ml-2 bg-clair-gold-600 text-clair-shadow-900 px-2 py-1 rounded-full text-xs font-bold">
                {inventory.length}
              </span>
            )}
          </button>
        </div>

        {/* Grid Movement Input */}
        {isMyTurn && playerToken && (
          <div className="mb-4">
            <MovementInput
              token={playerToken}
              currentPosition={playerToken.position}
              maxRange={MovementService.getMovementRange(character.name)}
              gridSize={{ width: 30, height: 20 }} // Or get from current map if available
              onMove={handleMovement}
              isMyTurn={isMyTurn}
              characterName={character.name}
            />
          </div>
        )}

        {/* Ability Points */}
        <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 mb-4 border border-clair-gold-600">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Sparkles className="w-6 h-6 text-clair-gold-500 mr-2" />
              <h3 className="font-display text-lg font-bold text-clair-gold-400">Ability Points</h3>
            </div>
            <div className="font-serif text-2xl font-bold text-clair-gold-50">{abilityPoints} / 3</div>
          </div>
          
          <div className="flex justify-center space-x-2 mb-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                  index < abilityPoints 
                    ? 'bg-clair-gold-500 border-clair-gold-400 shadow-lg' 
                    : 'bg-clair-shadow-800 border-clair-shadow-400'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Charged Fate Card Display */}
        {chargedFateCard && (
          <div className="bg-purple-900 bg-opacity-30 border border-purple-500 rounded-lg p-4 mb-4 animate-pulse">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-purple-300 font-bold flex items-center">
                <Shuffle className="w-5 h-5 mr-2" />
                Fate Card Charged
              </h3>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-2">
                {chargedFateCard === 'explosive' && '💥'}
                {chargedFateCard === 'switch' && '🔄'}
                {chargedFateCard === 'vanish' && '👻'}
              </div>
              <div className="text-purple-200 font-bold text-lg mb-1">
                {chargedFateCard === 'explosive' && 'Explosive Card'}
                {chargedFateCard === 'switch' && 'Switch Card'}
                {chargedFateCard === 'vanish' && 'Vanish Card'}
              </div>
              <div className="text-purple-300 text-sm">
                {chargedFateCard === 'explosive' && 'Next Card Toss will explode, hitting all enemies within 10ft'}
                {chargedFateCard === 'switch' && 'Next Card Toss will swap positions with the target'}
                {chargedFateCard === 'vanish' && 'Next Card Toss will banish target for 2 rounds'}
              </div>
            </div>
          </div>
        )}

        {/* Combat Actions */}
        <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 border border-clair-gold-600 mb-6">
          <h3 className="font-display text-lg font-bold text-clair-gold-400 mb-3">Combat Actions</h3>

          {!selectedAction ? (
            <div className="space-y-3">
              {/* Basic Attack */}
              <div>
                <h4 className="text-sm font-bold text-green-300 mb-2">Basic Attack</h4>
                <button
                  onClick={() => handleActionSelect(basicAttack)}
                  disabled={!isMyTurn || !combatActive || isStormActive}
                  className={`w-full ${
                    chargedFateCard
                      ? 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 animate-pulse'
                      : 'bg-green-600 hover:bg-green-700'
                  } disabled:bg-gray-600 disabled:opacity-50 p-3 rounded-lg transition-colors text-left text-white`}
                >
                  <div className="flex items-center">
                    <Circle className="w-4 h-4 mr-2" />
                    <span className="font-bold">{basicAttack.name}</span>
                    {chargedFateCard && (
                      <span className="ml-2 text-xs bg-purple-600 px-2 py-1 rounded animate-pulse">
                        {chargedFateCard === 'explosive' ? '💥 EXPLOSIVE' : 
                         chargedFateCard === 'switch' ? '🔄 SWITCH' : '👻 VANISH'}
                      </span>
                    )}
                  </div>
                  <div className="text-sm opacity-90 mt-1">{basicAttack.description}</div>
                  <div className="text-xs text-clair-gold-200 mt-1">{basicAttack.damage}</div>
                </button>
              </div>

              {/* Abilities */}
              <div>
                <h4 className="text-sm font-bold text-green-300 mb-2">Abilities</h4>
                <div className="space-y-2">
                  {abilities.map((ability) => {
                    const isDisabled = 
                      !isMyTurn || 
                      !combatActive || 
                      abilityPoints < ability.cost ||
                      isStormActive;
                    
                    const endsTurn = ability.id === 'rewrite_destiny' || ability.id === 'glimpse_future';
                    const allowsCardToss = ability.id === 'fates_gambit';
                    
                    return (
                      <button
                        key={ability.id}
                        onClick={() => handleActionSelect(ability)}
                        disabled={isDisabled}
                        className={`w-full ${
                          isDisabled
                            ? 'bg-gray-600 opacity-50 cursor-not-allowed'
                            : 'bg-purple-600 hover:bg-purple-700'
                        } p-3 rounded-lg transition-colors text-left text-white`}
                      >
                        <div className="flex items-center">
                          <Zap className="w-4 h-4 mr-2" />
                          <span className="font-bold">{ability.name}</span>
                          <span className="ml-2 text-xs bg-black bg-opacity-30 px-2 py-1 rounded">
                            {ability.cost} pts
                          </span>
                          {ability.targetType === 'ally' && (
                            <span className="ml-2 text-xs bg-blue-600 px-2 py-1 rounded">
                              ALLY
                            </span>
                          )}
                          {endsTurn && (
                            <span className="ml-2 text-xs bg-red-600 px-2 py-1 rounded">
                              ENDS TURN
                            </span>
                          )}
                          {allowsCardToss && (
                            <span className="ml-2 text-xs bg-green-600 px-2 py-1 rounded">
                              +CARD TOSS
                            </span>
                          )}
                        </div>
                        <div className="text-sm opacity-90 mt-1">{ability.description}</div>
                        <div className="text-xs text-clair-gold-200 mt-1">{ability.damage}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ultimate Ability - Crescendo of Fate */}
              <div>
                <h4 className="text-sm font-bold text-yellow-300 mb-2">Ultimate Ability</h4>
                <button
                  onClick={handleActivateUltimate}
                  disabled={!isMyTurn || !combatActive || abilityPoints < 3 || isStormActive}
                  className={`w-full p-3 rounded-lg font-semibold text-white transition-all duration-200 text-left ${
                    isStormActive || abilityPoints < 3
                      ? 'bg-gray-600 cursor-not-allowed opacity-50'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                  }`}
                >
                  <div className="flex items-center">
                    <span className="text-xl mr-2">⚡</span>
                    <span className="font-bold">Crescendo of Fate</span>
                    <span className="ml-2 text-xs bg-black bg-opacity-30 px-2 py-1 rounded">
                      3 pts
                    </span>
                    <span className="ml-2 text-xs bg-yellow-600 px-2 py-1 rounded">ULTIMATE</span>
                  </div>
                  <div className="text-sm opacity-90 mt-1">
                    {isStormActive 
                      ? '⚡ Storm Active - Radiant fury rages!'
                      : '5-turn radiant storm of destiny. Turn ends automatically.'
                    }
                  </div>
                  <div className="text-xs text-clair-gold-200 mt-1">
                    Auto-targeting storm: 3d6 radiant per turn (triggers on Sciel's turn only)
                  </div>
                </button>
              </div>
            </div>
          ) : (
            /* Action Resolution */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-green-200">
                  <Target className="w-4 h-4 inline mr-2" />
                  {selectedAction.name}
                </h4>
                <button onClick={handleCancelAction} className="text-sm bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-white">
                  Cancel
                </button>
              </div>

              <div className="p-3 bg-green-900 bg-opacity-30 rounded-lg border border-green-600">
                <p className="text-green-200 text-sm">
                  ⚡ Turn will end automatically after this action
                </p>
              </div>

              {/* Fate's Gambit - No targeting needed */}
              {selectedAction.id === 'fates_gambit' && (
                <div className="space-y-3">
                  <div className="p-3 bg-purple-900 bg-opacity-30 rounded-lg">
                    <p className="text-purple-200 text-sm">
                      This will randomly select an Explosive, Switch, or Vanish card to enhance your next Card Toss.
                      <br/><strong className="text-green-300">You can use Card Toss on the same turn!</strong>
                      <br/><span className="text-yellow-300">Note: Other abilities will be locked after using Fate's Gambit.</span>
                    </p>
                  </div>
                  <button onClick={handleConfirmAction} className="w-full bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-lg font-bold transition-colors">
                    🎲 Roll Fate's Gambit
                  </button>
                </div>
              )}

              {/* Actions requiring target selection */}
              {(selectedAction.id === 'card_toss' || selectedAction.id === 'rewrite_destiny' || selectedAction.id === 'glimpse_future') && (
                <>
                  <button
                    onClick={() => setShowTargetingModal(true)}
                    className="w-full p-4 bg-clair-gold-600 hover:bg-clair-gold-700 text-clair-shadow-900 rounded-lg font-bold transition-colors flex items-center justify-center"
                  >
                    <Target className="w-5 h-5 mr-2" />
                    Select {selectedAction.targetType === 'ally' ? 'Ally' : 'Target'}
                    {selectedTarget && (
                      <span className="ml-2 text-sm">
                        ({(selectedAction.targetType === 'ally' ? getValidTargets('ally') : availableEnemies).find(e => e.id === selectedTarget)?.name})
                      </span>
                    )}
                  </button>

                  {/* AC Roll Input for Card Toss only */}
                  {selectedTarget && selectedAction.id === 'card_toss' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-bold mb-2 text-clair-gold-300">
                          Roll d20 + modifiers:
                        </label>
                        <input
                          type="number"
                          value={acRoll}
                          onChange={(e) => setACRoll(e.target.value)}
                          placeholder="Enter your attack roll total"
                          className="w-full p-3 bg-clair-shadow-800 border border-clair-shadow-400 rounded-lg text-clair-gold-200"
                          min={1}
                          max={30}
                        />
                      </div>
                      <button
                        onClick={handleConfirmAction}
                        disabled={!acRoll}
                        className="w-full bg-clair-gold-600 hover:bg-clair-gold-700 disabled:bg-clair-shadow-600 text-clair-shadow-900 p-3 rounded-lg font-bold transition-colors"
                      >
                        {chargedFateCard ? (
                          <>
                            {chargedFateCard === 'explosive' && '💥 Explosive '}
                            {chargedFateCard === 'switch' && '🔄 Switch '}
                            {chargedFateCard === 'vanish' && '👻 Vanish '}
                            Card Toss
                          </>
                        ) : (
                          'Throw Card'
                        )}
                      </button>
                    </div>
                  )}

                  {/* Instant actions for buff/debuff abilities */}
                  {selectedTarget && (selectedAction.id === 'rewrite_destiny' || selectedAction.id === 'glimpse_future') && (
                    <button
                      onClick={handleConfirmAction}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-lg font-bold transition-colors"
                    >
                      {selectedAction.id === 'rewrite_destiny' ? '📜 Rewrite Destiny' : '🔮 Glimpse Future'}
                    </button>
                  )}

                  {getValidTargets(selectedAction.targetType).length === 0 && (
                    <div className="text-center text-clair-gold-400 py-4">
                      No {selectedAction.targetType === 'ally' ? 'allies' : 'enemies'} available
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* REMOVED: End Turn button */}

          {/* Tips */}
          <div className="mt-4 p-3 bg-green-900 bg-opacity-20 rounded-lg border border-green-600">
            <h4 className="font-serif font-bold text-green-400 text-sm mb-2">Combat Tips:</h4>
            <ul className="text-xs text-green-300 space-y-1">
              <li>⚡ Your turn ends automatically after any action</li>
              <li>• <strong>Card Toss:</strong> Basic ranged attack (ends turn)</li>
              <li>• <strong>Rewrite Destiny:</strong> Enemy disadvantage (ends turn)</li>
              <li>• <strong>Glimpse Future:</strong> Ally advantage (ends turn)</li>
              <li>• <strong>Fate's Gambit:</strong> Enhance next Card Toss (allows Card Toss same turn)</li>
              <li>• <span className="text-yellow-300">Only Fate's Gambit → Card Toss allows two actions per turn</span></li>
              <li>• Ranged attacks get -2 AC penalty per 5ft beyond 30ft</li>
              <li>• <strong>Crescendo of Fate:</strong> 5-turn storm (3d6 radiant on your turns)!</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Enemy/Ally Targeting Modal */}
      <EnemyTargetingModal
        isOpen={showTargetingModal}
        onClose={() => setShowTargetingModal(false)}
        enemies={selectedAction?.targetType === 'ally' ? getValidTargets('ally') : availableEnemies}
        playerPosition={playerPosition}
        sessionId={sessionId}
        playerId={character.id}
       onSelectEnemy={(target) => {
          setSelectedTarget(target.id);
          setShowTargetingModal(false);
        }}
        selectedEnemyId={selectedTarget}
        abilityName={selectedAction?.name}
        abilityRange={999}
      />

      <InventoryModal
        isOpen={showInventoryModal}
        characterName={character.name}
        inventory={inventory}
        goldAmount={goldAmount}
        isLoading={inventoryLoading}
        onClose={() => setShowInventoryModal(false)}
      />

    </div>
    </NPCTabSystem> 
  );
}