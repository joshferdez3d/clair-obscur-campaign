// src/components/BattleMap/Grid.tsx - Updated with Chess-style coordinates
import React from 'react';

interface GridProps {
  width: number;
  height: number;
  gridSize: number;
  showGrid?: boolean;
  showCoordinates?: boolean; // New prop to control coordinate visibility
  onGridClick?: (position: { x: number; y: number }) => void;
  onGridHover?: (position: { x: number; y: number } | null) => void;
  getCellClass?: (position: { x: number; y: number }) => string;
  hoveredPosition?: { x: number; y: number } | null;
}

export function Grid({ 
  width, 
  height, 
  gridSize, 
  showGrid = true, 
  showCoordinates = false,
  onGridClick 
}: GridProps) {
  const totalWidth = width * gridSize;
  const totalHeight = height * gridSize;

  // Chess-style coordinate conversion
  const getLetterCoordinate = (x: number): string => {
    return String.fromCharCode(65 + x); // A, B, C, D, E, F, G, H...
  };

  const getNumberCoordinate = (y: number): string => {
    return (y + 1).toString(); // 1, 2, 3, 4, 5, 6, 7, 8...
  };

  const handleClick = (event: React.MouseEvent<SVGElement>) => {
    if (!onGridClick) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / gridSize);
    const y = Math.floor((event.clientY - rect.top) / gridSize);

    // Ensure coordinates are within bounds
    if (x >= 0 && x < width && y >= 0 && y < height) {
      onGridClick({ x, y });
    }
  };

  const coordinatePadding = showCoordinates ? 24 : 0;

  return (
    <div className="relative">
      {/* Chess Coordinates */}
      {showCoordinates && (
        <>
          {/* Letters at the bottom */}
          <div 
            className="absolute flex justify-center items-center"
            style={{
              left: coordinatePadding,
              top: totalHeight + 4,
              width: totalWidth,
              height: 20,
            }}
          >
            {Array.from({ length: width }).map((_, x) => (
              <div
                key={`letter-${x}`}
                className="text-white font-bold text-sm font-mono flex items-center justify-center"
                style={{
                  width: gridSize,
                  height: 20,
                }}
              >
                {getLetterCoordinate(x)}
              </div>
            ))}
          </div>

          {/* Numbers on the left side */}
          <div 
            className="absolute flex flex-col justify-center items-center"
            style={{
              left: 0,
              top: coordinatePadding,
              width: 20,
              height: totalHeight,
            }}
          >
            {Array.from({ length: height }).map((_, y) => (
              <div
                key={`number-${y}`}
                className="text-white font-bold text-sm font-mono flex items-center justify-center"
                style={{
                  width: 20,
                  height: gridSize,
                }}
              >
                {getNumberCoordinate(y)}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Main SVG Grid */}
      <svg
        width={totalWidth}
        height={totalHeight}
        className="absolute pointer-events-auto"
        onClick={handleClick}
        style={{ 
          zIndex: 1,
          left: coordinatePadding,
          top: coordinatePadding,
        }}
      >
        {showGrid && (
          <defs>
            <pattern
              id="grid"
              width={gridSize}
              height={gridSize}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
                fill="none"
                stroke="rgba(255, 255, 255, 0.4)"
                strokeWidth="1.5"
              />
            </pattern>
          </defs>
        )}
        
        {showGrid && (
          <rect
            width="100%"
            height="100%"
            fill="url(#grid)"
          />
        )}
        
        {/* Grid cell coordinates on hover (optional, only in development) */}
        {showGrid && showCoordinates && process.env.NODE_ENV === 'development' && (
          <g className="pointer-events-none">
            {Array.from({ length: width }).map((_, x) =>
              Array.from({ length: height }).map((_, y) => (
                <text
                  key={`cell-${x}-${y}`}
                  x={x * gridSize + gridSize / 2}
                  y={y * gridSize + gridSize / 2 + 4}
                  className="fill-white text-xs font-mono opacity-20 pointer-events-none"
                  textAnchor="middle"
                  fontSize="8"
                >
                  {getLetterCoordinate(x)}{getNumberCoordinate(y)}
                </text>
              ))
            )}
          </g>
        )}
      </svg>
    </div>
  );
}