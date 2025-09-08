
import React, { useState } from 'react';
import { X, Shield, Sword, Zap, Eye, Crown, Users } from 'lucide-react';
import { ENEMY_TEMPLATES, ENEMY_CATEGORIES, getEnemiesInCategory } from '../../data/enemies';
import type { EnemyData } from '../../types';

interface EnemySelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEnemy: (enemyData: EnemyData) => void;
}

export function EnemySelectionModal({ isOpen, onClose, onSelectEnemy }: EnemySelectionModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('Basic Enemies');
  const [selectedEnemy, setSelectedEnemy] = useState<EnemyData | null>(null);

  if (!isOpen) return null;

  const handleEnemySelect = (enemyId: string) => {
    const enemy = ENEMY_TEMPLATES[enemyId];
    if (enemy) {
      setSelectedEnemy(enemy);
    }
  };

  const handleConfirmSelection = () => {
    if (selectedEnemy) {
      onSelectEnemy(selectedEnemy);
      setSelectedEnemy(null);
      onClose();
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Basic Enemies': return Users;
      case 'Support/Tank': return Shield;
      case 'Flying/Scout': return Eye;
      case 'Boss/Elite': return Crown;
      default: return Sword;
    }
  };

  const getDifficultyColor = (hp: number) => {
    if (hp >= 70) return 'text-red-400'; // Boss
    if (hp >= 40) return 'text-orange-400'; // Elite
    if (hp >= 25) return 'text-yellow-400'; // Tough
    return 'text-green-400'; // Basic
  };

  const getDifficultyLabel = (hp: number) => {
    if (hp >= 70) return 'BOSS';
    if (hp >= 40) return 'Elite';
    if (hp >= 25) return 'Tough';
    return 'Basic';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-clair-shadow-800 border border-clair-gold-600 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-bold text-clair-gold-400">Add Enemy</h2>
          <button
            onClick={onClose}
            className="text-clair-gold-300 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Category Selection */}
          <div className="lg:col-span-1">
            <h3 className="font-display text-lg font-bold text-clair-gold-400 mb-3">Categories</h3>
            <div className="space-y-2">
              {Object.keys(ENEMY_CATEGORIES).map((category) => {
                const Icon = getCategoryIcon(category);
                const isSelected = selectedCategory === category;
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`w-full flex items-center p-3 rounded-lg transition-all ${
                      isSelected
                        ? 'bg-clair-gold-600 text-clair-shadow-900'
                        : 'bg-clair-shadow-700 text-clair-gold-300 hover:bg-clair-shadow-600'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    <span className="font-bold">{category}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Enemy List */}
          <div className="lg:col-span-1">
            <h3 className="font-display text-lg font-bold text-clair-gold-400 mb-3">
              {selectedCategory}
            </h3>
            <div className="space-y-2">
              {getEnemiesInCategory(selectedCategory).map((enemyId) => {
                const enemy = ENEMY_TEMPLATES[enemyId];
                if (!enemy) return null;

                const isSelected = selectedEnemy?.id === enemyId;
                return (
                  <button
                    key={enemyId}
                    onClick={() => handleEnemySelect(enemyId)}
                    className={`w-full p-3 rounded-lg transition-all text-left ${
                      isSelected
                        ? 'bg-clair-gold-600 text-clair-shadow-900'
                        : 'bg-clair-shadow-700 text-clair-gold-300 hover:bg-clair-shadow-600'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold">{enemy.name}</span>
                      <span className={`text-xs font-bold ${getDifficultyColor(enemy.hp)}`}>
                        {getDifficultyLabel(enemy.hp)}
                      </span>
                    </div>
                    <div className="text-sm opacity-90">
                      AC {enemy.ac} • {enemy.hp} HP • {enemy.speed}ft
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Enemy Details */}
          <div className="lg:col-span-1">
            {selectedEnemy ? (
              <div className="bg-clair-shadow-700 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-display text-lg font-bold text-clair-gold-400">
                    {selectedEnemy.name}
                  </h3>
                  <span className={`text-sm font-bold ${getDifficultyColor(selectedEnemy.hp)}`}>
                    {getDifficultyLabel(selectedEnemy.hp)}
                  </span>
                </div>

                {/* Basic Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                  <div className="bg-clair-shadow-800 rounded p-2">
                    <div className="text-xs text-clair-gold-300">AC</div>
                    <div className="font-bold text-clair-gold-100">{selectedEnemy.ac}</div>
                  </div>
                  <div className="bg-clair-shadow-800 rounded p-2">
                    <div className="text-xs text-clair-gold-300">HP</div>
                    <div className="font-bold text-clair-gold-100">{selectedEnemy.hp}</div>
                  </div>
                  <div className="bg-clair-shadow-800 rounded p-2">
                    <div className="text-xs text-clair-gold-300">Speed</div>
                    <div className="font-bold text-clair-gold-100">{selectedEnemy.speed}ft</div>
                  </div>
                </div>

                {/* Resistances & Vulnerabilities */}
                {(selectedEnemy.resistances.length > 0 || selectedEnemy.vulnerabilities.length > 0) && (
                  <div className="mb-4">
                    {selectedEnemy.resistances.length > 0 && (
                      <div className="mb-2">
                        <span className="text-xs font-bold text-green-400">Resists:</span>
                        <span className="text-xs text-clair-gold-300 ml-1">
                          {selectedEnemy.resistances.join(', ')}
                        </span>
                      </div>
                    )}
                    {selectedEnemy.vulnerabilities.length > 0 && (
                      <div>
                        <span className="text-xs font-bold text-red-400">Vulnerable:</span>
                        <span className="text-xs text-clair-gold-300 ml-1">
                          {selectedEnemy.vulnerabilities.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Special Traits */}
                {selectedEnemy.traits.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-bold text-clair-gold-400 mb-2">Traits</h4>
                    <div className="space-y-1">
                      {selectedEnemy.traits.map((trait, index) => (
                        <div key={index} className="text-xs text-clair-gold-300">
                          {trait}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attacks */}
                <div className="mb-4">
                  <h4 className="text-sm font-bold text-clair-gold-400 mb-2">Attacks</h4>
                  <div className="space-y-2">
                    {selectedEnemy.attacks.slice(0, 2).map((attack, index) => (
                      <div key={index} className="text-xs">
                        <div className="font-bold text-clair-gold-300">
                          {attack.name} {attack.recharge && `(${attack.recharge})`}
                        </div>
                        <div className="text-clair-gold-400">
                          {attack.toHit > 0 && `+${attack.toHit} to hit, `}
                          {attack.damage}
                        </div>
                      </div>
                    ))}
                    {selectedEnemy.attacks.length > 2 && (
                      <div className="text-xs text-clair-gold-400 italic">
                        +{selectedEnemy.attacks.length - 2} more attacks...
                      </div>
                    )}
                  </div>
                </div>

                {/* Add Button */}
                <button
                  onClick={handleConfirmSelection}
                  className="w-full bg-clair-gold-600 hover:bg-clair-gold-700 text-clair-shadow-900 py-2 px-4 rounded-lg font-bold transition-colors"
                >
                  Add {selectedEnemy.name}
                </button>
              </div>
            ) : (
              <div className="bg-clair-shadow-700 rounded-lg p-4 text-center text-clair-gold-300">
                <Sword className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select an enemy from the list to see details</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Instructions */}
        <div className="mt-6 p-3 bg-clair-shadow-700 rounded-lg">
          <p className="text-sm text-clair-gold-300 text-center">
            <strong>Instructions:</strong> Select an enemy type, then click anywhere on the battle map to place it.
          </p>
        </div>
      </div>
    </div>
  );
}