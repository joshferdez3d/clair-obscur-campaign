// src/components/CharacterSheet/LuneCharacterSheet.tsx
import React, { useState } from 'react';
import { User, Sparkles, Target, Eye, Zap, Circle } from 'lucide-react';
import { FirestoreService } from '../../services/firestoreService';
import { HPTracker } from './HPTracker';
import { StatDisplay } from './StatDisplay';
import type { Character, Position, BattleToken } from '../../types';
import { useUltimateVideo } from '../../hooks/useUltimateVideo';

interface LuneCharacterSheetProps {
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
  playerPosition?: { x: number; y: number };
  onTargetSelect?: (targetId: string, acRoll: number, attackType: string, abilityId?: string) => void;
  onEndTurn?: () => void;
  onCancelTargeting?: () => void;
  hasActedThisTurn?: boolean;
  elementalStains?: Array<'fire' | 'ice' | 'nature' | 'light'>;
  onStainsChange?: (stains: Array<'fire' | 'ice' | 'nature' | 'light'>) => void;

  // For abilities that need AoE or special targeting
  sessionId?: string;
  allTokens?: BattleToken[];
}

type ElementType = 'fire' | 'ice' | 'nature' | 'light';

const ELEMENT_MAP: Record<number, ElementType> = {
  1: 'fire',
  2: 'ice', 
  3: 'nature',
  4: 'light'
};

const ELEMENT_COLORS = {
  fire: 'bg-red-500',
  ice: 'bg-blue-500',
  nature: 'bg-green-500',
  light: 'bg-white border-2 border-gray-300'
};

const ELEMENT_TEXT_COLORS = {
  fire: 'text-red-500',
  ice: 'text-blue-500',
  nature: 'text-green-500',
  light: 'text-gray-800'
};

const ELEMENT_NAMES = {
  fire: 'Fire',
  ice: 'Ice',
  nature: 'Nature',
  light: 'Light'
};

const STATUS_EFFECTS = {
  fire: 'Burn: +2 damage/turn for 3 rounds',
  ice: 'Freeze: Can\'t move for 1 round',
  nature: 'Push: 15ft pushback',
  light: 'Blind: Miss next attack'
};

