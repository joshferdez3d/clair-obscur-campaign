// src/components/Combat/ExpeditionNPCModal.tsx
import React, { useState } from 'react';
import { X, Users, Shield, Heart, Sword, Book, Zap, Star } from 'lucide-react';
import type { BattleToken } from '../../types';
import { generateId } from '../../utils/constants';

interface ExpeditionNPC {
  id: string;
  name: string;
  age: number;
  ac: number;
  hp: number;
  maxHp: number;
  size: number;
  color: string;
  category: string;
  bio: string;
  hook: string;
  combatStyle: string;
  traits: string[];
  controlledBy?: 'maelle' | 'sciel' | 'gm'; // Who controls this NPC
}

// UPDATED: Removed dead NPCs and renamed New Recruit to The Child
const EXPEDITION_NPCS: { [key: string]: ExpeditionNPC } = {
  'the-child': {
    id: 'the-child',
    name: 'The Child',
    age: 18,
    ac: 12,
    hp: 14,
    maxHp: 14,
    size: 1,
    color: '#22c55e',
    category: 'Young Hopefuls',
    bio: 'The younger brother of a fallen recruit. After witnessing his sibling\'s death in the landing massacre, he insists on continuing the mission to honor their memory.',
    hook: 'Forms a protective bond with Maelle, seeing her as an older sister figure. His determination despite his fear makes him endearing.',
    combatStyle: 'Eager but inexperienced - moderate damage, learning combat mechanics',
    traits: ['Determined', 'Grieving', 'Brave', 'Loyal'],
    controlledBy: 'maelle'
  },
  'farmhand': {
    id: 'farmhand',
    name: 'The Farmhand',
    age: 24,
    ac: 13,
    hp: 18,
    maxHp: 18,
    size: 1,
    color: '#84cc16',
    category: 'Common Folk',
    bio: 'Originally conscripted for labor, volunteered when no one else would from their district. Carries a pitchfork, relies on raw strength.',
    hook: 'Offers camaraderie to Sciel, highlighting her protective instincts.',
    combatStyle: 'Brutal strength - high HP and damage, lower defenses',
    traits: ['Strong', 'Determined', 'Crude Fighting', 'Loyal'],
    controlledBy: 'sciel'
  },
  'veteran': {
    id: 'veteran',
    name: 'The Veteran',
    age: 32,
    ac: 16,
    hp: 35,
    maxHp: 35,
    size: 1,
    color: '#64748b',
    category: 'Battle-Hardened',
    bio: 'Volunteered for multiple expeditions but was turned down until desperation made the council accept them. Scarred in body and spirit.',
    hook: 'Offers advice to PCs; their grim fatalism contrasts with the hope of younger members.',
    combatStyle: 'Defensive fighter - high AC and HP, tactical knowledge',
    traits: ['Battle-Scarred', 'Fatalistic', 'Experienced', 'Protective'],
    controlledBy: 'gm'
  },
  'lost-lover': {
    id: 'lost-lover',
    name: 'The Lost Lover',
    age: 31,
    ac: 13,
    hp: 26,
    maxHp: 26,
    size: 1,
    color: '#6b7280',
    category: 'Grief-Stricken',
    bio: 'Joined after losing their partner in the last Gommage. Speaks little, carries a keepsake they touch constantly.',
    hook: 'Mirrors Gustave\'s pain about Sophie, deepening his arc through dialogue.',
    combatStyle: 'Quiet determination - moderate stats, fights with suppressed rage',
    traits: ['Grieving', 'Stoic', 'Determined', 'Haunted'],
    controlledBy: 'gm'
  },
  'child-of-gommage': {
    id: 'child-of-gommage',
    name: 'The Child of the Gommage',
    age: 19,
    ac: 11,
    hp: 22,
    maxHp: 22,
    size: 1,
    color: '#ef4444',
    category: 'Vengeful',
    bio: 'Their parents vanished in front of them only a year ago. Volunteered not out of duty but vengeance. Impulsive, fierce, and naive to strategy.',
    hook: 'Can connect emotionally with Maelle, both orphans of the Gommage.',
    combatStyle: 'Reckless aggression - high damage potential, poor defense and tactics',
    traits: ['Vengeful', 'Impulsive', 'Fierce', 'Traumatized'],
    controlledBy: 'gm'
  }
};

// UPDATED: Removed references to dead NPCs
const EXPEDITION_CATEGORIES = {
  'Young Hopefuls': ['the-child', 'child-of-gommage'],
  'Battle-Hardened': ['veteran'],
  'Grief-Stricken': ['lost-lover'],
  'Common Folk': ['farmhand'],
  'Vengeful': ['child-of-gommage']
};

interface ExpeditionNPCModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNPC: (npcToken: BattleToken) => void;
}

