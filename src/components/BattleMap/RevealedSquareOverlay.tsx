// src/components/BattleMap/RevealedSquareOverlay.tsx
import React from 'react';

interface RevealedSquareOverlayProps {
  mineCount: number;
  gridSize: number;
}

export const RevealedSquareOverlay: React.FC<RevealedSquareOverlayProps> = ({
  mineCount,
  gridSize
}) => {
  const getColorClass = () => {
    if (mineCount === 0) return 'bg-green-400';
    if (mineCount === 1) return 'bg-yellow-400';
    if (mineCount === 2) return 'bg-orange-400';
    return 'bg-red-500'; // 3+
  };

  const getGlowIntensity = () => {
    if (mineCount === 0) return 'shadow-[0_0_25px_rgba(74,222,128,0.9)]';
    if (mineCount === 1) return 'shadow-[0_0_25px_rgba(250,204,21,0.9)]';
    if (mineCount === 2) return 'shadow-[0_0_25px_rgba(251,146,60,0.9)]';
    return 'shadow-[0_0_30px_rgba(239,68,68,1)]'; // 3+
  };

  return (
    <div
      className={`absolute inset-0 ${getColorClass()} ${getGlowIntensity()} opacity-60 rounded pointer-events-none animate-pulse`}
      style={{
        width: gridSize,
        height: gridSize,
        animation: 'revealPulse 1s ease-out'
      }}
    />
  );
};