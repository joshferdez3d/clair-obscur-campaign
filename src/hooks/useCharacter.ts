import { useState, useEffect } from 'react';
import { FirestoreService } from '../services/firestoreService';
import type { Character, Stance } from '../types';

export function useCharacter(characterId: string) {
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!characterId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Subscribe to real-time updates
    const unsubscribe = FirestoreService.subscribeToCharacter(
      characterId,
      (updatedCharacter) => {
        setCharacter(updatedCharacter);
        setLoading(false);
        if (!updatedCharacter) {
          setError(`Character ${characterId} not found`);
        }
      }
    );

    return () => unsubscribe();
  }, [characterId]);

  const updateHP = async (newHP: number) => {
    if (!character) return;

    try {
      await FirestoreService.updateCharacterHP(characterId, newHP);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update HP');
    }
  };

  const changeHP = async (delta: number) => {
    if (!character) return;
    await updateHP(character.currentHP + delta);
  };

  const updateStance = async (stance: Stance) => {
    try {
      await FirestoreService.updateCharacterStance(characterId, stance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update stance');
    }
  };

  const updateCharges = async (charges: number) => {
    if (!character) return;

    const maxCharges = character.maxCharges || 3;
    const clampedCharges = Math.min(Math.max(0, charges), maxCharges);

    try {
      await FirestoreService.updateCharacterCharges(characterId, clampedCharges);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update charges');
    }
  };

  const changeCharges = async (delta: number) => {
    if (!character) return;
    await updateCharges((character.charges || 0) + delta);
  };

  return {
    character,
    loading,
    error,
    updateHP,
    changeHP,
    updateStance,
    updateCharges,
    changeCharges
  };
}