// src/components/Verso/ResonanceAudioControls.tsx
import React, { useState } from 'react';
import { Volume2, VolumeX, Volume1, Music } from 'lucide-react';

interface ResonanceAudioControlsProps {
  volume: number;
  isEnabled: boolean;
  onVolumeChange: (volume: number) => void;
  onToggle: () => void;
}

export function ResonanceAudioControls({
  volume,
  isEnabled,
  onVolumeChange,
  onToggle
}: ResonanceAudioControlsProps) {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const getVolumeIcon = () => {
    if (!isEnabled || volume === 0) return <VolumeX className="w-5 h-5" />;
    if (volume < 0.5) return <Volume1 className="w-5 h-5" />;
    return <Volume2 className="w-5 h-5" />;
  };

  return (
    <div className="bg-clair-shadow-700 rounded-lg p-3 border border-clair-mystical-500">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <Music className="w-5 h-5 mr-2 text-clair-mystical-300" />
          <span className="text-sm font-bold text-clair-mystical-300">
            Resonance Audio
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Volume Control */}
          <div className="relative">
            <button
              onClick={() => setShowVolumeSlider(!showVolumeSlider)}
              className={`p-2 rounded transition-colors ${
                isEnabled 
                  ? 'text-clair-mystical-300 hover:text-clair-mystical-100 hover:bg-clair-shadow-600' 
                  : 'text-clair-shadow-400'
              }`}
              title={isEnabled ? `Volume: ${Math.round(volume * 100)}%` : 'Audio disabled'}
            >
              {getVolumeIcon()}
            </button>
            
            {/* Volume Slider Popup */}
            {showVolumeSlider && isEnabled && (
              <div className="absolute bottom-full right-0 mb-2 bg-clair-shadow-800 border border-clair-mystical-500 rounded-lg p-3 shadow-xl z-50">
                <div className="flex flex-col items-center">
                  <span className="text-xs text-clair-mystical-300 mb-2">
                    {Math.round(volume * 100)}%
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume * 100}
                    onChange={(e) => onVolumeChange(parseInt(e.target.value) / 100)}
                    className="w-24 transform -rotate-90 origin-center"
                    style={{ height: '100px' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Enable/Disable Toggle */}
          <button
            onClick={onToggle}
            className={`px-3 py-1 rounded text-sm font-bold transition-all ${
              isEnabled
                ? 'bg-clair-mystical-600 hover:bg-clair-mystical-700 text-white'
                : 'bg-clair-shadow-600 hover:bg-clair-shadow-500 text-clair-shadow-300'
            }`}
          >
            {isEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div className="text-xs text-clair-mystical-200">
        {isEnabled ? (
          <>
            <p>🎧 Harmonic drones active - wear headphones for immersion!</p>
            <p className="mt-1 text-clair-shadow-400">
              Each note plays a unique resonance frequency
            </p>
          </>
        ) : (
          <p className="text-clair-shadow-400">Audio disabled - click ON to enable resonance</p>
        )}
      </div>
    </div>
  );
}