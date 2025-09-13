// src/components/CharacterSheet/ScielCharacterSheet.tsx
import React, { useState, useEffect } from 'react';
import { User, Sparkles, Target, Eye, Zap, Circle, Heart, Shuffle } from 'lucide-react';
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

interface ScielCharacterSheetProps {
  character: Character;
  onHPChange: (delta: number) => void;
  onAbilityPointsChange: (delta: number) => void;
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
  playerPosition?: { x: number; y: number };
  onTargetSelect?: (targetId: string, acRoll: number, attackType: string, abilityId?: string) => void;
  onEndTurn?: () => void;
  onCancelTargeting?: () => void;
  hasActedThisTurn?: boolean;
  sessionId?: string;
  allTokens?: BattleToken[];
}

type FateCard = 'explosive' | 'switch' | 'vanish' | null;

export function ScielCharacterSheet({
  character,
  onHPChange,
  onAbilityPointsChange,
  onAbilityUse,
  isLoading = false,
  isMyTurn = false,
  combatActive = false,
  availableEnemies = [],
  playerPosition = { x: 0, y: 0 },
  onTargetSelect,
  onEndTurn,
  onCancelTargeting,
  hasActedThisTurn = false,
  sessionId = 'test-session',
  allTokens = [],
}: ScielCharacterSheetProps) {
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [acRoll, setACRoll] = useState<string>('');
  const [showTargetingModal, setShowTargetingModal] = useState(false);
  const { triggerUltimate } = useUltimateVideo(sessionId);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const { gold: goldAmount, inventory, loading: inventoryLoading } = useRealtimeInventory(character?.id || '');
  const [isAbilityProcessing, setIsAbilityProcessing] = useState(false);

  // New state for Sciel's reworked abilities
  const [chargedFateCard, setChargedFateCard] = useState<FateCard>(null);
  const [showBonusAction, setShowBonusAction] = useState(false);

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

  // Handle Fate's Gambit - randomly select a card type
  const handleFatesGambit = () => {
    const cardTypes: FateCard[] = ['explosive', 'switch', 'vanish'];
    const randomCard = cardTypes[Math.floor(Math.random() * cardTypes.length)];
    setChargedFateCard(randomCard);
    onAbilityPointsChange?.(-1);
    
    if (onTargetSelect) {
      onTargetSelect('fate_gambit_used', 0, 'ability', 'fates_gambit');
    }
    setShowBonusAction(hasActedThisTurn);
  };

  // Handle Crescendo of Fate activation (keeping existing logic)
  const handleActivateUltimate = async () => {
    if (isStormActive) {
      alert('Storm is already active!');
      return;
    }

    const currentPoints = character.charges || 0;
    if (currentPoints < 3) {
      alert('Not enough ability points! Need 3, have ' + currentPoints);
      return;
    }

    try {
      await triggerUltimate('sciel', 'Crescendo of Fate');
      await StormService.activateStorm(sessionId, 5); // Always 5-turn storm now
      onAbilityPointsChange?.(-3);
      
      if (onTargetSelect) {
        onTargetSelect('storm_activated', 0, 'ultimate', 'crescendo_of_fate');
      }
      
      setShowBonusAction(hasActedThisTurn);
    } catch (error) {
      console.error('Failed to activate Crescendo of Fate:', error);
      alert('Failed to activate storm system!');
    }
  };

  // Handle action selection
  const handleActionSelect = (action: any) => {
    if (hasActedThisTurn && !action.isBonusAction) return;

    // Check ability point costs
    if (action.type === 'ability' && action.cost) {
      const currentPoints = character.charges || 0;
      if (currentPoints < action.cost) {
        alert(`Not enough ability points! Need ${action.cost}, have ${currentPoints}`);
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

  // Handle Card Toss (basic attack) - FIXED VERSION
  if (selectedAction.id === 'card_toss') {
    if (!selectedTarget || !acRoll) {
      alert('Please select target and enter AC roll');
      return;
    }

    const enemy = availableEnemies.find(e => e.id === selectedTarget);
    if (!enemy) return;

    const distance = calculateDistance(playerPosition, enemy.position);
    const finalAC = applyRangePenalty(parseInt(acRoll), distance);
    const hit = finalAC >= enemy.ac;

    // NEW CODE:
      if (hit && onAbilityPointsChange && !chargedFateCard) {
        await onAbilityPointsChange(1);
        console.log('Generated ability point for successful regular card toss');
      } else if (hit && chargedFateCard) {
        console.log(`No ability point generated for enhanced ${chargedFateCard} card toss`);
      }
    // ✅ FIXED: Create specialized actions for ALL charged cards (hit or miss)
    if (chargedFateCard) {
      if (chargedFateCard === 'explosive') {
        // Create AoE action for explosion - only if it hits
        if (hit) {
          const nearbyEnemies = availableEnemies.filter(e => {
            if (e.id === selectedTarget) return true; // Include primary target
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
          // Miss - create regular attack action to show the miss
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
        // ✅ ALWAYS create switch card action (hit or miss)
        await FirestoreService.createSwitchCardAction(sessionId, {
          playerId: character.id,
          targetId: selectedTarget,
          playerPosition: playerPosition,
          targetPosition: enemy.position,
          acRoll: finalAC
        });
      } else if (chargedFateCard === 'vanish') {
        // ✅ ALWAYS create vanish card action (hit or miss)
        await FirestoreService.createVanishCardAction(sessionId, {
          playerId: character.id,
          targetId: selectedTarget,
          acRoll: finalAC
        });
      }
      
      // Consume the charged card
      setChargedFateCard(null);
    } else {
      // Regular card toss - no special effects
      await FirestoreService.createAttackAction(
        sessionId,
        character.id,
        selectedTarget,
        playerPosition,
        finalAC,
        'Card Toss'
      );
    }

    if (onTargetSelect) {
      onTargetSelect('action_taken', finalAC, 'ranged', selectedAction.id);
    }

    setSelectedAction(null);
    setSelectedTarget('');
    setACRoll('');
    setShowTargetingModal(false);
    setShowBonusAction(hasActedThisTurn);
    return;
  }

  // 3. FIX: Use createBuffAction for Rewrite Destiny
  if (selectedAction.id === 'rewrite_destiny') {
    if (!selectedTarget) {
      alert('Please select an enemy to curse with disadvantage');
      return;
    }

    // ✅ USE SPECIALIZED BUFF ACTION instead of createAttackAction
    await FirestoreService.createBuffAction(sessionId, {
      playerId: character.id,
      targetId: selectedTarget,
      abilityName: 'Rewrite Destiny',
      buffType: 'disadvantage',
      duration: 1 // Lasts 1 turn
    });

    onAbilityPointsChange?.(-selectedAction.cost!);
    if (onTargetSelect) {
      onTargetSelect(selectedTarget, 0, 'ability', selectedAction.id);
    }
    setSelectedAction(null);
    setShowBonusAction(hasActedThisTurn);
    return;
  }

  // 4. FIX: Use createBuffAction for Glimpse Future
  if (selectedAction.id === 'glimpse_future') {
    if (!selectedTarget) {
      alert('Please select an ally to grant advantage');
      return;
    }

    // ✅ USE SPECIALIZED BUFF ACTION instead of createAttackAction
    await FirestoreService.createBuffAction(sessionId, {
      playerId: character.id,
      targetId: selectedTarget,
      abilityName: 'Glimpse Future',
      buffType: 'advantage',
      duration: 1 // Lasts 1 turn
    });

    onAbilityPointsChange?.(-selectedAction.cost!);
    if (onTargetSelect) {
      onTargetSelect(selectedTarget, 0, 'ability', selectedAction.id);
    }
    setSelectedAction(null);
    setShowBonusAction(hasActedThisTurn);
    return;
  }

  // Handle Fate's Gambit (unchanged)
  if (selectedAction.id === 'fates_gambit') {
    handleFatesGambit();
    setSelectedAction(null);
    return;
  }
};

  const handleCancelAction = () => {
    setSelectedAction(null);
    setSelectedTarget('');
    setACRoll('');
    setShowBonusAction(false);
    setShowTargetingModal(false);
    onCancelTargeting?.();
  };

  const abilityPoints = character.charges || 0;

  // Define Sciel's actions
  const basicAttack = {
    type: 'basic' as const,
    id: 'card_toss',
    name: 'Card Toss',
    description: chargedFateCard 
      ? `Enhanced with ${chargedFateCard === 'explosive' ? '💥 Explosive' : chargedFateCard === 'switch' ? '🔄 Switch' : '👻 Vanish'} Card`
      : 'Ranged attack with magical cards',
    damage: '1d6 slashing + 1d4 radiant',
    icon: Circle,
    range: 'Unlimited',
  };

  const abilities = [
    {
      type: 'ability' as const,
      id: 'rewrite_destiny',
      name: 'Rewrite Destiny',
      description: 'Curse an enemy with disadvantage on their next turn',
      damage: 'Disadvantage debuff',
      cost: 1,
      range: 'Any enemy',
      targetType: 'enemy' as const,
    },
    {
      type: 'ability' as const,
      id: 'glimpse_future',
      name: 'Glimpse Future',
      description: 'Grant an ally advantage on their next turn',
      damage: 'Advantage buff',
      cost: 2,
      range: 'Any ally',
      targetType: 'ally' as const,
    },
    {
      type: 'ability' as const,
      id: 'fates_gambit',
      name: "Fate's Gambit",
      description: 'Randomly enhance your next Card Toss with a special effect',
      damage: 'Card enhancement',
      cost: 2,
      range: 'Self',
    },
  ];

  return (
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

        {/* Action Status */}
        {isMyTurn && combatActive && hasActedThisTurn && (
          <div className="bg-clair-success bg-opacity-20 border border-clair-success rounded-lg p-3 mb-4 flex items-center">
            <div className="w-4 h-4 bg-clair-success rounded-full mr-3"></div>
            <span className="font-sans text-clair-success">
              Action completed this turn - Click "End Turn" when ready
            </span>
          </div>
        )}

        {/* HP TRACKER */}
        <HPTracker currentHP={character.currentHP} maxHP={character.maxHP} onHPChange={onHPChange} isLoading={isLoading} showControls={false}/>

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
          <div className="bg-purple-900 bg-opacity-30 border border-purple-500 rounded-lg p-4 mb-4">
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
                  disabled={!isMyTurn || !combatActive || (hasActedThisTurn && !showBonusAction) || isStormActive}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:opacity-50 p-3 rounded-lg transition-colors text-left text-white"
                >
                  <div className="flex items-center">
                    <Circle className="w-4 h-4 mr-2" />
                    <span className="font-bold">{basicAttack.name}</span>
                    {chargedFateCard && (
                      <span className="ml-2 text-xs bg-purple-600 px-2 py-1 rounded">
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
                  {abilities.map((ability) => (
                    <button
                      key={ability.id}
                      onClick={() => handleActionSelect(ability)}
                      disabled={!isMyTurn || !combatActive || abilityPoints < ability.cost || (hasActedThisTurn && !showBonusAction) || isStormActive}
                      className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:opacity-50 p-3 rounded-lg transition-colors text-left text-white"
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
                      </div>
                      <div className="text-sm opacity-90 mt-1">{ability.description}</div>
                      <div className="text-xs text-clair-gold-200 mt-1">{ability.damage}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ultimate Ability - Crescendo of Fate */}
              <div>
                <h4 className="text-sm font-bold text-yellow-300 mb-2">Ultimate Ability</h4>
                <button
                  onClick={handleActivateUltimate}
                  disabled={!isMyTurn || !combatActive || abilityPoints < 3 || isStormActive || (hasActedThisTurn && !showBonusAction)}
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
                      : '5-turn radiant storm of destiny'
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

              {/* Fate's Gambit - No targeting needed */}
              {selectedAction.id === 'fates_gambit' && (
                <div className="space-y-3">
                  <div className="p-3 bg-purple-900 bg-opacity-30 rounded-lg">
                    <p className="text-purple-200 text-sm">
                      This will randomly select an Explosive, Switch, or Vanish card to enhance your next Card Toss.
                      <br/><strong>Using Fate's Gambit will end your turn.</strong>
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

          {/* End Turn */}
          {isMyTurn && combatActive && !selectedAction && hasActedThisTurn && !showBonusAction && (
            <button
              onClick={onEndTurn}
              className="w-full mt-4 p-3 rounded-lg font-bold transition-colors bg-clair-gold-600 hover:bg-clair-gold-700 text-clair-shadow-900"
            >
              <Eye className="w-5 h-5 inline mr-2" />
              End Turn
            </button>
          )}

          {/* Tips */}
          <div className="mt-4 p-3 bg-green-900 bg-opacity-20 rounded-lg border border-green-600">
            <h4 className="font-serif font-bold text-green-400 text-sm mb-2">Combat Tips:</h4>
            <ul className="text-xs text-green-300 space-y-1">
              <li>• Card Toss: Ranged attack with unlimited range</li>
              <li>• Rewrite Destiny: Enemy gets disadvantage on next turn</li>
              <li>• Glimpse Future: Ally gets advantage on next turn</li>
              <li>• Fate's Gambit: Random card effect for next Card Toss</li>
              <li>• Ranged attacks get -2 AC penalty per 5ft beyond 30ft</li>
              <li>• <strong>Crescendo of Fate: 5-turn storm (3d6 radiant on your turns)!</strong></li>
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
  );
}