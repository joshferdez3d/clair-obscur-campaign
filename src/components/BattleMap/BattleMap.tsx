// src/components/BattleMap/BattleMap.tsx
import React, { useState, useCallback, useRef, useLayoutEffect } from 'react';
import { Token } from './Token';
import { Grid } from './Grid';
import type { BattleToken, BattleMap as BattleMapType, Position, BattleSession } from '../../types';
import { MineService, type Mine } from '../../services/MineService';
import { RevealedSquareOverlay } from './RevealedSquareOverlay';

interface FireTerrainOverlayProps {
  gridSize: number;
  turnsRemaining?: number;
  intensity?: 'low' | 'medium' | 'high';
}

const FireTerrainOverlay: React.FC<FireTerrainOverlayProps> = ({
  gridSize,
  turnsRemaining = 3,
  intensity = 'medium'
}) => {
  const opacity = Math.max(0.4, turnsRemaining / 3);
  
  const fireScale = {
    low: 0.8,
    medium: 1.0,
    high: 1.2
  };

  return (
    <div 
      className="absolute pointer-events-none fire-terrain-overlay"
      style={{
        width: gridSize,
        height: gridSize,
        opacity,
        transform: `scale(${fireScale[intensity]})`,
        zIndex: 5,
      }}
    >
      <img
        src="/gifs/fire.gif"
        alt="Fire terrain"
        className="w-full h-full object-cover"
        style={{
          imageRendering: 'pixelated',
          mixBlendMode: 'screen'
        }}
      />
      
      <div 
        className="absolute inset-0 rounded-sm"
        style={{
          background: `radial-gradient(circle, rgba(255,100,0,${0.15 * opacity}) 0%, transparent 70%)`,
          animation: 'fireGlow 2s ease-in-out infinite alternate'
        }}
      />
    </div>
  );
};

type BattleMapMode = 'player' | 'gm';

interface BattleMapProps {
  map: BattleMapType;
  tokens: BattleToken[];
  isGM?: boolean;
  currentTurn?: string;
  combatActive?: boolean;
  session?: BattleSession;
  selectedEnemyId?: string | null;
  activeEnemyId?: string; // Currently acting enemy
  enemyActionPath?: { from: Position; to: Position }; // Movement path
  attackIndicator?: { from: Position; to: Position; type: 'melee' | 'ranged' | 'ability' }; // Attack line
  onTokenMove?: (tokenId: string, newPosition: Position) => Promise<boolean>;
  onTokenSelect?: (token: BattleToken | null) => void;
  onGridClick?: (position: Position) => void;

  targetingMode?: {
    active: boolean;
    sourcePosition?: Position;
    range: number;
    validTargets?: string[];
  };

  maxMovementRange?: number;
  mode?: BattleMapMode;
}