export function ExpeditionNPCModal({ isOpen, onClose, onSelectNPC }: ExpeditionNPCModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('Young Hopefuls');
  const [selectedNPC, setSelectedNPC] = useState<ExpeditionNPC | null>(null);

  if (!isOpen) return null;

  const handleNPCSelect = (npcId: string) => {
    const npc = EXPEDITION_NPCS[npcId];
    if (npc) {
      setSelectedNPC(npc);
    }
  };

  const handleConfirmSelection = () => {
    if (selectedNPC) {
      // Create a battle token from the expedition NPC
      const npcToken: BattleToken = {
        id: generateId('npc'),
        name: selectedNPC.name,
        position: { x: 5, y: 5 }, // Default position - GM will place on map
        type: 'npc',
        hp: selectedNPC.hp,
        maxHp: selectedNPC.maxHp,
        size: selectedNPC.size,
        color: selectedNPC.color,
        ac: selectedNPC.ac,
        // Add controller information for turn management
        controlledBy: selectedNPC.controlledBy,
      };

      onSelectNPC(npcToken);
      setSelectedNPC(null);
      onClose();
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Young Hopefuls': return Star;
      case 'Battle-Hardened': return Shield;
      case 'Grief-Stricken': return Heart;
      case 'Common Folk': return Users;
      case 'Vengeful': return Sword;
      default: return Users;
    }
  };

  const getHPColor = (hp: number) => {
    if (hp >= 30) return 'text-green-400';
    if (hp >= 20) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const getAgeColor = (age: number) => {
    if (age < 20) return 'text-green-300';
    if (age < 30) return 'text-yellow-300';
    return 'text-orange-300';
  };

  const getControllerBadge = (controller?: string) => {
    switch (controller) {
      case 'maelle':
        return <span className="ml-2 text-xs bg-clair-royal-600 px-2 py-1 rounded">Maelle Controls</span>;
      case 'sciel':
        return <span className="ml-2 text-xs bg-green-600 px-2 py-1 rounded">Sciel Controls</span>;
      default:
        return <span className="ml-2 text-xs bg-gray-600 px-2 py-1 rounded">GM Controls</span>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-clair-shadow-800 border border-clair-gold-600 rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl font-bold text-clair-gold-400">
              Expedition 33 - Living Members
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Session 1: After the Landing Massacre
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-clair-gold-300 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Category Selection */}
          <div className="lg:col-span-1">
            <h3 className="font-display text-lg font-bold text-clair-gold-400 mb-3">Archetypes</h3>
            <div className="space-y-2">
              {Object.keys(EXPEDITION_CATEGORIES).map((category) => {
                const Icon = getCategoryIcon(category);
                const isSelected = selectedCategory === category;
                const hasNPCs = EXPEDITION_CATEGORIES[category as keyof typeof EXPEDITION_CATEGORIES].length > 0;
                
                if (!hasNPCs) return null; // Don't show empty categories
                
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`w-full flex items-center p-3 rounded-lg transition-all text-sm ${
                      isSelected
                        ? 'bg-clair-gold-600 text-clair-shadow-900'
                        : 'bg-clair-shadow-700 text-clair-gold-300 hover:bg-clair-shadow-600'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="font-bold text-left">{category}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* NPC List */}
          <div className="lg:col-span-1">
            <h3 className="font-display text-lg font-bold text-clair-gold-400 mb-3">
              {selectedCategory}
            </h3>
            <div className="space-y-2">
              {EXPEDITION_CATEGORIES[selectedCategory as keyof typeof EXPEDITION_CATEGORIES]?.map((npcId) => {
                const npc = EXPEDITION_NPCS[npcId];
                if (!npc) return null;

                const isSelected = selectedNPC?.id === npcId;
                return (
                  <button
                    key={npcId}
                    onClick={() => handleNPCSelect(npcId)}
                    className={`w-full p-3 rounded-lg transition-all text-left ${
                      isSelected
                        ? 'bg-clair-gold-600 text-clair-shadow-900'
                        : 'bg-clair-shadow-700 text-clair-gold-300 hover:bg-clair-shadow-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold text-sm">{npc.name}</div>
                      <div className={`text-xs ${getHPColor(npc.hp)}`}>
                        {npc.hp} HP
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs opacity-75">
                      <span>AC {npc.ac}</span>
                      <span className={getAgeColor(npc.age)}>Age {npc.age}</span>
                    </div>
                    {npc.controlledBy && (
                      <div className="mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          npc.controlledBy === 'maelle' ? 'bg-clair-royal-600' :
                          npc.controlledBy === 'sciel' ? 'bg-green-600' :
                          'bg-gray-600'
                        }`}>
                          {npc.controlledBy === 'maelle' ? '👑 Maelle' :
                           npc.controlledBy === 'sciel' ? '🌿 Sciel' :
                           '🎮 GM'}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* NPC Details */}
          <div className="lg:col-span-2">
            {selectedNPC ? (
              <div className="bg-clair-shadow-700 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl font-bold text-clair-gold-400">
                    {selectedNPC.name}
                  </h3>
                  <div className="flex items-center">
                    <span className="text-sm text-clair-gold-300 mr-2">
                      Age {selectedNPC.age} • {selectedNPC.category}
                    </span>
                    {getControllerBadge(selectedNPC.controlledBy)}
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center bg-clair-shadow-600 p-2 rounded">
                    <Shield className="w-4 h-4 mr-2 text-blue-400" />
                    <span>AC {selectedNPC.ac}</span>
                  </div>
                  <div className="flex items-center bg-clair-shadow-600 p-2 rounded">
                    <Heart className="w-4 h-4 mr-2 text-red-400" />
                    <span>{selectedNPC.hp} HP</span>
                  </div>
                  <div className="flex items-center bg-clair-shadow-600 p-2 rounded">
                    <Sword className="w-4 h-4 mr-2 text-yellow-400" />
                    <span>Expeditioner</span>
                  </div>
                </div>

                {/* Controller Info */}
                {selectedNPC.controlledBy && (
                  <div className="bg-clair-shadow-600 p-3 rounded">
                    <div className="text-sm font-bold text-clair-gold-400 mb-1">Control Info:</div>
                    <div className="text-sm text-clair-gold-300">
                      {selectedNPC.controlledBy === 'maelle' && 
                        "This NPC will be controlled by Maelle's player through the character sheet tabs."}
                      {selectedNPC.controlledBy === 'sciel' && 
                        "This NPC will be controlled by Sciel's player through the character sheet tabs."}
                      {selectedNPC.controlledBy === 'gm' && 
                        "This NPC is controlled by the GM."}
                    </div>
                  </div>
                )}

                {/* Bio */}
                <div>
                  <div className="text-sm font-bold text-clair-gold-400 mb-2">Biography:</div>
                  <div className="text-sm text-clair-gold-300 bg-clair-shadow-600 p-3 rounded">
                    {selectedNPC.bio}
                  </div>
                </div>

                {/* Hook */}
                <div>
                  <div className="text-sm font-bold text-clair-gold-400 mb-2">Roleplay Hook:</div>
                  <div className="text-sm text-clair-gold-300 bg-clair-shadow-600 p-3 rounded">
                    {selectedNPC.hook}
                  </div>
                </div>

                {/* Combat Style */}
                <div>
                  <div className="text-sm font-bold text-clair-gold-400 mb-2">Combat Role:</div>
                  <div className="text-sm text-clair-gold-300 bg-clair-shadow-600 p-3 rounded">
                    {selectedNPC.combatStyle}
                  </div>
                </div>

                {/* Traits */}
                <div>
                  <div className="text-sm font-bold text-clair-gold-400 mb-2">Personality Traits:</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedNPC.traits.map((trait, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 bg-clair-mystical-600 text-clair-mystical-200 rounded-full text-xs"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Add Button */}
                <button
                  onClick={handleConfirmSelection}
                  className="w-full bg-clair-gold-600 hover:bg-clair-gold-700 text-clair-shadow-900 py-3 px-4 rounded-lg font-bold transition-colors flex items-center justify-center"
                >
                  <Users className="w-5 h-5 mr-2" />
                  Deploy {selectedNPC.name} to Battle
                </button>
              </div>
            ) : (
              <div className="bg-clair-shadow-700 rounded-lg p-8 text-center text-clair-gold-300">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-bold mb-2">Select an Expeditioner</p>
                <p className="text-sm opacity-75">
                  These are the surviving members of Expedition 33 after the landing massacre.
                </p>
                <div className="mt-4 p-3 bg-red-900 bg-opacity-20 border border-red-600 rounded">
                  <p className="text-xs text-red-300">
                    <strong>Fallen in Session 0:</strong> The Recruit, The Gambler, The Zealot, The Scholar's Apprentice
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Instructions */}
        <div className="mt-6 p-4 bg-clair-mystical-900 bg-opacity-30 rounded-lg border border-clair-mystical-600">
          <div className="text-center">
            <p className="text-sm text-clair-gold-300 mb-2">
              <strong className="text-clair-gold-400">Living Members of Expedition 33</strong>
            </p>
            <p className="text-xs text-clair-gold-400 opacity-75">
              After the devastating landing, only a handful of expeditioners survived. The Child (formerly known as the New Recruit's younger brother) 
              has taken up his sibling's mantle. These brave souls continue the mission despite their losses.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}