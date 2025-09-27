// src/components/CharacterSheet/NPCCharacterSheet.tsx
// Enhanced NPC Character Sheet with level integration and portraits

import React, { useState, useEffect } from 'react';
import { Heart, Shield, Sword, ChevronRight, Target, X, User } from 'lucide-react';
import { FirestoreService } from '../../services/firestoreService';
import type { GMCombatAction } from '../../types';
import { doc, updateDoc, arrayUnion, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useUltimateVideo } from '../../hooks/useUltimateVideo';

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

const NPC_ABILITIES: { [key: string]: any } = {
  'the-child': {
    level1: [
      {
        name: 'Dagger Throw',
        description: '+3 to hit, 4 slashing damage',
        damage: '4', // Fixed damage at level 1
        toHit: 3,
        range: 10,
        type: 'ranged'
      },
      {
        name: 'Reposition',
        description: 'After attacking, move behind nearest ally',
        type: 'movement',
        needsTarget: false,
        automatic: true // Triggers after attack
      }
    ],
    level2: [
      {
        name: 'Dagger Throw',
        description: '+3 to hit, 1d6 slashing damage', 
        damage: '1d6',
        toHit: 3,
        range: 15,
        type: 'ranged'
      },
      {
        name: 'Pinning Throw',
        description: 'Next attack pins target, reducing speed by 10ft',
        type: 'enchantment',
        needsTarget: false,
        appliesEffect: 'pin-slow'
      }
    ],
    level3: [
      {
        name: 'Dagger Throw (Enhanced)',
        description: '+4 to hit, 1d8 slashing damage',
        damage: '1d8',
        toHit: 4,
        range: 15,
        type: 'ranged'
      },
      {
        name: 'Pinning Throw (Upgraded)',
        description: 'Next attack restrains target (DC 13 STR save)',
        type: 'enchantment',
        needsTarget: false,
        appliesEffect: 'pin-restrain',
        saveDC: 13
      },
      {
        name: "For My Brother!",
        description: 'Summon spectral sword (AC 14, HP 20) for 5 rounds',
        type: 'ultimate',
        needsTarget: false,
        summonEntity: {
          name: "Brother's Sword",
          ac: 17,
          hp: 20,
          maxHp: 20,
          movement: 20,
          attack: {
            name: 'Spectral Slash',
            toHit: 5,
            damage: '1d10+2',
            range: 5,
            description: '+5 to hit, 1d10+2 slashing damage'
          },
          duration: 3, // rounds
          immunities: ['conditions']
        }
      }
    ]
  },
  'farmhand': {
    // Keep existing farmhand abilities unchanged
    level1: [
      {
        name: 'Pitchfork Jab',
        description: '+4 to hit, 1d8 piercing damage',
        damage: '1d8',
        toHit: 4,
        range: 10,
        type: 'melee'
      },
      {
        name: 'Rallying Cry',
        description: 'Allies gain +1 AC for 1 round',
        type: 'buff',
        range: 30,
        needsAllyTarget: true
      }
    ],
    level2: [
      {
        name: 'Enhanced Pitchfork',
        description: '+5 to hit, 1d10 piercing damage',
        damage: '1d10',
        toHit: 5,
        range: 10,
        type: 'melee'
      },
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
        description: 'Heal 2d4 HP to an ally',
        damage: '2d4',
        type: 'healing',
        range: 30,
        needsAllyTarget: true
      }
    ]
  }
};

