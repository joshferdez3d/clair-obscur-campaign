// src/components/CharacterSheet/LuneCharacterSheet.tsx
import React, { useState } from 'react';
import { User, Sparkles, Target, Eye, Zap, Circle, Heart } from 'lucide-react';
import { FirestoreService } from '../../services/firestoreService';
import { HPSyncService } from '../../services/HPSyncService';
import { HPTracker } from './HPTracker';
import { StatDisplay } from './StatDisplay';
import { EnemyTargetingModal } from '../Combat/EnemyTargetingModal';
import type { Character, Position, BattleToken } from '../../types';
import { useUltimateVideo } from '../../hooks/useUltimateVideo';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';

interface LuneCharacterSheetProps {
  character: Character;
  onHPChange: (delta: number) => void;
  onAbilityUse: (ability: any) => void;
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
  onEndTurn?: () => void;
  onCancelTargeting?: () => void;
  hasActedThisTurn?: boolean;
  elementalStains?: Array<'fire' | 'ice' | 'nature' | 'light'>;
  onStainsChange?: (stains: Array<'fire' | 'ice' | 'nature' | 'light'>) => void;

  // For abilities that need AoE or special targeting
  sessionId?: string;
  allTokens?: BattleToken[];
  
  // Combat state tracking for ultimate reset
  session?: any;
}

type ElementType = 'fire' | 'ice' | 'nature' | 'light';

const ELEMENT_MAP: Record<number, ElementType> = {
  1: 'fire',
  2: 'ice', 
  3: 'nature',
  4: 'light'
};

const ELEMENT_COLORS = {
  fire: 'bg-red-500',
  ice: 'bg-blue-500',
  nature: 'bg-green-500',
  light: 'bg-white border-2 border-gray-300'
};

const ELEMENT_TEXT_COLORS = {
  fire: 'text-red-500',
  ice: 'text-blue-500',
  nature: 'text-green-500',
  light: 'text-gray-800'
};

const ELEMENT_NAMES = {
  fire: 'Fire',
  ice: 'Ice',
  nature: 'Nature',
  light: 'Light'
};

const STATUS_EFFECTS = {
  fire: 'Burn: +2 damage/turn for 3 rounds',
  ice: 'Freeze: Can\'t move for 1 round',
  nature: 'Push: 15ft pushback',
  light: 'Blind: Miss next attack'
};

const ULTIMATE_EFFECTS = {
  fire: {
    name: 'Inferno Terrain',
    description: 'Creates fire terrain in 15ft radius. +5 damage per turn to anyone in zone.',
    icon: '🔥'
  },
  ice: {
    name: 'Glacial Wall',
    description: 'Creates ice wall along row/column, blocking movement.',
    icon: '🧊'
  },
  nature: {
    name: 'Life Surge',
    description: 'Heals all allies by 50% of current health.',
    icon: '🌱'
  },
  light: {
    name: 'Divine Judgment',
    description: '20 random squares highlighted for 3 rounds. Pure divine energy.',
    icon: '⚡'
  }
};

