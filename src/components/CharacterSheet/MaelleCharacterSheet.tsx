// src/components/CharacterSheet/MaelleCharacterSheet.tsx - STREAMLINED VERSION  
import React, { useState, useEffect } from 'react';
import { User, Sword, Eye, Target, Zap, Move, Shield, Sparkles, Circle, Heart } from 'lucide-react';
import { HPTracker } from './HPTracker';
import { StatDisplay } from './StatDisplay';
import { EnemyTargetingModal } from '../Combat/EnemyTargetingModal';
import type { Character, BattleToken, Position } from '../../types';
import { useUltimateVideo } from '../../hooks/useUltimateVideo';
import { FirestoreService } from '../../services/firestoreService';
import { Package } from 'lucide-react';
import { InventoryModal } from './InventoryModal';
import { InventoryService } from '../../services/inventoryService';
import type { InventoryItem } from '../../types';
import { useRealtimeInventory } from '../../hooks/useRealtimeInventory';
import { MovementInput } from '../Combat/MovementInput';
import { MovementService } from '../../services/movementService'
interface MaelleCharacterSheetProps {
  character: Character;
  onHPChange: (delta: number) => void;
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
  onTargetSelect?: (targetId: string, acRoll: number, type?: string, abilityId?: string) => void;
  onEndTurn?: () => void;
  onCancelTargeting?: () => void;
  // REMOVED: hasActedThisTurn - no longer needed
  sessionId?: string;
  // REMOVED: onActionComplete - no longer needed
  session?: any;
  allTokens?: BattleToken[];
  // Persistent state props
  afterimageStacks: number;
  setAfterimageStacks: (stacks: number) => Promise<void>;
  phantomStrikeAvailable: boolean;
  setPhantomStrikeAvailable: (available: boolean) => Promise<void>;
  abilityPoints: number;
  setAbilityPoints: (points: number) => Promise<void>;
}

