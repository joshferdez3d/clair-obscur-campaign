// src/components/Combat/InitiativeTracker.tsx - Enhanced with Player Dropdown
import React, { useState } from 'react';
import { Play, Square, SkipForward, Plus, Minus, Edit3, Users } from 'lucide-react';
import type { InitiativeEntry, CombatState } from '../../types';

interface InitiativeTrackerProps {
  combatState: CombatState;
  onStartCombat: (initiativeOrder: InitiativeEntry[]) => void;
  onEndCombat: () => void;
  onNextTurn: () => void;
  onUpdateInitiative: (initiativeOrder: InitiativeEntry[]) => void;
  characterNames: { [id: string]: string };
  // NEW: Add available player characters
  availableCharacters?: Array<{
    id: string;
    name: string;
    type: 'player' | 'npc';
  }>;
}

export function InitiativeTracker({
  combatState,
  onStartCombat,
  onEndCombat,
  onNextTurn,
  onUpdateInitiative,
  characterNames,
  availableCharacters = []
}: InitiativeTrackerProps) {
  const [editingInitiative, setEditingInitiative] = useState(false);
  const [tempInitiative, setTempInitiative] = useState<InitiativeEntry[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<string>('');

  // Default player characters if none provided
  const defaultCharacters = [
    { id: 'maelle', name: 'Maelle', type: 'player' as const },
    { id: 'gustave', name: 'Gustave', type: 'player' as const },
    { id: 'lune', name: 'Lune', type: 'player' as const },
    { id: 'sciel', name: 'Sciel', type: 'player' as const }
  ];

  const playerCharacters = availableCharacters.length > 0 ? availableCharacters : defaultCharacters;

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

  // NEW: Get characters already in initiative
  const getCharactersInInitiative = () => {
    return new Set(tempInitiative.map(entry => entry.characterId || entry.id));
  };

  // NEW: Get available characters not yet in initiative
  const getAvailableCharacters = () => {
    const inInitiative = getCharactersInInitiative();
    return playerCharacters.filter(char => !inInitiative.has(char.id));
  };

  // NEW: Add selected player character
  const addPlayerCharacter = () => {
    if (!selectedCharacter) return;
    
    const character = playerCharacters.find(c => c.id === selectedCharacter);
    if (!character) return;

    const newEntry: InitiativeEntry = {
      id: character.id,
      characterId: character.id,
      name: character.name,
      initiative: 10,
      type: character.type === 'player' ? 'player' : 'enemy',
      hasActed: false
    };

    setTempInitiative([...tempInitiative, newEntry]);
    setSelectedCharacter(''); // Reset selection
  };

  // Enhanced: Add generic combatant
  const addGenericCombatant = () => {
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
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                combatState.initiativeOrder.length === 0
                  ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              <Play className="w-4 h-4 mr-1" />
              Start Combat
            </button>
          ) : (
            <>
              <button
                onClick={onNextTurn}
                className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors"
              >
                <SkipForward className="w-4 h-4 mr-1" />
                Next Turn
              </button>
              <button
                onClick={onEndCombat}
                className="flex items-center px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold transition-colors"
              >
                <Square className="w-4 h-4 mr-1" />
                End Combat
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {!editingInitiative ? (
          <>
            {combatState.isActive && (
              <div className="mb-4 p-3 bg-clair-gold-900 bg-opacity-20 rounded-lg border border-clair-gold-600">
                <div className="text-center">
                  <p className="font-serif font-bold text-clair-gold-400">Round {combatState.round}</p>
                  <p className="text-sm text-clair-gold-300">Current Turn: {getCurrentTurnName()}</p>
                </div>
              </div>
            )}

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
                      {entry.characterId && (
                        <span className="ml-1 px-1 bg-black bg-opacity-20 rounded text-xs">
                          PC
                        </span>
                      )}
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
            {/* NEW: Player Character Dropdown Section */}
            {getAvailableCharacters().length > 0 && (
              <div className="mb-4 p-3 bg-blue-900/20 rounded-lg border border-blue-500">
                <h4 className="font-serif font-bold text-blue-200 text-sm mb-2 flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  Add Player Characters
                </h4>
                <div className="flex space-x-2">
                  <select
                    value={selectedCharacter}
                    onChange={(e) => setSelectedCharacter(e.target.value)}
                    className="flex-1 px-3 py-2 bg-clair-shadow-800 text-clair-gold-200 border border-clair-shadow-400 rounded"
                  >
                    <option value="">Select a character...</option>
                    {getAvailableCharacters().map(character => (
                      <option key={character.id} value={character.id}>
                        {character.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={addPlayerCharacter}
                    disabled={!selectedCharacter}
                    className={`px-3 py-2 rounded text-sm font-bold flex items-center ${
                      selectedCharacter
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-gray-500 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </button>
                </div>
                <p className="text-xs text-blue-300 mt-1">
                  Characters will be added with initiative 10 (you can edit after adding)
                </p>
              </div>
            )}

            {/* Initiative Order Editing */}
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
                  readOnly={!!entry.characterId} // Prevent editing player names
                />
                
                <select
                  value={entry.type}
                  onChange={(e) => updateInitiativeEntry(entry.id, 'type', e.target.value as 'player' | 'enemy')}
                  className="px-2 py-1 bg-clair-shadow-800 text-clair-gold-200 border border-clair-shadow-400 rounded"
                  disabled={!!entry.characterId} // Prevent changing player types
                >
                  <option value="player">Player</option>
                  <option value="enemy">Enemy</option>
                </select>
                
                {entry.characterId && (
                  <span className="text-xs bg-blue-700 text-blue-100 px-2 py-1 rounded">
                    PC
                  </span>
                )}
                
                <button
                  onClick={() => removeInitiativeEntry(entry.id)}
                  className="p-1 text-red-400 hover:text-red-300 transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
              </div>
            ))}
            
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={addGenericCombatant}
                className="flex items-center px-3 py-2 bg-clair-mystical-500 hover:bg-clair-mystical-600 text-white rounded-lg text-sm font-bold transition-colors"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Enemy/NPC
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

            {/* Show current count */}
            <div className="mt-2 text-xs text-clair-gold-300 text-center">
              {tempInitiative.length} combatants in initiative order
            </div>
          </>
        )}
      </div>

      {/* Quick Instructions */}
      {!combatState.isActive && (
        <div className="mt-4 p-3 bg-clair-gold-900 bg-opacity-20 rounded-lg border border-clair-gold-600">
          <h4 className="font-serif font-bold text-clair-gold-400 text-sm mb-2">Setup Instructions:</h4>
          <ul className="text-xs text-clair-gold-300 space-y-1">
            <li>• Use the dropdown to quickly add player characters</li>
            <li>• Add enemies/NPCs with the "Add Enemy/NPC" button</li>
            <li>• Set initiative values (higher goes first)</li>
            <li>• Click "Save Order" then "Start Combat"</li>
            <li>• Use "Next Turn" to advance between combatants</li>
          </ul>
        </div>
      )}
    </div>
  );
}