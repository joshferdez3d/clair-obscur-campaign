// src/components/CharacterSheet/NPCTabSystem.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { User, Users } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useNPCTurn } from '../../hooks/useNPCTurn';
import { NPCCharacterSheet } from './NPCCharacterSheet';
import type { BattleToken } from '../../types';

// Define the NPC data type
interface NPCData {
  id: string;
  name: string;
  currentHP: number;
  maxHP: number;
  level: number;
}

interface NPCTabSystemProps {
  characterId: string;
  characterName: string;
  sessionId?: string;
  isGM?: boolean;
  children: React.ReactNode;
  // Add props for combat integration
  availableEnemies?: any[];
  availableAllies?: any[];
  session?: any;
  isMyTurn?: boolean;
  combatActive?: boolean;
  playerPosition?: { x: number; y: number };
}

export function NPCTabSystem({ 
  characterId, 
  characterName, 
  sessionId = 'default-session',
  isGM = false,
  children,
  availableEnemies = [],
  availableAllies = [],
  session,
  isMyTurn = false,
  combatActive = false,
  playerPosition = { x: 0, y: 0 },
}: NPCTabSystemProps) {
  const [activeTab, setActiveTab] = useState<'main' | 'npc'>('main');
  const [npcData, setNpcData] = useState<NPCData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [autoSwitchEnabled, setAutoSwitchEnabled] = useState(true);

  // Determine NPC type and ID
  const getNPCInfo = (): { type: string; id: string } | null => {
    if (characterId === 'maelle') {
      return { type: 'the-child', id: 'the-child' };
    }
    if (characterId === 'sciel') {
      return { type: 'farmhand', id: 'farmhand' };
    }
    if (characterId === 'gustave' && isGM) {
      return { type: 'the-child', id: 'the-child' };
    }
    return null;
  };

  const npcInfo = getNPCInfo();
  
  // Hook for NPC turn management
  const { isNPCTurn, currentTurnName } = useNPCTurn({
    sessionId: sessionId,
    characterId,
    npcId: npcInfo?.id
  });

  // Get NPC token from session by matching name
  const npcToken: BattleToken | null = useMemo(() => {
    if (!session?.tokens || !npcInfo) return null;
    
    // Map of NPC types to their display names
    const npcNameMap: { [key: string]: string } = {
      'the-child': 'The Child',
      'farmhand': 'The Farmhand'
    };
    
    const expectedName = npcNameMap[npcInfo.id];
    
    // Find the token by name instead of by ID
    const tokenEntry = Object.entries(session.tokens).find(([_, token]: [string, any]) => 
      token?.type === 'npc' && token?.name === expectedName
    );
    
    return tokenEntry ? tokenEntry[1] as BattleToken : null;
  }, [session?.tokens, npcInfo?.id]);

  // Auto-switch to NPC tab when their turn starts
  useEffect(() => {
    if (isNPCTurn && autoSwitchEnabled) {
      // Only switch if we're not already on the NPC tab
      if (activeTab !== 'npc') {
        setActiveTab('npc');
        console.log(`🔄 Auto-switched to ${currentTurnName}'s tab`);
      }
    }
  }, [isNPCTurn, autoSwitchEnabled, currentTurnName]); // Remove activeTab from dependencies

  // Initialize NPC data
  useEffect(() => {
    if (!npcInfo) return;
    
    // Only update if we have a token or need to show the tab
    setNpcData((prevData: NPCData | null) => {
      const newData = {
        id: npcInfo.id,
        name: npcInfo.id === 'the-child' ? 'The Child' : 'The Farmhand',
        currentHP: npcToken?.hp ?? 14,
        maxHP: npcToken?.maxHp ?? 14,
        level: 0,
      };
      
      // Prevent unnecessary updates
      if (prevData && JSON.stringify(prevData) === JSON.stringify(newData)) {
        return prevData;
      }
      
      return newData;
    });
  }, [npcInfo?.id, npcToken?.hp, npcToken?.maxHp]);

  // Handle HP changes
  const handleHPChange = async (newHP: number) => {
    if (!npcData || !sessionId || !npcInfo) return;

    setIsLoading(true);
    try {
      const updatedNPC = {
        ...npcData,
        currentHP: Math.max(0, Math.min(newHP, npcData.maxHP)),
      };
      setNpcData(updatedNPC);

      // Update in Firebase - find the actual token ID
      if (npcToken?.id) {
        const sessionRef = doc(db, 'battleSessions', sessionId);
        await updateDoc(sessionRef, {
          [`tokens.${npcToken.id}.hp`]: updatedNPC.currentHP,
        });
      }
    } catch (error) {
      console.error('Error updating NPC HP:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle level changes (GM only)
  const handleLevelChange = async (newLevel: number) => {
    if (!npcData || !isGM || !sessionId || !npcInfo) return;

    setIsLoading(true);
    try {
      // Update NPC level
      setNpcData({
        ...npcData,
        level: newLevel
      });

      // Update in Firebase
      const sessionRef = doc(db, 'battleSessions', sessionId);
      await updateDoc(sessionRef, {
        [`npcLevels.${npcInfo.type}`]: newLevel,
      });
    } catch (error) {
      console.error('Error updating NPC level:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // If character can't control NPCs, just render children
  if (!npcInfo) {
    return <>{children}</>;
  }

  // If we don't have NPC data yet, show loading state with tabs
  if (!npcData) {
    return (
      <div className="min-h-screen bg-clair-shadow-900">
        <div className="bg-clair-shadow-800 border-b border-clair-gold-600">
          <div className="flex">
            <button
              onClick={() => setActiveTab('main')}
              className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-all ${
                activeTab === 'main'
                  ? 'bg-gradient-to-br from-clair-royal-600 to-clair-royal-800 text-white border-b-2 border-clair-gold-500'
                  : 'text-gray-400 hover:text-white hover:bg-clair-shadow-700'
              }`}
            >
              <User className="w-5 h-5" />
              <span className="font-bold">{characterName}</span>
            </button>
            <button
              onClick={() => setActiveTab('npc')}
              className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-all ${
                activeTab === 'npc'
                  ? 'bg-gradient-to-br from-clair-mystical-600 to-clair-mystical-800 text-white border-b-2 border-clair-gold-500'
                  : 'text-gray-400 hover:text-white hover:bg-clair-shadow-700'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="font-bold">
                {npcInfo.id === 'the-child' ? 'The Child' : 'The Farmhand'}
              </span>
            </button>
          </div>
        </div>
        {activeTab === 'main' ? children : (
          <div className="p-4 text-center text-clair-gold-300">
            Waiting for NPC to be placed on battlefield...
          </div>
        )}
      </div>
    );
  }

  // Normal render with NPC data
  return (
    <div className="min-h-screen bg-clair-shadow-900">
      
      {/* Auto-switch toggle */}
      {npcData && (
        <div className="bg-clair-shadow-800 px-4 py-2 border-b border-clair-gold-600">
          <label className="flex items-center space-x-2 text-sm text-clair-gold-300">
            <input
              type="checkbox"
              checked={autoSwitchEnabled}
              onChange={(e) => setAutoSwitchEnabled(e.target.checked)}
              className="rounded"
            />
            <span>Auto-switch tabs when {npcData.name}'s turn starts</span>
          </label>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-clair-shadow-800 border-b border-clair-gold-600">
        <div className="flex">
          <button
            onClick={() => setActiveTab('main')}
            className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-all ${
              activeTab === 'main'
                ? 'bg-gradient-to-br from-clair-royal-600 to-clair-royal-800 text-white border-b-2 border-clair-gold-500'
                : 'text-gray-400 hover:text-white hover:bg-clair-shadow-700'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="font-bold">{characterName}</span>
          </button>
          <button
            onClick={() => setActiveTab('npc')}
            className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-all ${
              activeTab === 'npc'
                ? 'bg-gradient-to-br from-clair-mystical-600 to-clair-mystical-800 text-white border-b-2 border-clair-gold-500'
                : 'text-gray-400 hover:text-white hover:bg-clair-shadow-700'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="font-bold">{npcData.name}</span>
            {isNPCTurn && (
              <span className="ml-2 bg-green-500 text-white text-xs px-2 py-1 rounded animate-pulse">
                ACTIVE
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'main' ? (
        children
      ) : (
        <NPCCharacterSheet
          npc={npcData}
          sessionId={sessionId}
          isNPCTurn={isNPCTurn}
          onHPChange={handleHPChange}
          onLevelChange={isGM ? handleLevelChange : undefined}
          isLoading={isLoading}
          availableEnemies={availableEnemies}
          availableAllies={availableAllies}
          npcToken={npcToken}
        />
      )}
    </div>
  );
}

export default NPCTabSystem;