export function MaelleCharacterSheet({
  character,
  onHPChange,
  isLoading = false,
  isMyTurn = false,
  combatActive = false,
  availableEnemies = [],
  playerPosition = { x: 0, y: 0 },
  onTargetSelect,
  onEndTurn,
  onCancelTargeting,
  // REMOVED: hasActedThisTurn = false,
  sessionId,
  // REMOVED: onActionComplete,
  // Persistent state props
  session,
  allTokens = [],
  afterimageStacks,
  setAfterimageStacks,
  phantomStrikeAvailable,
  setPhantomStrikeAvailable,
  abilityPoints,
  setAbilityPoints,
}: MaelleCharacterSheetProps) {
  
  const [selectedAction, setSelectedAction] = useState<{
    type: 'basic' | 'ability' | 'ultimate';
    id: string;
    name: string;
    description: string;
    damage: string;
    cost?: number;
    needsTarget?: boolean;
  } | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [acRoll, setACRoll] = useState<string>('');
  const [showTargetingModal, setShowTargetingModal] = useState(false);
  const { triggerUltimate } = useUltimateVideo(sessionId || 'test-session');
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const { gold: goldAmount, inventory, loading: inventoryLoading } = useRealtimeInventory(character?.id || '');

  const handleOpenInventory = () => {
    setShowInventoryModal(true);
  };


  const playerToken = session?.tokens 
    ? Object.entries(session.tokens).find(([key, t]: [string, any]) => {
        console.log(`Checking token ${key}:`, {
          tokenCharacterId: t.characterId,
          tokenId: t.id,
          tokenName: t.name,
          tokenType: t.type,
        });
        
        // Try multiple matching strategies
        return t.characterId === character.id || 
               t.id === character.id ||
               key === character.id ||
               t.name?.toLowerCase() === character.name?.toLowerCase();
      })?.[1] as BattleToken
    : null;

  console.log('Player token result:', playerToken);

  const handleMovement = async (newPosition: Position): Promise<boolean> => {
    if (!sessionId || !playerToken) return false;
    
    return await MovementService.moveToken(sessionId, playerToken.id, newPosition);
  };

  
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

  // Calculate distance for range validation
  const calculateDistance = (pos1: { x: number; y: number }, pos2: { x: number; y: number }): number => {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    return Math.max(dx, dy) * 5;
  };

  // Get valid targets (Maelle's attacks are melee range)
  const getValidTargets = () => {
    return availableEnemies.filter(enemy => {
      const distance = calculateDistance(playerPosition, enemy.position);
      return distance <= 5; // Melee range
    });
  };

  // Handle action selection
  const handleActionSelect = (action: any) => {
    // REMOVED: hasActedThisTurn check

    // Check stack requirements for abilities
    if (action.cost && afterimageStacks < action.cost) {
      alert(`Not enough Afterimage stacks! Need ${action.cost}, have ${afterimageStacks}`);
      return;
    }

    // Check ultimate requirements
    if (action.type === 'ultimate') {
      if (afterimageStacks < 3) {
        alert('Need at least 3 Afterimage stacks to use Phantom Strike!');
        return;
      }
      if (!phantomStrikeAvailable) {
        alert('Phantom Strike already used this rest!');
        return;
      }
    }

    setSelectedAction(action);
    setSelectedTarget('');
    setACRoll('');
  };

  // Handle confirming action
  const handleConfirmAction = async () => {
    if (!selectedAction) return;

    if (sessionId) {
      FirestoreService.clearTargetingState(sessionId);
    }

    // Handle Phantom Strike (no targeting needed)
    if (selectedAction.type === 'ultimate') {
      const enemiesInRange = availableEnemies.filter(enemy => {
        const distance = calculateDistance(playerPosition, enemy.position);
        return distance <= 50;
      });

      if (enemiesInRange.length === 0) {
        alert('No enemies within 50ft for Phantom Strike!');
        return;
      }
      
      try {
        await triggerUltimate('maelle', 'Phantom Strike');
      } catch (error) {
        console.error('Failed to trigger ultimate video:', error);
      }
      
      await setPhantomStrikeAvailable(false);
      await setAfterimageStacks(0);
      
      const stacksRegained = Math.ceil(enemiesInRange.length / 2);
      setTimeout(async () => {
        await setAfterimageStacks(stacksRegained);
      }, 100);

      setSelectedAction(null);
      
      // STREAMLINED: Auto-end turn after ultimate
      if (onEndTurn) {
        onEndTurn();
      }
      return;
    }

    // Handle abilities that don't need targeting
    if (selectedAction.id === 'spectral_feint' || selectedAction.id === 'mirror_step') {
      if (selectedAction.cost) {
        const newStacks = Math.max(0, afterimageStacks - selectedAction.cost);
        await setAfterimageStacks(newStacks);
      }
      
      setSelectedAction(null);
      
      // STREAMLINED: Auto-end turn after ability
      if (onEndTurn) {
        onEndTurn();
      }
      return;
    }

    // Handle abilities that need targeting
    if (selectedAction.needsTarget && selectedTarget && acRoll) {
      if (onTargetSelect) {
        onTargetSelect(selectedTarget, parseInt(acRoll), selectedAction.type, selectedAction.id);
      }

      // Handle Afterimage stacks
      if (selectedAction.type === 'basic') {
        const enemy = availableEnemies.find(e => e.id === selectedTarget);
        const hit = parseInt(acRoll) >= (enemy?.ac || 10);
        if (hit) {
          const rollValue = parseInt(acRoll);
          const criticalHit = rollValue === 20;
          const stacksGained = criticalHit ? 2 : 1;
          const newStacks = Math.min(5, afterimageStacks + stacksGained);
          await setAfterimageStacks(newStacks);
        }
      } else if (selectedAction.cost) {
        const newStacks = Math.max(0, afterimageStacks - selectedAction.cost);
        await setAfterimageStacks(newStacks);
      }

      setSelectedAction(null);
      setSelectedTarget('');
      setACRoll('');
      setShowTargetingModal(false);
      
      // STREAMLINED: Auto-end turn after action
      if (onEndTurn) {
        onEndTurn();
      }
    }
  };

  const handleCancelAction = () => {
    setSelectedAction(null);
    setSelectedTarget('');
    setACRoll('');
    setShowTargetingModal(false);
    onCancelTargeting?.();
  };

  // Define Maelle's new abilities
  const basicAttack = {
    type: 'basic' as const,
    id: 'phantom_thrust',
    name: 'Phantom Thrust',
    description: 'Rapier attack that builds Afterimage stacks. Turn ends automatically.',
    damage: '1d8 + DEX piercing',
    needsTarget: true,
    icon: Sword,
    range: 'Melee (5ft)',
  };

  const abilities = [
    {
      type: 'ability' as const,
      id: 'spectral_feint',
      name: 'Spectral Feint',
      description: 'Mark target with disadvantage on attacks vs you. Turn ends automatically.',
      damage: 'Mark target (Bonus Action)',
      cost: 1,
      needsTarget: false,
      range: 'Reaction/Positioning',
    },
    {
      type: 'ability' as const,
      id: 'blade_flurry',
      name: 'Blade Flurry',
      description: '3 attacks, bonus damage on each hit after first. Turn ends automatically.',
      damage: '3 attacks, +1d4 per hit after 1st',
      cost: 2,
      needsTarget: true,
      range: 'Melee (5ft)',
    },
    {
      type: 'ability' as const,
      id: 'mirror_step',
      name: 'Mirror Step',
      description: 'Teleport to avoid attack (Reaction). Turn ends automatically.',
      damage: 'Avoid attack + teleport 15ft',
      cost: 1,
      needsTarget: false,
      range: 'Reaction',
    },
  ];

  const ultimateAbility = {
    type: 'ultimate' as const,
    id: 'phantom_strike',
    name: 'Phantom Strike',
    description: 'Teleport between all enemies within 50ft. Turn ends automatically.',
    damage: '2d6 + DEX per enemy, scaling',
    needsTarget: false,
  };

  return (
    <div className="min-h-screen bg-clair-shadow-900">
    {/* CHARACTER HEADER */}
    <div className="relative px-4 pt-6 pb-4 text-white bg-gradient-to-br from-clair-royal-600 to-clair-royal-800 shadow-shadow border-b border-clair-gold-600">
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
                style={{ imageRendering: 'crisp-edges' }}
              />
            </div>
          </div>
        </div>
      )}

        {/* REMOVED: Action Status display */}

        {/* STREAMLINED: Simple turn instruction */}
        {isMyTurn && combatActive && (
          <div className="mb-4 p-3 bg-clair-royal-900 bg-opacity-20 rounded-lg border border-clair-royal-600">
            <p className="text-clair-royal-200 text-sm font-bold">
              ⚡ Select any action below - your turn will end automatically after completion!
            </p>
          </div>
        )}

        {/* HP TRACKER */}
        <HPTracker
          currentHP={character.currentHP}
          maxHP={character.maxHP}
          onHPChange={onHPChange}
          isLoading={isLoading}
          showControls={false}
        />

        {/* ABILITY SCORES */}
        <StatDisplay stats={character.stats} />   

        <div className="mb-6">
          <button
            onClick={handleOpenInventory}
            className="w-full bg-clair-shadow-600 hover:bg-clair-shadow-500 border border-clair-gold-600 text-clair-gold-200 p-3 rounded-lg transition-colors flex items-center justify-center"
          >
            <Package className="w-5 h-5 mr-2" />
            <span className="font-serif font-bold">Inventory</span>
            {inventory.length > 0 && (
              <span className="ml-2 bg-clair-gold-600 text-clair-shadow-900 px-2 py-1 rounded-full text-xs font-bold">
                {inventory.length}
              </span>
            )}
          </button>
        </div>

        {/* Grid Movement Input */}
        {isMyTurn && playerToken && (
          <div className="mb-4">
            <MovementInput
              token={playerToken}
              currentPosition={playerToken.position}
              maxRange={MovementService.getMovementRange(character.name)}
              gridSize={{ width: 30, height: 20 }} // Or get from current map if available
              onMove={handleMovement}
              isMyTurn={isMyTurn}
              characterName={character.name}
            />
          </div>
        )}

        {/* AFTERIMAGE STACKS DISPLAY */}
        <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 border border-clair-royal-500 mb-4">
          <h3 className="font-display text-lg font-bold text-clair-royal-300 mb-3 flex items-center">
            <Sparkles className="w-5 h-5 mr-2" />
            Afterimage Stacks
          </h3>
          <div className="flex items-center justify-between">
            <div className="flex space-x-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                    i < afterimageStacks
                      ? 'bg-clair-royal-500 border-clair-royal-300 text-white'
                      : 'bg-clair-shadow-700 border-clair-shadow-500 text-gray-500'
                  }`}
                >
                  {i < afterimageStacks ? '✦' : '○'}
                </div>
              ))}
            </div>
            <div className="text-right">
              <div className="text-clair-royal-300 font-bold">{afterimageStacks}/5</div>
              <div className="text-xs text-clair-royal-400">
                {afterimageStacks < 5 ? 'Hit enemies to build' : 'Maximum reached!'}
              </div>
            </div>
          </div>
        </div>

        {/* COMBAT SECTION */}
        <div className="space-y-4 mb-6">
          {!selectedAction ? (
            /* Main Combat Panel */
            <div className="space-y-4">
              {/* Basic Attack */}
              <div>
                <h4 className="text-sm font-bold text-clair-royal-300 mb-2 flex items-center">
                  <Sword className="w-4 h-4 mr-2" />
                  Basic Attack
                </h4>
                <button
                  onClick={() => handleActionSelect(basicAttack)}
                  disabled={!isMyTurn || !combatActive}
                  className="w-full bg-clair-royal-600 hover:bg-clair-royal-700 disabled:bg-gray-600 disabled:opacity-50 p-3 rounded-lg transition-colors text-left text-white"
                >
                  <div className="flex items-center">
                    <Sword className="w-4 h-4 mr-2" />
                    <span className="font-bold">{basicAttack.name}</span>
                    <span className="ml-2 text-xs bg-black bg-opacity-30 px-2 py-1 rounded">
                      +1 STACK
                    </span>
                  </div>
                  <div className="text-sm opacity-90 mt-1">{basicAttack.description}</div>
                  <div className="text-xs text-clair-gold-200 mt-1">{basicAttack.damage}</div>
                </button>
              </div>

              {/* Abilities */}
              <div>
                <h4 className="text-sm font-bold text-clair-royal-300 mb-2 flex items-center">
                  <Zap className="w-4 h-4 mr-2" />
                  Phantom Techniques
                </h4>
                <div className="space-y-2">
                  {abilities.map((ability) => {
                    const canAfford = afterimageStacks >= (ability.cost || 0);
                    
                    return (
                      <button
                        key={ability.id}
                        onClick={() => handleActionSelect(ability)}
                        disabled={!isMyTurn || !combatActive || !canAfford}
                        className="w-full bg-clair-mystical-600 hover:bg-clair-mystical-700 disabled:bg-gray-600 disabled:opacity-50 p-3 rounded-lg transition-colors text-left text-white"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <Circle className="w-4 h-4 mr-2" />
                            <span className="font-bold">{ability.name}</span>
                          </div>
                          {ability.cost > 0 && (
                            <span className="text-xs bg-black bg-opacity-30 px-2 py-1 rounded">
                              {ability.cost} STACK{ability.cost > 1 ? 'S' : ''}
                            </span>
                          )}
                        </div>
                        <div className="text-sm opacity-90 mt-1">{ability.description}</div>
                        <div className="text-xs text-clair-gold-200 mt-1">{ability.damage}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ultimate */}
              <div>
                <h4 className="text-sm font-bold text-yellow-300 mb-2 flex items-center">
                  <Zap className="w-4 h-4 mr-2" />
                  Ultimate Technique
                </h4>
                <button
                  onClick={() => handleActionSelect(ultimateAbility)}
                  disabled={!isMyTurn || !combatActive || afterimageStacks < 3 || !phantomStrikeAvailable}
                  className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 disabled:bg-gray-600 disabled:opacity-50 p-3 rounded-lg transition-colors text-left text-white border-2 border-yellow-400"
                >
                  <div className="flex items-center">
                    <Move className="w-4 h-4 mr-2" />
                    <span className="font-bold">{ultimateAbility.name}</span>
                    <span className="ml-2 text-xs bg-black bg-opacity-30 px-2 py-1 rounded">
                      ULTIMATE
                    </span>
                  </div>
                  <div className="text-sm opacity-90 mt-1">{ultimateAbility.description}</div>
                  <div className="text-xs text-yellow-200 mt-1">{ultimateAbility.damage}</div>
                </button>
              </div>
            </div>
          ) : (
            /* Action Resolution */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-clair-royal-200">
                  <Target className="w-4 h-4 inline mr-2" />
                  {selectedAction.name}
                </h4>
                <button onClick={handleCancelAction} className="text-sm bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-white">
                  Cancel
                </button>
              </div>

              <div className="p-3 bg-clair-royal-900 bg-opacity-30 rounded-lg border border-clair-royal-600">
                <p className="text-clair-royal-200 text-sm">
                  ⚡ Turn will end automatically after this action
                </p>
              </div>

              {selectedAction.needsTarget ? (
                <>
                  {/* Modal Trigger for Enemy Selection */}
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
                          <label className="block text-sm font-bold text-clair-royal-300 mb-2">
                            Attack Roll (d20 + modifiers):
                          </label>
                          <input
                            type="number"
                            value={acRoll}
                            onChange={(e) => setACRoll(e.target.value)}
                            className="w-full bg-clair-shadow-700 border border-clair-royal-500 rounded-lg px-3 py-2 text-white"
                            placeholder="Enter your total attack roll"
                            min="1"
                            max="30"
                          />
                        </div>
                        
                        {/* Confirm Button */}
                        <button
                          onClick={handleConfirmAction}
                          disabled={!acRoll}
                          className="w-full bg-clair-royal-600 hover:bg-clair-royal-700 disabled:bg-gray-600 disabled:opacity-50 text-white p-3 rounded-lg font-bold transition-colors"
                        >
                          Execute {selectedAction.name}
                        </button>
                      </div>
                    )}
                  </div>

                  {getValidTargets().length === 0 && (
                    <div className="text-center text-clair-gold-400 py-4">
                      No enemies in melee range (5ft)
                    </div>
                  )}
                </>
              ) : (
                /* Non-targeting abilities */
                <div className="space-y-3">
                  <div className="p-3 bg-clair-royal-900 bg-opacity-30 rounded-lg">
                    <p className="text-clair-royal-200 text-sm">
                      {selectedAction.id === 'phantom_strike' 
                        ? `Will hit all enemies within 50ft. Damage scales with each enemy hit.`
                        : `${selectedAction.description} - No targeting required.`
                      }
                    </p>
                  </div>
                  <button
                    onClick={handleConfirmAction}
                    className="w-full bg-clair-royal-600 hover:bg-clair-royal-700 text-white p-3 rounded-lg font-bold transition-colors"
                  >
                    Use {selectedAction.name}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* REMOVED: End Turn button */}

          {/* Combat Tips */}
          <div className="mt-4 p-3 bg-clair-royal-900 bg-opacity-20 rounded-lg border border-clair-royal-600">
            <h4 className="font-serif font-bold text-clair-royal-400 text-sm mb-2">Phantom Blade Tips:</h4>
            <ul className="text-xs text-clair-royal-300 space-y-1">
              <li>⚡ Your turn ends automatically after any action</li>
              <li>• Build Afterimage stacks with successful attacks</li>
              <li>• Critical hits grant 2 stacks instead of 1</li>
              <li>• Spend stacks strategically for powerful abilities</li>
              <li>• Phantom Strike needs 3+ stacks and hits all enemies in 50ft</li>
              <li>• Use Mirror Step reactively to avoid big attacks</li>
              <li>• Spectral Feint gives you combat advantage</li>
              <li>• Maximum 5 Afterimage stacks at once</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Enemy Targeting Modal */}
      <EnemyTargetingModal
        isOpen={showTargetingModal}
        onClose={() => setShowTargetingModal(false)}
        enemies={getValidTargets()}
        playerPosition={playerPosition}
        sessionId={sessionId}
        playerId={character.id}
        onSelectEnemy={(enemy) => {
          setSelectedTarget(enemy.id);
        }}
        selectedEnemyId={selectedTarget}
        abilityName={selectedAction?.name}
        abilityRange={5}
      />

      <InventoryModal
        isOpen={showInventoryModal}
        characterName={character.name}
        inventory={inventory}
        goldAmount={goldAmount}
        isLoading={inventoryLoading}
        onClose={() => setShowInventoryModal(false)}
      />
    </div>
  );
}