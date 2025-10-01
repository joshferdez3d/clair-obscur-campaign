// src/components/CharacterSheet/NPCTabSystem.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { User, Users } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useNPCTurn } from '../../hooks/useNPCTurn';
import { NPCCharacterSheet } from './NPCCharacterSheet';
import type { BattleToken } from '../../types';
import { FirestoreService } from '../../services/firestoreService';
import { ProtectionService } from '../../services/ProtectionService';

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
  const getNPCInfo = (): { type: string; id: string; levelKey: 'newRecruit' | 'farmhand' } | null => {
    if (characterId === 'maelle' || characterId === 'gustave') {
      return { type: 'the-child', id: 'the-child', levelKey: 'newRecruit' };
    }
    if (characterId === 'sciel') {
      return { type: 'farmhand', id: 'farmhand', levelKey: 'farmhand' };
    }
    return null;
  };
  const npcInfo = getNPCInfo();

  // Get the level from session's npcLevels
  const npcLevel = useMemo(() => {
    if (!session?.npcLevels || !npcInfo) return 1;
    return session.npcLevels[npcInfo.levelKey] || 1;
  }, [session?.npcLevels, npcInfo?.levelKey]);

  
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

  const calculatedAvailableAllies = useMemo(() => {
    if (!session?.tokens) return [];
    
    // Get all player tokens that are alive
    const allies = Object.entries(session.tokens)
      .filter(([_, token]: [string, any]) => 
        token.type === 'player' && 
        (token.hp === undefined || token.hp > 0)
      )
      .map(([_, token]) => token);
      
    console.log('📍 Available allies for reposition:', allies);
    return allies;
  }, [session?.tokens]);

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


  // Add effect to detect when Farmhand's turn starts and remove old buff
  useEffect(() => {
    const handleFarmhandTurnStart = async () => {
      if (isNPCTurn && npcInfo?.id === 'farmhand' && sessionId) {
        const currentSession = await FirestoreService.getBattleSession(sessionId);
        const currentRound = currentSession?.combatState?.round || 1;
        
        // Check if there's an active Rallying Cry buff
        const activeRallyingCry = currentSession?.activeEffects?.rallyingCry;
        
        if (activeRallyingCry) {
          const buffAppliedRound = activeRallyingCry.appliedRound || 0;
          
          // Only remove if the buff is from a previous round
          if (buffAppliedRound < currentRound) {
            await FirestoreService.removeRallyingCryBuff(sessionId);
            console.log(`🛡️ Farmhand turn (Round ${currentRound}) - Rallying Cry from Round ${buffAppliedRound} removed`);
          } else {
            console.log(`🛡️ Farmhand turn (Round ${currentRound}) - Rallying Cry was just applied this round, keeping it active`);
          }
        }
      }
    };
    
    if (isNPCTurn && npcInfo?.id === 'farmhand') {
      handleFarmhandTurnStart();
    }
  }, [isNPCTurn, npcInfo?.id, sessionId]);

  // Add this useEffect after the Rallying Cry cleanup
  useEffect(() => {
    const handleProtectionCleanup = async () => {
      if (isNPCTurn && sessionId && npcToken) {
        // Remove any protections this NPC is providing
        await ProtectionService.removeProtectorEffects(sessionId, npcToken.id);
      }
    };

    if (isNPCTurn) {
      handleProtectionCleanup();
    }
  }, [isNPCTurn, sessionId, npcToken?.id]);

  // Apply Hearthlight healing at start of Farmhand's turn
  useEffect(() => {
    const applyHealing = async () => {
      if (isNPCTurn && npcInfo?.id === 'farmhand' && sessionId && npcToken) {
        await FirestoreService.applyHearthlightHealing(sessionId, npcToken.id);
      }
    };
    
    if (isNPCTurn && npcInfo?.id === 'farmhand') {
      applyHealing();
    }
  }, [isNPCTurn, npcInfo?.id, sessionId, npcToken?.id]);


  // Initialize NPC data with correct level and HP based on level
  useEffect(() => {
    if (!npcInfo) return;
    
    // Wait for session data to be available before setting NPC data
    if (!session) {
      // Don't initialize yet - wait for session
      return;
    }
    
    // Calculate HP based on level from session
    const getHPForLevel = (baseHP: number, level: number): number => {
      if (npcInfo.id === 'the-child') {
        const hpByLevel = [14, 25, 35];
        return hpByLevel[level - 1] || baseHP;
      } else {
        const hpByLevel = [30, 40, 50];
        return hpByLevel[level - 1] || baseHP;
      }
    };
    
    // Use npcLevel which comes from session.npcLevels
    const maxHPForLevel = getHPForLevel(npcToken?.maxHp ?? 14, npcLevel);
    
    setNpcData((prevData: NPCData | null) => {
      const newData = {
        id: npcInfo.id,
        name: npcInfo.id === 'the-child' ? 'The Child' : 'The Farmhand',
        currentHP: npcToken?.hp ?? maxHPForLevel,
        maxHP: maxHPForLevel,
        level: npcLevel, // This now properly uses the level from session
      };
      
      // Only update if data actually changed
      if (prevData && JSON.stringify(prevData) === JSON.stringify(newData)) {
        return prevData;
      }
      
      return newData;
    });
  }, [npcInfo?.id, npcToken?.hp, npcToken?.maxHp, npcLevel, session])

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

  const handleLevelChange = async (newLevel: number) => {
    if (!npcData || !isGM || !sessionId || !npcInfo) return;

    setIsLoading(true);
    try {
      // Calculate new HP based on level - DON'T use current token's maxHP as base
      const getHPForLevel = (level: number): number => {
        if (npcInfo.id === 'the-child') {
          const hpByLevel = [14, 25, 35];
          return hpByLevel[level - 1] || 14;
        } else {
          const hpByLevel = [30, 40, 50];
          return hpByLevel[level - 1] || 30;
        }
      };
      
      // Get the new max HP for this level directly
      const newMaxHP = getHPForLevel(newLevel);
      
      // Update the level in Firestore
      const levels = {
        newRecruit: npcInfo.levelKey === 'newRecruit' ? newLevel : session?.npcLevels?.newRecruit || 1,
        farmhand: npcInfo.levelKey === 'farmhand' ? newLevel : session?.npcLevels?.farmhand || 1,
      };
      
      await FirestoreService.updateNPCLevels(sessionId, levels);
      
      // Also update the token's HP if it exists
      if (npcToken?.id) {
        const sessionRef = doc(db, 'battleSessions', sessionId);
        
        // Calculate proportional HP (maintain HP ratio) or heal to full on level up
        // Option 1: Maintain HP ratio
        // const hpRatio = npcData.currentHP / npcData.maxHP;
        // const newCurrentHP = Math.floor(newMaxHP * hpRatio);
        
        // Option 2: Heal to full on level up (recommended for level increases)
        const newCurrentHP = newLevel > npcData.level 
          ? newMaxHP  // Full heal on level up
          : Math.min(npcData.currentHP, newMaxHP);  // Keep current HP if leveling down
        
        await updateDoc(sessionRef, {
          [`tokens.${npcToken.id}.maxHp`]: newMaxHP,
          [`tokens.${npcToken.id}.hp`]: newCurrentHP,
        });
        
        console.log(`✅ Updated ${npcData.name} to Level ${newLevel}: ${newCurrentHP}/${newMaxHP} HP`);
        
        // Update local state
        setNpcData({
          ...npcData,
          level: newLevel,
          maxHP: newMaxHP,
          currentHP: newCurrentHP
        });
      } else {
        // Just update local state if no token yet
        setNpcData({
          ...npcData,
          level: newLevel,
          maxHP: newMaxHP,
          currentHP: newMaxHP  // Start at full HP when no token exists
        });
        
        console.log(`✅ Updated ${npcData.name} to Level ${newLevel} (no token yet)`);
      }
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
          availableAllies={calculatedAvailableAllies}  // Use calculated value
          npcToken={npcToken}
          session={session}  // ADD THIS LINE if not already there
        />
      )}
    </div>
  );
}

export default NPCTabSystem;