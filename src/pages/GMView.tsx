// src/pages/GMView.tsx - With Storm System Integration
import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { BattleMap } from '../components/BattleMap/BattleMap';
import { GMHPController } from '../components/GMHPController';
import { InitiativeTracker } from '../components/Combat/InitiativeTracker';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { useCombat } from '../hooks/useCombat';
import { useGMHPControl } from '../hooks/useGMHPControl';
import { useStormSystem } from '../hooks/useStormSystem';
import { StormService } from '../services/StormService';
import { Plus, Users, Map, Monitor, Wrench, Sword, Zap, Target, Ship, Bot } from 'lucide-react';
import type { Position, BattleToken, InitiativeEntry, CombatState, GMCombatAction, Character } from '../types';
import { GMCombatPopup } from '../components/Combat/GMCombatPopup';
import { StormPopup } from '../components/Combat/StormPopup';
import { StormIndicator } from '../components/Combat/StormIndicator';
import { FirestoreService } from '../services/firestoreService';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { EnemySelectionModal } from '../components/Combat/EnemySelectionModal';
import type { EnemyData } from '../types';
import { X } from 'lucide-react';
import { HPSyncService } from '../services/HPSyncService';
import { SimpleCharacterDisplay } from '../components/GM/SimpleCharacterDisplay';
import { HPSettingsModal } from '../components/GM/HPSettingsModal';
import { ResetButton } from '../components/GM/ResetButton';
import { EnemyPanel } from '../components/Combat/EnemyPanel';
import { MapSelector, AVAILABLE_MAPS, type MapConfig } from '../components/GM/MapSelector';
import { NPCPanel } from '../components/Combat/NPCPanel';
import { ExpeditionNPCModal } from '../components/Combat/ExpeditionNPCModal';
import { BattlePresetManager } from '../components/GM/BattlePresetManager';
import type { BattleMapPreset } from '../types';
import { useAudio } from '../hooks/useAudio';
import { Package } from 'lucide-react'; // Add Package to your existing lucide imports
import { GMInventoryModal } from '../components/GM/GMInventoryModal'; // Add this import
import { InventoryService } from '../services/inventoryService'; // Add this import
import { handleEnemyGroupTurn } from '../utils/enemyHelperUtil';
import { 
  getEnemyGroups, 
  updateEnemyGroupsInInitiative 
} from '../utils/enemyHelperUtil';
import { useBrowserWarning } from '../hooks/useBrowserWarning';
import NPCLevelManager from '../components/NPCLevelManager';
import { mapFirebaseToLocal } from '../utils/npcLevelMapper';
import { PlayerTokenManager } from '../components/Combat/PlayerTokenManager';
import { MineManagementPanel } from '../components/Combat/MineManagementPanel';
import { MineService } from '../services/MineService';
import { MovementService } from '../services/movementService';


export function GMView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  // NEW: Enemy selection state
  const [showEnemyModal, setShowEnemyModal] = useState(false);
  const [selectedEnemyType, setSelectedEnemyType] = useState<EnemyData | null>(null);
  const [isPlacingEnemy, setIsPlacingEnemy] = useState(false);
  const [openHPModal, setOpenHPModal] = useState<string | null>(null);
  const [turretAttacksTriggered, setTurretAttacksTriggered] = useState<Set<string>>(new Set());
  const [currentMap, setCurrentMap] = useState<MapConfig>(AVAILABLE_MAPS[0]); // Default to first map
  const [showExpeditionModal, setShowExpeditionModal] = useState(false);
  const [pendingExpeditioner, setPendingExpeditioner] = useState<BattleToken | null>(null);
  const [showNPCModal, setShowNPCModal] = useState(false);
  const [selectedNPCType, setSelectedNPCType] = useState<BattleToken | null>(null);
  const [isPlacingNPC, setIsPlacingNPC] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [charactersWithInventory, setCharactersWithInventory] = useState<Character[]>([]);
  const [npcLevels, setNpcLevels] = useState<{ theChild: number; farmhand: number } | null>(null);
  const [swordActedThisRound, setSwordActedThisRound] = useState<{ round: number; acted: boolean }>({ round: 0, acted: false });
  const [isPlacingPlayer, setIsPlacingPlayer] = useState(false);
  const [selectedPlayerCharacter, setSelectedPlayerCharacter] = useState<any>(null);
  const [isPlacingMine, setIsPlacingMine] = useState(false);

  const PLAYER_CHARACTERS = [
  { id: 'maelle', name: 'Maelle', maxHp: 28, ac: 15, color: '#9333ea' },
  { id: 'gustave', name: 'Gustave', maxHp: 32, ac: 15, color: '#ef4444' },
  { id: 'lune', name: 'Lune', maxHp: 22, ac: 14, color: '#8b5cf6' },
  { id: 'sciel', name: 'Sciel', maxHp: 24, ac: 14, color: '#10b981' }
];

  const [ultimateInteractionMode, setUltimateInteractionMode] = useState<{
    active: boolean;
    type: 'fire_terrain' | 'ice_wall' | null;
    actionId: string | null;
  }>({
    active: false,
    type: null,
    actionId: null
  });

  // IMPORTANT: All hooks must be called at the top level, before any early returns
  const {
    session,
    loading,
    error,
    attemptMove,
    addToken,
    removeToken,
    startCombat,
    endCombat,
    nextTurn,
    setInitiativeOrder,
    isCombatActive,
  } = useCombat(sessionId || '');

    const { 
    playBattleMusic, 
    stopBattleMusic, 
    isBattleMusicPlaying,
    isLoading: audioLoading 
  } = useAudio();

  useBrowserWarning({
    enabled: true,
    message: '⚠️ Warning: You are the Game Master. Leaving will pause the game for all players. Are you sure?'
  });

  // Storm system integration
  const { stormState, pendingRoll, isStormActive } = useStormSystem(sessionId || '');
  const tokens = Object.entries(session?.tokens || {})
    .filter(([key, value]) => {
      // Filter out null/undefined tokens
      if (!value) {
        console.warn(`Null token found with key: ${key}`);
        return false;
      }
      // Filter out tokens without essential properties
      if (!value.name || !value.position) {
        console.warn(`Invalid token found with key: ${key}`, value);
        return false;
      }
      return true;
    })
    .map(([key, value]) => ({
      ...value,
      id: value.id || key, // Ensure ID exists (use key as fallback)
      position: value.position || { x: 0, y: 0 }, // Ensure position exists
      name: value.name || 'Unknown', // Ensure name exists
    }));
    const players = tokens.filter((t) => t.type === 'player');

  // Move this hook to the top level
  const gmHPControl = useGMHPControl({ sessionId: sessionId || 'test-session' });

  const calcDist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) * 5;

  // Auto turret attacks
   const handleTurretAutoAttacks = useCallback(async () => {
    if (!session?.combatState?.isActive) return;

    const currentTurnKey = `${session.combatState.currentTurn}-${session.combatState.round}`;
    
    // Prevent duplicate attacks for the same turn/round
    if (turretAttacksTriggered.has(currentTurnKey)) {
      return;
    }

    const tokens = Object.values(session.tokens);
    const turrets = tokens.filter((t) => t.name?.includes('Turret') && t.type === 'npc' && (t.hp ?? 0) > 0);

    if (turrets.length === 0) return;

    // Mark this turn as having triggered turret attacks
    setTurretAttacksTriggered(prev => new Set(prev).add(currentTurnKey));

    for (const turret of turrets) {
      const enemies = tokens.filter((t) => t.type === 'enemy' && (t.hp ?? 0) > 0);
      const inRange = enemies
        .map((e) => ({ e, d: calcDist(turret.position, e.position) }))
        .filter((x) => x.d <= 20)
        .sort((a, b) => a.d - b.d);
      const closest = inRange[0];
      if (!closest) continue;

      const enemy = closest.e;
      const roll = Math.floor(Math.random() * 20) + 1 + 5;
      const enemyAC = enemy.ac ?? 13;
      const hit = roll >= enemyAC;

      const action: GMCombatAction = {
        id: `turret-attack-${turret.id}-${Date.now()}-${Math.random()}`, // More unique ID
        type: 'attack',
        playerId: 'gustave',
        targetId: enemy.id,
        sourcePosition: turret.position,
        acRoll: roll,
        range: 20,
        timestamp: new Date(),
        resolved: false,
        hit,
        playerName: turret.name,
        targetName: enemy.name,
        abilityName: 'Auto-Attack (1d6 damage)',
        needsDamageInput: hit,
        damageApplied: false,
      };

      const ref = doc(db, 'battleSessions', sessionId || 'test-session');
      await updateDoc(ref, { pendingActions: arrayUnion(action), updatedAt: serverTimestamp() });
    }
  }, [session?.combatState?.isActive, session?.combatState?.currentTurn, session?.combatState?.round, session?.tokens, sessionId, turretAttacksTriggered]);


