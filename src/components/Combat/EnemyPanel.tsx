// src/components/Combat/EnemyPanel.tsx
import React from 'react';
import { Skull, Heart, Shield, Zap } from 'lucide-react';
import type { BattleToken } from '../../types';

interface EnemyPanelProps {
  enemies: BattleToken[];
  isGMView?: boolean;
  onRemoveEnemy?: (enemyId: string) => void;
  onEditHP?: (enemyId: string, newHP: number) => void;
}

export function EnemyPanel({ enemies, isGMView = false, onRemoveEnemy, onEditHP }: EnemyPanelProps) {
  if (enemies.length === 0) {
    return (
      <div className="bg-clair-shadow-800 border border-clair-gold-600 rounded-lg p-4">
        <h3 className="font-display text-lg font-bold text-clair-gold-400 mb-2 flex items-center">
          <Skull className="w-5 h-5 mr-2" />
          Enemy Status
        </h3>
        <p className="text-clair-gold-300 text-sm">No enemies on the battlefield</p>
      </div>
    );
  }

  // Sort enemies by type, then by HP (wounded first)
  const sortedEnemies = [...enemies].sort((a, b) => {
    // First by type
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    // Then by HP percentage (wounded first)
    const aHPPercent = (a.hp ?? 0) / (a.maxHp ?? 1);
    const bHPPercent = (b.hp ?? 0) / (b.maxHp ?? 1);
    return aHPPercent - bHPPercent;
  });

  const getHPBarColor = (currentHP: number, maxHP: number) => {
    const percentage = currentHP / maxHP;
    if (percentage > 0.75) return 'bg-green-500';
    if (percentage > 0.5) return 'bg-yellow-500';
    if (percentage > 0.25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getHPBarBorder = (currentHP: number, maxHP: number) => {
    const percentage = currentHP / maxHP;
    if (percentage > 0.75) return 'border-green-400';
    if (percentage > 0.5) return 'border-yellow-400';
    if (percentage > 0.25) return 'border-orange-400';
    return 'border-red-400';
  };

  return (
    <div className="bg-clair-shadow-800 border border-clair-gold-600 rounded-lg p-4">
      <h3 className="font-display text-lg font-bold text-clair-gold-400 mb-3 flex items-center justify-between">
        <div className="flex items-center">
          <Skull className="w-5 h-5 mr-2" />
          Enemy Status ({enemies.length})
        </div>
        {isGMView && (
          <div className="text-xs text-clair-gold-300">
            GM View
          </div>
        )}
      </h3>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {sortedEnemies.map((enemy) => {
          const currentHP = enemy.hp ?? 0;
          const maxHP = enemy.maxHp ?? 1;
          const hpPercentage = (currentHP / maxHP) * 100;
          const isDead = currentHP <= 0;

          return (
            <div 
              key={enemy.id} 
              className={`p-3 rounded-lg border transition-all ${
                isDead 
                  ? 'bg-gray-800/50 border-gray-600 opacity-60' 
                  : 'bg-clair-shadow-700 border-clair-shadow-400 hover:border-clair-gold-600'
              }`}
            >
              {/* Enemy Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-2 ${isDead ? 'bg-gray-500' : 'bg-red-500'}`} />
                  <h4 className={`font-bold ${isDead ? 'text-gray-400 line-through' : 'text-clair-gold-200'}`}>
                    {enemy.name}
                  </h4>
                  {isDead && (
                    <span className="ml-2 text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">DEAD</span>
                  )}
                </div>
                
                {isGMView && onRemoveEnemy && (
                  <button
                    onClick={() => onRemoveEnemy(enemy.id)}
                    className="text-red-400 hover:text-red-300 text-xs px-2 py-1 border border-red-400 rounded"
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* HP Bar */}
              <div className="mb-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-clair-gold-300 flex items-center">
                    <Heart className="w-3 h-3 mr-1" />
                    HP
                  </span>
                  <span className={`text-xs font-mono ${isDead ? 'text-gray-400' : 'text-clair-gold-200'}`}>
                    {currentHP}/{maxHP}
                  </span>
                </div>
                
                <div className={`w-full bg-gray-700 rounded-full h-2 border ${getHPBarBorder(currentHP, maxHP)}`}>
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${getHPBarColor(currentHP, maxHP)}`}
                    style={{ width: `${Math.max(0, hpPercentage)}%` }}
                  />
                </div>
              </div>

              {/* Enemy Stats (GM View Only) */}
              {isGMView && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center text-clair-gold-300">
                    <Shield className="w-3 h-3 mr-1" />
                    AC: {enemy.ac ?? 13}
                  </div>
                  <div className="text-clair-gold-300">
                    Pos: ({enemy.position.x}, {enemy.position.y})
                  </div>
                  {onEditHP && (
                    <button
                      onClick={() => {
                        const newHP = prompt(`New HP for ${enemy.name}:`, currentHP.toString());
                        if (newHP !== null) {
                          const hp = parseInt(newHP);
                          if (!isNaN(hp) && hp >= 0) {
                            onEditHP(enemy.id, hp);
                          }
                        }
                      }}
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      Edit HP
                    </button>
                  )}
                </div>
              )}

              {/* Status Effects */}
              {enemy.statusEffects && Object.keys(enemy.statusEffects).length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {enemy.statusEffects.fire && (
                    <span className="text-xs bg-red-800 text-red-200 px-2 py-0.5 rounded flex items-center gap-1">
                      🔥 Burning ({enemy.statusEffects.fire.turnsRemaining})
                    </span>
                  )}
                  {enemy.statusEffects.ice && (
                    <span className="text-xs bg-blue-800 text-blue-200 px-2 py-0.5 rounded flex items-center gap-1">
                      ❄️ Frozen ({enemy.statusEffects.ice.turnsRemaining})
                    </span>
                  )}
                  {enemy.statusEffects.blind && (
                    <span className="text-xs bg-yellow-800 text-yellow-200 px-2 py-0.5 rounded flex items-center gap-1">
                      👁️ Blinded ({enemy.statusEffects.blind.turnsRemaining})
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Footer */}
      {enemies.length > 0 && (
        <div className="mt-3 pt-3 border-t border-clair-shadow-600">
          <div className="grid grid-cols-2 gap-4 text-xs text-clair-gold-300">
            <div>
              Alive: {enemies.filter(e => (e.hp ?? 0) > 0).length}
            </div>
            <div>
              Dead: {enemies.filter(e => (e.hp ?? 0) <= 0).length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}