// src/components/Combat/GMCombatPopup.tsx
import React, { useEffect, useState } from 'react';
import { Sword, X, Check, Shuffle, Eye, EyeOff } from 'lucide-react';
import type { GMCombatAction } from '../../types';
import { FirestoreService } from '../../services/firestoreService';

interface GMCombatPopupProps {
  actions: GMCombatAction[];
  onApplyDamage: (actionId: string, damage: number) => void | Promise<void>;
  onDismissMiss: (actionId: string) => void | Promise<void>;
  sessionId: string; 
}

export function GMCombatPopup({ actions, onApplyDamage, onDismissMiss, sessionId}: GMCombatPopupProps) {
const [damageInputs, setDamageInputs] = useState<Record<string, string>>({});
  const [applyingDamage, setApplyingDamage] = useState<Set<string>>(new Set());

  // Simple filter - just get unresolved actions
  // Firebase action IDs are unique with timestamps, so duplicates shouldn't be an issue
  const pending = actions.filter((a) => !a.resolved);


  useEffect(() => {
    // Auto-dismiss buff/debuff actions that don't need damage input
    pending.forEach((a) => {
      const isBuffDebuff = a.buffType === 'advantage' || a.buffType === 'disadvantage';
      const isAoE = Array.isArray(a.targetIds) && a.targetIds.length > 0;
      const displayHit = Boolean(a.hit) || isAoE;

      // Auto-dismiss if it's a miss and doesn't need damage input, or if it's a buff/debuff
      if ((!displayHit && !a.needsDamageInput) || (isBuffDebuff && !a.needsDamageInput)) {
        const t = setTimeout(() => onDismissMiss(a.id), isBuffDebuff ? 1000 : 2000);
        return () => clearTimeout(t);
      }
      return undefined;
    });
  }, [pending, onDismissMiss]);

  const onChange = (id: string, val: string) =>
    setDamageInputs((p) => ({ ...p, [id]: val }));

  const handleApply = async (id: string) => {
    if (applyingDamage.has(id)) return;
    
    const action = pending.find(a => a.id === id);
    if (!action) return;
    
    const dmg = parseInt(damageInputs[id] || '0', 10);
    if (Number.isNaN(dmg)) return;
    
    setApplyingDamage(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    
    try {
      await onApplyDamage(id, dmg);
      
      // Handle special card effects after damage is applied
      if (action.cardType === 'switch') {
        console.log('Applying switch effect for action:', id);
        await FirestoreService.applySwitchPositions(sessionId, id);
        console.log('Switch effect applied successfully');
      } else if (action.cardType === 'vanish') {
        console.log('Applying vanish effect for action:', id);
        await FirestoreService.applyVanishEffect(sessionId, id);
        console.log('Vanish effect applied successfully');
      }
    } catch (error) {
      console.error('Error applying card effect:', error);
    } finally {
      setApplyingDamage(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const getActionIcon = (action: GMCombatAction) => {
    if (action.buffType === 'advantage') return <Eye className="w-5 h-5 text-green-400 mr-2" />;
    if (action.buffType === 'disadvantage') return <EyeOff className="w-5 h-5 text-red-400 mr-2" />;
    if (action.cardType === 'switch') return <Shuffle className="w-5 h-5 text-blue-400 mr-2" />;
    if (action.cardType === 'vanish') return <span className="w-5 h-5 text-purple-400 mr-2">👻</span>;
    if (action.cardType === 'explosive') return <span className="w-5 h-5 text-orange-400 mr-2">💥</span>;
    
    const isAoE = Array.isArray(action.targetIds) && action.targetIds.length > 0;
    const displayHit = Boolean(action.hit) || isAoE;
    
    return displayHit ? (
      <Check className="w-5 h-5 text-green-400 mr-2" />
    ) : (
      <X className="w-5 h-5 text-red-400 mr-2" />
    );
  };

  const getActionLabel = (action: GMCombatAction) => {
    if (action.buffType === 'advantage') return 'ADVANTAGE GRANTED!';
    if (action.buffType === 'disadvantage') return 'DISADVANTAGE APPLIED!';
    if (action.cardType === 'switch') return 'SWITCH CARD!';
    if (action.cardType === 'vanish') return 'VANISH CARD!';
    if (action.cardType === 'explosive') return 'EXPLOSIVE CARD!';
    
    const isAoE = Array.isArray(action.targetIds) && action.targetIds.length > 0;
    const displayHit = Boolean(action.hit) || isAoE;
    
    return displayHit ? 'HIT!' : 'MISS!';
  };

  const getActionBgColor = (action: GMCombatAction) => {
    if (action.buffType === 'advantage') return 'bg-green-800 border-green-500';
    if (action.buffType === 'disadvantage') return 'bg-red-800 border-red-500';
    if (action.cardType === 'switch') return 'bg-blue-800 border-blue-500';
    if (action.cardType === 'vanish') return 'bg-purple-800 border-purple-500';
    if (action.cardType === 'explosive') return 'bg-orange-800 border-orange-500';
    
    const isAoE = Array.isArray(action.targetIds) && action.targetIds.length > 0;
    const displayHit = Boolean(action.hit) || isAoE;
    
    return displayHit ? 'bg-green-800 border-green-500' : 'bg-red-800 border-red-500';
  };

  const getActionDescription = (action: GMCombatAction) => {
    if (action.buffType === 'advantage') {
      return `${action.targetName} gains advantage on their next roll`;
    }
    if (action.buffType === 'disadvantage') {
      return `${action.targetName} has disadvantage on their next roll`;
    }
    if (action.cardType === 'switch') {
      return `${action.playerName} will switch positions with ${action.targetName} after damage`;
    }
    if (action.cardType === 'vanish') {
      return `${action.targetName} will be banished for 2 rounds after damage`;
    }
    if (action.cardType === 'explosive') {
      return `Primary target + all enemies within 10ft take damage`;
    }
    return null;
  };
  
  if (pending.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {pending.map((a) => {
        const isAoE = Array.isArray(a.targetIds) && a.targetIds.length > 0;
        const isExplosionCard = a.cardType === 'explosive' && a.abilityName?.includes('Explosive');
        const isBuffDebuff = a.buffType === 'advantage' || a.buffType === 'disadvantage';
        const isSwitchCard = a.cardType === 'switch';
        const isVanishCard = a.cardType === 'vanish';
        const displayHit = Boolean(a.hit) || isAoE || isBuffDebuff;
        const showDamageInput = Boolean(a.needsDamageInput) && !isBuffDebuff;

        return (
          <div
            key={a.id}
            className={`p-4 rounded-lg shadow-lg border-2 ${getActionBgColor(a)}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                {getActionIcon(a)}
                <span className="font-bold text-white">
                  {getActionLabel(a)}
                </span>
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
                {typeof a.acRoll === 'number' && a.acRoll > 0 ? ` • AC Roll: ${a.acRoll}` : null}
              </div>
              
              {/* Special effect descriptions */}
              {getActionDescription(a) && (
                <div className="mt-2 p-2 bg-black/20 rounded border border-gray-600">
                  <div className="text-xs text-gray-200">
                    {getActionDescription(a)}
                  </div>
                </div>
              )}
              
              {/* AoE target list */}
              {isAoE && a.targetNames?.length ? (
                <div className="text-xs opacity-80 mt-1">
                  <strong>Targets:</strong> {a.targetNames.join(', ')}
                </div>
              ) : null}

              {/* Vanish details */}
              {isVanishCard && a.vanishData && (
                <div className="text-xs text-purple-200 mt-1">
                  Returns on round: {a.vanishData.returnsOnRound}
                </div>
              )}
            </div>

            {/* Damage input for cards that deal damage */}
            {showDamageInput ? (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white">
                  {isExplosionCard ? 'Apply Explosion Damage (to all targets):' : 
                   isSwitchCard ? 'Apply Card Damage + Position Switch:' :
                   isVanishCard ? 'Apply Card Damage + Banishment:' :
                   'Apply Damage:'}
                </label>
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
                {(isSwitchCard || isVanishCard) && (
                  <div className="text-xs text-yellow-300">
                    Special effect will be applied automatically after damage
                  </div>
                )}
                {isExplosionCard && (
                  <div className="text-xs text-yellow-300">
                    This damage will be applied to all {a.targetIds?.length || 0} enemies in the blast
                  </div>
                )}
              </div>
            ) : !displayHit ? (
              <div className="text-xs text-red-300">Auto-dismissing in 2 seconds...</div>
            ) : isBuffDebuff ? (
              <div className="text-xs text-green-300">Effect applied! Auto-dismissing...</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}