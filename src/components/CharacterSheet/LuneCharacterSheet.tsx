// src/components/CharacterSheet/LuneCharacterSheet.tsx
import React, { useState } from 'react';
import { User, Sparkles, Target, Eye, Zap, Circle } from 'lucide-react';
import { FirestoreService } from '../../services/firestoreService';
import { HPTracker } from './HPTracker';
import { StatDisplay } from './StatDisplay';
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
  
  // NEW: Combat state tracking for ultimate reset
  session?: any; // For accessing luneElementalGenesisUsed from session
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

// Ultimate element effects
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
  session, // NEW: session prop for ultimate tracking

}: LuneCharacterSheetProps) {
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [acRoll, setACRoll] = useState<string>('');
  const [elementRoll, setElementRoll] = useState<string>('');
  const [selectedUltimateElement, setSelectedUltimateElement] = useState<ElementType | null>(null);
  const { triggerUltimate } = useUltimateVideo(sessionId);
  const elementalGenesisUsed = session?.luneElementalGenesisUsed || false;

  const [selectedAction, setSelectedAction] = useState<{
    type: 'basic' | 'ability' | 'ultimate';
    id: string;
    name: string;
    description: string;
    damage?: string;
    cost?: number | string;
    needsElement?: boolean;
    multiTarget?: boolean;
  } | null>(null);

  // Calculate distance for range validation
  const calculateDistance = (pos1: { x: number; y: number }, pos2: { x: number; y: number }): number => {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    return Math.max(dx, dy) * 5;
  };

  // Get valid targets (Lune's abilities are all ranged)
  const getValidTargets = () => {
    return availableEnemies; // All enemies are valid for Lune's ranged attacks
  };

  // Add stain to collection
  const addStain = (element: ElementType) => {
    if (elementalStains.length >= 5) return; // Max 5 stains
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
      type: 'ability' as const,
      id: 'genesis_spark',
      name: 'Genesis Spark',
      description: 'Ultimate focused elemental blast',
      damage: '5d10 elemental',
      cost: 3,
      range: 'Unlimited',
    },
  ];

  const ultimateAbility = {
    type: 'ultimate' as const,
    id: 'elemental_genesis',
    name: 'Elemental Genesis',
    description: 'Choose element for powerful terrain/support effect',
    cost: 1,
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

    // Check ultimate requirements
    if (action.type === 'ultimate') {
      if (elementalStains.length === 0) {
        alert('Need at least 1 stain to use Elemental Genesis!');
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
  };

  // Handle target selection for multi-target abilities
  const handleTargetToggle = (targetId: string) => {
    if (selectedAction?.multiTarget) {
      if (selectedTargets.includes(targetId)) {
        setSelectedTargets(selectedTargets.filter(id => id !== targetId));
      } else {
        if (selectedAction.id === 'twin_catalyst' && selectedTargets.length >= 2) {
          alert('Twin Catalyst can only target up to 2 enemies');
          return;
        }
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

 // In LuneCharacterSheet.tsx, replace the executeUltimate function:

 // Replace the executeUltimate function in LuneCharacterSheet.tsx with this fixed version:

  const executeUltimate = async (element: ElementType) => {
  console.log(`🌟 Starting Elemental Genesis - ${element}`);
  console.log('🔧 EARLY DEBUG: executeUltimate function called');
  console.log('🔧 EARLY DEBUG: sessionId:', sessionId);
  console.log('🔧 EARLY DEBUG: character.id:', character.id);
  
  try {
    // Trigger the ultimate video
    console.log('🔧 EARLY DEBUG: About to trigger ultimate video');
    await triggerUltimate('lune', 'Elemental Genesis');
    console.log('🔧 EARLY DEBUG: Ultimate video triggered successfully');
  } catch (error) {
    console.error('🔧 EARLY DEBUG: Ultimate video failed:', error);
  }

  // Consume one stain of the selected element
  console.log('🔧 EARLY DEBUG: About to consume stains');
  const newStains = [...elementalStains];
  const elementIndex = newStains.indexOf(element);
  if (elementIndex !== -1) {
    newStains.splice(elementIndex, 1);
    onStainsChange?.(newStains);
    console.log('🔧 EARLY DEBUG: Stains consumed successfully');
  } else {
    console.log('🔧 EARLY DEBUG: Element not found in stains');
  }

  // Mark ultimate as used in session (not local state)
  console.log('🔧 EARLY DEBUG: About to mark ultimate as used in session');
  try {
    const ref = doc(db, 'battleSessions', sessionId);
    await updateDoc(ref, {
      'luneElementalGenesisUsed': true,
      updatedAt: serverTimestamp()
    });
    console.log('🔧 EARLY DEBUG: Session updated successfully');
  } catch (error) {
    console.error('🔧 EARLY DEBUG: Session update failed:', error);
  }

  // Trigger appropriate effect
  console.log('🔧 EARLY DEBUG: About to call onTargetSelect');
  if (onTargetSelect) {
    onTargetSelect('action_taken', 999, 'ability', 'elemental_genesis');
    console.log('🔧 EARLY DEBUG: onTargetSelect called successfully');
  } else {
    console.log('🔧 EARLY DEBUG: onTargetSelect is null/undefined');
  }

  // 🔧 DEBUG: Add extensive logging for ultimate creation
  console.log('🔧 EARLY DEBUG: Reached the main debug section');
  const needsGMInteraction = element === 'fire' || element === 'ice';
  console.log('🔧 DEBUG: About to create ultimate action with payload:', {
    playerId: character.id,
    ultimateType: 'elemental_genesis',
    element: element,
    effectName: ULTIMATE_EFFECTS[element].name,
    description: ULTIMATE_EFFECTS[element].description,
    needsGMInteraction: needsGMInteraction,
    sessionId: sessionId
  });

  // Create specific ultimate action for GM
  try {
    console.log('🔧 DEBUG: Calling FirestoreService.createUltimateAction...');
    
    const action = await FirestoreService.createUltimateAction(sessionId, {
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
    });
    
    console.log('🔧 DEBUG: Ultimate action created successfully:', action);
    
    // 🔧 DEBUG: For light ultimates, check if immediate execution should have happened
    if (element === 'light') {
      console.log('🔧 DEBUG: Light ultimate should execute immediately');
      console.log('🔧 DEBUG: needsGMInteraction should be false:', needsGMInteraction);
      
      // Wait a moment then check the session for light effects
      setTimeout(async () => {
        try {
          const session = await FirestoreService.getBattleSession(sessionId);
          console.log('🔧 DEBUG: Session after ultimate:', {
            lightBlindEffects: session?.lightBlindEffects,
            lightEffectCount: session?.lightBlindEffects?.length || 0
          });
        } catch (error) {
          console.error('🔧 DEBUG: Failed to check session after ultimate:', error);
        }
      }, 2000);
    }
    
  } catch (error) {
    console.error('❌ Failed to create ultimate action:', error);
    // Fix TypeScript error by properly handling unknown error type
    if (error instanceof Error) {
      console.error('❌ Error details:', error.message, error.stack);
    } else {
      console.error('❌ Error details:', String(error));
    }
  }
};

  // Confirm action execution
  const handleConfirmAction = async () => {
    if (!selectedAction) return;

    // Handle Elemental Genesis (Ultimate)
    if (selectedAction.id === 'elemental_genesis') {
      if (!selectedUltimateElement) {
        alert('Please select an element for your Genesis!');
        return;
      }

      await executeUltimate(selectedUltimateElement);
      setSelectedAction(null);
      setSelectedUltimateElement(null);
      return;
    }

    // For Elemental Bolt (basic attack)
    if (selectedAction.id === 'elemental_bolt') {
      if (!selectedTarget || !acRoll || !elementRoll) {
        alert('Please select target, enter AC roll, and element roll (1-4)');
        return;
      }

      const elementNum = parseInt(elementRoll);
      if (elementNum < 1 || elementNum > 4) {
        alert('Element roll must be between 1-4');
        return;
      }

      const element = ELEMENT_MAP[elementNum];
      
      // Add stain for the element used
      addStain(element);

      // Trigger the attack
      if (onTargetSelect) {
        onTargetSelect(selectedTarget, parseInt(acRoll), 'ranged', 'elemental_bolt');
        onTargetSelect('action_taken', 999, 'basic', 'elemental_bolt');

      }

      setSelectedAction(null);
      setSelectedTarget('');
      setACRoll('');
      setElementRoll('');
      setSelectedUltimateElement(null);
      return;
    }

    // For single-target abilities
    if (!selectedAction.multiTarget) {
      if (!selectedTarget || !acRoll) {
        alert('Please select target and enter AC roll');
        return;
      }

      // Consume stains
      const consumed = consumeStains(selectedAction.cost as number || 0);
      console.log(`Consumed ${consumed.length} stains:`, consumed);

      if (onTargetSelect) {
        onTargetSelect(selectedTarget, parseInt(acRoll), 'ability', selectedAction.id);
        onTargetSelect('action_taken', 999, 'ability', selectedAction.id);

      }

      setSelectedAction(null);
      setSelectedTarget('');
      setACRoll('');
      setSelectedUltimateElement(null);
      setElementRoll('');
      return;
    }

    // For multi-target abilities (Twin Catalyst)
    if (selectedAction.multiTarget) {
      if (selectedTargets.length === 0 || !acRoll) {
        alert('Please select at least one target and enter AC roll');
        return;
      }

      // Consume stains
      const consumed = consumeStains(selectedAction.cost as number || 0);
      console.log(`Twin Catalyst consumed ${consumed.length} stains:`, consumed);

      // For Twin Catalyst, we need to create multiple actions or handle specially
      // For now, we'll use the first target as primary and note in GM popup
      if (onTargetSelect) {
        // Create attack for each target with same AC roll
        for (const targetId of selectedTargets) {
          onTargetSelect(targetId, parseInt(acRoll), 'ability', selectedAction.id);
        }
      }

      setSelectedAction(null);
      setSelectedTargets([]);
      setACRoll('');
      return;
    }
  };

  const handleCancelAction = () => {
    setSelectedAction(null);
    setSelectedTarget('');
    setSelectedTargets([]);
    setACRoll('');
    setElementRoll('');
    setSelectedUltimateElement(null);
    onCancelTargeting?.();
  };

  
  return (
    <div className="min-h-screen bg-clair-shadow-900">
      {/* CHARACTER HEADER */}
      <div className="relative px-4 pt-6 pb-4 text-white bg-gradient-to-br from-clair-mystical-700 to-clair-mystical-900 shadow-shadow border-b border-clair-gold-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center border-2 border-clair-gold-400">
              <User className="w-6 h-6 text-clair-gold-200" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold text-clair-gold-50">{character.name}</h1>
              <p className="font-serif italic text-clair-gold-200 text-sm">{character.role}</p>
            </div>
          </div>

          {isMyTurn && combatActive && (
            <div className="bg-clair-gold-500 text-clair-shadow-900 px-3 py-2 rounded-full font-sans text-sm font-bold animate-pulse shadow-clair">
              Your Turn
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-4">
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
                          ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed opacity-40' // Made more obvious
                          : 'bg-clair-mystical-700 hover:bg-clair-mystical-600 text-white border-clair-mystical-500 hover:border-clair-mystical-400'
                      }`}
                    >
                      <div className="flex items-center">
                        <Zap className="w-4 h-4 mr-2" />
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
                    disabled={!isMyTurn || !combatActive || hasActedThisTurn || elementalStains.length === 0 || elementalGenesisUsed}
                    className={`w-full p-3 rounded-lg font-semibold text-white transition-all duration-200 text-left ${
                      !isMyTurn || !combatActive || hasActedThisTurn || elementalStains.length === 0 || elementalGenesisUsed
                        ? 'bg-gray-600 cursor-not-allowed opacity-40 text-gray-400' // Made more obvious
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                    }`}
                  >
                  <div className="flex items-center">
                    <span className="text-xl mr-2">🌟</span>
                    <span className="font-bold">{ultimateAbility.name}</span>
                    <span className="ml-2 text-xs bg-black bg-opacity-30 px-2 py-1 rounded">
                      1 stain
                    </span>
                    <span className="ml-2 text-xs bg-yellow-600 px-2 py-1 rounded">ULTIMATE</span>
                  </div>
                     <div className="text-sm opacity-90 mt-1">
                      {elementalGenesisUsed 
                        ? '⚡ Already used this combat!'
                        : elementalStains.length === 0 
                          ? 'Need stains to unleash Genesis'
                          : `Choose from ${getAvailableElements().length} elements`
                      }
                    </div>
                  <div className="text-xs text-yellow-200 mt-1">{ultimateAbility.description}</div>
                </button>
              </div>
            </div>
          ) : (
            // Target Selection / Element Selection
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

              {selectedAction.id === 'elemental_genesis' ? (
                <div className="space-y-3">
                  <div className="p-3 bg-purple-900 bg-opacity-30 rounded-lg">
                    <p className="text-purple-200 text-sm">
                      Choose an element to unleash its Genesis effect! Each element creates a unique battlefield effect.
                    </p>
                  </div>

                  {/* Element Selection */}
                  <div>
                    <label className="block text-sm font-bold text-clair-mystical-300 mb-2">Select Element:</label>
                    <div className="grid grid-cols-2 gap-2">
                      {getAvailableElements().map((element) => (
                        <button
                          key={element}
                          onClick={() => handleUltimateElementSelect(element)}
                          className={`p-3 rounded-lg transition-colors border text-left ${
                            selectedUltimateElement === element
                              ? 'bg-clair-gold-600 border-clair-gold-400 text-white'
                              : 'bg-clair-shadow-700 border-clair-shadow-500 text-gray-300 hover:bg-clair-shadow-600'
                          }`}
                        >
                          <div className="flex items-center mb-1">
                            <span className="text-lg mr-2">{ULTIMATE_EFFECTS[element].icon}</span>
                            <span className={`font-bold ${ELEMENT_TEXT_COLORS[element]}`}>
                              {ELEMENT_NAMES[element]}
                            </span>
                          </div>
                          <div className="text-xs font-bold mb-1">{ULTIMATE_EFFECTS[element].name}</div>
                          <div className="text-xs opacity-90">{ULTIMATE_EFFECTS[element].description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleConfirmAction}
                    disabled={!selectedUltimateElement}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:bg-gray-600 disabled:opacity-50 text-white p-3 rounded-lg font-bold transition-colors"
                  >
                    Unleash Elemental Genesis! 🌟
                  </button>
                </div>
              ) : (
                <>
                  {/* AC Roll Input */}
                  <div>
                    <label className="block text-sm font-bold text-clair-mystical-300 mb-1">AC Roll (d20):</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={acRoll}
                      onChange={(e) => setACRoll(e.target.value)}
                      className="w-full p-2 rounded bg-clair-shadow-800 border border-clair-mystical-600 text-white"
                      placeholder="Enter d20 roll result"
                    />
                  </div>

                  {/* Element Roll for Elemental Bolt */}
                  {selectedAction.needsElement && (
                    <div>
                      <label className="block text-sm font-bold text-clair-mystical-300 mb-1">Element Roll (1-4):</label>
                      <input
                        type="number"
                        min="1"
                        max="4"
                        value={elementRoll}
                        onChange={(e) => setElementRoll(e.target.value)}
                        className="w-full p-2 rounded bg-clair-shadow-800 border border-clair-mystical-600 text-white"
                        placeholder="1=Fire, 2=Ice, 3=Nature, 4=Light"
                      />
                    </div>
                  )}

                  {/* Target Selection */}
                  <div>
                    <label className="block text-sm font-bold text-clair-mystical-300 mb-2">
                      Select Target{selectedAction.multiTarget ? 's' : ''}:
                    </label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {getValidTargets().map((enemy) => (
                        <button
                          key={enemy.id}
                          onClick={() => handleTargetToggle(enemy.id)}
                          className={`w-full p-2 rounded text-left transition-colors border ${
                            selectedAction.multiTarget
                              ? selectedTargets.includes(enemy.id)
                                ? 'bg-clair-gold-600 border-clair-gold-400 text-white'
                                : 'bg-clair-shadow-700 border-clair-shadow-500 text-gray-300 hover:bg-clair-shadow-600'
                              : selectedTarget === enemy.id
                                ? 'bg-clair-gold-600 border-clair-gold-400 text-white'
                                : 'bg-clair-shadow-700 border-clair-shadow-500 text-gray-300 hover:bg-clair-shadow-600'
                          }`}
                        >
                          <div className="font-bold">{enemy.name}</div>
                          <div className="text-xs opacity-75">AC: {enemy.ac} | HP: {enemy.hp}/{enemy.maxHp}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Confirm Button */}
                  <button
                    onClick={handleConfirmAction}
                    disabled={
                      (selectedAction.multiTarget && selectedTargets.length === 0) ||
                      (!selectedAction.multiTarget && !selectedTarget) ||
                      !acRoll ||
                      (selectedAction.needsElement && !elementRoll)
                    }
                    className="w-full bg-clair-gold-600 hover:bg-clair-gold-700 disabled:bg-gray-600 disabled:opacity-50 text-white p-3 rounded-lg font-bold transition-colors"
                  >
                    Confirm {selectedAction.name}
                  </button>
                </>
              )}

              {/* Status Effect Preview for Elemental Strike */}
              {selectedAction.id === 'elemental_strike' && elementalStains.length > 0 && (
                <div className="mt-4 p-3 bg-clair-mystical-900 bg-opacity-30 rounded-lg border border-clair-mystical-500">
                  <h4 className="font-serif font-bold text-clair-mystical-300 text-sm mb-2">Next Stain Effects:</h4>
                  <div className="text-xs text-clair-mystical-200">
                    <span className={`font-bold ${ELEMENT_TEXT_COLORS[elementalStains[0]]}`}>
                      {ELEMENT_NAMES[elementalStains[0]]}
                    </span>
                    : {STATUS_EFFECTS[elementalStains[0]]}
                  </div>
                </div>
              )}

              {getValidTargets().length === 0 && selectedAction.id !== 'elemental_genesis' && (
                <div className="text-center text-clair-gold-400 py-4">No enemies available</div>
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
          <div className="mt-4 p-3 bg-clair-mystical-900 bg-opacity-20 rounded-lg border border-clair-mystical-600">
            <h4 className="font-serif font-bold text-clair-mystical-400 text-sm mb-2">Combat Tips:</h4>
            <ul className="text-xs text-clair-mystical-300 space-y-1">
              <li>• Elemental Bolt generates stains based on 1d4 roll</li>
              <li>• Abilities consume oldest stains first</li>
              <li>• Fire burns, Ice freezes, Nature pushes, Light blinds</li>
              <li>• Twin Catalyst can target same enemy twice</li>
              <li>• Genesis Spark costs 3 stains for big damage</li>
              <li>• 🌟 Elemental Genesis: Fire=terrain, Ice=wall, Nature=heal, Light=blinds</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}