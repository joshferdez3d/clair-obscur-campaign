import React from 'react';
import type { Stats } from '../../types';

interface StatDisplayProps {
  stats: Stats;
}

const statNames = {
  str: 'Strength',
  dex: 'Dexterity', 
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma'
};

export function StatDisplay({ stats }: StatDisplayProps) {
  const getModifier = (score: number) => Math.floor((score - 10) / 2);
  
  const formatModifier = (modifier: number) => {
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
  };

  return (
    <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 mb-4 border border-clair-gold-600">
      <h3 className="font-display text-lg font-bold text-clair-gold-400 mb-3">Ability Scores</h3>
      
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(stats).map(([key, value]) => {
          const modifier = getModifier(value);
          
          return (
            <div key={key} className="text-center p-3 bg-clair-shadow-500 rounded-lg border border-clair-shadow-400 hover:border-clair-gold-600 transition-colors">
              <div className="font-sans text-xs font-medium text-clair-gold-300 uppercase tracking-wide mb-1">
                {statNames[key as keyof Stats]}
              </div>
              <div className="font-serif text-2xl font-bold text-clair-gold-50">{value}</div>
              <div className="font-sans text-sm text-clair-gold-200">
                ({formatModifier(modifier)})
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}