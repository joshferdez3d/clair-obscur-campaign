import React from 'react';
import { User, AlertCircle, Sword, Zap, Target, Eye, Shield, Move, Sparkles } from 'lucide-react';
import { HPTracker } from './HPTracker';
import { StatDisplay } from './StatDisplay';
import type { Character, Stance, Ability } from '../../types';

interface CharacterSheetProps {
  character: Character;
  onHPChange: (delta: number) => void;
  onStanceChange: (stance: Stance | 'stanceless') => void;
  onAbilityPointsChange: (delta: number) => void;
  onAbilityUse: (ability: Ability) => void;
  isLoading?: boolean;
  isMyTurn?: boolean;
  // Combat props
  combatActive?: boolean;
  targetingMode?: {
    active: boolean;
    abilityId?: string;
    range?: number;
    validTargets?: string[];
  };
  availableEnemies?: Array<{
    id: string;
    name: string;
    position: { x: number; y: number };
    hp: number;
    maxHp: number;
    ac: number;
  }>;
  playerPosition?: { x: number; y: number };
  onTargetSelect?: (targetId: string, acRoll: number) => void;
  onEndTurn?: () => void;
  onCancelTargeting?: () => void;
  hasActedThisTurn?: boolean;
  canSwitchStance?: boolean;
  hasChangedStance?: boolean;
}

