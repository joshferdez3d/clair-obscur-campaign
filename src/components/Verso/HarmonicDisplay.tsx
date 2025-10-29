// src/components/Verso/HarmonicDisplay.tsx
import React from 'react';
import { Music, Sparkles } from 'lucide-react';
import type { MusicalNote } from '../../types/versoType';
import { NOTE_INFO, getHarmonyEffect } from '../../utils/harmonyDetection';

interface HarmonicDisplayProps {
  activeNotes: MusicalNote[];
  songOfAliciaActive: boolean;
}

export function HarmonicDisplay({ activeNotes, songOfAliciaActive }: HarmonicDisplayProps) {
  const harmonyEffect = getHarmonyEffect(activeNotes);
  
  return (
    <div className="bg-clair-shadow-700 rounded-lg p-4 mb-4 border border-clair-mystical-500">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg font-bold text-clair-mystical-300 flex items-center">
          <Music className="w-5 h-5 mr-2" />
          Active Notes
        </h3>
        <span className="text-sm text-clair-mystical-300">
          {activeNotes.length}/3
        </span>
      </div>
      
      {/* Note Display */}
      <div className="flex gap-2 mb-4">
        {[0, 1, 2].map((index) => {
          const note = activeNotes[index];
          const noteInfo = note ? NOTE_INFO[note] : null;
          
          return (
            <div
              key={index}
              className={`flex-1 h-16 rounded-lg border-2 flex items-center justify-center font-bold text-xl transition-all ${
                noteInfo
                  ? 'border-clair-mystical-400 shadow-lg'
                  : 'border-clair-shadow-500 border-dashed'
              }`}
              style={{
                backgroundColor: noteInfo ? `${noteInfo.color}20` : 'transparent',
                borderColor: noteInfo ? noteInfo.color : undefined
              }}
            >
              {noteInfo && (
                <div className="flex flex-col items-center">
                  <span className="text-2xl">{noteInfo.emoji}</span>
                  <span style={{ color: noteInfo.color }}>{noteInfo.note}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Harmony Detection */}
      {harmonyEffect && (
        <div
          className="p-3 rounded-lg border-2 animate-pulse"
          style={{
            backgroundColor: `${harmonyEffect.color}10`,
            borderColor: harmonyEffect.color
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center">
              <span className="text-xl mr-2">{harmonyEffect.emoji}</span>
              <span className="font-bold" style={{ color: harmonyEffect.color }}>
                {harmonyEffect.name}
              </span>
            </div>
            {songOfAliciaActive && (
              <div className="flex items-center text-yellow-400 text-sm font-bold animate-pulse">
                <Sparkles className="w-4 h-4 mr-1" />
                2x DAMAGE
              </div>
            )}
          </div>
          <p className="text-sm text-clair-gold-200">{harmonyEffect.description}</p>
          <p className="text-xs text-clair-mystical-200 mt-1">
            <span className="font-bold">Damage:</span> {harmonyEffect.baseDamage}
            {songOfAliciaActive && <span className="text-yellow-400"> × 2</span>}
          </p>
          <p className="text-xs text-clair-mystical-200">
            <span className="font-bold">Effect:</span> {harmonyEffect.effect}
          </p>
        </div>
      )}
      
      {activeNotes.length === 0 && (
        <div className="text-center text-clair-shadow-300 text-sm py-2">
          Use Harmonic Strike to generate notes
        </div>
      )}
    </div>
  );
}