export function BattleMap({
  map,
  tokens,
  isGM = false,
  currentTurn,
  combatActive = false,
  session,
  onTokenMove,
  onTokenSelect,
  selectedEnemyId,
  onGridClick,
  targetingMode,
  maxMovementRange = 30,
  mode = 'player',
}: BattleMapProps) {
  const [selectedToken, setSelectedToken] = useState<BattleToken | null>(null);
  const [draggedToken, setDraggedToken] = useState<BattleToken | null>(null);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [hoveredPosition, setHoveredPosition] = useState<Position | null>(null);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null); // ← ADD THIS HERE

  // DEFENSIVE PROGRAMMING: Ensure map has valid gridSize
  const safeMap = {
    ...map,
    gridSize: map?.gridSize || { width: 20, height: 15 },
    name: map?.name || 'Battle Map',
    gridVisible: map?.gridVisible ?? true
  };

  // Space around the board for the coordinate labels we draw
  const coordinatePadding = mode === 'player' ? 20 : 24;

  // Measure either the window (player fullscreen) or the parent container (gm)
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  });

  useLayoutEffect(() => {
    const update = () => {
      if (mode === 'gm' && containerRef.current) {
        const r = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: r.width, height: r.height });
      } else {
        if (containerRef.current) {
          const r = containerRef.current.getBoundingClientRect();
          setContainerSize({ width: r.width, height: r.height });
        } else {
          setContainerSize({
            width: window.innerWidth,
            height: window.innerHeight,
          });
        }
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [mode]);

  // derive viewport size and grid size
  const viewportWidth = containerSize.width - coordinatePadding;
  const viewportHeight = containerSize.height - coordinatePadding;

  // Optimized for player TV view - much larger map with minimal padding
  const paddingX = mode === 'player' ? 20 : 80;
  const paddingY = mode === 'player' ? 30 : 120;
  const maxGridCap = mode === 'player' ? 120 : 60; // Double the size for player view!

  const maxGridSizeByWidth = Math.floor((viewportWidth - paddingX) / safeMap.gridSize.width);
  const maxGridSizeByHeight = Math.floor((viewportHeight - paddingY) / safeMap.gridSize.height);
  const gridSize = Math.max(8, Math.min(maxGridSizeByWidth, maxGridSizeByHeight, maxGridCap));

  const totalWidth = safeMap.gridSize.width * gridSize;
  const totalHeight = safeMap.gridSize.height * gridSize;
  const boardWidth = totalWidth + coordinatePadding;
  const boardHeight = totalHeight + coordinatePadding;

  // --- Helpers ---------------------------------------------------------------
  const getChessNotation = (pos: Position): string => {
    const letter = String.fromCharCode(65 + pos.x);
    const number = pos.y + 1;
    return `${letter}${number}`;
  };

  const renderRevealedSquareOverlays = useCallback(() => {
      // Only show revealed squares when combat is active and there are mines
      if (!combatActive) return null;
      if (!session?.mines || session.mines.length === 0) return null;
      if (!session?.revealedSquares) return null;

      const overlays: JSX.Element[] = [];

      Object.entries(session.revealedSquares).forEach(([posKey, mineCount]: [string, number]) => {
        const [x, y] = posKey.split('-').map(Number);
        const pixelX = x * gridSize + coordinatePadding;
        const pixelY = y * gridSize + coordinatePadding;

        overlays.push(
          <div
            key={`revealed-${posKey}`}
            className="absolute pointer-events-none"
            style={{
              left: pixelX,
              top: pixelY,
              width: gridSize,
              height: gridSize,
              zIndex: 4,
            }}
          >
            <RevealedSquareOverlay mineCount={mineCount} gridSize={gridSize} />
          </div>
        );
      });

      return <>{overlays}</>;
    }, [session?.revealedSquares, session?.mines, gridSize, coordinatePadding, combatActive]);

  const renderMineOverlays = useCallback(() => {
    if (!session?.mines) return null;

    const overlays: JSX.Element[] = [];

    session.mines.forEach((mine: Mine) => {
      if (mine.isTriggered) return;

      const pixelX = mine.position.x * gridSize + coordinatePadding;
      const pixelY = mine.position.y * gridSize + coordinatePadding;

      const shouldShow = isGM || mine.isDetected;
      if (!shouldShow) return;

      overlays.push(
        <div
          key={`mine-${mine.id}`}
          className="absolute pointer-events-none"
          style={{
            left: pixelX,
            top: pixelY,
            width: gridSize,
            height: gridSize,
            zIndex: 6,
          }}
        >
          <div className="relative w-full h-full">
            <div 
              className={`absolute inset-0 rounded-full ${
                mine.isDetected ? 'bg-yellow-500' : 'bg-red-500'
              } opacity-30 animate-pulse`}
            />
            
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`text-3xl ${mine.isDetected ? 'animate-bounce' : ''}`}>
                {mine.isDetected ? '⚠️' : '💣'}
              </div>
            </div>

            {mine.isDetected && (
              <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                !
              </div>
            )}

            {isGM && !mine.isDetected && (
              <div className="absolute top-0 left-0 bg-black bg-opacity-70 text-white text-xs p-1 rounded">
                Hidden
              </div>
            )}
          </div>
        </div>
      );
    });

    return <>{overlays}</>;
  }, [session?.mines, gridSize, coordinatePadding, isGM]);

 
  const calculateDistance = (a: Position, b: Position): number => {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return (dx + dy) * 5;
  };

  const isWithinMovementRange = (token: BattleToken, dest: Position): boolean => {
    if (!combatActive) return true;
    if (isGM) return true;
    if (token.characterId !== currentTurn) return false;
    return calculateDistance(token.position, dest) <= maxMovementRange;
  };

  const isWithinTargetingRange = (cell: Position): boolean => {
    if (!targetingMode?.active || !targetingMode.sourcePosition) return false;
    return calculateDistance(targetingMode.sourcePosition, cell) <= targetingMode.range;
  };

  const isValidTarget = (tokenId: string): boolean => {
    if (!targetingMode?.active) return false;
    if (!targetingMode.validTargets) return true;
    return targetingMode.validTargets.includes(tokenId);
  };

    /**
   * Validates and filters tokens to ensure they have required properties
   */
  const validateTokens = (tokens: BattleToken[]): BattleToken[] => {
    return tokens.filter((token, index) => {
      // Check if token exists
      if (!token) {
        console.warn(`Token at index ${index} is null/undefined`);
        return false;
      }

      // Check if token has required properties
      if (!token.id) {
        console.warn(`Token at index ${index} missing id:`, token);
        return false;
      }

      if (!token.name) {
        console.warn(`Token ${token.id} missing name:`, token);
        return false;
      }

      // Check if position exists and is valid
      if (!token.position) {
        console.warn(`Token ${token.id} missing position:`, token);
        return false;
      }

      if (typeof token.position.x !== 'number' || typeof token.position.y !== 'number') {
        console.warn(`Token ${token.id} has invalid position:`, token.position);
        return false;
      }

      // Check if position is within reasonable bounds
      if (token.position.x < 0 || token.position.y < 0) {
        console.warn(`Token ${token.id} has negative position:`, token.position);
        return false;
      }

      return true;
    });
  };

  // --- Handlers --------------------------------------------------------------
  const handleTokenClick = useCallback((token: BattleToken) => {
    if (targetingMode?.active && isValidTarget(token.id) && targetingMode && onTokenSelect) {
      onTokenSelect(token);
      return;
    }

    const next = selectedToken?.id === token.id ? null : token;
    setSelectedToken(next);
    onTokenSelect?.(next);
  }, [selectedToken, targetingMode, onTokenSelect]);

  const handleGridClick = useCallback((pos: Position) => {
    console.log(`Grid clicked: ${getChessNotation(pos)} (${pos.x}, ${pos.y})`);
    onGridClick?.(pos);
  }, [onGridClick]);

  const handleTokenMove = useCallback(async (tokenId: string, newPos: Position) => {
    if (!onTokenMove) return false;
    const ok = await onTokenMove(tokenId, newPos);
    if (ok) console.log(`Token moved to ${getChessNotation(newPos)}`);
    return ok;
  }, [onTokenMove]);

  const handleTokenDragStart = useCallback((token: BattleToken, ev: React.DragEvent | React.TouchEvent) => {
    if (combatActive && !isGM && token.characterId !== currentTurn) {
      ev.preventDefault();
      return;
    }

    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    let clientX: number, clientY: number;

    // Handle both touch and mouse events
    if ('touches' in ev && ev.touches.length > 0) {
      clientX = ev.touches[0].clientX;
      clientY = ev.touches[0].clientY;
    } else if ('clientX' in ev) {
      clientX = ev.clientX;
      clientY = ev.clientY;
    } else {
      return;
    }

    setDragOffset({
      x: clientX - rect.left,
      y: clientY - rect.top,
    });
    setDraggedToken(token);
    setTouchStartPos({ x: clientX, y: clientY });
  }, [combatActive, isGM, currentTurn]);

  // ADD this new handler for touch move events:
  const handleTokenTouchMove = useCallback((ev: React.TouchEvent) => {
    if (!draggedToken || !ev.touches.length) return;
    
    // Prevent scrolling while dragging
    ev.preventDefault();
    
    // Optional: Update visual feedback during drag
    // You could update hoveredPosition here if you want to show where the token will land
  }, [draggedToken]);

  const handleTokenDragEnd = useCallback(() => {
    setDraggedToken(null);
    setDragOffset({ x: 0, y: 0 });
  }, []);

  const handleDragOver = useCallback((ev: React.DragEvent) => {
    ev.preventDefault();
  }, []);

  const handleDrop = useCallback(async (ev: React.DragEvent | React.TouchEvent) => {
    ev.preventDefault();
    if (!draggedToken) return;

    let clientX: number, clientY: number;
    
    // Handle both touch and mouse events
    if ('changedTouches' in ev && ev.changedTouches.length > 0) {
      clientX = ev.changedTouches[0].clientX;
      clientY = ev.changedTouches[0].clientY;
    } else if ('clientX' in ev) {
      clientX = ev.clientX;
      clientY = ev.clientY;
    } else {
      setDraggedToken(null);
      setTouchStartPos(null);
      return;
    }

    const rect = ev.currentTarget.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left - coordinatePadding) / gridSize);
    const y = Math.floor((clientY - rect.top - coordinatePadding) / gridSize);

    // Validate bounds
    if (x < 0 || x >= safeMap.gridSize.width || y < 0 || y >= safeMap.gridSize.height) {
      setDraggedToken(null);
      setTouchStartPos(null);
      return;
    }

    const dest = { x, y };
    
    // Check movement range
    if (combatActive && !isGM && !isWithinMovementRange(draggedToken, dest)) {
      console.log('Movement exceeds range limit');
      setDraggedToken(null);
      setTouchStartPos(null);
      return;
    }

    // Move the token
    await handleTokenMove(draggedToken.id, dest);
    setDraggedToken(null);
    setTouchStartPos(null);
  }, [draggedToken, gridSize, safeMap.gridSize.width, safeMap.gridSize.height, combatActive, isGM, isWithinMovementRange, handleTokenMove, coordinatePadding]);

  const handleGridHover = useCallback((pos: Position | null) => {
    setHoveredPosition(pos);
  }, []);

  const renderFireTerrainOverlays = useCallback(() => {
    if (!session?.fireTerrainZones) return null;

    const overlays: JSX.Element[] = [];

    session.fireTerrainZones.forEach((zone: any) => {
      zone.affectedSquares?.forEach((square: any) => {
        const pixelX = square.x * gridSize + coordinatePadding;
        const pixelY = square.y * gridSize + coordinatePadding;

        overlays.push(
          <div
            key={`fire-terrain-${zone.id}-${square.x}-${square.y}`}
            className="absolute"
            style={{
              left: pixelX,
              top: pixelY,
              width: gridSize,
              height: gridSize,
              zIndex: 5,
            }}
          >
            <FireTerrainOverlay
              gridSize={gridSize}
              turnsRemaining={zone.turnsRemaining || 3}
              intensity={zone.damagePerTurn > 5 ? 'high' : 'medium'}
            />
          </div>
        );
      });
    });

    return <>{overlays}</>;
  }, [session?.fireTerrainZones, gridSize, coordinatePadding]);

  const renderHearthlightOverlays = useCallback(() => {
    if (!session?.hearthlightZones) return null;

    const overlays: JSX.Element[] = [];

    session.hearthlightZones.forEach((zone: any) => {
      zone.affectedSquares?.forEach((square: any) => {
        const pixelX = square.x * gridSize + coordinatePadding;
        const pixelY = square.y * gridSize + coordinatePadding;

        overlays.push(
          <div
            key={`hearthlight-${zone.id}-${square.x}-${square.y}`}
            className="absolute pointer-events-none"
            style={{
              left: pixelX,
              top: pixelY,
              width: gridSize,
              height: gridSize,
              zIndex: 4, // Below fire terrain (5) but above grid
              backgroundColor: 'rgba(34, 197, 94, 0.3)', // green-500 with opacity
              border: '2px solid rgba(34, 197, 94, 0.6)',
              borderRadius: '4px',
              animation: 'pulse 2s ease-in-out infinite',
              boxShadow: '0 0 10px rgba(34, 197, 94, 0.4)'
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center text-2xl">
              ❤️
            </div>
          </div>
        );
      });
    });

    return <>{overlays}</>;
  }, [session?.hearthlightZones, gridSize, coordinatePadding]);

  const getGridCellClass = useCallback((pos: Position) => {
    const classes: string[] = [];

    // Check for fire terrain zones
    if (session?.fireTerrainZones) {
      const isInFireZone = session.fireTerrainZones.some((zone: any) => 
        zone.affectedSquares?.some((square: any) => 
          square.x === pos.x && square.y === pos.y
        )
      );
      if (isInFireZone) {
        classes.push('fire-terrain');
      }
    }

    // Check for ice walls
    if (session?.iceWalls) {
      const isInIceWall = session.iceWalls.some((wall: any) => 
        wall.squares?.some((square: any) => 
          square.x === pos.x && square.y === pos.y
        )
      );
      if (isInIceWall) {
        classes.push('ice-wall');
      }
    }

    if (session?.lightBlindEffects) {
      
      session.lightBlindEffects.forEach((effect: any, index: number) => {
        console.log(`  Effect ${index + 1}:`, effect);
        console.log(`    Affected squares:`, effect.affectedSquares);
      });
      
      const isInLightZone = session.lightBlindEffects.some((effect: any) => 
        effect.affectedSquares?.some((square: any) => {
          const match = square.x === pos.x && square.y === pos.y;
          if (match) {
            console.log(`✨ MATCH! Cell (${pos.x}, ${pos.y}) is in light zone from effect:`, effect.id);
          }
          return match;
        })
      );
      
      if (isInLightZone) {
        console.log(`⚡ Adding light-blind class to cell (${pos.x}, ${pos.y})`);
        classes.push('light-blind');
      }
    }

    if (session?.hearthlightZones) {
      const isInHearthlightZone = session.hearthlightZones.some((zone: any) => 
        zone.affectedSquares?.some((square: any) => 
          square.x === pos.x && square.y === pos.y
        )
      );
      if (isInHearthlightZone) {
        classes.push('hearthlight-zone');
      }
    }

    // Add hover effect
    if (hoveredPosition && hoveredPosition.x === pos.x && hoveredPosition.y === pos.y) {
      classes.push('hover');
    }

    // Movement range highlighting for selected token
    if (selectedToken && combatActive) {
      if (isWithinMovementRange(selectedToken, pos)) {
        classes.push('valid-movement');
      }
    }

    // Targeting mode highlighting
    if (targetingMode?.active && targetingMode.sourcePosition && isWithinTargetingRange(pos)) {
      classes.push('valid-target');
    }

    return classes.join(' ');
  }, [session, hoveredPosition, selectedToken, combatActive, targetingMode]);

  const currentTurnToken = tokens.find(t => t.characterId === currentTurn);

  // In BattleMap.tsx, replace the isEnemyGroupTurn function (around line 395):
  const isEnemyGroupTurn = (token: BattleToken, currentTurn: string): boolean => {
    if (!currentTurn || token.type !== 'enemy') return false;
    
    // Check if currentTurn contains "group" (indicating it's an enemy group turn)
    if (!currentTurn.includes('-group-')) return false;
    
    // Extract the enemy type from the group ID (e.g., "benisseur" from "benisseur-group-123456")
    const turnEnemyType = currentTurn.split('-group-')[0];
    
    // Normalize both names to handle accents and special characters
    const normalizeString = (str: string): string => {
      return str
        .toLowerCase()
        .normalize('NFD') // Decompose accented characters
        .replace(/[\u0300-\u036f]/g, '') // Remove accent marks
        .replace(/[^a-z0-9]/g, ''); // Remove non-alphanumeric
    };
    
    const normalizedTokenName = normalizeString(token.name);
    const normalizedTurnType = normalizeString(turnEnemyType);
    
    // Check if they match
    return normalizedTokenName === normalizedTurnType || 
           normalizedTokenName.includes(normalizedTurnType) || 
           normalizedTurnType.includes(normalizedTokenName);
  };

  // --- Render ----------------------------------------------------------------
  return (
    <div
      ref={containerRef}
      className={
        mode === 'player'
          ? 'relative w-full h-full bg-clair-shadow-900 flex flex-col overflow-hidden'
          : 'relative w-full h-full bg-clair-shadow-900 overflow-hidden'
      }
      style={mode === 'gm' ? { minHeight: 300 } : undefined}
    >
    {/* Top status bar - Only show in GM mode */}
    {mode === 'gm' && (
      <div className="flex-shrink-0 p-2">
        <div className="flex justify-between items-center">
          {/* Map Info */}
          <div className="bg-clair-shadow-800/95 backdrop-blur-sm border border-clair-gold-600 text-clair-gold-50 px-3 py-1 rounded-lg shadow-shadow">
            <h2 className="font-display text-sm font-bold text-clair-gold-400">{safeMap.name}</h2>
          </div>

          {/* Current Turn */}
          {combatActive && currentTurnToken && (
            <div className="bg-green-700/95 backdrop-blur-sm border border-green-500 text-white px-3 py-1 rounded-lg shadow-shadow">
              <p className="font-serif text-sm">
                <span className="font-bold">{currentTurnToken.name}</span>&nbsp;is acting
              </p>
            </div>
          )}

          {/* Targeting Mode */}
          {targetingMode?.active && (
            <div className="bg-clair-mystical-800/95 backdrop-blur-sm border border-clair-mystical-500 text-clair-mystical-50 px-3 py-1 rounded-lg shadow-shadow">
              <p className="font-serif font-bold text-sm text-clair-mystical-200">
                Targeting • Range: {targetingMode.range}ft
              </p>
            </div>
          )}
        </div>
      </div>
    )}

      {/* Board container */}
      <div className="flex-1 flex items-center justify-center p-2">
        <div
          className="relative"
          style={{ width: `${boardWidth}px`, height: `${boardHeight}px` }}
          onDragOver={handleDragOver}
          onTouchMove={handleTokenTouchMove}  // ADD THIS
          onTouchEnd={handleDrop}  
          onDrop={handleDrop}
        >
          {/* Background image (map) */}
          <div
            className="absolute"
            style={{
              left: coordinatePadding,
              top: coordinatePadding,
              width: totalWidth,
              height: totalHeight,
            }}
          >
            {safeMap.backgroundImage ? (
              <img
                src={safeMap.backgroundImage}
                alt={safeMap.name}
                className="w-full h-full object-cover select-none pointer-events-none"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full bg-slate-800" />
            )}
            <div className="absolute inset-0 bg-black/10 pointer-events-none" />
          </div>

          {/* Grid & coordinates */}
          <Grid
            width={safeMap.gridSize.width}
            height={safeMap.gridSize.height}
            gridSize={gridSize}
            showGrid={!!safeMap.gridVisible}
            showCoordinates={true}
            onGridClick={handleGridClick}
            onGridHover={handleGridHover}
            getCellClass={getGridCellClass}
            hoveredPosition={hoveredPosition}
          />

          {renderFireTerrainOverlays()}
          {renderHearthlightOverlays()}  {/* ADD THIS LINE */}
          {renderMineOverlays()}
          {renderRevealedSquareOverlays()}

          {validateTokens(tokens).map((token) => {
            // Check if this token is the current storm target
            const isStormTarget = session?.pendingStormRoll?.isActive && 
                                  session?.pendingStormRoll?.targetId === token.id;

            const isEnemyGroupActive = isEnemyGroupTurn(token, currentTurn || '');
             // if (token.type === 'enemy') {
             //    console.log(`Enemy: ${token.name}, CurrentTurn: ${currentTurn}, IsActive: ${isEnemyGroupActive}`);
             //  }
            return (
              <Token
                key={token.id}
                token={token}
                gridSize={gridSize}
                isSelected={selectedToken?.id === token.id}
                isDragging={draggedToken?.id === token.id}
                isCurrentTurn={!!(combatActive && token.characterId === currentTurn)}
                isValidTarget={!!(targetingMode?.active && isValidTarget(token.id))}
                isHighlighted={selectedEnemyId === token.id}
                isStormTarget={isStormTarget} // ADD THIS
                session={session} // Add this
                isEnemyGroupActive={isEnemyGroupActive}  // ADD THIS PROP
                onClick={handleTokenClick}
                onDragStart={handleTokenDragStart}
                onDragEnd={handleTokenDragEnd}
                coordinateOffset={{ x: coordinatePadding, y: coordinatePadding }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default BattleMap;