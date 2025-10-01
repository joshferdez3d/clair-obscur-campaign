import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, Heart, Swords, Target, Move, ArrowRight } from 'lucide-react';
import { useCombat } from '../hooks/useCombat';
import { FirestoreService } from '../services/firestoreService';
import { BattleToken, GMCombatAction } from '../types';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { enemies } from '../data/enemies'; // FIXED: Use 'enemies' not 'enemiesData'
import type { EnemyData } from '../types';
import { useBrowserWarning } from '../hooks/useBrowserWarning';
import { ProtectionService } from '../services/ProtectionService';

interface EnemyAttack {
  name: string;
  toHit: number;
  damage: string;
  reach?: number;
  range?: string;  // CHANGED: from number to string
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
  
  // Get current enemy based on turn
  const currentTurnEntry = session?.combatState?.initiativeOrder.find(
    e => e.id === session?.combatState?.currentTurn
  );

  useBrowserWarning({
    enabled: true,
    message: '⚠️ Warning: You are controlling enemies in combat. Leaving will disrupt the battle. Are you sure?'
  });
  
  // Get the current enemy token and data
  const getCurrentEnemy = () => {
    if (!currentTurnEntry || currentTurnEntry.type !== 'enemy') return null;
    
    // For enemy groups, get the first alive enemy of that type
    const enemyName = currentTurnEntry.name.replace(/ \(x\d+\)/, '');
    const enemyToken = Object.values(session?.tokens || {}).find(
      token => token.type === 'enemy' && 
               token.name === enemyName && 
               (token.hp || 0) > 0
    ) as BattleToken | undefined;
    
    if (!enemyToken) return null;
    
    // Get enemy data from session's enemyData or from the enemies object
    let enemyData: EnemyData | undefined;
    
    // First try to get from session's enemy data
    if (session?.enemyData) {
      // Find any enemy token with this name and get its data
      const enemyDataEntry = Object.values(session.enemyData).find(
        (data: any) => data.name === enemyName
      ) as EnemyData | undefined;
      enemyData = enemyDataEntry;
    }
    
    // If not found in session, try the enemies template object
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
  
  // Get valid targets (player characters)
  // Get valid targets (player characters)
  const getValidTargets = () => {
    if (!activeEnemy || !session) return [];
    
    // Parse range from string if needed (e.g., "50ft" -> 50)
    let rangeValue = 5; // default
    if (selectedAbility) {
      if (selectedAbility.reach) {
        rangeValue = selectedAbility.reach;
      } else if (selectedAbility.range) {
        // Parse string range like "50ft" to number
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
  
  // Roll damage based on damage string (e.g., "1d8+3")
  const rollDamage = (damageString: string): number => {
    // Parse damage string like "1d8+3" or "2d6+2"
    const match = damageString.match(/(\d+)d(\d+)([+-]\d+)?/);
    if (!match) return 0;
    
    const numDice = parseInt(match[1]);
    const diceSize = parseInt(match[2]);
    const modifier = match[3] ? parseInt(match[3]) : 0;
    
    let total = modifier;
    for (let i = 0; i < numDice; i++) {
      total += Math.floor(Math.random() * diceSize) + 1;
    }
    
    return Math.max(1, total); // Minimum 1 damage
  };
  
  // Handle attack confirmation
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
    
      // Create combat action
      const action: GMCombatAction = {
        id: `enemy-attack-${Date.now()}`,
        type: 'attack',
        playerId: activeEnemy.id,
        playerName: activeEnemy.name,
        targetId: selectedTarget,
        targetName: target.name,
        sourcePosition: activeEnemy.position,
        range: rangeValue,  // Use parsed range value
        timestamp: new Date(),
        resolved: false,
        hit,
        acRoll: totalRoll,
        abilityName: selectedAbility.name,
        needsDamageInput: false,
        damageApplied: false
      };
      
      // Add to pending actions
      await FirestoreService.addCombatAction(sessionId || '', action);
      
    // If hit, automatically roll and apply damage
    if (hit) {
      const damage = rollDamage(selectedAbility.damage);
      
      // ⚠️ CRITICAL: Check for protection before applying damage
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
      
      // Apply damage to actual target (original or protector)
      const actualTarget = session.tokens[actualTargetId];
      if (actualTarget) {
        const newHP = Math.max(0, (actualTarget.hp || 0) - damage);
        
        await FirestoreService.updateBattleSession(sessionId || '', {
          [`tokens.${actualTargetId}.hp`]: newHP,
          updatedAt: new Date()
        });
        
        // Update character HP if it's a player token
        if (actualTarget.characterId) {
          await FirestoreService.updateCharacterHP(actualTarget.characterId, newHP);
        }
      }
      
      console.log(`💥 ${activeEnemy.name} dealt ${damage} damage to ${actualTargetName}`);
    }
      
      // Reset selections
      setSelectedAbility(null);
      setSelectedTarget('');
      setACRoll('');
      
      // Move to next enemy in group or end turn
      if (currentEnemyIndex < enemyGroup.length - 1) {
        setCurrentEnemyIndex(currentEnemyIndex + 1);
      } else {
        // All enemies in group have acted, advance turn
        await nextTurn();
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
      // Move to next enemy in the group
      setCurrentEnemyIndex(prev => prev + 1);
    } else {
      // All enemies done, advance turn
      // Don't increment index, just advance turn
      await nextTurn();
    }
  };

  useEffect(() => {
    // Reset enemy index when turn changes
    setCurrentEnemyIndex(0);
  }, [currentTurnEntry?.id]);

    
  // Loading and error states
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading enemy data..." />
      </div>
    );
  }
  
  if (error || !session) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <p className="text-red-400">Failed to load enemy view</p>
        </div>
      </div>
    );
  }
  
  // Check if it's actually an enemy's turn
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
  
  // No enemies left in group
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
    // If we somehow have an invalid index but enemies exist, reset to 0
    setCurrentEnemyIndex(0);
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading enemy..." />
      </div>
    );
  }

  
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
              {enemyAttacks.map((attack: EnemyAttack) => (
                <button
                  key={attack.name}
                  onClick={() => setSelectedAbility(attack)}
                  disabled={isAttacking}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    selectedAbility?.name === attack.name
                      ? 'border-red-500 bg-red-900 bg-opacity-30'
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
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-4">
              No attack data available for this enemy
            </div>
          )}
        </div>
        
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
                        <div className="font-bold">{target.name}</div>
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
                No valid targets in range ({selectedAbility.reach || selectedAbility.range || 5}ft)
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
                  {acRoll && (
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