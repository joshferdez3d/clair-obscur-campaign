import React, { useState, useEffect } from 'react';
import { Circle, Target, Zap, Heart, Eye, Shuffle, Users } from 'lucide-react';
import type { Character, BattleToken } from '../../types';
import { EnemyTargetingModal } from '../Combat/EnemyTargetingModal';
import { InventoryModal } from './InventoryModal';
import { FirestoreService } from '../../services/firestoreService';
import { useStormSystem } from '../../hooks/useStormSystem';
import { StormService } from '../../services/StormService';

interface Enemy {
  id: string;
  name: string;
  position: { x: number; y: number };
  hp: number;
  maxHp: number;
  ac: number;
}

interface ScielCharacterSheetProps {
  character: Character;
  onHPChange: (delta: number) => void;
  onAbilityPointsChange: (delta: number) => void;
  onAbilityUse: () => void;
  isMyTurn: boolean;
  isLoading: boolean;
  combatActive: boolean;
  availableEnemies: Enemy[];
  playerPosition: { x: number; y: number };
  sessionId: string;
  allTokens: BattleToken[];
  onTargetSelect: (targetId: string, acRoll: number, attackType?: string, abilityId?: string) => void;
  onEndTurn: () => void;
  onCancelTargeting: () => void;
  hasActedThisTurn: boolean;
  foretellStacks: Record<string, number>;
  onStacksChange: (stacks: Record<string, number>) => void;
  foretellChainCharged: boolean;
  onChainChargedChange: (charged: boolean) => void;
  bonusActionCooldown: number;
  onBonusActionCooldownChange: (rounds: number) => void;
}

// Draw Fate card types
type DrawnCard = {
  type: 'explosive' | 'switch' | 'vanish';
  name: string;
  description: string;
};

const DRAW_FATE_CARDS: DrawnCard[] = [
  {
    type: 'explosive',
    name: 'Explosive Card',
    description: 'Next Card Toss hits all enemies within 10ft of target'
  },
  {
    type: 'switch', 
    name: 'Switch Card',
    description: 'After damage, you and target swap positions'
  },
  {
    type: 'vanish',
    name: 'Vanish Card', 
    description: 'Target is banished for 2 turns'
  }
];

