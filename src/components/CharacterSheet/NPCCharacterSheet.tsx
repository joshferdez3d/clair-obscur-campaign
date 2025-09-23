// src/components/CharacterSheet/NPCCharacterSheet.tsx
// Simplified NPC Character Sheet for initial implementation

import React, { useState } from 'react';
import { Heart, Shield, Sword, ChevronRight } from 'lucide-react';

interface NPCCharacterSheetProps {
  npc: any;
  sessionId: string;
  isNPCTurn: boolean;
  onHPChange: (newHP: number) => void;
  onLevelChange?: (newLevel: number) => void;
  isLoading: boolean;
  availableEnemies?: any[];
  availableAllies?: any[];
  npcToken?: any;
}

// Basic NPC data structure
const NPC_ABILITIES: { [key: string]: any } = {
  'the-child': {
    level0: [
      {
        name: 'Wild Swing',
        description: '+3 to hit, 1d6 slashing damage',
        damage: '1d6 slashing'
      },
      {
        name: 'Desperate Dodge',
        description: 'Once per short rest, advantage on one Dex save',
        cost: '1/short rest'
      }
    ],
    level1: ['Focused Strike'],
    level2: ['Disciplined Slash'],
    level3: ['For My Brother!']
  },
  'farmhand': {
    level0: [
      {
        name: 'Pitchfork Jab',
        description: '+4 to hit, 1d8 piercing damage',
        damage: '1d8 piercing'
      },
      {
        name: 'Patch Up',
        description: 'Heal 1d4 HP',
        damage: '1d4 healing'
      }
    ],
    level1: ['Rallying Cry'],
    level2: ['Interpose'],
    level3: ['Hearthlight']
  }
};

