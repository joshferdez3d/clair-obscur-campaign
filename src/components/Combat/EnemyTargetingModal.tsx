// Updated EnemyTargetingModal.tsx to support Twin Catalyst
import React, { useState, useMemo } from 'react';
import { X, Target, Heart, Shield, Plus, Minus } from 'lucide-react';
import { FirestoreService } from '../../services/firestoreService';

interface Enemy {
  id: string;
  name: string;
  position: { x: number; y: number };
  hp: number;
  maxHp: number;
  ac: number;
}

interface EnemyTargetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  enemies: Enemy[];
  playerPosition: { x: number; y: number };
  onSelectEnemy: (enemy: Enemy) => void;
  selectedEnemyId?: string;
  selectedTargets?: string[]; // Add support for multi-target
  abilityName?: string;
  abilityRange?: number;
  sessionId?: string;
  playerId?: string;
  multiTarget?: boolean; // NEW: Flag for multi-target abilities
  maxTargets?: number; // NEW: Max number of targets (for Twin Catalyst = 2)
}

export function EnemyTargetingModal({
  isOpen,
  onClose,
  enemies,
  playerPosition,
  onSelectEnemy,
  selectedEnemyId: externalSelectedId,
  selectedTargets = [],
  abilityName = "Select Target",
  abilityRange = 999,
  sessionId,
  playerId,
  multiTarget = false,
  maxTargets = 2
}: EnemyTargetingModalProps) {
  // For multi-target: track selection count per enemy
  const [enemySelectionCounts, setEnemySelectionCounts] = useState<Record<string, number>>({});
  // For single-target: simple selection
  const [localSelectedId, setLocalSelectedId] = useState<string>(externalSelectedId || '');

  // Initialize selection counts from selectedTargets
  React.useEffect(() => {
    if (multiTarget && selectedTargets.length > 0) {
      const counts: Record<string, number> = {};
      selectedTargets.forEach(targetId => {
        counts[targetId] = (counts[targetId] || 0) + 1;
      });
      setEnemySelectionCounts(counts);
    }
  }, [multiTarget, selectedTargets]);

  // Calculate total selections
  const totalSelections = Object.values(enemySelectionCounts).reduce((sum, count) => sum + count, 0);

  // Calculate distance for each enemy
  const calculateDistance = (pos1: { x: number; y: number }, pos2: { x: number; y: number }): number => {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    return Math.max(dx, dy) * 5;
  };

  // Handle enemy selection for multi-target abilities
  const handleMultiTargetSelect = (enemyId: string, action: 'add' | 'remove') => {
    const currentCount = enemySelectionCounts[enemyId] || 0;
    const newCounts = { ...enemySelectionCounts };

    if (action === 'add') {
      // Check if we can add more selections
      if (totalSelections >= maxTargets) {
        return; // Can't add more
      }
      newCounts[enemyId] = currentCount + 1;
    } else {
      // Remove one selection
      if (currentCount > 1) {
        newCounts[enemyId] = currentCount - 1;
      } else if (currentCount === 1) {
        delete newCounts[enemyId];
      }
    }

    setEnemySelectionCounts(newCounts);
  };

  // Handle single enemy selection
  const handleSingleEnemySelect = async (enemyId: string) => {
    setLocalSelectedId(enemyId);
    
    // Update targeting state for battle map highlighting
    if (sessionId && playerId) {
      await FirestoreService.updateTargetingState(sessionId, {
        selectedEnemyId: enemyId,
        playerId: playerId
      });
    }
  };

  // Group enemies by type and calculate their distances
  const groupedEnemies = useMemo(() => {
    const groups: Record<string, Array<Enemy & { distance: number; inRange: boolean }>> = {};
    
    enemies.forEach(enemy => {
      const distance = calculateDistance(playerPosition, enemy.position);
      const inRange = distance <= abilityRange;
      
      const baseType = enemy.name.replace(/\s*\d+$/, '').replace(/\s*#\d+$/, '');
      
      if (!groups[baseType]) {
        groups[baseType] = [];
      }
      
      groups[baseType].push({
        ...enemy,
        distance,
        inRange
      });
    });

    Object.keys(groups).forEach(type => {
      groups[type].sort((a, b) => a.distance - b.distance);
    });

    return Object.entries(groups).sort(([typeA, enemiesA], [typeB, enemiesB]) => {
      const hasInRangeA = enemiesA.some(e => e.inRange);
      const hasInRangeB = enemiesB.some(e => e.inRange);
      
      if (hasInRangeA && !hasInRangeB) return -1;
      if (!hasInRangeA && hasInRangeB) return 1;
      return typeA.localeCompare(typeB);
    });
  }, [enemies, playerPosition, abilityRange]);

  // Handle confirm selection
  const handleConfirm = () => {
    if (multiTarget) {
      // For multi-target, we need to pass the selection counts back to the character sheet
      // Convert counts back to array format
      const targetArray: string[] = [];
      Object.entries(enemySelectionCounts).forEach(([enemyId, count]) => {
        for (let i = 0; i < count; i++) {
          targetArray.push(enemyId);
        }
      });
      
      // Use a special callback to handle multi-target
      if (onSelectEnemy && targetArray.length > 0) {
        // Pass the first target (for compatibility) but the full array will be handled by parent
        const firstEnemy = enemies.find(e => e.id === targetArray[0]);
        if (firstEnemy) {
          onSelectEnemy(firstEnemy);
        }
      }
    } else {
      // Single target
      const selectedEnemy = enemies.find(e => e.id === localSelectedId);
      if (selectedEnemy) {
        onSelectEnemy(selectedEnemy);
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  const totalInRange = enemies.filter(e => 
    calculateDistance(playerPosition, e.position) <= abilityRange
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-clair-shadow-800 border-2 border-clair-gold-600 rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-clair-gold-600">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-clair-gold-400 flex items-center">
                <Target className="w-5 h-5 mr-2" />
                {abilityName}
              </h2>
              <p className="text-sm text-clair-gold-300 mt-1">
                Range: {abilityRange}ft • {totalInRange} of {enemies.length} enemies in range
                {multiTarget && (
                  <span className="ml-2 text-purple-300">
                    • {totalSelections}/{maxTargets} selections
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-clair-gold-300 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Enemy List */}
        <div className="flex-1 overflow-y-auto p-4">
          {groupedEnemies.length === 0 ? (
            <div className="text-center text-clair-gold-400 py-8">
              No enemies available
            </div>
          ) : (
            <div className="space-y-2">
              {groupedEnemies.map(([groupName, groupEnemies]) => (
                <div key={groupName}>
                  <h3 className="text-sm font-bold text-clair-gold-400 mb-2 border-b border-clair-shadow-600 pb-1">
                    {groupName}
                  </h3>
                  {groupEnemies.map(enemy => {
                    const selectionCount = multiTarget ? (enemySelectionCounts[enemy.id] || 0) : 0;
                    const isSelected = multiTarget ? selectionCount > 0 : localSelectedId === enemy.id;
                    const canAddMore = multiTarget ? totalSelections < maxTargets : false;
                    
                    return (
                      <div
                        key={enemy.id}
                        className={`p-3 rounded-lg border transition-all ${
                          isSelected
                            ? 'border-clair-gold-400 bg-clair-gold-900 bg-opacity-30'
                            : enemy.inRange
                            ? 'border-clair-shadow-600 bg-clair-shadow-700 hover:bg-clair-shadow-600'
                            : 'border-clair-shadow-700 bg-clair-shadow-800 opacity-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div>
                              <div className="font-medium text-clair-gold-200 flex items-center">
                                {enemy.name}
                                {multiTarget && selectionCount > 0 && (
                                  <span className="ml-2 px-2 py-1 bg-purple-600 text-white text-xs rounded-full">
                                    {selectionCount}x
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-clair-gold-400">
                                {enemy.distance}ft away
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-4">
                            {/* HP Bar */}
                            <div className="flex items-center space-x-1">
                              <Heart className="w-3 h-3 text-red-400" />
                              <div className="w-16 bg-clair-shadow-800 rounded-full h-2">
                                <div 
                                  className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400"
                                  style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-clair-gold-400">
                                {enemy.hp}/{enemy.maxHp}
                              </span>
                            </div>
                            
                            {/* AC */}
                            <div className="flex items-center space-x-1">
                              <Shield className="w-3 h-3 text-blue-400" />
                              <span className="text-sm text-clair-gold-300">
                                {enemy.ac}
                              </span>
                            </div>

                            {/* Selection Controls */}
                            <div className="flex items-center space-x-1">
                              {multiTarget ? (
                                <>
                                  {/* Remove selection button */}
                                  <button
                                    onClick={() => handleMultiTargetSelect(enemy.id, 'remove')}
                                    disabled={!enemy.inRange || selectionCount === 0}
                                    className="w-6 h-6 rounded-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:opacity-30 flex items-center justify-center text-white text-xs"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  {/* Add selection button */}
                                  <button
                                    onClick={() => handleMultiTargetSelect(enemy.id, 'add')}
                                    disabled={!enemy.inRange || !canAddMore}
                                    className="w-6 h-6 rounded-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:opacity-30 flex items-center justify-center text-white text-xs"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </>
                              ) : (
                                /* Single target selection */
                                <button
                                  onClick={() => handleSingleEnemySelect(enemy.id)}
                                  disabled={!enemy.inRange}
                                  className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
                                    localSelectedId === enemy.id
                                      ? 'bg-clair-gold-600 text-clair-shadow-900'
                                      : enemy.inRange
                                      ? 'bg-clair-shadow-600 hover:bg-clair-shadow-500 text-clair-gold-300'
                                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                  }`}
                                >
                                  {localSelectedId === enemy.id ? 'Selected' : 'Select'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-clair-gold-600">
          <div className="flex justify-between items-center">
            <div className="text-sm text-clair-gold-400">
              {multiTarget ? (
                <>
                  {totalSelections > 0 ? (
                    <span>
                      Selected: {Object.entries(enemySelectionCounts).map(([enemyId, count]) => {
                        const enemy = enemies.find(e => e.id === enemyId);
                        return `${enemy?.name}${count > 1 ? ` (${count}x)` : ''}`;
                      }).join(', ')}
                    </span>
                  ) : (
                    'Select targets for Twin Catalyst (same enemy can be selected twice)'
                  )}
                </>
              ) : (
                localSelectedId ? `Selected: ${enemies.find(e => e.id === localSelectedId)?.name}` : 'Select an enemy to target'
              )}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-clair-shadow-600 hover:bg-clair-shadow-700 text-clair-gold-200 rounded-lg font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={multiTarget ? totalSelections === 0 : !localSelectedId}
                className="px-4 py-2 bg-clair-gold-600 hover:bg-clair-gold-700 disabled:bg-gray-600 disabled:opacity-50 text-clair-shadow-900 rounded-lg font-bold transition-colors"
              >
                Confirm Selection
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}