// src/components/CharacterSheet/NPCCharacterSheet.tsx
// Enhanced NPC Character Sheet with range validation and GM popup integration

import React, { useState } from 'react';
import { Heart, Shield, Sword, ChevronRight, Target, X } from 'lucide-react';
import { FirestoreService } from '../../services/firestoreService';
import type { GMCombatAction } from '../../types';

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

// Enhanced NPC data with proper attack ranges
const NPC_ABILITIES: { [key: string]: any } = {
  'the-child': {
    level0: [
      {
        name: 'Wild Swing',
        description: '+3 to hit, 1d6 slashing damage',
        damage: '1d6',
        toHit: 3,
        range: 5, // Melee range
        type: 'melee'
      },
      {
        name: 'Desperate Dodge',
        description: 'Once per short rest, advantage on one Dex save',
        cost: '1/short rest',
        type: 'defensive'
      }
    ],
    level1: [
      {
        name: 'Focused Strike',
        description: '+4 to hit, 1d8 slashing damage',
        damage: '1d8',
        toHit: 4,
        range: 5,
        type: 'melee'
      }
    ],
    level2: [
      {
        name: 'Disciplined Slash',
        description: '+5 to hit, 1d8 slashing damage',
        damage: '1d8',
        toHit: 5,
        range: 5,
        type: 'melee'
      }
    ],
    level3: [
      {
        name: 'For My Brother!',
        description: '+6 to hit, 2d8 slashing damage',
        damage: '2d8',
        toHit: 6,
        range: 5,
        type: 'ultimate'
      }
    ]
  },
  'farmhand': {
    level0: [
      {
        name: 'Pitchfork Jab',
        description: '+4 to hit, 1d8 piercing damage',
        damage: '1d8',
        toHit: 4,
        range: 10, // Reach weapon
        type: 'melee'
      },
      {
        name: 'Patch Up',
        description: 'Heal 1d4 HP',
        damage: '1d4',
        type: 'healing',
        needsAllyTarget: true
      }
    ],
    level1: [
      {
        name: 'Rallying Cry',
        description: 'Grant advantage to an ally',
        type: 'buff',
        range: 30,
        needsAllyTarget: true
      }
    ],
    level2: [
      {
        name: 'Interpose',
        description: 'Redirect attack to self',
        type: 'defensive',
        range: 5
      }
    ],
    level3: [
      {
        name: 'Hearthlight',
        description: 'Heal 2d6 HP to an ally',
        damage: '2d6',
        type: 'healing',
        range: 30,
        needsAllyTarget: true
      }
    ]
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
  const [showTargetingModal, setShowTargetingModal] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const hpPercentage = npc?.currentHP && npc?.maxHP ? (npc.currentHP / npc.maxHP) * 100 : 100;
  const hpColor = hpPercentage > 60 ? 'bg-green-500' : hpPercentage > 30 ? 'bg-yellow-500' : 'bg-red-500';

  // Calculate distance between two positions
  const calculateDistance = (pos1: { x: number; y: number }, pos2: { x: number; y: number }): number => {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    return Math.max(dx, dy) * 5; // Convert to feet
  };

  // Get available abilities based on NPC type and level
  const getAvailableAbilities = () => {
    const npcType = npc?.id === 'the-child' ? 'the-child' : 'farmhand';
    const abilities: any[] = [...(NPC_ABILITIES[npcType]?.level0 || [])];
    
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

  // Get valid targets based on ability type and range
  const getValidTargets = (ability: any) => {
    if (!npcToken?.position) return [];
    
    if (ability.needsAllyTarget) {
      return availableAllies.filter(ally => {
        if (ally.id === npcToken.id) return false; // Can't target self
        const distance = calculateDistance(npcToken.position, ally.position);
        return distance <= (ability.range || 30);
      });
    } else {
      return availableEnemies.filter(enemy => {
        const distance = calculateDistance(npcToken.position, enemy.position);
        return distance <= (ability.range || 5);
      });
    }
  };

  // Roll damage dice
  const rollDamage = (damageStr: string): number => {
    if (!damageStr) return 0;
    
    const match = damageStr.match(/(\d+)d(\d+)([+-]\d+)?/);
    if (!match) return 0;
    
    const numDice = parseInt(match[1]);
    const diceSize = parseInt(match[2]);
    const modifier = match[3] ? parseInt(match[3]) : 0;
    
    let total = modifier;
    for (let i = 0; i < numDice; i++) {
      total += Math.floor(Math.random() * diceSize) + 1;
    }
    
    return Math.max(1, total);
  };

  // Handle action selection
  const handleActionSelect = (ability: any) => {
    if (!isNPCTurn || isExecuting) return;
    
    // Check if this is a non-combat ability
    if (ability.type === 'defensive' || ability.type === 'buff') {
      // Handle non-attack abilities
      setSelectedAction(ability);
      return;
    }
    
    // For attack/healing abilities, check valid targets
    const validTargets = getValidTargets(ability);
    
    if (validTargets.length === 0) {
      alert(`No valid targets in range (${ability.range || 5}ft)`);
      return;
    }
    
    setSelectedAction(ability);
    setShowTargetingModal(true);
  };

  // Execute the action
  const handleExecuteAction = async () => {
    if (!selectedAction || !selectedTarget || !acRoll || !npcToken) return;
    
    setIsExecuting(true);
    
    try {
      const target = selectedAction.needsAllyTarget 
        ? availableAllies.find(a => a.id === selectedTarget)
        : availableEnemies.find(e => e.id === selectedTarget);
        
      if (!target) return;
      
      const totalRoll = parseInt(acRoll) + (selectedAction.toHit || 0);
      const hit = totalRoll >= (target.ac || 10);
      
      // Create combat action for GM popup
      const action: GMCombatAction = {
        id: `npc-action-${Date.now()}`,
        type: 'attack',
        playerId: npcToken.id,
        playerName: npc.name,
        targetId: selectedTarget,
        targetName: target.name,
        sourcePosition: npcToken.position,
        range: selectedAction.range || 5,
        timestamp: new Date(),
        resolved: false,
        hit,
        acRoll: totalRoll,
        abilityName: selectedAction.name,
        needsDamageInput: hit && selectedAction.type !== 'healing',
        damageApplied: false
      };
      
      // Add to pending actions for GM
      await FirestoreService.addCombatAction(sessionId, action);
      
      // If it's a healing ability, apply immediately
      if (selectedAction.type === 'healing' && hit) {
        const healing = rollDamage(selectedAction.damage);
        await FirestoreService.updateTokenProperty(
          sessionId, 
          selectedTarget, 
          'hp', 
          Math.min(target.maxHp || 20, (target.hp || 0) + healing)
        );
      }
      
      // End the NPC's turn
      await FirestoreService.nextTurn(sessionId);
      
      // Reset state
      setSelectedAction(null);
      setSelectedTarget('');
      setACRoll('');
      setShowTargetingModal(false);
      
    } catch (error) {
      console.error('Failed to execute NPC action:', error);
      alert('Failed to execute action. Please try again.');
    } finally {
      setIsExecuting(false);
    }
  };

  const abilities = getAvailableAbilities();

  return (
    <>
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
                {abilities.map((ability: any, index: number) => {
                  const validTargets = getValidTargets(ability);
                  const hasTargets = ability.type === 'defensive' || validTargets.length > 0;
                  
                  return (
                    <button
                      key={index}
                      onClick={() => handleActionSelect(ability)}
                      disabled={!hasTargets || isExecuting}
                      className={`w-full p-3 rounded-lg text-white border transition-all text-left ${
                        hasTargets 
                          ? 'bg-clair-shadow-600 hover:bg-clair-shadow-500 border-clair-gold-500'
                          : 'bg-gray-700 border-gray-600 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Sword className="w-4 h-4 text-clair-gold-400" />
                        <span className="font-bold">{ability.name}</span>
                        {!hasTargets && (
                          <span className="text-xs text-red-400">(No targets in range)</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-300">{ability.description}</p>
                      {ability.range && (
                        <p className="text-xs text-clair-gold-200 mt-1">Range: {ability.range}ft</p>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              // Action execution interface (for non-targeted abilities)
              selectedAction.type === 'defensive' || selectedAction.type === 'buff' ? (
                <div className="space-y-3">
                  <div className="p-3 bg-clair-mystical-900 bg-opacity-30 rounded border border-clair-mystical-600">
                    <h4 className="font-bold text-clair-mystical-200 mb-2">{selectedAction.name}</h4>
                    <p className="text-sm text-clair-mystical-300">{selectedAction.description}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        // Execute non-targeted ability
                        FirestoreService.nextTurn(sessionId);
                        setSelectedAction(null);
                      }}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded font-bold"
                    >
                      Execute {selectedAction.name}
                    </button>
                    <button
                      onClick={() => setSelectedAction(null)}
                      className="px-4 bg-red-600 hover:bg-red-700 text-white rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}
      </div>

      {/* Enhanced Targeting Modal */}
      {showTargetingModal && selectedAction && (
        <NPCTargetingModal
          isOpen={showTargetingModal}
          onClose={() => {
            setShowTargetingModal(false);
            setSelectedAction(null);
            setSelectedTarget('');
            setACRoll('');
          }}
          ability={selectedAction}
          validTargets={getValidTargets(selectedAction)}
          onSelectTarget={(targetId: string) => setSelectedTarget(targetId)}
          onConfirm={handleExecuteAction}
          selectedTarget={selectedTarget}
          acRoll={acRoll}
          onACRollChange={setACRoll}
          npcToken={npcToken}
        />
      )}
    </>
  );
}

// New targeting modal component for NPCs
interface NPCTargetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  ability: any;
  validTargets: any[];
  onSelectTarget: (targetId: string) => void;
  onConfirm: () => void;
  selectedTarget: string;
  acRoll: string;
  onACRollChange: (value: string) => void;
  npcToken: any;
}

function NPCTargetingModal({
  isOpen,
  onClose,
  ability,
  validTargets,
  onSelectTarget,
  onConfirm,
  selectedTarget,
  acRoll,
  onACRollChange,
  npcToken
}: NPCTargetingModalProps) {
  if (!isOpen) return null;

  const calculateDistance = (target: any): number => {
    if (!npcToken?.position) return 999;
    const dx = Math.abs(npcToken.position.x - target.position.x);
    const dy = Math.abs(npcToken.position.y - target.position.y);
    return Math.max(dx, dy) * 5;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-clair-shadow-800 border-2 border-clair-gold-600 rounded-lg shadow-2xl max-w-md w-full mx-4">
        <div className="p-4 border-b border-clair-gold-600">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-clair-gold-400 flex items-center">
              <Target className="w-5 h-5 mr-2" />
              {ability.name}
            </h2>
            <button onClick={onClose} className="text-clair-gold-300 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-sm text-clair-gold-300 mt-1">
            Range: {ability.range || 5}ft • {validTargets.length} targets in range
          </p>
        </div>

        <div className="p-4 max-h-96 overflow-y-auto">
          {validTargets.length === 0 ? (
            <p className="text-center text-clair-gold-400 py-8">
              No valid targets in range
            </p>
          ) : (
            <div className="space-y-2">
              {validTargets.map(target => (
                <button
                  key={target.id}
                  onClick={() => onSelectTarget(target.id)}
                  className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                    selectedTarget === target.id
                      ? 'border-clair-gold-400 bg-clair-gold-900 bg-opacity-30'
                      : 'border-clair-shadow-600 bg-clair-shadow-700 hover:bg-clair-shadow-600'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold text-white">{target.name}</div>
                      <div className="text-sm text-clair-gold-400">
                        {calculateDistance(target)}ft away
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-clair-gold-300">AC: {target.ac}</div>
                      <div className="text-sm text-red-400">
                        {target.hp}/{target.maxHp} HP
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedTarget && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-bold text-clair-gold-300 mb-2">
                  Attack Roll (d20 + {ability.toHit || 0}):
                </label>
                <input
                  type="number"
                  value={acRoll}
                  onChange={(e) => onACRollChange(e.target.value)}
                  placeholder="Enter d20 roll"
                  className="w-full p-3 bg-clair-shadow-700 border border-clair-gold-600 rounded-lg text-white"
                  min="1"
                  max="20"
                />
                {acRoll && (
                  <p className="text-sm text-clair-gold-400 mt-1">
                    Total: {parseInt(acRoll) + (ability.toHit || 0)}
                  </p>
                )}
              </div>

              <button
                onClick={onConfirm}
                disabled={!acRoll}
                className="w-full bg-clair-gold-600 hover:bg-clair-gold-700 disabled:bg-gray-600 disabled:opacity-50 p-3 rounded-lg font-bold text-clair-shadow-900 transition-colors"
              >
                Execute Attack
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}