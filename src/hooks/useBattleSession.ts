import { useState, useEffect } from 'react';
import { FirestoreService } from '../services/firestoreService';
import type { BattleSession, BattleToken, Position } from '../types';

export function useBattleSession(sessionId: string) {
  const [session, setSession] = useState<BattleSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Subscribe to real-time updates
    const unsubscribe = FirestoreService.subscribeToBattleSession(
      sessionId,
      (updatedSession) => {
        setSession(updatedSession);
        setLoading(false);
        if (!updatedSession) {
          setError(`Battle session ${sessionId} not found`);
        }
      }
    );

    return () => unsubscribe();
  }, [sessionId]);

  const moveToken = async (tokenId: string, position: Position): Promise<boolean> => {
    try {
      await FirestoreService.updateTokenPosition(sessionId, tokenId, position);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move token');
      return false;
    }
  };

  const addToken = async (token: BattleToken) => {
    try {
      await FirestoreService.addToken(sessionId, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add token');
    }
  };

  const removeToken = async (tokenId: string) => {
    try {
      await FirestoreService.removeToken(sessionId, tokenId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove token');
    }
  };

  return {
    session,
    loading,
    error,
    moveToken,
    addToken,
    removeToken
  };
}