// src/components/GM/GMStackControlModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Settings, Zap, Sparkles, Flame, Wand2, Plus, Minus } from 'lucide-react';
import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';

interface GMStackControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
}

interface CharacterStacks {
  maelle: {
    afterimageStacks: number;
    maxAfterimageStacks: number;
  };
  gustave: {
    overchargePoints: number;
    maxOverchargePoints: number;
  };
  lune: {
    elementalStains: Array<'fire' | 'ice' | 'nature' | 'light'>;
    maxElementalStains: number;
  };
  sciel: {
    abilityStacks: number;
    maxAbilityStacks: number;
  };
}

type ElementType = 'fire' | 'ice' | 'nature' | 'light';

const ELEMENT_COLORS = {
  fire: 'bg-red-500',
  ice: 'bg-blue-500',
  nature: 'bg-green-500',
  light: 'bg-yellow-300'
};

const ELEMENT_LABELS = {
  fire: '🔥 Fire',
  ice: '❄️ Ice',
  nature: '🌿 Nature',
  light: '✨ Light'
};

export function GMStackControlModal({ isOpen, onClose, sessionId }: GMStackControlModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stacks, setStacks] = useState<CharacterStacks>({
    maelle: { afterimageStacks: 0, maxAfterimageStacks: 5 },
    gustave: { overchargePoints: 0, maxOverchargePoints: 3 },
    lune: { elementalStains: [], maxElementalStains: 4 },
    sciel: { abilityStacks: 0, maxAbilityStacks: 4 }
  });
  const [showElementPicker, setShowElementPicker] = useState(false);

  // Load current stack values from Firestore
  useEffect(() => {
    if (!isOpen || !sessionId) return;

    const loadStacks = async () => {
      setLoading(true);
      try {
        // Load character data for ALL characters
        const characterIds = ['maelle', 'gustave', 'lune', 'sciel'];
        for (const charId of characterIds) {
          const charRef = doc(db, 'characters', charId);
          const charSnap = await getDoc(charRef);

          if (charSnap.exists()) {
            const charData = charSnap.data();
            
            if (charId === 'maelle') {
              setStacks(prev => ({
                ...prev,
                maelle: {
                  afterimageStacks: charData.combatState?.afterimageStacks || 0,
                  maxAfterimageStacks: charData.combatState?.maxAfterimageStacks || 5
                }
              }));
            } else if (charId === 'gustave') {
              setStacks(prev => ({
                ...prev,
                gustave: {
                  overchargePoints: charData.combatState?.overchargePoints || charData.charges || 0,
                  maxOverchargePoints: charData.maxCharges || 3
                }
              }));
            } else if (charId === 'lune') {
              const elementalStains = charData.combatState?.elementalStains || [];
              console.log('📚 Loaded Lune stains:', elementalStains);
              setStacks(prev => ({
                ...prev,
                lune: {
                  elementalStains: elementalStains,
                  maxElementalStains: charData.maxCharges || 4
                }
              }));
            } else if (charId === 'sciel') {
              setStacks(prev => ({
                ...prev,
                sciel: {
                  abilityStacks: charData.charges || 0,
                  maxAbilityStacks: charData.maxCharges || 4
                }
              }));
            }
          }
        }
      } catch (error) {
        console.error('Error loading stacks:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStacks();
  }, [isOpen, sessionId]);

  const handleUpdateStack = (
    character: keyof CharacterStacks,
    stackType: string,
    value: number
  ) => {
    setStacks(prev => ({
      ...prev,
      [character]: {
        ...prev[character],
        [stackType]: Math.max(0, Math.min(value, prev[character][`max${stackType.charAt(0).toUpperCase() + stackType.slice(1)}` as keyof typeof prev[typeof character]]))
      }
    }));
  };

  // Lune-specific functions
  const addLuneStain = (element: ElementType) => {
    if (stacks.lune.elementalStains.length >= stacks.lune.maxElementalStains) {
      alert('Maximum stains reached!');
      return;
    }
    
    setStacks(prev => ({
      ...prev,
      lune: {
        ...prev.lune,
        elementalStains: [...prev.lune.elementalStains, element]
      }
    }));
    setShowElementPicker(false);
  };

  const removeLuneStain = (index: number) => {
    setStacks(prev => ({
      ...prev,
      lune: {
        ...prev.lune,
        elementalStains: prev.lune.elementalStains.filter((_, i) => i !== index)
      }
    }));
  };

  const clearAllLuneStains = () => {
    setStacks(prev => ({
      ...prev,
      lune: {
        ...prev.lune,
        elementalStains: []
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      console.log('💾 Starting save with stacks:', stacks);

      // Update Maelle's afterimage stacks in BOTH battle session AND character collection
      const sessionRef = doc(db, 'battleSessions', sessionId);
      const sessionSnap = await getDoc(sessionRef);
      
      if (sessionSnap.exists()) {
        const sessionData = sessionSnap.data();
        const maelleToken = sessionData.tokens?.['token-maelle'];
        
        if (maelleToken) {
          await updateDoc(sessionRef, {
            'tokens.token-maelle': {
              ...maelleToken,
              afterimageStacks: stacks.maelle.afterimageStacks,
              maxAfterimageStacks: stacks.maelle.maxAfterimageStacks
            },
            updatedAt: serverTimestamp()
          });
        }
      }

      // CRITICAL: Also update Maelle's character document
      const maelleRef = doc(db, 'characters', 'maelle');
      await updateDoc(maelleRef, {
        'combatState.afterimageStacks': stacks.maelle.afterimageStacks,
        'combatState.maxAfterimageStacks': stacks.maelle.maxAfterimageStacks,
        updatedAt: serverTimestamp()
      });

      // Update Gustave's overcharge points
      const gustaveRef = doc(db, 'characters', 'gustave');
      await updateDoc(gustaveRef, {
        'combatState.overchargePoints': stacks.gustave.overchargePoints,
        charges: stacks.gustave.overchargePoints,
        maxCharges: stacks.gustave.maxOverchargePoints,
        updatedAt: serverTimestamp()
      });

      // Update Lune's elemental stains - THIS IS THE KEY FIX
      console.log('💾 Saving Lune stains:', stacks.lune.elementalStains);
      const luneRef = doc(db, 'characters', 'lune');
      await updateDoc(luneRef, {
        'combatState.elementalStains': stacks.lune.elementalStains,
        charges: stacks.lune.elementalStains.length,
        maxCharges: stacks.lune.maxElementalStains,
        updatedAt: serverTimestamp()
      });

      // Update Sciel's ability stacks
      const scielRef = doc(db, 'characters', 'sciel');
      await updateDoc(scielRef, {
        charges: stacks.sciel.abilityStacks,
        maxCharges: stacks.sciel.maxAbilityStacks,
        updatedAt: serverTimestamp()
      });

      console.log('✅ GM: Successfully updated all character stacks');
      
      // Small delay to ensure Firestore propagates changes
      await new Promise(resolve => setTimeout(resolve, 500));
      
      onClose();
    } catch (error) {
      console.error('Error saving stacks:', error);
      alert('Failed to save stack changes. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-clair-shadow-800 border-2 border-clair-gold-600 rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-clair-shadow-700 border-b border-clair-gold-600 p-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center">
            <Settings className="w-6 h-6 text-clair-gold-400 mr-3" />
            <h2 className="font-display text-xl font-bold text-clair-gold-400">
              GM Stack Control Panel
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-clair-gold-400 hover:text-clair-gold-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="text-clair-gold-400">Loading current values...</div>
          </div>
        ) : (
          <>
            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Warning Banner */}
              <div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-4">
                <div className="text-yellow-200 text-sm font-bold mb-1">
                  ⚠️ Emergency Control Panel
                </div>
                <div className="text-yellow-300 text-xs">
                  Use this to manually adjust stacks in case of bugs or edge cases during gameplay.
                  Changes take effect immediately.
                </div>
              </div>

              {/* Maelle - Afterimage Stacks */}
              <div className="bg-clair-shadow-700 border border-clair-royal-500 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <Sparkles className="w-5 h-5 text-clair-royal-400 mr-2" />
                  <h3 className="font-display text-lg font-bold text-clair-royal-300">
                    Maelle - Afterimage Stacks
                  </h3>
                </div>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => handleUpdateStack('maelle', 'afterimageStacks', stacks.maelle.afterimageStacks - 1)}
                    className="px-3 py-2 bg-clair-shadow-600 hover:bg-clair-shadow-500 text-white rounded-lg font-bold"
                  >
                    -
                  </button>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={stacks.maelle.afterimageStacks}
                      onChange={(e) => handleUpdateStack('maelle', 'afterimageStacks', parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2 bg-clair-shadow-600 border border-clair-royal-400 rounded-lg text-white text-center font-bold text-lg"
                      min={0}
                      max={stacks.maelle.maxAfterimageStacks}
                    />
                  </div>
                  <button
                    onClick={() => handleUpdateStack('maelle', 'afterimageStacks', stacks.maelle.afterimageStacks + 1)}
                    className="px-3 py-2 bg-clair-shadow-600 hover:bg-clair-shadow-500 text-white rounded-lg font-bold"
                  >
                    +
                  </button>
                  <div className="text-clair-royal-300 font-bold">
                    / {stacks.maelle.maxAfterimageStacks}
                  </div>
                </div>
                <div className="mt-2 flex space-x-1">
                  {[...Array(stacks.maelle.maxAfterimageStacks)].map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-2 rounded ${
                        i < stacks.maelle.afterimageStacks
                          ? 'bg-clair-royal-400'
                          : 'bg-clair-shadow-600'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Gustave - Overcharge Points */}
              <div className="bg-clair-shadow-700 border border-orange-500 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <Zap className="w-5 h-5 text-orange-400 mr-2" />
                  <h3 className="font-display text-lg font-bold text-orange-300">
                    Gustave - Overcharge Points
                  </h3>
                </div>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => handleUpdateStack('gustave', 'overchargePoints', stacks.gustave.overchargePoints - 1)}
                    className="px-3 py-2 bg-clair-shadow-600 hover:bg-clair-shadow-500 text-white rounded-lg font-bold"
                  >
                    -
                  </button>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={stacks.gustave.overchargePoints}
                      onChange={(e) => handleUpdateStack('gustave', 'overchargePoints', parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2 bg-clair-shadow-600 border border-orange-400 rounded-lg text-white text-center font-bold text-lg"
                      min={0}
                      max={stacks.gustave.maxOverchargePoints}
                    />
                  </div>
                  <button
                    onClick={() => handleUpdateStack('gustave', 'overchargePoints', stacks.gustave.overchargePoints + 1)}
                    className="px-3 py-2 bg-clair-shadow-600 hover:bg-clair-shadow-500 text-white rounded-lg font-bold"
                  >
                    +
                  </button>
                  <div className="text-orange-300 font-bold">
                    / {stacks.gustave.maxOverchargePoints}
                  </div>
                </div>
                <div className="mt-2 flex space-x-1">
                  {[...Array(stacks.gustave.maxOverchargePoints)].map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-2 rounded ${
                        i < stacks.gustave.overchargePoints
                          ? 'bg-orange-400'
                          : 'bg-clair-shadow-600'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Lune - Elemental Stains - REDESIGNED */}
              <div className="bg-clair-shadow-700 border border-blue-500 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Flame className="w-5 h-5 text-blue-400 mr-2" />
                    <h3 className="font-display text-lg font-bold text-blue-300">
                      Lune - Elemental Stains
                    </h3>
                  </div>
                  <div className="text-blue-300 font-bold">
                    {stacks.lune.elementalStains.length} / {stacks.lune.maxElementalStains}
                  </div>
                </div>

                {/* Current Stains Display */}
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2 min-h-[48px] p-2 bg-clair-shadow-600 rounded-lg border border-blue-400">
                    {stacks.lune.elementalStains.length === 0 ? (
                      <div className="w-full text-center text-gray-400 text-sm py-2">
                        No stains
                      </div>
                    ) : (
                      stacks.lune.elementalStains.map((element, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center space-x-2 ${ELEMENT_COLORS[element]} px-3 py-1 rounded-lg text-white font-bold text-sm`}
                        >
                          <span>{ELEMENT_LABELS[element]}</span>
                          <button
                            onClick={() => removeLuneStain(idx)}
                            className="hover:bg-black/20 rounded px-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Element Picker */}
                {showElementPicker && (
                  <div className="mb-4 p-3 bg-clair-shadow-600 rounded-lg border border-blue-400">
                    <div className="text-blue-200 text-sm font-bold mb-2">Select Element to Add:</div>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(ELEMENT_LABELS) as ElementType[]).map(element => (
                        <button
                          key={element}
                          onClick={() => addLuneStain(element)}
                          className={`${ELEMENT_COLORS[element]} hover:opacity-80 text-white font-bold py-2 px-4 rounded-lg transition-all`}
                        >
                          {ELEMENT_LABELS[element]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowElementPicker(!showElementPicker)}
                    disabled={stacks.lune.elementalStains.length >= stacks.lune.maxElementalStains}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg font-bold flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Stain
                  </button>
                  <button
                    onClick={clearAllLuneStains}
                    disabled={stacks.lune.elementalStains.length === 0}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg font-bold"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Sciel - Ability Stacks */}
              <div className="bg-clair-shadow-700 border border-purple-500 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <Wand2 className="w-5 h-5 text-purple-400 mr-2" />
                  <h3 className="font-display text-lg font-bold text-purple-300">
                    Sciel - Ability Stacks
                  </h3>
                </div>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => handleUpdateStack('sciel', 'abilityStacks', stacks.sciel.abilityStacks - 1)}
                    className="px-3 py-2 bg-clair-shadow-600 hover:bg-clair-shadow-500 text-white rounded-lg font-bold"
                  >
                    -
                  </button>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={stacks.sciel.abilityStacks}
                      onChange={(e) => handleUpdateStack('sciel', 'abilityStacks', parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2 bg-clair-shadow-600 border border-purple-400 rounded-lg text-white text-center font-bold text-lg"
                      min={0}
                      max={stacks.sciel.maxAbilityStacks}
                    />
                  </div>
                  <button
                    onClick={() => handleUpdateStack('sciel', 'abilityStacks', stacks.sciel.abilityStacks + 1)}
                    className="px-3 py-2 bg-clair-shadow-600 hover:bg-clair-shadow-500 text-white rounded-lg font-bold"
                  >
                    +
                  </button>
                  <div className="text-purple-300 font-bold">
                    / {stacks.sciel.maxAbilityStacks}
                  </div>
                </div>
                <div className="mt-2 flex space-x-1">
                  {[...Array(stacks.sciel.maxAbilityStacks)].map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-2 rounded ${
                        i < stacks.sciel.abilityStacks
                          ? 'bg-purple-400'
                          : 'bg-clair-shadow-600'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-clair-shadow-700 border-t border-clair-gold-600 p-4 flex justify-between sticky bottom-0">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-clair-shadow-600 hover:bg-clair-shadow-500 border border-clair-gold-600 text-clair-gold-200 rounded-lg font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-clair-mystical-500 hover:bg-clair-mystical-600 text-white rounded-lg font-bold transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Apply Changes'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}