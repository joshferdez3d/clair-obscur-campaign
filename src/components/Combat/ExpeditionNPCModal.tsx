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
}

const EXPEDITION_NPCS: { [key: string]: ExpeditionNPC } = {
  'new-recruit': {
    id: 'new-recruit',
    name: 'The New Recruit',
    age: 18,
    ac: 12,
    hp: 18,
    maxHp: 18,
    size: 1,
    color: '#22c55e',
    category: 'Young Hopefuls',
    bio: 'Fresh out of training, wide-eyed and eager, they joined the expedition to prove themselves. Never left Lumière\'s walls before.',
    hook: 'Bonds quickly with younger PCs like Maelle; their enthusiasm makes their fate all the more tragic.',
    combatStyle: 'Eager but inexperienced - high damage potential but low survivability',
    traits: ['Optimistic', 'Brave', 'Inexperienced', 'Quick to Bond']
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
    hook: 'Offers advice to PCs; their grim fatalism contrasts with the recruit\'s hope.',
    combatStyle: 'Defensive fighter - high AC and HP, tactical knowledge',
    traits: ['Battle-Scarred', 'Fatalistic', 'Experienced', 'Protective']
  },
  'zealot': {
    id: 'zealot',
    name: 'The Zealot',
    age: 27,
    ac: 14,
    hp: 28,
    maxHp: 28,
    size: 1,
    color: '#8b5cf6',
    category: 'Faithful',
    bio: 'A devout believer that the Paintress is divine punishment. Sees the expedition as a holy mission to either redeem humanity or embrace its deserved end.',
    hook: 'Challenges PCs\' motives; could spark moral debate during the ship journey.',
    combatStyle: 'Divine warrior - moderate stats with potential divine protection',
    traits: ['Devout', 'Preachy', 'Unshakeable Faith', 'Morally Rigid']
  },
  'scholars-apprentice': {
    id: 'scholars-apprentice',
    name: 'The Scholar\'s Apprentice',
    age: 22,
    ac: 11,
    hp: 16,
    maxHp: 16,
    size: 1,
    color: '#3b82f6',
    category: 'Intellectuals',
    bio: 'A junior researcher inspired by Lune\'s family. Obsessively documents everything, constantly asking questions.',
    hook: 'Shadow to Lune, providing a foil — naive study versus experienced scholarship.',
    combatStyle: 'Support role - low combat stats but high utility and knowledge',
    traits: ['Curious', 'Documenter', 'Nervous', 'Studious']
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
    traits: ['Grieving', 'Stoic', 'Determined', 'Haunted']
  },
  'farmhand-fighter': {
    id: 'farmhand-fighter',
    name: 'The Farmhand Turned Fighter',
    age: 24,
    ac: 12,
    hp: 32,
    maxHp: 32,
    size: 1,
    color: '#84cc16',
    category: 'Common Folk',
    bio: 'Originally conscripted for labor, volunteered when no one else would from their district. Carries a scythe, relies on raw strength.',
    hook: 'Offers camaraderie to Sciel, highlighting her protective instincts.',
    combatStyle: 'Brutal strength - high HP and damage, lower defenses',
    traits: ['Strong', 'Determined', 'Crude Fighting', 'Loyal']
  },
  'gambler': {
    id: 'gambler',
    name: 'The Gambler',
    age: 28,
    ac: 13,
    hp: 24,
    maxHp: 24,
    size: 1,
    color: '#f59e0b',
    category: 'Risk-Takers',
    bio: 'A trickster and jokester, always with dice or cards in hand. Lightens the mood, insists fate is just another game of chance.',
    hook: 'Can host the dice game, drawing PCs into roleplay. Their sudden silencing in the massacre underscores the loss of levity.',
    combatStyle: 'Unpredictable - moderate stats with luck-based combat maneuvers',
    traits: ['Lucky', 'Charismatic', 'Reckless', 'Optimistic']
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
    traits: ['Vengeful', 'Impulsive', 'Fierce', 'Traumatized']
  }
};

const EXPEDITION_CATEGORIES = {
  'Young Hopefuls': ['new-recruit', 'child-of-gommage'],
  'Battle-Hardened': ['veteran'],
  'Faithful': ['zealot'],
  'Intellectuals': ['scholars-apprentice'],
  'Grief-Stricken': ['lost-lover'],
  'Common Folk': ['farmhand-fighter'],
  'Risk-Takers': ['gambler']
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
        id: generateId('exp'),
        name: selectedNPC.name,
        position: { x: 5, y: 5 }, // Default position - GM will place on map
        type: 'npc',
        hp: selectedNPC.hp,
        maxHp: selectedNPC.maxHp,
        size: selectedNPC.size,
        color: selectedNPC.color,
        ac: selectedNPC.ac
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
      case 'Faithful': return Zap;
      case 'Intellectuals': return Book;
      case 'Grief-Stricken': return Heart;
      case 'Common Folk': return Users;
      case 'Risk-Takers': return Sword;
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-clair-shadow-800 border border-clair-gold-600 rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-bold text-clair-gold-400">Expedition 33 - Add Expeditioner</h2>
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
                  <div className="text-sm text-clair-gold-300">
                    Age {selectedNPC.age} • {selectedNPC.category}
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
                  Add {selectedNPC.name} to Expedition
                </button>
              </div>
            ) : (
              <div className="bg-clair-shadow-700 rounded-lg p-8 text-center text-clair-gold-300">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-bold mb-2">Select an Expeditioner</p>
                <p className="text-sm opacity-75">Choose from the archetypes to see their details and add them to your battle map</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Instructions */}
        <div className="mt-6 p-4 bg-clair-mystical-900 bg-opacity-30 rounded-lg border border-clair-mystical-600">
          <div className="text-center">
            <p className="text-sm text-clair-gold-300 mb-2">
              <strong className="text-clair-gold-400">Expedition 33 Crew Management</strong>
            </p>
            <p className="text-xs text-clair-gold-400 opacity-75">
              These are the brave souls who joined your expedition. Each has their own story, motivations, and role to play in the journey ahead. Select an expeditioner and place them on the map to begin their part in the tale.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}