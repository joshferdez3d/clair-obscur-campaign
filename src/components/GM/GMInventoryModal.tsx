// src/components/GM/GMInventoryModal.tsx

import React, { useState, useEffect } from 'react';
import { X, Package, Plus, Trash2, Users, FileText } from 'lucide-react';
import { InventoryService } from '../../services/inventoryService';
import type { Character, InventoryItem } from '../../types';

interface GMInventoryModalProps {
  isOpen: boolean;
  characters: Character[];
  onClose: () => void;
}

export function GMInventoryModal({
  isOpen,
  characters,
  onClose,
}: GMInventoryModalProps) {
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('');
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state for adding items
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);

  useEffect(() => {
    if (selectedCharacterId) {
      const character = characters.find(c => c.id === selectedCharacterId);
      setSelectedCharacter(character || null);
    } else {
      setSelectedCharacter(null);
    }
  }, [selectedCharacterId, characters]);

  const handleAddItem = async () => {
    if (!selectedCharacterId || !itemName.trim()) {
      setError('Please select a character and enter an item name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await InventoryService.addItem(selectedCharacterId, {
        name: itemName.trim(),
        description: itemDescription.trim(),
        quantity: itemQuantity,
      });

      // Reset form
      setItemName('');
      setItemDescription('');
      setItemQuantity(1);

      // Refresh character data
      const updatedCharacter = await InventoryService.getCharacterInventory(selectedCharacterId);
      if (updatedCharacter) {
        setSelectedCharacter(updatedCharacter);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!selectedCharacterId) return;

    setIsLoading(true);
    setError(null);

    try {
      await InventoryService.removeItem(selectedCharacterId, itemId);

      // Refresh character data
      const updatedCharacter = await InventoryService.getCharacterInventory(selectedCharacterId);
      if (updatedCharacter) {
        setSelectedCharacter(updatedCharacter);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove item');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-clair-shadow-800 border border-clair-gold-600 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-bold text-clair-gold-400 flex items-center">
            <Package className="w-6 h-6 mr-2" />
            Inventory Management
          </h2>
          <button
            onClick={onClose}
            className="text-clair-gold-300 hover:text-clair-gold-100 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-900 border border-red-500 rounded-lg">
            <p className="text-red-200 text-sm">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="mt-2 text-red-300 hover:text-red-100 text-xs underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Character Selection */}
        <div className="mb-6">
          <label className="block text-sm font-bold mb-2 text-clair-gold-300 flex items-center">
            <Users className="w-4 h-4 mr-1" />
            Select Character
          </label>
          <select
            value={selectedCharacterId}
            onChange={(e) => setSelectedCharacterId(e.target.value)}
            className="w-full px-3 py-2 bg-clair-shadow-700 text-clair-gold-200 border border-clair-shadow-400 rounded-lg focus:border-clair-gold-400 focus:outline-none"
          >
            <option value="">Choose a character...</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name} ({character.role})
              </option>
            ))}
          </select>
        </div>

        {selectedCharacter && (
          <>
            {/* Add Item Form */}
            <div className="mb-6 p-4 bg-clair-shadow-700 rounded-lg border border-clair-gold-600">
              <h3 className="font-display text-lg font-bold text-clair-gold-300 mb-4 flex items-center">
                <Plus className="w-5 h-5 mr-2" />
                Add Item to {selectedCharacter.name}'s Inventory
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-1 text-clair-gold-300">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="Enter item name"
                    className="w-full px-3 py-2 bg-clair-shadow-800 text-clair-gold-200 border border-clair-shadow-400 rounded focus:border-clair-gold-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1 text-clair-gold-300">
                    Description
                  </label>
                  <textarea
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    placeholder="Enter item description"
                    rows={3}
                    className="w-full px-3 py-2 bg-clair-shadow-800 text-clair-gold-200 border border-clair-shadow-400 rounded focus:border-clair-gold-400 focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1 text-clair-gold-300">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 px-3 py-2 bg-clair-shadow-800 text-clair-gold-200 border border-clair-shadow-400 rounded focus:border-clair-gold-400 focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleAddItem}
                  disabled={isLoading || !itemName.trim()}
                  className="w-full bg-clair-gold-600 hover:bg-clair-gold-700 disabled:bg-clair-shadow-600 disabled:opacity-50 text-clair-shadow-900 py-2 px-4 rounded-lg font-bold transition-colors"
                >
                  {isLoading ? 'Adding...' : 'Add Item'}
                </button>
              </div>
            </div>

            {/* Current Inventory */}
            <div>
              <h3 className="font-display text-lg font-bold text-clair-gold-300 mb-4">
                Current Inventory ({selectedCharacter.inventory?.length || 0} items)
              </h3>

              <div className="space-y-3">
                {!selectedCharacter.inventory || selectedCharacter.inventory.length === 0 ? (
                  <div className="text-center py-6">
                    <Package className="w-8 h-8 text-clair-shadow-400 mx-auto mb-2" />
                    <p className="text-clair-gold-300 font-sans">No items in inventory</p>
                  </div>
                ) : (
                  selectedCharacter.inventory.map((item) => (
                    <div
                      key={item.id}
                      className="bg-clair-shadow-700 border border-clair-gold-600 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <h4 className="font-serif text-clair-gold-200 font-bold mr-2">
                              {item.name}
                            </h4>
                            {item.quantity > 1 && (
                              <span className="bg-clair-gold-600 text-clair-shadow-900 px-2 py-1 rounded-full text-xs font-bold">
                                x{item.quantity}
                              </span>
                            )}
                          </div>
                          
                          {item.description && (
                            <div className="flex items-start mb-2">
                              <FileText className="w-4 h-4 text-clair-gold-400 mr-2 mt-0.5 flex-shrink-0" />
                              <p className="text-clair-gold-300 font-sans text-sm">
                                {item.description}
                              </p>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={isLoading}
                          className="ml-3 text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}