export function CharacterSheet({
  character,
  onHPChange,
  onStanceChange,
  onAbilityPointsChange,
  onAbilityUse,
  isLoading = false,
  isMyTurn = false,
  combatActive = false,
  targetingMode,
  availableEnemies = [],
  playerPosition = { x: 0, y: 0 },
  onTargetSelect,
  onEndTurn,
  onCancelTargeting,
  hasActedThisTurn = false,
  canSwitchStance = false,
  hasChangedStance = false
}: CharacterSheetProps) {
  const [selectedTarget, setSelectedTarget] = React.useState<string>('');
  const [acRoll, setACRoll] = React.useState<string>('');
  const [selectedAbility, setSelectedAbility] = React.useState<Ability | null>(null);

  const getCharacterPortrait = (name: string) => {
    const portraitMap: { [key: string]: string } = {
      'gustave': '/tokens/characters/gustave.jpg',
      'lune': '/tokens/characters/lune.jpg',
      'maelle': '/tokens/characters/maelle.jpg',
      'sciel': '/tokens/characters/sciel.jpg'
    };
    return portraitMap[name.toLowerCase()] || null;
  };

  const getCharacterTheme = () => {
    switch (character.name.toLowerCase()) {
      case 'maelle':
        return {
          gradient: 'bg-gradient-to-br from-clair-mystical-500 to-clair-mystical-700',
          accent: 'clair-mystical-500',
          ring: 'ring-clair-mystical-400'
        };
      case 'gustave':
        return {
          gradient: 'bg-gradient-to-br from-red-700 to-red-900',
          accent: 'red-700',
          ring: 'ring-red-400'
        };
      case 'lune':
        return {
          gradient: 'bg-gradient-to-br from-clair-mystical-700 to-clair-mystical-900',
          accent: 'clair-mystical-700',
          ring: 'ring-clair-mystical-400'
        };
      case 'sciel':
        return {
          gradient: 'bg-gradient-to-br from-green-700 to-green-900',
          accent: 'green-700',
          ring: 'ring-green-400'
        };
      default:
        return {
          gradient: 'bg-clair-gradient',
          accent: 'clair-gold-500',
          ring: 'ring-clair-gold-400'
        };
    }
  };

  // Calculate distance between two positions (D&D grid rules)
  const calculateDistance = (pos1: { x: number; y: number }, pos2: { x: number; y: number }): number => {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    return Math.max(dx, dy) * 5; // Convert to feet
  };

  // Get ability range
  const getAbilityRange = (ability: Ability): number => {
    switch (ability.id) {
      case 'fencers_slash':
      case 'flourish_chain':
      case 'sword_slash':
      case 'prosthetic_strike':
      case 'basic_attack':
      case 'stroke_of_light':
        return 5; // Melee range
      case 'elemental_bolt':
      case 'card_toss':
        return 120; // Ranged attacks
      default:
        return 30; // Default range
    }
  };

  // Get ability cost
  const getAbilityCost = (ability: Ability): number => {
    switch (ability.id) {
      case 'fencers_slash':
        return 1;
      case 'flourish_chain':
        return 2;
      case 'stroke_of_light':
        return 5;
      default:
        return 1;
    }
  };

  // Get valid targets for current ability
  const getValidTargets = (abilityRange: number) => {
    return availableEnemies.filter(enemy => {
      const distance = calculateDistance(playerPosition, enemy.position);
      return distance <= abilityRange;
    });
  };

  const handleAbilitySelect = (ability: Ability) => {
    // Prevent action if player has already acted this turn
    if (hasActedThisTurn) {
      return;
    }

    const cost = getAbilityCost(ability);
    const currentPoints = character.charges || 0;
    
    if (cost > currentPoints) {
      alert(`Not enough ability points! Need ${cost}, have ${currentPoints}`);
      return;
    }
    
    setSelectedAbility(ability);
    setSelectedTarget('');
    setACRoll('');
  };

  const handleBasicAttack = () => {
    // Prevent action if player has already acted this turn
    if (hasActedThisTurn) {
      return;
    }

    const basicAttack: Ability = {
      id: 'basic_attack',
      name: 'Basic Attack',
      description: 'Melee weapon attack',
      type: 'action',
      damage: '1d8 + DEX'
    };
    setSelectedAbility(basicAttack);
    setSelectedTarget('');
    setACRoll('');
  };

  const handleConfirmAttack = () => {
    if (selectedTarget && acRoll && selectedAbility && onTargetSelect) {
      // Call the parent handler which will set hasActedThisTurn to true
      onTargetSelect(selectedTarget, parseInt(acRoll));
      
      // If it's a basic attack, add ability point on hit
      if (selectedAbility.id === 'basic_attack') {
        const enemy = availableEnemies.find(e => e.id === selectedTarget);
        const hit = parseInt(acRoll) >= (enemy?.ac || 10);
        if (hit && onAbilityPointsChange) {
          onAbilityPointsChange(1);
        }
      } else {
        // Consume ability points for special abilities
        const cost = getAbilityCost(selectedAbility);
        if (onAbilityPointsChange) {
          onAbilityPointsChange(-cost);
        }
      }
      
      // Reset selection - this will return to the main combat panel
      // where the user will see actions disabled and End Turn enabled
      setSelectedAbility(null);
      setSelectedTarget('');
      setACRoll('');
    }
  };

  const handleCancelAction = () => {
    setSelectedAbility(null);
    setSelectedTarget('');
    setACRoll('');
    if (onCancelTargeting) {
      onCancelTargeting();
    }
  };

  const theme = getCharacterTheme();
  const hasStances = character.name.toLowerCase() === 'maelle';
  const abilityPoints = character.charges || 0;
  const portraitUrl = getCharacterPortrait(character.name);

  // Stance configuration with stanceless option
  const stanceConfig = {
    stanceless: { 
      name: 'Stanceless', 
      icon: Target, 
      description: 'No stance bonuses active',
      color: 'bg-gray-600 hover:bg-gray-700'
    },
    offensive: { 
      name: 'Offensive', 
      icon: Sword, 
      description: '+2 damage on next attack',
      color: 'bg-red-600 hover:bg-red-700'
    },
    defensive: { 
      name: 'Defensive', 
      icon: Shield, 
      description: '+2 AC until next turn',
      color: 'bg-blue-600 hover:bg-blue-700'
    },
    agile: { 
      name: 'Agile', 
      icon: Move, 
      description: '+10 ft movement',
      color: 'bg-green-600 hover:bg-green-700'
    }
  };

  // Maelle's abilities with costs
  const maelleAbilities = [
    {
      id: 'fencers_slash',
      name: "Fencer's Slash",
      description: "Precise rapier strike. Changes stance after attack.",
      type: 'action' as const,
      damage: '1d8 + DEX slashing',
      cost: 1
    },
    {
      id: 'flourish_chain',
      name: 'Flourish Chain',
      description: 'Two rapid strikes. If both hit, +1d6 radiant damage.',
      type: 'action' as const,
      damage: '2 attacks, +1d6 radiant if both hit',
      cost: 2
    },
    ...(abilityPoints >= 5 ? [{
      id: 'stroke_of_light',
      name: 'Stroke of Light',
      description: 'Ultimate strike that erupts in brilliant light.',
      type: 'action' as const,
      damage: 'Normal attack + 2d6 radiant',
      cost: 5
    }] : [])
  ];

  return (
    <div className="min-h-screen bg-clair-shadow-900">
      {/* 1. CHARACTER NAME HEADER - Always at top */}
      <div 
        className={`relative px-4 pt-6 pb-4 text-white ${theme.gradient} shadow-shadow border-b border-clair-gold-600`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center border-2 border-clair-gold-400 overflow-hidden">
              {portraitUrl ? (
                <img 
                  src={portraitUrl} 
                  alt={character.name}
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              ) : (
                <User className="w-6 h-6 text-clair-gold-200" />
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
        {/* Loading State */}
        {isLoading && (
          <div className="bg-clair-mystical-500 bg-opacity-20 border border-clair-mystical-400 rounded-lg p-3 mb-4 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-clair-mystical-400 mr-3"></div>
            <span className="font-sans text-clair-mystical-300">Updating...</span>
          </div>
        )}

        {/* Action Status Display */}
        {isMyTurn && combatActive && hasActedThisTurn && (
          <div className="bg-clair-success bg-opacity-20 border border-clair-success rounded-lg p-3 mb-4 flex items-center">
            <div className="w-4 h-4 bg-clair-success rounded-full mr-3"></div>
            <span className="font-sans text-clair-success">Action completed this turn - Click "End Turn" when ready</span>
          </div>
        )}

        {/* 2. HP TRACKER - Second priority */}
        <HPTracker
          currentHP={character.currentHP}
          maxHP={character.maxHP}
          onHPChange={onHPChange}
          isLoading={isLoading}
          showControls={false}
        />

        {/* 3. ABILITY SCORES - Third priority */}
        <StatDisplay stats={character.stats} />

        {/* 4. COMBAT SECTION - Bottom section */}
        <div className="space-y-4 mb-6">
          
          {/* Stance Selector (Maelle only) */}
          {hasStances && (
            <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 border border-clair-mystical-500">
              <h3 className="font-display text-lg font-bold text-clair-mystical-300 mb-3">
                Combat Stance
                {hasActedThisTurn && !canSwitchStance && (
                  <span className="text-xs text-gray-400 ml-2">(Attack must hit to change)</span>
                )}
                {canSwitchStance && hasChangedStance && (
                  <span className="text-xs text-green-400 ml-2">(Already changed this turn)</span>
                )}
                {canSwitchStance && !hasChangedStance && (
                  <span className="text-xs text-yellow-400 ml-2">(Can change after hit!)</span>
                )}
              </h3>
              <div className="space-y-2">
                {Object.entries(stanceConfig).map(([stance, config]) => {
                  const Icon = config.icon;
                  const isActive = (character.stance || 'stanceless') === stance;
                  const isDisabled = isLoading || (!canSwitchStance || hasChangedStance);
                  
                  return (
                    <button
                      key={stance}
                      onClick={() => onStanceChange(stance as Stance | 'stanceless')}
                      disabled={isDisabled}
                      className={`w-full flex items-center p-3 rounded-lg transition-all border-2 ${
                        isActive 
                          ? `${config.color} ring-2 ring-clair-gold-400 border-clair-gold-400` 
                          : isDisabled
                          ? 'bg-gray-700 border-gray-600 opacity-50 cursor-not-allowed'
                          : `${config.color} border-clair-shadow-400 hover:border-clair-gold-600`
                      }`}
                    >
                      <Icon className="w-5 h-5 mr-3" />
                      <div className="flex-1 text-left">
                        <div className={`font-bold ${isDisabled ? 'text-gray-400' : 'text-white'}`}>
                          {config.name}
                        </div>
                        <div className={`text-sm opacity-90 ${isDisabled ? 'text-gray-500' : 'text-gray-200'}`}>
                          {config.description}
                        </div>
                      </div>
                      {isActive && <div className="w-2 h-2 bg-clair-gold-400 rounded-full" />}
                    </button>
                  );
                })}
              </div>
              
              {/* Stance switching explanation */}
              <div className="mt-3 p-2 bg-clair-mystical-900 bg-opacity-30 rounded text-xs text-clair-mystical-200">
                <p>Stance can only be changed once per turn after a successful hit.</p>
              </div>
            </div>
          )}

          {/* Ability Points Tracker */}
          <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 border border-clair-gold-600">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <Sparkles className="w-6 h-6 text-clair-gold-500 mr-2" />
                <h3 className="font-display text-lg font-bold text-clair-gold-400">Ability Points</h3>
              </div>
              <div className="font-serif text-2xl font-bold text-clair-gold-50">
                {abilityPoints} / 5
              </div>
            </div>
            
            {/* Ability Points Indicators */}
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
            
            <p className="text-xs text-clair-gold-300 text-center">
              Gain points by hitting with Basic Attack • Use points for abilities
            </p>
          </div>

          {/* Combat Actions Panel */}
          <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 border border-clair-gold-600">
            <h3 className="font-display text-lg font-bold text-clair-gold-400 mb-3">Combat Actions</h3>
            
            {!selectedAbility ? (
              <div className="space-y-3">
                {/* Basic Attack */}
                <button
                  onClick={handleBasicAttack}
                  disabled={!isMyTurn || !combatActive || hasActedThisTurn}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:opacity-50 p-3 rounded-lg font-bold flex items-center justify-center transition-colors text-white"
                >
                  <Sword className="w-5 h-5 mr-2" />
                  Basic Attack (5ft) - Gain 1 Point
                  {hasActedThisTurn && <span className="ml-2 text-xs">(Already acted)</span>}
                </button>

                {/* Abilities */}
                <div className="space-y-2">
                  {maelleAbilities.map(ability => (
                    <button
                      key={ability.id}
                      onClick={() => handleAbilitySelect(ability)}
                      disabled={!isMyTurn || !combatActive || abilityPoints < ability.cost || hasActedThisTurn}
                      className="w-full bg-clair-mystical-500 hover:bg-clair-mystical-600 disabled:bg-gray-600 disabled:opacity-50 p-3 rounded-lg transition-colors text-left text-white"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <Zap className="w-4 h-4 mr-2" />
                            <span className="font-bold">{ability.name}</span>
                            <span className="ml-2 text-xs bg-black bg-opacity-30 px-2 py-1 rounded">
                              {ability.cost} pts
                            </span>
                          </div>
                          <div className="text-sm opacity-90 mt-1">{ability.description}</div>
                          <div className="text-xs text-clair-gold-200 mt-1">{ability.damage}</div>
                          {hasActedThisTurn && (
                            <div className="text-xs text-gray-400 mt-1">(Already acted this turn)</div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Target Selection */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-clair-mystical-200">
                    <Target className="w-4 h-4 inline mr-2" />
                    {selectedAbility.name} - Select Target
                  </h4>
                  <button
                    onClick={handleCancelAction}
                    className="text-sm bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-white"
                  >
                    Cancel
                  </button>
                </div>

                {/* Enemy Selection */}
                <div className="space-y-2">
                  {getValidTargets(getAbilityRange(selectedAbility)).map(enemy => (
                    <button
                      key={enemy.id}
                      onClick={() => setSelectedTarget(enemy.id)}
                      className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                        selectedTarget === enemy.id
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
                        min="1"
                        max="30"
                      />
                    </div>
                    <button
                      onClick={handleConfirmAttack}
                      disabled={!acRoll}
                      className="w-full bg-clair-gold-600 hover:bg-clair-gold-700 disabled:bg-clair-shadow-600 text-clair-shadow-900 p-3 rounded-lg font-bold transition-colors"
                    >
                      Confirm Attack
                    </button>
                  </div>
                )}

                {getValidTargets(getAbilityRange(selectedAbility)).length === 0 && (
                  <div className="text-center text-clair-gold-400 py-4">
                    No enemies in range ({getAbilityRange(selectedAbility)}ft)
                  </div>
                )}
              </div>
            )}

            {/* End Turn - Now available after action */}
            {isMyTurn && combatActive && !selectedAbility && (
              <button
                onClick={onEndTurn}
                disabled={!hasActedThisTurn} // Only enable after action is taken
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

            {/* Combat Tips */}
            <div className="mt-4 p-3 bg-clair-gold-900 bg-opacity-20 rounded-lg border border-clair-gold-600">
              <h4 className="font-serif font-bold text-clair-gold-400 text-sm mb-2">Combat Tips:</h4>
              <ul className="text-xs text-clair-gold-300 space-y-1">
                <li>• Start with Basic Attacks to build Ability Points</li>
                <li>• Change stance to gain tactical bonuses</li>
                <li>• Save 5 points to unlock Stroke of Light ultimate</li>
                <li>• One action per turn - End turn after attacking</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}