export function ScielCharacterSheet({
  character,
  onHPChange,
  onAbilityPointsChange,
  onAbilityUse,
  isMyTurn,
  isLoading,
  combatActive,
  availableEnemies,
  playerPosition,
  sessionId,
  allTokens,
  onTargetSelect,
  onEndTurn,
  onCancelTargeting,
  hasActedThisTurn,
  foretellStacks,
  onStacksChange,
  foretellChainCharged,
  onChainChargedChange,
  bonusActionCooldown,
  onBonusActionCooldownChange
}: ScielCharacterSheetProps) {
  
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showTargetingModal, setShowTargetingModal] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState('');
  const [acRoll, setACRoll] = useState('');
  const [showBonusAction, setShowBonusAction] = useState(false);
  
  // New state for Draw Fate system
  const [drawnCard, setDrawnCard] = useState<DrawnCard | null>(null);
  
  const [selectedAction, setSelectedAction] = useState<{
    type: string;
    id: string;
    name: string;
    description: string;
    damage: string;
    range: string;
    cost?: number;
    isBonusAction?: boolean;
  } | null>(null);

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

  const handleOpenInventory = () => {
    setShowInventoryModal(true);
  };

  // Draw a random fate card
  const drawFateCard = (): DrawnCard => {
    const randomIndex = Math.floor(Math.random() * DRAW_FATE_CARDS.length);
    return DRAW_FATE_CARDS[randomIndex];
  };

  // Handle Crescendo of Fate activation (Ultimate)
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
      // Activate the storm system with base damage
      await StormService.activateStorm(sessionId, 3); // Base 3d6 damage
      
      // Consume ability points
      onAbilityPointsChange(-3);
      
      // Mark as having acted
      onTargetSelect('action_taken', 0, 'ultimate', 'crescendo_of_fate');
      
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

    // Handle Draw Fate special case
    if (action.id === 'draw_fate') {
      const card = drawFateCard();
      setDrawnCard(card);
      
      // Consume ability points and mark turn as used
      onAbilityPointsChange(-action.cost);
      onTargetSelect('action_taken', 0, 'ability', action.id);
      
      setShowBonusAction(hasActedThisTurn && bonusActionCooldown === 0);
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
      onTargetSelect('bonus_action_used', 0, 'bonus', selectedAction.id);
      onBonusActionCooldownChange(3);
      setSelectedAction(null);
      setACRoll('');
      setShowBonusAction(false);
      return;
    }

    // Handle regular abilities
    if (selectedAction.type === 'ability') {
      onAbilityPointsChange(-(selectedAction.cost || 0));
      
      const damage = selectedAction.id === 'card_toss' && drawnCard ? 
        getDamageWithCard(drawnCard) : 0;
      onTargetSelect(selectedTarget, parseInt(acRoll) || 0, 'ability', selectedAction.id);
      
      // Clear drawn card if Card Toss was used
      if (selectedAction.id === 'card_toss' && drawnCard) {
        setDrawnCard(null);
      }
    } else if (selectedAction.type === 'basic') {
      const targetEnemy = availableEnemies.find(e => e.id === selectedTarget);
      if (targetEnemy) {
        const distance = calculateDistance(playerPosition, targetEnemy.position);
        const effectiveAC = applyRangePenalty(targetEnemy.ac, distance);
        const damage = drawnCard ? getDamageWithCard(drawnCard) : 0;
        onTargetSelect(selectedTarget, parseInt(acRoll) || 0, 'attack', selectedAction.id);
      }
      
      // Clear drawn card after Card Toss
      if (drawnCard) {
        setDrawnCard(null);
      }
    }

    setSelectedAction(null);
    setSelectedTarget('');
    setACRoll('');
    setShowBonusAction(hasActedThisTurn && bonusActionCooldown === 0);
  };

  // Get damage description with card effects
  const getDamageWithCard = (card: DrawnCard): number => {
    // Return 0 for now, actual damage will be calculated in game logic
    return 0;
  };

  // Handle cancel action
  const handleCancelAction = () => {
    setSelectedAction(null);
    setSelectedTarget('');
    setACRoll('');
    setShowBonusAction(false);
    setShowTargetingModal(false);
    onCancelTargeting();
  };

  const abilityPoints = character.charges || 0;

  // Define Sciel's actions
  const basicAttack = {
    type: 'basic' as const,
    id: 'card_toss',
    name: 'Card Toss',
    description: drawnCard ? `${drawnCard.description}` : 'Ranged attack with mystical cards',
    damage: drawnCard ? `1d6 slashing + 1d4 radiant + ${drawnCard.name}` : '1d6 slashing + 1d4 radiant',
    icon: Circle,
    range: 'Unlimited',
  };

  const abilities = [
    {
      type: 'ability' as const,
      id: 'rewrite_destiny',
      name: 'Rewrite Destiny',
      description: 'Target enemy rolls with disadvantage on their next action',
      damage: 'Tactical debuff',
      cost: 1,
      range: 'Any enemy in sight',
    },
    {
      type: 'ability' as const,
      id: 'glimpse_future', 
      name: 'Glimpse Future',
      description: 'Target ally gains advantage on their next action',
      damage: 'Tactical buff',
      cost: 1,
      range: 'Any ally in sight',
    },
    {
      type: 'ability' as const,
      id: 'draw_fate',
      name: 'Draw Fate',
      description: 'Draw random card to enhance next Card Toss',
      damage: 'Enhances next attack',
      cost: 2,
      range: 'Self-buff',
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
                <img src={portraitUrl} alt={character.name} className="w-full h-full object-cover" />
              ) : (
                <Circle className="w-8 h-8 text-clair-gold-400" />
              )}
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-clair-gold-400">{character.name}</h1>
              <p className="font-serif text-clair-gold-200">Tarot Warrior</p>
            </div>
          </div>
          <div className="text-right">
            <button
              onClick={handleOpenInventory}
              className="bg-clair-gold-600 hover:bg-clair-gold-700 px-4 py-2 rounded-lg font-bold text-clair-shadow-900 transition-colors"
            >
              Inventory
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="p-4 space-y-6">
        {/* Character Stats */}
        <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 border border-clair-gold-600">
          <h2 className="font-display text-xl font-bold text-clair-gold-400 mb-3">Character Stats</h2>
          <div className="grid grid-cols-2 gap-4 text-white">
            <div>
              <span className="font-bold">HP:</span> {character.currentHP}/{character.maxHP}
            </div>
            <div>
              <span className="font-bold">AC:</span> {character.stats ? (10 + Math.floor((character.stats.dex - 10) / 2)) : 13}
            </div>
            <div>
              <span className="font-bold">Ability Points:</span> {abilityPoints}/5
            </div>
            <div className="flex items-center">
              <span className="font-bold mr-2">Status:</span>
              {hasActedThisTurn ? (
                <span className="text-red-400">Turn Used</span>
              ) : (
                <span className="text-green-400">Ready</span>
              )}
            </div>
          </div>

          {/* Ability Points Visual */}
          <div className="mt-3">
            <div className="flex space-x-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full border ${
                    i < abilityPoints 
                      ? 'bg-clair-gold-500 border-clair-gold-400 shadow-lg' 
                      : 'bg-clair-shadow-800 border-clair-shadow-400'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Drawn Card Display */}
        {drawnCard && (
          <div className="bg-purple-900 bg-opacity-30 border border-purple-500 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-purple-300 font-bold flex items-center">
                <Shuffle className="w-5 h-5 mr-2" />
                {drawnCard.name} Drawn!
              </h3>
            </div>
            <p className="text-purple-200 text-sm">{drawnCard.description}</p>
            <div className="text-xs text-purple-400 mt-1">
              Effect will trigger on your next Card Toss
            </div>
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
            <div className="space-y-4">
              {/* Basic Attack */}
              <div>
                <h4 className="text-sm font-bold text-green-300 mb-2">Basic Attack</h4>
                <button
                  onClick={() => handleActionSelect(basicAttack)}
                  disabled={hasActedThisTurn}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:opacity-50 p-3 rounded-lg transition-colors text-left text-white"
                >
                  <div className="flex items-center">
                    <Circle className="w-4 h-4 mr-2" />
                    <span className="font-bold">{basicAttack.name}</span>
                    {drawnCard && (
                      <span className="ml-2 text-xs bg-purple-600 px-2 py-1 rounded">
                        {drawnCard.name.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="text-sm opacity-90 mt-1">{basicAttack.description}</div>
                  <div className="text-xs text-clair-gold-200 mt-1">{basicAttack.damage}</div>
                </button>
              </div>

              {/* Abilities */}
              <div>
                <h4 className="text-sm font-bold text-blue-300 mb-2">Abilities</h4>
                <div className="grid gap-2">
                  {abilities.map((ability) => (
                    <button
                      key={ability.id}
                      onClick={() => handleActionSelect(ability)}
                      disabled={hasActedThisTurn || Boolean(ability.cost && abilityPoints < ability.cost)}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 p-3 rounded-lg transition-colors text-left text-white"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          {ability.id === 'rewrite_destiny' && <Eye className="w-4 h-4 mr-2" />}
                          {ability.id === 'glimpse_future' && <Zap className="w-4 h-4 mr-2" />}
                          {ability.id === 'draw_fate' && <Shuffle className="w-4 h-4 mr-2" />}
                          <span className="font-bold">{ability.name}</span>
                        </div>
                        <span className="text-xs bg-black bg-opacity-30 px-2 py-1 rounded">
                          {ability.cost} AP
                        </span>
                      </div>
                      <div className="text-sm opacity-90 mt-1">{ability.description}</div>
                      <div className="text-xs text-clair-gold-200 mt-1">{ability.damage}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ultimate */}
              <div>
                <h4 className="text-sm font-bold text-red-300 mb-2">Ultimate</h4>
                <button
                  onClick={handleActivateUltimate}
                  disabled={abilityPoints < 3 || isStormActive}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:opacity-50 p-3 rounded-lg transition-colors text-left text-white"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Target className="w-4 h-4 mr-2" />
                      <span className="font-bold">Crescendo of Fate</span>
                    </div>
                    <span className="text-xs bg-black bg-opacity-30 px-2 py-1 rounded">
                      3 AP
                    </span>
                  </div>
                  <div className="text-sm opacity-90 mt-1">
                    {isStormActive 
                      ? '⚡ Storm Active - Radiant fury rages!'
                      : '5-turn radiant storm (3d6 per turn)'
                    }
                  </div>
                  <div className="text-xs text-clair-gold-200 mt-1">
                    Auto-targeting storm: 3d6 radiant per turn (triggers on Sciel's turns only)
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

              {/* Show action-specific UI */}
              {(selectedAction.id === 'rewrite_destiny' || selectedAction.id === 'glimpse_future') && (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-900 bg-opacity-30 rounded-lg">
                    <p className="text-blue-200 text-sm">
                      {selectedAction.id === 'rewrite_destiny' 
                        ? 'Select an enemy to curse with disadvantage on their next action.'
                        : 'Select an ally to bless with advantage on their next action.'
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => setShowTargetingModal(true)}
                    className="w-full bg-green-600 hover:bg-green-700 p-2 rounded text-white font-bold"
                  >
                    {selectedAction.id === 'rewrite_destiny' ? 'Select Enemy' : 'Select Ally'}
                  </button>
                </div>
              )}

              {(selectedAction.id === 'card_toss') && (
                <div className="space-y-3">
                  <div className="p-3 bg-green-900 bg-opacity-30 rounded-lg">
                    <p className="text-green-200 text-sm">
                      {drawnCard ? 
                        `Enhanced Card Toss: ${drawnCard.description}` :
                        'Select an enemy to hit with your mystical cards.'
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => setShowTargetingModal(true)}
                    className="w-full bg-green-600 hover:bg-green-700 p-2 rounded text-white font-bold"
                  >
                    Select Target Enemy
                  </button>
                </div>
              )}

              {selectedTarget && (
                <div className="space-y-3">
                  <div className="p-3 bg-gray-800 rounded-lg">
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      Attack Roll vs AC (d20 + modifiers):
                    </label>
                    <input
                      type="text"
                      value={acRoll}
                      onChange={(e) => setACRoll(e.target.value)}
                      placeholder="e.g., 15"
                      className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600"
                    />
                  </div>
                  <button
                    onClick={handleConfirmAction}
                    className="w-full bg-red-600 hover:bg-red-700 p-3 rounded text-white font-bold"
                  >
                    Confirm Action
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Combat Tips */}
        <div className="bg-green-900 bg-opacity-20 rounded-lg border border-green-600">
          <h4 className="font-serif font-bold text-green-400 text-sm mb-2 p-4 pb-0">Combat Tips:</h4>
          <ul className="text-xs text-green-300 space-y-1 p-4 pt-2">
            <li>• Card Toss has unlimited range with mystical accuracy</li>
            <li>• Rewrite Destiny gives enemy disadvantage on next roll</li>
            <li>• Glimpse Future gives ally advantage on next roll</li> 
            <li>• Draw Fate randomly enhances next Card Toss (risky but powerful!)</li>
            <li>• Guiding Cards is a bonus action (3-round cooldown)</li>
            <li>• <strong>Crescendo of Fate: 5-turn storm (3d6 radiant on Sciel's turns only)!</strong></li>
          </ul>
        </div>

        {/* Turn Management */}
        {isMyTurn && combatActive && (
          <div className="bg-clair-mystical-600 rounded-lg shadow-shadow p-4 border border-clair-mystical-400">
            <h3 className="font-display text-lg font-bold text-white mb-3">Your Turn</h3>
            <div className="flex space-x-2">
              <button
                onClick={onEndTurn}
                disabled={!hasActedThisTurn}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                End Turn
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Enemy Targeting Modal */}
      <EnemyTargetingModal
        isOpen={showTargetingModal}
        onClose={() => setShowTargetingModal(false)}
        enemies={availableEnemies}
        playerPosition={playerPosition}
        sessionId={sessionId}
        playerId={character.id}
        onSelectEnemy={(enemy: Enemy) => {
          setSelectedTarget(enemy.id);
        }}
        selectedEnemyId={selectedTarget}
        abilityName={selectedAction?.name}
        abilityRange={999} // Sciel has unlimited range
      />

      <InventoryModal
        isOpen={showInventoryModal}
        characterName={character.name}
        inventory={[]}
        goldAmount={0}
        isLoading={false}
        onClose={() => setShowInventoryModal(false)}
      />
    </div>
  );
}