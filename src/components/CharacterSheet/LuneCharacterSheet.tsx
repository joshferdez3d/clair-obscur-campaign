// src/components/CharacterSheet/LuneCharacterSheet.tsx - STREAMLINED VERSION
import React, { useState, useEffect } from 'react';
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
import { Package } from 'lucide-react';
import { InventoryModal } from './InventoryModal';
import { InventoryService } from '../../services/inventoryService';
import type { InventoryItem } from '../../types';
import { useRealtimeInventory } from '../../hooks/useRealtimeInventory';
import { MovementInput } from '../Combat/MovementInput';
import { MovementService } from '../../services/movementService'
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
  // REMOVED: hasActedThisTurn - no longer needed
  sessionId?: string;
  allTokens?: BattleToken[];
  session?: any;

  // Persistent state props
  elementalStains: Array<'fire' | 'ice' | 'nature' | 'light'>;
  setElementalStains: (stains: Array<'fire' | 'ice' | 'nature' | 'light'>) => Promise<void>;
  abilityPoints: number;
  setAbilityPoints: (points: number) => Promise<void>;
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
  fire: 'Burn: +5 damage/turn for 3 rounds',
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
  // REMOVED: hasActedThisTurn
  sessionId = 'test-session',
  allTokens = [],
  session,
  // Persistent state props
  elementalStains,
  setElementalStains,
  abilityPoints,
  setAbilityPoints,
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
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const { gold: goldAmount, inventory, loading: inventoryLoading } = useRealtimeInventory(character?.id || '');

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
    requiresSpecificStain?: ElementType;
  } | null>(null);

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
  const addStain = async (element: ElementType) => {
    if (elementalStains.length >= 5) return;
    const newStains = [...elementalStains, element];
    await setElementalStains(newStains);
  };

  // Remove oldest stains
  const consumeStains = async (count: number): Promise<ElementType[]> => {
    if (elementalStains.length < count) return [];
    const consumed = elementalStains.slice(0, count);
    const remaining = elementalStains.slice(count);
    await setElementalStains(remaining);
    return consumed;
  };

  // Get unique available elements for ultimate
  const getAvailableElements = (): ElementType[] => {
    return Array.from(new Set(elementalStains));
  };

  // Check for specific stain types
  const hasStainType = (stainType: ElementType): boolean => {
    return elementalStains.includes(stainType);
  };

  // Consume specific stain type
  const consumeSpecificStain = async (stainType: ElementType): Promise<boolean> => {
    const stainIndex = elementalStains.indexOf(stainType);
    if (stainIndex === -1) return false;
    
    const newStains = [...elementalStains];
    newStains.splice(stainIndex, 1);
    await setElementalStains(newStains);
    return true;
  };

  // Define Lune's actions
  const basicAttack = {
    type: 'basic' as const,
    id: 'elemental_bolt',
    name: 'Elemental Bolt',
    description: 'Ranged spell attack with random element. Turn ends automatically.',
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
      description: 'Consume 1 stain for enhanced damage + status effect. Turn ends automatically.',
      damage: '1d10 + status effect',
      cost: 1,
      range: 'Unlimited',
    },
    {
      type: 'ability' as const,
      id: 'twin_catalyst',
      name: 'Twin Catalyst',
      description: 'Fire two elemental bolts using oldest 2 stains. Turn ends automatically.',
      damage: '2 × 1d10 elemental',
      cost: 2,
      multiTarget: true,
      range: 'Unlimited',
    },
    {
      type: 'heal' as const,
      id: 'natures_balm',
      name: "Nature's Balm",
      description: 'Heal an ally (or yourself) for 2d6 HP. Turn ends automatically.',
      damage: '2d6 healing',
      cost: 'nature',
      range: 'Unlimited',
      isHealing: true,
      requiresSpecificStain: 'nature' as ElementType,
    },
  ];

  const ultimateAbility = {
    type: 'ultimate' as const,
    id: 'elemental_genesis',
    name: 'Elemental Genesis',
    description: 'Choose element for powerful terrain/support effect. Turn ends automatically.',
    cost: 3,
    range: 'Battlefield',
    onePerRest: true
  };

  // Handle action selection
  const handleActionSelect = (action: any) => {
    // REMOVED: hasActedThisTurn check
    
    // Check if Elemental Strike is on cooldown
    if (action.id === 'elemental_strike' && hasActiveElementalStrikeEffect()) {
      alert('Elemental Strike is on cooldown! Wait for the current status effect to expire.');
      return;
    }
    
    // Check if we have enough stains for abilities
    if (action.type === 'ability' && action.cost) {
      if (elementalStains.length < action.cost) {
        alert(`Not enough stains! Need ${action.cost}, have ${elementalStains.length}`);
        return;
      }
    }

    if (action.type === 'heal' && action.requiresSpecificStain) {
      if (!hasStainType(action.requiresSpecificStain as ElementType)) {
        alert(`Need a ${action.requiresSpecificStain} stain to use ${action.name}!`);
        return;
      }
    } else if (action.type === 'heal' && action.cost) {
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
    setSelectedIceWallOrientation(null);
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

    // Check for nature stain specifically
    if (!hasStainType('nature')) {
      alert('Need a nature stain to use Nature\'s Balm!');
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
      
      // Consume only the nature stain
      const consumed = consumeSpecificStain('nature');
      if (!consumed) {
        console.error('Failed to consume nature stain');
      }

      if (onTargetSelect) {
        onTargetSelect('action_taken', 0, 'heal', 'natures_balm');
      }

      console.log(`Nature's Balm: Healed ${targetAlly.name} for ${healValue} HP using nature stain`);
      
      setSelectedAction(null);
      setSelectedTarget('');
      setHealAmount('');
      
      // STREAMLINED: Auto-end turn after healing
      if (onEndTurn) {
        onEndTurn();
      }
      
    } catch (error) {
      console.error('Failed to apply healing:', error);
      alert('Failed to apply healing. Please try again.');
    }
  };

  const executeUltimate = async (element: ElementType) => {
    console.log(`Starting Elemental Genesis - ${element}`);
    console.log('Selected ice wall orientation:', selectedIceWallOrientation);

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
      
      console.log('Action data being sent:', JSON.stringify(actionData, null, 2));
      const action = await FirestoreService.createUltimateAction(sessionId, actionData);
      console.log('Ultimate action created successfully:', action);

    } catch (error) {
      console.error('Failed to create ultimate action:', error);
    }
  };

  // UPDATED: Auto-end turn after actions
  const handleConfirmAction = async () => {
    if (!selectedAction) return;

    if (sessionId) {
      FirestoreService.clearTargetingState(sessionId);
    }

    // Handle Nature's Balm healing
    if (selectedAction.id === 'natures_balm') {
      await handleConfirmHeal();
      return; // handleConfirmHeal handles turn ending
    }

    // Handle Elemental Genesis (Ultimate)
    if (selectedAction.id === 'elemental_genesis') {
      if (!selectedUltimateElement) {
        alert('Please select an element for your Genesis!');
        return;
      }
      if (selectedUltimateElement === 'ice' && !selectedIceWallOrientation) {
        alert('Please select row or column for your Ice Wall!');
        return;
      }
      await executeUltimate(selectedUltimateElement);
      setSelectedAction(null);
      
      // STREAMLINED: Auto-end turn after ultimate
      if (onEndTurn) {
        onEndTurn();
      }
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
      // Track which element was consumed for Elemental Strike BEFORE consuming
      let consumedElement: ElementType | null = null;
      
      if (selectedAction.id === 'elemental_strike' && elementalStains.length > 0) {
        // Get the first (oldest) stain that will be consumed
        consumedElement = elementalStains[0];
        console.log('Elemental Strike will consume:', consumedElement, 'from stains:', elementalStains);
      }

      if (selectedAction.multiTarget) {
        for (const targetId of selectedTargets) {
          if (onTargetSelect) {
            onTargetSelect(targetId, acRollNum, selectedAction.type, selectedAction.id);
          }
        }
      } else {
        if (onTargetSelect) {
          onTargetSelect(selectedTarget, acRollNum, selectedAction.type, selectedAction.id);
        }
      }

      // Consume stains AFTER recording which element was consumed
      if (selectedAction.cost && typeof selectedAction.cost === 'number') {
        const consumedStains = consumeStains(selectedAction.cost);
        console.log('Consumed stains:', consumedStains);
      }

      // Apply status effect for Elemental Strike (only for single target)
      if (selectedAction.id === 'elemental_strike' && consumedElement && selectedTarget) {
        console.log('Applying status effect:', consumedElement, 'to target:', selectedTarget);
        
        const statusEffectMap: Record<ElementType, any> = {
          fire: { turnsRemaining: 3, damage: 5, appliedOnRound: session?.combatState?.round || 1 },
          ice: { turnsRemaining: 2, appliedOnRound: session?.combatState?.round || 1 },
          light: { turnsRemaining: 2, appliedOnRound: session?.combatState?.round || 1 },
          nature: null // Nature doesn't apply a lasting effect
        };

        if (consumedElement !== 'nature') {
          const statusEffect = statusEffectMap[consumedElement];
          if (statusEffect && selectedTarget) {
            // Apply the status effect directly to the token
            const updateData: any = {};
            const effectKey = consumedElement === 'light' ? 'blind' : consumedElement;
            updateData[`tokens.${selectedTarget}.statusEffects.${effectKey}`] = statusEffect;
            
            await FirestoreService.updateBattleSession(sessionId, updateData);
            
            console.log(`Applied ${consumedElement} status effect to ${selectedTarget}`);
          }
        } else {
          console.log('Nature element - push effect will be handled by GM');
        }
      }

      setSelectedAction(null);
      setSelectedTarget('');
      setSelectedTargets([]);
      setACRoll('');
      setElementRoll('');
      setShowTargetingModal(false);
      
      // STREAMLINED: Auto-end turn after action
      if (onEndTurn) {
        onEndTurn();
      }
      
    } catch (error) {
      console.error('Error executing action:', error);
      alert('Failed to execute action. Please try again.');
    }
  };

  const hasActiveElementalStrikeEffect = (): boolean => {
    if (!allTokens || allTokens.length === 0) return false;
    
    // Check all enemy tokens for status effects
    const enemiesWithEffects = allTokens.filter(token => 
      token.type === 'enemy' && 
      token.statusEffects && 
      (token.statusEffects.fire || token.statusEffects.ice || token.statusEffects.blind)
    );
    
    return enemiesWithEffects.length > 0;
  };

  const handleCancelAction = () => {
    setSelectedAction(null);
    setSelectedTarget('');
    setSelectedTargets([]);
    setTwinCatalystSelections({});
    setSelectedIceWallOrientation(null);
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
                  style={{ imageRendering: 'crisp-edges' }}
                />
              </div>
            </div>
          </div>
        )}
        
        {/* REMOVED: Action Status notification since we auto-end turns */}

        {/* STREAMLINED: Simple turn instruction */}
        {isMyTurn && combatActive && (
          <div className="mb-4 p-3 bg-green-900 bg-opacity-20 rounded-lg border border-green-600">
            <p className="text-green-200 text-sm font-bold">
              ⚡ Select any action below - your turn will end automatically after completion!
            </p>
          </div>
        )}

        {/* HP TRACKER */}
        <HPTracker currentHP={character.currentHP} maxHP={character.maxHP} onHPChange={onHPChange} isLoading={isLoading} showControls={false} />

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
                  disabled={!isMyTurn || !combatActive}
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
                  {abilities.map((ability) => {
                    // Check if Elemental Strike is on cooldown
                    const isElementalStrikeOnCooldown = ability.id === 'elemental_strike' && hasActiveElementalStrikeEffect();
                    
                    // Create the condition once to use in both places
                    const isDisabled = !isMyTurn || !combatActive || 
                      isElementalStrikeOnCooldown ||
                      (ability.requiresSpecificStain 
                        ? !hasStainType(ability.requiresSpecificStain)
                        : elementalStains.length < (typeof ability.cost === 'number' ? ability.cost : 0)
                      );

                    return (
                      <button
                        key={ability.id}
                        onClick={() => handleActionSelect(ability)}
                        disabled={isDisabled}
                        className={`w-full p-3 rounded-lg transition-colors text-left border ${
                          isDisabled
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
                            {ability.requiresSpecificStain ? `${ability.requiresSpecificStain} stain` : `${ability.cost} stains`}
                          </span>
                          {isElementalStrikeOnCooldown && (
                            <span className="ml-2 text-xs bg-red-900 text-red-200 px-2 py-1 rounded">
                              ON COOLDOWN
                            </span>
                          )}
                        </div>
                        <div className="text-sm opacity-90 mt-1">
                          {isElementalStrikeOnCooldown 
                            ? 'Wait for current status effect to expire'
                            : ability.description
                          }
                        </div>
                        <div className="text-xs text-clair-gold-200 mt-1">{ability.damage}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ultimate Ability - Elemental Genesis */}
              <div className="mt-4">
                <h4 className="text-sm font-bold text-yellow-300 mb-2">Ultimate Ability</h4>
                <button
                  onClick={() => handleActionSelect(ultimateAbility)}
                  disabled={!isMyTurn || !combatActive || elementalStains.length < 3 || elementalGenesisUsed}
                  className={`w-full p-3 rounded-lg font-semibold text-white transition-all duration-200 text-left ${
                    !isMyTurn || !combatActive || elementalStains.length < 3 || elementalGenesisUsed
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
                <p className="text-xs text-yellow-300 mt-1">
                  ⚡ Turn will end automatically after this action
                </p>
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

                  {/* Ice Wall Orientation Selection */}
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

          {/* REMOVED: End Turn button - no longer needed */}

          {/* Tips - Updated */}
          <div className="mt-4 p-3 bg-clair-mystical-900 bg-opacity-20 rounded-lg border border-clair-mystical-600">
            <h4 className="font-serif font-bold text-clair-mystical-400 text-sm mb-2">Combat Tips:</h4>
            <ul className="text-xs text-clair-mystical-300 space-y-1">
              <li>⚡ Your turn ends automatically after any action</li>
              <li>• Elemental Bolt generates stains based on 1d4 roll</li>
              <li>• Abilities consume oldest stains first</li>
              <li>• Fire burns, Ice freezes, Nature pushes, Light blinds</li>
              <li>• Twin Catalyst can target same enemy twice</li>
              <li>• Nature's Balm heals allies for 2d6 HP (requires nature stain)</li>
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
        selectedTargets={selectedTargets}
        abilityName={selectedAction?.name}
        abilityRange={999}
        multiTarget={selectedAction?.multiTarget}
        maxTargets={selectedAction?.id === 'twin_catalyst' ? 2 : undefined}
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