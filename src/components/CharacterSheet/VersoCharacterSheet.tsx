// src/components/CharacterSheet/VersoCharacterSheet.tsx
import React, { useState, useEffect } from 'react';
import { Sparkles, Target, Zap, Music, Volume2, Trash2 } from 'lucide-react';
import { HPTracker } from './HPTracker';
import { StatDisplay } from './StatDisplay';
import { EnemyTargetingModal } from '../Combat/EnemyTargetingModal';
import type { Character, Position, BattleToken } from '../../types';
import type { MusicalNote } from '../../types/versoType';
import { useUltimateVideo } from '../../hooks/useUltimateVideo';
import { Package } from 'lucide-react';
import { InventoryModal } from './InventoryModal';
import { useRealtimeInventory } from '../../hooks/useRealtimeInventory';
import { MovementInput } from '../Combat/MovementInput';
import { MovementService } from '../../services/movementService';
import { VersoCombatService } from '../../services/VersoCombatService';
import { NOTE_INFO, HARMONY_EFFECTS, detectHarmonyType } from '../../utils/harmonyDetection';
import { HarmonicDisplay } from '../Verso/HarmonicDisplay';
import { ModulationModal } from '../Verso/ModulationModal';

interface VersoCharacterSheetProps {
  character: Character;
  onHPChange: (delta: number) => void;
  onAbilityUse: (ability: any) => void;
  isLoading?: boolean;
  isMyTurn?: boolean;
  combatActive?: boolean;
  availableEnemies?: Array<{
    id: string;
    name: string;
    position: { x: number; y: number };
    hp: number;
    maxHp: number;
    ac: number;
  }>;
  playerPosition?: { x: number; y: number };
  onTargetSelect?: (targetId: string, acRoll: number, attackType: string, abilityId?: string) => void;
  onEndTurn?: () => void;
  onCancelTargeting?: () => void;
  sessionId?: string;
  allTokens?: BattleToken[];
  session?: any;

  // Persistent state props for Verso's harmonic system (matching VersoState)
  activeNotes: MusicalNote[];
  perfectPitchCharges: number;
  modulationCooldown: number;
  songOfAliciaActive: boolean;
  songOfAliciaUsed: boolean;
}

