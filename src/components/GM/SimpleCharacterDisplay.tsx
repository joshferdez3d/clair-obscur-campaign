import React from 'react';
import { Heart, Settings } from 'lucide-react';

interface SimpleCharacterDisplayProps {
  characterId: string;
  characterName: string;
  currentHP: number;
  maxHP: number;
  isLoading: boolean;
  onOpenHPSettings: () => void;
}

export function SimpleCharacterDisplay({
  characterId,
  characterName,
  currentHP,
  maxHP,
  isLoading,
  onOpenHPSettings,
}: SimpleCharacterDisplayProps) {
  const hpPercentage = maxHP > 0 ? (currentHP / maxHP) * 100 : 0;

  const getHPBarColor = () => {
    if (currentHP <= 0) return 'bg-red-600';
    if (hpPercentage <= 25) return 'bg-red-500';
    if (hpPercentage <= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getHPTextColor = () => {
    if (currentHP <= 0) return 'text-red-200';
    if (hpPercentage <= 25) return 'text-red-200';
    if (hpPercentage <= 50) return 'text-yellow-200';
    return 'text-green-200';
  };

  const getStatusText = () => {
    if (currentHP <= 0) return 'UNCONSCIOUS';
    if (currentHP <= maxHP * 0.25) return 'CRITICALLY WOUNDED';
    return null;
  };

  const statusText = getStatusText();

  return (
    <div className="bg-clair-dark-800 border border-clair-shadow-600 rounded-lg p-4 min-h-[120px]">
      {/* Character Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-white">{characterName}</h3>
        <button
          onClick={onOpenHPSettings}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 bg-clair-shadow-600 hover:bg-clair-shadow-500 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
          title="Open HP Settings"
        >
          <Settings className="h-4 w-4" />
          HP Settings
        </button>
      </div>

      {/* HP Display */}
      <div className="flex items-center gap-3 mb-3">
        <Heart className="h-4 w-4 text-red-400 flex-shrink-0" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className={`font-bold text-sm ${getHPTextColor()}`}>
              {currentHP} / {maxHP}
            </span>
            <span className="text-xs text-gray-300">
              {hpPercentage.toFixed(0)}%
            </span>
          </div>
          
          {/* HP Bar */}
          <div className="w-full bg-clair-shadow-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${getHPBarColor()}`}
              style={{ width: `${Math.max(0, Math.min(100, hpPercentage))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Status Indicator */}
      {statusText && (
        <div className={`text-center py-1 px-2 rounded text-xs font-bold ${
          currentHP <= 0 
            ? 'bg-red-900 border border-red-500 text-red-200'
            : 'bg-yellow-900 border border-yellow-500 text-yellow-200'
        }`}>
          {statusText}
        </div>
      )}
    </div>
  );
}