export function LuneCharacterSheet({
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
  onCancelTargeting,
  hasActedThisTurn = false,
  elementalStains = [],
  onStainsChange,
  sessionId = 'test-session',
  allTokens = [],
}: LuneCharacterSheetProps) {
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [acRoll, setACRoll] = useState<string>('');
  const [elementRoll, setElementRoll] = useState<string>('');
  const { triggerUltimate } = useUltimateVideo(sessionId);

  const [selectedAction, setSelectedAction] = useState<{
    type: 'basic' | 'ability';
    id: string;
    name: string;
    description: string;
    damage?: string;
    cost?: number;
    needsElement?: boolean;
    multiTarget?: boolean;
  } | null>(null);

  // Calculate distance for range validation
  const calculateDistance = (pos1: { x: number; y: number }, pos2: { x: number; y: number }): number => {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    return Math.max(dx, dy) * 5;
  };

  // Get valid targets (Lune's abilities are all ranged)
  const getValidTargets = () => {
    return availableEnemies; // All enemies are valid for Lune's ranged attacks
  };

  // Add stain to collection
  const addStain = (element: ElementType) => {
    if (elementalStains.length >= 5) return; // Max 5 stains
    const newStains = [...elementalStains, element];
    onStainsChange?.(newStains);
  };

  // Remove oldest stains
  const consumeStains = (count: number) => {
    if (elementalStains.length < count) return [];
    const consumed = elementalStains.slice(0, count);
    const remaining = elementalStains.slice(count);
    onStainsChange?.(remaining);
    return consumed;
  };

  // Handle action selection
  const handleActionSelect = (action: any) => {
    if (hasActedThisTurn) return;

    // Check if we have enough stains for abilities
    if (action.type === 'ability' && action.cost) {
      if (elementalStains.length < action.cost) {
        alert(`Not enough stains! Need ${action.cost}, have ${elementalStains.length}`);
        return;
      }
    }

    setSelectedAction(action);
    setSelectedTarget('');
    setSelectedTargets([]);
    setACRoll('');
    setElementRoll('');
  };

  // Handle target selection for multi-target abilities
  const handleTargetToggle = (targetId: string) => {
    if (selectedAction?.multiTarget) {
      if (selectedTargets.includes(targetId)) {
        setSelectedTargets(selectedTargets.filter(id => id !== targetId));
      } else {
        if (selectedAction.id === 'twin_catalyst' && selectedTargets.length >= 2) {
          alert('Twin Catalyst can only target up to 2 enemies');
          return;
        }
        setSelectedTargets([...selectedTargets, targetId]);
      }
    } else {
      setSelectedTarget(targetId);
    }
  };

  // Confirm action execution
  const handleConfirmAction = async () => {
    if (!selectedAction) return;

    // For Elemental Bolt (basic attack)
    if (selectedAction.id === 'elemental_bolt') {
      if (!selectedTarget || !acRoll || !elementRoll) {
        alert('Please select target, enter AC roll, and element roll (1-4)');
        return;
      }

      const elementNum = parseInt(elementRoll);
      if (elementNum < 1 || elementNum > 4) {
        alert('Element roll must be between 1-4');
        return;
      }

      const element = ELEMENT_MAP[elementNum];
      
      // Add stain for the element used
      addStain(element);

      // Trigger the attack
      if (onTargetSelect) {
        onTargetSelect(selectedTarget, parseInt(acRoll), 'ranged', 'elemental_bolt');
      }

      setSelectedAction(null);
      setSelectedTarget('');
      setACRoll('');
      setElementRoll('');
      return;
    }

    // For single-target abilities
    if (!selectedAction.multiTarget) {
      if (!selectedTarget || !acRoll) {
        alert('Please select target and enter AC roll');
        return;
      }

      // Consume stains
      const consumed = consumeStains(selectedAction.cost || 0);
      console.log(`Consumed ${consumed.length} stains:`, consumed);

      if (onTargetSelect) {
        onTargetSelect(selectedTarget, parseInt(acRoll), 'ability', selectedAction.id);
      }

      setSelectedAction(null);
      setSelectedTarget('');
      setACRoll('');
      return;
    }

    // For multi-target abilities (Twin Catalyst)
    if (selectedAction.multiTarget) {
      if (selectedTargets.length === 0 || !acRoll) {
        alert('Please select at least one target and enter AC roll');
        return;
      }

      // Consume stains
      const consumed = consumeStains(selectedAction.cost || 0);
      console.log(`Twin Catalyst consumed ${consumed.length} stains:`, consumed);

      // For Twin Catalyst, we need to create multiple actions or handle specially
      // For now, we'll use the first target as primary and note in GM popup
      if (onTargetSelect) {
        // Create attack for each target with same AC roll
        for (const targetId of selectedTargets) {
          onTargetSelect(targetId, parseInt(acRoll), 'ability', selectedAction.id);
        }
      }

      setSelectedAction(null);
      setSelectedTargets([]);
      setACRoll('');
      return;
    }
  };

  const handleCancelAction = () => {
    setSelectedAction(null);
    setSelectedTarget('');
    setSelectedTargets([]);
    setACRoll('');
    setElementRoll('');
    onCancelTargeting?.();
  };

  // Define Lune's actions
  const basicAttack = {
    type: 'basic' as const,
    id: 'elemental_bolt',
    name: 'Elemental Bolt',
    description: 'Ranged spell attack with random element',
    damage: '1d10 elemental',
    needsElement: true,
    icon: Circle,
    range: 'Unlimited',
  };

  const abilities = [
    {
      type: 'ability' as const,
      id: 'elemental_strike',
      name: 'Elemental Strike',
      description: 'Consume 1 stain for enhanced damage + status effect',
      damage: '1d10 + status effect',
      cost: 1,
      range: 'Unlimited',
    },
    {
      type: 'ability' as const,
      id: 'twin_catalyst',
      name: 'Twin Catalyst',
      description: 'Fire two elemental bolts using oldest 2 stains',
      damage: '2 × 1d10 elemental',
      cost: 2,
      multiTarget: true,
      range: 'Unlimited',
    },
    {
      type: 'ability' as const,
      id: 'genesis_spark',
      name: 'Genesis Spark',
      description: 'Ultimate focused elemental blast',
      damage: '5d10 elemental',
      cost: 3,
      range: 'Unlimited',
    },
  ];

  return (
    <div className="min-h-screen bg-clair-shadow-900">
      {/* CHARACTER HEADER */}
      <div className="relative px-4 pt-6 pb-4 text-white bg-gradient-to-br from-clair-mystical-700 to-clair-mystical-900 shadow-shadow border-b border-clair-gold-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center border-2 border-clair-gold-400">
              <User className="w-6 h-6 text-clair-gold-200" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold text-clair-gold-50">{character.name}</h1>
              <p className="font-serif italic text-clair-gold-200 text-sm">{character.role}</p>
            </div>
          </div>

          {isMyTurn && combatActive && (
            <div className="bg-clair-gold-500 text-clair-shadow-900 px-3 py-2 rounded-full font-sans text-sm font-bold animate-pulse shadow-clair">
              Your Turn
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-4">
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
        <HPTracker currentHP={character.currentHP} maxHP={character.maxHP} onHPChange={onHPChange} isLoading={isLoading} showControls={false} />

        {/* ABILITY SCORES */}
        <StatDisplay stats={character.stats} />

        {/* Elemental Stains */}
        <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 mb-4 border border-clair-mystical-600">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Sparkles className="w-6 h-6 text-clair-mystical-400 mr-2" />
              <h3 className="font-display text-lg font-bold text-clair-mystical-300">Elemental Stains</h3>
            </div>
            <div className="font-serif text-2xl font-bold text-clair-mystical-200">{elementalStains.length} / 5</div>
          </div>
          
          {/* Stains Display */}
          <div className="flex justify-center space-x-2 mb-4">
            {Array.from({ length: 5 }).map((_, index) => {
              const stain = elementalStains[index];
              return (
                <div
                  key={index}
                  className={`w-8 h-8 rounded-full border-2 transition-all duration-300 flex items-center justify-center ${
                    stain 
                      ? `${ELEMENT_COLORS[stain]} border-clair-gold-400 shadow-lg` 
                      : 'bg-clair-shadow-800 border-clair-shadow-400'
                  }`}
                >
                  {stain && (
                    <span className={`text-xs font-bold ${stain === 'light' ? 'text-gray-800' : 'text-white'}`}>
                      {ELEMENT_NAMES[stain][0]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Current Stains List */}
          {elementalStains.length > 0 && (
            <div className="text-center text-sm text-clair-mystical-300">
              Current: {elementalStains.map((stain, i) => (
                <span key={i} className={`${ELEMENT_TEXT_COLORS[stain]} font-bold`}>
                  {ELEMENT_NAMES[stain]}{i < elementalStains.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Combat Actions */}
        <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 border border-clair-gold-600 mb-6">
          <h3 className="font-display text-lg font-bold text-clair-gold-400 mb-3">Combat Actions</h3>

          {!selectedAction ? (
            <div className="space-y-3">
              {/* Basic Attack */}
              <div>
                <h4 className="text-sm font-bold text-clair-mystical-300 mb-2">Basic Attack</h4>
                <button
                  onClick={() => handleActionSelect(basicAttack)}
                  disabled={!isMyTurn || !combatActive || hasActedThisTurn}
                  className="w-full bg-clair-mystical-600 hover:bg-clair-mystical-700 disabled:bg-gray-600 disabled:opacity-50 p-3 rounded-lg transition-colors text-left text-white"
                >
                  <div className="flex items-center">
                    <Circle className="w-4 h-4 mr-2" />
                    <span className="font-bold">{basicAttack.name}</span>
                    <span className="ml-2 text-xs bg-black bg-opacity-30 px-2 py-1 rounded">
                      +1 Stain
                    </span>
                  </div>
                  <div className="text-sm opacity-90 mt-1">{basicAttack.description}</div>
                  <div className="text-xs text-clair-gold-200 mt-1">{basicAttack.damage}</div>
                </button>
              </div>

              {/* Abilities */}
              <div>
                <h4 className="text-sm font-bold text-clair-mystical-300 mb-2">Abilities</h4>
                <div className="space-y-2">
                  {abilities.map((ability) => (
                    <button
                      key={ability.id}
                      onClick={() => handleActionSelect(ability)}
                      disabled={!isMyTurn || !combatActive || elementalStains.length < ability.cost || hasActedThisTurn}
                      className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:opacity-50 p-3 rounded-lg transition-colors text-left text-white"
                    >
                      <div className="flex items-center">
                        <Zap className="w-4 h-4 mr-2" />
                        <span className="font-bold">{ability.name}</span>
                        <span className="ml-2 text-xs bg-black bg-opacity-30 px-2 py-1 rounded">
                          {ability.cost} stain{ability.cost > 1 ? 's' : ''}
                        </span>
                        {ability.id === 'genesis_spark' && (
                          <span className="ml-2 text-xs bg-yellow-600 px-2 py-1 rounded">ULTIMATE</span>
                        )}
                      </div>
                      <div className="text-sm opacity-90 mt-1">{ability.description}</div>
                      <div className="text-xs text-clair-gold-200 mt-1">{ability.damage}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Target Selection */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-clair-mystical-200">
                  <Target className="w-4 h-4 inline mr-2" />
                  {selectedAction.name} - Select Target{selectedAction.multiTarget ? 's' : ''}
                </h4>
                <button onClick={handleCancelAction} className="text-sm bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-white">
                  Cancel
                </button>
              </div>

              {/* Element Roll Input (for Elemental Bolt) */}
              {selectedAction.needsElement && (
                <div className="space-y-2">
                  <label className="block text-sm font-bold mb-2 text-clair-mystical-300">
                    Roll 1d4 for element (1=Fire, 2=Ice, 3=Nature, 4=Light):
                  </label>
                  <input
                    type="number"
                    value={elementRoll}
                    onChange={(e) => setElementRoll(e.target.value)}
                    placeholder="Enter 1d4 result"
                    className="w-full p-3 bg-clair-shadow-800 border border-clair-shadow-400 rounded-lg text-clair-gold-200"
                    min={1}
                    max={4}
                  />
                  {elementRoll && ELEMENT_MAP[parseInt(elementRoll)] && (
                    <div className={`text-sm font-bold ${ELEMENT_TEXT_COLORS[ELEMENT_MAP[parseInt(elementRoll)]]}`}>
                      Element: {ELEMENT_NAMES[ELEMENT_MAP[parseInt(elementRoll)]]}
                    </div>
                  )}
                </div>
              )}

              {/* Enemy Selection */}
              <div className="space-y-2">
                {getValidTargets().map(enemy => (
                  <button
                    key={enemy.id}
                    onClick={() => handleTargetToggle(enemy.id)}
                    className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                      (selectedAction.multiTarget ? selectedTargets.includes(enemy.id) : selectedTarget === enemy.id)
                        ? 'border-clair-gold-400 bg-clair-gold-900 bg-opacity-30'
                        : 'border-clair-shadow-400 bg-clair-shadow-700 hover:border-clair-gold-600'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-bold text-clair-gold-200">{enemy.name}</div>
                        <div className="text-sm text-clair-gold-300">
                          Distance: {calculateDistance(playerPosition, enemy.position)}ft
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-clair-gold-400">AC: {enemy.ac}</div>
                        <div className="text-sm text-red-400">{enemy.hp}/{enemy.maxHp} HP</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* AC Roll Input */}
              {(selectedTarget || selectedTargets.length > 0) && (
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
                    disabled={!acRoll || (!selectedTarget && selectedTargets.length === 0) || (selectedAction.needsElement && !elementRoll)}
                    className="w-full bg-clair-gold-600 hover:bg-clair-gold-700 disabled:bg-clair-shadow-600 text-clair-shadow-900 p-3 rounded-lg font-bold transition-colors"
                  >
                    Confirm {selectedAction.name}
                  </button>
                </div>
              )}

              {/* Show status effects info for Elemental Strike */}
              {selectedAction.id === 'elemental_strike' && elementalStains.length > 0 && (
                <div className="mt-4 p-3 bg-clair-mystical-900 bg-opacity-30 rounded-lg border border-clair-mystical-500">
                  <h4 className="font-serif font-bold text-clair-mystical-300 text-sm mb-2">Next Stain Effects:</h4>
                  <div className="text-xs text-clair-mystical-200">
                    <span className={`font-bold ${ELEMENT_TEXT_COLORS[elementalStains[0]]}`}>
                      {ELEMENT_NAMES[elementalStains[0]]}
                    </span>
                    : {STATUS_EFFECTS[elementalStains[0]]}
                  </div>
                </div>
              )}

              {getValidTargets().length === 0 && (
                <div className="text-center text-clair-gold-400 py-4">No enemies available</div>
              )}
            </div>
          )}

          {/* End Turn */}
          {isMyTurn && combatActive && !selectedAction && (
            <button
              onClick={onEndTurn}
              disabled={!hasActedThisTurn}
              className={`w-full mt-4 p-3 rounded-lg font-bold transition-colors ${
                hasActedThisTurn
                  ? 'bg-clair-gold-600 hover:bg-clair-gold-700 text-clair-shadow-900'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Eye className="w-5 h-5 inline mr-2" />
              {hasActedThisTurn ? 'End Turn' : 'Take an action first'}
            </button>
          )}

          {/* Tips */}
          <div className="mt-4 p-3 bg-clair-mystical-900 bg-opacity-20 rounded-lg border border-clair-mystical-600">
            <h4 className="font-serif font-bold text-clair-mystical-400 text-sm mb-2">Combat Tips:</h4>
            <ul className="text-xs text-clair-mystical-300 space-y-1">
              <li>• Elemental Bolt generates stains based on 1d4 roll</li>
              <li>• Abilities consume oldest stains first</li>
              <li>• Fire burns, Ice freezes, Nature pushes, Light blinds</li>
              <li>• Twin Catalyst can target same enemy twice</li>
              <li>• Ranged attacks get -2 AC penalty per 5ft beyond 30ft</li>
              <li>• Genesis Spark is your ultimate - save 3 stains for big damage</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}