export function NPCCharacterSheet({ 
  npc, 
  sessionId,
  isNPCTurn,
  onHPChange, 
  onLevelChange, 
  isLoading,
  availableEnemies = [],
  availableAllies = [],
  npcToken
}: NPCCharacterSheetProps) {
  const [selectedAction, setSelectedAction] = useState<any>(null);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [acRoll, setACRoll] = useState<string>('');

  const hpPercentage = npc?.currentHP && npc?.maxHP ? (npc.currentHP / npc.maxHP) * 100 : 100;
  const hpColor = hpPercentage > 60 ? 'bg-green-500' : hpPercentage > 30 ? 'bg-yellow-500' : 'bg-red-500';

  // Get available abilities based on NPC type and level
  const getAvailableAbilities = () => {
    const npcType = npc?.id === 'the-child' ? 'the-child' : 'farmhand';
    const abilities = NPC_ABILITIES[npcType]?.level0 || [];
    
    // Add abilities from higher levels if unlocked
    if (npc?.level >= 1) {
      abilities.push(...(NPC_ABILITIES[npcType]?.level1 || []));
    }
    if (npc?.level >= 2) {
      abilities.push(...(NPC_ABILITIES[npcType]?.level2 || []));
    }
    if (npc?.level >= 3) {
      abilities.push(...(NPC_ABILITIES[npcType]?.level3 || []));
    }
    
    return abilities;
  };

  const abilities = getAvailableAbilities();

  return (
    <div className="px-4 py-6 space-y-4">
      {/* NPC Header */}
      <div className="bg-gradient-to-br from-clair-mystical-600 to-clair-mystical-800 rounded-lg p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-2xl font-bold text-white">{npc?.name || 'NPC'}</h2>
            <div className="flex items-center gap-4 text-sm text-clair-gold-200 mt-1">
              <span>Level {npc?.level || 0}</span>
              <span>AC {npc?.ac || 12}</span>
            </div>
          </div>
          {onLevelChange && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-white">Level:</label>
              <select
                value={npc?.level || 0}
                onChange={(e) => onLevelChange(parseInt(e.target.value))}
                disabled={isLoading}
                className="bg-clair-shadow-700 text-white px-3 py-1 rounded border border-clair-gold-500"
              >
                <option value={0}>0 (Base)</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </div>
          )}
        </div>

        {/* HP Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-400" />
              <span className="text-white font-bold">Hit Points</span>
            </div>
            <span className="text-white font-bold">
              {npc?.currentHP || 0} / {npc?.maxHP || 14}
            </span>
          </div>
          <div className="w-full bg-clair-shadow-700 rounded-full h-6 overflow-hidden">
            <div 
              className={`h-full ${hpColor} transition-all duration-300`}
              style={{ width: `${Math.max(0, hpPercentage)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Turn Indicator */}
      {isNPCTurn && (
        <div className="bg-green-900 bg-opacity-30 border border-green-600 rounded-lg p-3 animate-pulse">
          <p className="text-green-200 font-bold text-center">
            🎯 {npc?.name || 'NPC'}'s Turn - Take an action!
          </p>
        </div>
      )}

      {/* Combat Actions */}
      {isNPCTurn && (
        <div className="bg-clair-shadow-700 rounded-lg p-4">
          <h3 className="text-lg font-bold text-clair-gold-400 mb-3">Combat Actions</h3>
          
          {!selectedAction ? (
            <div className="space-y-2">
              {abilities.map((ability: any, index: number) => (
                <button
                  key={index}
                  onClick={() => setSelectedAction(ability)}
                  className="w-full p-3 rounded-lg bg-clair-shadow-600 hover:bg-clair-shadow-500 text-white border border-clair-gold-500 transition-all text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Sword className="w-4 h-4 text-clair-gold-400" />
                    <span className="font-bold">
                      {typeof ability === 'string' ? ability : ability.name}
                    </span>
                  </div>
                  {typeof ability === 'object' && ability.description && (
                    <p className="text-sm text-gray-300">{ability.description}</p>
                  )}
                </button>
              ))}
            </div>
          ) : (
            // Action execution interface
            <div className="space-y-3">
              <div className="p-3 bg-clair-mystical-900 bg-opacity-30 rounded border border-clair-mystical-600">
                <h4 className="font-bold text-clair-mystical-200 mb-2">
                  {typeof selectedAction === 'string' ? selectedAction : selectedAction.name}
                </h4>
                {typeof selectedAction === 'object' && selectedAction.description && (
                  <p className="text-sm text-clair-mystical-300">{selectedAction.description}</p>
                )}
              </div>

              {/* Target Selection */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-clair-gold-300">Select Target:</label>
                <select
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value)}
                  className="w-full bg-clair-shadow-600 text-white px-3 py-2 rounded border border-clair-gold-500"
                >
                  <option value="">-- Select Target --</option>
                  {availableEnemies.map((enemy: any) => (
                    <option key={enemy.id} value={enemy.id}>
                      {enemy.name} (AC {enemy.ac})
                    </option>
                  ))}
                </select>
              </div>

              {/* AC Roll */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-clair-gold-300">Attack Roll (d20 + modifiers):</label>
                <input
                  type="number"
                  value={acRoll}
                  onChange={(e) => setACRoll(e.target.value)}
                  placeholder="Enter total roll"
                  className="w-full bg-clair-shadow-600 text-white px-3 py-2 rounded border border-clair-gold-500"
                  min="1"
                  max="30"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    // Execute ability logic would go here
                    console.log('Executing ability:', selectedAction, 'on', selectedTarget, 'with roll', acRoll);
                    setSelectedAction(null);
                    setSelectedTarget('');
                    setACRoll('');
                  }}
                  disabled={!selectedTarget || !acRoll}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded font-bold transition-all"
                >
                  Execute
                </button>
                <button
                  onClick={() => {
                    setSelectedAction(null);
                    setSelectedTarget('');
                    setACRoll('');
                  }}
                  className="px-4 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Abilities Preview (when not NPC's turn) */}
      {!isNPCTurn && (
        <div className="bg-clair-shadow-700 rounded-lg p-4 opacity-60">
          <h3 className="text-lg font-bold text-clair-gold-400 mb-3">Available Abilities</h3>
          <div className="space-y-2">
            {abilities.map((ability: any, index: number) => (
              <div
                key={index}
                className="p-3 rounded-lg bg-clair-shadow-600 border border-clair-gold-500 opacity-75"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Sword className="w-4 h-4 text-clair-gold-400" />
                  <span className="font-bold text-gray-400">
                    {typeof ability === 'string' ? ability : ability.name}
                  </span>
                </div>
                {typeof ability === 'object' && ability.description && (
                  <p className="text-sm text-gray-500">{ability.description}</p>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Abilities can only be used during {npc?.name || 'NPC'}'s turn
          </p>
        </div>
      )}

      {/* Level Progression Info */}
      {(npc?.level || 0) < 3 && (
        <div className="bg-clair-mystical-900 bg-opacity-30 rounded-lg p-4 border border-clair-mystical-500">
          <h3 className="text-lg font-bold text-clair-mystical-300 mb-2">Next Unlocks</h3>
          <div className="space-y-2 text-sm">
            {(npc?.level || 0) < 1 && (
              <div className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-clair-gold-400 mt-0.5" />
                <span className="text-gray-300">
                  <span className="text-clair-gold-400 font-bold">Level 1:</span> Gains new ability
                </span>
              </div>
            )}
            {(npc?.level || 0) < 2 && (
              <div className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-clair-gold-400 mt-0.5" />
                <span className="text-gray-300">
                  <span className="text-clair-gold-400 font-bold">Level 2:</span> Upgrades existing abilities
                </span>
              </div>
            )}
            {(npc?.level || 0) < 3 && (
              <div className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-clair-gold-400 mt-0.5" />
                <span className="text-gray-300">
                  <span className="text-clair-gold-400 font-bold">Level 3:</span> Unlocks ultimate ability
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NPCCharacterSheet;