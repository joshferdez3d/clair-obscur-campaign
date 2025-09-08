import React from 'react';
import type { StormState } from '../../types';

interface StormIndicatorProps {
  stormState: StormState;
}

export const StormIndicator: React.FC<StormIndicatorProps> = ({ stormState }) => {
  if (!stormState.isActive) return null;

  return (
    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg p-4 mb-4 border border-purple-400">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-white font-bold text-lg">⚡ Crescendo of Fate</h3>
        <span className="text-purple-200 text-sm">
          Turn {stormState.currentTurn} / {stormState.totalTurns}
        </span>
      </div>
      
      <div className="w-full bg-purple-800 rounded-full h-2 mb-2">
        <div 
          className="bg-gradient-to-r from-yellow-400 to-purple-400 h-2 rounded-full transition-all duration-500"
          style={{ 
            width: `${((stormState.totalTurns - stormState.turnsRemaining) / stormState.totalTurns) * 100}%` 
          }}
        />
      </div>
      
      <p className="text-purple-200 text-sm">
        Radiant storm rages across the battlefield! 
        <span className="font-semibold"> {stormState.turnsRemaining} turns remaining</span>
      </p>
    </div>
  );
};