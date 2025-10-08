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
    if (mineCount === 0) return 'bg-green-500';
    if (mineCount <= 2) return 'bg-yellow-500';
    if (mineCount <= 4) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getGlowIntensity = () => {
    if (mineCount === 0) return 'shadow-[0_0_15px_rgba(34,197,94,0.6)]';
    if (mineCount <= 2) return 'shadow-[0_0_15px_rgba(234,179,8,0.6)]';
    if (mineCount <= 4) return 'shadow-[0_0_15px_rgba(249,115,22,0.6)]';
    return 'shadow-[0_0_20px_rgba(239,68,68,0.7)]';
  };

  return (
    <div
      className={`absolute inset-0 ${getColorClass()} ${getGlowIntensity()} opacity-30 rounded pointer-events-none animate-pulse`}
      style={{
        width: gridSize,
        height: gridSize,
        animation: 'revealPulse 1s ease-out'
      }}
    />
  );
};