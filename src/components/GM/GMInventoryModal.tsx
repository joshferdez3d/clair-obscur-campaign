// components/GM/GMInventoryModal.tsx - Enhanced with BOTH Gold and Item Management (ESLint Fixed)

import React, { useState, useEffect } from 'react';
import { X, Package, Coins, Plus, Minus, Save, RefreshCw, Trash2, Edit3 } from 'lucide-react';
import { InventoryService } from '../../services/inventoryService';
import type { Character, InventoryItem } from '../../types';

interface GMInventoryModalProps {
  isOpen: boolean;
  characters: Character[];
  onClose: () => void;
}

export function GMInventoryModal({ isOpen, characters, onClose }: GMInventoryModalProps) {
  // Gold management state
  const [goldAmounts, setGoldAmounts] = useState<Record<string, number>>({});
  const [goldInputs, setGoldInputs] = useState<Record<string, string>>({});
  
  // Item management state
  const [showAddItemModal, setShowAddItemModal] = useState<string | null>(null);
  const [newItemData, setNewItemData] = useState({ name: '', description: '', quantity: 1 });
  const [editingQuantity, setEditingQuantity] = useState<{ characterId: string; itemId: string; quantity: string } | null>(null);
  
  // General state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [refreshedCharacters, setRefreshedCharacters] = useState<Character[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Initialize data when modal opens or characters change
  useEffect(() => {
    if (isOpen && characters.length > 0) {
      const goldMap: Record<string, number> = {};
      const inputMap: Record<string, string> = {};
      
      characters.forEach(char => {
        goldMap[char.id] = char.gold || 0;
        inputMap[char.id] = (char.gold || 0).toString();
      });
      
      setGoldAmounts(goldMap);
      setGoldInputs(inputMap);
      setRefreshedCharacters(characters);
      setErrors({});
      setIsSaving({});
    }
  }, [isOpen, characters]);

  // GOLD MANAGEMENT FUNCTIONS
  const handleGoldInputChange = (characterId: string, value: string) => {
    if (value === '' || /^\d+$/.test(value)) {
      setGoldInputs(prev => ({ ...prev, [characterId]: value }));
      setErrors(prev => ({ ...prev, [characterId]: '' }));
    }
  };

  const handleSaveGold = async (characterId: string) => {
    const inputValue = goldInputs[characterId] || '0';
    const goldAmount = parseInt(inputValue, 10);

    if (isNaN(goldAmount) || goldAmount < 0) {
      setErrors(prev => ({ ...prev, [characterId]: 'Please enter a valid number (0 or greater)' }));
      return;
    }

    setIsSaving(prev => ({ ...prev, [characterId]: true }));
    setErrors(prev => ({ ...prev, [characterId]: '' }));

    try {
      await InventoryService.setCharacterGold(characterId, goldAmount);
      setGoldAmounts(prev => ({ ...prev, [characterId]: goldAmount }));
    } catch (error) {
      setErrors(prev => ({ ...prev, [characterId]: 'Failed to save gold amount. Please try again.' }));
    } finally {
      setIsSaving(prev => ({ ...prev, [characterId]: false }));
    }
  };

  const handleQuickGoldAdjustment = async (characterId: string, adjustment: number) => {
    const currentGold = goldAmounts[characterId] || 0;
    const newAmount = Math.max(0, currentGold + adjustment);
    
    setIsSaving(prev => ({ ...prev, [characterId]: true }));
    
    try {
      await InventoryService.setCharacterGold(characterId, newAmount);
      setGoldAmounts(prev => ({ ...prev, [characterId]: newAmount }));
      setGoldInputs(prev => ({ ...prev, [characterId]: newAmount.toString() }));
    } catch (error) {
      setErrors(prev => ({ ...prev, [characterId]: 'Failed to adjust gold. Please try again.' }));
    } finally {
      setIsSaving(prev => ({ ...prev, [characterId]: false }));
    }
  };

  // ITEM MANAGEMENT FUNCTIONS
  const handleAddItem = async (characterId: string) => {
    if (!newItemData.name.trim()) {
      alert('Please enter an item name');
      return;
    }

    setIsSaving(prev => ({ ...prev, [`${characterId}_additem`]: true }));

    try {
      await InventoryService.addItem(characterId, {
        name: newItemData.name.trim(),
        description: newItemData.description.trim(),
        quantity: Math.max(1, newItemData.quantity)
      });

      // Reset form and close modal
      setNewItemData({ name: '', description: '', quantity: 1 });
      setShowAddItemModal(null);
      
      // Refresh character data
      await refreshCharacterData();

    } catch (error) {
      console.error('Failed to add item:', error);
      alert('Failed to add item. Please try again.');
    } finally {
      setIsSaving(prev => ({ ...prev, [`${characterId}_additem`]: false }));
    }
  };

  const handleRemoveItem = (characterId: string, itemId: string, itemName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Remove Item',
      message: `Remove "${itemName}" from inventory?`,
      onConfirm: () => {
        confirmRemoveItem(characterId, itemId);
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} });
      }
    });
  };

  const confirmRemoveItem = async (characterId: string, itemId: string) => {
    setIsSaving(prev => ({ ...prev, [`${characterId}_${itemId}`]: true }));

    try {
      await InventoryService.removeItem(characterId, itemId);
      await refreshCharacterData();
    } catch (error) {
      console.error('Failed to remove item:', error);
      alert('Failed to remove item. Please try again.');
    } finally {
      setIsSaving(prev => ({ ...prev, [`${characterId}_${itemId}`]: false }));
    }
  };

  const handleUpdateQuantity = async (characterId: string, itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      const item = refreshedCharacters.find(c => c.id === characterId)?.inventory?.find(i => i.id === itemId);
      if (item) {
        setConfirmDialog({
          isOpen: true,
          title: 'Remove Item',
          message: `Remove "${item.name}" from inventory?`,
          onConfirm: () => {
            confirmRemoveItem(characterId, itemId);
            setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} });
          }
        });
      }
      return;
    }

    setIsSaving(prev => ({ ...prev, [`${characterId}_${itemId}_qty`]: true }));

    try {
      await InventoryService.updateItemQuantity(characterId, itemId, newQuantity);
      await refreshCharacterData();
      setEditingQuantity(null);
    } catch (error) {
      console.error('Failed to update quantity:', error);
      alert('Failed to update quantity. Please try again.');
    } finally {
      setIsSaving(prev => ({ ...prev, [`${characterId}_${itemId}_qty`]: false }));
    }
  };

  // Refresh character data to get updated inventory
  const refreshCharacterData = async () => {
    setIsLoading(true);
    try {
      const characterIds = characters.map(c => c.id);
      const updated = await InventoryService.getAllCharacterInventories(characterIds);
      setRefreshedCharacters(updated);
    } catch (error) {
      console.error('Failed to refresh character data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const activeCharacters = refreshedCharacters.length > 0 ? refreshedCharacters : characters;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-clair-shadow-800 border border-clair-gold-600 rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-clair-shadow-700 border-b border-clair-gold-600 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-clair-gold-400 flex items-center">
              <Package className="w-6 h-6 mr-2" />
              Player Inventory & Gold Management
            </h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={refreshCharacterData}
                disabled={isLoading}
                className="p-2 text-clair-gold-300 hover:text-clair-gold-100 transition-colors"
                title="Refresh data"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-clair-gold-300 hover:text-clair-gold-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {activeCharacters.length === 0 ? (
            <div className="text-center text-clair-gold-300 py-8">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No character inventories found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {activeCharacters.map((character) => (
                <div key={character.id} className="bg-clair-shadow-700 border border-clair-gold-600 rounded-lg p-4">
                  {/* Character Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-display text-lg font-bold text-clair-gold-400">
                        {character.name}
                      </h3>
                      <p className="text-sm text-clair-gold-300">{character.role}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Gold Management Section */}
                    <div className="bg-clair-shadow-600 border border-yellow-500 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-yellow-400 flex items-center">
                          <Coins className="w-5 h-5 mr-2" />
                          Gold Coins
                        </h4>
                        <div className="text-yellow-300 font-bold">
                          Current: {goldAmounts[character.id] || 0}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleQuickGoldAdjustment(character.id, -10)}
                          disabled={isSaving[character.id]}
                          className="flex items-center px-2 py-1 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded text-sm transition-colors"
                        >
                          <Minus className="w-3 h-3 mr-1" />
                          10
                        </button>
                        
                        <button
                          onClick={() => handleQuickGoldAdjustment(character.id, -1)}
                          disabled={isSaving[character.id]}
                          className="flex items-center px-2 py-1 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded text-sm transition-colors"
                        >
                          <Minus className="w-3 h-3 mr-1" />
                          1
                        </button>

                        <div className="flex-1 max-w-xs">
                          <input
                            type="text"
                            value={goldInputs[character.id] || ''}
                            onChange={(e) => handleGoldInputChange(character.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveGold(character.id);
                              }
                            }}
                            className="w-full px-3 py-2 bg-clair-shadow-800 border border-clair-gold-600 rounded text-clair-gold-100 text-center focus:outline-none focus:border-clair-gold-400"
                            placeholder="Enter gold amount"
                            disabled={isSaving[character.id]}
                          />
                          {errors[character.id] && (
                            <p className="text-red-400 text-xs mt-1">{errors[character.id]}</p>
                          )}
                        </div>

                        <button
                          onClick={() => handleSaveGold(character.id)}
                          disabled={isSaving[character.id] || goldInputs[character.id] === (goldAmounts[character.id] || 0).toString()}
                          className="flex items-center px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:text-gray-400 text-white rounded text-sm transition-colors"
                        >
                          <Save className="w-3 h-3 mr-1" />
                          {isSaving[character.id] ? 'Saving...' : 'Set'}
                        </button>

                        <button
                          onClick={() => handleQuickGoldAdjustment(character.id, 1)}
                          disabled={isSaving[character.id]}
                          className="flex items-center px-2 py-1 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded text-sm transition-colors"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          1
                        </button>
                        
                        <button
                          onClick={() => handleQuickGoldAdjustment(character.id, 10)}
                          disabled={isSaving[character.id]}
                          className="flex items-center px-2 py-1 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded text-sm transition-colors"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          10
                        </button>
                      </div>
                    </div>

                    {/* Inventory Items Section */}
                    <div className="bg-clair-shadow-600 border border-clair-gold-600 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-clair-gold-400 flex items-center">
                          <Package className="w-4 h-4 mr-2" />
                          Inventory Items ({character.inventory?.length || 0})
                        </h4>
                        <button
                          onClick={() => setShowAddItemModal(character.id)}
                          className="flex items-center px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Item
                        </button>
                      </div>
                      
                      {character.inventory && character.inventory.length > 0 ? (
                        <div className="space-y-2">
                          {character.inventory.map((item: InventoryItem) => (
                            <div key={item.id} className="bg-clair-shadow-700 border border-clair-shadow-500 rounded p-3 flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-bold text-clair-gold-300">{item.name}</div>
                                <div className="text-clair-gold-400 text-sm flex items-center">
                                  Qty: 
                                  {editingQuantity?.itemId === item.id ? (
                                    <input
                                      type="number"
                                      min="0"
                                      value={editingQuantity.quantity}
                                      onChange={(e) => setEditingQuantity({
                                        ...editingQuantity,
                                        quantity: e.target.value
                                      })}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleUpdateQuantity(character.id, item.id, parseInt(editingQuantity.quantity) || 0);
                                        } else if (e.key === 'Escape') {
                                          setEditingQuantity(null);
                                        }
                                      }}
                                      className="ml-1 w-16 px-2 py-1 bg-clair-shadow-800 border border-clair-gold-600 rounded text-clair-gold-100 text-center text-xs focus:outline-none focus:border-clair-gold-400"
                                      autoFocus
                                    />
                                  ) : (
                                    <span 
                                      className="ml-1 cursor-pointer hover:text-clair-gold-200 px-1"
                                      onClick={() => setEditingQuantity({
                                        characterId: character.id,
                                        itemId: item.id,
                                        quantity: item.quantity.toString()
                                      })}
                                    >
                                      {item.quantity}
                                    </span>
                                  )}
                                </div>
                                {item.description && (
                                  <div className="text-clair-gold-300 text-xs mt-1 opacity-75">
                                    {item.description}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center space-x-2 ml-4">
                                <button
                                  onClick={() => setEditingQuantity({
                                    characterId: character.id,
                                    itemId: item.id,
                                    quantity: item.quantity.toString()
                                  })}
                                  className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
                                  title="Edit quantity"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleRemoveItem(character.id, item.id, item.name)}
                                  disabled={isSaving[`${character.id}_${item.id}`]}
                                  className="p-1 text-red-400 hover:text-red-300 disabled:text-red-600 transition-colors"
                                  title="Remove item"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-clair-gold-400 text-center py-4 opacity-75">
                          No items in inventory
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-clair-shadow-700 border-t border-clair-gold-600 p-4">
          <div className="flex justify-between items-center">
            <div className="text-clair-gold-400 text-sm">
              Manage both gold amounts and inventory items for all players
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-clair-shadow-600 hover:bg-clair-shadow-500 border border-clair-gold-600 text-clair-gold-200 rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-60">
          <div className="bg-clair-shadow-800 border border-clair-gold-600 rounded-lg shadow-xl max-w-sm w-full mx-4">
            <div className="bg-clair-shadow-700 border-b border-clair-gold-600 p-4">
              <h3 className="font-display text-lg font-bold text-clair-gold-400">
                {confirmDialog.title}
              </h3>
            </div>
            <div className="p-4">
              <p className="text-clair-gold-300">{confirmDialog.message}</p>
            </div>
            <div className="bg-clair-shadow-700 border-t border-clair-gold-600 p-4 flex justify-end space-x-2">
              <button
                onClick={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} })}
                className="px-4 py-2 bg-clair-shadow-600 hover:bg-clair-shadow-500 border border-clair-gold-600 text-clair-gold-200 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-60">
          <div className="bg-clair-shadow-800 border border-clair-gold-600 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="bg-clair-shadow-700 border-b border-clair-gold-600 p-4">
              <h3 className="font-display text-lg font-bold text-clair-gold-400">
                Add Item to {activeCharacters.find(c => c.id === showAddItemModal)?.name}
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-clair-gold-300 text-sm font-bold mb-2">
                  Item Name *
                </label>
                <input
                  type="text"
                  value={newItemData.name}
                  onChange={(e) => setNewItemData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-clair-shadow-600 border border-clair-gold-600 rounded text-clair-gold-100 focus:outline-none focus:border-clair-gold-400"
                  placeholder="Enter item name"
                />
              </div>
              <div>
                <label className="block text-clair-gold-300 text-sm font-bold mb-2">
                  Description
                </label>
                <textarea
                  value={newItemData.description}
                  onChange={(e) => setNewItemData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-clair-shadow-600 border border-clair-gold-600 rounded text-clair-gold-100 focus:outline-none focus:border-clair-gold-400"
                  placeholder="Enter item description (optional)"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-clair-gold-300 text-sm font-bold mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  value={newItemData.quantity}
                  onChange={(e) => setNewItemData(prev => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                  className="w-full px-3 py-2 bg-clair-shadow-600 border border-clair-gold-600 rounded text-clair-gold-100 focus:outline-none focus:border-clair-gold-400"
                />
              </div>
            </div>
            <div className="bg-clair-shadow-700 border-t border-clair-gold-600 p-4 flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowAddItemModal(null);
                  setNewItemData({ name: '', description: '', quantity: 1 });
                }}
                className="px-4 py-2 bg-clair-shadow-600 hover:bg-clair-shadow-500 border border-clair-gold-600 text-clair-gold-200 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddItem(showAddItemModal)}
                disabled={!newItemData.name.trim() || isSaving[`${showAddItemModal}_additem`]}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:text-gray-400 text-white rounded transition-colors"
              >
                {isSaving[`${showAddItemModal}_additem`] ? 'Adding...' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}