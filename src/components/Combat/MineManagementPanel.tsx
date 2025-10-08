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
  const [isRevealing, setIsRevealing] = useState(false);

  const activeMines = mines.filter(m => !m.isTriggered);
  const triggeredMines = mines.filter(m => m.isTriggered);
  const detectedMines = activeMines.filter(m => m.isDetected);
  const hiddenMines = activeMines.filter(m => !m.isDetected);

  const handleRemoveMine = async (mineId: string) => {
    if (window.confirm('Remove this mine?')) {
      await MineService.removeMine(sessionId, mineId);
    }
  };

  const handleToggleMineDetection = async (mineId: string) => {
    await MineService.toggleMineDetection(sessionId, mineId);
  };

  const handleRevealAllMines = async () => {
    setIsRevealing(true);
    await MineService.revealAllMinesTemporarily(sessionId, 5000);
    
    // Reset button state after reveal duration
    setTimeout(() => {
      setIsRevealing(false);
    }, 5000);
  };

const handleQuickSetup = async () => {
    // Intermediate difficulty mine positions for 17x17 grid (30 mines total)
    // 17.6% density - balanced for logical deduction
    // Safe starting zone (rows 0-6), mines start at row 7
    const minePositions = [
      // Row 7 (3 mines) - sparse start
      { x: 4, y: 7 }, { x: 9, y: 7 }, { x: 14, y: 7 },
      
      // Row 8 (3 mines)
      { x: 2, y: 8 }, { x: 11, y: 8 }, { x: 16, y: 8 },
      
      // Row 9 (4 mines)
      { x: 5, y: 9 }, { x: 8, y: 9 }, { x: 12, y: 9 }, { x: 15, y: 9 },
      
      // Row 10 (3 mines)
      { x: 1, y: 10 }, { x: 7, y: 10 }, { x: 13, y: 10 },
      
      // Row 11 (3 mines)
      { x: 3, y: 11 }, { x: 10, y: 11 }, { x: 16, y: 11 },
      
      // Row 12 (4 mines)
      { x: 0, y: 12 }, { x: 6, y: 12 }, { x: 9, y: 12 }, { x: 14, y: 12 },
      
      // Row 13 (3 mines)
      { x: 4, y: 13 }, { x: 11, y: 13 }, { x: 15, y: 13 },
      
      // Row 14 (3 mines)
      { x: 2, y: 14 }, { x: 8, y: 14 }, { x: 13, y: 14 },
      
      // Row 15 (2 mines)
      { x: 5, y: 15 }, { x: 10, y: 15 },
      
      // Row 16 (2 mines) - sparse ending
      { x: 7, y: 16 }, { x: 12, y: 16 }
    ];

    if (window.confirm(`Place ${minePositions.length} mines in strategic positions (Intermediate difficulty)?`)) {
      await MineService.placeMines(sessionId, minePositions);
      console.log(`Placed ${minePositions.length} mines for Flying Waters minesweeper puzzle`);
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
              Quick Setup (48 Mines)
            </button>

            {activeMines.length > 0 && (
              <>
                <button
                  onClick={handleRevealAllMines}
                  disabled={isRevealing}
                  className={`w-full flex items-center justify-center px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                    isRevealing
                      ? 'bg-blue-700 text-blue-100 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  {isRevealing ? 'Revealing... (5s)' : 'Reveal All (5 seconds)'}
                </button>

                <button
                  onClick={onClearMines}
                  className="w-full flex items-center justify-center px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg font-bold text-sm transition-colors"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear All Mines
                </button>
              </>
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
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleMineDetection(mine.id)}
                          className={`p-1 transition-colors ${
                            mine.isDetected
                              ? 'text-yellow-400 hover:text-yellow-300'
                              : 'text-red-400 hover:text-red-300'
                          }`}
                          title={mine.isDetected ? 'Hide mine' : 'Reveal mine'}
                        >
                          {mine.isDetected ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleRemoveMine(mine.id)}
                          className="p-1 text-red-400 hover:text-red-300 transition-colors"
                          title="Remove mine"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
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
              <li>• Click eye icons to toggle individual mine visibility</li>
              <li>• Use "Reveal All" to show all mines for 5 seconds</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}