// Additional state tracking for The Child's special mechanics
interface ChildNPCState {
  hasPinningEnchantment: boolean;
  enchantmentType?: 'pin-slow' | 'pin-restrain';
  ultimateUsed: boolean;
  summonedSword?: {
    id: string;
    hp: number;
    maxHp: number;
    ac: number;
    roundsRemaining: number;
    position?: { x: number; y: number };
  };
}


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
  const [hasPinningEnchantment, setHasPinningEnchantment] = useState(false);
  const [enchantmentType, setEnchantmentType] = useState<'pin-slow' | 'pin-restrain' | null>(null);
  const [ultimateUsed, setUltimateUsed] = useState(false);
  const [summonedSword, setSummonedSword] = useState<any>(null);
  const { triggerUltimate } = useUltimateVideo(sessionId || 'test-session');

  const hpPercentage = npc?.currentHP && npc?.maxHP ? (npc.currentHP / npc.maxHP) * 100 : 100;
  const hpColor = hpPercentage > 60 ? 'bg-green-500' : hpPercentage > 30 ? 'bg-yellow-500' : 'bg-red-500';

  // Get NPC portrait
  const getNPCPortrait = (npcId: string) => {
    const portraitMap: { [key: string]: string } = {
      'the-child': '/tokens/npc/childofgommage.png',
      'farmhand': '/tokens/npc/farmhand-fighter.png'
    };
    return portraitMap[npcId] || null;
  };

  const portraitUrl = getNPCPortrait(npc?.id || '');

  useEffect(() => {
    const checkUltimateUsage = async () => {
      const session = await FirestoreService.getBattleSession(sessionId);
      setUltimateUsed(session?.theChildUltimateUsed || false);
      
      // Also check if combat is active
      const combatActive = session?.combatState?.isActive || false;
      
      // If combat is not active, the ultimate should be considered "used" 
      // (disabled between battles)
      if (!combatActive) {
        setUltimateUsed(true);
      }
    };
    
    checkUltimateUsage();
    
    // Set up interval to check periodically for changes
    const interval = setInterval(checkUltimateUsage, 1000);
    
    return () => clearInterval(interval);
  }, [sessionId]);

  // Calculate distance between two positions
  const calculateDistance = (pos1: { x: number; y: number }, pos2: { x: number; y: number }): number => {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    return Math.max(dx, dy) * 5;
  };

  // Update getAvailableAbilities to handle level-based ability selection:
  const getAvailableAbilities = () => {
    const npcType = npc?.id === 'the-child' ? 'the-child' : 'farmhand';
    const abilities: any[] = [];
    
    if (npc?.id === 'the-child') {
      // For The Child, abilities change per level (not additive)
      const level = npc?.level || 1;
      
      if (level === 1) {
        abilities.push(...NPC_ABILITIES['the-child'].level1);
      } else if (level === 2) {
        // Level 2 gets upgraded basic attack and Pinning Throw
        abilities.push(
          NPC_ABILITIES['the-child'].level2[0], // Upgraded Dagger Throw
          NPC_ABILITIES['the-child'].level2[1], // Pinning Throw
          NPC_ABILITIES['the-child'].level1[1]  // Keep Reposition
        );
      } else if (level === 3) {
        // Level 3 gets all abilities including ultimate
        abilities.push(...NPC_ABILITIES['the-child'].level3);
        abilities.push(NPC_ABILITIES['the-child'].level1[1]); // Keep Reposition
      }
    } else {
      // Farmhand keeps the additive system
      if (npc?.level >= 1) {
        abilities.push(...(NPC_ABILITIES[npcType]?.level1 || []));
      }
      if (npc?.level >= 2) {
        abilities.push(...(NPC_ABILITIES[npcType]?.level2 || []));
      }
      if (npc?.level >= 3) {
        abilities.push(...(NPC_ABILITIES[npcType]?.level3 || []));
      }
    }
    
    return abilities;
  };

  // Update getValidTargets to respect ability range properly:
  const getValidTargets = (ability: any) => {
    if (!npcToken?.position) return [];
    
    // Handle different ability types
    if (ability.needsAllyTarget) {
      return availableAllies.filter(ally => {
        if (ally.id === npcToken.id) return false;
        const distance = calculateDistance(npcToken.position, ally.position);
        return distance <= (ability.range || 30);
      });
    } else if (ability.type === 'ranged' || ability.type === 'melee') {
      // For attack abilities, filter by range
      return availableEnemies.filter(enemy => {
        const distance = calculateDistance(npcToken.position, enemy.position);
        return distance <= (ability.range || 5);
      });
    }
    
    // Non-targeted abilities don't need targets
    return [];
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

  const handleActionSelect = (ability: any) => {
  if (!isNPCTurn || isExecuting) return;
  
  // Check if this is the ultimate and if it's already used
  if (ability.type === 'ultimate' && ultimateUsed) {
    alert('Ultimate ability already used this battle!');
    return;
  }
  
  // Handle Pinning Throw enchantment - DON'T END TURN
  if (ability.type === 'enchantment') {
    setHasPinningEnchantment(true);
    setEnchantmentType(ability.appliesEffect as 'pin-slow' | 'pin-restrain');
    
    // Show confirmation but DON'T end turn
    alert(`Dagger enchanted! Next attack will ${ability.appliesEffect === 'pin-slow' ? 'slow' : 'restrain'} the target. You can now throw your dagger!`);
    
    // DON'T call FirestoreService.nextTurn here - let the player continue their turn
    return;
  }
  
  // Handle Ultimate summon
  if (ability.type === 'ultimate') {
    handleSummonSword(ability);
    return;
  }
  
  // Check valid targets for attack abilities
  if (ability.type === 'ranged' || ability.type === 'melee') {
    const validTargets = getValidTargets(ability);
    
    if (validTargets.length === 0) {
      alert(`No valid targets in range (${ability.range || 5}ft)`);
      return;
    }
    
    setSelectedAction(ability);
    setShowTargetingModal(true);
  } else {
    // Non-combat abilities
    setSelectedAction(ability);
  }
};

  const handleSummonSword = async (ability: any) => {
    if (!npcToken || !sessionId) return;
    
    setIsExecuting(true);
    try {
      const ownerId = npcToken.characterId ?? npcToken.id;
      
      // Get current round from Firebase instead of using session
      const currentSession = await FirestoreService.getBattleSession(sessionId);
      const currentRound = currentSession?.combatState?.round || 1;

      try {
        await triggerUltimate('the-child', 'For My Brother');
      } catch (error) {
        console.error('Failed to trigger ultimate video:', error);
      }

      
      // Create action for GM to place the sword
      const action: GMCombatAction = {
        id: `ultimate-${Date.now()}`,
        type: 'turret_placement',
        playerId: ownerId,
        targetId: '',
        sourcePosition: npcToken.position,
        acRoll: 0,
        range: 5,
        timestamp: new Date(),
        resolved: false,
        hit: true,
        playerName: npcToken.name || 'The Child',
        targetName: '',
        abilityName: ability.name,
        turretData: {
          name: "Brother's Sword",
          hp: 20,
          maxHp: 20,
          type: 'npc' as const,  // Explicitly type this
          color: '#9333ea',
          size: 1
          // Remove ac, damage, range, duration as they're not part of the type
        }
      };
      
      await FirestoreService.addCombatAction(sessionId, action);
      
      setUltimateUsed(true);
      alert(`${ability.name} activated! GM will place Brother's Sword on the map.`);

      await FirestoreService.nextTurn(sessionId);
      await FirestoreService.updateBattleSession(sessionId, {
        theChildUltimateUsed: true,
        updatedAt: new Date()
      });

    } catch (error) {
      console.error('Failed to summon sword:', error);
      alert('Failed to activate ultimate ability');
    } finally {
      setIsExecuting(false);
    }
  };


const handleExecuteAction = async () => {
  if (!selectedAction || !selectedTarget || !acRoll || !npcToken) return;
  
  setIsExecuting(true);
  
  try {
    const target = availableEnemies.find(e => e.id === selectedTarget);
    if (!target) return;
    
    const totalRoll = parseInt(acRoll) + (selectedAction.toHit || 0);
    const hit = totalRoll >= (target.ac || 10);
    
    // Check if we need to apply pinning effect
    let statusEffect = null;
    if (hit && hasPinningEnchantment) {
      statusEffect = enchantmentType;
      setHasPinningEnchantment(false);
      setEnchantmentType(null);
    }
    
    // Create REGULAR combat action (NOT sword placement!)
    const action: GMCombatAction = {
      id: `npc-action-${Date.now()}`,
      type: 'attack',  // REGULAR ATTACK, not turret_placement
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
      needsDamageInput: hit,
      damageApplied: false,
      statusEffect // Include status effect if applicable
    };
    
    await FirestoreService.addCombatAction(sessionId, action);
    
    // Apply visual effect if pinning
    if (hit && statusEffect) {
      await FirestoreService.applyStatusEffect(sessionId, selectedTarget, statusEffect);
    }
    
    // Handle Reposition after attack
    if (npc?.id === 'the-child') {
      const nearestAlly = findNearestAlly();
      if (nearestAlly) {
        await repositionBehindAlly(nearestAlly);
      }
    }
    
    // End turn
    await FirestoreService.nextTurn(sessionId);
    
    // Reset state
    setSelectedAction(null);
    setSelectedTarget('');
    setACRoll('');
    setShowTargetingModal(false);
    
  } catch (error) {
    console.error('Failed to execute NPC action:', error);
  } finally {
    setIsExecuting(false);
  }
};
  // Helper function to find nearest ally:
  const findNearestAlly = () => {
    if (!npcToken?.position || !availableAllies.length) return null;
    
    let nearest = null;
    let minDistance = Infinity;
    
    availableAllies.forEach(ally => {
      if (ally.id === npcToken.id) return;
      const distance = calculateDistance(npcToken.position, ally.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = ally;
      }
    });
    
    return nearest;
  };

  // Helper function to reposition behind ally:
  const repositionBehindAlly = async (ally: any) => {
    if (!npcToken || !sessionId) return;
    
    // Calculate position behind ally (opposite from nearest enemy)
    const enemies = availableEnemies;
    let behindPosition = { x: ally.position.x, y: ally.position.y + 1 };
    
    if (enemies.length > 0) {
      // Find average enemy position
      const avgEnemyX = enemies.reduce((sum, e) => sum + e.position.x, 0) / enemies.length;
      const avgEnemyY = enemies.reduce((sum, e) => sum + e.position.y, 0) / enemies.length;
      
      // Move opposite direction from enemies
      const dx = ally.position.x - avgEnemyX;
      const dy = ally.position.y - avgEnemyY;
      
      behindPosition = {
        x: ally.position.x + (dx > 0 ? 1 : -1),
        y: ally.position.y + (dy > 0 ? 1 : -1)
      };
    }
    
    // Update position in Firebase
    await FirestoreService.updateTokenPosition(sessionId, npcToken.id, behindPosition);
  };

  const abilities = getAvailableAbilities();

  return (
    <>
      <div className="px-4 py-6 space-y-4">
        {/* NPC Header with Portrait */}
        <div className="bg-gradient-to-br from-clair-mystical-600 to-clair-mystical-800 rounded-lg p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              {/* Portrait Circle */}
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center border-2 border-clair-gold-400 overflow-hidden shadow-lg">
                {portraitUrl ? (
                  <img 
                    src={portraitUrl} 
                    alt={npc?.name || 'NPC'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.error(`Failed to load image for ${npc?.name}`);
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                ) : (
                  <User className="w-8 h-8 text-clair-gold-200" />
                )}
              </div>
              
              {/* Name and Stats */}
              <div>
                <h2 className="text-2xl font-bold text-white">{npc?.name || 'NPC'}</h2>
                <div className="flex items-center gap-4 text-sm text-clair-gold-200 mt-1">
                  <span>Level {npc?.level || 1}</span>
                  <span>AC {npc?.ac || 12}</span>
                  <span>HP: {npc?.currentHP || 0}/{npc?.maxHP || 14}</span>
                </div>
              </div>
            </div>
            
            {/* Level Selector (if GM) */}
            {onLevelChange && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-white">Level:</label>
                <select
                  value={npc?.level || 1}
                  onChange={(e) => onLevelChange(parseInt(e.target.value))}
                  disabled={isLoading}
                  className="bg-clair-shadow-700 text-white px-3 py-1 rounded border border-clair-gold-500"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3 (Max)</option>
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

        {/* Full Portrait Display */}
        {portraitUrl && (
          <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 border border-clair-gold-600">
            <h3 className="font-display text-lg font-bold text-clair-gold-400 mb-3">Character Portrait</h3>
            <div className="flex justify-center">
              <div className="w-32 h-32 rounded-lg overflow-hidden border-2 border-clair-gold-400 shadow-xl">
                <img 
                  src={portraitUrl} 
                  alt={`${npc?.name} portrait`}
                  className="w-full h-full object-cover"
                  style={{ imageRendering: 'crisp-edges' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Turn Indicator */}
        {isNPCTurn && (
          <div className="bg-green-900 bg-opacity-30 border border-green-600 rounded-lg p-3 animate-pulse">
            <p className="text-green-200 font-bold text-center">
              {npc?.name || 'NPC'}'s Turn - Take an action!
            </p>
          </div>
        )}

        {/* Combat Actions */}
        {isNPCTurn && (
          <div className="bg-clair-shadow-700 rounded-lg p-4">
            <h3 className="text-lg font-bold text-clair-gold-400 mb-3">Combat Actions</h3>
            
            {!selectedAction ? (
              <div className="space-y-2">
                {abilities.length === 0 ? (
                  <p className="text-center text-clair-gold-400 py-4">
                    No abilities available at level {npc?.level || 1}
                  </p>
                ) : (
                    abilities.map((ability: any, index: number) => {
                      // Check if ability needs targets
                      const needsTargets = ability.type === 'ranged' || ability.type === 'melee' || ability.needsAllyTarget;
                      
                      let hasTargets = true; // Default to true for abilities that don't need targets
                      
                      if (needsTargets) {
                        const validTargets = getValidTargets(ability);
                        hasTargets = validTargets.length > 0;
                      }
                      
                      // Special checks
                      if (ability.type === 'ultimate' && ultimateUsed) {
                        hasTargets = false; // Ultimate already used
                      }

                      const isEnchantedAttack = ability.type === 'ranged' && hasPinningEnchantment;

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
                            {isEnchantedAttack && (
                              <span className="text-xs bg-purple-500 px-2 py-1 rounded animate-pulse">
                                ENCHANTED - {enchantmentType === 'pin-slow' ? 'SLOW' : 'RESTRAIN'}
                              </span>
                            )}
                            {ability.type === 'ultimate' && (
                              <span className="text-xs bg-yellow-600 px-2 py-1 rounded">ULTIMATE</span>
                            )}
                            {needsTargets && !hasTargets && (
                              <span className="text-xs text-red-400">(No targets in range)</span>
                            )}
                            {ability.type === 'ultimate' && ultimateUsed && (
                              <span className="text-xs text-red-400">(Already used)</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-300">{ability.description}</p>
                          {ability.range && (
                            <p className="text-xs text-clair-gold-200 mt-1">Range: {ability.range}ft</p>
                          )}
                        </button>
                      );
                    })
                )}
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

        {/* Level Abilities Display */}
        <div className="bg-clair-shadow-700 rounded-lg p-4">
          <h3 className="text-lg font-bold text-clair-gold-400 mb-3">
            Level {npc?.level || 1} Abilities
          </h3>
          <div className="space-y-2 text-sm text-clair-gold-200">
            {abilities.map((ability: any, index: number) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-clair-gold-400">•</span>
                <div>
                  <span className="font-semibold">{ability.name}:</span>
                  <span className="ml-2 text-gray-300">{ability.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
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

// Targeting modal component for NPCs
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