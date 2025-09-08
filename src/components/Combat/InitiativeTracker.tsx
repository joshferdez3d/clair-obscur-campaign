import React, { useState } from 'react';
import { Play, Square, SkipForward, Plus, Minus, Edit3 } from 'lucide-react';
import type { InitiativeEntry, CombatState } from '../../types';

interface InitiativeTrackerProps {
  combatState: CombatState;
  onStartCombat: (initiativeOrder: InitiativeEntry[]) => void;
  onEndCombat: () => void;
  onNextTurn: () => void;
  onUpdateInitiative: (initiativeOrder: InitiativeEntry[]) => void;
  characterNames: { [id: string]: string };
}

export function InitiativeTracker({
  combatState,
  onStartCombat,
  onEndCombat,
  onNextTurn,
  onUpdateInitiative,
  characterNames
}: InitiativeTrackerProps) {
  const [editingInitiative, setEditingInitiative] = useState(false);
  const [tempInitiative, setTempInitiative] = useState<InitiativeEntry[]>([]);

  const handleStartEdit = () => {
    setTempInitiative([...combatState.initiativeOrder]);
    setEditingInitiative(true);
  };

  const handleSaveInitiative = () => {
    const sortedInitiative = [...tempInitiative].sort((a, b) => b.initiative - a.initiative);
    onUpdateInitiative(sortedInitiative);
    setEditingInitiative(false);
  };

  const handleCancelEdit = () => {
    setTempInitiative([]);
    setEditingInitiative(false);
  };

  const addInitiativeEntry = () => {
    const newEntry: InitiativeEntry = {
      id: `temp-${Date.now()}`,
      name: 'New Combatant',
      initiative: 10,
      type: 'enemy',
      hasActed: false
    };
    setTempInitiative([...tempInitiative, newEntry]);
  };

  const removeInitiativeEntry = (id: string) => {
    setTempInitiative(tempInitiative.filter(entry => entry.id !== id));
  };

  const updateInitiativeEntry = (id: string, field: keyof InitiativeEntry, value: any) => {
    setTempInitiative(tempInitiative.map(entry =>
      entry.id === id ? { ...entry, [field]: value } : entry
    ));
  };

  const getCurrentTurnName = () => {
    const current = combatState.initiativeOrder.find(entry => entry.id === combatState.currentTurn);
    return current ? (characterNames[current.id] || current.name) : 'Unknown';
  };

  const isCurrentTurn = (entryId: string) => {
    return combatState.currentTurn === entryId;
  };

  return (
    <div className="bg-clair-shadow-700 border border-clair-gold-600 rounded-lg p-4 shadow-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-bold text-clair-gold-400 flex items-center">
          <Edit3 className="w-5 h-5 mr-2" />
          Initiative Tracker
        </h3>
        
        <div className="flex space-x-2">
          {!combatState.isActive ? (
            <button
              onClick={() => onStartCombat(combatState.initiativeOrder)}
              disabled={combatState.initiativeOrder.length === 0}
              className="flex items-center px-3 py-2 bg-clair-success hover:bg-green-600 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4 mr-1" />
              Start Combat
            </button>
          ) : (
            <>
              <button
                onClick={onNextTurn}
                className="flex items-center px-3 py-2 bg-clair-mystical-500 hover:bg-clair-mystical-600 text-white rounded-lg text-sm font-bold transition-colors"
              >
                <SkipForward className="w-4 h-4 mr-1" />
                Next Turn
              </button>
              <button
                onClick={onEndCombat}
                className="flex items-center px-3 py-2 bg-clair-danger hover:bg-red-600 text-white rounded-lg text-sm font-bold transition-colors"
              >
                <Square className="w-4 h-4 mr-1" />
                End Combat
              </button>
            </>
          )}
        </div>
      </div>

      {/* Combat Status */}
      {combatState.isActive && (
        <div className="mb-4 p-3 bg-clair-mystical-900 bg-opacity-30 rounded-lg border border-clair-mystical-500">
          <div className="flex justify-between items-center text-sm">
            <span className="text-clair-gold-300">
              <span className="font-bold">Round:</span> {combatState.round}
            </span>
            <span className="text-clair-mystical-200">
              <span className="font-bold">Current Turn:</span> {getCurrentTurnName()}
            </span>
          </div>
        </div>
      )}

      {/* Initiative Order */}
      <div className="space-y-2">
        {!editingInitiative ? (
          <>
            {combatState.initiativeOrder.map((entry, index) => (
              <div
                key={entry.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  isCurrentTurn(entry.id)
                    ? 'bg-clair-gold-500 border-clair-gold-400 text-clair-shadow-900 animate-pulse'
                    : entry.hasActed
                    ? 'bg-clair-shadow-600 border-clair-shadow-400 text-clair-gold-300 opacity-60'
                    : 'bg-clair-shadow-600 border-clair-shadow-400 text-clair-gold-200'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="font-bold text-lg w-8 text-center">
                    {entry.initiative}
                  </span>
                  <div>
                    <div className="font-serif font-bold">
                      {characterNames[entry.id] || entry.name}
                    </div>
                    <div className="text-xs opacity-75 capitalize">
                      {entry.type}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {isCurrentTurn(entry.id) && combatState.isActive && (
                    <span className="text-xs font-bold px-2 py-1 bg-black bg-opacity-30 rounded">
                      ACTIVE
                    </span>
                  )}
                  {entry.hasActed && (
                    <span className="text-xs opacity-75">
                      Acted
                    </span>
                  )}
                </div>
              </div>
            ))}
            
            {combatState.initiativeOrder.length === 0 && (
              <div className="text-center py-6 text-clair-gold-300">
                <p className="mb-2">No initiative order set</p>
                <button
                  onClick={handleStartEdit}
                  className="text-sm bg-clair-mystical-500 hover:bg-clair-mystical-600 text-white px-3 py-1 rounded"
                >
                  Set Initiative
                </button>
              </div>
            )}
            
            {combatState.initiativeOrder.length > 0 && !combatState.isActive && (
              <button
                onClick={handleStartEdit}
                className="w-full mt-2 text-sm bg-clair-shadow-500 hover:bg-clair-shadow-400 text-clair-gold-200 px-3 py-2 rounded border border-clair-gold-600"
              >
                Edit Initiative Order
              </button>
            )}
          </>
        ) : (
          <>
            {tempInitiative.map((entry, index) => (
              <div key={entry.id} className="flex items-center space-x-2 p-3 bg-clair-shadow-600 border border-clair-shadow-400 rounded-lg">
                <input
                  type="number"
                  value={entry.initiative}
                  onChange={(e) => updateInitiativeEntry(entry.id, 'initiative', parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1 bg-clair-shadow-800 text-clair-gold-200 border border-clair-shadow-400 rounded text-center"
                  min="1"
                  max="30"
                />
                
                <input
                  type="text"
                  value={entry.name}
                  onChange={(e) => updateInitiativeEntry(entry.id, 'name', e.target.value)}
                  className="flex-1 px-2 py-1 bg-clair-shadow-800 text-clair-gold-200 border border-clair-shadow-400 rounded"
                  placeholder="Combatant name"
                />
                
                <select
                  value={entry.type}
                  onChange={(e) => updateInitiativeEntry(entry.id, 'type', e.target.value as 'player' | 'enemy')}
                  className="px-2 py-1 bg-clair-shadow-800 text-clair-gold-200 border border-clair-shadow-400 rounded"
                >
                  <option value="player">Player</option>
                  <option value="enemy">Enemy</option>
                </select>
                
                <button
                  onClick={() => removeInitiativeEntry(entry.id)}
                  className="p-1 text-red-400 hover:text-red-300 transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
              </div>
            ))}
            
            <div className="flex space-x-2 mt-3">
              <button
                onClick={addInitiativeEntry}
                className="flex items-center px-3 py-2 bg-clair-mystical-500 hover:bg-clair-mystical-600 text-white rounded-lg text-sm font-bold transition-colors"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Combatant
              </button>
              
              <button
                onClick={handleSaveInitiative}
                className="px-3 py-2 bg-clair-success hover:bg-green-600 text-white rounded-lg text-sm font-bold transition-colors"
              >
                Save Order
              </button>
              
              <button
                onClick={handleCancelEdit}
                className="px-3 py-2 bg-clair-shadow-500 hover:bg-clair-shadow-400 text-clair-gold-200 rounded-lg text-sm font-bold transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>

      {/* Quick Instructions */}
      {!combatState.isActive && (
        <div className="mt-4 p-3 bg-clair-gold-900 bg-opacity-20 rounded-lg border border-clair-gold-600">
          <h4 className="font-serif font-bold text-clair-gold-400 text-sm mb-2">Setup Instructions:</h4>
          <ul className="text-xs text-clair-gold-300 space-y-1">
            <li>• Set initiative order (highest to lowest)</li>
            <li>• Add enemies to the initiative</li>
            <li>• Click "Start Combat" to begin turn tracking</li>
            <li>• Use "Next Turn" to advance between players/enemies</li>
          </ul>
        </div>
      )}
    </div>
  );
}