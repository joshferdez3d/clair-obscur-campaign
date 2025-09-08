// src/components/BattleMap/BattleMap.tsx
import React, { useState, useCallback, useRef, useLayoutEffect } from 'react';
import { Token } from './Token';
import { Grid } from './Grid';
import type { BattleToken, BattleMap as BattleMapType, Position } from '../../types';

type BattleMapMode = 'player' | 'gm';

interface BattleMapProps {
  map: BattleMapType;
  tokens: BattleToken[];
  isGM?: boolean;
  currentTurn?: string;
  combatActive?: boolean;

  onTokenMove?: (tokenId: string, newPosition: Position) => Promise<boolean>;
  onTokenSelect?: (token: BattleToken | null) => void;
  onGridClick?: (position: Position) => void;

  targetingMode?: {
    active: boolean;
    sourcePosition?: Position; // grid coords
    range: number;             // feet, 5ft per cell
    validTargets?: string[];   // token ids that are valid
  };

  /** Max movement in feet for a creature on its turn (default 30ft) */
  maxMovementRange?: number;

  /** Controls layout behavior: 'player' (fullscreen) | 'gm' (embedded) */
  mode?: BattleMapMode;
}

export function BattleMap({
  map,
  tokens,
  isGM = false,
  currentTurn,
  combatActive = false,
  onTokenMove,
  onTokenSelect,
  onGridClick,
  targetingMode,
  maxMovementRange = 30,
  mode = 'player',
}: BattleMapProps) {
  const [selectedToken, setSelectedToken] = useState<BattleToken | null>(null);
  const [draggedToken, setDraggedToken] = useState<BattleToken | null>(null);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [hoveredPosition, setHoveredPosition] = useState<Position | null>(null);

  // --- Layout sizing ---------------------------------------------------------
  // Space around the board for the coordinate labels we draw
  const coordinatePadding = 32;

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
        // For player mode, use available space instead of full window
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

  const maxGridSizeByWidth = Math.floor((viewportWidth - 80) / map.gridSize.width);
  const maxGridSizeByHeight = Math.floor((viewportHeight - 120) / map.gridSize.height);
  const gridSize = Math.max(8, Math.min(maxGridSizeByWidth, maxGridSizeByHeight, 60));

  const totalWidth = map.gridSize.width * gridSize;
  const totalHeight = map.gridSize.height * gridSize;
  const boardWidth = totalWidth + coordinatePadding;
  const boardHeight = totalHeight + coordinatePadding;

  // --- Helpers ---------------------------------------------------------------
  const getChessNotation = (pos: Position): string => {
    const letter = String.fromCharCode(65 + pos.x); // A, B, C...
    const number = pos.y + 1;
    return `${letter}${number}`;
  };

  const calculateDistance = (a: Position, b: Position): number => {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    // Manhattan distance (5 ft per square)
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

  // --- Handlers --------------------------------------------------------------
  const handleTokenClick = useCallback((token: BattleToken) => {
    // Targeting mode first
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

  const handleTokenDragStart = useCallback((token: BattleToken, ev: React.DragEvent) => {
    if (combatActive && !isGM && token.characterId !== currentTurn) {
      ev.preventDefault();
      return;
    }

    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: ev.clientX - rect.left,
      y: ev.clientY - rect.top,
    });
    setDraggedToken(token);
  }, [combatActive, isGM, currentTurn]);

  const handleTokenDragEnd = useCallback(() => {
    setDraggedToken(null);
    setDragOffset({ x: 0, y: 0 });
  }, []);

  const handleDragOver = useCallback((ev: React.DragEvent) => {
    ev.preventDefault();
  }, []);

  const handleDrop = useCallback(async (ev: React.DragEvent) => {
    ev.preventDefault();
    if (!draggedToken) return;

    const rect = ev.currentTarget.getBoundingClientRect();
    const x = Math.floor((ev.clientX - rect.left - coordinatePadding) / gridSize);
    const y = Math.floor((ev.clientY - rect.top - coordinatePadding) / gridSize);

    if (x < 0 || x >= map.gridSize.width || y < 0 || y >= map.gridSize.height) {
      setDraggedToken(null);
      return;
    }

    const dest = { x, y };
    if (combatActive && !isGM && !isWithinMovementRange(draggedToken, dest)) {
      console.log('Movement exceeds range limit');
      setDraggedToken(null);
      return;
    }

    await handleTokenMove(draggedToken.id, dest);
    setDraggedToken(null);
  }, [draggedToken, gridSize, map.gridSize.width, map.gridSize.height, combatActive, isGM, handleTokenMove]);

  const handleGridHover = useCallback((pos: Position | null) => {
    setHoveredPosition(pos);
  }, []);

  const getGridCellClass = useCallback((pos: Position) => {
    if (hoveredPosition && hoveredPosition.x === pos.x && hoveredPosition.y === pos.y) {
      return 'bg-white/5';
    }

    if (selectedToken && combatActive) {
      if (isWithinMovementRange(selectedToken, pos)) {
        return 'bg-green-400/20 border border-green-400/40';
      }
    }

    if (targetingMode?.active && targetingMode.sourcePosition && isWithinTargetingRange(pos)) {
      return 'bg-purple-400/20 border border-purple-400/40';
    }

    return '';
  }, [hoveredPosition, selectedToken, combatActive, targetingMode]);

  const currentTurnToken = tokens.find(t => t.characterId === currentTurn);

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
      {/* Top status bar */}
      <div className="flex-shrink-0 p-2">
        <div className="flex justify-between items-center">
          {/* Map Info - Simplified, removed duplicate grid info */}
          <div className="bg-clair-shadow-800/95 backdrop-blur-sm border border-clair-gold-600 text-clair-gold-50 px-4 py-2 rounded-lg shadow-shadow">
            <h2 className="font-display text-lg font-bold text-clair-gold-400">{map.name ?? 'Battle Map'}</h2>
          </div>

          {/* Current Turn */}
          {combatActive && currentTurnToken && (
            <div className="bg-green-700/95 backdrop-blur-sm border border-green-500 text-white px-4 py-2 rounded-lg shadow-shadow">
              <p className="font-serif text-sm">
                <span className="font-bold">{currentTurnToken.name}</span>&nbsp;is acting
              </p>
            </div>
          )}

          {/* Targeting Mode */}
          {targetingMode?.active && (
            <div className="bg-clair-mystical-800/95 backdrop-blur-sm border border-clair-mystical-500 text-clair-mystical-50 px-4 py-2 rounded-lg shadow-shadow">
              <p className="font-serif font-bold text-sm text-clair-mystical-200">
                Targeting • Range: {targetingMode.range}ft
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Board container - flex-1 to take remaining space */}
      <div className="flex-1 flex items-center justify-center p-2">
        <div
          className="relative"
          style={{ width: `${boardWidth}px`, height: `${boardHeight}px` }}
          onDragOver={handleDragOver}
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
            {map.backgroundImage ? (
              <img
                src={map.backgroundImage}
                alt={map.name ?? 'Battle map background'}
                className="w-full h-full object-cover select-none pointer-events-none"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full bg-slate-800" />
            )}
            {/* Optional overlay tint */}
            <div className="absolute inset-0 bg-black/10 pointer-events-none" />
          </div>

          {/* Grid & coordinates */}
          <Grid
            width={map.gridSize.width}
            height={map.gridSize.height}
            gridSize={gridSize}
            showGrid={!!map.gridVisible}
            showCoordinates={true}
            onGridClick={handleGridClick}
            onGridHover={handleGridHover}
            getCellClass={getGridCellClass}
            hoveredPosition={hoveredPosition}
          />

          

          {/* Tokens */}
          {tokens.map((token) => (
            <Token
              key={token.id}
              token={token}
              gridSize={gridSize}
              isSelected={selectedToken?.id === token.id}
              isDragging={draggedToken?.id === token.id}
              isCurrentTurn={!!(combatActive && token.characterId === currentTurn)}
              isValidTarget={!!(targetingMode?.active && isValidTarget(token.id))}
              onClick={handleTokenClick}
              onDragStart={handleTokenDragStart}
              onDragEnd={handleTokenDragEnd}
              coordinateOffset={{ x: coordinatePadding, y: coordinatePadding }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default BattleMap;