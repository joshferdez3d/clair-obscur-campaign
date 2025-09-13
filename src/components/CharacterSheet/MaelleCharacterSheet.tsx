import React, { useState, useEffect } from 'react'; // Make sure useEffect is included
import { User, Sword, Eye, Target, Zap, Move, Shield, Sparkles, Circle, Heart } from 'lucide-react';
import { HPTracker } from './HPTracker';
import { StatDisplay } from './StatDisplay';
import { EnemyTargetingModal } from '../Combat/EnemyTargetingModal';
import type { Character } from '../../types/character';
import { useUltimateVideo } from '../../hooks/useUltimateVideo';
import { FirestoreService } from '../../services/firestoreService';
import { Package } from 'lucide-react'; // Add Package to your existing lucide imports
import { InventoryModal } from './InventoryModal'; // Add this import
import { InventoryService } from '../../services/inventoryService'; // Add this import
import type { InventoryItem } from '../../types'; // Add this import

interface MaelleCharacterSheetProps {
  character: Character;
  onHPChange: (delta: number) => void;
  onAbilityPointsChange: (delta: number) => void;
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
  hasActedThisTurn?: boolean;
  // New props specific to Maelle's Afterimage system
  afterimageStacks?: number;
  onAfterimageChange?: (stacks: number) => void;
  phantomStrikeAvailable?: boolean;
  onPhantomStrikeUse?: () => void;
  sessionId?: string;
}

export function MaelleCharacterSheet({
  character,
  onHPChange,
  onAbilityPointsChange,
  isLoading = false,
  isMyTurn = false,
  combatActive = false,
  availableEnemies = [],
  playerPosition = { x: 0, y: 0 },
  onTargetSelect,
  onEndTurn,
  onCancelTargeting,
  hasActedThisTurn = false,
  afterimageStacks = 0,
  onAfterimageChange,
  phantomStrikeAvailable = true,
  onPhantomStrikeUse,
  sessionId,
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
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  const handleOpenInventory = () => {
    setShowInventoryModal(true);
  };
  
  useEffect(() => {
    const loadInventory = async () => {
      if (character?.id) {
        setInventoryLoading(true);
        try {
          const characterData = await InventoryService.getCharacterInventory(character.id);
          setInventory(characterData?.inventory || []);
        } catch (error) {
          console.error('Failed to load inventory:', error);
        } finally {
          setInventoryLoading(false);
        }
      }
    };

    loadInventory();
  }, [character?.id]);

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
    if (hasActedThisTurn && action.type !== 'ultimate') return;

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
      
      onPhantomStrikeUse?.();
      onAfterimageChange?.(0);
      
      const stacksGained = Math.ceil(enemiesInRange.length / 2);
      setTimeout(() => onAfterimageChange?.(stacksGained), 100);

      setSelectedAction(null);
      return;
    }

    // Handle abilities that don't need targeting
    if (selectedAction.id === 'spectral_feint' || selectedAction.id === 'mirror_step') {
      if (selectedAction.cost) {
        onAfterimageChange?.(Math.max(0, afterimageStacks - selectedAction.cost));
      }
      
      setSelectedAction(null);
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
          onAfterimageChange?.(Math.min(5, afterimageStacks + stacksGained));
        }
      } else if (selectedAction.cost) {
        onAfterimageChange?.(Math.max(0, afterimageStacks - selectedAction.cost));
      }

      setSelectedAction(null);
      setSelectedTarget('');
      setACRoll('');
      setShowTargetingModal(false);
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

  // Define Maelle's new abilities
  const basicAttack = {
    type: 'basic' as const,
    id: 'phantom_thrust',
    name: 'Phantom Thrust',
    description: 'Rapier attack that builds Afterimage stacks',
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
      description: 'Mark target with disadvantage on attacks vs you',
      damage: 'Mark target (Bonus Action)',
      cost: 1,
      needsTarget: false,
      range: 'Reaction/Positioning',
    },
    {
      type: 'ability' as const,
      id: 'blade_flurry',
      name: 'Blade Flurry',
      description: '3 attacks, bonus damage on each hit after first',
      damage: '3 attacks, +1d4 per hit after 1st',
      cost: 2,
      needsTarget: true,
      range: 'Melee (5ft)',
    },
    {
      type: 'ability' as const,
      id: 'mirror_step',
      name: 'Mirror Step',
      description: 'Teleport to avoid attack (Reaction)',
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
    description: 'Teleport between all enemies within 50ft',
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
                  disabled={!isMyTurn || !combatActive || hasActedThisTurn}
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
                        disabled={!isMyTurn || !combatActive || hasActedThisTurn || !canAfford}
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

          {/* Combat Tips */}
          <div className="mt-4 p-3 bg-clair-royal-900 bg-opacity-20 rounded-lg border border-clair-royal-600">
            <h4 className="font-serif font-bold text-clair-royal-400 text-sm mb-2">Phantom Blade Tips:</h4>
            <ul className="text-xs text-clair-royal-300 space-y-1">
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
        sessionId={sessionId} // Add this
        playerId={character.id} // Add this
        onSelectEnemy={(enemy) => {
          setSelectedTarget(enemy.id);
        }}
        selectedEnemyId={selectedTarget}
        abilityName={selectedAction?.name}
        abilityRange={5} // Maelle is melee only
      />

      <InventoryModal
        isOpen={showInventoryModal}
        characterName={character.name}
        inventory={inventory}
        isLoading={inventoryLoading}
        onClose={() => setShowInventoryModal(false)}
      />
    </div>
  );
}