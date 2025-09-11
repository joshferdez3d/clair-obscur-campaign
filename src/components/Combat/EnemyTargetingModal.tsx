import React, { useState, useMemo } from 'react';
import { X, Target, Heart, Shield, Sword, ChevronDown, ChevronRight } from 'lucide-react';

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
  abilityName?: string;
  abilityRange?: number;
}

export function EnemyTargetingModal({
  isOpen,
  onClose,
  enemies,
  playerPosition,
  onSelectEnemy,
  selectedEnemyId: externalSelectedId,
  abilityName = "Select Target",
  abilityRange = 999
}: EnemyTargetingModalProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  // Local state for selection within the modal
  const [localSelectedId, setLocalSelectedId] = useState<string>(externalSelectedId || '');

  // Sync with external selection when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setLocalSelectedId(externalSelectedId || '');
    }
  }, [isOpen, externalSelectedId]);

  // Calculate distance for each enemy
  const calculateDistance = (pos1: { x: number; y: number }, pos2: { x: number; y: number }): number => {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    return Math.max(dx, dy) * 5;
  };

  // Group enemies by type and calculate their distances
  const groupedEnemies = useMemo(() => {
    const groups: Record<string, Array<Enemy & { distance: number; inRange: boolean }>> = {};
    
    enemies.forEach(enemy => {
      const distance = calculateDistance(playerPosition, enemy.position);
      const inRange = distance <= abilityRange;
      
      // Extract base enemy type (remove numbers/suffixes)
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

    // Sort enemies within each group by distance
    Object.keys(groups).forEach(type => {
      groups[type].sort((a, b) => a.distance - b.distance);
    });

    // Sort groups by whether they have any enemies in range, then alphabetically
    const sortedGroups = Object.entries(groups).sort(([typeA, enemiesA], [typeB, enemiesB]) => {
      const hasInRangeA = enemiesA.some(e => e.inRange);
      const hasInRangeB = enemiesB.some(e => e.inRange);
      
      if (hasInRangeA && !hasInRangeB) return -1;
      if (!hasInRangeA && hasInRangeB) return 1;
      return typeA.localeCompare(typeB);
    });

    return sortedGroups;
  }, [enemies, playerPosition, abilityRange]);

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  // Auto-expand groups with enemies in range
  React.useEffect(() => {
    const groupsWithInRange = groupedEnemies
      .filter(([_, enemies]) => enemies.some(e => e.inRange))
      .map(([type]) => type);
    setExpandedGroups(new Set(groupsWithInRange));
  }, [groupedEnemies]);

  // Handle confirm selection
  const handleConfirm = () => {
    const selectedEnemy = enemies.find(e => e.id === localSelectedId);
    if (selectedEnemy) {
      onSelectEnemy(selectedEnemy);
      onClose();
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setLocalSelectedId('');
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
              </p>
            </div>
            <button
              onClick={handleCancel}
              className="text-clair-gold-300 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Enemy Groups */}
        <div className="flex-1 overflow-y-auto p-4">
          {groupedEnemies.length === 0 ? (
            <div className="text-center text-clair-gold-400 py-8">
              No enemies available
            </div>
          ) : (
            <div className="space-y-3">
              {groupedEnemies.map(([groupName, groupEnemies]) => {
                const isExpanded = expandedGroups.has(groupName);
                const hasInRange = groupEnemies.some(e => e.inRange);
                
                return (
                  <div 
                    key={groupName}
                    className={`border rounded-lg ${
                      hasInRange 
                        ? 'border-clair-gold-600 bg-clair-shadow-700' 
                        : 'border-clair-shadow-600 bg-clair-shadow-900 opacity-75'
                    }`}
                  >
                    {/* Group Header */}
                    <button
                      onClick={() => toggleGroup(groupName)}
                      className="w-full p-3 flex items-center justify-between hover:bg-clair-shadow-600 transition-colors"
                    >
                      <div className="flex items-center">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 mr-2 text-clair-gold-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 mr-2 text-clair-gold-400" />
                        )}
                        <span className="font-bold text-clair-gold-300">
                          {groupName}
                        </span>
                        <span className="ml-2 text-sm text-clair-gold-400">
                          ({groupEnemies.length})
                        </span>
                      </div>
                      {!hasInRange && (
                        <span className="text-xs text-red-400">Out of range</span>
                      )}
                    </button>

                    {/* Group Enemies */}
                    {isExpanded && (
                      <div className="p-2 space-y-1 border-t border-clair-shadow-600">
                        {groupEnemies.map(enemy => (
                          <button
                            key={enemy.id}
                            onClick={() => setLocalSelectedId(enemy.id)}
                            disabled={!enemy.inRange}
                            className={`w-full p-2 rounded flex items-center justify-between transition-all ${
                              localSelectedId === enemy.id
                                ? 'bg-clair-gold-900 bg-opacity-50 border-2 border-clair-gold-400'
                                : enemy.inRange
                                ? 'bg-clair-shadow-600 hover:bg-clair-shadow-500 border-2 border-transparent'
                                : 'bg-clair-shadow-800 opacity-50 cursor-not-allowed border-2 border-transparent'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="text-left">
                                <div className="font-medium text-clair-gold-200">
                                  {enemy.name}
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
                                <div className="w-20 bg-clair-shadow-800 rounded-full h-2">
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
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-clair-gold-600">
          <div className="flex justify-between items-center">
            <p className="text-sm text-clair-gold-400">
              {localSelectedId ? `Selected: ${enemies.find(e => e.id === localSelectedId)?.name}` : 'Select an enemy to target'}
            </p>
            <div className="flex space-x-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-clair-shadow-600 hover:bg-clair-shadow-700 text-clair-gold-200 rounded-lg font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!localSelectedId}
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