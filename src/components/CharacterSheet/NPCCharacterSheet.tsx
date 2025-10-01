// src/components/CharacterSheet/NPCCharacterSheet.tsx
// Enhanced NPC Character Sheet with level integration and portraits

import React, { useState, useEffect } from 'react';
import { Heart, Shield, Sword, ChevronRight, Target, X, User } from 'lucide-react';
import { FirestoreService } from '../../services/firestoreService';
import type { GMCombatAction } from '../../types';
import { doc, updateDoc, arrayUnion, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useUltimateVideo } from '../../hooks/useUltimateVideo';
import { useCooldowns } from '../../hooks/useCooldowns';
import { CooldownService } from '../../services/CooldownService';
import { ProtectionService } from '../../services/ProtectionService';

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
  session?: any;  // ADD THIS LINE if not already there

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
        description: 'Move behind nearest ally (Maelle preferred). Turn ends. 2 turn cooldown.',
        type: 'movement',
        needsTarget: false,
        cooldown: 2,
        automatic: false // NOT automatic
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
        description: 'Allies gain +1 AC until Farmhand\'s next turn',
        type: 'buff',
        range: 30,
        needsAllyTarget: false,
        cooldown: 2, // 2 round cooldown after use
        appliesEffect: 'ac_buff',
        buffValue: 1,
        buffDuration: 'until_next_turn'
      }
    ],
    level2: [
      {
        name: 'Enhanced Pitchfork Jab',
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
        range: 5,
        needsTarget: false,
        cooldown: 3
      }
    ],
    level3: [
      {
        name: 'Hearthlight',
        description: 'Create healing aura (15ft radius). Heals allies 5hp/turn for 3 rounds. Once per battle.',
        type: 'ultimate',
        needsTarget: false,
        range: 15,
        healPerTurn: 5,
        duration: 3
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
  const [hasPinningEnchantment, setHasPinningEnchantment] = useState(false);
  const [enchantmentType, setEnchantmentType] = useState<'pin-slow' | 'pin-restrain' | null>(null);
  const [ultimateUsed, setUltimateUsed] = useState(false);
  const [summonedSword, setSummonedSword] = useState<any>(null);
  const { triggerUltimate } = useUltimateVideo(sessionId || 'test-session');
  const { cooldowns, applyCooldown, isOnCooldown } = useCooldowns(
    sessionId,
    npcToken?.id
  );
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

  // Update the cooldown decrement effect
    useEffect(() => {
      const decrementCooldowns = async () => {
        if (isNPCTurn && sessionId && npcToken) {
          await CooldownService.decrementCooldowns(sessionId, npcToken.id);
        }
      };

      if (isNPCTurn) {
        decrementCooldowns();
      }
    }, [isNPCTurn, sessionId, npcToken?.id]);

    // Clear cooldowns when combat ends
    useEffect(() => {
      if (!sessionId) return;

      let hasCleared = false; // Track if we've already cleared

      const unsubscribe = FirestoreService.subscribeToBattleSession(sessionId, async (session) => {
        const combatActive = session?.combatState?.isActive || false;

        // Only clear once when combat becomes inactive
        if (!combatActive && npcToken && !hasCleared) {
          hasCleared = true;
          
          // Check if there are actually cooldowns to clear
          const token = session?.tokens?.[npcToken.id];
          if (token?.cooldowns && Object.keys(token.cooldowns).length > 0) {
            await CooldownService.clearAllCooldowns(sessionId, npcToken.id);
            console.log('Combat ended - Cooldowns cleared');
          }
        }
        
        // Reset the flag when combat starts again
        if (combatActive) {
          hasCleared = false;
        }
      });

      return () => unsubscribe();
    }, [sessionId, npcToken?.id]);

  useEffect(() => {
    const checkUltimateUsage = async () => {
      const session = await FirestoreService.getBattleSession(sessionId);
      setUltimateUsed(session?.theChildUltimateUsed || false);
      
      const combatActive = session?.combatState?.isActive || false;
      
      if (!combatActive) {
        setUltimateUsed(true);
      }
    };
    
    checkUltimateUsage();
    
    const interval = setInterval(checkUltimateUsage, 1000);
    
    return () => clearInterval(interval);
  }, [sessionId]);

  // Calculate distance between two positions
  const calculateDistance = (pos1: { x: number; y: number }, pos2: { x: number; y: number }): number => {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    return Math.max(dx, dy) * 5;
  };

  // Get available abilities based on level
  const getAvailableAbilities = () => {
    const npcType = npc?.id === 'the-child' ? 'the-child' : 'farmhand';
    const abilities: any[] = [];
    
    if (npc?.id === 'the-child') {
      const level = npc?.level || 1;
      
      if (level === 1) {
        abilities.push(...NPC_ABILITIES['the-child'].level1);
      } else if (level === 2) {
        abilities.push(
          NPC_ABILITIES['the-child'].level2[0], // Upgraded Dagger Throw
          NPC_ABILITIES['the-child'].level2[1], // Pinning Throw
          NPC_ABILITIES['the-child'].level1[1]  // Keep Reposition
        );
      } else if (level === 3) {
        abilities.push(...NPC_ABILITIES['the-child'].level3);
        abilities.push(NPC_ABILITIES['the-child'].level1[1]); // Keep Reposition
      }
    } else {

      const level = npc?.level || 1;

     if (level === 1) {
        // Level 1: Basic abilities only
        abilities.push(...NPC_ABILITIES[npcType].level1);
      } else if (level === 2) {
        // Level 2: Replace Pitchfork Jab with Enhanced version, keep Rallying Cry, add Interpose
        abilities.push(
          NPC_ABILITIES[npcType].level2[0], // Enhanced Pitchfork Jab
          NPC_ABILITIES[npcType].level1[1], // Rallying Cry
          NPC_ABILITIES[npcType].level2[1]  // Interpose
        );
      } else if (level >= 3) {
        // Level 3: All level 2 abilities + Hearthlight
        abilities.push(
          NPC_ABILITIES[npcType].level2[0], // Enhanced Pitchfork Jab
          NPC_ABILITIES[npcType].level1[1], // Rallying Cry
          NPC_ABILITIES[npcType].level2[1], // Interpose
          NPC_ABILITIES[npcType].level3[0]  // Hearthlight
        );
      }
    }
    
    return abilities;
  };

  // Get valid targets for abilities
  const getValidTargets = (ability: any) => {
    if (!npcToken?.position) return [];
    
    if (ability.needsAllyTarget) {
      return availableAllies.filter(ally => {
        if (ally.id === npcToken.id) return false;
        const distance = calculateDistance(npcToken.position, ally.position);
        return distance <= (ability.range || 30);
      });
    } else if (ability.type === 'ranged' || ability.type === 'melee') {
      return availableEnemies.filter(enemy => {
        const distance = calculateDistance(npcToken.position, enemy.position);
        return distance <= (ability.range || 5);
      });
    }
    
    return [];
  };

  // Helper function to find the appropriate ally for repositioning
  const findNearestAlly = (): any => {
    if (!npcToken?.position || !availableAllies.length) return null;
    
    // Filter out the child itself
    const validAllies = availableAllies.filter(ally => ally.id !== npcToken.id);
    
    if (validAllies.length === 0) return null;
    
    // Calculate distances to all allies
    const alliesWithDistance = validAllies.map(ally => ({
      ally,
      distance: calculateDistance(npcToken.position, ally.position)
    }));
    
    // Find the minimum distance
    const minDistance = Math.min(...alliesWithDistance.map(a => a.distance));
    
    // Get all allies at the minimum distance
    const closestAllies = alliesWithDistance
      .filter(a => a.distance === minDistance)
      .map(a => a.ally);
    
    // If only one ally at minimum distance, return it
    if (closestAllies.length === 1) {
      console.log(`🎯 The Child repositions behind ${closestAllies[0].name}`);
      return closestAllies[0];
    }
    
    // If multiple allies at same distance, check if Maelle is among them
    const maelle = closestAllies.find(ally => 
      ally.name?.toLowerCase() === 'maelle' || 
      ally.characterId?.toLowerCase() === 'maelle' ||
      ally.id?.toLowerCase().includes('maelle')
    );
    
    if (maelle) {
      console.log(`💕 The Child repositions behind Maelle (special bond)`);
      return maelle;
    }
    
    // Otherwise, pick randomly from the closest allies
    const randomIndex = Math.floor(Math.random() * closestAllies.length);
    const chosenAlly = closestAllies[randomIndex];
    console.log(`🎲 The Child randomly repositions behind ${chosenAlly.name}`);
    
    return chosenAlly;
  };

  // Helper function to reposition behind ally
  const repositionBehindAlly = async (ally: any) => {
    if (!npcToken || !sessionId) return;
    
    console.log(`📍 Repositioning The Child behind ${ally.name} at (${ally.position.x}, ${ally.position.y})`);
    
    // Calculate position behind ally (opposite from nearest enemy)
    const enemies = availableEnemies;
    let behindPosition = null;
    
    const possiblePositions = [];
    
    if (enemies.length > 0) {
      // Find average enemy position to determine threat direction
      const avgEnemyX = enemies.reduce((sum, e) => sum + e.position.x, 0) / enemies.length;
      const avgEnemyY = enemies.reduce((sum, e) => sum + e.position.y, 0) / enemies.length;
      
      // Calculate direction from enemies to ally
      const dx = ally.position.x - avgEnemyX;
      const dy = ally.position.y - avgEnemyY;
      
      // Primary position: directly opposite from enemies
      if (Math.abs(dx) > Math.abs(dy)) {
        possiblePositions.push({
          x: ally.position.x + (dx > 0 ? 1 : -1),
          y: ally.position.y
        });
      } else {
        possiblePositions.push({
          x: ally.position.x,
          y: ally.position.y + (dy > 0 ? 1 : -1)
        });
      }
      
      // Add diagonal positions as alternatives
      possiblePositions.push(
        { x: ally.position.x + (dx > 0 ? 1 : -1), y: ally.position.y + (dy > 0 ? 1 : -1) },
        { x: ally.position.x + (dx > 0 ? 1 : -1), y: ally.position.y - (dy > 0 ? 1 : -1) },
        { x: ally.position.x - (dx > 0 ? 1 : -1), y: ally.position.y + (dy > 0 ? 1 : -1) }
      );
    }
    
    // If no enemies, or as fallback, add all 8 adjacent squares
    possiblePositions.push(
      { x: ally.position.x - 1, y: ally.position.y - 1 },
      { x: ally.position.x, y: ally.position.y - 1 },
      { x: ally.position.x + 1, y: ally.position.y - 1 },
      { x: ally.position.x - 1, y: ally.position.y },
      { x: ally.position.x + 1, y: ally.position.y },
      { x: ally.position.x - 1, y: ally.position.y + 1 },
      { x: ally.position.x, y: ally.position.y + 1 },
      { x: ally.position.x + 1, y: ally.position.y + 1 }
    );
    
    // Check for a valid unoccupied position
    const allTokens = [...availableEnemies, ...availableAllies];
    
    for (const pos of possiblePositions) {
      // Check if position is within grid bounds (20x15 grid)
      if (pos.x < 0 || pos.x >= 20 || pos.y < 0 || pos.y >= 15) continue;
      
      // Check if position is unoccupied
      const isOccupied = allTokens.some(t => 
        t.position.x === pos.x && t.position.y === pos.y
      );
      
      if (!isOccupied) {
        behindPosition = pos;
        break;
      }
    }
    
    // If no valid position found (shouldn't happen), default to one square south
    if (!behindPosition) {
      console.warn('⚠️ No valid adjacent position found, defaulting to south');
      behindPosition = { 
        x: ally.position.x, 
        y: Math.min(14, ally.position.y + 1) 
      };
    }
    
    // Update position in Firebase
    try {
      await FirestoreService.updateTokenPosition(sessionId, npcToken.id, behindPosition);
      console.log(`✅ The Child repositioned to (${behindPosition.x}, ${behindPosition.y})`);
    } catch (error) {
      console.error('Failed to reposition The Child:', error);
    }
  };

  const handleHearthlight = async () => {
    if (!npcToken || !sessionId) return;
    
    // Check if already used this battle
    const session = await FirestoreService.getBattleSession(sessionId);
    if (session?.hearthlightUsed) {
      alert('Hearthlight already used this battle!');
      return;
    }

    setIsExecuting(true);
    try {

      try {
        await triggerUltimate('farmhand', 'Hearthlight');
      } catch (error) {
        console.error('Failed to trigger ultimate video:', error);
      }

      // Calculate affected squares in 15ft radius (3 squares)
      const affectedSquares: Array<{ x: number; y: number }> = [];
      const radius = 3; // 15ft = 3 squares
      
      for (let x = npcToken.position.x - radius; x <= npcToken.position.x + radius; x++) {
        for (let y = npcToken.position.y - radius; y <= npcToken.position.y + radius; y++) {
          const distance = Math.sqrt(
            Math.pow(x - npcToken.position.x, 2) + 
            Math.pow(y - npcToken.position.y, 2)
          );
          if (distance <= radius && x >= 0 && y >= 0 && x < 20 && y < 15) {
            affectedSquares.push({ x, y });
          }
        }
      }

      // Create Hearthlight zone
      await FirestoreService.createHearthlightZone(sessionId, {
        center: npcToken.position,
        radius: 15,
        affectedSquares,
        healPerTurn: 5,
        duration: 3,
        createdBy: npcToken.id,
        createdByName: npc.name
      });

      // Mark as used
      await FirestoreService.updateBattleSession(sessionId, {
        hearthlightUsed: true
      });

      alert(`🌟 Hearthlight activated! Allies in the aura will heal 5hp at the start of each of ${npc.name}'s turns for 3 rounds.`);
      
      await FirestoreService.nextTurn(sessionId);
    } catch (error) {
      console.error('Failed to activate Hearthlight:', error);
      alert('Failed to activate Hearthlight!');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleInterpose = async () => {
    if (!npcToken || !sessionId) return;

    // Get valid allies (within 5ft)
    const validAllies = availableAllies.filter(ally => {
      if (ally.id === npcToken.id) return false;
      const distance = calculateDistance(npcToken.position, ally.position);
      return distance <= 5;
    });

    if (validAllies.length === 0) {
      alert('No allies within 5ft to protect!');
      return;
    }

    // For now, protect the closest ally (you can add a modal to choose)
    const closestAlly = validAllies.reduce((closest, ally) => {
      const closestDist = calculateDistance(npcToken.position, closest.position);
      const allyDist = calculateDistance(npcToken.position, ally.position);
      return allyDist < closestDist ? ally : closest;
    });

    setIsExecuting(true);
    try {
      await ProtectionService.activateProtection(
        sessionId,
        npcToken.id,
        npc.name,
        closestAlly.id,
        'Interpose'
      );

      // Apply 3-turn cooldown
      await applyCooldown('interpose', 'Interpose', 3);

      alert(`🛡️ ${npc.name} is now protecting ${closestAlly.name}! Attacks will be redirected until ${npc.name}'s next turn.`);
      await FirestoreService.nextTurn(sessionId);
    } catch (error) {
      console.error('Failed to activate Interpose:', error);
      alert('Failed to activate Interpose!');
    } finally {
      setIsExecuting(false);
    }
  };


    const handleReposition = async () => {
    if (!npcToken || !sessionId) return;

    setIsExecuting(true);
    try {
      // Find the nearest ally
      const ally = findNearestAlly();
      if (!ally) {
        alert('No allies in range to reposition behind!');
        return;
      }

      // Use the existing repositionBehindAlly function to calculate and move
      await repositionBehindAlly(ally);

      // Apply cooldown using new system
      await applyCooldown('reposition', 'Reposition', 2);

      // End turn
      await FirestoreService.nextTurn(sessionId);
    } catch (error) {
      console.error('Failed to reposition:', error);
      alert('Failed to reposition!');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleActionSelect = (ability: any) => {
    if (!isNPCTurn || isExecuting) return;

     // Check cooldown using new system
    let abilityId = '';
    if (ability.name === 'Reposition') {
      abilityId = 'reposition';
    } else if (ability.name === 'Rallying Cry') {
      abilityId = 'rallying_cry';
    } else if (ability.name === 'Interpose') {
      abilityId = 'interpose';
    } else {
      abilityId = ability.name.toLowerCase().replace(/\s+/g, '_');
    }

    if (isOnCooldown(abilityId)) {
      const remainingTurns = cooldowns[abilityId] || 0;
      alert(`${ability.name} is on cooldown for ${remainingTurns} more turn(s)`);
      return;
    }


    // Handle Reposition ability
    if (ability.name === 'Reposition') {
      handleReposition();
      return;
    }

    if (ability.name === 'Rallying Cry') {
      handleRallyingCry();
      return;
    }

    if (ability.name === 'Interpose') {
      handleInterpose();
      return;
    }
    if (ability.name === 'Hearthlight') {
      handleHearthlight();
      return;
    }

    
    // Check if this is the ultimate and if it's already used
    if (ability.type === 'ultimate' && ultimateUsed) {
      alert('Ultimate ability already used this battle!');
      return;
    }
    
    // Handle Pinning Throw enchantment
    if (ability.type === 'enchantment') {
      setHasPinningEnchantment(true);
      setEnchantmentType(ability.appliesEffect as 'pin-slow' | 'pin-restrain');
      alert(`Dagger enchanted! Next attack will ${ability.appliesEffect === 'pin-slow' ? 'slow' : 'restrain'} the target. You can now throw your dagger!`);
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
      setSelectedAction(ability);
    }
  };

  // Update Rallying Cry handler
  const handleRallyingCry = async () => {
    if (!npcToken || !sessionId) return;

    setIsExecuting(true);
    try {
      await FirestoreService.applyRallyingCryBuff(sessionId, npcToken.id);

      // Apply cooldown using new system
      await applyCooldown('rallying_cry', 'Rallying Cry', 2);

      const action: GMCombatAction = {
        id: `rallying-cry-${Date.now()}`,
        type: 'ability',
        playerId: npcToken.id,
        playerName: npc.name,
        targetId: 'all-allies',
        targetName: 'All Allies',
        sourcePosition: npcToken?.position || { x: 0, y: 0 },
        acRoll: 0,
        range: 30,
        timestamp: new Date(),
        resolved: true,
        hit: true,
        abilityName: 'Rallying Cry (+1 AC)',
        needsDamageInput: false,
        damageApplied: false,
      };

      await FirestoreService.addCombatAction(sessionId, action);
      // alert('🛡️ Rallying Cry activated! All allies gain +1 AC until Farmhand\'s next turn.');
      await FirestoreService.nextTurn(sessionId);
    } catch (error) {
      console.error('Failed to execute Rallying Cry:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSummonSword = async (ability: any) => {
    if (!npcToken || !sessionId) return;
    
    setIsExecuting(true);
    try {
      const ownerId = npcToken.characterId ?? npcToken.id;
      
      const currentSession = await FirestoreService.getBattleSession(sessionId);
      const currentRound = currentSession?.combatState?.round || 1;

      try {
        await triggerUltimate('the-child', 'For My Brother');
      } catch (error) {
        console.error('Failed to trigger ultimate video:', error);
      }

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
          type: 'npc' as const,
          color: '#9333ea',
          size: 1
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
      
      let statusEffect = null;
      if (hit && hasPinningEnchantment) {
        statusEffect = enchantmentType;
        setHasPinningEnchantment(false);
        setEnchantmentType(null);
      }
      
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
        needsDamageInput: hit,
        damageApplied: false,
        statusEffect
      };
      
      await FirestoreService.addCombatAction(sessionId, action);
      
      if (hit && statusEffect) {
        await FirestoreService.applyStatusEffect(sessionId, selectedTarget, statusEffect);
      }
      
      await FirestoreService.nextTurn(sessionId);
      
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

  const abilities = getAvailableAbilities();

  return (
    <>
      <div className="px-4 py-6 space-y-4">
        {/* NPC Header with Portrait */}
        <div className="bg-gradient-to-br from-clair-mystical-600 to-clair-mystical-800 rounded-lg p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
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
              
              <div>
                <h2 className="text-2xl font-bold text-white">{npc?.name || 'NPC'}</h2>
                <div className="flex items-center gap-4 text-sm text-clair-gold-200 mt-1">
                  <span>Level {npc?.level || 1}</span>
                  <span>AC {npc?.ac || 12}</span>
                  <span>HP: {npc?.currentHP || 0}/{npc?.maxHP || 14}</span>
                </div>
              </div>
            </div>
            
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
                     let abilityId = '';
                      if (ability.name === 'Reposition') {
                        abilityId = 'reposition';
                      } else if (ability.name === 'Rallying Cry') {
                        abilityId = 'rallying_cry';
                      } else if (ability.name === 'Interpose') {
                        abilityId = 'interpose';
                      } else {
                        abilityId = ability.name.toLowerCase().replace(/\s+/g, '_');
                      }                  
                                        const cooldown = cooldowns[abilityId] || 0;
                    const onCooldown = cooldown > 0;
                    const needsTargets = ability.type === 'ranged' || ability.type === 'melee' || ability.needsAllyTarget;
                    
                    let hasTargets = true;
                    let outOfRange = false;

                    if (ability.name === 'Reposition') {
                      const alliesInRange = availableAllies.filter(ally => {
                        if (ally.id === npcToken?.id) return false;
                        const distance = calculateDistance(npcToken?.position || {x: 0, y: 0}, ally.position);
                        return distance <= 15;
                      });
                      hasTargets = alliesInRange.length > 0;
                      outOfRange = !hasTargets && availableAllies.length > 0;
                    } else if (needsTargets) {
                      const validTargets = getValidTargets(ability);
                      hasTargets = validTargets.length > 0;
                    }


                    if (ability.type === 'ultimate' && ultimateUsed) {
                      hasTargets = false;
                    }

                    const isEnchantedAttack = ability.type === 'ranged' && hasPinningEnchantment;

                    return (
                      <button
                        key={index}
                        onClick={() => handleActionSelect(ability)}
                        disabled={!hasTargets || isExecuting || onCooldown}
                        className={`w-full p-3 rounded-lg text-white border transition-all text-left ${
                          hasTargets && !onCooldown
                            ? 'bg-clair-shadow-600 hover:bg-clair-shadow-500 border-clair-gold-500'
                            : 'bg-gray-700 border-gray-600 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Sword className="w-4 h-4 text-clair-gold-400" />
                          <span className="font-bold">{ability.name}</span>
                          {onCooldown && (
                            <span className="text-xs bg-gray-600 px-2 py-1 rounded">
                              Cooldown: {cooldown} turn(s)
                            </span>
                          )}
                          {isEnchantedAttack && (
                            <span className="text-xs bg-purple-500 px-2 py-1 rounded animate-pulse">
                              ENCHANTED - {enchantmentType === 'pin-slow' ? 'SLOW' : 'RESTRAIN'}
                            </span>
                          )}
                          {ability.type === 'ultimate' && (
                            <span className="text-xs bg-yellow-600 px-2 py-1 rounded">ULTIMATE</span>
                          )}
                          {needsTargets && !hasTargets && !onCooldown && (
                            <span className="text-xs text-red-400">(No targets in range)</span>
                          )}
                          {ability.type === 'ultimate' && ultimateUsed && (
                            <span className="text-xs text-red-400">(Already used)</span>
                          )}
                          {ability.name === 'Reposition' && outOfRange && (
                            <span className="text-xs text-red-400">(No allies within 15ft)</span>
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
            ) : null}
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

// Targeting modal component for NPCs (keeping this the same)
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