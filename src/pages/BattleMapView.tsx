// src/pages/BattleMapView.tsx - Fixed Player-facing TV display
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BattleMap } from '../components/BattleMap/BattleMap';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { useCombat } from '../hooks/useCombat';
import { useStormSystem } from '../hooks/useStormSystem';
import { useBattleSession } from '../hooks/useBattleSession';
import type { BattleToken } from '../types';

export function BattleMapView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Use the combat hook to get real-time session data
  const {
    session,
    loading,
    error,
    isCombatActive,
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
  const battleTokens: BattleToken[] = Object.values(currentSession.tokens || {});

  // Get current turn information
  const currentTurn = currentSession.combatState?.currentTurn;
  const combatActive = currentSession.combatState?.isActive || false;

  return (
    <div className="fixed inset-0 bg-clair-shadow-900">
      {/* Status Bar - Fixed positioning to avoid overlap */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-black bg-opacity-50 backdrop-blur-sm">
        <div className="flex items-center justify-between p-2">
          {/* Left side - Session info */}
          <div className="flex items-center space-x-4">
            <div className="text-clair-gold-300 text-sm font-bold">
              The Docks of Lumière
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
          map={{
            id: currentSession.id,
            name: "The Docks of Lumière",
            backgroundImage: "/maps/BattleMap_Landing.jpg",
            gridSize: { width: 20, height: 15 },
            gridVisible: true
          }}
          tokens={battleTokens}
          isGM={false}
          currentTurn={currentTurn}
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
          maxMovementRange={30}
        />
      </div>

      {/* Grid Reference Helper - Bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-40 bg-black bg-opacity-50 backdrop-blur-sm">
        <div className="text-center py-2">
          <p className="text-clair-gold-300 text-sm">
            Use chess notation to call out positions • e.g. "Move to C4" or "Attack enemy at F7"
          </p>
        </div>
      </div>

      {/* Debug Info (only in development) - Fixed positioning */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-16 left-2 bg-black bg-opacity-75 text-white p-2 rounded text-xs z-50 max-w-xs">
          <div className="font-bold mb-1">Debug Info:</div>
          <div>Session: {sessionId}</div>
          <div>Tokens: {battleTokens.length}</div>
          <div>Combat: {combatActive ? 'Active' : 'Inactive'}</div>
          <div>Turn: {currentTurn || 'None'}</div>
          <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
          <div>Storm: {isStormActive ? `Active (${stormState?.currentTurn}/5)` : 'Inactive'}</div>
          <div>Last Render: {new Date().toLocaleTimeString()}</div>
        </div>
      )}
    </div>
  );
}