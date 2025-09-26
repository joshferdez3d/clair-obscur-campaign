import React, { useState, useEffect } from 'react';
import { FirestoreService } from '../services/firestoreService';

interface NPCLevelManagerProps {
  sessionId: string;
  currentLevels: {
    newRecruit: number;
    farmhand: number;
  };
}

const NPCLevelManager: React.FC<NPCLevelManagerProps> = ({ sessionId, currentLevels }) => {
  const [levels, setLevels] = useState(currentLevels);
  const [loading, setLoading] = useState(false);

  // NPC Progression Definitions
  const NEW_RECRUIT_PROGRESSION = {
    1: {
      name: "New Recruit - Level 1",
      abilities: ["Basic Attack", "Focused Strike"],
      hp: 25,
      damage: "1d6",
      description: "Gain 'Focused Strike' ability (+2 to hit, 1d6+2 damage)"
    },
    2: {
      name: "New Recruit - Level 2", 
      abilities: ["Basic Attack", "Disciplined Slash"],
      hp: 35,
      damage: "1d8",
      description: "Upgrade to 'Disciplined Slash' (1d8 damage, can cleave)"
    },
    3: {
      name: "New Recruit - Level 3",
      abilities: ["Basic Attack", "Disciplined Slash", "For My Brother!"],
      hp: 45,
      damage: "1d8",
      description: "Unlock 'For My Brother!' ultimate (2d10 damage, advantage on attacks for 3 rounds)"
    }
  };

  const FARMHAND_PROGRESSION = {
    1: {
      name: "Farmhand - Level 1",
      abilities: ["Pitchfork Jab", "Rallying Cry"],
      hp: 30,
      damage: "1d8",
      description: "Gain 'Rallying Cry' ability (allies gain +1 AC for 1 round)"
    },
    2: {
      name: "Farmhand - Level 2",
      abilities: ["Pitchfork Jab", "Rallying Cry", "Interpose"],
      hp: 40,
      damage: "1d10",
      description: "Upgrade Pitchfork to 1d10, gain 'Interpose' (redirect attack to self)"
    },
    3: {
      name: "Farmhand - Level 3",
      abilities: ["Pitchfork Jab", "Rallying Cry", "Interpose", "Hearthlight"],
      hp: 50,
      damage: "1d10",
      description: "Unlock 'Hearthlight' healing ability (2d4 HP to ally)"
    }
  };

  const handleLevelChange = async (npcType: 'newRecruit' | 'farmhand', newLevel: number) => {
    setLoading(true);
    try {
      const updatedLevels = { ...levels, [npcType]: newLevel };
      await FirestoreService.updateNPCLevels(sessionId, updatedLevels);
      setLevels(updatedLevels);
      
      // Show feedback
      const npcName = npcType === 'newRecruit' ? 'New Recruit' : 'Farmhand';
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
      
      {/* New Recruit Controls */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-clair-gold-300 font-semibold">New Recruit (Gustave/Maelle)</h4>
          <select
            value={levels.newRecruit}
            onChange={(e) => handleLevelChange('newRecruit', Number(e.target.value))}
            disabled={loading}
            className="bg-clair-shadow-800 text-clair-gold-300 border border-clair-gold-600 rounded px-3 py-1"
          >
            <option value={1}>Level 1</option>
            <option value={2}>Level 2</option>
            <option value={3}>Level 3</option>
          </select>
        </div>
        <div className="text-sm text-clair-gold-200 bg-clair-shadow-800 rounded p-2">
          {NEW_RECRUIT_PROGRESSION[levels.newRecruit as 1|2|3].description}
        </div>
      </div>

      {/* Farmhand Controls */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-clair-gold-300 font-semibold">Farmhand (Sciel)</h4>
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
      </div>

      {loading && (
        <div className="text-center text-clair-gold-400">
          <span className="animate-pulse">Updating...</span>
        </div>
      )}
    </div>
  );
};

export default NPCLevelManager;