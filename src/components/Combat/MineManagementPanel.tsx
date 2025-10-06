// src/components/Combat/MineManagementPanel.tsx
import React, { useState } from 'react';
import { Bomb, Plus, X, Eye, EyeOff, Trash2 } from 'lucide-react';
import { MineService, type Mine } from '../../services/MineService';

interface MineManagementPanelProps {
  sessionId: string;
  mines: Mine[];
  onPlaceMineMode: () => void;
  onClearMines: () => void;
  isPlacingMine: boolean;
}

export function MineManagementPanel({
  sessionId,
  mines,
  onPlaceMineMode,
  onClearMines,
  isPlacingMine
}: MineManagementPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const activeMines = mines.filter(m => !m.isTriggered);
  const triggeredMines = mines.filter(m => m.isTriggered);
  const detectedMines = activeMines.filter(m => m.isDetected);
  const hiddenMines = activeMines.filter(m => !m.isDetected);

  const handleRemoveMine = async (mineId: string) => {
    if (window.confirm('Remove this mine?')) {
      await MineService.removeMine(sessionId, mineId);
    }
  };

  const handleQuickSetup = async () => {
    // Predefined mine positions for Coral Minefield (17x22 grid)
    const minePositions = [
      { x: 3, y: 5 }, { x: 7, y: 4 }, { x: 12, y: 6 },
      { x: 5, y: 9 }, { x: 10, y: 8 }, { x: 14, y: 10 },
      { x: 2, y: 13 }, { x: 8, y: 15 }, { x: 13, y: 14 },
      { x: 6, y: 18 }, { x: 11, y: 19 }
    ];

    if (window.confirm(`Place ${minePositions.length} mines in preset positions?`)) {
      await MineService.placeMines(sessionId, minePositions);
      console.log(`Placed ${minePositions.length} coral mines`);
    }
  };

  return (
    <div className="bg-clair-shadow-700 border border-clair-gold-600 rounded-lg shadow-shadow">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-clair-shadow-600 transition-colors rounded-t-lg"
      >
        <div className="flex items-center">
          <Bomb className="w-5 h-5 mr-2 text-red-400" />
          <h3 className="font-display text-lg font-bold text-clair-gold-400">
            Coral Mines
          </h3>
          <span className="ml-2 text-sm text-clair-gold-300">
            ({activeMines.length} active)
          </span>
        </div>
        <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 border-t border-clair-shadow-400">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
            <div className="bg-red-900 bg-opacity-30 p-2 rounded border border-red-600">
              <div className="text-red-200 font-bold">Hidden</div>
              <div className="text-red-100 text-lg">{hiddenMines.length}</div>
            </div>
            <div className="bg-yellow-900 bg-opacity-30 p-2 rounded border border-yellow-600">
              <div className="text-yellow-200 font-bold">Detected</div>
              <div className="text-yellow-100 text-lg">{detectedMines.length}</div>
            </div>
            <div className="bg-gray-800 p-2 rounded border border-gray-600">
              <div className="text-gray-300 font-bold">Triggered</div>
              <div className="text-gray-100 text-lg">{triggeredMines.length}</div>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-2 mb-4">
            <button
              onClick={onPlaceMineMode}
              disabled={isPlacingMine}
              className={`w-full flex items-center justify-center px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                isPlacingMine
                  ? 'bg-yellow-700 text-yellow-100 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              <Plus className="w-4 h-4 mr-1" />
              {isPlacingMine ? 'Click Map to Place Mine' : 'Place Mine (Click)'}
            </button>

            <button
              onClick={handleQuickSetup}
              disabled={isPlacingMine || activeMines.length > 0}
              className="w-full flex items-center justify-center px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition-colors"
            >
              <Bomb className="w-4 h-4 mr-1" />
              Quick Setup (11 Mines)
            </button>

            {activeMines.length > 0 && (
              <button
                onClick={onClearMines}
                className="w-full flex items-center justify-center px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg font-bold text-sm transition-colors"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear All Mines
              </button>
            )}
          </div>

          {/* Mine List */}
          {activeMines.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-clair-gold-300 mb-2">Active Mines:</h4>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {activeMines.map(mine => (
                  <div
                    key={mine.id}
                    className={`p-2 rounded border ${
                      mine.isDetected
                        ? 'bg-yellow-900 bg-opacity-30 border-yellow-600'
                        : 'bg-red-900 bg-opacity-30 border-red-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center text-sm">
                          {mine.isDetected ? (
                            <Eye className="w-3 h-3 mr-1 text-yellow-400" />
                          ) : (
                            <EyeOff className="w-3 h-3 mr-1 text-red-400" />
                          )}
                          <span className={mine.isDetected ? 'text-yellow-200' : 'text-red-200'}>
                            ({mine.position.x}, {mine.position.y})
                          </span>
                        </div>
                        <div className="text-xs text-gray-300 mt-1">
                          {mine.damage} dmg • {mine.aoERadius}ft AoE • Spawns {mine.spawnsEnemy}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveMine(mine.id)}
                        className="ml-2 p-1 text-red-400 hover:text-red-300 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="mt-4 p-3 bg-clair-gold-900 bg-opacity-20 rounded-lg border border-clair-gold-600">
            <h4 className="font-serif font-bold text-clair-gold-400 text-xs mb-2">Mine Mechanics:</h4>
            <ul className="text-xs text-clair-gold-300 space-y-1">
              <li>• Stepping on mine: 6 damage AoE + spawns Demineur</li>
              <li>• Players can detect with skill checks</li>
              <li>• Detected mines shown with warning icon</li>
              <li>• Hidden mines only visible to GM</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}