const handleRepairMaelleToken = async () => {
  if (!sessionId || !session) {
    alert('❌ Session not loaded');
    return;
  }
  
  const maelleToken = session.tokens?.['token-maelle'];
  
  // Check if token is corrupted (missing essential properties)
  if (!maelleToken?.id || !maelleToken?.name || !maelleToken?.position) {
    console.log('🔧 Repairing corrupted Maelle token...');
    
    const repairedToken = {
      id: 'token-maelle',
      characterId: 'maelle',
      name: 'Maelle',
      position: { x: 2, y: 12 },
      type: 'player' as const,
      hp: 28,
      maxHp: 28,
      ac: 15,
      size: 1,
      color: '#4f46e5',
      afterimageStacks: 0,
      maxAfterimageStacks: 5,
      phantomStrikeUsed: false
    };
    
    await FirestoreService.updateBattleSession(sessionId, {
      'tokens.token-maelle': repairedToken
    });
    
    alert('✅ Maelle token has been repaired!');
  } else {
    alert('✅ Token is fine, no repair needed');
  }
};

  // Updated handleSwordAutoAttack with better logging
const handleSwordAutoAttack = useCallback(async () => {
  console.log('🗡️ handleSwordAutoAttack triggered');
  console.log('  - Combat active?', session?.combatState?.isActive);
  console.log('  - Active summons?', session?.activeSummons);
  
  if (!session?.combatState?.isActive) {
    console.log('  ❌ Combat not active');
    return;
  }
  
  if (!session?.activeSummons || session.activeSummons.length === 0) {
    console.log('  ❌ No active summons');
    return;
  }

  // Find active Brother's Sword
  const currentRound = session.combatState?.round || 1;
  const activeSword = session.activeSummons.find(
    (summon: any) => {
      const isBrothersSword = summon.name === "Brother's Sword";
      const notExpired = !summon.expiresOnRound || currentRound < summon.expiresOnRound;
      return isBrothersSword && notExpired;
    }
  );
  
  if (!activeSword) {
    console.log("  ❌ Brother's Sword: Not found or expired");
    return;
  }
  
  console.log('  ✅ Found active sword summon:', activeSword);

  const tokens = Object.values(session.tokens);
  const swordToken = tokens.find((t: any) => t.id === activeSword.id);
  
  if (!swordToken) {
    console.log(`  ❌ Could not find sword token with ID: ${activeSword.id}`);
    console.log('  Available token IDs:', tokens.map((t: any) => t.id));
    return;
  }
  
  if ((swordToken.hp || 0) <= 0) {
    console.log('  ❌ Sword has no HP');
    return;
  }

  console.log(`  ✅ Found sword token at position (${swordToken.position.x}, ${swordToken.position.y})`);

  // Helper function to calculate grid distance
  const calcGridDistance = (pos1: Position, pos2: Position): number => {
    return Math.max(
      Math.abs(pos1.x - pos2.x),
      Math.abs(pos1.y - pos2.y)
    );
  };

  // Find all living enemies
  const enemies = tokens.filter((t: any) => t.type === 'enemy' && (t.hp || 0) > 0);
  
  if (enemies.length === 0) {
    console.log("  ❌ No enemies on battlefield");
    return;
  }

  console.log(`  Found ${enemies.length} enemies on battlefield`);

  // Check for enemies within attack range (5ft = 1 square)
  const enemiesInRange = enemies.filter((enemy: any) => 
    calcGridDistance(swordToken.position, enemy.position) <= 1
  );

  let targetEnemy = null;
  let newSwordPosition = { ...swordToken.position };

  if (enemiesInRange.length > 0) {
    // If enemies are in range, pick one at random to attack
    targetEnemy = enemiesInRange[Math.floor(Math.random() * enemiesInRange.length)];
    console.log(`  ${enemiesInRange.length} enemies in range, attacking ${targetEnemy.name}`);
  } else {
    // No enemies in range, find the closest enemy
    const enemyDistances = enemies.map((enemy: any) => ({
      enemy,
      distance: calcGridDistance(swordToken.position, enemy.position)
    })).sort((a, b) => a.distance - b.distance);

    // Get all enemies at the minimum distance
    const minDistance = enemyDistances[0].distance;
    const closestEnemies = enemyDistances.filter(ed => ed.distance === minDistance);
    
    // Pick one at random if multiple at same distance
    const targetData = closestEnemies[Math.floor(Math.random() * closestEnemies.length)];
    const moveTarget = targetData.enemy;
    
    console.log(`  Moving towards ${moveTarget.name} at (${moveTarget.position.x}, ${moveTarget.position.y})`);
    console.log(`  Current distance: ${minDistance} squares`);

    // Calculate movement (max 3 squares = 15ft)
    const dx = moveTarget.position.x - swordToken.position.x;
    const dy = moveTarget.position.y - swordToken.position.y;
    
    // Move up to 3 squares towards the target
    let remainingMovement = 3;
    let moveX = 0;
    let moveY = 0;

    // Prioritize diagonal movement to close distance faster
    if (dx !== 0 && dy !== 0 && remainingMovement > 0) {
      // Move diagonally
      const diagonalMoves = Math.min(Math.abs(dx), Math.abs(dy), remainingMovement);
      moveX = Math.sign(dx) * diagonalMoves;
      moveY = Math.sign(dy) * diagonalMoves;
      remainingMovement -= diagonalMoves;
    }
    
    // Move remaining distance in x or y
    if (remainingMovement > 0) {
      const remainingDx = dx - moveX;
      const remainingDy = dy - moveY;
      
      if (Math.abs(remainingDx) > Math.abs(remainingDy)) {
        moveX += Math.sign(remainingDx) * Math.min(Math.abs(remainingDx), remainingMovement);
      } else if (remainingDy !== 0) {
        moveY += Math.sign(remainingDy) * Math.min(Math.abs(remainingDy), remainingMovement);
      }
    }

    newSwordPosition = {
      x: swordToken.position.x + moveX,
      y: swordToken.position.y + moveY
    };
    
    console.log(`  Movement: (${moveX}, ${moveY})`);
    console.log(`  Moving from (${swordToken.position.x}, ${swordToken.position.y}) to (${newSwordPosition.x}, ${newSwordPosition.y})`);
    
    // Update sword position
    await FirestoreService.updateTokenPosition(sessionId || 'test-session', swordToken.id, newSwordPosition);
    
    console.log(`  ✅ Sword moved to (${newSwordPosition.x}, ${newSwordPosition.y})`);

    // Check if we can attack after moving
    const distanceAfterMove = calcGridDistance(newSwordPosition, moveTarget.position);
    if (distanceAfterMove <= 1) {
      targetEnemy = moveTarget;
      console.log("  Can attack after movement!");
    } else {
      console.log(`  Still ${distanceAfterMove} squares away, waiting for next turn`);
    }
  }

  // Attack if we have a target
  if (targetEnemy) {
    const action: GMCombatAction = {
      id: `sword-attack-${Date.now()}-${Math.random()}`,
      type: 'attack',
      playerId: 'the-child',
      targetId: targetEnemy.id,
      sourcePosition: newSwordPosition,
      acRoll: 999, // Auto-hit
      range: 5,
      timestamp: new Date(),
      resolved: false,
      hit: true,
      playerName: "Brother's Sword",
      targetName: targetEnemy.name,
      abilityName: 'Spectral Slash (6 damage)',
      needsDamageInput: false,
      damageApplied: false,
    };

    // Add the action to pending actions
    const ref = doc(db, 'battleSessions', sessionId || 'test-session');
    await updateDoc(ref, { 
      pendingActions: arrayUnion(action), 
      updatedAt: serverTimestamp() 
    });
    
    // Auto-apply the fixed 6 damage
    setTimeout(async () => {
      await applyFixedDamageToEnemy(sessionId || 'test-session', action.id, 6);
    }, 500);
    
    console.log(`  ⚔️ Sword attacks ${targetEnemy.name} for 6 damage!`);
  }
}, [session?.combatState?.isActive, session?.activeSummons, session?.tokens, sessionId]);


  const applyFixedDamageToEnemy = async (sessionId: string, actionId: string, damage: number) => {
    const session = await FirestoreService.getBattleSession(sessionId);
    if (!session || !session.pendingActions) return;

    const action = session.pendingActions.find((a: any) => a.id === actionId);
    if (!action || !action.targetId) return;

    const targetToken = session.tokens[action.targetId];
    if (!targetToken) return;

    const currentHP = Number(targetToken.hp) || 0;
    const newHP = Math.max(0, currentHP - damage);
    
    console.log(`Brother's Sword: Applying ${damage} damage to ${targetToken.name}: ${currentHP} -> ${newHP}`);

    const updatedActions = session.pendingActions.map((a: any) =>
      a.id === actionId ? { ...a, resolved: true, damage: damage, damageApplied: true } : a
    );

    const ref = doc(db, 'battleSessions', sessionId);
    
    if (newHP <= 0) {
      // Enemy is dead - remove the token
      const updatedTokens = { ...session.tokens };
      delete updatedTokens[action.targetId];
      
      await updateDoc(ref, { 
        tokens: updatedTokens,
        pendingActions: updatedActions, 
        updatedAt: serverTimestamp() 
      });
      
      console.log(`${targetToken.name} was defeated by Brother's Sword!`);
    } else {
      // Enemy survives - update HP
      await updateDoc(ref, {
        [`tokens.${action.targetId}.hp`]: newHP,
        pendingActions: updatedActions,
        updatedAt: serverTimestamp()
      });
    }
  };

   useEffect(() => {
    const loadCharactersWithInventory = async () => {
      if (players.length > 0) {
        const characterIds = players.map(p => p.characterId || p.id).filter(Boolean);
        const characters = await InventoryService.getAllCharacterInventories(characterIds);
        setCharactersWithInventory(characters);
      }
    };

    loadCharactersWithInventory();
  }, [players]);

  useEffect(() => {
    if (session?.npcLevels) {
      // Use the mapper utility to convert Firebase format to local format
      setNpcLevels(mapFirebaseToLocal(session.npcLevels));
    }  else {
        if (session) {
        setNpcLevels({ theChild: 1, farmhand: 1 });
      }
    }
  }, [session]);

  // NEW: Add this useEffect to detect pending ultimate actions
  useEffect(() => {
    if (!session?.pendingActions) return;
    
    // Check for pending ultimate actions that need GM interaction
    const pendingUltimate = session.pendingActions.find(action => 
      action.ultimateType === 'elemental_genesis' && 
      action.needsGMInteraction && 
      !action.resolved
    );
    
    if (pendingUltimate && !ultimateInteractionMode.active) {
      if (pendingUltimate.element === 'fire') {
        setUltimateInteractionMode({
          active: true,
          type: 'fire_terrain',
          actionId: pendingUltimate.id
        });
      } else if (pendingUltimate.element === 'ice') {
        setUltimateInteractionMode({
          active: true,
          type: 'ice_wall', 
          actionId: pendingUltimate.id
        });
      }
    } else if (!pendingUltimate && ultimateInteractionMode.active) {
      // No pending ultimate, clear interaction mode
      setUltimateInteractionMode({
        active: false,
        type: null,
        actionId: null
      });
    }
  }, [session?.pendingActions, ultimateInteractionMode.active]);

  useEffect(() => {
    if (session?.combatState?.currentTurn === 'gustave' && session?.combatState?.isActive) {
      const t = setTimeout(() => handleTurretAutoAttacks(), 800);
      return () => clearTimeout(t);
    }
  }, [session?.combatState?.currentTurn, session?.combatState?.isActive, session?.combatState?.round]);


  // ===== ADD THIS NEW CLEANUP useEffect =====
  useEffect(() => {
    if (!session?.combatState?.isActive) {
      setTurretAttacksTriggered(new Set());
    }
  }, [session?.combatState?.isActive]);

  useEffect(() => {
    // Check if it's The Child's turn
    const isChildsTurn = session?.combatState?.currentTurn === 'the-child' || 
      (session?.combatState?.initiativeOrder?.find(
        e => e.id === session.combatState?.currentTurn
      )?.name === 'The Child');

      const currentRound = session?.combatState?.round || 0;
  
      // Reset the sword action tracker when round changes
      if (currentRound !== swordActedThisRound.round) {
        setSwordActedThisRound({ round: currentRound, acted: false });
      }
    
    if (isChildsTurn && 
        session?.combatState?.isActive && 
        session?.activeSummons && 
        !swordActedThisRound.acted && 
        currentRound === swordActedThisRound.round) {
      
      const timeout = setTimeout(() => {
        handleSwordAutoAttack();
        setSwordActedThisRound({ round: currentRound, acted: true });
      }, 800);
      
      return () => clearTimeout(timeout);
    }
  }, [session?.combatState?.currentTurn, session?.combatState?.isActive, session?.activeSummons, handleSwordAutoAttack]);

  // Damage routing (AoE vs single)
  const handleApplyDamage = async (actionId: string, damage: number) => {
    try {
      const a = session?.pendingActions?.find((x) => x.id === actionId) as
        | GMCombatAction
        | undefined;
      const isAoE = Array.isArray(a?.targetIds) && (a!.targetIds!.length > 0);
      if (isAoE) {
        await FirestoreService.applyAoEDamage(sessionId || 'test-session', actionId, damage);
      } else {
        await FirestoreService.applyDamageToEnemy(sessionId || 'test-session', actionId, damage);
      }
    } catch (e) {
      console.error('Error applying damage:', e);
    }
  };

  const handleSelectPlayerForPlacement = (character: any) => {
    setSelectedPlayerCharacter(character);
    setIsPlacingPlayer(true);
    console.log(`📍 Click on the map to place ${character.name}`);
  };

  const handleRemovePlayerToken = async (tokenId: string) => {
    if (!sessionId) return;
    
    try {
      const session = await FirestoreService.getBattleSession(sessionId);
      if (!session) return;

      const updatedTokens = { ...session.tokens };
      delete updatedTokens[tokenId];

      const updatedInitiative = session.combatState?.initiativeOrder.filter(
        entry => entry.id !== tokenId && entry.characterId !== tokenId
      ) || [];

      await FirestoreService.updateBattleSession(sessionId, {
        tokens: updatedTokens,
        'combatState.initiativeOrder': updatedInitiative,
        'combatState.turnOrder': updatedInitiative.map(e => e.id),
        updatedAt: new Date()
      });

      console.log('✅ Player token removed from map and initiative');
    } catch (error) {
      console.error('❌ Failed to remove player token:', error);
    }
  };

  const handlePresetLoad = (preset: BattleMapPreset) => {
    console.log(`Loading preset: ${preset.name}`);
    // The FirestoreService.loadBattleMapPreset already updates the session
    // The real-time listener will automatically update the local state
    // You could add a toast notification here if desired
  };

  const handleMapChange = async (map: MapConfig) => {
  if (!sessionId) return;
  
  try {
    // Update local state immediately for responsive UI
    setCurrentMap(map);
    
    // Update session in Firestore
    await import('../services/firestoreService').then(({ FirestoreService }) =>
      FirestoreService.updateBattleSession(sessionId, {
        currentMap: map,
        updatedAt: new Date()
      })
    );
    
    console.log(`Switched to map: ${map.name}`);
  } catch (error) {
    console.error('Failed to switch map:', error);
    // Revert local state on error
    setCurrentMap(currentMap);
  }
};

