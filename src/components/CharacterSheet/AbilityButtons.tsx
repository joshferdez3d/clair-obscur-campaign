import React from 'react';
import { Sword, Zap, Target } from 'lucide-react';
import type { Ability } from '../../types';

interface AbilityButtonsProps {
  abilities: Ability[];
  onAbilityUse: (ability: Ability) => void;
  isLoading?: boolean;
}

const abilityIcons: { [key: string]: React.ComponentType<any> } = {
  'fencers_slash': Sword,
  'flourish_chain': Target,
  'sword_slash': Sword,
  'prosthetic_strike': Zap,
  'default': Zap
};

export function AbilityButtons({ abilities, onAbilityUse, isLoading = false }: AbilityButtonsProps) {
  const getAbilityIcon = (abilityId: string) => {
    return abilityIcons[abilityId] || abilityIcons.default;
  };

  const getAbilityColor = (type: string) => {
    switch (type) {
      case 'action':
        return {
          bg: 'bg-clair-mystical-500 hover:bg-clair-mystical-600',
          border: 'border-clair-mystical-400',
          shadow: 'shadow-lg shadow-purple-500/20'
        };
      case 'bonus_action':
        return {
          bg: 'bg-orange-600 hover:bg-orange-700',
          border: 'border-orange-400',
          shadow: 'shadow-lg shadow-orange-500/20'
        };
      case 'reaction':
        return {
          bg: 'bg-clair-warning hover:bg-yellow-600',
          border: 'border-yellow-400',
          shadow: 'shadow-lg shadow-yellow-500/20'
        };
      default:
        return {
          bg: 'bg-clair-shadow-500 hover:bg-clair-shadow-400',
          border: 'border-clair-gold-600',
          shadow: 'shadow-lg shadow-gray-500/20'
        };
    }
  };

  return (
    <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 mb-4 border border-clair-gold-600">
      <h3 className="font-display text-lg font-bold text-clair-gold-400 mb-3">Abilities</h3>
      
      <div className="space-y-3">
        {abilities.map((ability) => {
          const Icon = getAbilityIcon(ability.id);
          const colorConfig = getAbilityColor(ability.type);
          
          return (
            <button
              key={ability.id}
              onClick={() => onAbilityUse(ability)}
              disabled={isLoading}
              className={`
                w-full flex items-center p-4 rounded-lg text-white transition-all duration-200 border-2
                ${colorConfig.bg} ${colorConfig.border} ${colorConfig.shadow}
                hover:border-clair-gold-400 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
              `}
              style={{ minHeight: '64px' }}
            >
              <Icon className="w-6 h-6 mr-3 flex-shrink-0" />
              <div className="flex-1 text-left">
                <div className="font-serif font-bold text-base">{ability.name}</div>
                <div className="font-sans text-sm opacity-90 line-clamp-2">{ability.description}</div>
                {ability.damage && (
                  <div className="font-sans text-xs opacity-75 mt-1 text-clair-gold-200">{ability.damage}</div>
                )}
              </div>
              <div className="font-sans text-xs bg-black bg-opacity-30 px-2 py-1 rounded capitalize border border-black border-opacity-20">
                {ability.type.replace('_', ' ')}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}