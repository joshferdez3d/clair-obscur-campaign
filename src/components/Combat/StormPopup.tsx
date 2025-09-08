import React, { useState } from 'react';
import { StormService } from '../../services/StormService';
import type { PendingStormRoll } from '../../types';

interface StormPopupProps {
  sessionId: string;
  pendingRoll: PendingStormRoll;
  onClose?: () => void;
}

export const StormPopup: React.FC<StormPopupProps> = ({
  sessionId,
  pendingRoll,
  onClose
}) => {
  const [damage, setDamage] = useState<number>(0);
  const [isRolling, setIsRolling] = useState(false);
  const [hasRolled, setHasRolled] = useState(false);

  const handleRollDamage = () => {
    setIsRolling(true);
    
    // Simulate rolling 6d6 radiant damage
    const rolls = Array.from({ length: 6 }, () => Math.floor(Math.random() * 6) + 1);
    const totalDamage = rolls.reduce((sum, roll) => sum + roll, 0);
    
    // Animate the rolling
    let currentTotal = 0;
    const interval = setInterval(() => {
      currentTotal += Math.floor(Math.random() * 10) + 1;
      if (currentTotal >= totalDamage) {
        currentTotal = totalDamage;
        setDamage(currentTotal);
        setIsRolling(false);
        setHasRolled(true);
        clearInterval(interval);
      } else {
        setDamage(currentTotal);
      }
    }, 100);
  };

  const handleApplyDamage = async () => {
    await StormService.resolveStormAttack(sessionId, pendingRoll.id, damage);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 border border-purple-400 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-purple-100 mb-2">
            ⚡ Crescendo of Fate ⚡
          </h2>
          <p className="text-purple-200">
            Turn {pendingRoll.turnNumber} of 5
          </p>
        </div>

        <div className="bg-purple-800 bg-opacity-50 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-purple-100 mb-2">
            Target: {pendingRoll.targetName}
          </h3>
          <p className="text-purple-200 text-sm">
            Radiant storm strikes from the heavens!
          </p>
        </div>

        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-purple-100 mb-2">
            {isRolling ? (
              <span className="animate-pulse">Rolling...</span>
            ) : hasRolled ? (
              <span className="text-yellow-300">{damage} Damage</span>
            ) : (
              <span className="text-purple-300">6d6 Radiant</span>
            )}
          </div>
          
          {hasRolled && (
            <p className="text-sm text-purple-200">
              The radiant glyphs pierce through darkness!
            </p>
          )}
        </div>

        <div className="flex gap-3">
          {!hasRolled ? (
            <button
              onClick={handleRollDamage}
              disabled={isRolling}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 
                       text-white font-semibold py-3 px-4 rounded-lg transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRolling ? 'Rolling...' : 'Roll Damage'}
            </button>
          ) : (
            <>
              <button
                onClick={handleApplyDamage}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white 
                         font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Apply Damage
              </button>
              <button
                onClick={() => {
                  setHasRolled(false);
                  setDamage(0);
                }}
                className="px-4 py-3 bg-purple-700 hover:bg-purple-600 text-white 
                         rounded-lg transition-colors"
              >
                Reroll
              </button>
            </>
          )}
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-purple-300">
            Storm continues for {5 - pendingRoll.turnNumber} more turns
          </p>
        </div>
      </div>
    </div>
  );
};