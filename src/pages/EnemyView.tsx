import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, Heart, Swords, Target, Move } from 'lucide-react';
import { useCombat } from '../hooks/useCombat';
import { FirestoreService } from '../services/firestoreService';
import { BattleToken, GMCombatAction } from '../types';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { enemies } from '../data/enemies';
import type { EnemyData } from '../types';
import { useBrowserWarning } from '../hooks/useBrowserWarning';
import { ProtectionService } from '../services/ProtectionService';
import { PassiveEnemyAbilityService } from '../services/passiveEnemyAbilityService';
import { LampmasterService } from '../services/LampmasterService';

interface EnemyAttack {
  name: string;
  toHit: number;
  damage: string;
  reach?: number;
  range?: string;
  recharge?: string;
  description?: string;
}

const EnemyView: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { session, loading, error, nextTurn } = useCombat(sessionId || '');
  
  const [selectedAbility, setSelectedAbility] = useState<EnemyAttack | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [acRoll, setACRoll] = useState<string>('');
  const [isAttacking, setIsAttacking] = useState(false);
  
  const [isRitualActive, setIsRitualActive] = useState(false);
  const [ritualSequence, setRitualSequence] = useState<number[]>([]);
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);
  const [hasUsedRegularAction, setHasUsedRegularAction] = useState(false);
  const isApplyingUltimate = useRef(false);

  // Get current enemy based on turn
  const currentTurnEntry = session?.combatState?.initiativeOrder.find(
    e => e.id === session?.combatState?.currentTurn
  );

  useBrowserWarning({
    enabled: true,
    message: '⚠️ Warning: You are controlling enemies in combat. Leaving will disrupt the battle. Are you sure?'
  });

  // Add helper function to check if enemy is Lampmaster
  const isLampmaster = (enemy: BattleToken | null): boolean => {
    if (!enemy) return false;
    return enemy.name === 'Lampmaster' || enemy.id.includes('lampmaster');
  };

  // Get the current enemy token and data
  const getCurrentEnemy = () => {
    if (!currentTurnEntry || currentTurnEntry.type !== 'enemy') return null;
    
    const enemyName = currentTurnEntry.name.replace(/ \(x\d+\)/, '');
    const enemyToken = Object.values(session?.tokens || {}).find(
      token => token.type === 'enemy' && 
               token.name === enemyName && 
               (token.hp || 0) > 0
    ) as BattleToken | undefined;
    
    if (!enemyToken) return null;
    
    let enemyData: EnemyData | undefined;
    
    if (session?.enemyData) {
      const enemyDataEntry = Object.values(session.enemyData).find(
        (data: any) => data.name === enemyName
      ) as EnemyData | undefined;
      enemyData = enemyDataEntry;
    }
    
    if (!enemyData && enemies) {
      const enemiesArray = Object.values(enemies) as EnemyData[];
      enemyData = enemiesArray.find(e => e.name === enemyName);
    }
    
    return {
      token: enemyToken,
      data: enemyData
    };
  };

  const currentEnemy = getCurrentEnemy();
  
  // Get all alive enemies of the same type for group turns
  const getEnemyGroup = () => {
    if (!currentTurnEntry || currentTurnEntry.type !== 'enemy') return [];
    
    const enemyName = currentTurnEntry.name.replace(/ \(x\d+\)/, '');
    return Object.values(session?.tokens || {}).filter(
      token => token.type === 'enemy' && 
               token.name === enemyName && 
               (token.hp || 0) > 0
    ) as BattleToken[];
  };
  
  const enemyGroup = getEnemyGroup();
  const [currentEnemyIndex, setCurrentEnemyIndex] = useState(0);
  const activeEnemy = enemyGroup[currentEnemyIndex];

  const handleSwordOfLightRitual = async () => {
  if (!activeEnemy || !sessionId) return;
  
  setIsRitualActive(true);
  setIsPlayingSequence(true);
  
  try {
    const sequence = await LampmasterService.startLampRitual(sessionId, activeEnemy.id);
    setRitualSequence(sequence);
    
    const action: GMCombatAction = {
      id: `ritual-${Date.now()}`,
      type: 'ability',
      playerId: activeEnemy.id,
      playerName: 'Lampmaster',
      targetId: 'all-players',
      targetName: 'All Players',
      sourcePosition: activeEnemy.position,
      range: 999,
      timestamp: new Date(),
      resolved: false,
      hit: true,
      abilityName: 'Sword of Light (Ritual Started)',
      needsDamageInput: false,
      damageApplied: false,
      description: 'Lamps glow in sequence. Attack them in order to reduce damage!',
      ultimateType: 'lampmaster_ritual',
      needsGMInteraction: false
    };
    
    await FirestoreService.addCombatAction(sessionId, action);
    
    setTimeout(() => {
      setIsPlayingSequence(false);
    }, 7000);
    
    // ✅ NEW: If Lampmaster used their bonus action (ritual), end turn immediately
    if (hasUsedRegularAction) {
      console.log('⚔️ Lampmaster used bonus action (ritual) - ending turn');
      await nextTurn();
    }
    
  } catch (error) {
    console.error('Failed to start lamp ritual:', error);
    setIsRitualActive(false);
    setIsPlayingSequence(false);
  }
};

  // Function to handle ritual damage application
  const handleApplySwordOfLight = async () => {
    if (!activeEnemy || !sessionId) return;
     // Prevent multiple calls
    if (isApplyingUltimate.current) {
      console.log('⚠️ Already applying Sword of Light, skipping...');
      return;
    }

    isApplyingUltimate.current = true;

     try {
        await LampmasterService.applySwordOfLight(sessionId, activeEnemy.id);
        setIsRitualActive(false);
        setRitualSequence([]);
        // Don't call nextTurn here - let the passive ability system handle it
      } catch (error) {
        console.error('Failed to apply Sword of Light:', error);
      } finally {
        isApplyingUltimate.current = false;
      }
  };

  // Update the ability selection to handle Sword of Light
  const handleAbilitySelect = (ability: EnemyAttack) => {
    if (ability.name === 'Sword of Light') {
      handleSwordOfLightRitual();
      return;
    }
    
    setSelectedAbility(ability);
    setSelectedTarget('');
    setACRoll('');
  };

  useEffect(() => {
    // Reset regular action flag when turn changes
    setHasUsedRegularAction(false);
    setCurrentEnemyIndex(0);
  }, [currentTurnEntry?.id]);


  // Ritual status check useEffect
  useEffect(() => {
    if (!session?.lampmasterRitual || !activeEnemy || !isLampmaster(activeEnemy)) return;
    
    const ritual = session.lampmasterRitual;
    const currentRound = session.combatState?.round || 1;
    
    console.log(`🔮 Ritual check - Current: R${currentRound}, Trigger: R${ritual.willTriggerOnRound}, Active: ${ritual.isActive}`);
    
    const isLampmasterTurn = currentTurnEntry?.id && (
      currentTurnEntry.id.includes('lampmaster') ||
      currentTurnEntry.name === 'Lampmaster'
    );
    
    // ✅ FIXED: Only trigger if ritual hasn't been applied yet
    // Check if ritual exists AND hasn't been triggered yet
    if (ritual.willTriggerOnRound === currentRound && isLampmasterTurn && ritual.willTriggerOnRound !== null) {
      console.log('⚔️ Time to apply Sword of Light!');
      
      // Apply the ultimate
      handleApplySwordOfLight();
      
      // The handleApplySwordOfLight function should handle clearing the ritual
    }
  }, [session?.lampmasterRitual, currentTurnEntry, activeEnemy, sessionId]);

  // Get valid targets (player characters)
  const getValidTargets = () => {
    if (!activeEnemy || !session) return [];
    
    let rangeValue = 5;
    if (selectedAbility) {
      if (selectedAbility.reach) {
        rangeValue = selectedAbility.reach;
      } else if (selectedAbility.range) {
        const parsed = parseInt(selectedAbility.range);
        if (!isNaN(parsed)) {
          rangeValue = parsed;
        }
      }
    }
    
    return Object.values(session.tokens).filter(token => {
      if (token.type !== 'player') return false;
      if ((token.hp || 0) <= 0) return false;
      
      const distance = Math.max(
        Math.abs(activeEnemy.position.x - token.position.x),
        Math.abs(activeEnemy.position.y - token.position.y)
      ) * 5;
      
      return distance <= rangeValue;
    }) as BattleToken[];
  };
    
  // Calculate distance for display
  const calculateDistance = (enemy: BattleToken, target: BattleToken) => {
    return Math.max(
      Math.abs(enemy.position.x - target.position.x),
      Math.abs(enemy.position.y - target.position.y)
    ) * 5;
  };
  
  // Roll damage based on damage string
  const rollDamage = (damageString: string): number => {
    const fixedDamage = parseInt(damageString);
    if (!isNaN(fixedDamage)) {
      return fixedDamage;
    }
    
    const match = damageString.match(/(\d+)d(\d+)([+-]\d+)?/);
    if (!match) return 5;
    
    const numDice = parseInt(match[1]);
    const diceSize = parseInt(match[2]);
    const modifier = match[3] ? parseInt(match[3]) : 0;
    
    const averageRoll = ((diceSize + 1) / 2) * numDice;
    return Math.floor(averageRoll + modifier);
  };
  
  const handleConfirmAttack = async () => {
  if (!selectedAbility || !selectedTarget || !acRoll || !activeEnemy || !session) return;
  
  setIsAttacking(true);
  
  try {
    const target = session.tokens[selectedTarget];
    if (!target) return;
    
    const totalRoll = parseInt(acRoll) + (selectedAbility.toHit || 0);
    const hit = totalRoll >= (target.ac || 10);
    let rangeValue = 5;
    if (selectedAbility.reach) {
      rangeValue = selectedAbility.reach;
    } else if (selectedAbility.range) {
      const parsed = parseInt(selectedAbility.range);
      if (!isNaN(parsed)) {
        rangeValue = parsed;
      }
    }
  
    const action: GMCombatAction = {
      id: `enemy-attack-${Date.now()}`,
      type: 'attack',
      playerId: activeEnemy.id,
      playerName: activeEnemy.name,
      targetId: selectedTarget,
      targetName: target.name,
      sourcePosition: activeEnemy.position,
      range: rangeValue,
      timestamp: new Date(),
      resolved: false,
      hit,
      acRoll: totalRoll,
      abilityName: selectedAbility.name,
      needsDamageInput: false,
      damageApplied: false
    };
    
    await FirestoreService.addCombatAction(sessionId || '', action);
    
    if (hit) {
      const damage = rollDamage(selectedAbility.damage);
      
      const session = await FirestoreService.getBattleSession(sessionId || '');
      if (!session) return;
      
      const redirectResult = await ProtectionService.redirectDamage(
        sessionId || '',
        selectedTarget,
        damage
      );
 
      let actualTargetId = selectedTarget;
      let actualTargetName = target.name;
      
      if (redirectResult?.redirected) {
        actualTargetId = redirectResult.newTargetId;
        actualTargetName = redirectResult.protectorName;
        console.log(`🛡️ PROTECTION: ${actualTargetName} intercepts ${damage} damage for ${target.name}!`);
      }
      
      const actualTarget = session.tokens[actualTargetId];
      if (actualTarget) {
        const newHP = Math.max(0, (actualTarget.hp || 0) - damage);
        
        await FirestoreService.updateBattleSession(sessionId || '', {
          [`tokens.${actualTargetId}.hp`]: newHP,
          updatedAt: new Date()
        });
        
        if (actualTarget.characterId) {
          await FirestoreService.updateCharacterHP(actualTarget.characterId, newHP);
        }
      }
      
      console.log(`💥 ${activeEnemy.name} dealt ${damage} damage to ${actualTargetName}`);
    }
    
    // Clear selection
    setSelectedAbility(null);
    setSelectedTarget('');
    setACRoll('');
    
    // ✅ NEW LOGIC: Check if this is the Lampmaster
    if (isLampmaster(activeEnemy)) {
      // Lampmaster used their regular action, but turn doesn't end yet
      setHasUsedRegularAction(true);
      console.log('⚔️ Lampmaster used regular action - bonus action still available');
      // DON'T call nextTurn() - Lampmaster can still use bonus action
    } else {
      // For all other enemies, proceed to next enemy or end turn as normal
      if (currentEnemyIndex < enemyGroup.length - 1) {
        setCurrentEnemyIndex(currentEnemyIndex + 1);
      } else {
        await nextTurn();
      }
    }
    
  } catch (error) {
    console.error('Failed to execute attack:', error);
  } finally {
    setIsAttacking(false);
  }
};

  
  // Skip current enemy's turn
  const handleSkipEnemy = async () => {
    if (currentEnemyIndex < enemyGroup.length - 1) {
      setCurrentEnemyIndex(prev => prev + 1);
    } else {
      await nextTurn();
    }
  };

  // Reset enemy index when turn changes
  useEffect(() => {
    setCurrentEnemyIndex(0);
  }, [currentTurnEntry?.id]);

  // Process passive abilities
  useEffect(() => {
    const processPassives = async () => {
      if (!activeEnemy || !sessionId || !currentTurnEntry) return;
      if (currentTurnEntry.type !== 'enemy' || !session?.combatState?.isActive) return;
      
      let enemyType = '';
      if (activeEnemy.id.startsWith('enemy-')) {
        const parts = activeEnemy.id.split('-');
        if (parts.length >= 2) {
          enemyType = parts[1];
        }
      }
      
      if (!enemyType) {
        enemyType = activeEnemy.name.toLowerCase().replace(/\s+/g, '_');
      }
      
      console.log(`⚡ Processing passive abilities for ${activeEnemy.name} (${enemyType})`);
      
      try {
        await PassiveEnemyAbilityService.processPassiveAbilities(
          sessionId,
          activeEnemy.id,
          enemyType
        );
      } catch (error) {
        console.error('Failed to process passive abilities:', error);
      }
    };

    processPassives();
  }, [activeEnemy?.id, currentTurnEntry?.id, session?.combatState?.isActive, sessionId]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading enemy data..." />
      </div>
    );
  }
  
  // Error state
  if (error || !session) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <p className="text-red-400">Failed to load enemy view</p>
        </div>
      </div>
    );
  }
  
  // Not enemy turn
  if (!currentEnemy || currentTurnEntry?.type !== 'enemy') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <p className="text-yellow-400 text-xl mb-4">Not an enemy's turn</p>
          <p className="text-gray-400">
            Current turn: {currentTurnEntry?.name || 'None'}
          </p>
        </div>
      </div>
    );
  }
  
  // No enemies left
  if (enemyGroup.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <p className="text-red-400">All enemies of this type are defeated</p>
          <button
            onClick={nextTurn}
            className="mt-4 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
          >
            End Turn
          </button>
        </div>
      </div>
    );
  }
  
  const validTargets = getValidTargets();
  const enemySpeed = currentEnemy.data?.speed || 30;
  const enemyAttacks = currentEnemy.data?.attacks || [];

  if (!activeEnemy && enemyGroup.length > 0) {
    setCurrentEnemyIndex(0);
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading enemy..." />
      </div>
    );
  }

  // Main render
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-red-900 bg-opacity-50 rounded-lg p-4 mb-4 border-2 border-red-600">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-red-400">
              {activeEnemy.name} 
              {enemyGroup.length > 1 && ` (${currentEnemyIndex + 1}/${enemyGroup.length})`}
            </h1>
            <div className="text-sm text-gray-400">
              Enemy Turn
            </div>
          </div>
        </div>
        
        {/* Enemy Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center text-red-400 mb-2">
              <Heart className="w-5 h-5 mr-2" />
              <span className="font-bold">HP</span>
            </div>
            <div className="text-2xl font-bold">
              {activeEnemy.hp}/{activeEnemy.maxHp}
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center text-blue-400 mb-2">
              <Shield className="w-5 h-5 mr-2" />
              <span className="font-bold">AC</span>
            </div>
            <div className="text-2xl font-bold">{activeEnemy.ac}</div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center text-green-400 mb-2">
              <Move className="w-5 h-5 mr-2" />
              <span className="font-bold">Speed</span>
            </div>
            <div className="text-2xl font-bold">{enemySpeed}ft</div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center text-yellow-400 mb-2">
              <Target className="w-5 h-5 mr-2" />
              <span className="font-bold">Position</span>
            </div>
            <div className="text-lg">
              ({activeEnemy.position.x}, {activeEnemy.position.y})
            </div>
          </div>
        </div>
        
        {/* Abilities/Attacks */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Swords className="w-5 h-5 mr-2" />
            Attacks & Abilities
          </h2>
          
          {enemyAttacks.length > 0 ? ( 
            <div className="grid gap-3">
              {enemyAttacks.map((attack: EnemyAttack) => {
                // Check if this is Lampmaster and if Sword of Light should be hidden
                const isSwordOfLight = attack.name === 'Sword of Light';
                const shouldHideButton = isLampmaster(activeEnemy) && isSwordOfLight;
                
                // Disable regular abilities if Lampmaster has already used their regular action
                const isRegularAbilityDisabled = isLampmaster(activeEnemy) && 
                                                  hasUsedRegularAction && 
                                                  !isSwordOfLight;
                
                if (shouldHideButton) return null; // Don't show Sword of Light in regular abilities
                
                return (
                  <button
                    key={attack.name}
                    onClick={() => handleAbilitySelect(attack)}
                    disabled={isAttacking || isRegularAbilityDisabled}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      selectedAbility?.name === attack.name
                        ? 'border-red-500 bg-red-900 bg-opacity-30'
                        : isRegularAbilityDisabled
                        ? 'border-gray-700 bg-gray-800 opacity-50 cursor-not-allowed'
                        : 'border-gray-600 bg-gray-700 hover:border-red-600'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-lg">{attack.name}</div>
                        <div className="text-sm text-gray-400 mt-1">
                          Range: {attack.reach || attack.range || 5}ft | 
                          To Hit: +{attack.toHit} | 
                          Damage: {attack.damage}
                        </div>
                        {attack.recharge && (
                          <div className="text-sm text-yellow-400 mt-1">
                            Recharge: {attack.recharge}
                          </div>
                        )}
                        {isRegularAbilityDisabled && (
                          <div className="text-xs text-gray-500 mt-1">
                            (Regular action already used)
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}            
            </div>
          ) : (
            <div className="text-center text-gray-400 py-4">
              No attack data available for this enemy
            </div>
          )}
        </div>
          {isLampmaster(activeEnemy) && (
            <div className="mt-4 p-4 bg-yellow-900 bg-opacity-30 rounded-lg border border-yellow-600">
              <h3 className="text-yellow-400 font-bold mb-2">Lampmaster Special</h3>
              
              {/* Action Economy Display */}
              <div className="mb-3 p-2 bg-black bg-opacity-30 rounded">
                <div className="text-xs text-yellow-300">
                  <div className="flex items-center justify-between">
                    <span>⚔️ Regular Action:</span>
                    <span className={hasUsedRegularAction ? 'text-green-400' : 'text-gray-400'}>
                      {hasUsedRegularAction ? '✓ Used' : 'Available'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span>🔮 Bonus Action (Ritual):</span>
                    <span className={hasUsedRegularAction ? 'text-gray-400' : 'text-yellow-400'}>
                      {hasUsedRegularAction ? 'Available' : 'Locked (use regular action first)'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Ritual Status */}
              {isRitualActive && (
                <div className="mb-3 p-3 bg-purple-900 bg-opacity-50 rounded">
                  <p className="text-purple-300 text-sm">
                    {isPlayingSequence 
                      ? '🔮 Memorize the lamp sequence...' 
                      : '⚔️ Players must attack lamps in order!'}
                  </p>
                  {ritualSequence.length > 0 && !isPlayingSequence && (
                    <p className="text-xs text-purple-400 mt-1">
                      Sequence length: {ritualSequence.length} lamps
                    </p>
                  )}
                </div>
              )}
              
              {/* Lamp Status */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[0, 1, 2, 3].map(index => {
                  const lamp = Object.values(session?.tokens || {}).find(t => 
                    t.id && t.id.includes(`lamp-${index}`)
                  );
                  return (
                    <div 
                      key={index}
                      className={`p-2 rounded text-center text-xs ${
                        lamp && lamp.hp && lamp.hp > 0 
                          ? 'bg-orange-800 text-orange-200' 
                          : 'bg-gray-800 text-gray-500'
                      }`}
                    >
                      <div>Lamp {index + 1}</div>
                      <div>{lamp ? (lamp.hp || 0) : 0}/{lamp ? (lamp.maxHp || 25) : 25}</div>
                    </div>
                  );
                })}
              </div>

              {/* Start Ritual Bonus Action Button */}
              {!isRitualActive && (
                <button
                  onClick={handleSwordOfLightRitual}
                  disabled={!hasUsedRegularAction || isPlayingSequence}
                  className={`w-full p-3 rounded-lg font-bold shadow-lg transition-all ${
                    hasUsedRegularAction
                      ? 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white transform hover:scale-105'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  🔮 Start Ritual (Bonus Action)
                  {!hasUsedRegularAction && (
                    <div className="text-xs mt-1 opacity-75">
                      Must use regular action first
                    </div>
                  )}
                </button>
              )}
            </div>
          )}

        {/* Target Selection */}
        {selectedAbility && (
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-bold mb-3 flex items-center">
              <Target className="w-5 h-5 mr-2" />
              Select Target for {selectedAbility.name}
            </h3>
            
            {validTargets.length > 0 ? (
              <div className="space-y-2 mb-4">
                {validTargets.map(target => (
                  <button
                    key={target.id}
                    onClick={() => setSelectedTarget(target.id)}
                    className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                      selectedTarget === target.id
                        ? 'border-red-500 bg-red-900 bg-opacity-30'
                        : 'border-gray-600 bg-gray-700 hover:border-red-600'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-bold">
                          {target.id.startsWith('lamp-') && '🏮 '}
                          {target.name}
                        </div>
                        <div className="text-sm text-gray-400">
                          Distance: {calculateDistance(activeEnemy, target)}ft
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">AC: {target.ac}</div>
                        <div className="text-sm text-red-400">
                          {target.hp}/{target.maxHp} HP
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-yellow-400 text-center py-4">
                No valid targets in range ({selectedAbility?.reach || selectedAbility?.range || 5}ft)
              </p>
            )}
            
            {/* AC Roll Input */}
            {selectedTarget && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-bold mb-2">
                    Roll d20 (before modifiers):
                  </label>
                  <input
                    type="number"
                    value={acRoll}
                    onChange={(e) => setACRoll(e.target.value)}
                    placeholder="Enter d20 roll"
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg"
                    min="1"
                    max="20"
                  />
                  {acRoll && selectedAbility && (
                    <p className="text-sm text-gray-400 mt-1">
                      Total: {parseInt(acRoll) + (selectedAbility.toHit || 0)} 
                      (roll + {selectedAbility.toHit} modifier)
                    </p>
                  )}
                </div>
                
                <button
                  onClick={handleConfirmAttack}
                  disabled={!acRoll || isAttacking}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 p-3 rounded-lg font-bold transition-colors"
                >
                  {isAttacking ? 'Executing...' : 'Confirm Attack'}
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Skip Enemy Button */}
        <div className="flex gap-4">
          <button
            onClick={handleSkipEnemy}
            disabled={isAttacking}
            className="flex-1 bg-gray-700 hover:bg-gray-600 p-3 rounded-lg font-bold transition-colors"
          >
            Skip This Enemy
            {enemyGroup.length > 1 && currentEnemyIndex < enemyGroup.length - 1
              ? ' (Next Enemy)'
              : ' (End Turn)'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnemyView;