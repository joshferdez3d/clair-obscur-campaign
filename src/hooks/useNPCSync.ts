import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

interface NPCData {
  'new-recruit'?: {
    currentHP: number;
    maxHP: number;
    level: number;
  };
  'farmhand'?: {
    currentHP: number;
    maxHP: number;
    level: number;
  };
}

export function useNPCSync(sessionId: string) {
  const [npcData, setNPCData] = useState<NPCData>({});
  const [npcLevels, setNPCLevels] = useState({
    'new-recruit': 0,
    'farmhand': 0,
  });

  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = onSnapshot(
      doc(db, 'sessions', sessionId),
      (snapshot) => {
        const data = snapshot.data();
        if (data?.npcData) {
          setNPCData(data.npcData);
        }
        if (data?.npcLevels) {
          setNPCLevels(data.npcLevels);
        }
      },
      (error) => {
        console.error('Error syncing NPC data:', error);
      }
    );

    return () => unsubscribe();
  }, [sessionId]);

  return { npcData, npcLevels };
}