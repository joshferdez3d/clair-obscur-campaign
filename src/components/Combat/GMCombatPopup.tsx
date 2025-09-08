// src/components/Combat/GMCombatPopup.tsx
import React, { useEffect, useState } from 'react';
import { Sword, X, Check } from 'lucide-react';
import type { GMCombatAction as ServiceGMCombatAction } from '../../services/firestoreService';

export type GMCombatAction = ServiceGMCombatAction;

interface GMCombatPopupProps {
  actions: GMCombatAction[];
  onApplyDamage: (actionId: string, damage: number) => void | Promise<void>;
  onDismissMiss: (actionId: string) => void | Promise<void>;
}

export function GMCombatPopup({ actions, onApplyDamage, onDismissMiss }: GMCombatPopupProps) {
  const [damageInputs, setDamageInputs] = useState<Record<string, string>>({});

  const pending = actions.filter((a) => !a.resolved);

  useEffect(() => {
    // auto-dismiss ONLY if truly a miss and no damage input is expected
    pending.forEach((a) => {
      const isAoE = Array.isArray(a.targetIds) && a.targetIds.length > 0;
      const displayHit = Boolean(a.hit) || isAoE;

      if (!displayHit && !a.needsDamageInput) {
        const t = setTimeout(() => onDismissMiss(a.id), 2000);
        return () => clearTimeout(t);
      }
      return undefined;
    });
  }, [pending, onDismissMiss]);

  const onChange = (id: string, val: string) =>
    setDamageInputs((p) => ({ ...p, [id]: val }));

  const [applyingDamage, setApplyingDamage] = useState<Set<string>>(new Set());

  const handleApply = async (id: string) => {
    if (applyingDamage.has(id)) return; // Prevent double submission
    
    const dmg = parseInt(damageInputs[id] || '0', 10);
    console.log(`Applying damage: ${dmg} (type: ${typeof dmg})`);
    if (Number.isNaN(dmg)) return;
    
    setApplyingDamage(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    
    try {
      await onApplyDamage(id, dmg);
    } finally {
      setApplyingDamage(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };
  
  if (pending.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {pending.map((a) => {
        const isAoE = Array.isArray(a.targetIds) && a.targetIds.length > 0;
        const displayHit = Boolean(a.hit) || isAoE; // ✅ AoE always shows HIT in UI
        const showDamageInput = Boolean(a.needsDamageInput);

        return (
          <div
            key={a.id}
            className={`p-4 rounded-lg shadow-lg border-2 ${
              displayHit ? 'bg-green-800 border-green-500' : 'bg-red-800 border-red-500'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                {displayHit ? (
                  <Check className="w-5 h-5 text-green-400 mr-2" />
                ) : (
                  <X className="w-5 h-5 text-red-400 mr-2" />
                )}
                <span className="font-bold text-white">{displayHit ? 'HIT!' : 'MISS!'}</span>
              </div>
              <button
                onClick={() => onDismissMiss(a.id)}
                className="text-gray-300 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-sm text-gray-200 mb-3">
              <div className="flex items-center mb-1">
                <Sword className="w-4 h-4 mr-1" />
                <span className="font-medium">{a.playerName ?? 'Player'}</span>
                <span className="mx-1">→</span>
                {isAoE ? (
                  <span className="font-medium">
                    {a.targetIds!.length} target{a.targetIds!.length > 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="font-medium">{a.targetName ?? 'Target'}</span>
                )}
              </div>
              <div className="text-xs">
                {a.abilityName ?? (a.type === 'ability' ? 'Ability' : 'Attack')}
                {typeof a.acRoll === 'number' ? ` • AC Roll: ${a.acRoll}` : null}
              </div>
              {isAoE && a.targetNames?.length ? (
                <div className="text-xs opacity-80 mt-1">{a.targetNames.join(', ')}</div>
              ) : null}
            </div>

            {showDamageInput ? (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white">Apply Damage:</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={damageInputs[a.id] || ''}
                    onChange={(e) => onChange(a.id, e.target.value)}
                    placeholder="Damage amount"
                    className="flex-1 px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    min={0}
                    autoFocus
                  />
                  <button
                    onClick={() => handleApply(a.id)}
                    disabled={applyingDamage.has(a.id)}
                    className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-white text-sm disabled:opacity-50"
                  >
                    {applyingDamage.has(a.id) ? 'Applying...' : 'Apply'}
                  </button>
                </div>
              </div>
            ) : !displayHit ? (
              <div className="text-xs text-red-300">Auto-dismissing in 2 seconds...</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
