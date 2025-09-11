// src/components/CharacterSheet/ScielCharacterSheet.tsx
import React, { useState } from 'react';
import { User, Sparkles, Target, Eye, Zap, Circle, Heart } from 'lucide-react';
import { FirestoreService } from '../../services/firestoreService';
import { HPTracker } from './HPTracker';
import { StatDisplay } from './StatDisplay';
import { EnemyTargetingModal } from '../Combat/EnemyTargetingModal';
import { useStormSystem } from '../../hooks/useStormSystem';
import { StormService } from '../../services/StormService';
import { StormIndicator } from '../Combat/StormIndicator';
import type { Character, Position, BattleToken } from '../../types';
import { useUltimateVideo } from '../../hooks/useUltimateVideo';

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
  foretellStacks?: Record<string, number>;
  onStacksChange?: (stacks: Record<string, number>) => void;
  foretellChainCharged?: boolean;
  onChainChargedChange?: (charged: boolean) => void;
  bonusActionCooldown?: number;
  onBonusActionCooldownChange?: (cooldown: number) => void;

  // For abilities that need special targeting
  sessionId?: string;
  allTokens?: BattleToken[];
}

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
  foretellStacks = {},
  onStacksChange,
  foretellChainCharged = false,
  onChainChargedChange,
  bonusActionCooldown = 0,
  onBonusActionCooldownChange,
  sessionId = 'test-session',
  allTokens = [],
}: ScielCharacterSheetProps) {
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [acRoll, setACRoll] = useState<string>('');
  const [showTargetingModal, setShowTargetingModal] = useState(false);
  const { triggerUltimate } = useUltimateVideo(sessionId);

  const [selectedAction, setSelectedAction] = useState<{
    type: 'basic' | 'ability' | 'bonus';
    id: string;
    name: string;
    description: string;
    damage?: string;
    cost?: number;
    isBonusAction?: boolean;
  } | null>(null);
  const [showBonusAction, setShowBonusAction] = useState(false);

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

  // Get valid targets (all enemies for Sciel's ranged attacks)
  const getValidTargets = () => {
    return availableEnemies;
  };

  // Add foretell stack to enemy
  const addForetellStack = (enemyId: string) => {
    const currentStacks = foretellStacks[enemyId] || 0;
    if (currentStacks >= 3) return; // Max 3 stacks per enemy
    
    const newStacks = {
      ...foretellStacks,
      [enemyId]: currentStacks + 1
    };
    onStacksChange?.(newStacks);
  };

  // Remove foretell stacks from enemy
  const removeForetellStacks = (enemyId: string, count: number = 1) => {
    const currentStacks = foretellStacks[enemyId] || 0;
    const newStacks = { ...foretellStacks };
    
    if (currentStacks <= count) {
      delete newStacks[enemyId];
    } else {
      newStacks[enemyId] = currentStacks - count;
    }
    
    onStacksChange?.(newStacks);
  };

  // Clear all foretell stacks (for Crescendo of Fate)
  const clearAllStacks = () => {
    onStacksChange?.({});
  };

  // Find enemies within range of a position
  const findEnemiesInRange = (centerPos: Position, range: number) => {
    return availableEnemies.filter(enemy => {
      const distance = calculateDistance(centerPos, enemy.position);
      return distance <= range;
    });
  };

  // Handle Crescendo of Fate activation
  const handleActivateUltimate = async () => {
    const totalStacks = Object.values(foretellStacks).reduce((sum, stacks) => sum + stacks, 0);
    
    if (totalStacks === 0) {
      alert('No enemies have Foretell stacks for Crescendo of Fate!');
      return;
    }

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

      // Activate the storm system
      await StormService.activateStorm(sessionId, totalStacks);
      
      // Clear all foretell stacks
      clearAllStacks();
      
      // Consume ability points
      onAbilityPointsChange?.(-3);
      
      // Mark as having acted
      if (onTargetSelect) {
        onTargetSelect('storm_activated', 0, 'ultimate', 'crescendo_of_fate');
      }
      
      setShowBonusAction(hasActedThisTurn && bonusActionCooldown === 0);
      
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

    // Check bonus action cooldown
    if (action.isBonusAction && bonusActionCooldown > 0) {
      alert(`Bonus action on cooldown for ${bonusActionCooldown} more rounds`);
      return;
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

    // Handle Bonus Action (Guiding Cards)
    if (selectedAction.isBonusAction) {
      if (onTargetSelect) {
        onTargetSelect('bonus_action_used', 0, 'bonus', selectedAction.id);
      }
      
      onBonusActionCooldownChange?.(3);
      
      setSelectedAction(null);
      setShowBonusAction(false);
      return;
    }

    // Handle Card Toss (basic attack)
    if (selectedAction.id === 'card_toss') {
      if (!selectedTarget || !acRoll) {
        alert('Please select target and enter AC roll');
        return;
      }

      const enemy = availableEnemies.find(e => e.id === selectedTarget);
      if (!enemy) return;

      // Apply range penalty
      const distance = calculateDistance(playerPosition, enemy.position);
      const finalAC = applyRangePenalty(parseInt(acRoll), distance);
      const hit = finalAC >= enemy.ac;

      if (hit) {
        // Add foretell stack to primary target
        addForetellStack(selectedTarget);

        // If Foretell Chain is charged, apply stacks to nearby enemies
        if (foretellChainCharged) {
          const nearbyEnemies = findEnemiesInRange(enemy.position, 20)
            .filter(e => e.id !== selectedTarget)
            .sort((a, b) => calculateDistance(enemy.position, a.position) - calculateDistance(enemy.position, b.position))
            .slice(0, 2);

          nearbyEnemies.forEach(nearbyEnemy => {
            addForetellStack(nearbyEnemy.id);
          });

          // Consume the chain charge
          onChainChargedChange?.(false);
        }
      }

      if (onTargetSelect) {
        onTargetSelect(selectedTarget, finalAC, 'ranged', selectedAction.id);
      }

      setSelectedAction(null);
      setSelectedTarget('');
      setACRoll('');
      setShowTargetingModal(false);
      setShowBonusAction(hasActedThisTurn && bonusActionCooldown === 0);
      return;
    }

    // Handle Foretell Chain
    if (selectedAction.id === 'foretell_chain') {
      onAbilityPointsChange?.(-selectedAction.cost!);
      onChainChargedChange?.(true);
      if (onTargetSelect) {
        onTargetSelect('foretell_chain_charged', 0, 'ability', selectedAction.id);
      }
      setSelectedAction(null);
      setShowBonusAction(hasActedThisTurn && bonusActionCooldown === 0);
      return;
    }

    // Handle Foretell Sweep
    if (selectedAction.id === 'foretell_sweep') {
      if (!acRoll) {
        alert('Please enter AC roll');
        return;
      }

      const enemiesWithStacks = availableEnemies.filter(enemy => foretellStacks[enemy.id] > 0);
      if (enemiesWithStacks.length === 0) {
        alert('No enemies have Foretell stacks to consume!');
        return;
      }

      const baseAC = parseInt(acRoll);
      const hitEnemies: string[] = [];

      enemiesWithStacks.forEach(enemy => {
        const distance = calculateDistance(playerPosition, enemy.position);
        const finalAC = applyRangePenalty(baseAC, distance);
        
        if (finalAC >= enemy.ac) {
          hitEnemies.push(enemy.id);
        }
      });

      // Consume all stacks from all enemies (hit or miss)
      enemiesWithStacks.forEach(enemy => {
        removeForetellStacks(enemy.id, foretellStacks[enemy.id]);
      });

      // Send hits to GM
      if (onTargetSelect && hitEnemies.length > 0) {
        hitEnemies.forEach(enemyId => {
          onTargetSelect(enemyId, baseAC, 'ability', selectedAction.id);
        });
      }

      onAbilityPointsChange?.(-selectedAction.cost!);
      setSelectedAction(null);
      setACRoll('');
      setShowBonusAction(hasActedThisTurn && bonusActionCooldown === 0);
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
  const totalStacks = Object.values(foretellStacks).reduce((sum, stacks) => sum + stacks, 0);

  // Define Sciel's actions
  const basicAttack = {
    type: 'basic' as const,
    id: 'card_toss',
    name: 'Card Toss',
    description: 'Ranged attack that applies Foretell Stack',
    damage: '1d6 slashing + 1d4 radiant',
    icon: Circle,
    range: 'Unlimited',
  };

  const abilities = [
    {
      type: 'ability' as const,
      id: 'foretell_chain',
      name: 'Foretell Chain',
      description: 'Charge next Card Toss to affect 2 additional nearby enemies',
      damage: 'Enhances next Card Toss',
      cost: 1,
      range: 'Self-buff',
    },
    {
      type: 'ability' as const,
      id: 'foretell_sweep',
      name: 'Foretell Sweep',
      description: 'Consume stacks from all enemies in range for radiant damage',
      damage: '2d8 radiant per stack',
      cost: 2,
      range: 'All enemies with stacks',
    },
  ];

  const bonusAction = {
    type: 'bonus' as const,
    id: 'guiding_cards',
    name: 'Guiding Cards',
    description: 'Grant an ally +1d4 to their next attack or saving throw',
    damage: 'Support ally',
    isBonusAction: true,
  };

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
                style={{ imageRendering: 'crisp-edges' }}  // Fixed: use valid value
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
              Action completed this turn - {showBonusAction ? 'Use bonus action or ' : ''}Click "End Turn" when ready
            </span>
          </div>
        )}

        {/* HP TRACKER */}
        <HPTracker currentHP={character.currentHP} maxHP={character.maxHP} onHPChange={onHPChange} isLoading={isLoading} showControls={false}/>

        {/* ABILITY SCORES */}
        <StatDisplay stats={character.stats} />

        {/* Ability Points */}
        <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 mb-4 border border-clair-gold-600">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Sparkles className="w-6 h-6 text-clair-gold-500 mr-2" />
              <h3 className="font-display text-lg font-bold text-clair-gold-400">Ability Points</h3>
            </div>
            <div className="font-serif text-2xl font-bold text-clair-gold-50">{abilityPoints} / 5</div>
          </div>
          
          <div className="flex justify-center space-x-2 mb-2">
            {Array.from({ length: 5 }).map((_, index) => (
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

        {/* Foretell Stacks Display */}
        {totalStacks > 0 && (
          <div className="bg-green-900 bg-opacity-30 border border-green-500 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-green-300 font-bold">Active Foretell Stacks</h3>
              <span className="text-green-200 text-sm font-bold">{totalStacks} total</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(foretellStacks).map(([enemyId, stacks]) => {
                const enemy = availableEnemies.find(e => e.id === enemyId);
                return (
                  <div key={enemyId} className="flex items-center justify-between bg-green-800 bg-opacity-50 p-2 rounded">
                    <span className="text-green-200 text-sm">{enemy?.name || enemyId}</span>
                    <div className="flex space-x-1">
                      {Array.from({ length: stacks }).map((_, i) => (
                        <div key={i} className="w-2 h-2 bg-green-400 rounded-full"></div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Foretell Chain Status */}
        {foretellChainCharged && (
          <div className="bg-green-900 bg-opacity-30 border border-green-500 rounded-lg p-3 mb-4 flex items-center">
            <Zap className="w-5 h-5 text-green-400 mr-3" />
            <span className="font-sans text-green-300">
              <strong>Foretell Chain Active!</strong> Next Card Toss will affect nearby enemies
            </span>
          </div>
        )}

        {/* Bonus Action Cooldown */}
        {bonusActionCooldown > 0 && (
          <div className="bg-blue-900 bg-opacity-30 border border-blue-500 rounded-lg p-3 mb-4 flex items-center">
            <Heart className="w-5 h-5 text-blue-400 mr-3" />
            <span className="font-sans text-blue-300">
              <strong>Guiding Cards</strong> available in {bonusActionCooldown} rounds
            </span>
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
                    <span className="ml-2 text-xs bg-black bg-opacity-30 px-2 py-1 rounded">
                      +1 Stack
                    </span>
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
                  disabled={!isMyTurn || !combatActive || abilityPoints < 3 || totalStacks === 0 || isStormActive || (hasActedThisTurn && !showBonusAction)}
                  className={`w-full p-3 rounded-lg font-semibold text-white transition-all duration-200 text-left ${
                    totalStacks === 0 || isStormActive || abilityPoints < 3
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
                      : totalStacks === 0 
                        ? 'Need Foretell Stacks to activate'
                        : `5-turn radiant storm using ${totalStacks} stacks`
                    }
                  </div>
                  <div className="text-xs text-clair-gold-200 mt-1">
                    Auto-targeting storm: 3d6 radiant per turn (triggers on Sciel's turn only)
                  </div>
                </button>
              </div>

              {/* Bonus Action */}
              {showBonusAction && (
                <div>
                  <h4 className="text-sm font-bold text-blue-300 mb-2">Bonus Action</h4>
                  <button
                    onClick={() => handleActionSelect(bonusAction)}
                    disabled={bonusActionCooldown > 0}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 p-3 rounded-lg transition-colors text-left text-white"
                  >
                    <div className="flex items-center">
                      <Heart className="w-4 h-4 mr-2" />
                      <span className="font-bold">{bonusAction.name}</span>
                      <span className="ml-2 text-xs bg-black bg-opacity-30 px-2 py-1 rounded">
                        BONUS
                      </span>
                    </div>
                    <div className="text-sm opacity-90 mt-1">{bonusAction.description}</div>
                    <div className="text-xs text-clair-gold-200 mt-1">{bonusAction.damage}</div>
                  </button>
                </div>
              )}
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

              {selectedAction.id === 'foretell_chain' && (
                <div className="space-y-3">
                  <div className="p-3 bg-green-900 bg-opacity-30 rounded-lg">
                    <p className="text-green-200 text-sm">
                      Your next Card Toss will apply Foretell Stacks to up to 2 additional enemies within 10ft of your target.
                      <br/><strong>Using Foretell Chain will end your turn.</strong>
                    </p>
                  </div>
                  <button onClick={handleConfirmAction} className="w-full bg-green-600 hover:bg-green-700 text-white p-3 rounded-lg font-bold transition-colors">
                    Charge Foretell Chain
                  </button>
                </div>
              )}

              {/* Foretell Sweep - AC roll only */}
              {selectedAction.id === 'foretell_sweep' && (
                <div className="space-y-3">
                  <div className="p-3 bg-purple-900 bg-opacity-30 rounded-lg">
                    <p className="text-purple-200 text-sm mb-2">
                      Affects all enemies with Foretell Stacks. Single AC roll determines hits.
                    </p>
                    <div className="text-xs text-purple-300">
                      Enemies with stacks: {availableEnemies.filter(e => foretellStacks[e.id] > 0).map(e => `${e.name} (${foretellStacks[e.id]})`).join(', ') || 'None'}
                    </div>
                  </div>
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
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-clair-shadow-600 text-white p-3 rounded-lg font-bold transition-colors"
                  >
                    Unleash Foretell Sweep
                  </button>
                </div>
              )}

              {/* Guiding Cards - No input needed */}
              {selectedAction.isBonusAction && (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-900 bg-opacity-30 rounded-lg">
                    <p className="text-blue-200 text-sm">
                      Tell the GM which ally should receive +1d4 to their next attack or saving throw.
                    </p>
                  </div>
                  <button onClick={handleConfirmAction} className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-bold transition-colors">
                    Use Guiding Cards
                  </button>
                </div>
              )}

              {/* Card Toss - Target selection with modal */}
              {selectedAction.id === 'card_toss' && (
                <>
                  {/* Modal Trigger Button */}
                  <div className="space-y-3">
                    <button
                      onClick={() => setShowTargetingModal(true)}
                      className="w-full p-4 bg-clair-gold-600 hover:bg-clair-gold-700 text-clair-shadow-900 rounded-lg font-bold transition-colors flex items-center justify-center"
                    >
                      <Target className="w-5 h-5 mr-2" />
                      Select Target
                      {selectedTarget && (
                        <span className="ml-2 text-sm">
                          ({availableEnemies.find(e => e.id === selectedTarget)?.name})
                        </span>
                      )}
                    </button>

                    {/* AC Roll Input and Confirm Button */}
                    {selectedTarget && (
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
                          Throw Card
                        </button>
                      </div>
                    )}
                  </div>

                  {getValidTargets().length === 0 && (
                    <div className="text-center text-clair-gold-400 py-4">No enemies available</div>
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
              <li>• Card Toss applies Foretell Stacks (max 3 per enemy)</li>
              <li>• Foretell Chain affects enemies within 10ft (ends your turn)</li>
              <li>• Foretell Sweep hits all stacked enemies with one roll</li>
              <li>• Guiding Cards is a bonus action (3-round cooldown)</li>
              <li>• Ranged attacks get -2 AC penalty per 5ft beyond 30ft</li>
              <li>• <strong>Crescendo of Fate: 5-turn storm (3d6 radiant on Sciel's turns only)!</strong></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Enemy Targeting Modal */}
      <EnemyTargetingModal
        isOpen={showTargetingModal}
        onClose={() => setShowTargetingModal(false)}
        enemies={availableEnemies}
        playerPosition={playerPosition}
        onSelectEnemy={(enemy) => {
          setSelectedTarget(enemy.id);
          if (sessionId) {
            FirestoreService.updateTargetingState(sessionId, {
              selectedEnemyId: enemy.id,
              playerId: character.id
            });
          }
          // Don't close modal here - wait for confirmation
        }}
        selectedEnemyId={selectedTarget}
        abilityName={selectedAction?.name}
        abilityRange={999} // Sciel has unlimited range
      />
    </div>
  );
}