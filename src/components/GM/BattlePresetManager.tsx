// src/components/GM/BattlePresetManager.tsx
import React, { useState, useEffect } from 'react';
import { Save, Download, Trash2, Plus, FileText, MapPin } from 'lucide-react';
import { FirestoreService } from '../../services/firestoreService';
import type { BattleMapPreset, BattleToken, MapConfig, PresetSaveData } from '../../types';

interface BattlePresetManagerProps {
  sessionId: string;
  currentMap: MapConfig;
  tokens: BattleToken[];
  onLoadPreset: (preset: BattleMapPreset) => void;
  disabled?: boolean;
}

export function BattlePresetManager({ 
  sessionId, 
  currentMap, 
  tokens, 
  onLoadPreset,
  disabled = false 
}: BattlePresetManagerProps) {
  const [presets, setPresets] = useState<BattleMapPreset[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadPanel, setShowLoadPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');

  // Load presets when map changes
  useEffect(() => {
    loadPresets();
  }, [currentMap.id]);

  const loadPresets = async () => {
    setLoading(true);
    try {
      const mapPresets = await FirestoreService.getBattleMapPresets(currentMap.id);
      setPresets(mapPresets);
    } catch (error) {
      console.error('Failed to load presets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreset = async () => {
    if (!saveName.trim()) return;

    setLoading(true);
    try {
      // Convert tokens array to the Record<string, BattleToken> format expected by presets
      const tokenRecord: Record<string, BattleToken> = {};
      tokens.forEach(token => {
        tokenRecord[token.id] = token;
      });

      const presetData: PresetSaveData = {
        name: saveName.trim(),
        description: saveDescription.trim(),
        mapId: currentMap.id,
        tokens: tokenRecord
      };

      await FirestoreService.saveBattleMapPreset(sessionId, presetData);
      
      // Reset form and reload presets
      setSaveName('');
      setSaveDescription('');
      setShowSaveModal(false);
      await loadPresets();
      
      console.log(`Preset "${saveName}" saved successfully!`);
    } catch (error) {
      console.error('Failed to save preset:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadPreset = async (preset: BattleMapPreset) => {
    setLoading(true);
    try {
      await FirestoreService.loadBattleMapPreset(sessionId, preset.id);
      onLoadPreset(preset);
      setShowLoadPanel(false);
      console.log(`Preset "${preset.name}" loaded successfully!`);
    } catch (error) {
      console.error('Failed to load preset:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePreset = async (presetId: string, presetName: string) => {
    if (!window.confirm(`Are you sure you want to delete the preset "${presetName}"?`)) {
      return;
    }

    setLoading(true);
    try {
      await FirestoreService.deleteBattleMapPreset(presetId);
      await loadPresets();
      console.log(`Preset "${presetName}" deleted successfully!`);
    } catch (error) {
      console.error('Failed to delete preset:', error);
    } finally {
      setLoading(false);
    }
  };

  const tokenCount = tokens.length;
  const playerCount = tokens.filter(t => t.type === 'player').length;
  const enemyCount = tokens.filter(t => t.type === 'enemy').length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MapPin className="w-4 h-4 text-clair-gold-400" />
          <span className="text-sm font-medium text-clair-gold-300">Battle Presets</span>
        </div>
        <div className="text-xs text-clair-gold-400">
          {tokenCount} tokens on {currentMap.name}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-2">
        <button
          onClick={() => setShowSaveModal(true)}
          disabled={disabled || loading || tokenCount === 0}
          className="flex items-center justify-center flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition-colors"
        >
          <Save className="w-4 h-4 mr-1" />
          Save Preset
        </button>
        
        <button
          onClick={() => setShowLoadPanel(!showLoadPanel)}
          disabled={disabled || loading}
          className="flex items-center justify-center flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition-colors"
        >
          <Download className="w-4 h-4 mr-1" />
          Load ({presets.length})
        </button>
      </div>

      {/* Load Panel */}
      {showLoadPanel && (
        <div className="bg-clair-shadow-700 border border-clair-gold-600 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
          <div className="text-xs font-bold text-clair-gold-400 mb-2">
            Available Presets for {currentMap.name}:
          </div>
          
          {loading ? (
            <div className="text-center text-clair-gold-300 py-2">Loading presets...</div>
          ) : presets.length === 0 ? (
            <div className="text-center text-clair-gold-300 py-2">No presets found for this map</div>
          ) : (
            presets.map((preset) => (
              <div key={preset.id} className="flex items-center justify-between bg-clair-shadow-800 rounded p-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-clair-gold-200 truncate">
                    {preset.name}
                  </div>
                  <div className="text-xs text-clair-gold-400">
                    {Object.keys(preset.tokens).length} tokens • {preset.createdAt.toLocaleDateString()}
                  </div>
                  {preset.description && (
                    <div className="text-xs text-clair-gold-300 truncate">
                      {preset.description}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-1 ml-2">
                  <button
                    onClick={() => handleLoadPreset(preset)}
                    disabled={loading}
                    className="p-1 text-blue-400 hover:text-blue-300 disabled:opacity-50"
                    title="Load this preset"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeletePreset(preset.id, preset.name)}
                    disabled={loading}
                    className="p-1 text-red-400 hover:text-red-300 disabled:opacity-50"
                    title="Delete this preset"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-clair-shadow-800 border border-clair-gold-600 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-clair-gold-200">Save Battle Preset</h3>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-clair-gold-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            {/* Current Setup Summary */}
            <div className="bg-clair-shadow-700 rounded p-3 mb-4">
              <div className="text-sm text-clair-gold-300 mb-1">Current Setup:</div>
              <div className="text-xs text-clair-gold-400 space-y-1">
                <div>Map: {currentMap.name}</div>
                <div>Tokens: {playerCount} players, {enemyCount} enemies, {tokenCount - playerCount - enemyCount} other</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-clair-gold-300 mb-2">
                  Preset Name *
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g. 'Landing Battle Start'"
                  className="w-full bg-clair-shadow-700 border border-clair-gold-600 rounded px-3 py-2 text-clair-gold-100"
                  maxLength={50}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-clair-gold-300 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  placeholder="Brief description of this battle setup..."
                  className="w-full bg-clair-shadow-700 border border-clair-gold-600 rounded px-3 py-2 text-clair-gold-100 h-20 resize-none"
                  maxLength={200}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowSaveModal(false)}
                  disabled={loading}
                  className="px-4 py-2 border border-clair-gold-600 text-clair-gold-300 rounded hover:bg-clair-shadow-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePreset}
                  disabled={loading || !saveName.trim()}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:opacity-50 text-white rounded transition-colors"
                >
                  {loading ? 'Saving...' : 'Save Preset'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}