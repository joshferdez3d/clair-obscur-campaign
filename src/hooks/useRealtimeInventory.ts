// src/hooks/useRealtimeInventory.ts
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Character, InventoryItem } from '../types';

interface InventoryData {
  gold: number;
  inventory: InventoryItem[];
  loading: boolean;
  error: string | null;
}

export const useRealtimeInventory = (characterId: string): InventoryData => {
  const [inventoryData, setInventoryData] = useState<InventoryData>({
    gold: 0,
    inventory: [],
    loading: true,
    error: null
  });

  useEffect(() => {
    if (!characterId) {
      setInventoryData(prev => ({ ...prev, loading: false, error: 'No character ID provided' }));
      return;
    }

    console.log(`🔄 Setting up real-time listener for ${characterId} inventory`);
    
    const characterRef = doc(db, 'characters', characterId);
    
    const unsubscribe = onSnapshot(
      characterRef,
      (doc) => {
        if (doc.exists()) {
          const data = doc.data() as Character;
          
          setInventoryData({
            gold: data.gold || 0,
            inventory: data.inventory || [],
            loading: false,
            error: null
          });
          
          console.log(`✅ Real-time update for ${characterId}:`, {
            gold: data.gold || 0,
            inventoryCount: (data.inventory || []).length
          });
        } else {
          setInventoryData(prev => ({
            ...prev,
            loading: false,
            error: 'Character not found'
          }));
        }
      },
      (error) => {
        console.error(`❌ Error in real-time listener for ${characterId}:`, error);
        setInventoryData(prev => ({
          ...prev,
          loading: false,
          error: error.message
        }));
      }
    );

    // Cleanup function
    return () => {
      console.log(`🔌 Disconnecting real-time listener for ${characterId}`);
      unsubscribe();
    };
  }, [characterId]);

  return inventoryData;
};