// src/components/Combat/EnemyTurnApprovalModal.tsx
import React, { useState, useEffect } from 'react';
import { 
  X, Play, SkipForward, Target, Move, Sword, Zap, 
  ChevronRight, AlertCircle, CheckCircle, Eye 
} from 'lucide-react';
import type { EnemyAction, EnemyTurnPlan } from '../../services/enemyAIService';

interface EnemyTurnApprovalModalProps {
  isOpen: boolean;
  turnPlan: EnemyTurnPlan | null;
  onApprove: (plan: EnemyTurnPlan) => void;
  onModify: (enemyId: string, newAction: EnemyAction) => void;
  onSkip: (enemyId: string) => void;
  onClose: () => void;
  currentEnemyIndex?: number;
}

export function EnemyTurnApprovalModal({
  isOpen,
  turnPlan,
  onApprove,
  onModify,
  onSkip,
  onClose,
  currentEnemyIndex = 0
}: EnemyTurnApprovalModalProps) {
  const [selectedEnemyIndex, setSelectedEnemyIndex] = useState(0);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [actionDelay, setActionDelay] = useState(2); // seconds between actions

  useEffect(() => {
    setSelectedEnemyIndex(currentEnemyIndex);
  }, [currentEnemyIndex]);

  if (!isOpen || !turnPlan) return null;

  const currentEnemy = turnPlan.enemies[selectedEnemyIndex];
  if (!currentEnemy) return null;

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'move': return <Move className="w-4 h-4" />;
      case 'attack': return <Sword className="w-4 h-4" />;
      case 'ability': return <Zap className="w-4 h-4" />;
      case 'move_attack': return <><Move className="w-3 h-3" /><Sword className="w-3 h-3" /></>;
      default: return <Target className="w-4 h-4" />;
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case 'move': return 'text-blue-400';
      case 'attack': return 'text-red-400';
      case 'ability': return 'text-purple-400';
      case 'move_attack': return 'text-orange-400';
      default: return 'text-gray-400';
    }
  };

  const handleApproveAction = () => {
    // Execute current enemy's action
    if (selectedEnemyIndex < turnPlan.enemies.length - 1) {
      // Move to next enemy
      setSelectedEnemyIndex(selectedEnemyIndex + 1);
    } else {
      // All enemies done, approve full plan
      onApprove(turnPlan);
    }
  };

  const handleApproveAll = () => {
    setAutoAdvance(true);
    onApprove(turnPlan);
  };

  const handleSkipEnemy = () => {
    onSkip(currentEnemy.enemy.id);
    if (selectedEnemyIndex < turnPlan.enemies.length - 1) {
      setSelectedEnemyIndex(selectedEnemyIndex + 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-clair-shadow-800 border-2 border-clair-gold-600 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-clair-gold-600">
          <div>
            <h2 className="font-display text-xl font-bold text-clair-gold-400 flex items-center">
              <Target className="w-6 h-6 mr-2" />
              {turnPlan.groupName} Turn - {turnPlan.totalActions} Actions Planned
            </h2>
            <p className="text-sm text-clair-gold-300 mt-1">
              Review and approve enemy actions
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-clair-shadow-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-clair-gold-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex gap-6 flex-1 overflow-hidden">
          {/* Enemy List */}
          <div className="w-1/3 bg-clair-shadow-700 rounded-lg p-4 overflow-y-auto">
            <h3 className="font-bold text-clair-gold-400 mb-3 text-sm">Enemy Queue</h3>
            <div className="space-y-2">
              {turnPlan.enemies.map((enemy, index) => (
                <button
                  key={enemy.enemy.id}
                  onClick={() => setSelectedEnemyIndex(index)}
                  className={`w-full p-3 rounded-lg text-left transition-all ${
                    index === selectedEnemyIndex
                      ? 'bg-clair-gold-600 text-clair-shadow-900'
                      : index < currentEnemyIndex
                      ? 'bg-clair-shadow-600 text-gray-500 line-through'
                      : 'bg-clair-shadow-600 hover:bg-clair-shadow-500 text-clair-gold-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs">#{index + 1}</span>
                      <span className={getActionColor(enemy.action.type)}>
                        {getActionIcon(enemy.action.type)}
                      </span>
                      <span className="text-sm font-medium">{enemy.enemy.name}</span>
                    </div>
                    <div className="text-xs">
                      HP: {enemy.enemy.hp}/{enemy.enemy.maxHp}
                    </div>
                  </div>
                  <div className="text-xs mt-1 opacity-80">
                    {enemy.action.type === 'move' && 'Moving'}
                    {enemy.action.type === 'attack' && `Attack: ${enemy.action.attack?.targetName}`}
                    {enemy.action.type === 'ability' && `Ability: ${enemy.action.attack?.attackName}`}
                    {enemy.action.type === 'move_attack' && `Move & Attack: ${enemy.action.attack?.targetName}`}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Action Details */}
          <div className="flex-1 bg-clair-shadow-700 rounded-lg p-4 overflow-y-auto">
            <h3 className="font-bold text-clair-gold-400 mb-4">
              Action Details - {currentEnemy.enemy.name}
            </h3>
            
            {/* Enemy Status */}
            <div className="bg-clair-shadow-800 rounded-lg p-3 mb-4">
              <div className="flex justify-between items-center">
                <div className="text-sm">
                  <span className="text-clair-gold-300">Position:</span>
                  <span className="text-clair-gold-100 ml-2 font-mono">
                    ({currentEnemy.enemy.position.x}, {currentEnemy.enemy.position.y})
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-clair-gold-300">HP:</span>
                  <span className="text-clair-gold-100 ml-2">
                    {currentEnemy.enemy.hp}/{currentEnemy.enemy.maxHp}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-clair-gold-300">AC:</span>
                  <span className="text-clair-gold-100 ml-2">{currentEnemy.enemy.ac}</span>
                </div>
              </div>
            </div>

            {/* Planned Action */}
            <div className="bg-clair-shadow-600 border border-clair-gold-600 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className={`${getActionColor(currentEnemy.action.type)} text-lg`}>
                  {getActionIcon(currentEnemy.action.type)}
                </span>
                <h4 className="font-bold text-clair-gold-400">
                  {currentEnemy.action.type === 'move' && 'Movement'}
                  {currentEnemy.action.type === 'attack' && 'Basic Attack'}
                  {currentEnemy.action.type === 'ability' && 'Special Ability'}
                  {currentEnemy.action.type === 'move_attack' && 'Move & Attack'}
                </h4>
              </div>

              {/* Movement Details */}
              {currentEnemy.action.movement && currentEnemy.action.movement.distance > 0 && (
                <div className="mb-3 p-3 bg-clair-shadow-800 rounded">
                  <div className="text-sm text-clair-gold-300 mb-1">Movement:</div>
                  <div className="text-clair-gold-100">
                    From ({currentEnemy.action.movement.from.x}, {currentEnemy.action.movement.from.y}) → 
                    To ({currentEnemy.action.movement.to.x}, {currentEnemy.action.movement.to.y})
                  </div>
                  <div className="text-xs text-clair-gold-300 mt-1">
                    Distance: {currentEnemy.action.movement.distance}ft
                  </div>
                </div>
              )}

              {/* Attack Details */}
              {currentEnemy.action.attack && (
                <div className="mb-3 p-3 bg-clair-shadow-800 rounded">
                  <div className="text-sm text-clair-gold-300 mb-2">Attack Details:</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-clair-gold-300">Target:</span>
                      <span className="text-clair-gold-100 ml-2">{currentEnemy.action.attack.targetName}</span>
                    </div>
                    <div>
                      <span className="text-clair-gold-300">Attack:</span>
                      <span className="text-clair-gold-100 ml-2">{currentEnemy.action.attack.attackName}</span>
                    </div>
                    <div>
                      <span className="text-clair-gold-300">To Hit:</span>
                      <span className="text-clair-gold-100 ml-2">+{currentEnemy.action.attack.toHit}</span>
                    </div>
                    <div>
                      <span className="text-clair-gold-300">Damage:</span>
                      <span className="text-clair-gold-100 ml-2">{currentEnemy.action.attack.damage}</span>
                    </div>
                    <div>
                      <span className="text-clair-gold-300">Range:</span>
                      <span className="text-clair-gold-100 ml-2">{currentEnemy.action.attack.range}ft</span>
                    </div>
                    <div>
                      <span className="text-clair-gold-300">Type:</span>
                      <span className="text-clair-gold-100 ml-2">{currentEnemy.action.attack.type}</span>
                    </div>
                  </div>
                  {currentEnemy.action.attack.special && (
                    <div className="mt-2 p-2 bg-purple-900 bg-opacity-30 rounded">
                      <div className="text-xs text-purple-300">Special Effect:</div>
                      <div className="text-xs text-purple-100">{currentEnemy.action.attack.special}</div>
                    </div>
                  )}
                </div>
              )}

              {/* GM Description */}
              <div className="p-3 bg-blue-900 bg-opacity-20 border border-blue-600 rounded">
                <div className="flex items-center gap-2 mb-1">
                  <Eye className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-bold text-blue-400">GM Narration:</span>
                </div>
                <p className="text-sm text-clair-gold-100 italic">
                  "{currentEnemy.action.description}"
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-clair-gold-600">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-clair-gold-300">
              <input
                type="checkbox"
                checked={autoAdvance}
                onChange={(e) => setAutoAdvance(e.target.checked)}
                className="rounded"
              />
              Auto-advance (with {actionDelay}s delay)
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={actionDelay}
              onChange={(e) => setActionDelay(parseInt(e.target.value))}
              className="w-20"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSkipEnemy}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-bold text-sm transition-colors"
            >
              <SkipForward className="w-4 h-4 inline mr-1" />
              Skip This Enemy
            </button>
            
            <button
              onClick={handleApproveAction}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm transition-colors"
            >
              <CheckCircle className="w-4 h-4 inline mr-1" />
              Approve Action ({selectedEnemyIndex + 1}/{turnPlan.enemies.length})
            </button>

            <button
              onClick={handleApproveAll}
              className="px-4 py-2 bg-clair-gold-600 hover:bg-clair-gold-700 text-clair-shadow-900 rounded-lg font-bold text-sm transition-colors"
            >
              <Play className="w-4 h-4 inline mr-1" />
              Execute All Actions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}