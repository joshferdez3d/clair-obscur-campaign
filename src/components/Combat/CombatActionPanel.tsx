import React, { useState } from 'react';
import { Sword, Target, Move, Zap, Shield, Eye } from 'lucide-react';
import type { Character, Ability, BattleToken } from '../../types';

interface CombatActionPanelProps {
  character: Character;
  isMyTurn: boolean;
  combatActive: boolean;
  playerToken?: BattleToken;
  allTokens: BattleToken[];
  onStartTargeting: (abilityId: string, range: number, targetType?: 'enemy' | 'ally' | 'any') => void;
  onCreateAttack: (targetId: string, acRoll: number) => void;
  onEndTurn: () => void;
  targetingMode: {
    active: boolean;
    abilityId?: string;
    range?: number;
    validTargets?: string[];
  };
  onCancelTargeting: () => void;
  maxMovementRange: number;
}

export function CombatActionPanel({
  character,
  isMyTurn,
  combatActive,
  playerToken,
  allTokens,
  onStartTargeting,
  onCreateAttack,
  onEndTurn,
  targetingMode,
  onCancelTargeting,
  maxMovementRange
}: CombatActionPanelProps) {
  const [selectedAttackTarget, setSelectedAttackTarget] = useState<string>('');
  const [acRoll, setACRoll] = useState<string>('');
  const [showAttackModal, setShowAttackModal] = useState(false);

  const getAbilityRange = (ability: Ability): number => {
    switch (ability.id) {
      case 'fencers_slash':
      case 'flourish_chain':
      case 'sword_slash':
      case 'prosthetic_strike':
        return 5; // Melee range
      case 'elemental_bolt':
      case 'card_toss':
        return 120; // Ranged attacks
      default:
        return 30; // Default range
    }
  };

  const getAbilityTargetType = (ability: Ability): 'enemy' | 'ally' | 'any' => {
    if (ability.name.toLowerCase().includes('heal') || 
        ability.name.toLowerCase().includes('blessing') ||
        ability.name.toLowerCase().includes('guiding')) {
      return 'ally';
    }
    return 'enemy';
  };

  const handleAbilityUse = (ability: Ability) => {
    if (!isMyTurn || !combatActive) return;
    
    const range = getAbilityRange(ability);
    const targetType = getAbilityTargetType(ability);
    
    onStartTargeting(ability.id, range, targetType);
  };

  const handleBasicAttack = () => {
    if (!isMyTurn || !combatActive) return;
    onStartTargeting('basic_attack', 5, 'enemy');
  };

  const handleAttackRoll = () => {
    if (!selectedAttackTarget || !acRoll) return;
    
    const roll = parseInt(acRoll);
    if (isNaN(roll)) return;
    
    onCreateAttack(selectedAttackTarget, roll);
    setShowAttackModal(false);
    setSelectedAttackTarget('');
    setACRoll('');
  };

  const getEnemyTokens = () => {
    return allTokens.filter(token => token.type === 'enemy');
  };

  const getMovementDisplay = () => {
    const squares = Math.floor(maxMovementRange / 5);
    return `${maxMovementRange}ft (${squares} squares)`;
  };

  if (!combatActive) {
    return (
      <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 mb-4 border border-clair-gold-600">
        <div className="text-center text-clair-gold-300">
          <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="font-serif">Combat not active</p>
          <p className="text-sm opacity-75">Waiting for GM to start combat</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 mb-4 border border-clair-gold-600">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-bold text-clair-gold-400">Combat Actions</h3>
        {isMyTurn && (
          <span className="bg-clair-gold-500 text-clair-shadow-900 px-3 py-1 rounded-full text-sm font-bold animate-pulse">
            Your Turn
          </span>
        )}
      </div>

      {/* Targeting Mode Display */}
      {targetingMode.active && (
        <div className="mb-4 p-3 bg-clair-mystical-900 bg-opacity-30 rounded-lg border border-clair-mystical-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Target className="w-5 h-5 mr-2 text-clair-mystical-400" />
              <span className="font-serif text-clair-mystical-200">
                Select Target {targetingMode.range && `(${targetingMode.range}ft range)`}
              </span>
            </div>
            <button
              onClick={onCancelTargeting}
              className="text-sm bg-clair-danger hover:bg-red-600 text-white px-2 py-1 rounded"
            >
              Cancel
            </button>
          </div>
          {targetingMode.validTargets && targetingMode.validTargets.length === 0 && (
            <p className="text-clair-mystical-300 text-sm mt-2">
              No valid targets in range. Move closer or try a different ability.
            </p>
          )}
        </div>
      )}

      {/* Movement Display */}
      <div className="mb-4 p-3 bg-clair-shadow-700 rounded-lg border border-clair-shadow-400">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Move className="w-5 h-5 mr-2 text-clair-success" />
            <span className="font-serif text-clair-gold-200">Movement</span>
          </div>
          <span className="text-clair-gold-300 font-bold">
            {getMovementDisplay()}
          </span>
        </div>
        <p className="text-xs text-clair-gold-300 mt-1">
          Drag your token on the battle map to move
        </p>
      </div>

      {/* Basic Attack */}
      <div className="mb-4">
        <button
          onClick={handleBasicAttack}
          disabled={!isMyTurn || targetingMode.active}
          className="w-full flex items-center justify-center p-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-serif font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sword className="w-5 h-5 mr-2" />
          Basic Attack (Melee)
        </button>
      </div>

      {/* Abilities */}
      <div className="space-y-2 mb-4">
        <h4 className="font-serif font-bold text-clair-gold-400 text-sm">Abilities</h4>
        {character.abilities.map((ability) => (
          <button
            key={ability.id}
            onClick={() => handleAbilityUse(ability)}
            disabled={!isMyTurn || targetingMode.active}
            className="w-full flex items-start p-3 bg-clair-mystical-500 hover:bg-clair-mystical-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Zap className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-left">
              <div className="font-serif font-bold text-sm">{ability.name}</div>
              <div className="text-xs opacity-90 line-clamp-2">{ability.description}</div>
              {ability.damage && (
                <div className="text-xs opacity-75 mt-1 text-clair-gold-200">{ability.damage}</div>
              )}
            </div>
            <div className="text-xs bg-black bg-opacity-30 px-2 py-1 rounded ml-2 capitalize">
              {ability.type.replace('_', ' ')}
            </div>
          </button>
        ))}
      </div>

      {/* End Turn */}
      {isMyTurn && (
        <button
          onClick={onEndTurn}
          disabled={targetingMode.active}
          className="w-full flex items-center justify-center p-3 bg-clair-gold-600 hover:bg-clair-gold-700 text-clair-shadow-900 rounded-lg font-serif font-bold transition-colors disabled:opacity-50"
        >
          <Eye className="w-5 h-5 mr-2" />
          End Turn
        </button>
      )}

      {/* Combat Tips */}
      <div className="mt-4 p-3 bg-clair-gold-900 bg-opacity-20 rounded-lg border border-clair-gold-600">
        <h4 className="font-serif font-bold text-clair-gold-400 text-xs mb-2">Combat Tips:</h4>
        <ul className="text-xs text-clair-gold-300 space-y-1">
          <li>• Move by dragging your token on the battle map</li>
          <li>• Target enemies by clicking abilities then selecting targets</li>
          <li>• Roll physical dice for AC and damage</li>
          <li>• GM determines hit/miss and applies damage</li>
        </ul>
      </div>
    </div>
  );
}