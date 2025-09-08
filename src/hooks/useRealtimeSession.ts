// src/hooks/useRealtimeSession.ts - Real-time session updates
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

interface RealtimeSessionState {
  isConnected: boolean;
  lastUpdate: number | null;
  error: string | null;
}

export function useRealtimeSession(sessionId: string): RealtimeSessionState {
  const [state, setState] = useState<RealtimeSessionState>({
    isConnected: false,
    lastUpdate: null,
    error: null,
  });

  useEffect(() => {
    if (!sessionId) {
      setState({
        isConnected: false,
        lastUpdate: null,
        error: 'No session ID provided',
      });
      return;
    }

    const sessionRef = doc(db, 'sessions', sessionId);
    
    // Set up real-time listener
    const unsubscribe = onSnapshot(
      sessionRef,
      (doc) => {
        if (doc.exists()) {
          setState({
            isConnected: true,
            lastUpdate: Date.now(),
            error: null,
          });
          console.log('Session updated:', doc.data());
        } else {
          setState({
            isConnected: false,
            lastUpdate: null,
            error: 'Session not found',
          });
        }
      },
      (error) => {
        console.error('Session listener error:', error);
        setState({
          isConnected: false,
          lastUpdate: null,
          error: error.message,
        });
      }
    );

    // Initial connection state
    setState(prev => ({
      ...prev,
      isConnected: true,
      error: null,
    }));

    // Cleanup listener on unmount
    return () => {
      unsubscribe();
      setState({
        isConnected: false,
        lastUpdate: null,
        error: null,
      });
    };
  }, [sessionId]);

  return state;
}