import React from 'react';
import { Users, Heart, Shield, X, Edit2 } from 'lucide-react';
import type { BattleToken } from '../../types';

interface NPCPanelProps {
  npcs: BattleToken[];
  isGMView: boolean;
  onRemoveNPC?: (npcId: string) => void;
  onEditHP?: (npcId: string, newHP: number) => void;
}

export function NPCPanel({ npcs, isGMView, onRemoveNPC, onEditHP }: NPCPanelProps) {
  const activeNPCs = npcs.filter(n => (n.hp ?? 0) > 0);
  const deadNPCs = npcs.filter(n => (n.hp ?? 0) <= 0);

  if (npcs.length === 0) {
    return (
      <div className="bg-clair-shadow-700 border border-clair-gold-600 rounded-lg p-4 shadow-shadow">
        <h3 className="font-display text-lg font-bold text-clair-gold-400 mb-3 flex items-center">
          <Users className="w-5 h-5 mr-2" />
          Expedition Crew
        </h3>
        <div className="text-center py-8 text-clair-gold-300 opacity-50">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No expedition members on the battlefield</p>
          {isGMView && (
            <p className="text-xs mt-2">Click "Add Expeditioner" to deploy crew members</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-clair-shadow-700 border border-clair-gold-600 rounded-lg p-4 shadow-shadow">
      <h3 className="font-display text-lg font-bold text-clair-gold-400 mb-3 flex items-center">
        <Users className="w-5 h-5 mr-2" />
        Expedition Crew ({activeNPCs.length} active)
      </h3>

      <div className="space-y-2">
        {/* Active NPCs */}
        {activeNPCs.map((npc) => {
          const currentHP = npc.hp ?? 0;
          const maxHP = npc.maxHp ?? 20;
          const hpPercent = (currentHP / maxHP) * 100;

          return (
            <div 
              key={npc.id} 
              className="bg-clair-shadow-800 rounded-lg p-3 border border-clair-gold-600"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-2" 
                    style={{ backgroundColor: npc.color || '#16a34a' }}
                  />
                  <span className="font-bold text-clair-gold-200">{npc.name}</span>
                </div>
                {isGMView && onRemoveNPC && (
                  <button
                    onClick={() => onRemoveNPC(npc.id)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                    title="Remove NPC"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* HP Bar */}
              <div className="mb-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-clair-gold-300">HP</span>
                  <span className="text-clair-gold-200">{currentHP}/{maxHP}</span>
                </div>
                <div className="w-full bg-clair-shadow-900 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      hpPercent > 50 ? 'bg-green-500' :
                      hpPercent > 25 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${hpPercent}%` }}
                  />
                </div>
              </div>

              {/* GM Controls */}
              {isGMView && (
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <div className="text-clair-gold-300">
                      AC: {npc.ac ?? 13}
                    </div>
                    <div className="text-clair-gold-300">
                      Pos: ({npc.position.x}, {npc.position.y})
                    </div>
                  </div>
                  {onEditHP && (
                    <button
                      onClick={() => {
                        const newHP = prompt(`New HP for ${npc.name}:`, currentHP.toString());
                        if (newHP !== null) {
                          const hp = parseInt(newHP);
                          if (!isNaN(hp) && hp >= 0) {
                            onEditHP(npc.id, hp);
                          }
                        }
                      }}
                      className="text-blue-400 hover:text-blue-300 flex items-center"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Edit HP
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Dead NPCs */}
        {deadNPCs.length > 0 && (
          <>
            <div className="border-t border-clair-shadow-600 pt-2 mt-2">
              <h4 className="text-xs font-bold text-red-400 mb-2">Fallen Expeditioners</h4>
              {deadNPCs.map((npc) => (
                <div key={npc.id} className="flex items-center justify-between py-1 opacity-50">
                  <span className="text-xs text-clair-gold-300 line-through">{npc.name}</span>
                  {isGMView && onRemoveNPC && (
                    <button
                      onClick={() => onRemoveNPC(npc.id)}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Summary Footer */}
      {npcs.length > 0 && (
        <div className="mt-3 pt-3 border-t border-clair-shadow-600">
          <div className="grid grid-cols-3 gap-2 text-xs text-clair-gold-300">
            <div>Active: {activeNPCs.length}</div>
            <div>Fallen: {deadNPCs.length}</div>
            <div>Total: {npcs.length}</div>
          </div>
        </div>
      )}
    </div>
  );
}