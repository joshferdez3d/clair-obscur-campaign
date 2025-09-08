import React from 'react';
import { Heart, Plus, Minus } from 'lucide-react';

interface HPTrackerProps {
  currentHP: number;
  maxHP: number;
  onHPChange: (delta: number) => void;
  isLoading?: boolean;
  showControls?: boolean; // NEW: Control whether to show HP buttons
}

export function HPTracker({ 
  currentHP, 
  maxHP, 
  onHPChange, 
  isLoading = false,
  showControls = true // Default to true for backward compatibility
}: HPTrackerProps) {
  const hpPercentage = (currentHP / maxHP) * 100;
  
  const getHPColor = () => {
    if (hpPercentage > 60) return 'bg-clair-success';
    if (hpPercentage > 30) return 'bg-clair-warning';
    return 'bg-clair-danger';
  };

  const getHPGlow = () => {
    if (hpPercentage > 60) return 'shadow-lg shadow-green-500/20';
    if (hpPercentage > 30) return 'shadow-lg shadow-yellow-500/20';
    return 'shadow-lg shadow-red-500/20';
  };

  return (
    <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 mb-4 border border-clair-gold-600">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <Heart className="w-6 h-6 text-red-500 mr-2" />
          <h3 className="font-display text-lg font-bold text-clair-gold-400">Vitality</h3>
        </div>
        <div className="font-serif text-2xl font-bold text-clair-gold-50">
          {currentHP} / {maxHP}
        </div>
      </div>
      
      {/* HP Bar */}
      <div className="w-full bg-clair-shadow-800 rounded-full h-4 mb-4 overflow-hidden border border-clair-shadow-400">
        <div 
          className={`h-full ${getHPColor()} ${getHPGlow()} transition-all duration-500 ease-out`}
          style={{ width: `${hpPercentage}%` }}
        />
      </div>
      
      {/* HP Control Buttons - Only show if showControls is true */}
      {showControls && (
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => onHPChange(-1)}
            disabled={isLoading || currentHP <= 0}
            className="flex items-center justify-center w-12 h-12 bg-clair-danger hover:bg-red-600 text-white rounded-full shadow-lg active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-sans"
            style={{ minHeight: '48px', minWidth: '48px' }}
          >
            <Minus className="w-6 h-6" />
          </button>
          
          <button
            onClick={() => onHPChange(-5)}
            disabled={isLoading || currentHP <= 0}
            className="flex items-center justify-center px-4 h-12 bg-red-700 hover:bg-red-800 text-white rounded-lg shadow-lg active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-sans"
            style={{ minHeight: '48px' }}
          >
            <span className="font-bold">-5</span>
          </button>
          
          <button
            onClick={() => onHPChange(1)}
            disabled={isLoading || currentHP >= maxHP}
            className="flex items-center justify-center w-12 h-12 bg-clair-success hover:bg-green-600 text-white rounded-full shadow-lg active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-sans"
            style={{ minHeight: '48px', minWidth: '48px' }}
          >
            <Plus className="w-6 h-6" />
          </button>
          
          <button
            onClick={() => onHPChange(5)}
            disabled={isLoading || currentHP >= maxHP}
            className="flex items-center justify-center px-4 h-12 bg-green-700 hover:bg-green-800 text-white rounded-lg shadow-lg active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-sans"
            style={{ minHeight: '48px' }}
          >
            <span className="font-bold">+5</span>
          </button>
        </div>
      )}

      {/* Show message for players when controls are hidden */}
      {!showControls && (
        <div className="text-center">
          <p className="text-clair-gold-300 text-sm italic">
            HP is managed by the DM
          </p>
        </div>
      )}
    </div>
  );
}