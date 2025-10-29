// src/components/Verso/ModulationModal.tsx
import React, { useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import type { MusicalNote } from '../../types/verso';
import { NOTE_INFO, getAdjacentNotes } from '../../utils/harmonyDetection';

interface ModulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onModulate: (noteIndex: number, newNote: MusicalNote) => Promise<void>;
  activeNotes: MusicalNote[];
  modulationCooldown: number;
}

export function ModulationModal({
  isOpen,
  onClose,
  onModulate,
  activeNotes,
  modulationCooldown
}: ModulationModalProps) {
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<number | null>(null);
  const [isModulating, setIsModulating] = useState(false);
  
  if (!isOpen) return null;
  
  const handleModulate = async (newNote: MusicalNote) => {
    if (selectedNoteIndex === null) return;
    
    setIsModulating(true);
    try {
      await onModulate(selectedNoteIndex, newNote);
      onClose();
      setSelectedNoteIndex(null);
    } catch (error) {
      console.error('Failed to modulate:', error);
      alert(error instanceof Error ? error.message : 'Failed to modulate note');
    } finally {
      setIsModulating(false);
    }
  };
  
  const selectedNote = selectedNoteIndex !== null ? activeNotes[selectedNoteIndex] : null;
  const adjacentNotes = selectedNote ? getAdjacentNotes(selectedNote) : [];
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-clair-shadow-800 rounded-lg border-2 border-clair-mystical-500 shadow-2xl max-w-xl w-full">
        {/* Header */}
        <div className="bg-clair-mystical-700 p-4 flex items-center justify-between border-b border-clair-mystical-500">
          <div className="flex items-center">
            <RefreshCw className="w-6 h-6 mr-2 text-clair-mystical-200" />
            <h2 className="font-display text-xl font-bold text-clair-mystical-100">
              Modulation
            </h2>
          </div>
          <button
            onClick={() => {
              onClose();
              setSelectedNoteIndex(null);
            }}
            disabled={isModulating}
            className="text-clair-mystical-200 hover:text-clair-mystical-50 disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Cooldown Warning */}
          {modulationCooldown > 0 && (
            <div className="bg-red-900 bg-opacity-30 border border-red-500 rounded-lg p-3">
              <p className="text-red-200 text-sm font-bold">
                ⏳ Modulation on cooldown for {modulationCooldown} turn{modulationCooldown > 1 ? 's' : ''}!
              </p>
            </div>
          )}
          
          {activeNotes.length === 0 && (
            <div className="text-center text-clair-shadow-300 py-8">
              No notes to modulate. Use Harmonic Strike first.
            </div>
          )}
          
          {/* Step 1: Select Note */}
          {activeNotes.length > 0 && (
            <div>
              <h3 className="font-bold text-clair-mystical-200 mb-3">
                {selectedNoteIndex === null ? 'Step 1: Select note to change' : 'Selected Note'}
              </h3>
              <div className="flex gap-3">
                {activeNotes.map((note, index) => {
                  const info = NOTE_INFO[note];
                  const isSelected = selectedNoteIndex === index;
                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedNoteIndex(index)}
                      disabled={isModulating || modulationCooldown > 0}
                      className={`flex-1 py-4 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        isSelected
                          ? 'ring-4 ring-clair-gold-400 scale-105'
                          : 'hover:scale-105'
                      }`}
                      style={{
                        backgroundColor: `${info.color}20`,
                        borderColor: isSelected ? '#fbbf24' : info.color
                      }}
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-3xl mb-1">{info.emoji}</span>
                        <span className="font-bold text-lg" style={{ color: info.color }}>
                          {info.note}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Step 2: Choose Adjacent Note */}
          {selectedNote && (
            <div>
              <h3 className="font-bold text-clair-mystical-200 mb-3">
                Step 2: Choose adjacent note
              </h3>
              <p className="text-sm text-clair-mystical-300 mb-3">
                You can change <span style={{ color: NOTE_INFO[selectedNote].color }} className="font-bold">{selectedNote}</span> to an adjacent note:
              </p>
              <div className="flex gap-3 justify-center">
                {adjacentNotes.map((note) => {
                  const info = NOTE_INFO[note];
                  return (
                    <button
                      key={note}
                      onClick={() => handleModulate(note)}
                      disabled={isModulating || modulationCooldown > 0}
                      className="w-32 py-4 rounded-lg border-2 hover:scale-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      style={{
                        backgroundColor: `${info.color}20`,
                        borderColor: info.color
                      }}
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-3xl mb-1">{info.emoji}</span>
                        <span className="font-bold text-lg" style={{ color: info.color }}>
                          {info.note}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-clair-shadow-300 text-center mt-3">
                This will trigger a 3-turn cooldown
              </p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="bg-clair-shadow-700 p-4 border-t border-clair-shadow-600 flex justify-end gap-2">
          {selectedNoteIndex !== null && (
            <button
              onClick={() => setSelectedNoteIndex(null)}
              disabled={isModulating}
              className="bg-clair-shadow-600 hover:bg-clair-shadow-500 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              Back
            </button>
          )}
          <button
            onClick={() => {
              onClose();
              setSelectedNoteIndex(null);
            }}
            disabled={isModulating}
            className="bg-clair-shadow-600 hover:bg-clair-shadow-500 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}