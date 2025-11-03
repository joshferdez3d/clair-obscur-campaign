// src/migrations/addVersoTurnTracking.ts
// Migration script to add turn-based tracking to existing Verso characters

import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

export async function migrateVersoTurnTracking() {
  try {
    console.log('Starting Verso turn tracking migration...');
    
    // Get Verso character document
    const versoRef = doc(db, 'characters', 'verso');
    const versoDoc = await getDoc(versoRef);
    
    if (!versoDoc.exists()) {
      console.log('Verso character not found');
      return;
    }
    
    const data = versoDoc.data();
    const currentVersoState = data?.combatState?.versoState || {};
    
    // Check if migration is needed
    if (currentVersoState.hasUsedModulationThisTurn !== undefined && 
        currentVersoState.hasUsedPerfectPitchThisTurn !== undefined) {
      console.log('Migration already completed');
      return;
    }
    
    // Add the new properties with default values
    const updatedVersoState = {
      ...currentVersoState,
      hasUsedModulationThisTurn: false,
      hasUsedPerfectPitchThisTurn: false,
    };
    
    // Update the document
    await updateDoc(versoRef, {
      'combatState.versoState': updatedVersoState,
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Verso turn tracking migration completed successfully');
    console.log('Added properties:', {
      hasUsedModulationThisTurn: false,
      hasUsedPerfectPitchThisTurn: false
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Optional: Run this automatically when the app starts
// You can call this from your main App.tsx or index.tsx
export async function runMigrationIfNeeded() {
  const hasRunKey = 'verso_turn_tracking_migration_v1';
  
  // Check localStorage to see if we've already run this migration
  if (localStorage.getItem(hasRunKey)) {
    console.log('Verso turn tracking migration already run');
    return;
  }
  
  try {
    await migrateVersoTurnTracking();
    localStorage.setItem(hasRunKey, 'completed');
  } catch (error) {
    console.error('Failed to run migration:', error);
  }
}