export function VersoCharacterSheet({
  character,
  onHPChange,
  onAbilityUse,
  isMyTurn = false,
  combatActive = false,
  availableEnemies = [],
  playerPosition = { x: 0, y: 0 },
  onTargetSelect,
  onEndTurn,
  onCancelTargeting,
  sessionId = 'test-session',
  allTokens = [],
  session,
  activeNotes,
  perfectPitchCharges,
  modulationCooldown,
  songOfAliciaActive,
  songOfAliciaUsed,
}: VersoCharacterSheetProps) {
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [acRoll, setACRoll] = useState<string>('');
  const { triggerUltimate } = useUltimateVideo(sessionId || 'test-session');
  const [showTargetingModal, setShowTargetingModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const { gold: goldAmount, inventory, loading: inventoryLoading } = useRealtimeInventory(character?.id || '');
  const [selectedAction, setSelectedAction] = useState<any | null>(null);
  const [showNoteSelectionModal, setShowNoteSelectionModal] = useState(false);
  const [showModulationModal, setShowModulationModal] = useState(false);

  // Find Verso's token in the session
  const versoToken = session?.tokens 
    ? Object.entries(session.tokens).find(([key, t]: [string, any]) => {
        console.log(`Checking token ${key}:`, {
          tokenCharacterId: t.characterId,
          tokenId: t.id,
          tokenName: t.name,
          tokenType: t.type,
        });
        
        // Try multiple matching strategies
        return t.characterId === character.id || 
               t.id === character.id ||
               key === character.id ||
               t.name?.toLowerCase() === character.name?.toLowerCase();
      })?.[1] as BattleToken | undefined
    : undefined;

  const handleOpenInventory = () => {
    setShowInventoryModal(true);
  };

  // Find player token
  const playerToken = session?.tokens 
    ? Object.entries(session.tokens).find(([key, t]: [string, any]) => {
        return t.characterId === character.id || 
               t.id === character.id ||
               key === character.id ||
               t.name?.toLowerCase() === character.name?.toLowerCase();
      })?.[1] as BattleToken
    : null;

  const handleMovement = async (newPosition: Position): Promise<boolean> => {
    if (!sessionId || !playerToken) return false;
    return await MovementService.moveToken(sessionId, playerToken.id, newPosition);
  };

  const getCharacterPortrait = (name: string) => {
    const portraitMap: { [key: string]: string } = {
      'gustave': '/tokens/characters/gustave.jpg',
      'lune': '/tokens/characters/lune.jpg',
      'maelle': '/tokens/characters/maelle.jpg',
      'sciel': '/tokens/characters/sciel.jpg',
      'verso': '/tokens/characters/verso.jpg',
    };
    return portraitMap[name.toLowerCase()] || null;
  };

  const portraitUrl = getCharacterPortrait(character.name);
  const getCharacterGradient = () => 'bg-gradient-to-br from-purple-600 to-pink-800';

  // Calculate distance for range validation
  const calculateDistance = (pos1: { x: number; y: number }, pos2: { x: number; y: number }): number => {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    return Math.max(dx, dy) * 5;
  };

  // Get valid targets (Verso has unlimited range on most abilities)
  const getValidTargets = () => {
    return availableEnemies;
  };

  // Detect current harmony using imported function
  const currentHarmony = detectHarmonyType(activeNotes);
  const harmonyEffect = currentHarmony ? HARMONY_EFFECTS[currentHarmony] : null;

  // Handle Harmonic Strike (basic attack + generates note using VersoCombatService)
  const handleHarmonicStrike = () => {
    if (!isMyTurn || !combatActive) return;

    const validTargets = getValidTargets();
    if (validTargets.length === 0) {
      alert('No enemies in range!');
      return;
    }

    if (activeNotes.length >= 3) {
      alert('Already have 3 notes! Use Harmonic Resonance or Dissonant Purge first.');
      return;
    }

    setSelectedAction({
      type: 'basic',
      id: 'harmonic_strike',
      name: 'Harmonic Strike',
      description: 'Basic attack that generates a musical note',
      damage: '1d10',
      needsTarget: true,
      generatesNote: true,
    });
    setShowTargetingModal(true);
  };

  // Handle Harmonic Resonance (consumes notes for harmony effect using VersoCombatService)
  const handleHarmonicResonance = () => {
    if (!isMyTurn || !combatActive) return;

    if (activeNotes.length < 2) {
      alert('Need at least 2 notes to use Harmonic Resonance!');
      return;
    }

    if (!currentHarmony) {
      alert('No harmony detected! This should not happen.');
      return;
    }

    const validTargets = getValidTargets();
    if (validTargets.length === 0) {
      alert('No enemies in range!');
      return;
    }

    setSelectedAction({
      type: 'ability',
      id: 'harmonic_resonance',
      name: 'Harmonic Resonance',
      description: `Consume ${activeNotes.length} notes for ${harmonyEffect?.name}`,
      damage: harmonyEffect?.baseDamage || '0',
      effect: harmonyEffect?.effect || '',
      harmonyType: currentHarmony,
      needsTarget: currentHarmony !== 'chaotic', // Chaotic is AOE
      consumesNotes: true,
    });
    setShowTargetingModal(true);
  };

  // Handle Perfect Pitch (choose specific note using VersoCombatService)
  const handlePerfectPitch = () => {
    if (!isMyTurn || !combatActive) return;

    if (perfectPitchCharges <= 0) {
      alert('No Perfect Pitch charges remaining!');
      return;
    }

    if (activeNotes.length >= 3) {
      alert('Note collection is full!');
      return;
    }

    setShowNoteSelectionModal(true);
  };

  // Handle Modulation (change note to adjacent one using VersoCombatService)
  const handleModulation = () => {
    if (!isMyTurn || !combatActive) return;

    if (modulationCooldown > 0) {
      alert(`Modulation is on cooldown! ${modulationCooldown} turns remaining.`);
      return;
    }

    if (activeNotes.length === 0) {
      alert('No notes to modulate!');
      return;
    }

    setShowModulationModal(true);
  };

  // Handle Dissonant Purge (clear notes + AOE damage using VersoCombatService)
  const handleDissonantPurge = async () => {
    if (!isMyTurn || !combatActive) return;

    const validTargets = getValidTargets();
    if (validTargets.length === 0) {
      alert('No enemies in range!');
      return;
    }

    if (activeNotes.length === 0) {
      alert('No notes to purge!');
      return;
    }

    if (confirm(`Use Dissonant Purge to clear ${activeNotes.length} notes and damage all enemies?`)) {
      try {
        const damage = await VersoCombatService.dissonantPurge(character.id);
        alert(`💣 Dissonant Purge hits ${validTargets.length} enemies for ${damage} total damage! Notes cleared.`);
        
        if (onEndTurn) {
          setTimeout(() => onEndTurn(), 500);
        }
      } catch (error) {
        console.error('Failed to use Dissonant Purge:', error);
        alert(error instanceof Error ? error.message : 'Failed to use Dissonant Purge');
      }
    }
  };

  // Handle Song of Alicia (ultimate using VersoCombatService)
  const handleSongOfAlicia = async () => {
    if (!isMyTurn || !combatActive) return;

    if (songOfAliciaUsed) {
      alert('Song of Alicia has already been used this battle!');
      return;
    }

    if (confirm('Activate Song of Alicia? Your next Harmonic Resonance will deal double damage!')) {
      try {
        await VersoCombatService.useSongOfAlicia(character.id);
        
        // Trigger ultimate video
        await triggerUltimate('verso', 'Song of Alicia');

        
        alert('🎼 Song of Alicia activated! Your next Harmonic Resonance will deal DOUBLE DAMAGE!');
        
        if (onEndTurn) {
          setTimeout(() => onEndTurn(), 500);
        }
      } catch (error) {
        console.error('Failed to activate Song of Alicia:', error);
        alert(error instanceof Error ? error.message : 'Failed to activate Song of Alicia');
      }
    }
  };

  // Handle note selection from Perfect Pitch using VersoCombatService
  const handleSelectNote = async (note: MusicalNote) => {
    try {
      await VersoCombatService.choosePerfectPitchNote(character.id, note);
      setShowNoteSelectionModal(false);
      alert(`🎵 Added ${note} to your collection!`);
    } catch (error) {
      console.error('Failed to choose note:', error);
      alert(error instanceof Error ? error.message : 'Failed to choose note');
    }
  };

  // Handle modulation using VersoCombatService (delegated to ModulationModal)
  const handleModulateNote = async (noteIndex: number, newNote: MusicalNote) => {
    try {
      await VersoCombatService.modulateNote(character.id, noteIndex, newNote);
      setShowModulationModal(false);
      alert(`🔄 Modulated note to ${newNote}!`);
    } catch (error) {
      console.error('Failed to modulate note:', error);
      alert(error instanceof Error ? error.message : 'Failed to modulate note');
      throw error; // Re-throw so ModulationModal can handle it
    }
  };

  // Handle targeting modal confirmation
  const handleConfirmTarget = async () => {
    if (!selectedTarget || !acRoll) {
      alert('Please select a target and enter AC roll');
      return;
    }

    const roll = parseInt(acRoll);
    if (isNaN(roll)) {
      alert('Invalid AC roll');
      return;
    }

    try {
      // Handle different action types using VersoCombatService
      if (selectedAction?.generatesNote) {
        // Harmonic Strike - generate note after attack
        const newNote = await VersoCombatService.generateNote(character.id);
        console.log(`🎵 Generated note: ${newNote}`);
      }

      if (selectedAction?.consumesNotes) {
        // Harmonic Resonance - consume notes using service
        const result = await VersoCombatService.useHarmonicResonance(character.id);
        console.log(`💥 Harmonic Resonance: ${result.harmonyType} - ${result.damage} damage`);
        console.log(`Effect: ${result.effect}`);
      }

      // Call parent's target select handler
      if (onTargetSelect) {
        onTargetSelect(selectedTarget, roll, selectedAction.type, selectedAction.id);
      }

      // Reset state
      setShowTargetingModal(false);
      setSelectedTarget('');
      setACRoll('');
      setSelectedAction(null);

      // End turn automatically
      if (onEndTurn) {
        setTimeout(() => onEndTurn(), 500);
      }
    } catch (error) {
      console.error('Failed to execute action:', error);
      alert(error instanceof Error ? error.message : 'Failed to execute action');
    }
  };

  const handleCancelAction = () => {
    setShowTargetingModal(false);
    setSelectedTarget('');
    setACRoll('');
    setSelectedAction(null);
    if (onCancelTargeting) {
      onCancelTargeting();
    }
  };

  // Decrease cooldowns at start of turn using VersoCombatService
  useEffect(() => {
    if (isMyTurn && combatActive) {
      VersoCombatService.decreaseCooldowns(character.id).catch(err => {
        console.error('Failed to decrease cooldowns:', err);
      });
    }
  }, [isMyTurn, combatActive, character.id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-clair-dark via-gray-900 to-purple-900 text-white p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className={`${getCharacterGradient()} rounded-lg shadow-shadow p-6 border border-purple-500`}>
          <div className="flex items-center space-x-4">
            {portraitUrl && (
              <img
                src={portraitUrl}
                alt={character.name}
                className="w-20 h-20 rounded-full border-4 border-purple-400 object-cover"
              />
            )}
            <div className="flex-1">
              <h1 className="font-display text-3xl font-bold text-white mb-1">
                {character.name}
              </h1>
              <p className="text-purple-200 text-lg">The Musical Guardian</p>
            </div>
            <button
              onClick={handleOpenInventory}
              className="bg-purple-700 hover:bg-purple-600 p-3 rounded-lg transition-colors"
              title="Open Inventory"
            >
              <Package className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* HP Tracker */}
        <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 border border-purple-500">
          <HPTracker
            currentHP={character.currentHP}
            maxHP={character.maxHP}
            onHPChange={onHPChange}
            isLoading={false}
          />
        </div>

        {/* Stats */}
        <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 border border-purple-500">
          <StatDisplay stats={character.stats} />
        </div>

        {/* Movement */}
        {combatActive && isMyTurn && versoToken && (
        <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 border border-purple-500">
            <MovementInput
              token={versoToken}
              currentPosition={versoToken.position}
              maxRange={MovementService.getMovementRange(character.name)}
              gridSize={session?.currentMap?.gridSize || { width: 30, height: 30 }}
              onMove={handleMovement}
              isMyTurn={isMyTurn}
              characterName={character.name}
            />
          </div>
        )}

        {/* Harmonic Notes Display */}
        <HarmonicDisplay 
          activeNotes={activeNotes}
          songOfAliciaActive={songOfAliciaActive}
        />

        {/* Resource Tracker */}
        <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 border border-purple-500">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-gray-800 p-2 rounded text-center">
              <div className="text-purple-400">Perfect Pitch</div>
              <div className="font-bold">{perfectPitchCharges} / 3</div>
            </div>
            <div className="bg-gray-800 p-2 rounded text-center">
              <div className="text-purple-400">Modulation</div>
              <div className="font-bold">
                {modulationCooldown > 0 ? `${modulationCooldown} turns` : 'Ready'}
              </div>
            </div>
            <div className="bg-gray-800 p-2 rounded text-center">
              <div className="text-purple-400">Song of Alicia</div>
              <div className="font-bold">{songOfAliciaUsed ? 'Used' : 'Ready'}</div>
            </div>
          </div>
        </div>

        {/* Combat Actions */}
        <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 border border-purple-500">
          <h3 className="font-display text-lg font-bold text-purple-300 mb-3">Combat Actions</h3>

          {!selectedAction ? (
            <div className="space-y-3">
              {/* Basic Attack */}
              <button
                onClick={handleHarmonicStrike}
                disabled={!isMyTurn || !combatActive || activeNotes.length >= 3}
                className={`w-full ${
                  !isMyTurn || !combatActive || activeNotes.length >= 3
                    ? 'bg-gray-600 opacity-50 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700'
                } p-3 rounded-lg transition-colors text-left text-white`}
              >
                <div className="flex items-center">
                  <Music className="w-5 h-5 mr-2" />
                  <div className="flex-1">
                    <div className="font-bold">Harmonic Strike</div>
                    <div className="text-sm opacity-90">Basic attack + generate random note (1d7)</div>
                    <div className="text-xs text-purple-200">1d10 damage • Turn ends</div>
                  </div>
                  {activeNotes.length >= 3 && (
                    <span className="text-xs bg-red-600 px-2 py-1 rounded">
                      Notes Full
                    </span>
                  )}
                </div>
              </button>

              {/* Harmonic Resonance */}
              <button
                onClick={handleHarmonicResonance}
                disabled={!isMyTurn || !combatActive || activeNotes.length < 2}
                className={`w-full ${
                  !isMyTurn || !combatActive || activeNotes.length < 2
                    ? 'bg-gray-600 opacity-50 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                } p-3 rounded-lg transition-colors text-left text-white`}
              >
                <div className="flex items-center">
                  <Zap className="w-5 h-5 mr-2" />
                  <div className="flex-1">
                    <div className="font-bold">Harmonic Resonance</div>
                    <div className="text-sm opacity-90">
                      Consume notes for {harmonyEffect?.name || 'harmony effect'}
                    </div>
                    <div className="text-xs text-blue-200">
                      {harmonyEffect?.baseDamage || 'Need 2+ notes'} • Turn ends
                    </div>
                  </div>
                  {activeNotes.length < 2 && (
                    <span className="text-xs bg-red-600 px-2 py-1 rounded">
                      Need 2+ notes
                    </span>
                  )}
                </div>
              </button>

              {/* Perfect Pitch */}
              <button
                onClick={handlePerfectPitch}
                disabled={!isMyTurn || !combatActive || perfectPitchCharges <= 0 || activeNotes.length >= 3}
                className={`w-full ${
                  !isMyTurn || !combatActive || perfectPitchCharges <= 0 || activeNotes.length >= 3
                    ? 'bg-gray-600 opacity-50 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                } p-3 rounded-lg transition-colors text-left text-white`}
              >
                <div className="flex items-center">
                  <Target className="w-5 h-5 mr-2" />
                  <div className="flex-1">
                    <div className="font-bold">Perfect Pitch</div>
                    <div className="text-sm opacity-90">Choose a specific note</div>
                    <div className="text-xs text-green-200">{perfectPitchCharges} charges remaining</div>
                  </div>
                </div>
              </button>

              {/* Modulation */}
              <button
                onClick={handleModulation}
                disabled={!isMyTurn || !combatActive || modulationCooldown > 0 || activeNotes.length === 0}
                className={`w-full ${
                  !isMyTurn || !combatActive || modulationCooldown > 0 || activeNotes.length === 0
                    ? 'bg-gray-600 opacity-50 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                } p-3 rounded-lg transition-colors text-left text-white`}
              >
                <div className="flex items-center">
                  <Sparkles className="w-5 h-5 mr-2" />
                  <div className="flex-1">
                    <div className="font-bold">Modulation</div>
                    <div className="text-sm opacity-90">Change a note to an adjacent one</div>
                    <div className="text-xs text-indigo-200">
                      {modulationCooldown > 0 ? `Cooldown: ${modulationCooldown} turns` : 'No cooldown'}
                    </div>
                  </div>
                </div>
              </button>

              {/* Dissonant Purge */}
              <button
                onClick={handleDissonantPurge}
                disabled={!isMyTurn || !combatActive || activeNotes.length === 0}
                className={`w-full ${
                  !isMyTurn || !combatActive || activeNotes.length === 0
                    ? 'bg-gray-600 opacity-50 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                } p-3 rounded-lg transition-colors text-left text-white`}
              >
                <div className="flex items-center">
                  <Trash2 className="w-5 h-5 mr-2" />
                  <div className="flex-1">
                    <div className="font-bold">Dissonant Purge</div>
                    <div className="text-sm opacity-90">Clear notes + AOE damage</div>
                    <div className="text-xs text-red-200">1d6 per enemy • Turn ends</div>
                  </div>
                </div>
              </button>

              {/* Ultimate - Song of Alicia */}
              <button
                onClick={handleSongOfAlicia}
                disabled={!isMyTurn || !combatActive || songOfAliciaUsed}
                className={`w-full ${
                  !isMyTurn || !combatActive || songOfAliciaUsed
                    ? 'bg-gray-600 opacity-50 cursor-not-allowed'
                    : 'bg-gradient-to-r from-yellow-600 to-pink-600 hover:from-yellow-700 hover:to-pink-700'
                } p-3 rounded-lg transition-colors text-left text-white border-2 border-yellow-400`}
              >
                <div className="flex items-center">
                  <Volume2 className="w-5 h-5 mr-2" />
                  <div className="flex-1">
                    <div className="font-bold">Song of Alicia</div>
                    <div className="text-sm opacity-90">Next Harmonic Resonance deals DOUBLE damage</div>
                    <div className="text-xs text-yellow-200">
                      {songOfAliciaUsed ? 'Already used' : 'Once per battle'} • Turn ends
                    </div>
                  </div>
                  <span className="text-xs bg-black bg-opacity-30 px-2 py-1 rounded">
                    ULTIMATE
                  </span>
                </div>
              </button>
            </div>
          ) : null}
        </div>

        {/* Turn Management */}
        {combatActive && isMyTurn && (
          <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 border border-purple-500">
            <button
              onClick={onEndTurn}
              className="w-full bg-clair-gold-600 hover:bg-clair-gold-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              End Turn
            </button>
          </div>
        )}

        {/* Turn Indicator */}
        {combatActive && (
          <div className={`rounded-lg p-3 text-center ${
            isMyTurn 
              ? 'bg-green-600 text-white' 
              : 'bg-gray-700 text-gray-300'
          }`}>
            {isMyTurn ? '🎵 YOUR TURN! 🎵' : 'Waiting for your turn...'}
          </div>
        )}
      </div>

      {/* Targeting Modal */}
      {showTargetingModal && selectedAction && (
        <EnemyTargetingModal
          isOpen={showTargetingModal}
          onClose={() => setShowTargetingModal(false)}
          enemies={getValidTargets()}
          playerPosition={playerPosition}
          sessionId={sessionId}
          playerId={character.id}
          onSelectEnemy={(enemy) => {
            setSelectedTarget(enemy.id);
          }}
          selectedEnemyId={selectedTarget}
          abilityName={selectedAction?.name}
          abilityRange={999}
        />
      )}

      {/* Modulation Modal */}
      <ModulationModal
        isOpen={showModulationModal}
        onClose={() => setShowModulationModal(false)}
        onModulate={handleModulateNote}
        activeNotes={activeNotes}
        modulationCooldown={modulationCooldown}
      />

      {/* Note Selection Modal (Perfect Pitch) */}
      {showNoteSelectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border-2 border-purple-500">
            <h3 className="text-xl font-bold text-purple-300 mb-4">Perfect Pitch - Choose a Note</h3>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {(['C', 'D', 'E', 'F', 'G', 'A', 'B'] as MusicalNote[]).map(note => {
                const noteInfo = NOTE_INFO[note];
                return (
                  <button
                    key={note}
                    onClick={() => handleSelectNote(note)}
                    className="flex flex-col items-center p-3 bg-gray-700 hover:bg-gray-600 rounded-lg border-2 transition-colors"
                    style={{ borderColor: noteInfo.color }}
                  >
                    <div className="text-3xl mb-1">{noteInfo.emoji}</div>
                    <div className="text-lg font-bold" style={{ color: noteInfo.color }}>
                      {note}
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowNoteSelectionModal(false)}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Inventory Modal */}
      {showInventoryModal && (
        <InventoryModal
          isOpen={showInventoryModal}
          onClose={() => setShowInventoryModal(false)}
          characterName={character.name}  // Also need to add this required prop
          inventory={inventory}
          goldAmount={goldAmount}  // Changed from 'gold' to 'goldAmount'
          isLoading={inventoryLoading}
        />
      )}
    </div>
  );
}