const handleExpeditionerSelected = (expeditioner: BattleToken) => {
  // Get current level from session
  const npcType = expeditioner.name.toLowerCase().includes('child') ? 'the-child' : 'farmhand';
  const currentLevel = session?.npcLevels?.[npcType === 'the-child' ? 'newRecruit' : 'farmhand'] || 1;
  
  // Calculate HP based on level
  const getHPForLevel = (baseHP: number, level: number, npcType: string): number => {
    if (npcType === 'the-child') {
      const hpByLevel = [14, 25, 35];
      return hpByLevel[level - 1] || baseHP;
    } else {
      const hpByLevel = [30, 40, 50];
      return hpByLevel[level - 1] || baseHP;
    }
  };
  
  const levelAdjustedHP = getHPForLevel(expeditioner.maxHp || 30, currentLevel, npcType);
  
  // Update token with level-adjusted HP
  const adjustedToken = {
    ...expeditioner,
    hp: levelAdjustedHP,
    maxHp: levelAdjustedHP,
    npcLevel: currentLevel
  };
  
  setPendingExpeditioner(adjustedToken);
  setShowExpeditionModal(false);
};

  const handleMapClickForExpeditioner = async (position: Position) => {
    if (pendingExpeditioner && sessionId) {
      try {
        const expeditionerToAdd = { 
          ...pendingExpeditioner, 
          position
        };
        
        await FirestoreService.addToken(sessionId, expeditionerToAdd);
        setPendingExpeditioner(null);
        console.log('✅ Expeditioner placed:', expeditionerToAdd.name, 'at position', position);
      } catch (error) {
        console.error('❌ Failed to add expeditioner:', error);
      }
    }
  };

  const handleNPCSelected = (npcToken: BattleToken) => {
    // Get current level from session
    const npcType = npcToken.name.toLowerCase().includes('child') ? 'the-child' : 'farmhand';
    const currentLevel = session?.npcLevels?.[npcType === 'the-child' ? 'newRecruit' : 'farmhand'] || 1;
    
    // Calculate HP based on level
    const getHPForLevel = (baseHP: number, level: number, npcType: string): number => {
      if (npcType === 'the-child') {
        const hpByLevel = [14, 25, 35];
        return hpByLevel[level - 1] || baseHP;
      } else {
        const hpByLevel = [30, 40, 50];
        return hpByLevel[level - 1] || baseHP;
      }
    };
    
    const levelAdjustedHP = getHPForLevel(npcToken.maxHp || 30, currentLevel, npcType);
    
    // Update token with level-adjusted HP
    const adjustedToken = {
      ...npcToken,
      hp: levelAdjustedHP,
      maxHp: levelAdjustedHP,
      npcLevel: currentLevel
    };
    
    setSelectedNPCType(adjustedToken);
    setIsPlacingNPC(true);
    setShowNPCModal(false);
  };

  const handleCancelNPCPlacement = () => {
    setSelectedNPCType(null);
    setIsPlacingNPC(false);
  };

  const handleRemoveNPC = async (npcId: string) => {
    try {
      await FirestoreService.removeToken(sessionId || 'test-session', npcId);
      console.log('✅ NPC removed:', npcId);
    } catch (error) {
      console.error('❌ Failed to remove NPC:', error);
    }
  };

  const handleEditNPCHP = async (npcId: string, newHP: number) => {
    try {
      await FirestoreService.updateTokenHP(sessionId || 'test-session', npcId, newHP);
      console.log('✅ NPC HP updated');
    } catch (error) {
      console.error('❌ Failed to update NPC HP:', error);
    }
  };

  const handleClearAllNPCs = async () => {
    const npcs = tokens.filter(t => t.type === 'npc');
    if (npcs.length === 0) {
      alert('No expedition crew members on the map');
      return;
    }

  const confirmed = window.confirm(`Remove all ${npcs.length} expedition crew members from the map?`);
    if (!confirmed) return;

    try {
      await FirestoreService.removeTokensByType(sessionId || 'test-session', 'npc');
      console.log('✅ All expedition crew cleared from battlefield');
    } catch (error) {
      console.error('❌ Failed to clear expedition crew:', error);
    }
  };

  const handleRemoveToken = async (tokenId: string) => {
    if (!sessionId) return;
    try {
      await FirestoreService.removeToken(sessionId, tokenId);
    } catch (error) {
      console.error('❌ Failed to remove token:', error);
    }
  };

  const handleClearAllExpeditioners = async () => {
    if (!sessionId) return;
    
    const expeditioners = tokens.filter(t => t.type === 'npc');
    if (expeditioners.length === 0) return;
    
  const confirmed = window.confirm(`Remove all ${expeditioners.length} expedition crew members from the map?`);    if (!confirmed) return;
    
    try {
      for (const expeditioner of expeditioners) {
        await FirestoreService.removeToken(sessionId, expeditioner.id);
      }
      console.log('✅ All expedition crew cleared from battlefield');
    } catch (error) {
      console.error('❌ Failed to clear expedition crew:', error);
    }
  };


  const handleRemoveEnemy = async (enemyId: string) => {
    try {
      await removeToken(enemyId);
    } catch (e) {
      console.error('Error removing enemy:', e);
    }
  };

  const handleEditEnemyHP = async (enemyId: string, newHP: number) => {
    try {
      const ref = doc(db, 'battleSessions', sessionId || 'test-session');
      await updateDoc(ref, {
        [`tokens.${enemyId}.hp`]: newHP,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error('Error updating enemy HP:', e);
    }
  };

  const handleDismissMiss = async (actionId: string) => {
    try {
      await FirestoreService.dismissMissAction(sessionId || 'test-session', actionId);
    } catch (e) {
      console.error('Error dismissing miss:', e);
    }
  };

  // Add this function inside your GMView component
const handleResetSession = async () => {
  try {
    await FirestoreService.resetBattleSession(sessionId || 'test-session');
    
    // Also reset any local state that might be needed
    setTurretAttacksTriggered(new Set());
    setShowEnemyModal(false);
    setSelectedEnemyType(null);
    setIsPlacingEnemy(false);
    
    console.log('✅ Session reset complete');
  } catch (error) {
    console.error('❌ Reset failed:', error);
    alert('Failed to reset session. Please try again.');
  }
};

  const handleTokenMove = async (tokenId: string, newPosition: Position): Promise<boolean> => {
  if (!session) return false;

  // Use MovementService which now handles mines correctly
  // (moves to mine, triggers explosion, moves back)
  return await MovementService.moveToken(
    session.id || 'test-session',
    tokenId,
    newPosition
  );
};


  const handleAddEnemy = async (pos: Position) => {
    const tok: BattleToken = {
      id: `enemy-${Date.now()}`,
      name: 'Enemy',
      position: pos,
      type: 'enemy',
      hp: 20,
      maxHp: 20,
      ac: 13,
      color: '#dc2626',
    };
    await addToken(tok);
  };

  const handleEnemySelected = (enemyData: EnemyData) => {
    setSelectedEnemyType(enemyData);
    setIsPlacingEnemy(true);
    setShowEnemyModal(false);
  };
  const handleCancelEnemyPlacement = () => {
    setSelectedEnemyType(null);
    setIsPlacingEnemy(false);
  };

  const handlePlaceMineMode = () => {
    setIsPlacingMine(true);
    console.log('💣 Click on the map to place a mine');
  };

  const handleClearAllMines = async () => {
    if (window.confirm('Clear all mines from the map?')) {
      await MineService.clearAllMines(sessionId || 'test-session');
    }
  };



  const handleGridClick = async (position: Position) => {

    // MINE PLACEMENT - ADD THIS FIRST
  if (isPlacingMine) {
    await MineService.placeMine(sessionId || 'test-session', position);
    setIsPlacingMine(false);
    console.log(`💣 Mine placed at (${position.x}, ${position.y})`);
    return;
  }

    // PLAYER PLACEMENT - ADD THIS FIRST
  if (isPlacingPlayer && selectedPlayerCharacter) {
    console.log(`👤 Placing ${selectedPlayerCharacter.name} at:`, position);

    if (!session || !sessionId) {
      console.error('Session not available');
      alert('Session not available. Please refresh and try again.');
      setSelectedPlayerCharacter(null);
      setIsPlacingPlayer(false);
      return;
    }

    try {
      const playerTokenId = `player-${selectedPlayerCharacter.id}-${Date.now()}`;
      const playerToken: BattleToken = {
        id: playerTokenId,
        characterId: selectedPlayerCharacter.id,
        name: selectedPlayerCharacter.name,
        position: position,
        type: 'player',
        hp: selectedPlayerCharacter.maxHp,
        maxHp: selectedPlayerCharacter.maxHp,
        ac: selectedPlayerCharacter.ac,
        size: 1,
        color: selectedPlayerCharacter.color
      };

      const updatedTokens = { ...session.tokens, [playerTokenId]: playerToken };
      let currentInitiativeOrder = session.combatState?.initiativeOrder || [];

      const alreadyInInitiative = currentInitiativeOrder.some(
        entry => entry.characterId === selectedPlayerCharacter.id
      );

      if (!alreadyInInitiative) {
        const initiativeRoll = Math.floor(Math.random() * 20) + 1;
        console.log(`🎲 Rolling initiative for ${selectedPlayerCharacter.name}: ${initiativeRoll}`);

        const newInitiativeEntry = {
          id: playerTokenId,
          characterId: selectedPlayerCharacter.id,
          name: selectedPlayerCharacter.name,
          initiative: initiativeRoll,
          type: 'player' as const,
          hasActed: false
        };

        currentInitiativeOrder = [...currentInitiativeOrder, newInitiativeEntry]
          .sort((a, b) => b.initiative - a.initiative);

        console.log(`➕ Added ${selectedPlayerCharacter.name} to initiative with roll: ${initiativeRoll}`);
      }

      await FirestoreService.updateBattleSession(sessionId || 'test-session', {
        tokens: updatedTokens,
        'combatState.initiativeOrder': currentInitiativeOrder,
        'combatState.turnOrder': currentInitiativeOrder.map(e => e.id),
        updatedAt: new Date()
      });

      console.log(`✅ ${selectedPlayerCharacter.name} placed on battlefield`);
      setSelectedPlayerCharacter(null);
      setIsPlacingPlayer(false);

    } catch (error) {
      console.error('❌ Failed to place player token:', error);
      alert('Failed to place player token. Please try again.');
    }

    return; // Stop here, don't continue to other placement logic
  }

    console.log('Grid clicked at:', position, 'Interaction mode:', ultimateInteractionMode);
    
    // Handle Ultimate interactions first (highest priority)
    if (ultimateInteractionMode.active && ultimateInteractionMode.actionId) {
      try {
        if (ultimateInteractionMode.type === 'fire_terrain') {
          console.log('🔥 Placing Fire Terrain at:', position);
          await FirestoreService.createFireTerrain(
            sessionId || 'test-session',
            ultimateInteractionMode.actionId,
            position
          );
          
          // Clear interaction mode
          setUltimateInteractionMode({
            active: false,
            type: null,
            actionId: null
          });
          
          console.log('🔥 Fire Terrain placed successfully!');
          return;
        }
        
        if (ultimateInteractionMode.type === 'ice_wall') {
          console.log('🧊 Ice wall placement clicked at:', position);
          // For ice wall, we need to let GM choose row or column
          // For simplicity, let's make it create a horizontal wall at clicked row

            const pendingUltimate = session?.pendingActions?.find(action => 
              action.id === ultimateInteractionMode.actionId && 
              action.ultimateType === 'elemental_genesis' && 
              action.element === 'ice'
            );

            if (!pendingUltimate) {
              console.error('Could not find pending ice wall action');
              return;
            }

          const wallType = pendingUltimate.wallType || 'row';
          console.log('🧊 Wall type from action:', pendingUltimate.wallType); // ADD THIS LINE  
          console.log('🧊 Final wall type (with fallback):', wallType); // ADD THIS LINE
  
          const wallSquares: Array<{ x: number; y: number }> = [];
          let wallIndex: number;

          
          if (wallType === 'row') {
            // Create horizontal wall across entire row
            wallIndex = position.y;
            for (let x = 0; x < 20; x++) {
              wallSquares.push({ x, y: position.y });
            }
            console.log(`🧊 Creating HORIZONTAL ice wall at row ${position.y}`);
          } else {
            // Create vertical wall down entire column
            wallIndex = position.x;
            for (let y = 0; y < 15; y++) {
              wallSquares.push({ x: position.x, y });
            }
            console.log(`🧊 Creating VERTICAL ice wall at column ${position.x}`);
          }
          
          await FirestoreService.createIceWall(
            sessionId || 'test-session',
            ultimateInteractionMode.actionId,
            {
              type: wallType,
              index: wallIndex,
              squares: wallSquares
            }
          );
          
          // Clear interaction mode
          setUltimateInteractionMode({
            active: false,
            type: null,
            actionId: null
          });
          
          console.log('🧊 Ice Wall placed successfully!');
          return;
        }
      } catch (error) {
        console.error('Failed to handle ultimate interaction:', error);
      }
      
      return; // Don't continue to enemy placement if we're in ultimate mode
    }

    if (session?.pendingActions) {
      const turretPlacementAction = session.pendingActions.find(
        (action: GMCombatAction) => 
          action.type === 'turret_placement' && 
          !action.resolved
      );
      
      if (turretPlacementAction) {
        // Check if this is Brother's Sword specifically
        const isBrothersSword = turretPlacementAction.turretData?.name === "Brother's Sword" ||
                               turretPlacementAction.abilityName?.includes("Brother");
        
        // Find the owner token
        const ownerToken = Object.values(session.tokens).find((t: any) => {
          if (isBrothersSword) {
            // For Brother's Sword, look for The Child
            return t.name === 'The Child' || t.id === turretPlacementAction.playerId;
          }
          // For regular turrets, look by player ID
          const byId = t.id === turretPlacementAction.playerId;
          const byCharacterId = t.characterId === turretPlacementAction.playerId;
          return byId || byCharacterId;
        });

        if (!ownerToken) {
          console.error('Could not find owner token for placement action:', turretPlacementAction);
          alert('Could not find the summoner on the battlefield!');
          return;
        }

        // Check distance (5ft for both turrets and sword)
        const distance = Math.max(
          Math.abs(position.x - ownerToken.position.x),
          Math.abs(position.y - ownerToken.position.y)
        ) * 5;
        
        if (distance > 5) {
          const itemName = isBrothersSword ? "Brother's Sword" : "Turret";
          const ownerName = isBrothersSword ? "The Child" : "Gustave";
          alert(`${itemName} must be placed within 5ft of ${ownerName}!`);
          return;
        }
        
        if (isBrothersSword) {
          // Handle Brother's Sword placement
          console.log('⚔️ Placing Brother\'s Sword at:', position);
          
          // IMPORTANT: Remove any existing Brother's Sword first
          const existingSwords = Object.entries(session.tokens)
            .filter(([id, token]) => token.name === "Brother's Sword")
            .map(([id]) => id);
          
          // Clean up existing sword tokens
          const cleanedTokens = { ...session.tokens };
          existingSwords.forEach(id => {
            delete cleanedTokens[id];
            console.log(`🗑️ Removing old sword token: ${id}`);
          });
          
          // Clean up existing sword from activeSummons
          const cleanedSummons = (session.activeSummons || [])
            .filter((summon: any) => summon.name !== "Brother's Sword");
          
          // Use sword-specific ID format
          const swordId = `sword-${Date.now()}`;
          const swordToken: BattleToken = {
            id: swordId,
            name: "Brother's Sword",
            position,
            type: 'npc',
            hp: 20,
            maxHp: 20,
            ac: 14,
            size: 1,
            color: '#9333ea' // Purple for spectral
          };
          
          try {
            // Add new sword to session
            const updatedTokens = { ...cleanedTokens, [swordId]: swordToken };
            
            // Track the summon with round information
            const currentRound = session.combatState?.round || 1;
            const activeSummons = [
              ...cleanedSummons,
              {
                id: swordId, // Use the same sword ID!
                name: "Brother's Sword",
                summoner: 'the-child',
                roundsRemaining: 5,
                createdAt: Date.now(),
                expiresOnRound: currentRound + 5
              }
            ];
            
            // Mark placement action as resolved
            const updatedActions = session.pendingActions.map((a: GMCombatAction) =>
              a.id === turretPlacementAction.id ? { ...a, resolved: true } : a
            );
            
            await FirestoreService.updateBattleSession(sessionId!, {
              tokens: updatedTokens,
              pendingActions: updatedActions,
              activeSummons: activeSummons,
              updatedAt: new Date()
            });
            
            console.log(`✅ Brother's Sword placed at (${position.x}, ${position.y}) with ID: ${swordId}`);
            console.log(`🗑️ Cleaned up ${existingSwords.length} old sword token(s)`);
            // alert("Brother's Sword has been summoned for 5 rounds!");
            
          } catch (error) {
            console.error("Failed to place Brother's Sword:", error);
            alert("Failed to place Brother's Sword. Please try again.");
          }
        } else {
          // Handle regular turret placement
          console.log('🔫 Placing turret at:', position);
          
          const turretId = `turret-${Date.now()}`;
          const turretToken: BattleToken = {
            id: turretId,
            name: turretPlacementAction.turretData?.name || "Gustave's Turret",
            position,
            type: 'npc',
            hp: turretPlacementAction.turretData?.hp || 10,
            maxHp: turretPlacementAction.turretData?.maxHp || 10,
            ac: 17,
            size: turretPlacementAction.turretData?.size || 1,
            color: turretPlacementAction.turretData?.color || '#8B4513'
          };
          
          try {
            // Add turret to session
            const updatedTokens = { ...session.tokens, [turretId]: turretToken };
            
            // Mark placement action as resolved
            const updatedActions = session.pendingActions.map((a: GMCombatAction) =>
              a.id === turretPlacementAction.id ? { ...a, resolved: true } : a
            );
            
            await FirestoreService.updateBattleSession(sessionId!, {
              tokens: updatedTokens,
              pendingActions: updatedActions,
              updatedAt: new Date()
            });
            
            console.log(`✅ Turret placed at (${position.x}, ${position.y})`);
            
          } catch (error) {
            console.error('Failed to place turret:', error);
            alert('Failed to place turret. Please try again.');
          }
        }
        
        return; // Don't continue to other placement logic
      }
    }



      if (pendingExpeditioner) {
        await handleMapClickForExpeditioner(position);
        return;
      }

    // ENHANCED ENEMY PLACEMENT WITH INITIATIVE AND GROUPING
    if (isPlacingEnemy && selectedEnemyType && session && sessionId) {
      try {
        // Create a unique enemy ID with timestamp
        const enemyId = `enemy-${selectedEnemyType.id}-${Date.now()}`;
        
        // Create the enemy token with full stat block
        const newEnemy: BattleToken = {
          id: enemyId,
          name: selectedEnemyType.name,
          position,
          type: 'enemy',
          hp: selectedEnemyType.hp,
          maxHp: selectedEnemyType.maxHp,
          ac: selectedEnemyType.ac,
          size: selectedEnemyType.size || 1,
          color: selectedEnemyType.color || '#dc2626'
        };

        // Add to session tokens
        const updatedTokens = { ...session.tokens, [enemyId]: newEnemy };
        
        // Store full enemy data for reference
        const updatedEnemyData = { 
          ...session.enemyData, 
          [enemyId]: selectedEnemyType 
        };

        // SPECIAL HANDLING FOR LAMPMASTER: Create lamp tokens
        if (selectedEnemyType.id === 'lampmaster' || selectedEnemyType.name === 'Lampmaster') {
          console.log('🔮 Creating lamp tokens for Lampmaster...');
          
          // Define lamp positions relative to Lampmaster (surrounding it)
          const lampOffsets = [
            { x: -2, y: -1 }, // Top-left
            { x: 2, y: -1 },  // Top-right
            { x: -2, y: 1 },  // Bottom-left
            { x: 2, y: 1 }    // Bottom-right
          ];
          
          // Create 4 lamp tokens
          lampOffsets.forEach((offset, index) => {
            const lampId = `lamp-${index}-${Date.now()}`;
            const lampToken: BattleToken = {
              id: lampId,
              name: `Lamp ${index + 1}`,
              position: {
                x: Math.max(0, Math.min(19, position.x + offset.x)), // Keep within grid bounds
                y: Math.max(0, Math.min(19, position.y + offset.y))
              },
              type: 'enemy', // Lamps are targetable as enemies
              hp: 25,
              maxHp: 25,
              ac: 10,
              size: 1,
              color: '#FFD700', // Gold color for lamps
              statusEffects: {}
            };
            
            updatedTokens[lampId] = lampToken;
            console.log(`🏮 Created Lamp ${index + 1} at (${lampToken.position.x}, ${lampToken.position.y})`);
          });
        }

        // Get current initiative order or create new one
        let currentInitiativeOrder = session.combatState?.initiativeOrder || [];
        
        // Check if enemies of the same type already exist in initiative
        const existingEnemyGroup = currentInitiativeOrder.find(
          entry => entry.type === 'enemy' && 
                   entry.name.replace(/ \(x\d+\)/, '') === selectedEnemyType.name &&
                   !entry.characterId // Group entries don't have characterId
        );

        if (existingEnemyGroup) {
          // Enemy type already exists - update the count using helper function
          console.log(`📊 Adding to existing ${selectedEnemyType.name} group in initiative`);
          
          // Use the helper function to update all enemy group counts
          currentInitiativeOrder = updateEnemyGroupsInInitiative(currentInitiativeOrder, updatedTokens);
          
        } else {
          // New enemy type - roll initiative and create new entry
          const initiativeRoll = Math.floor(Math.random() * 20) + 1;
          console.log(`🎲 Rolling initiative for ${selectedEnemyType.name}: ${initiativeRoll}`);
          
          const newInitiativeEntry: InitiativeEntry = {
            id: `${selectedEnemyType.id}-group-${Date.now()}`, // Group ID
            name: selectedEnemyType.name,
            initiative: initiativeRoll,
            type: 'enemy',
            hasActed: false
          };

          console.log(`➕ Adding new ${selectedEnemyType.name} to initiative with roll: ${initiativeRoll}`);
          
          // Add to initiative order and sort by initiative
          currentInitiativeOrder = [...currentInitiativeOrder, newInitiativeEntry]
            .sort((a, b) => b.initiative - a.initiative);
        }

        // Update the session with new token, enemy data, and initiative
        await FirestoreService.updateBattleSession(sessionId, {
          tokens: updatedTokens,
          enemyData: updatedEnemyData,
          'combatState.initiativeOrder': currentInitiativeOrder,
          'combatState.turnOrder': currentInitiativeOrder.map(e => e.id),
          updatedAt: new Date()
        });

        // Log enemy groups for debugging
        const enemyGroups = getEnemyGroups(updatedTokens);
        console.log(`📊 Current enemy groups:`, enemyGroups.map(g => `${g.type} (x${g.count})`).join(', '));
        
        if (selectedEnemyType.id === 'lampmaster' || selectedEnemyType.name === 'Lampmaster') {
          console.log(`✅ Lampmaster and 4 lamp tokens placed successfully!`);
        } else {
          console.log(`✅ Added ${selectedEnemyType.name} at position (${position.x}, ${position.y})`);
        }        
      } catch (error) {
        console.error('Failed to add enemy:', error);
        alert('Failed to add enemy to battlefield. Please try again.');
      }

      // Reset enemy placement state
      setSelectedEnemyType(null);
      setIsPlacingEnemy(false);
    }

    // Handle NPC placement
// Handle NPC placement (around line 680 in GMView.tsx)
  if (isPlacingNPC && selectedNPCType) {
    console.log('🎭 Placing NPC at:', position);

      if (!session || !sessionId) {
        console.error('Session not available');
        alert('Session not available. Please refresh and try again.');
        setSelectedNPCType(null);
        setIsPlacingNPC(false);
        return;
      }
        
    const npcToken: BattleToken = {
      ...selectedNPCType,
      id: `npc-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      position: position,
      type: 'npc',
      controlledBy: selectedNPCType.controlledBy,
    };

    try {
      // Add NPC to tokens
      const updatedTokens = { ...session.tokens, [npcToken.id]: npcToken };
      
      // Get current initiative order or create new one
      let currentInitiativeOrder = session.combatState?.initiativeOrder || [];
      
      // Roll initiative for the NPC
      const initiativeRoll = Math.floor(Math.random() * 20) + 1;
      console.log(`🎲 Rolling initiative for ${npcToken.name}: ${initiativeRoll}`);
      
      // Create initiative entry for the NPC
      const newInitiativeEntry: InitiativeEntry = {
        id: npcToken.id, // Use the token's ID directly
        name: npcToken.name,
        initiative: initiativeRoll,
        type: 'player',
        hasActed: false,
        characterId: npcToken.controlledBy || npcToken.id,
      };
      
      // Add to initiative order and sort by initiative
      currentInitiativeOrder = [...currentInitiativeOrder, newInitiativeEntry]
        .sort((a, b) => b.initiative - a.initiative);
      
      console.log(`➕ Adding ${npcToken.name} to initiative with roll: ${initiativeRoll}`);
      
      // Update the session with new token and initiative
      await FirestoreService.updateBattleSession(sessionId || 'test-session', {
        tokens: updatedTokens,
        'combatState.initiativeOrder': currentInitiativeOrder,
        'combatState.turnOrder': currentInitiativeOrder.map(e => e.id),
        updatedAt: new Date()
      });
      
      console.log('✅ NPC placed successfully with initiative:', npcToken.name);
      
      // Clear placement mode
      setSelectedNPCType(null);
      setIsPlacingNPC(false);
    } catch (error) {
      console.error('❌ Failed to place NPC:', error);
      alert('Failed to place NPC. Please try again.');
    }
  }
  };


  const handleStartCombat = async (order: InitiativeEntry[]) => {
      try {

       // Reset The Child's ultimate when combat starts
        await FirestoreService.updateBattleSession(sessionId || 'test-session', {
          theChildUltimateUsed: false,  // This resets the ultimate
          updatedAt: new Date()
        });
        console.log('✅ The Child ultimate reset for new battle');
        
        // Start battle music first
        await playBattleMusic();
        console.log('🎵 Battle music started');
        
        // Then start combat
        await startCombat(order);
      } catch (e) {
        console.error('Failed to start combat:', e);
        // If music fails, still try to start combat
        try {
          await startCombat(order);
        } catch (combatError) {
          console.error('Combat start also failed:', combatError);
        }
      }
    };

  // REPLACE the existing handleEndCombat function with this enhanced version:
 const handleEndCombat = async () => {
    try {
      await endCombat();
      
      // End storm if active
      if (isStormActive) {
        await StormService.endStorm(sessionId || 'test-session');
      }
      
      // Reset Lune's ultimate cooldown on combat end
      try {
        await FirestoreService.resetLuneUltimate(sessionId || 'test-session');
        console.log('✅ Lune ultimate reset for next combat');
      } catch (error) {
        console.error('Failed to reset Lune ultimate:', error);
      }
      
      // Stop battle music with fade out
      await stopBattleMusic();
      console.log('🎵 Battle music stopped');
      
    } catch (e) {
      console.error('Failed to end combat:', e);
    }
  };



  const handleNextTurn = async () => {
    try {
      // 🔍 Debug: Log current terrain status before turn advancement
      if (session) {
        FirestoreService.logTerrainEffectsStatus(session);
      }
      
      await nextTurn();
      const sessionData = await FirestoreService.getBattleSession(sessionId || 'test-session');
      const isStormActive = sessionData?.stormState?.isActive;
      const currentTurn = sessionData?.combatState?.currentTurn;
      // If storm is active, trigger storm turn after normal turn advancement
      if (isStormActive && currentTurn === 'sciel') {
        setTimeout(() => {
          StormService.triggerStormTurn(sessionId || 'test-session');
        }, 1000); // Small delay for dramatic effect
      }

      await FirestoreService.cleanupExpiredProtectionEffects(sessionId || 'test-session');

    } catch (e) {
      console.error('Failed to advance turn:', e);
    }
  };

  const handleUpdateInitiative = async (order: InitiativeEntry[]) => {
    try {
      await setInitiativeOrder(order);
    } catch (e) {
      console.error('Failed to update initiative:', e);
    }
  };

  const handleDestroyTurret = async (turretId: string) => {
    try {
      await removeToken(turretId);
    } catch (e) {
      console.error('Error destroying turret:', e);
    }
  };

  // Early returns AFTER all hooks are called
  if (loading) {
    return (
      <div className="min-h-screen bg-clair-shadow-900 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading GM session..." />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-clair-shadow-900 flex items-center justify-center p-4">
        <div className="bg-clair-shadow-700 border border-clair-gold-600 rounded-lg shadow-lg p-6 max-w-md w-full text-center">
          <h2 className="text-lg font-bold text-clair-gold-400 mb-2">GM Session Not Found</h2>
          <p className="text-clair-gold-300 mb-4">{error || 'The requested GM session could not be loaded.'}</p>
          <button
            onClick={() => (window.location.href = '/')}
            className="bg-clair-mystical-500 hover:bg-clair-mystical-600 text-white py-2 px-4 rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const map = { id: session.mapId, name: 'Battle Arena', gridSize: { width: 20, height: 15 }, backgroundImage: undefined, gridVisible: true };
  const combatActive = isCombatActive();

  // Provide fully-typed mutable fallback for InitiativeTracker
  const combatState: CombatState = session.combatState ?? {
    isActive: false,
    currentTurn: '',
    turnOrder: [] as string[],
    round: 1,
    phase: 'setup',
    initiativeOrder: [] as InitiativeEntry[],
  };

  const characterNames: Record<string, string> = {};
  tokens.forEach((t) => {
    if (t.characterId) characterNames[t.characterId] = t.name;
    characterNames[t.id] = t.name;
  });

  const gmActions: GMCombatAction[] = (session.pendingActions || []).filter(
    (a) => a.type === 'attack' || a.type === 'ability'
  ) as GMCombatAction[];

  const isGustavesTurn = combatState.currentTurn === 'gustave';
  const activeTurrets = tokens.filter((t) => t.name?.includes('Turret') && t.type === 'npc' && (t.hp ?? 0) > 0);
  const maelleToken = players.find((t) => t.characterId === 'maelle');
  const gustaveToken = players.find((t) => t.characterId === 'gustave');

  return (
    <div className="min-h-screen bg-clair-shadow-900 flex">
      {/* Storm Popup - Highest priority, shows over everything */}
      {pendingRoll && (
        <StormPopup
          sessionId={sessionId || 'test-session'}
          pendingRoll={pendingRoll}
          onClose={() => {
            // Storm popup handles its own closing via the service
          }}
        />
      )}


      {/* Regular GM Combat Popup - Lower priority than storm */}
      {gmActions.length > 0 && !pendingRoll && (
      <GMCombatPopup 
          actions={gmActions} 
          onApplyDamage={handleApplyDamage} 
          onDismissMiss={handleDismissMiss}
          sessionId={sessionId || 'test-session'} // ✅ ADD THIS LINE
        />
        )}

          {/* ADD THIS HERE - Enemy Selection Modal */}
      <EnemySelectionModal
        isOpen={showEnemyModal}
        onClose={() => setShowEnemyModal(false)}
        onSelectEnemy={handleEnemySelected}
      />

      {/* Expedition NPC Modal - ADD THIS */}
      <ExpeditionNPCModal
        isOpen={showNPCModal}
        onClose={() => setShowNPCModal(false)}
        onSelectNPC={handleNPCSelected}
      />

      {/* Left Panel - GM Controls (NO Character Health) */}
      <div className="w-80 bg-clair-shadow-800 border-r border-clair-gold-600 p-4 overflow-y-auto flex-shrink-0">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-clair-gold-400 mb-2 flex items-center">
            GM Controls
            {isStormActive && (
              <span className="ml-3 bg-purple-600 text-white px-2 py-1 rounded-full text-xs font-bold animate-pulse">
                ⚡ STORM ACTIVE
              </span>
            )}
          </h1>
          <p className="font-sans text-sm text-clair-gold-300">Session: {sessionId}</p>
        </div>

        <InitiativeTracker
          combatState={combatState}
          onStartCombat={handleStartCombat}
          onEndCombat={handleEndCombat}
          onNextTurn={handleNextTurn}
          onUpdateInitiative={handleUpdateInitiative}
          characterNames={characterNames}
          sessionId={sessionId} // ADD THIS LINE
        />

        <div className="mt-4">
          <MineManagementPanel
            sessionId={sessionId || 'test-session'}
            mines={session?.mines || []}
            onPlaceMineMode={handlePlaceMineMode}
            onClearMines={handleClearAllMines}
            isPlacingMine={isPlacingMine}
          />
        </div>


        {/* ADD PLAYER TOKEN MANAGER HERE */}
        <div className="mt-4">
          <PlayerTokenManager
            availableCharacters={PLAYER_CHARACTERS}
            currentTokens={tokens}
            onSelectForPlacement={handleSelectPlayerForPlacement}
            onRemoveToken={handleRemovePlayerToken}
          />
        </div>


        <div className="mt-4">
        <div className="bg-clair-shadow-700 border border-clair-gold-600 rounded-lg p-4">
          <h3 className="font-display text-lg font-bold text-clair-gold-400 mb-3 flex items-center">
            <Wrench className="w-5 h-5 mr-2" />
            Session Management
          </h3>
          
          <div className="space-y-3">
            {/* Reset Button */}
            <ResetButton 
              onReset={handleResetSession}
              disabled={loading}
            />

            <button
              onClick={handleRepairMaelleToken}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition-colors"
            >
              🔧 Repair Maelle Token
            </button>
            
            {/* Session Info */}
            <div className="text-xs text-clair-gold-300 bg-clair-shadow-800 rounded p-2">
              <div className="grid grid-cols-2 gap-2">
                <div>Players: {tokens.filter(t => t.type === 'player').length}</div>
                <div>Enemies: {tokens.filter(t => t.type === 'enemy').length}</div>
                <div>NPCs: {tokens.filter(t => t.type === 'npc').length}</div>
                <div>Total: {tokens.length}</div>
              </div>

              <NPCPanel
                npcs={tokens.filter(t => t.type === 'npc')}
                isGMView={true}
                onRemoveNPC={handleRemoveNPC}
                onEditHP={handleEditNPCHP}
              />
            </div>
          </div>
        </div>
      </div>

        {/* Storm Status - Show prominently in combat status */}
        {stormState && stormState.isActive && (
          <div className="mt-4">
            <StormIndicator stormState={stormState} />
          </div>
        )}

        {/* Combat Status */}
      <div className="bg-clair-shadow-700 border border-clair-gold-600 rounded-lg p-4 shadow-shadow mt-4">
        <h3 className="font-display text-lg font-bold text-clair-gold-400 mb-3 flex items-center">
          <Map className="w-5 h-5 mr-2" />
          Battle Management
        </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-clair-gold-300">Combat:</span>
              <span className={combatActive ? 'text-clair-success' : 'text-clair-gold-400'}>
                {combatActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            {combatActive && (
              <>
                <div className="flex justify-between">
                  <span className="text-clair-gold-300">Round:</span>
                  <span className="text-clair-gold-200">{combatState.round}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-clair-gold-300">Current Turn:</span>
                  <span className="text-clair-gold-200">{characterNames[combatState.currentTurn] || 'None'}</span>
                </div>
                
                {/* Storm status in combat status */}
                {isStormActive && (
                  <div className="flex justify-between">
                    <span className="text-clair-gold-300">Storm:</span>
                    <span className="text-purple-300 font-bold">
                      Turn {stormState?.currentTurn} / {stormState?.totalTurns}
                    </span>
                  </div>
                )}

                {/* Music status - add this in your Combat Status div */}
                {combatActive && (
                  <div className="flex justify-between">
                    <span className="text-clair-gold-300">Music:</span>
                    <span className={isBattleMusicPlaying ? 'text-green-400' : 'text-clair-gold-400'}>
                      {isBattleMusicPlaying ? '🎵 Playing' : '🔇 Silent'}
                    </span>
                  </div>
                )}

                {session?.activeProtectionEffects && session.activeProtectionEffects.length > 0 && (
                  <div className="mt-2 p-2 bg-blue-900/30 rounded border border-blue-500">
                    <div className="text-blue-200 text-xs font-bold mb-1">
                      🛡️ Active Protection Effects
                    </div>
                    {session.activeProtectionEffects.map((effect: any) => (
                      <div key={effect.id} className="text-blue-300 text-xs">
                        {effect.protectorName} protecting: {effect.protectedAlly}
                        <span className="ml-2 text-blue-400">
                          ({effect.remainingRounds} rounds left)
                        </span>
                      </div>
                    ))}
                  </div>
                )}

{/*                {combatState.currentTurn && 
                 combatState.initiativeOrder?.find(e => e.id === combatState.currentTurn && e.type === 'enemy') && (
                  <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-40 
                    bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-3 
                    rounded-lg shadow-2xl border-2 border-white/20 animate-pulse">
                    <div className="flex items-center gap-3">
                      <Sword className="w-5 h-5" />
                      <div>
                        <p className="text-sm font-semibold opacity-90">Enemy Turn</p>
                        <p className="text-xl font-bold">
                          {characterNames[combatState.currentTurn] || combatState.currentTurn}
                        </p>
                      </div>
                    </div>
                  </div>
                )}*/}

                {combatState.currentTurn === 'gustave' && activeTurrets.length > 0 && (
                  <div className="mt-2 p-2 bg-yellow-900/30 rounded border border-yellow-500">
                    <div className="text-yellow-200 text-xs font-bold">
                      <Zap className="w-3 h-3 inline mr-1" />
                      Turrets Auto-Attacking
                    </div>
                    <div className="text-yellow-300 text-xs">Check combat popup for turret actions</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Quick Access */}
        <div className="bg-clair-shadow-700 border border-clair-gold-600 rounded-lg p-4 shadow-shadow mt-4">
          <h3 className="font-display text-lg font-bold text-clair-gold-400 mb-3 flex items-center">
            <Monitor className="w-5 h-5 mr-2" />
            Quick Access
          </h3>
          <div className="space-y-2">
            <a
              href={`/battle-map/${sessionId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center px-3 py-2 bg-clair-mystical-500 hover:bg-clair-mystical-600 text-white rounded-lg text-sm font-bold"
            >
              Open TV Display
            </a>
            <a
              href="/"
              className="block w-full text-center px-3 py-2 bg-clair-shadow-500 hover:bg-clair-shadow-400 text-clair-gold-200 rounded-lg text-sm font-bold"
            >
              Back to Home
            </a>
            
            {/* Emergency Storm Controls */}
            {isStormActive && (
              <button
                onClick={() => StormService.endStorm(sessionId || 'test-session')}
                className="block w-full text-center px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold"
              >
                Emergency: End Storm
              </button>
            )}
          </div>
        </div>
          {npcLevels && (
            <NPCLevelManager 
              sessionId={sessionId || 'test-session'} 
              currentLevels={npcLevels}
            />
          )}
      </div>

      {/* Middle Panel - Character Health Management - SIMPLIFIED */}
      <div className="w-96 bg-clair-shadow-800 border-r border-clair-gold-600 p-4 overflow-y-auto flex-shrink-0">
        <div className="bg-clair-shadow-700 border border-clair-gold-600 rounded-lg p-4 shadow-shadow">
          <h3 className="font-display text-lg font-bold text-clair-gold-400 mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Character Health Management
          </h3>

          {gmHPControl.error && (
            <div className="mb-4 p-3 bg-red-900 border border-red-500 rounded-lg">
              <p className="text-red-200 text-sm">{gmHPControl.error}</p>
              <button 
                onClick={() => gmHPControl.setError(null)}
                className="mt-2 text-red-300 hover:text-red-100 text-xs underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Simplified Character Displays */}
          <div className="space-y-3">
            {players.map((player) => (
              <SimpleCharacterDisplay
                key={player.id}
                characterId={player.characterId || player.id}
                characterName={player.name}
                currentHP={player.hp || 0}
                maxHP={player.maxHp || 100}
                isLoading={gmHPControl.isCharacterLoading(player.characterId || player.id)}
                onOpenHPSettings={() => setOpenHPModal(player.characterId || player.id)}
              />
            ))}
          </div>

          {/* Utility Actions - Simplified */}
          <div className="mt-6 pt-4 border-t border-clair-shadow-600">
            <div className="space-y-2">
              <button
                onClick={async () => {
                  try {
                    await HPSyncService.syncAllCharacterHPToTokens(sessionId || 'test-session');
                    console.log('✅ All HPs synchronized');
                  } catch (err) {
                    console.error('❌ Error syncing HPs:', err);
                    gmHPControl.setError('Failed to sync HPs');
                  }
                }}
                className="w-full px-3 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded text-sm font-medium transition-colors"
              >
                Sync All HP to Tokens
              </button>
              
              <button
                onClick={async () => {
                  const playerIds = players.map(p => p.characterId || p.id);
                  for (const playerId of playerIds) {
                    const maxHP = await gmHPControl.getMaxHP(playerId);
                    if (maxHP) {
                      await gmHPControl.setHP(playerId, maxHP);
                    }
                  }
                }}
                className="w-full px-3 py-2 bg-green-700 hover:bg-green-800 text-white rounded text-sm font-medium transition-colors"
              >
                Full Heal All Players
              </button>

              <button
                onClick={() => setShowInventoryModal(true)}
                className="w-full bg-clair-shadow-700 hover:bg-clair-shadow-600 border border-clair-gold-600 text-clair-gold-200 py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                <Package className="w-4 h-4 mr-2" />
                Manage Player Inventories
              </button>
            </div>
          </div>

          {/* Storm warning if active */}
          {isStormActive && (
            <div className="mt-4 p-3 bg-purple-900/30 rounded border border-purple-500">
              <div className="text-purple-200 text-sm font-bold mb-1">
                ⚡ Crescendo of Fate Active
              </div>
              <div className="text-purple-300 text-xs">
                Storm will auto-target enemies each turn. Watch for damage popups!
              </div>
            </div>
          )}
        </div>
          <EnemyPanel
            enemies={tokens.filter(t => t.type === 'enemy')}
            isGMView={true}
            onRemoveEnemy={handleRemoveEnemy}
            onEditHP={handleEditEnemyHP}
          />
      </div>

      {/* Right Panel - Token Management + Battle Map */}
      <div className="flex-1 flex flex-col">
        {/* Token Management - Top right */}
        <div className="bg-clair-shadow-800 border-b border-clair-gold-600 p-4 flex-shrink-0">
          <div className="bg-clair-shadow-700 border border-clair-gold-600 rounded-lg p-4 shadow-shadow">
            <h3 className="font-display text-lg font-bold text-clair-gold-400 mb-3 flex items-center">
              <Target className="w-5 h-5 mr-2" />
              Token Management
              {isStormActive && (
                <span className="ml-3 text-purple-300 text-sm">
                  (Storm targets automatically)
                </span>
              )}
            </h3>

            {/* Ultimate Placement Status */}
            {ultimateInteractionMode.active && (
              <div className="mb-4 p-3 bg-purple-900 border border-purple-500 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-purple-200 text-sm">
                      {ultimateInteractionMode.type === 'fire_terrain' && '🔥 Fire Genesis: Click to Place Fire Terrain'}
                      {ultimateInteractionMode.type === 'ice_wall' && '🧊 Ice Genesis: Click to Place Ice Wall'}
                    </p>
                    <p className="text-purple-300 text-xs">
                      {ultimateInteractionMode.type === 'fire_terrain' && 'Click any square to create 15ft fire terrain'}
                      {ultimateInteractionMode.type === 'ice_wall' && 'Click any square - wall will use your selected orientation'}
                    </p>
                  </div>
                  <button
                    onClick={() => setUltimateInteractionMode({ active: false, type: null, actionId: null })}
                    className="text-purple-300 hover:text-purple-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Placement status indicator */}
            {(isPlacingEnemy || isPlacingNPC) && (
              <div className="mb-3 p-2 bg-yellow-900 border border-yellow-600 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-yellow-200">
                    {isPlacingEnemy && (
                      <>
                        <Target className="w-4 h-4 inline mr-1" />
                        Placing: {selectedEnemyType?.name}
                      </>
                    )}
                    {isPlacingNPC && (
                      <>
                        <Users className="w-4 h-4 inline mr-1" />
                        Placing: {selectedNPCType?.name}
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      if (isPlacingEnemy) handleCancelEnemyPlacement();
                      if (isPlacingNPC) handleCancelNPCPlacement();
                    }}
                    className="text-yellow-300 hover:text-yellow-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-yellow-300 mt-1">
                  Click on the battle map to place the token
                </p>
              </div>
            )}

            {/* Main Controls Row */}
            <div className="flex items-center justify-between mb-3">
              {/* Enemy Add Button (Left) */}
              <button
                onClick={() => setShowEnemyModal(true)}
                disabled={isPlacingEnemy || isPlacingNPC}
                className="flex items-center justify-center px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition-colors"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Enemy
              </button>

              {/* Token Counts (Center) */}
              <div className="flex items-center space-x-4 text-sm text-clair-gold-300">
                <div>
                  <span className="font-bold">Players:</span> {tokens.filter((t) => t.type === 'player').length}
                </div>
                <div>
                  <span className="font-bold">Enemies:</span> {tokens.filter((t) => t.type === 'enemy').length}
                </div>
                <div>
                  <span className="font-bold">Turrets:</span> {activeTurrets.length}
                </div>
                <div>
                  <span className="font-bold">Total:</span> {tokens.length}
                </div>
              </div>
            </div>

            {/* Map Selector Row with NPC buttons */}
            <div className="flex items-center gap-2">
              {/* Map Selector (Left) */}
              <div className="flex-1 max-w-sm">
                <MapSelector
                  currentMapId={currentMap.id}
                  onMapChange={handleMapChange}
                  disabled={isPlacingEnemy}
                />
              </div>
              {/* Battle Map Presets - ADD THIS SECTION */}
              <div className="mt-4">
                <BattlePresetManager
                  sessionId={sessionId || 'test-session'}
                  currentMap={currentMap}
                  tokens={tokens}
                  onLoadPreset={handlePresetLoad}
                  disabled={isPlacingEnemy || isPlacingNPC}
                />
              </div>

              {/* NPC Controls (Right) */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowNPCModal(true)}
                  disabled={isPlacingEnemy || isPlacingNPC}
                  className="flex items-center justify-center px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Expeditioner
                </button>

                <button
                  onClick={handleClearAllNPCs}
                  className="flex items-center justify-center px-3 py-2 bg-green-800 hover:bg-green-900 text-white rounded-lg font-bold text-sm transition-colors"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear NPCs
                </button>
              </div>
            </div>

            {/* Show active turrets if any */}
            {activeTurrets.length > 0 && (
              <div className="mt-3 p-3 bg-red-800/30 rounded border border-red-500">
                <div className="text-red-200 text-sm font-bold mb-2">Active Turrets ({activeTurrets.length})</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {activeTurrets.map((turret) => (
                    <div key={turret.id} className="flex justify-between items-center text-xs text-red-200 bg-red-900/30 p-2 rounded">
                      <span>
                        {turret.name}: {turret.hp}/{turret.maxHp} HP
                      </span>
                      <button
                        onClick={() => handleDestroyTurret(turret.id)}
                        className="text-red-300 hover:text-white text-xs px-2 py-1 border border-red-400 rounded"
                      >
                        Destroy
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Battle Map - Takes remaining space */}
        <div className="flex-1 p-4">
          <div className="bg-clair-shadow-800 border border-clair-gold-600 rounded-lg p-4 h-full">
            <BattleMap
              mode="gm"
              map={currentMap} // Use the selected map instead of hardcoded map
              tokens={tokens}
              currentTurn={combatState.currentTurn}
              combatActive={combatActive}
              onTokenMove={handleTokenMove}
              onGridClick={handleGridClick}
              session={session} // Make sure to pass this
              isGM
            />
          </div>
        </div>
      </div>
      {/* HP Settings Modals */}
      {players.map((player) => (
        <HPSettingsModal
          key={`modal-${player.id}`}
          isOpen={openHPModal === (player.characterId || player.id)}
          characterId={player.characterId || player.id}
          characterName={player.name}
          currentHP={player.hp || 0}
          maxHP={player.maxHp || 100}
          isLoading={gmHPControl.isCharacterLoading(player.characterId || player.id)}
          onClose={() => setOpenHPModal(null)}
          onHPChange={async (newHP) => {
            await gmHPControl.setHP(player.characterId || player.id, newHP);
          }}
          onMaxHPChange={async (newMaxHP) => {
            await gmHPControl.setMaxHP(player.characterId || player.id, newMaxHP);
          }}
        />
      ))}

      {/* Inventory Management Modal */}
      <GMInventoryModal
        isOpen={showInventoryModal}
        characters={charactersWithInventory}
        onClose={() => setShowInventoryModal(false)}
      />


    </div>
  );
}