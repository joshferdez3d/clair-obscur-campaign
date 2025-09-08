// src/components/GM/HPSettingsModal.tsx

import React, { useState } from 'react';
import { X, Heart, Plus, Minus, Activity, Settings } from 'lucide-react';

interface HPSettingsModalProps {
  isOpen: boolean;
  characterId: string;
  characterName: string;
  currentHP: number;
  maxHP: number;
  isLoading: boolean;
  onClose: () => void;
  onHPChange: (newHP: number) => Promise<void>;
  onMaxHPChange: (newMaxHP: number) => Promise<void>;
}

export function HPSettingsModal({
  isOpen,
  characterId,
  characterName,
  currentHP,
  maxHP,
  isLoading,
  onClose,
  onHPChange,
  onMaxHPChange,
}: HPSettingsModalProps) {
  const [damageAmount, setDamageAmount] = useState<string>('');
  const [healAmount, setHealAmount] = useState<string>('');
  const [targetHP, setTargetHP] = useState<string>('');
  const [targetMaxHP, setTargetMaxHP] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'current' | 'max'>('current');

  const hpPercentage = maxHP > 0 ? (currentHP / maxHP) * 100 : 0;

  const getHPBarColor = () => {
    if (currentHP <= 0) return 'bg-red-600';
    if (hpPercentage <= 25) return 'bg-red-500';
    if (hpPercentage <= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getHPTextColor = () => {
    if (currentHP <= 0) return 'text-red-200';
    if (hpPercentage <= 25) return 'text-red-200';
    if (hpPercentage <= 50) return 'text-yellow-200';
    return 'text-green-200';
  };

  const handleDamage = async () => {
    const damage = parseInt(damageAmount);
    if (isNaN(damage) || damage <= 0) return;
    
    const newHP = Math.max(0, currentHP - damage);
    await onHPChange(newHP);
    setDamageAmount('');
  };

  const handleHeal = async () => {
    const heal = parseInt(healAmount);
    if (isNaN(heal) || heal <= 0) return;
    
    const newHP = Math.min(maxHP, currentHP + heal);
    await onHPChange(newHP);
    setHealAmount('');
  };

  const handleSetHP = async () => {
    const hp = parseInt(targetHP);
    if (isNaN(hp) || hp < 0 || hp > maxHP) return;
    
    await onHPChange(hp);
    setTargetHP('');
  };

  const handleSetMaxHP = async () => {
    const newMaxHP = parseInt(targetMaxHP);
    if (isNaN(newMaxHP) || newMaxHP <= 0) return;
    
    await onMaxHPChange(newMaxHP);
    setTargetMaxHP('');
  };

  const handleClose = () => {
    if (!isLoading) {
      // Reset form fields when closing
      setDamageAmount('');
      setHealAmount('');
      setTargetHP('');
      setTargetMaxHP('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-clair-shadow-800 border border-clair-gold-600 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Heart className="w-6 h-6 text-red-400" />
            <h2 className="text-xl font-bold text-white">{characterName} - HP Management</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Current HP Display */}
        <div className="mb-6 p-4 bg-clair-shadow-700 border border-clair-shadow-600 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg font-medium text-white">Current Status</span>
            <span className={`text-xl font-bold ${getHPTextColor()}`}>
              {currentHP} / {maxHP}
            </span>
          </div>
          
          {/* HP Bar */}
          <div className="w-full bg-clair-shadow-800 rounded-full h-4 overflow-hidden mb-2">
            <div
              className={`h-full transition-all duration-300 ${getHPBarColor()}`}
              style={{ width: `${Math.max(0, Math.min(100, hpPercentage))}%` }}
            />
          </div>
          <div className="text-sm text-gray-300 text-center">
            {hpPercentage.toFixed(0)}%
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

        {/* Tab Navigation */}
        <div className="flex bg-clair-shadow-700 rounded-lg p-1 mb-6">
          <button
            onClick={() => setActiveTab('current')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'current'
                ? 'bg-clair-dark-700 text-white'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            <Activity className="h-4 w-4" />
            Current HP Management
          </button>
          <button
            onClick={() => setActiveTab('max')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'max'
                ? 'bg-clair-dark-700 text-white'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            <Settings className="h-4 w-4" />
            Max HP Management
          </button>
        </div>

        {/* Current HP Tab */}
        {activeTab === 'current' && (
          <div className="space-y-6">
            {/* Damage and Heal */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-white">Apply Damage</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={damageAmount}
                    onChange={(e) => setDamageAmount(e.target.value)}
                    placeholder="0"
                    className="flex-1 bg-clair-shadow-700 border border-clair-shadow-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 placeholder-gray-400"
                    min="0"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleDamage();
                      }
                    }}
                  />
                  <button
                    onClick={handleDamage}
                    disabled={isLoading || !damageAmount || parseInt(damageAmount) <= 0}
                    className="px-4 py-2 bg-red-700 hover:bg-red-800 disabled:bg-red-900 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    title="Apply Damage"
                  >
                    <Minus className="h-4 w-4" />
                    Damage
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-white">Apply Healing</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={healAmount}
                    onChange={(e) => setHealAmount(e.target.value)}
                    placeholder="0"
                    className="flex-1 bg-clair-shadow-700 border border-clair-shadow-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500 placeholder-gray-400"
                    min="0"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleHeal();
                      }
                    }}
                  />
                  <button
                    onClick={handleHeal}
                    disabled={isLoading || !healAmount || parseInt(healAmount) <= 0}
                    className="px-4 py-2 bg-green-700 hover:bg-green-800 disabled:bg-green-900 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    title="Apply Healing"
                  >
                    <Plus className="h-4 w-4" />
                    Heal
                  </button>
                </div>
              </div>
            </div>

            {/* Set HP */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-white">Set Exact HP</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={targetHP}
                  onChange={(e) => setTargetHP(e.target.value)}
                  placeholder="Enter target HP"
                  className="flex-1 bg-clair-shadow-700 border border-clair-shadow-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 placeholder-gray-400"
                  min="0"
                  max={maxHP}
                />
                <button
                  onClick={handleSetHP}
                  disabled={isLoading || !targetHP || parseInt(targetHP) < 0 || parseInt(targetHP) > maxHP}
                  className="px-6 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-900 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
                >
                  {isLoading ? 'Applying...' : 'Set HP'}
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-white">Quick Actions</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => onHPChange(maxHP)}
                  disabled={isLoading || currentHP >= maxHP}
                  className="px-4 py-3 bg-green-700 hover:bg-green-800 disabled:bg-green-900 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
                >
                  Full Heal
                </button>
                <button
                  onClick={() => onHPChange(0)}
                  disabled={isLoading || currentHP <= 0}
                  className="px-4 py-3 bg-red-700 hover:bg-red-800 disabled:bg-red-900 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
                >
                  Set to 0
                </button>
                <button
                  onClick={() => onHPChange(Math.floor(maxHP / 2))}
                  disabled={isLoading}
                  className="px-4 py-3 bg-yellow-700 hover:bg-yellow-800 text-white rounded text-sm font-medium transition-colors"
                >
                  Half HP
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Max HP Tab */}
        {activeTab === 'max' && (
          <div className="space-y-6">
            <div className="bg-clair-shadow-700 border border-clair-shadow-600 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-medium text-white">Current Max HP</span>
                <span className="text-2xl font-bold text-white">{maxHP}</span>
              </div>
              
              <div className="space-y-4">
                <label className="block text-sm font-medium text-white">
                  Set New Max HP
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={targetMaxHP}
                    onChange={(e) => setTargetMaxHP(e.target.value)}
                    placeholder="Enter new max HP"
                    className="flex-1 bg-clair-shadow-800 border border-clair-shadow-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 placeholder-gray-400"
                    min="1"
                  />
                  <button
                    onClick={handleSetMaxHP}
                    disabled={isLoading || !targetMaxHP || parseInt(targetMaxHP) <= 0}
                    className="px-6 py-2 bg-purple-700 hover:bg-purple-800 disabled:bg-purple-900 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
                  >
                    {isLoading ? 'Updating...' : 'Update Max HP'}
                  </button>
                </div>
                
                {parseInt(targetMaxHP) > 0 && (
                  <div className="text-sm text-blue-200 bg-blue-900/20 border border-blue-500/30 rounded p-3">
                    <strong className="text-blue-100">Note:</strong> Setting max HP to {targetMaxHP} will also set current HP to {targetMaxHP} (full heal).
                  </div>
                )}
              </div>
            </div>

            {/* Level Up Presets */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-white">Level Up Presets</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTargetMaxHP((maxHP + 5).toString())}
                  disabled={isLoading}
                  className="px-4 py-3 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-sm font-medium transition-colors"
                >
                  +5 HP
                </button>
                <button
                  onClick={() => setTargetMaxHP((maxHP + 8).toString())}
                  disabled={isLoading}
                  className="px-4 py-3 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-sm font-medium transition-colors"
                >
                  +8 HP
                </button>
                <button
                  onClick={() => setTargetMaxHP((maxHP + 10).toString())}
                  disabled={isLoading}
                  className="px-4 py-3 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-sm font-medium transition-colors"
                >
                  +10 HP
                </button>
                <button
                  onClick={() => setTargetMaxHP((maxHP + 12).toString())}
                  disabled={isLoading}
                  className="px-4 py-3 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-sm font-medium transition-colors"
                >
                  +12 HP
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Close Button */}
        <div className="mt-8 pt-6 border-t border-clair-shadow-600">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="w-full px-4 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50 text-white rounded font-medium transition-colors"
          >
            Close HP Settings
          </button>
        </div>
      </div>
    </div>
  );
}