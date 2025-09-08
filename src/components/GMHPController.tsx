import React, { useState } from 'react';
import { Heart, Swords, Shield } from 'lucide-react';

interface GMHPControllerProps {
  characterId: string;
  characterName: string;
  currentHP: number;
  maxHP: number;
  onHPChange: (newHP: number) => void | Promise<void>;
  isLoading?: boolean;
  characterColor?: string;
}

export function GMHPController({
  characterId,
  characterName,
  currentHP,
  maxHP,
  onHPChange,
  isLoading = false,
  characterColor = '#4f46e5',
}: GMHPControllerProps) {
  const [damageInput, setDamageInput] = useState('');
  const [healInput, setHealInput] = useState('');
  const [isApplyingDamage, setIsApplyingDamage] = useState(false);
  const [isApplyingHeal, setIsApplyingHeal] = useState(false);

  const hpPercentage = Math.max(0, Math.min(100, (currentHP / Math.max(1, maxHP)) * 100));

  const getHPColor = () => {
    if (hpPercentage > 60) return 'bg-green-500';
    if (hpPercentage > 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getHPGlow = () => {
    if (hpPercentage > 60) return 'shadow-lg shadow-green-500/20';
    if (hpPercentage > 30) return 'shadow-lg shadow-yellow-500/20';
    return 'shadow-lg shadow-red-500/20';
  };

  const handleApplyDamage = async () => {
    const damage = parseInt(damageInput);
    if (isNaN(damage) || damage <= 0) return alert('Please enter a valid damage amount');

    setIsApplyingDamage(true);
    try {
      const newHP = Math.max(0, currentHP - damage);
      await onHPChange(newHP);
      setDamageInput('');
    } finally {
      setIsApplyingDamage(false);
    }
  };

  const handleApplyHeal = async () => {
    const heal = parseInt(healInput);
    if (isNaN(heal) || heal <= 0) return alert('Please enter a valid heal amount');

    setIsApplyingHeal(true);
    try {
      const newHP = Math.min(maxHP, currentHP + heal);
      await onHPChange(newHP);
      setHealInput('');
    } finally {
      setIsApplyingHeal(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent, type: 'damage' | 'heal') => {
    if (event.key === 'Enter') {
      type === 'damage' ? handleApplyDamage() : handleApplyHeal();
    }
  };

  return (
    <div className="bg-clair-shadow-700 border border-clair-gold-600 rounded-lg p-4 shadow-shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center min-w-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center mr-3 flex-shrink-0"
            style={{ backgroundColor: characterColor }}
          >
            <Heart className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-white text-lg truncate">{characterName}</h4>
            <p className="text-clair-gold-300 text-sm">HP Control</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-white font-bold text-xl">
            {currentHP} / {maxHP}
          </div>
          <div className="text-clair-gold-300 text-sm">{hpPercentage.toFixed(0)}%</div>
        </div>
      </div>

      {/* HP Bar */}
      <div className="w-full bg-clair-shadow-800 rounded-full h-3 mb-4 overflow-hidden border border-clair-shadow-400">
        <div
          className={`h-full ${getHPColor()} ${getHPGlow()} transition-all duration-500 ease-out`}
          style={{ width: `${hpPercentage}%` }}
        />
      </div>

      {/* Controls - Always stacked vertically to prevent overlap */}
      <div className="space-y-3">
        {/* Damage Section */}
        <div className="space-y-2">
          <div className="flex items-center text-sm font-medium text-red-300">
            <Swords className="w-4 h-4 mr-1" />
            <span>Apply Damage</span>
          </div>
          <div className="flex space-x-2">
            <input
              type="number"
              value={damageInput}
              onChange={(e) => setDamageInput(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, 'damage')}
              placeholder="Amount"
              className="flex-1 px-3 py-2 bg-clair-shadow-800 border border-red-500 rounded text-white text-sm focus:outline-none focus:border-red-400 placeholder-red-300/50"
              min={1}
              max={currentHP}
              disabled={isLoading || isApplyingDamage || currentHP <= 0}
            />
            <button
              onClick={handleApplyDamage}
              disabled={isLoading || isApplyingDamage || !damageInput || currentHP <= 0}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors whitespace-nowrap"
            >
              {isApplyingDamage ? 'Applying...' : 'Apply'}
            </button>
          </div>
        </div>

        {/* Heal Section */}
        <div className="space-y-2">
          <div className="flex items-center text-sm font-medium text-green-300">
            <Shield className="w-4 h-4 mr-1" />
            <span>Apply Healing</span>
          </div>
          <div className="flex space-x-2">
            <input
              type="number"
              value={healInput}
              onChange={(e) => setHealInput(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, 'heal')}
              placeholder="Amount"
              className="flex-1 px-3 py-2 bg-clair-shadow-800 border border-green-500 rounded text-white text-sm focus:outline-none focus:border-green-400 placeholder-green-300/50"
              min={1}
              max={Math.max(0, maxHP - currentHP)}
              disabled={isLoading || isApplyingHeal || currentHP >= maxHP}
            />
            <button
              onClick={handleApplyHeal}
              disabled={isLoading || isApplyingHeal || !healInput || currentHP >= maxHP}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors whitespace-nowrap"
            >
              {isApplyingHeal ? 'Applying...' : 'Apply'}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-4 pt-3 border-t border-clair-shadow-600">
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onHPChange(maxHP)}
            disabled={isLoading || currentHP >= maxHP}
            className="px-2 py-1 bg-green-700 hover:bg-green-800 disabled:bg-green-900 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors"
          >
            Full Heal
          </button>
          <button
            onClick={() => onHPChange(0)}
            disabled={isLoading || currentHP <= 0}
            className="px-2 py-1 bg-red-700 hover:bg-red-800 disabled:bg-red-900 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors"
          >
            Set to 0
          </button>
          <button
            onClick={() => onHPChange(Math.floor(maxHP / 2))}
            disabled={isLoading}
            className="px-2 py-1 bg-yellow-700 hover:bg-yellow-800 text-white rounded text-xs font-medium transition-colors"
          >
            Half HP
          </button>
        </div>
      </div>

      {/* Status Indicators */}
      {currentHP <= 0 && (
        <div className="mt-3 p-2 bg-red-900 border border-red-500 rounded text-center">
          <p className="text-red-200 text-sm font-bold">UNCONSCIOUS</p>
        </div>
      )}
      {currentHP > 0 && currentHP <= maxHP * 0.25 && (
        <div className="mt-3 p-2 bg-yellow-900 border border-yellow-500 rounded text-center">
          <p className="text-yellow-200 text-sm font-bold">CRITICALLY WOUNDED</p>
        </div>
      )}
    </div>
  );
}