// src/components/GM/QuickPresetActions.tsx
import React from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { useBattlePresets } from '../../hooks/useBattlePresets';
import type { BattleToken, MapConfig } from '../../types';

interface QuickPresetActionsProps {
  sessionId: string;
  currentMap: MapConfig;
  tokens: BattleToken[];
  className?: string;
}

export function QuickPresetActions({ 
  sessionId, 
  currentMap, 
  tokens,
  className = ''
}: QuickPresetActionsProps) {
  const { presets, savePreset, loadPreset } = useBattlePresets(currentMap.id);

  const handleQuickSave = async () => {
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    const tokenRecord: Record<string, BattleToken> = {};
    tokens.forEach(token => {
      tokenRecord[token.id] = token;
    });

    await savePreset(sessionId, {
      name: `Quick Save ${timestamp}`,
      description: `Auto-saved preset for ${currentMap.name}`,
      mapId: currentMap.id,
      tokens: tokenRecord
    });
  };

  const handleQuickLoad = async () => {
    // Load the most recent preset for this map
    if (presets.length > 0) {
      const latestPreset = presets[0]; // Presets are ordered by createdAt desc
      await loadPreset(sessionId, latestPreset.id);
    }
  };

  const hasTokens = tokens.length > 0;
  const hasPresets = presets.length > 0;

  return (
    <div className={`flex space-x-2 ${className}`}>
      <button
        onClick={handleQuickSave}
        disabled={!hasTokens}
        className="flex items-center px-2 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded text-xs font-bold transition-colors"
        title="Quick save current token positions"
      >
        <Save className="w-3 h-3 mr-1" />
        Quick Save
      </button>
      
      <button
        onClick={handleQuickLoad}
        disabled={!hasPresets}
        className="flex items-center px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded text-xs font-bold transition-colors"
        title="Load most recent preset"
      >
        <RotateCcw className="w-3 h-3 mr-1" />
        Quick Load
      </button>
    </div>
  );
}