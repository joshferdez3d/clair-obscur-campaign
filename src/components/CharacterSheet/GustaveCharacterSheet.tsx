// src/components/CharacterSheet/GustaveCharacterSheet.tsx
import React, { useState } from 'react';
import { User, Sword, Zap, Target, Eye, Shield, Sparkles, Circle, Wrench } from 'lucide-react';
import { FirestoreService } from '../../services/firestoreService';
import { HPTracker } from './HPTracker';
import { StatDisplay } from './StatDisplay';
import { EnemyTargetingModal } from '../Combat/EnemyTargetingModal';
import type { Character, Ability, Position, BattleToken } from '../../types';
import { useUltimateVideo } from '../../hooks/useUltimateVideo';

interface GustaveCharacterSheetProps {
  character: Character;
  onHPChange: (delta: number) => void;
  onAbilityPointsChange: (delta: number) => void;
  onOverchargePointsChange: (delta: number) => void;
  onAbilityUse: (ability: Ability) => void;
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
  onTurretDeploy?: (position: { x: number; y: number }) => void;
  onEndTurn?: () => void;
  onCancelTargeting?: () => void;
  hasActedThisTurn?: boolean;
  overchargePoints?: number;

  // Needed for Overcharge Burst + popup writing
  sessionId?: string;
  allTokens?: BattleToken[];
  session?: any; // Or use your specific session type

  activeTurretId: string | null;          // ID of currently active turret
  turretsDeployedThisBattle: number;      // Total turrets deployed this battle (max 2)
  onSelfDestructTurret?: (turretId: string) => void;  // Self destruct callback
}

