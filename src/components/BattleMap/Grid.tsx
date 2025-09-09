// src/components/BattleMap/Grid.tsx - Fixed with individual cell rendering
import React from 'react';

interface GridProps {
  width: number;
  height: number;
  gridSize: number;
  showGrid?: boolean;
  showCoordinates?: boolean;
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
  onGridClick,
  onGridHover,
  getCellClass,
  hoveredPosition
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

  const handleMouseMove = (event: React.MouseEvent<SVGElement>) => {
    if (!onGridHover) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / gridSize);
    const y = Math.floor((event.clientY - rect.top) / gridSize);

    if (x >= 0 && x < width && y >= 0 && y < height) {
      onGridHover({ x, y });
    }
  };

  const handleMouseLeave = () => {
    if (onGridHover) {
      onGridHover(null);
    }
  };

  const coordinatePadding = showCoordinates ? 24 : 0;

  // Function to get cell fill color based on class
  const getCellFill = (x: number, y: number): string => {
    if (!getCellClass) return 'transparent';
    
    const cellClass = getCellClass({ x, y });
    
    // Map CSS classes to SVG fill colors
    if (cellClass.includes('fire')) return 'rgba(239, 68, 68, 0.6)'; // red-500 with opacity
    if (cellClass.includes('ice')) return 'rgba(59, 130, 246, 0.6)'; // blue-500 with opacity  
    if (cellClass.includes('nature')) return 'rgba(34, 197, 94, 0.6)'; // green-500 with opacity
    if (cellClass.includes('light') || cellClass.includes('light-blind')) return 'rgba(255, 255, 255, 0.8)';
    if (cellClass.includes('hover')) return 'rgba(255, 255, 255, 0.2)'; // white hover
    if (cellClass.includes('valid-target')) return 'rgba(34, 197, 94, 0.3)'; // green tint
    if (cellClass.includes('invalid')) return 'rgba(239, 68, 68, 0.3)'; // red tint
    
    return 'transparent';
  };

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
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ 
          zIndex: 1,
          left: coordinatePadding,
          top: coordinatePadding,
        }}
      >
        {/* Individual Grid Cells for Visual Feedback */}
        {Array.from({ length: width }).map((_, x) =>
          Array.from({ length: height }).map((_, y) => {
            const fill = getCellFill(x, y);
            if (fill === 'transparent') return null;
            
            return (
              <rect
                key={`cell-${x}-${y}`}
                x={x * gridSize}
                y={y * gridSize}
                width={gridSize}
                height={gridSize}
                fill={fill}
                className="pointer-events-none"
              />
            );
          })
        )}

        {/* Grid Pattern */}
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