// src/components/Verso/NoteGenerationModal.tsx
import React, { useState } from 'react';
import { X, Music, Sparkles, Zap } from 'lucide-react';
import type { MusicalNote } from '../../types/versoType';
import { NOTE_INFO, getAllNotes } from '../../utils/harmonyDetection';

interface NoteGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerateRandom: () => Promise<void>;
  onChooseNote: (note: MusicalNote) => Promise<void>;
  perfectPitchCharges: number;
  activeNotes: MusicalNote[];
}

export function NoteGenerationModal({
  isOpen,
  onClose,
  onGenerateRandom,
  onChooseNote,
  perfectPitchCharges,
  activeNotes
}: NoteGenerationModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const allNotes = getAllNotes();
  
  if (!isOpen) return null;
  
  const handleGenerateRandom = async () => {
    setIsGenerating(true);
    try {
      await onGenerateRandom();
      onClose();
    } catch (error) {
      console.error('Failed to generate note:', error);
      alert(error instanceof Error ? error.message : 'Failed to generate note');
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleChooseNote = async (note: MusicalNote) => {
    if (perfectPitchCharges <= 0) {
      alert('No Perfect Pitch charges remaining!');
      return;
    }
    
    setIsGenerating(true);
    try {
      await onChooseNote(note);
      onClose();
    } catch (error) {
      console.error('Failed to choose note:', error);
      alert(error instanceof Error ? error.message : 'Failed to choose note');
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-clair-shadow-800 rounded-lg border-2 border-clair-mystical-500 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-clair-mystical-700 p-4 flex items-center justify-between border-b border-clair-mystical-500">
          <div className="flex items-center">
            <Music className="w-6 h-6 mr-2 text-clair-mystical-200" />
            <h2 className="font-display text-xl font-bold text-clair-mystical-100">
              Generate Note
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="text-clair-mystical-200 hover:text-clair-mystical-50 disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current Notes */}
          <div>
            <h3 className="font-bold text-clair-mystical-200 mb-2">Current Notes ({activeNotes.length}/3)</h3>
            <div className="flex gap-2">
              {activeNotes.length > 0 ? (
                activeNotes.map((note, i) => {
                  const info = NOTE_INFO[note];
                  return (
                    <div
                      key={i}
                      className="px-4 py-2 rounded-lg border-2 flex items-center gap-2"
                      style={{
                        backgroundColor: `${info.color}20`,
                        borderColor: info.color
                      }}
                    >
                      <span className="text-xl">{info.emoji}</span>
                      <span className="font-bold" style={{ color: info.color }}>
                        {info.note}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-clair-shadow-300 text-sm">No notes yet</div>
              )}
            </div>
          </div>
          
          {/* Random Generation */}
          <div className="bg-clair-shadow-700 rounded-lg p-4 border border-clair-gold-600">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-clair-gold-300 flex items-center">
                  <Zap className="w-5 h-5 mr-2" />
                  Random Note (1d7)
                </h3>
                <p className="text-sm text-clair-gold-200 mt-1">
                  Roll a 7-sided die to generate a random note
                </p>
              </div>
            </div>
            <button
              onClick={handleGenerateRandom}
              disabled={isGenerating || activeNotes.length >= 3}
              className="w-full bg-gradient-to-r from-clair-gold-600 to-clair-gold-500 hover:from-clair-gold-500 hover:to-clair-gold-400 text-clair-shadow-900 font-bold py-3 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Rolling...' : 'Roll 1d7 for Random Note'}
            </button>
          </div>
          
          {/* Perfect Pitch */}
          <div className="bg-clair-shadow-700 rounded-lg p-4 border border-clair-mystical-500">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-clair-mystical-300 flex items-center">
                  <Sparkles className="w-5 h-5 mr-2" />
                  Perfect Pitch
                </h3>
                <p className="text-sm text-clair-mystical-200 mt-1">
                  Choose a specific note (costs 1 charge)
                </p>
              </div>
              <div className="text-clair-mystical-300 font-bold">
                {perfectPitchCharges}/3 charges
              </div>
            </div>
            
            {perfectPitchCharges > 0 ? (
              <div className="grid grid-cols-7 gap-2">
                {allNotes.map((note) => {
                  const info = NOTE_INFO[note];
                  return (
                    <button
                      key={note}
                      onClick={() => handleChooseNote(note)}
                      disabled={isGenerating || activeNotes.length >= 3}
                      className="aspect-square rounded-lg border-2 hover:scale-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      style={{
                        backgroundColor: `${info.color}20`,
                        borderColor: info.color
                      }}
                      title={`Choose ${note}`}
                    >
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-2xl">{info.emoji}</span>
                        <span className="text-sm font-bold" style={{ color: info.color }}>
                          {note}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-clair-shadow-300 text-sm py-4">
                No Perfect Pitch charges remaining. Complete a long rest to restore.
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="bg-clair-shadow-700 p-4 border-t border-clair-shadow-600 flex justify-end">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="bg-clair-shadow-600 hover:bg-clair-shadow-500 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}