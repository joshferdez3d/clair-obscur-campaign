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
import { Plus, Users, Map, Monitor, Wrench, Sword, Zap, Target } from 'lucide-react';
import type { Position, BattleToken, InitiativeEntry, CombatState } from '../types';
import { GMCombatPopup } from '../components/Combat/GMCombatPopup';
import { StormPopup } from '../components/Combat/StormPopup';
import { StormIndicator } from '../components/Combat/StormIndicator';
import { FirestoreService } from '../services/firestoreService';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { GMCombatAction as ServiceGMCombatAction } from '../services/firestoreService';
import { EnemySelectionModal } from '../components/Combat/EnemySelectionModal';
import type { EnemyData } from '../types';
import { X } from 'lucide-react';
import { HPSyncService } from '../services/HPSyncService';
import { SimpleCharacterDisplay } from '../components/GM/SimpleCharacterDisplay';
import { HPSettingsModal } from '../components/GM/HPSettingsModal';

export function GMView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  // NEW: Enemy selection state
  const [showEnemyModal, setShowEnemyModal] = useState(false);
  const [selectedEnemyType, setSelectedEnemyType] = useState<EnemyData | null>(null);
  const [isPlacingEnemy, setIsPlacingEnemy] = useState(false);
  const [openHPModal, setOpenHPModal] = useState<string | null>(null);

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

  // Storm system integration
  const { stormState, pendingRoll, isStormActive } = useStormSystem(sessionId || '');

  // Move this hook to the top level
  const gmHPControl = useGMHPControl({ sessionId: sessionId || 'test-session' });

  const calcDist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) * 5;

  // Auto turret attacks
  const handleTurretAutoAttacks = useCallback(async () => {
    if (!session?.combatState?.isActive) return;

    const tokens = Object.values(session.tokens);
    const turrets = tokens.filter((t) => t.name.includes('Turret') && t.type === 'npc' && (t.hp ?? 0) > 0);

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

      const action: ServiceGMCombatAction = {
        id: `turret-attack-${Date.now()}`,
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
  }, [session, sessionId]);

  useEffect(() => {
    if (session?.combatState?.currentTurn === 'gustave' && session?.combatState?.isActive) {
      const t = setTimeout(() => handleTurretAutoAttacks(), 800);
      return () => clearTimeout(t);
    }
  }, [session?.combatState?.currentTurn, session?.combatState?.isActive, handleTurretAutoAttacks]);

  // Damage routing (AoE vs single)
  const handleApplyDamage = async (actionId: string, damage: number) => {
    try {
      const a = session?.pendingActions?.find((x) => x.id === actionId) as
        | ServiceGMCombatAction
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

  const handleDismissMiss = async (actionId: string) => {
    try {
      await FirestoreService.dismissMissAction(sessionId || 'test-session', actionId);
    } catch (e) {
      console.error('Error dismissing miss:', e);
    }
  };

  const handleTokenMove = async (id: string, pos: Position) => await attemptMove(id, pos);

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


// REPLACE: Handle battle map click for enemy placement
const handleGridClick = async (position: Position) => {
  if (isPlacingEnemy && selectedEnemyType && session && sessionId) {
    // Create a new enemy token with full stat block
    const enemyId = `enemy-${selectedEnemyType.id}-${Date.now()}`;
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

    try {
      // Add to session tokens
      const updatedTokens = { ...session.tokens, [enemyId]: newEnemy };
      
      // Store full enemy data for reference
      const updatedEnemyData = { 
        ...session.enemyData, 
        [enemyId]: selectedEnemyType 
      };

      // Update the session
      await import('../services/firestoreService').then(({ FirestoreService }) =>
        FirestoreService.updateBattleSession(sessionId, {
          tokens: updatedTokens,
          enemyData: updatedEnemyData,
          updatedAt: new Date()
        })
      );

      console.log(`Added ${selectedEnemyType.name} at position ${position.x}, ${position.y}`);
    } catch (error) {
      console.error('Failed to add enemy:', error);
    }

    // Reset enemy placement state
    setSelectedEnemyType(null);
    setIsPlacingEnemy(false);
  }
};

  const handleStartCombat = async (order: InitiativeEntry[]) => {
    try {
      await startCombat(order);
    } catch (e) {
      console.error('Failed to start combat:', e);
    }
  };

  const handleEndCombat = async () => {
    try {
      await endCombat();
      // End storm if active
      if (isStormActive) {
        await StormService.endStorm(sessionId || 'test-session');
      }
    } catch (e) {
      console.error('Failed to end combat:', e);
    }
  };

  const handleNextTurn = async () => {
    try {
      await nextTurn();
      
      // If storm is active, trigger storm turn after normal turn advancement
      if (isStormActive) {
        setTimeout(() => {
          StormService.triggerStormTurn(sessionId || 'test-session');
        }, 1000); // Small delay for dramatic effect
      }
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
  const tokens = Object.values(session.tokens);
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

  const gmActions: ServiceGMCombatAction[] = (session.pendingActions || []).filter(
    (a) => a.type === 'attack' || a.type === 'ability'
  ) as ServiceGMCombatAction[];

  const isGustavesTurn = combatState.currentTurn === 'gustave';
  const activeTurrets = tokens.filter((t) => t.name.includes('Turret') && t.type === 'npc' && (t.hp ?? 0) > 0);
  const players = tokens.filter((t) => t.type === 'player');
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
        <GMCombatPopup actions={gmActions} onApplyDamage={handleApplyDamage} onDismissMiss={handleDismissMiss} />
      )}

          {/* ADD THIS HERE - Enemy Selection Modal */}
      <EnemySelectionModal
        isOpen={showEnemyModal}
        onClose={() => setShowEnemyModal(false)}
        onSelectEnemy={handleEnemySelected}
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
        />

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
            
           {/* NEW: Enemy placement status */}
          {isPlacingEnemy && selectedEnemyType && (
            <div className="mb-4 p-3 bg-clair-warning text-clair-shadow-900 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-sm">Placing: {selectedEnemyType.name}</p>
                  <p className="text-xs">Click on battle map to place enemy</p>
                </div>
                <button
                  onClick={handleCancelEnemyPlacement}
                  className="text-clair-shadow-900 hover:text-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            {/* NEW: Enhanced Add Enemy Button */}
            <button
              onClick={() => setShowEnemyModal(true)}
              disabled={isPlacingEnemy}
              className={`flex items-center justify-center px-4 py-2 rounded-lg font-bold transition-colors ${
                isPlacingEnemy
                  ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              <Plus className="w-4 h-4 mr-2" />
              {isPlacingEnemy ? 'Placing Enemy...' : 'Add Enemy'}
            </button>
            
            <div className="flex items-center space-x-6 text-sm text-clair-gold-300">
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
              map={map}
              tokens={tokens}
              currentTurn={combatState.currentTurn}
              combatActive={combatActive}
              onTokenMove={handleTokenMove}
              onGridClick={handleGridClick}
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
    </div>
  );
}