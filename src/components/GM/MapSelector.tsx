// src/components/GM/MapSelector.tsx
import React from 'react';
import { Map, ChevronDown } from 'lucide-react';
import type { BattleMap } from '../../types';

export interface MapConfig {
  id: string;
  name: string;
  backgroundImage: string;
  gridSize: { width: number; height: number };
  gridVisible: boolean;
}

// Available maps for Session 0
export const AVAILABLE_MAPS: MapConfig[] = [
  {
    id: 'docks',
    name: 'The Landing',
    backgroundImage: '/maps/BattleMap_Landing.jpg',
    gridSize: { width: 20, height: 15 },
    gridVisible: true
  },
  {
    id: 'festival',
    name: 'The Festival of the Expedition',
    backgroundImage: '/maps/FestivalMap.jpg',
    gridSize: { width: 16, height: 12 },
    gridVisible: true
  },
  {
    id: 'ship',
    name: 'The Ship',
    backgroundImage: '/maps/ShipDeckMap.jpg',
    gridSize: { width: 18, height: 10 },
    gridVisible: true
  }
];

interface MapSelectorProps {
  currentMapId: string;
  onMapChange: (map: MapConfig) => void;
  disabled?: boolean;
}

export function MapSelector({ currentMapId, onMapChange, disabled = false }: MapSelectorProps) {
  const currentMap = AVAILABLE_MAPS.find(m => m.id === currentMapId) || AVAILABLE_MAPS[0];

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-clair-gold-300 mb-2">
        Current Battle Map
      </label>
      
      <div className="relative">
        <select
          value={currentMapId}
          onChange={(e) => {
            const selectedMap = AVAILABLE_MAPS.find(m => m.id === e.target.value);
            if (selectedMap) {
              onMapChange(selectedMap);
            }
          }}
          disabled={disabled}
          className={`
            w-full appearance-none bg-clair-shadow-600 border border-clair-gold-600 rounded-lg px-4 py-3 pr-10
            text-clair-gold-50 font-serif text-sm
            focus:outline-none focus:ring-2 focus:ring-clair-gold-500 focus:border-clair-gold-500
            transition-colors duration-200
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-clair-gold-500 cursor-pointer'}
          `}
        >
          {AVAILABLE_MAPS.map((map) => (
            <option key={map.id} value={map.id} className="bg-clair-shadow-700 text-clair-gold-50">
              {map.name}
            </option>
          ))}
        </select>
        
        {/* Custom dropdown arrow */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <ChevronDown className="h-4 w-4 text-clair-gold-400" />
        </div>
      </div>
      
      {/* Map info display */}
      <div className="mt-2 text-xs text-clair-gold-400 flex items-center space-x-4">
        <div className="flex items-center">
          <Map className="w-3 h-3 mr-1" />
          <span>{currentMap.gridSize.width}×{currentMap.gridSize.height} grid</span>
        </div>
        <div className="flex items-center">
          <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
          <span>Grid visible</span>
        </div>
      </div>
    </div>
  );
}