export function GustaveCharacterSheet({
  character,
  onHPChange,
  onAbilityPointsChange,
  onOverchargePointsChange,
  onAbilityUse,
  isLoading = false,
  isMyTurn = false,
  combatActive = false,
  availableEnemies = [],
  playerPosition = { x: 0, y: 0 },
  onTargetSelect,
  onTurretDeploy,
  onEndTurn,
  onCancelTargeting,
  hasActedThisTurn = false,
  overchargePoints = 0,
  sessionId = 'test-session',
  allTokens = [],
  session,
  activeTurretId,
  turretsDeployedThisBattle,
  onSelfDestructTurret,
}: GustaveCharacterSheetProps) {
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [acRoll, setACRoll] = useState<string>('');
  const { triggerUltimate } = useUltimateVideo(sessionId || 'test-session');
  const [showTargetingModal, setShowTargetingModal] = useState(false);

  const [selectedAction, setSelectedAction] = useState<{
    type: 'melee' | 'ranged' | 'ability';
    id: string;
    name: string;
    description: string;
    damage?: string;
    cost?: number;
  } | null>(null);

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

  const getCharacterGradient = () => 'bg-gradient-to-br from-red-600 to-red-800';

  const calculateDistance = (pos1: { x: number; y: number }, pos2: { x: number; y: number }): number => {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    return Math.max(dx, dy) * 5;
  };

  const applyRangePenalty = (baseAC: number, distance: number): number => {
    if (distance <= 20) return baseAC;
    const extraDistance = distance - 20;
    const penalty = Math.floor(extraDistance / 5) * 2;
    return Math.max(1, baseAC - penalty);
  };

  const getActionRange = (actionType: string, abilityId?: string): number => {
    if (actionType === 'ranged') return 999;
    if (actionType === 'melee') return 5;
    if (abilityId === 'prosthetic_strike') return 5;
    if (abilityId === 'deploy_turret') return 10;
    return 5;
  };

  const getValidTargets = (actionRange: number, actionType: string) => {
    if (actionType === 'ranged') {
      return availableEnemies;
    }
    return availableEnemies.filter((enemy) => {
      const distance = calculateDistance(playerPosition, enemy.position);
      return distance <= actionRange;
    });
  };

  const handleActionSelect = (action: any) => {
    if (hasActedThisTurn) return;

    if (action.type === 'ability' && action.cost) {
      const currentPoints = character.charges || 0;
      if (action.cost > currentPoints) {
        alert(`Not enough ability points! Need ${action.cost}, have ${currentPoints}`);
        return;
      }
    }

    if (action.id === 'deploy_turret') {
      if (activeTurretId) {
        alert('A turret is already deployed! Self destruct it first.');
        return;
      }
      if (turretsDeployedThisBattle >= 2) {
        alert('Maximum 2 turrets per battle reached!');
        return;
      }
    }

    if (action.id === 'overcharge_burst' && overchargePoints < 3) {
      alert(`Need 3 Overcharge points for ultimate! Currently have ${overchargePoints}`);
      return;
    }

    setSelectedAction(action);
    setSelectedTarget('');
    setACRoll('');
  };

  const handleConfirmAction = async () => {
    if (!selectedAction) return;

    if (sessionId) {
      FirestoreService.clearTargetingState(sessionId);
    }

    if (selectedAction.id === 'deploy_turret') {
      try {
        await FirestoreService.createTurretPlacementAction(sessionId, {
          playerId: character.id,
          playerPosition,
          turretName: "Gustave's Turret"
        });

        if (onTargetSelect) {
          onTargetSelect('action_taken', 0, 'ability', 'deploy_turret');
        }

        onAbilityPointsChange?.(-3);
        
        console.log('Turret placement action created for GM');
      } catch (error) {
        console.error('Failed to create turret placement action:', error);
        alert('Failed to create turret placement action. Please try again.');
      }
      
      setSelectedAction(null);
      return;
    }

    if (selectedAction.id === 'self_destruct_turret' && activeTurretId) {
      try {
        const turret = allTokens.find(t => t.id === activeTurretId);
        if (!turret) {
          alert('Turret not found!');
          setSelectedAction(null);
          return;
        }

        await FirestoreService.createSelfDestructAction(sessionId, {
          playerId: character.id,
          turretId: activeTurretId,
          turretPosition: turret.position
        });

        if (onTargetSelect) {
          onTargetSelect('action_taken', 0, 'ability', 'self_destruct_turret');
        }

        console.log('Turret self destruct initiated');
      } catch (error) {
        console.error('Failed to self destruct turret:', error);
        alert('Failed to self destruct turret. Please try again.');
      }
      
      setSelectedAction(null);
      return;
    }

    if (selectedAction.id === 'leaders_sacrifice') {
      try {
        await FirestoreService.createLeadersSacrificePAction(sessionId, {
          playerId: character.id,
          playerName: character.name,
          currentRound: session?.combatState?.round || 1
        });

        if (onTargetSelect) {
          onTargetSelect('action_taken', 0, 'ability', 'leaders_sacrifice');
        }

        onAbilityPointsChange?.(-1);
        
        if (onEndTurn) {
          onEndTurn();
        }
        
        console.log("Leader's Sacrifice activated - turn ended");
      } catch (error) {
        console.error("Failed to activate Leader's Sacrifice:", error);
        alert("Failed to activate Leader's Sacrifice. Please try again.");
      }
      
      setSelectedAction(null);
      return;
    }

    if (selectedAction.id === 'overcharge_burst') {
      console.log('🚀 Starting Overcharge Burst handling...');

      try {
        await triggerUltimate('gustave', 'Overcharge Burst');
      } catch (error) {
        console.error('Failed to trigger ultimate video:', error);
      }

      const enemies = allTokens.filter((t) => t.type === 'enemy' && (t.hp || 0) > 0);
      const activeTurrets = allTokens.filter(
        (t) => t.type === 'npc' && (t.hp || 0) > 0 && /turret/i.test(t.name)
      );

      const affected = new Map<string, BattleToken>();
      enemies.forEach((enemy) => {
        const inBurst = calculateDistance(playerPosition, enemy.position) <= 30;
        const nearTurret =
          !inBurst &&
          activeTurrets.some((turret) => calculateDistance(turret.position, enemy.position) <= 5);
        if (inBurst || nearTurret) {
          affected.set(enemy.id, enemy);
        }
      });

      const targets = Array.from(affected.values());
      console.log('🎯 Found targets:', targets.length);

      if (targets.length === 0) {
        alert('No enemies in range of Overcharge Burst!');
        setSelectedAction(null);
        return;
      }

      if (onTargetSelect) {
        onTargetSelect('action_taken', 999, 'ability', 'overcharge_burst');
      }

      try {
        await FirestoreService.createAoEAction(sessionId, {
          playerId: character.id,
          abilityName: 'Overcharge Burst (6d6 lightning)',
          targetIds: targets.map((t) => t.id),
          targetNames: targets.map((t) => t.name),
          center: playerPosition,
          radius: 30,
          acRoll: 999,
        });

        onOverchargePointsChange?.(-3);

        console.log(`Overcharge Burst created AoE popup for ${targets.length} target(s).`);
      } catch (e) {
        console.error('Failed to create Overcharge Burst AoE action:', e);
        alert('Failed to create Overcharge Burst action. Please try again.');
        if (onTargetSelect) {
          onTargetSelect('action_failed', 0, 'ability', 'overcharge_burst');
        }
      }

      setSelectedAction(null);
      setSelectedTarget('');
      setACRoll('');
      return;
    }

    if (selectedTarget && acRoll && onTargetSelect) {
      let finalAC = parseInt(acRoll, 10);

      if (selectedAction.type === 'ranged') {
        const enemy = availableEnemies.find((e) => e.id === selectedTarget);
        if (enemy) {
          const distance = calculateDistance(playerPosition, enemy.position);
          finalAC = applyRangePenalty(finalAC, distance);
        }
      }

      onTargetSelect(selectedTarget, finalAC, selectedAction.type, selectedAction.id);

      if (selectedAction.type === 'ability' && selectedAction.cost) {
        onAbilityPointsChange?.(-selectedAction.cost);
      }

      setSelectedAction(null);
      setSelectedTarget('');
      setACRoll('');
    }
  };

  const handleCancelAction = () => {
    setSelectedAction(null);
    setSelectedTarget('');
    setACRoll('');
    setShowTargetingModal(false);
    onCancelTargeting?.();
  };

  const abilityPoints = character.charges || 0;

  const basicActions = [
    {
      type: 'melee' as const,
      id: 'sword_slash',
      name: 'Sword Slash',
      description: 'Melee weapon attack with sword',
      damage: '1d8 + STR slashing',
      icon: Sword,
      range: '5ft',
    },
    {
      type: 'ranged' as const,
      id: 'pistol_shot',
      name: 'Pistol Shot',
      description: 'Ranged attack with pistol. No overcharge gain.',
      damage: '1d10 + DEX piercing',
      icon: Circle,
      range: 'Unlimited',
    },
  ];

  const abilities = [
    {
      type: 'ability' as const,
      id: 'prosthetic_strike',
      name: 'Prosthetic Strike',
      description: 'Energy blast from mechanical arm',
      damage: '1d10 bludgeoning',
      cost: 2,
      range: '5ft',
    },
    {
      type: 'ability' as const,
      id: 'leaders_sacrifice',
      name: "Leader's Sacrifice",
      description: 'End turn and protect an ally for 2 rounds',
      damage: 'Redirects ally damage to you',
      cost: 1,
      range: 'Any ally',
    },
    activeTurretId 
    ? {
        type: 'ability' as const,
        id: 'self_destruct_turret',
        name: 'Self Destruct Turret',
        description: 'Destroy turret, damaging nearby enemies',
        damage: '2d6 fire (10ft radius)',
        cost: 0,
        range: '10ft AoE',
      }
    : {
        type: 'ability' as const,
        id: 'deploy_turret',
        name: turretsDeployedThisBattle >= 2 ? 'No Turrets Left' : 'Deploy Turret Prototype',
        description: turretsDeployedThisBattle >= 2 
          ? 'Maximum 2 turrets per battle' 
          : 'Place turret that attacks enemies or supports allies',
        damage: 'No direct damage',
        cost: 3,
        range: '5ft placement radius',
        disabled: turretsDeployedThisBattle >= 2
      }
  ];

  const ultimateAbility = {
    type: 'ability' as const,
    id: 'overcharge_burst',
    name: 'Overcharge Burst',
    description: 'Lightning explosion affecting all nearby units',
    damage: '6d6 lightning (30ft radius)',
    cost: 0,
    range: '30ft AoE',
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

        {/* Overcharge Points */}
        <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 mb-4 border border-yellow-600">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Zap className="w-6 h-6 text-yellow-500 mr-2" />
              <h3 className="font-display text-lg font-bold text-yellow-400">Overcharge</h3>
            </div>
            <div className="font-serif text-2xl font-bold text-yellow-50">{overchargePoints} / 3</div>
          </div>
          <div className="flex justify-center space-x-2 mb-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className={`w-5 h-5 rounded-full border-2 transition-all duration-300 ${
                  index < overchargePoints
                    ? 'bg-yellow-500 border-yellow-400 shadow-lg shadow-yellow-500/50'
                    : 'bg-clair-shadow-800 border-clair-shadow-400'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Combat Actions */}
        <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 border border-clair-gold-600 mb-6">
          <h3 className="font-display text-lg font-bold text-clair-gold-400 mb-3">Combat Actions</h3>

          {!selectedAction ? (
            <div className="space-y-3">
              {/* Basic Attacks */}
              <div>
                <h4 className="text-sm font-bold text-clair-gold-300 mb-2">Basic Attacks</h4>
                <div className="space-y-2">
                  {basicActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.id}
                        onClick={() => handleActionSelect(action)}
                        disabled={!isMyTurn || !combatActive || hasActedThisTurn}
                        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:opacity-50 p-3 rounded-lg transition-colors text-left text-white"
                      >
                        <div className="flex items-center">
                          <Icon className="w-4 h-4 mr-2" />
                          <span className="font-bold">{action.name}</span>
                          <span className="ml-2 text-xs bg-black bg-opacity-30 px-2 py-1 rounded">
                            {action.range}
                          </span>
                        </div>
                        <div className="text-sm opacity-90 mt-1">{action.description}</div>
                        <div className="text-xs text-clair-gold-200 mt-1">{action.damage}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Abilities */}
              <div>
                <h4 className="text-sm font-bold text-clair-gold-300 mb-2">Abilities</h4>
                <div className="space-y-2">
                  {abilities.map((ability) => (
                    <button
                      key={ability.id}
                      onClick={() => handleActionSelect(ability)}
                      disabled={!isMyTurn || !combatActive || abilityPoints < ability.cost || hasActedThisTurn}
                      className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:opacity-50 p-3 rounded-lg transition-colors text-left text-white"
                    >
                      <div className="flex items-center">
                        <Wrench className="w-4 h-4 mr-2" />
                        <span className="font-bold">{ability.name}</span>
                        <span className="ml-2 text-xs bg-black bg-opacity-30 px-2 py-1 rounded">
                          {ability.cost} pts
                        </span>
                      </div>
                      <div className="text-sm opacity-90 mt-1">{ability.description}</div>
                      <div className="text-xs text-clair-gold-200 mt-1">
                        {ability.damage} • Range: {ability.range}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ultimate */}
              {overchargePoints >= 3 && (
                <div>
                  <h4 className="text-sm font-bold text-yellow-300 mb-2">Ultimate</h4>
                  <button
                    onClick={() => handleActionSelect(ultimateAbility)}
                    disabled={!isMyTurn || !combatActive || hasActedThisTurn}
                    className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 disabled:bg-gray-600 disabled:opacity-50 p-3 rounded-lg transition-colors text-left text-white border-2 border-yellow-400"
                  >
                    <div className="flex items-center">
                      <Zap className="w-4 h-4 mr-2" />
                      <span className="font-bold">{ultimateAbility.name}</span>
                      <span className="ml-2 text-xs bg-black bg-opacity-30 px-2 py-1 rounded">ULTIMATE</span>
                    </div>
                    <div className="text-sm opacity-90 mt-1">{ultimateAbility.description}</div>
                    <div className="text-xs text-yellow-200 mt-1">{ultimateAbility.damage}</div>
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Target Selection / Special flows
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-clair-mystical-200">
                  <Target className="w-4 h-4 inline mr-2" />
                  {selectedAction.name}
                </h4>
                <button onClick={handleCancelAction} className="text-sm bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-white">
                  Cancel
                </button>
              </div>

              {selectedAction.id === 'deploy_turret' ? (
                <div className="space-y-3">
                  <div className="p-3 bg-orange-900 bg-opacity-30 rounded-lg">
                    <p className="text-orange-200 text-sm">
                      GM will click on the map to place your turret within 5ft of your position.
                    </p>
                    <p className="text-orange-300 text-xs mt-1">
                      Turrets deployed this battle: {turretsDeployedThisBattle}/2
                    </p>
                  </div>
                  <button 
                    onClick={handleConfirmAction} 
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white p-3 rounded-lg font-bold transition-colors"
                  >
                    Request Turret Deployment
                  </button>
                </div>
              ) : selectedAction.id === 'self_destruct_turret' ? (
                <div className="space-y-3">
                  <div className="p-3 bg-red-900 bg-opacity-30 rounded-lg">
                    <p className="text-red-200 text-sm">
                      Destroy your turret, dealing 2d6 fire damage to all enemies within 10ft.
                    </p>
                  </div>
                  <button 
                    onClick={handleConfirmAction} 
                    className="w-full bg-red-600 hover:bg-red-700 text-white p-3 rounded-lg font-bold transition-colors"
                  >
                    Self Destruct Turret
                  </button>
                </div>
              ) : selectedAction.id === 'leaders_sacrifice' ? (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-900 bg-opacity-30 rounded-lg">
                    <p className="text-blue-200 text-sm font-bold mb-2">
                      Leader's Sacrifice - Protection Protocol
                    </p>
                    <p className="text-blue-300 text-sm mb-2">
                      • Your turn will end immediately
                    </p>
                    <p className="text-blue-300 text-sm mb-2">
                      • Call out to the GM which ally you want to protect
                    </p>
                    <p className="text-blue-300 text-sm">
                      • For the next 2 rounds, you will take damage meant for that ally
                    </p>
                  </div>
                  <button 
                    onClick={handleConfirmAction} 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-bold transition-colors"
                  >
                    Activate Leader's Sacrifice
                  </button>
                </div>
              ) : selectedAction.id === 'overcharge_burst' ? (
                <div className="space-y-3">
                  <div className="p-3 bg-yellow-900 bg-opacity-30 rounded-lg">
                    <p className="text-yellow-200 text-sm">
                      Area of effect ultimate! Affects all enemies within 30ft of you and 5ft of your turrets.
                    </p>
                  </div>
                  <button
                    onClick={handleConfirmAction}
                    className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white p-3 rounded-lg font-bold transition-colors"
                  >
                    Unleash Overcharge Burst!
                  </button>
                </div>
              ) : (
                <>
                  {/* NEW: Modal Trigger for Enemy Selection */}
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

                    {selectedTarget && (
                      <div className="space-y-3">
                        {/* AC Roll Input */}
                        <div>
                          <label className="block text-sm font-bold text-clair-gold-300 mb-2">
                            Roll d20 + modifiers:
                          </label>
                          <input
                            type="number"
                            value={acRoll}
                            onChange={(e) => setACRoll(e.target.value)}
                            className="w-full p-3 bg-clair-shadow-800 border border-clair-shadow-400 rounded-lg text-clair-gold-200"
                            placeholder="Enter your attack roll"
                            min="1"
                            max="30"
                          />
                        </div>
                        
                        <button
                          onClick={handleConfirmAction}
                          disabled={!acRoll}
                          className="w-full p-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-bold"
                        >
                          Confirm Attack
                        </button>
                      </div>
                    )}
                  </div>
                </>
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
          <div className="mt-4 p-3 bg-clair-gold-900 bg-opacity-20 rounded-lg border border-clair-gold-600">
            <h4 className="font-serif font-bold text-clair-gold-400 text-sm mb-2">Combat Tips:</h4>
            <ul className="text-xs text-clair-gold-300 space-y-1">
              <li>• Melee attacks build both Ability and Overcharge points</li>
              <li>• Pistol shots have unlimited range but no Overcharge gain</li>
              <li>• Ranged attacks get -2 AC penalty per 5ft beyond 20ft</li>
              <li>• Deploy turrets strategically for area control</li>
              <li>• Save 3 Overcharge points for devastating AoE ultimate</li>
              <li>• Overcharge Burst hits all enemies within 30ft + 5ft of turrets</li>
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
          setShowTargetingModal(false);
        }}
        selectedEnemyId={selectedTarget}
        abilityName={selectedAction?.name}
        abilityRange={getActionRange(selectedAction?.type || '', selectedAction?.id)}
      />
    </div>
  );
}