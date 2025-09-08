import React from 'react';
import { Sword, Shield, Zap } from 'lucide-react';
import type { Stance } from '../../types';

interface StanceSelectorProps {
  currentStance: Stance;
  onStanceChange: (stance: Stance) => void;
  isLoading?: boolean;
}

const stanceConfig = {
  offensive: {
    name: 'Offensive',
    icon: Sword,
    color: 'bg-red-600 hover:bg-red-700',
    description: '+2 damage on next attack',
    activeColor: 'bg-red-700 ring-4 ring-red-400 ring-opacity-50',
    gradient: 'bg-gradient-to-r from-red-600 to-red-700'
  },
  defensive: {
    name: 'Defensive', 
    icon: Shield,
    color: 'bg-blue-600 hover:bg-blue-700',
    description: '+2 AC until next turn',
    activeColor: 'bg-blue-700 ring-4 ring-blue-400 ring-opacity-50',
    gradient: 'bg-gradient-to-r from-blue-600 to-blue-700'
  },
  agile: {
    name: 'Agile',
    icon: Zap,
    color: 'bg-green-600 hover:bg-green-700',
    description: '+10 ft movement',
    activeColor: 'bg-green-700 ring-4 ring-green-400 ring-opacity-50',
    gradient: 'bg-gradient-to-r from-green-600 to-green-700'
  }
};

export function StanceSelector({ currentStance, onStanceChange, isLoading = false }: StanceSelectorProps) {
  return (
    <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 mb-4 border border-clair-mystical-500">
      <h3 className="font-display text-lg font-bold text-clair-mystical-300 mb-3">Combat Stance</h3>
      
      <div className="grid grid-cols-1 gap-3">
        {Object.entries(stanceConfig).map(([stance, config]) => {
          const Icon = config.icon;
          const isActive = currentStance === stance;
          
          return (
            <button
              key={stance}
              onClick={() => onStanceChange(stance as Stance)}
              disabled={isLoading}
              className={`
                flex items-center p-3 rounded-lg text-white transition-all duration-200 border-2
                ${isActive 
                  ? `${config.activeColor} border-transparent shadow-lg` 
                  : `${config.color} border-clair-shadow-400 hover:border-clair-gold-600`
                }
                active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
              `}
              style={{ minHeight: '56px' }}
            >
              <Icon className="w-6 h-6 mr-3" />
              <div className="flex-1 text-left">
                <div className="font-serif font-bold">{config.name}</div>
                <div className="font-sans text-sm opacity-90">{config.description}</div>
              </div>
              {isActive && (
                <div className="w-3 h-3 bg-clair-gold-400 rounded-full shadow-clair" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}