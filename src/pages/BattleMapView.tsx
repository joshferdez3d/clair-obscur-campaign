// src/pages/BattleMapView.tsx - Fixed type conversion issue
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { BattleMap } from '../components/BattleMap/BattleMap';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { useCombat } from '../hooks/useCombat';
import { useStormSystem } from '../hooks/useStormSystem';
import { useBattleSession } from '../hooks/useBattleSession';
import type { BattleToken, BattleMap as BattleMapType } from '../types';
import { EnemyPanel } from '../components/Combat/EnemyPanel';
import { AVAILABLE_MAPS } from '../components/GM/MapSelector';
import { UltimateVideoPopup } from '../components/Combat/UltimateVideoPopup';
import { useUltimateVideo } from '../hooks/useUltimateVideo';
import { FirestoreService } from '../services/firestoreService';
import { useBrowserWarning } from '../hooks/useBrowserWarning';
import { BattleMessagePopup } from '../components/BattleMap/BattleMessagePopup';

export function BattleMapView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { currentEvent, clearUltimate, hasActiveUltimate } = useUltimateVideo(sessionId || 'test-session');
  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(null);
  const [battleMessage, setBattleMessage] = useState<{
    text: string;
    type: 'info' | 'success' | 'warning' | 'error';
    isVisible: boolean;
  }>({
    text: '',
    type: 'info',
    isVisible: false
  });
  const previousRitualRef = useRef<any>(null);

  // Use the combat hook to get real-time session data
  const {
    session,
    loading,
    error,
  } = useCombat(sessionId || '');

  // Real-time session updates (replace useRealtimeSession with useBattleSession)
  const { 
    session: realtimeSession,
    loading: sessionLoading,
    error: sessionError
  } = useBattleSession(sessionId || '');

  // Storm system integration for visual effects
  const { stormState, isStormActive } = useStormSystem(sessionId || '');

  // Use the more reliable session data
  const currentSession = session || realtimeSession;
  const isConnected = !sessionLoading && !sessionError && !!currentSession;
  const isLoading = loading || sessionLoading;
  const currentError = error || sessionError;
  const tokens = currentSession ? Object.values(currentSession.tokens) : [];
  const combatActive = currentSession?.combatState?.isActive || false;
  const combatState = currentSession?.combatState || {
    isActive: false,
    currentTurn: '',
    turnOrder: [],
    round: 1,
    phase: 'setup' as const,
    initiativeOrder: [],
  };

  const showBattleMessage = (text: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setBattleMessage({ text, type, isVisible: true });
  };

  const closeBattleMessage = () => {
    setBattleMessage(prev => ({ ...prev, isVisible: false }));
  };

  const characterNames: Record<string, string> = {};
  tokens.forEach((t) => {
    if (t.characterId) characterNames[t.characterId] = t.name;
    characterNames[t.id] = t.name;
  });

  const handleVideoClose = useCallback(() => {
    clearUltimate();
  }, [clearUltimate]);

  useBrowserWarning({
    enabled: true,
    message: '⚠️ Warning: The battle map is currently displayed. Closing this will disrupt the visual experience. Are you sure?'
  });

  // Listen for Lampmaster ritual events
  useEffect(() => {
    if (!currentSession?.lampmasterRitual) return;
    
    const ritual = currentSession.lampmasterRitual;
    const previousRitual = previousRitualRef.current;

    // Ritual just started
    if (ritual.isActive && ritual.playerAttempt.length === 0 && (!previousRitual || !previousRitual.isActive)) {
      showBattleMessage('⚔️ The Lampmaster is starting the ritual! Memorize the lamp sequence!', 'warning');
    }

    // Ritual completed successfully (all 4 lamps correct)
    if (!ritual.isActive && ritual.damageReduction === 100 && previousRitual?.isActive) {
      showBattleMessage('✅ SUCCESS! The ritual has been disrupted! Sword of Light CANCELED!', 'success');
    }

    // Ritual failed or partial success
    if (!ritual.isActive && ritual.damageReduction < 100 && ritual.playerAttempt.length > 0 && previousRitual?.isActive) {
      const damagePercent = 100 - ritual.damageReduction;
      if (ritual.damageReduction === 0) {
        showBattleMessage(`❌ FAILURE! All lamps were wrong! Taking FULL damage (${damagePercent}%)!`, 'error');
      } else {
        showBattleMessage(`⚠️ Partial Success! Damage reduced by ${ritual.damageReduction}%! Taking ${damagePercent}% damage!`, 'warning');
      }
    }

    previousRitualRef.current = ritual;
  }, [currentSession?.lampmasterRitual]);

  useEffect(() => {
    if (sessionId) {
      const unsubscribe = FirestoreService.subscribeToTargetingState(
        sessionId,
        (targetingState) => {
          if (targetingState?.selectedEnemyId) {
            setSelectedEnemyId(targetingState.selectedEnemyId);
          } else {
            setSelectedEnemyId(null);
          }
        }
      );
      return unsubscribe;
    }
  }, [sessionId]);

  // Auto-refresh every 10 seconds as fallback (increased from 5s)
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      console.log('Auto-refresh battle map data');
      // The useCombat hook handles real-time updates automatically
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-clair-shadow-900 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="text-clair-gold-300 mt-4 text-xl">Loading Battle Map...</p>
        </div>
      </div>
    );
  }

  if (currentError) {
    return (
      <div className="fixed inset-0 bg-clair-shadow-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Connection Error</h2>
          <p className="text-clair-gold-300 mb-6">{currentError}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-clair-gold-600 hover:bg-clair-gold-700 text-white px-6 py-3 rounded-lg font-bold"
          >
            Reload Battle Map
          </button>
        </div>
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="fixed inset-0 bg-clair-shadow-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-clair-gold-400 mb-4">Session Not Found</h2>
          <p className="text-clair-gold-300">Session ID: {sessionId}</p>
        </div>
      </div>
    );
  }

  // Convert session tokens to battle tokens
  const battleTokens: BattleToken[] = Object.entries(currentSession?.tokens || {})
    .filter(([key, value]) => {
      if (!value) return false;
      if (!value.name || !value.position) return false;
      return true;
    })
    .map(([key, value]) => ({
      ...value,
      id: value.id || key,
      position: value.position || { x: 0, y: 0 },
      name: value.name || 'Unknown',
    }));
  // Get current turn information
  const currentTurn = currentSession.combatState?.currentTurn;

  // FIXED: Convert MapConfig to BattleMapType
  const getCurrentMap = (): BattleMapType => {
    if (currentSession?.currentMap) {
      // Convert MapConfig to BattleMapType
      const sessionMap = currentSession.currentMap;
      return {
        id: sessionMap.id,
        name: sessionMap.name,
        backgroundImage: sessionMap.backgroundImage,
        gridSize: sessionMap.gridSize,
        gridVisible: sessionMap.gridVisible,
      };
    }

    // Convert MapConfig to BattleMapType for default map
    const defaultMapConfig = AVAILABLE_MAPS[0];
    if (!defaultMapConfig) {
      // Fallback if AVAILABLE_MAPS is empty
      return {
        id: 'default',
        name: 'Default Map',
        backgroundImage: undefined,
        gridSize: { width: 20, height: 15 },
        gridVisible: true,
      };
    }

    return {
      id: defaultMapConfig.id,
      name: defaultMapConfig.name,
      backgroundImage: defaultMapConfig.backgroundImage,
      gridSize: defaultMapConfig.gridSize,
      gridVisible: defaultMapConfig.gridVisible,
    };
  };

  const currentMap = getCurrentMap();

  return (
    <div className="fixed inset-0 bg-clair-shadow-900 flex">
      {/* Ultimate Video Popup - Highest Z-Index */}
      {hasActiveUltimate && currentEvent && (
        <UltimateVideoPopup
          isOpen={true}
          characterName={currentEvent.characterName}
          onClose={handleVideoClose}
          autoClose={true}
        />
      )}

      {/* Battle Message Popup */}
      <BattleMessagePopup
        message={battleMessage.text}
        type={battleMessage.type}
        isVisible={battleMessage.isVisible}
        autoClose={true}
        duration={5000}
        onClose={closeBattleMessage}
      />

      {/* Left Panel - Enemy Status (for players) */}
      <div className="w-48 bg-clair-shadow-800 border-r border-clair-gold-600 p-2 overflow-y-auto flex-shrink-0">
        <div className="mb-4">
          <h1 className="font-display text-xl font-bold text-clair-gold-400 mb-2">
            Battle Status
          </h1>
          <p className="font-sans text-sm text-clair-gold-300">Session: {sessionId}</p>
        </div>

        {/* Enemy Panel for Players - Enhanced for debugging */}
        <div className="mb-4">
          <EnemyPanel
            enemies={tokens.filter(t => t.type === 'enemy')}
            isGMView={false}
          />
          
          {/* Debug info for enemy panel */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-2 p-2 bg-yellow-900/20 border border-yellow-500 rounded text-xs">
              <div className="text-yellow-200 font-bold">Enemy Panel Debug:</div>
              <div className="text-yellow-300">
                Total tokens: {tokens.length}<br/>
                Enemy tokens: {tokens.filter(t => t.type === 'enemy').length}<br/>
                Enemy names: {tokens.filter(t => t.type === 'enemy').map(e => e.name).join(', ') || 'None'}
              </div>
            </div>
          )}
        </div>

        {/* Combat Status */}
        {combatActive && (
          <div className="mt-4 bg-clair-shadow-700 border border-clair-gold-600 rounded-lg p-3">
            <h3 className="font-display text-sm font-bold text-clair-gold-400 mb-2">
              Combat Status
            </h3>
            <div className="text-xs text-clair-gold-300 space-y-1">
              <div>Round: {combatState.round}</div>
              <div>Current Turn: {characterNames[combatState.currentTurn] || 'None'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Main Battle Map Content */}
      <div className="flex-1 relative">
        {/* Status Bar - Fixed positioning to avoid overlap */}
        <div className="absolute top-0 left-0 right-0 z-50 bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="flex items-center justify-between p-2">
            {/* Left side - Session info */}
            <div className="flex items-center space-x-4">
              <div className="text-clair-gold-300 text-sm font-bold">
                The Landing
              </div>
              {combatActive && currentTurn && (
                <div className="text-green-400 text-sm">
                  <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></span>
                  {currentTurn} is acting
                </div>
              )}
            </div>

            {/* Center - Storm status */}
            {isStormActive && stormState && (
              <div className="text-center">
                <div className="text-purple-300 text-sm font-bold">
                  ⚡ Crescendo of Fate - Turn {stormState.currentTurn}/5
                </div>
                <div className="w-32 bg-purple-800 rounded-full h-1 mt-1">
                  <div 
                    className="bg-gradient-to-r from-yellow-400 to-purple-400 h-1 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${((stormState.totalTurns - stormState.turnsRemaining) / stormState.totalTurns) * 100}%` 
                    }}
                  />
                </div>
              </div>
            )}

            {/* Right side - Connection and controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-2 py-1 rounded text-xs font-bold border ${
                  autoRefresh 
                    ? 'bg-blue-500 bg-opacity-20 text-blue-400 border-blue-500' 
                    : 'bg-gray-500 bg-opacity-20 text-gray-400 border-gray-500'
                }`}
              >
                {autoRefresh ? 'AUTO' : 'MANUAL'}
              </button>
              
              <div className={`px-2 py-1 rounded text-xs font-bold border ${
                isConnected 
                  ? 'bg-green-500 bg-opacity-20 text-green-400 border-green-500' 
                  : 'bg-red-500 bg-opacity-20 text-red-400 border-red-500'
              }`}>
                {isConnected ? 'LIVE' : 'OFFLINE'}
              </div>
            </div>
          </div>
        </div>

        {/* Storm Effects Overlay */}
        {isStormActive && (
          <div className="absolute inset-0 z-10 pointer-events-none">
            {/* Storm background effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-indigo-500/10 animate-pulse" />
            
            {/* Lightning effects */}
            <div className="absolute inset-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute bg-yellow-300 opacity-40 animate-ping"
                  style={{
                    left: `${10 + i * 20}%`,
                    top: `${5 + i * 15}%`,
                    width: '2px',
                    height: '30px',
                    animationDelay: `${i * 0.7}s`,
                    animationDuration: '3s'
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Battle Map Component - Adjusted for status bar */}
        <div className="absolute inset-0 pt-12 z-0">
          <BattleMap
            mode="player"
            map={currentMap}
            tokens={battleTokens}
            isGM={false}
            currentTurn={currentTurn}
            session={currentSession || undefined} // Fixed: handle null vs undefined
            combatActive={combatActive}
            // Players can't move tokens directly - only DM can
            onTokenMove={undefined}
            onTokenSelect={undefined}
            onGridClick={(position) => {
              // Log for players to reference
              const letter = String.fromCharCode(65 + position.x);
              const number = position.y + 1;
              console.log(`Grid position: ${letter}${number}`);
            }}
            targetingMode={undefined}
            selectedEnemyId={selectedEnemyId} 
            maxMovementRange={30}
          />
        </div>

      </div>
    </div>
  );
}