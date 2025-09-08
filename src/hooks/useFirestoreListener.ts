// src/hooks/useFirestoreListener.ts
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

export function useFirestoreListener(sessionId: string) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const sessionRef = doc(db, 'battleSessions', sessionId);
    
    const unsubscribe = onSnapshot(
      sessionRef,
      (doc) => {
        if (doc.exists()) {
          setSession({ id: doc.id, ...doc.data() });
        } else {
          setSession(null);
          setError(`Session ${sessionId} not found`);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Firestore listener error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [sessionId]);

  return { session, loading, error };
}