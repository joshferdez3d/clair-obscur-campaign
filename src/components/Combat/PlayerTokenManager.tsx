// src/components/Combat/PlayerTokenManager.tsx
import React, { useState } from 'react';
import { Users, X, Plus } from 'lucide-react';
import type { BattleToken } from '../../types';

interface PlayerCharacter {
  id: string;
  name: string;
  maxHp: number;
  ac: number;
  color: string;
}

interface PlayerTokenManagerProps {
  availableCharacters: PlayerCharacter[];
  currentTokens: BattleToken[];
  onSelectForPlacement: (character: PlayerCharacter) => void;
  onRemoveToken: (tokenId: string) => void;
}

export function PlayerTokenManager({ 
  availableCharacters, 
  currentTokens,
  onSelectForPlacement,
  onRemoveToken
}: PlayerTokenManagerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get which player characters are already on the map
  const getPlayersOnMap = () => {
    return currentTokens.filter(token => token.type === 'player');
  };

  // Get which player characters are NOT on the map
  const getPlayersNotOnMap = () => {
    const onMap = new Set(getPlayersOnMap().map(t => t.characterId));
    return availableCharacters.filter(char => !onMap.has(char.id));
  };

  const playersOnMap = getPlayersOnMap();
  const playersNotOnMap = getPlayersNotOnMap();

  return (
    <div className="bg-clair-shadow-700 border border-clair-gold-600 rounded-lg shadow-shadow">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-clair-shadow-600 transition-colors rounded-t-lg"
      >
        <div className="flex items-center">
          <Users className="w-5 h-5 mr-2 text-clair-gold-400" />
          <h3 className="font-display text-lg font-bold text-clair-gold-400">
            Player Tokens
          </h3>
          <span className="ml-2 text-sm text-clair-gold-300">
            ({playersOnMap.length}/{availableCharacters.length} on map)
          </span>
        </div>
        <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 border-t border-clair-shadow-400">
          {/* Players NOT on Map - Can be added */}
          {playersNotOnMap.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-bold text-green-400 mb-2 flex items-center">
                <Plus className="w-4 h-4 mr-1" />
                Available to Add
              </h4>
              <div className="space-y-2">
                {playersNotOnMap.map(char => (
                  <button
                    key={char.id}
                    onClick={() => onSelectForPlacement(char)}
                    className="w-full p-3 bg-green-900 bg-opacity-30 border border-green-600 rounded-lg hover:bg-green-800 hover:bg-opacity-40 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-clair-gold-200">{char.name}</div>
                        <div className="text-sm text-clair-gold-300">
                          HP: {char.maxHp} | AC: {char.ac}
                        </div>
                      </div>
                      <div className="text-green-400 font-bold">
                        Click to Place
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Players ON Map - Can be removed */}
          {playersOnMap.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-blue-400 mb-2 flex items-center">
                <Users className="w-4 h-4 mr-1" />
                Currently on Map
              </h4>
              <div className="space-y-2">
                {playersOnMap.map(token => (
                  <div
                    key={token.id}
                    className="p-3 bg-blue-900 bg-opacity-30 border border-blue-600 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-clair-gold-200">{token.name}</div>
                        <div className="text-sm text-clair-gold-300">
                          Position: ({token.position.x}, {token.position.y}) | 
                          HP: {token.hp}/{token.maxHp}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (window.confirm(`Remove ${token.name} from the battlefield?`)) {
                            onRemoveToken(token.id);
                          }
                        }}
                        className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {playersNotOnMap.length === 0 && playersOnMap.length === 0 && (
            <div className="text-center text-clair-gold-400 py-4">
              No player characters available
            </div>
          )}
        </div>
      )}
    </div>
  );
}