export function LuneCharacterSheet({
  character,
  onHPChange,
  onAbilityUse,
  isLoading = false,
  isMyTurn = false,
  combatActive = false,
  availableEnemies = [],
  playerPosition = { x: 0, y: 0 },
  onTargetSelect,
  onEndTurn,
  onCancelTargeting,
  hasActedThisTurn = false,
  elementalStains = [],
  onStainsChange,
  sessionId = 'test-session',
  allTokens = [],
  session,
}: LuneCharacterSheetProps) {
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [acRoll, setACRoll] = useState<string>('');
  const [elementRoll, setElementRoll] = useState<string>('');
  const [selectedUltimateElement, setSelectedUltimateElement] = useState<ElementType | null>(null);
  const [healAmount, setHealAmount] = useState<string>('');
  const [showTargetingModal, setShowTargetingModal] = useState(false);
  const { triggerUltimate } = useUltimateVideo(sessionId);
  const elementalGenesisUsed = session?.luneElementalGenesisUsed || false;
  const [twinCatalystSelections, setTwinCatalystSelections] = useState<Record<string, number>>({});
  const [selectedIceWallOrientation, setSelectedIceWallOrientation] = useState<'row' | 'column' | null>(null);

  const [selectedAction, setSelectedAction] = useState<{
    type: 'basic' | 'ability' | 'ultimate' | 'heal';
    id: string;
    name: string;
    description: string;
    damage?: string;
    cost?: number | string;
    needsElement?: boolean;
    multiTarget?: boolean;
    isHealing?: boolean;
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
  const getCharacterGradient = () => 'bg-gradient-to-br from-clair-mystical-600 to-clair-mystical-800';


  // Calculate distance for range validation
  const calculateDistance = (pos1: { x: number; y: number }, pos2: { x: number; y: number }): number => {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    return Math.max(dx, dy) * 5;
  };

  // Get valid targets (Lune's abilities are all ranged)
  const getValidTargets = () => {
    return availableEnemies;
  };

  // Get available healing targets (allies + self)
  const getAvailableAllies = () => {
    const playerTokens = allTokens.filter(token => token.type === 'player');
    return playerTokens.map(token => ({
      id: token.characterId || token.id,
      tokenId: token.id,
      name: token.name,
      currentHP: token.hp || 0,
      maxHP: token.maxHp || 0,
      position: token.position,
    }));
  };

  // Add stain to collection
  const addStain = (element: ElementType) => {
    if (elementalStains.length >= 5) return;
    const newStains = [...elementalStains, element];
    onStainsChange?.(newStains);
  };

  // Remove oldest stains
  const consumeStains = (count: number) => {
    if (elementalStains.length < count) return [];
    const consumed = elementalStains.slice(0, count);
    const remaining = elementalStains.slice(count);
    onStainsChange?.(remaining);
    return consumed;
  };

  // Get unique available elements for ultimate
  const getAvailableElements = (): ElementType[] => {
    return Array.from(new Set(elementalStains));
  };

  // Define Lune's actions
  const basicAttack = {
    type: 'basic' as const,
    id: 'elemental_bolt',
    name: 'Elemental Bolt',
    description: 'Ranged spell attack with random element',
    damage: '1d10 elemental',
    needsElement: true,
    icon: Circle,
    range: 'Unlimited',
  };

  const abilities = [
    {
      type: 'ability' as const,
      id: 'elemental_strike',
      name: 'Elemental Strike',
      description: 'Consume 1 stain for enhanced damage + status effect',
      damage: '1d10 + status effect',
      cost: 1,
      range: 'Unlimited',
    },
    {
      type: 'ability' as const,
      id: 'twin_catalyst',
      name: 'Twin Catalyst',
      description: 'Fire two elemental bolts using oldest 2 stains',
      damage: '2 × 1d10 elemental',
      cost: 2,
      multiTarget: true,
      range: 'Unlimited',
    },
    {
      type: 'heal' as const,
      id: 'natures_balm',
      name: "Nature's Balm",
      description: 'Heal an ally (or yourself) for 2d6 HP',
      damage: '2d6 healing',
      cost: 2,
      range: 'Unlimited',
      isHealing: true,
    },
  ];

  const ultimateAbility = {
    type: 'ultimate' as const,
    id: 'elemental_genesis',
    name: 'Elemental Genesis',
    description: 'Choose element for powerful terrain/support effect',
    cost: 3,
    range: 'Battlefield',
    onePerRest: true
  };

  // Handle action selection
  const handleActionSelect = (action: any) => {
    if (hasActedThisTurn) return;

    // Check if we have enough stains for abilities
    if (action.type === 'ability' && action.cost) {
      if (elementalStains.length < action.cost) {
        alert(`Not enough stains! Need ${action.cost}, have ${elementalStains.length}`);
        return;
      }
    }

    // Check healing ability requirements
    if (action.type === 'heal' && action.cost) {
      if (elementalStains.length < action.cost) {
        alert(`Not enough stains! Need ${action.cost}, have ${elementalStains.length}`);
        return;
      }
    }

    // Check ultimate requirements
    if (action.type === 'ultimate') {
      if (elementalStains.length < 3) {
        alert('Need at least 3 stain to use Elemental Genesis!');
        return;
      }
      if (elementalGenesisUsed) {
        alert('Elemental Genesis already used this rest!');
        return;
      }
    }

    setSelectedAction(action);
    setSelectedTarget('');
    setSelectedTargets([]);
    setACRoll('');
    setElementRoll('');
    setSelectedUltimateElement(null);
    setSelectedIceWallOrientation(null); // ADD THIS LINE
    setHealAmount('');
  };

  // Handle target selection for multi-target abilities
  const handleTargetToggle = (targetId: string) => {
    if (selectedAction?.multiTarget && selectedAction.id === 'twin_catalyst') {
      // Special handling for Twin Catalyst - use count-based selection
      const currentCount = twinCatalystSelections[targetId] || 0;
      const totalSelections = Object.values(twinCatalystSelections).reduce((sum, count) => sum + count, 0);
      
      if (totalSelections < 2) {
        // Can add another selection
        const newSelections = {
          ...twinCatalystSelections,
          [targetId]: currentCount + 1
        };
        setTwinCatalystSelections(newSelections);
        
        // Convert to array format for selectedTargets display
        const targetArray: string[] = [];
        Object.entries(newSelections).forEach(([enemyId, count]) => {
          for (let i = 0; i < count; i++) {
            targetArray.push(enemyId);
          }
        });
        setSelectedTargets(targetArray);
      }
    } else if (selectedAction?.multiTarget) {
      // Other multi-target abilities (if any)
      if (selectedTargets.includes(targetId)) {
        setSelectedTargets(selectedTargets.filter(id => id !== targetId));
      } else {
        setSelectedTargets([...selectedTargets, targetId]);
      }
    } else {
      setSelectedTarget(targetId);
    }
  };

  // Handle element selection for ultimate
  const handleUltimateElementSelect = (element: ElementType) => {
    setSelectedUltimateElement(element);
  };

  // Handle heal amount confirmation
  const handleConfirmHeal = async () => {
    if (!selectedAction || selectedAction.id !== 'natures_balm') return;
    if (!selectedTarget || !healAmount) {
      alert('Please select a target and enter heal amount!');
      return;
    }

    const healValue = parseInt(healAmount);
    if (isNaN(healValue) || healValue <= 0) {
      alert('Please enter a valid heal amount!');
      return;
    }

    try {
      const allies = getAvailableAllies();
      const targetAlly = allies.find(ally => ally.id === selectedTarget);
      if (!targetAlly) {
        alert('Target not found!');
        return;
      }

      await HPSyncService.applyHealing(targetAlly.id, sessionId, healValue);
      consumeStains(2);

      if (onTargetSelect) {
        onTargetSelect('action_taken', 0, 'heal', 'natures_balm');
      }

      console.log(`Nature's Balm: Healed ${targetAlly.name} for ${healValue} HP`);
      
      setSelectedAction(null);
      setSelectedTarget('');
      setHealAmount('');
      
    } catch (error) {
      console.error('Failed to apply healing:', error);
      alert('Failed to apply healing. Please try again.');
    }
  };

  const executeUltimate = async (element: ElementType) => {
    console.log(`🌟 Starting Elemental Genesis - ${element}`);
    console.log('🧊 Selected ice wall orientation:', selectedIceWallOrientation);

    try {
      await triggerUltimate('lune', 'Elemental Genesis');
    } catch (error) {
      console.error('Ultimate video failed:', error);
    }

    const newStains = [...elementalStains];
    const elementIndex = newStains.indexOf(element);
    if (elementIndex !== -1) {
      consumeStains(3);
    }

    try {
      const ref = doc(db, 'battleSessions', sessionId);
      await updateDoc(ref, {
        'luneElementalGenesisUsed': true,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Session update failed:', error);
    }

    if (onTargetSelect) {
      onTargetSelect('action_taken', 999, 'ability', 'elemental_genesis');
    }

    const needsGMInteraction = element === 'fire' || element === 'ice';

    try {
      const actionData: any = {
        playerId: character.id,
        ultimateType: 'elemental_genesis',
        element: element,
        effectName: ULTIMATE_EFFECTS[element].name,
        description: ULTIMATE_EFFECTS[element].description,
        needsGMInteraction: needsGMInteraction,
        allPlayerTokens: allTokens.filter(t => t.type === 'player').map(t => ({
          id: t.id,
          name: t.name,
          currentHP: t.hp || 0,
          maxHP: t.maxHp || 0,
          position: t.position
        }))
      };

      // Only add wallType if it's a valid value (not null)
      if (element === 'ice' && selectedIceWallOrientation) {
        actionData.wallType = selectedIceWallOrientation;
      }
      
      console.log('🧊 Action data being sent:', JSON.stringify(actionData, null, 2));
      const action = await FirestoreService.createUltimateAction(sessionId, actionData);
      console.log('Ultimate action created successfully:', action);

    } catch (error) {
      console.error('Failed to create ultimate action:', error);
    }
  };

  // Confirm action execution
  const handleConfirmAction = async () => {
    if (!selectedAction) return;

    if (sessionId) {
      FirestoreService.clearTargetingState(sessionId);
    }

    // Handle Nature's Balm healing
    if (selectedAction.id === 'natures_balm') {
      await handleConfirmHeal();
      return;
    }

    // Handle Elemental Genesis (Ultimate)
    if (selectedAction.id === 'elemental_genesis') {
      if (!selectedUltimateElement) {
        alert('Please select an element for your Genesis!');
        return;
      }
      // ADD THIS CHECK for ice wall orientation:
        if (selectedUltimateElement === 'ice' && !selectedIceWallOrientation) {
          alert('Please select row or column for your Ice Wall!');
          return;
        }
      await executeUltimate(selectedUltimateElement);
      setSelectedAction(null);
      return;
    }

    // Validate inputs for other abilities
    if (!selectedAction.needsElement && !selectedAction.multiTarget) {
      if (!selectedTarget || !acRoll) {
        alert('Please select a target and enter AC roll!');
        return;
      }
    } else if (selectedAction.needsElement && !selectedAction.multiTarget) {
      if (!selectedTarget || !acRoll || !elementRoll) {
        alert('Please select target, enter AC roll, and roll for element!');
        return;
      }
    } else if (selectedAction.multiTarget) {
      if (selectedTargets.length === 0 || !acRoll) {
        alert('Please select at least one target and enter AC roll!');
        return;
      }
    }

    const acRollNum = parseInt(acRoll);
    if (isNaN(acRollNum) || acRollNum < 1 || acRollNum > 20) {
      alert('AC roll must be between 1 and 20!');
      return;
    }

    // Handle element roll if needed
    if (selectedAction.needsElement) {
      const elementRollNum = parseInt(elementRoll);
      if (isNaN(elementRollNum) || elementRollNum < 1 || elementRollNum > 4) {
        alert('Element roll must be between 1 and 4!');
        return;
      }
      const rolledElement = ELEMENT_MAP[elementRollNum];
      addStain(rolledElement);
    }

    try {
      if (selectedAction.multiTarget) {
        for (const targetId of selectedTargets) {
          if (onTargetSelect) {
            onTargetSelect(targetId, acRollNum, selectedAction.type, selectedAction.id);
          }
        }
        
        if (selectedAction.cost && typeof selectedAction.cost === 'number') {
          consumeStains(selectedAction.cost);
        }
      } else {
        if (onTargetSelect) {
          onTargetSelect(selectedTarget, acRollNum, selectedAction.type, selectedAction.id);
        }
        
        if (selectedAction.cost && typeof selectedAction.cost === 'number') {
          consumeStains(selectedAction.cost);
        }
      }

      setSelectedAction(null);
      setSelectedTarget('');
      setSelectedTargets([]);
      setACRoll('');
      setElementRoll('');
      setShowTargetingModal(false);
    } catch (error) {
      console.error('Error executing action:', error);
      alert('Failed to execute action. Please try again.');
    }
  };

  const handleCancelAction = () => {
    setSelectedAction(null);
    setSelectedTarget('');
    setSelectedTargets([]);
    setTwinCatalystSelections({}); // Add this line
    setSelectedIceWallOrientation(null); // ADD THIS LINE
    setACRoll('');
    setElementRoll('');
    setShowTargetingModal(false);
    onCancelTargeting?.();
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
        <HPTracker currentHP={character.currentHP} maxHP={character.maxHP} onHPChange={onHPChange} isLoading={isLoading} showControls={false} />

        {/* ABILITY SCORES */}
        <StatDisplay stats={character.stats} />

        {/* Elemental Stains */}
        <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 mb-4 border border-clair-mystical-600">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Sparkles className="w-6 h-6 text-clair-mystical-400 mr-2" />
              <h3 className="font-display text-lg font-bold text-clair-mystical-300">Elemental Stains</h3>
            </div>
            <div className="font-serif text-2xl font-bold text-clair-mystical-200">{elementalStains.length} / 5</div>
          </div>
          
          {/* Stains Display */}
          <div className="flex justify-center space-x-2 mb-4">
            {Array.from({ length: 5 }).map((_, index) => {
              const stain = elementalStains[index];
              return (
                <div
                  key={index}
                  className={`w-8 h-8 rounded-full border-2 transition-all duration-300 flex items-center justify-center ${
                    stain 
                      ? `${ELEMENT_COLORS[stain]} border-clair-gold-400 shadow-lg` 
                      : 'bg-clair-shadow-800 border-clair-shadow-400'
                  }`}
                >
                  {stain && (
                    <span className={`text-xs font-bold ${stain === 'light' ? 'text-gray-800' : 'text-white'}`}>
                      {ELEMENT_NAMES[stain][0]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Current Stains List */}
          {elementalStains.length > 0 && (
            <div className="text-center text-sm text-clair-mystical-300">
              Current: {elementalStains.map((stain, i) => (
                <span key={i} className={`${ELEMENT_TEXT_COLORS[stain]} font-bold`}>
                  {ELEMENT_NAMES[stain]}{i < elementalStains.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Combat Actions */}
        <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 border border-clair-gold-600 mb-6">
          <h3 className="font-display text-lg font-bold text-clair-gold-400 mb-3">Combat Actions</h3>

          {!selectedAction ? (
            <div className="space-y-3">
              {/* Basic Attack */}
              <div>
                <h4 className="text-sm font-bold text-gray-300 mb-2">Basic Attack</h4>
                <button
                  onClick={() => handleActionSelect(basicAttack)}
                  disabled={!isMyTurn || !combatActive || hasActedThisTurn}
                  className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:opacity-50 p-3 rounded-lg transition-colors text-left text-white border border-gray-500"
                >
                  <div className="flex items-center">
                    <Circle className="w-4 h-4 mr-2" />
                    <span className="font-bold">{basicAttack.name}</span>
                  </div>
                  <div className="text-sm opacity-90 mt-1">{basicAttack.description}</div>
                  <div className="text-xs text-gray-300 mt-1">{basicAttack.damage}</div>
                </button>
              </div>

              {/* Abilities */}
              <div>
                <h4 className="text-sm font-bold text-clair-mystical-300 mb-2">Abilities</h4>
                <div className="space-y-2">
                  {abilities.map((ability) => (
                    <button
                      key={ability.id}
                      onClick={() => handleActionSelect(ability)}
                      disabled={!isMyTurn || !combatActive || hasActedThisTurn || elementalStains.length < (ability.cost || 0)}
                      className={`w-full p-3 rounded-lg transition-colors text-left border ${
                        !isMyTurn || !combatActive || hasActedThisTurn || elementalStains.length < (ability.cost || 0)
                          ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed opacity-40'
                          : ability.isHealing 
                            ? 'bg-green-700 hover:bg-green-600 text-white border-green-500 hover:border-green-400'
                            : 'bg-clair-mystical-700 hover:bg-clair-mystical-600 text-white border-clair-mystical-500 hover:border-clair-mystical-400'
                      }`}
                    >
                      <div className="flex items-center">
                        {ability.isHealing ? (
                          <Heart className="w-4 h-4 mr-2" />
                        ) : (
                          <Zap className="w-4 h-4 mr-2" />
                        )}
                        <span className="font-bold">{ability.name}</span>
                        <span className="ml-2 text-xs bg-black bg-opacity-30 px-2 py-1 rounded">
                          {ability.cost} stains
                        </span>
                      </div>
                      <div className="text-sm opacity-90 mt-1">{ability.description}</div>
                      <div className="text-xs text-clair-gold-200 mt-1">{ability.damage}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ultimate Ability - Elemental Genesis */}
              <div className="mt-4">
                <h4 className="text-sm font-bold text-yellow-300 mb-2">Ultimate Ability</h4>
                  <button
                    onClick={() => handleActionSelect(ultimateAbility)}
                    disabled={!isMyTurn || !combatActive || hasActedThisTurn || elementalStains.length < 3 || elementalGenesisUsed}
                    className={`w-full p-3 rounded-lg font-semibold text-white transition-all duration-200 text-left ${
                      !isMyTurn || !combatActive || hasActedThisTurn || elementalStains.length < 3 || elementalGenesisUsed
                        ? 'bg-gray-600 cursor-not-allowed opacity-40 text-gray-400'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                    }`}
                  >
                  <div className="flex items-center">
                    <span className="text-xl mr-2">🌟</span>
                    <span className="font-bold">{ultimateAbility.name}</span>
                    <span className="ml-2 text-xs bg-black bg-opacity-30 px-2 py-1 rounded">
                      3 stains
                    </span>
                    <span className="ml-2 text-xs bg-yellow-600 px-2 py-1 rounded">ULTIMATE</span>
                  </div>
                     <div className="text-sm opacity-90 mt-1">
                      {elementalGenesisUsed 
                        ? '⚡ Already used this combat!'
                        : elementalStains.length < 3 
                          ? 'Need at least 3 stains to use'
                          : ultimateAbility.description
                      }
                    </div>
                  </button>
              </div>
            </div>
          ) : (
            /* ACTION CONFIRMATION */
            <div className="space-y-4">
              <div className="p-3 bg-clair-mystical-900 bg-opacity-30 rounded-lg border border-clair-mystical-600">
                <h4 className="font-bold text-clair-mystical-200 mb-2">
                  {selectedAction.isHealing ? '🌿' : '⚡'} {selectedAction.name}
                </h4>
                <p className="text-sm text-clair-mystical-300">{selectedAction.description}</p>
              </div>

              {/* Nature's Balm healing interface */}
              {selectedAction.id === 'natures_balm' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-bold text-green-300 mb-2">Select Ally to Heal:</label>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {getAvailableAllies().map((ally) => (
                        <button
                          key={ally.id}
                          onClick={() => setSelectedTarget(ally.id)}
                          className={`w-full p-2 rounded text-left text-sm transition-colors ${
                            selectedTarget === ally.id
                              ? 'bg-green-600 text-white border-2 border-green-400'
                              : 'bg-gray-700 text-gray-200 border border-gray-600 hover:bg-gray-600'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{ally.name}</span>
                            <span className="text-xs">
                              {ally.currentHP}/{ally.maxHP} HP
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-green-300 mb-2">Heal Amount (2d6):</label>
                    <input
                      type="number"
                      value={healAmount}
                      onChange={(e) => setHealAmount(e.target.value)}
                      placeholder="Enter heal amount (e.g., 8)"
                      className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-green-500"
                      min="1"
                      max="12"
                    />
                    <p className="text-xs text-gray-400 mt-1">Roll 2d6 and enter the result (2-12)</p>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={handleConfirmHeal}
                      disabled={!selectedTarget || !healAmount || parseInt(healAmount) <= 0}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:opacity-50 text-white p-2 rounded font-bold transition-colors"
                    >
                      Apply Healing
                    </button>
                    <button
                      onClick={handleCancelAction}
                      className="px-4 bg-gray-600 hover:bg-gray-700 text-white p-2 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Ultimate Element Selection */}
              {selectedAction.id === 'elemental_genesis' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-bold text-purple-300 mb-2">Choose Element:</label>
                    <div className="grid grid-cols-2 gap-2">
                      {getAvailableElements().map((element) => (
                        <button
                          key={element}
                          onClick={() => handleUltimateElementSelect(element)}
                          className={`p-3 rounded-lg text-left border transition-colors ${
                            selectedUltimateElement === element
                              ? `${ELEMENT_COLORS[element]} border-white text-white font-bold`
                              : 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600'
                          }`}
                        >
                          <div className="flex items-center mb-1">
                            <span className="text-lg mr-2">{ULTIMATE_EFFECTS[element].icon}</span>
                            <span className="font-bold text-sm">{ULTIMATE_EFFECTS[element].name}</span>
                          </div>
                          <div className="text-xs opacity-80">{ULTIMATE_EFFECTS[element].description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ice Wall Orientation Selection - NEW SECTION */}
                  {selectedUltimateElement === 'ice' && (
                    <div>
                      <label className="block text-sm font-bold text-blue-300 mb-2">Ice Wall Orientation:</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setSelectedIceWallOrientation('row')}
                          className={`p-3 rounded-lg border text-left transition-colors ${
                            selectedIceWallOrientation === 'row'
                              ? 'bg-blue-600 border-blue-400 text-white font-bold'
                              : 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600'
                          }`}
                        >
                          <div className="flex items-center mb-1">
                            <span className="text-lg mr-2">↔️</span>
                            <span className="font-bold text-sm">Horizontal Row</span>
                          </div>
                          <div className="text-xs opacity-80">Wall spans left to right</div>
                        </button>
                        <button
                          onClick={() => setSelectedIceWallOrientation('column')}
                          className={`p-3 rounded-lg border text-left transition-colors ${
                            selectedIceWallOrientation === 'column'
                              ? 'bg-blue-600 border-blue-400 text-white font-bold'
                              : 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600'
                          }`}
                        >
                          <div className="flex items-center mb-1">
                            <span className="text-lg mr-2">↕️</span>
                            <span className="font-bold text-sm">Vertical Column</span>
                          </div>
                          <div className="text-xs opacity-80">Wall spans top to bottom</div>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-2">
                    <button
                      onClick={handleConfirmAction}
                      disabled={!selectedUltimateElement}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:opacity-50 text-white p-2 rounded font-bold transition-colors"
                    >
                      Unleash Genesis
                    </button>
                    <button
                      onClick={handleCancelAction}
                      className="px-4 bg-gray-600 hover:bg-gray-700 text-white p-2 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Regular Target Selection for other abilities */}
              {(selectedAction.type === 'basic' || (selectedAction.type === 'ability' && !selectedAction.isHealing)) && (
                <div className="space-y-3">
                  {/* Modal Trigger for Target Selection */}
                  <button
                    onClick={() => setShowTargetingModal(true)}
                    className="w-full p-4 bg-clair-gold-600 hover:bg-clair-gold-700 text-clair-shadow-900 rounded-lg font-bold transition-colors flex items-center justify-center"
                  >
                    <Target className="w-5 h-5 mr-2" />
                    Select Target{selectedAction.multiTarget ? 's' : ''}
                    {selectedTarget && !selectedAction.multiTarget && (
                      <span className="ml-2 text-sm">
                        ({availableEnemies.find(e => e.id === selectedTarget)?.name})
                      </span>
                    )}
                    {selectedTargets.length > 0 && selectedAction.multiTarget && (
                      <span className="ml-2 text-sm">
                        ({selectedTargets.length} selected)
                      </span>
                    )}
                  </button>

                  {/* AC Roll and Element Roll Input */}
                  {(selectedTarget || selectedTargets.length > 0) && (
                    <div className="space-y-3">
                      <div className="flex space-x-2">
                        <div className="flex-1">
                          <label className="block text-sm font-bold text-gray-300 mb-1">AC Roll (1d20):</label>
                          <input
                            type="number"
                            value={acRoll}
                            onChange={(e) => setACRoll(e.target.value)}
                            placeholder="Enter d20 roll"
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-clair-gold-500"
                            min="1"
                            max="20"
                          />
                        </div>

                        {/* Element Roll for basic attacks */}
                        {selectedAction.needsElement && (
                          <div className="flex-1">
                            <label className="block text-sm font-bold text-gray-300 mb-1">Element (1d4):</label>
                            <input
                              type="number"
                              value={elementRoll}
                              onChange={(e) => setElementRoll(e.target.value)}
                              placeholder="1-4"
                              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-clair-gold-500"
                              min="1"
                              max="4"
                            />
                          </div>
                        )}
                      </div>

                      {/* Element Preview */}
                      {selectedAction.needsElement && elementRoll && (
                        <div className="p-2 bg-clair-mystical-900 bg-opacity-30 rounded border border-clair-mystical-600">
                          <div className="flex items-center text-sm">
                            <span className="text-clair-mystical-300 mr-2">Element:</span>
                            <span className={`font-bold ${ELEMENT_TEXT_COLORS[ELEMENT_MAP[parseInt(elementRoll)]] || 'text-white'}`}>
                              {ELEMENT_NAMES[ELEMENT_MAP[parseInt(elementRoll)]] || 'Invalid'}
                            </span>
                            {ELEMENT_MAP[parseInt(elementRoll)] && (
                              <span className="text-xs text-gray-400 ml-2">
                                ({STATUS_EFFECTS[ELEMENT_MAP[parseInt(elementRoll)]]})
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex space-x-2">
                        <button
                          onClick={handleConfirmAction}
                          disabled={
                            (!selectedAction.multiTarget && !selectedTarget) ||
                            (selectedAction.multiTarget && selectedTargets.length === 0) ||
                            !acRoll ||
                            (selectedAction.needsElement && !elementRoll)
                          }
                          className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:opacity-50 text-white p-2 rounded font-bold transition-colors"
                        >
                          Execute Action
                        </button>
                        <button
                          onClick={handleCancelAction}
                          className="px-4 bg-gray-600 hover:bg-gray-700 text-white p-2 rounded transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* END TURN BUTTON */}
        <div className="mb-6">
          {isMyTurn && combatActive && (
            <button
              onClick={onEndTurn}
              disabled={!hasActedThisTurn}
              className={`w-full py-3 px-4 rounded-lg font-bold transition-colors ${
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
          <div className="mt-4 p-3 bg-clair-mystical-900 bg-opacity-20 rounded-lg border border-clair-mystical-600">
            <h4 className="font-serif font-bold text-clair-mystical-400 text-sm mb-2">Combat Tips:</h4>
            <ul className="text-xs text-clair-mystical-300 space-y-1">
              <li>• Elemental Bolt generates stains based on 1d4 roll</li>
              <li>• Abilities consume oldest stains first</li>
              <li>• Fire burns, Ice freezes, Nature pushes, Light blinds</li>
              <li>• Twin Catalyst can target same enemy twice</li>
              <li>• Nature's Balm heals allies for 2d6 HP (costs 2 stains)</li>
              <li>• 🌟 Elemental Genesis: Fire=terrain, Ice=wall, Nature=heal, Light=blinds</li>
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
        sessionId={sessionId}
        playerId={character.id}
        onSelectEnemy={(enemy) => {
          if (selectedAction?.multiTarget) {
            handleTargetToggle(enemy.id);
          } else {
            setSelectedTarget(enemy.id);
          }
        }}
        selectedEnemyId={selectedAction?.multiTarget ? undefined : selectedTarget}
        selectedTargets={selectedTargets} // ADD THIS LINE
        abilityName={selectedAction?.name}
        abilityRange={999}
        multiTarget={selectedAction?.multiTarget} // ADD THIS LINE
        maxTargets={selectedAction?.id === 'twin_catalyst' ? 2 : undefined} // ADD THIS LINE
      />
    </div>
  );
}