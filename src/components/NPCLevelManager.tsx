import React, { useState } from 'react';
import { FirestoreService } from '../services/firestoreService';

interface NPCLevelManagerProps {
  sessionId: string;
  currentLevels: {
    theChild: number;  // Changed from newRecruit
    farmhand: number;
  };
}

const NPCLevelManager: React.FC<NPCLevelManagerProps> = ({ sessionId, currentLevels }) => {
  const [levels, setLevels] = useState(currentLevels);
  const [loading, setLoading] = useState(false);

  // NPC Progression Definitions - Updated naming
  const THE_CHILD_PROGRESSION = {  // Renamed from NEW_RECRUIT_PROGRESSION
    1: {
      name: "The Child - Level 1",  // Updated name
      abilities: ["Dagger Throw", "Reposition"],  // Updated to match actual abilities
      hp: 14,
      damage: "4 (fixed)",
      description: "Basic dagger throw (4 damage) with reposition ability"
    },
    2: {
      name: "The Child - Level 2",
      abilities: ["Dagger Throw (1d6)", "Pinning Throw", "Reposition"],
      hp: 25,  // Corrected HP progression
      damage: "1d6",
      description: "Upgraded dagger (1d6), gains 'Pinning Throw' (slows target)"
    },
    3: {
      name: "The Child - Level 3",
      abilities: ["Dagger Throw (1d8)", "Pinning Throw (Restrain)", "For My Brother!", "Reposition"],
      hp: 35,  // Corrected HP progression
      damage: "1d8",
      description: "Enhanced dagger (1d8), upgraded pin (restrains), unlock 'For My Brother!' ultimate"
    }
  };

  const FARMHAND_PROGRESSION = {
    1: {
      name: "The Farmhand - Level 1",  // Updated name for consistency
      abilities: ["Pitchfork Jab", "Rallying Cry"],
      hp: 30,
      damage: "1d8",
      description: "Gain 'Rallying Cry' ability (allies gain +1 AC for 1 round)"
    },
    2: {
      name: "The Farmhand - Level 2",
      abilities: ["Pitchfork Jab", "Rallying Cry", "Interpose"],
      hp: 40,
      damage: "1d10",
      description: "Upgrade Pitchfork to 1d10, gain 'Interpose' (redirect attack to self)"
    },
    3: {
      name: "The Farmhand - Level 3",
      abilities: ["Pitchfork Jab", "Rallying Cry", "Interpose", "Hearthlight"],
      hp: 50,
      damage: "1d10",
      description: "Unlock 'Hearthlight' healing ability (2d4 HP to ally)"
    }
  };

  const handleLevelChange = async (npcType: 'theChild' | 'farmhand', newLevel: number) => {
    setLoading(true);
    try {
      const updatedLevels = { ...levels, [npcType]: newLevel };
      
      // Map the internal names to the old Firebase keys for backward compatibility
      const firebaseLevels = {
        newRecruit: npcType === 'theChild' ? newLevel : updatedLevels.theChild,
        farmhand: npcType === 'farmhand' ? newLevel : updatedLevels.farmhand
      };
      
      await FirestoreService.updateNPCLevels(sessionId, firebaseLevels);
      setLevels(updatedLevels);
      
      // Show feedback with correct names
      const npcName = npcType === 'theChild' ? 'The Child' : 'The Farmhand';
      console.log(`✅ ${npcName} leveled to ${newLevel}`);
    } catch (error) {
      console.error('Failed to update NPC level:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-clair-shadow-700 border border-clair-gold-600 rounded-lg p-4">
      <h3 className="text-lg font-bold text-clair-gold-400 mb-4">NPC Level Management</h3>
      
      {/* The Child Controls (formerly New Recruit) */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-clair-gold-300 font-semibold">The Child (Controlled by Gustave/Maelle)</h4>
          <select
            value={levels.theChild}
            onChange={(e) => handleLevelChange('theChild', Number(e.target.value))}
            disabled={loading}
            className="bg-clair-shadow-800 text-clair-gold-300 border border-clair-gold-600 rounded px-3 py-1"
          >
            <option value={1}>Level 1</option>
            <option value={2}>Level 2</option>
            <option value={3}>Level 3</option>
          </select>
        </div>
        <div className="text-sm text-clair-gold-200 bg-clair-shadow-800 rounded p-2">
          {THE_CHILD_PROGRESSION[levels.theChild as 1|2|3].description}
        </div>
        <div className="text-xs text-clair-gold-300 opacity-75 mt-2">
          HP: {THE_CHILD_PROGRESSION[levels.theChild as 1|2|3].hp} | 
          Damage: {THE_CHILD_PROGRESSION[levels.theChild as 1|2|3].damage}
        </div>
      </div>

      {/* Farmhand Controls */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-clair-gold-300 font-semibold">The Farmhand (Controlled by Sciel)</h4>
          <select
            value={levels.farmhand}
            onChange={(e) => handleLevelChange('farmhand', Number(e.target.value))}
            disabled={loading}
            className="bg-clair-shadow-800 text-clair-gold-300 border border-clair-gold-600 rounded px-3 py-1"
          >
            <option value={1}>Level 1</option>
            <option value={2}>Level 2</option>
            <option value={3}>Level 3</option>
          </select>
        </div>
        <div className="text-sm text-clair-gold-200 bg-clair-shadow-800 rounded p-2">
          {FARMHAND_PROGRESSION[levels.farmhand as 1|2|3].description}
        </div>
        <div className="text-xs text-clair-gold-300 opacity-75 mt-2">
          HP: {FARMHAND_PROGRESSION[levels.farmhand as 1|2|3].hp} | 
          Damage: {FARMHAND_PROGRESSION[levels.farmhand as 1|2|3].damage}
        </div>
      </div>

      {loading && (
        <div className="text-center text-clair-gold-400">
          <span className="animate-pulse">Updating...</span>
        </div>
      )}

      {/* Lore note about The Child */}
      <div className="mt-4 p-3 bg-clair-shadow-800 border border-clair-gold-600 rounded text-xs text-clair-gold-300 opacity-75">
        <strong>Note:</strong> "The Child" is the younger brother of the fallen New Recruit, 
        fighting to honor their sibling's memory with the ultimate ability "For My Brother!"
      </div>
    </div>
  );
};

export default NPCLevelManager;