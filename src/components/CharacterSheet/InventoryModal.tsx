// src/components/CharacterSheet/InventoryModal.tsx - Enhanced with Gold Display

import React from 'react';
import { X, Package, FileText, Coins } from 'lucide-react';
import type { InventoryItem } from '../../types';

interface InventoryModalProps {
  isOpen: boolean;
  characterName: string;
  inventory: InventoryItem[];
  goldAmount?: number; // ADD: Gold amount prop
  isLoading: boolean;
  onClose: () => void;
}

export function InventoryModal({
  isOpen,
  characterName,
  inventory,
  goldAmount = 0, // Default to 0 if not provided
  isLoading,
  onClose,
}: InventoryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-clair-shadow-800 border border-clair-gold-600 rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-bold text-clair-gold-400 flex items-center">
            <Package className="w-6 h-6 mr-2" />
            {characterName}'s Inventory
          </h2>
          <button
            onClick={onClose}
            className="text-clair-gold-300 hover:text-clair-gold-100 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-clair-mystical-500 bg-opacity-20 border border-clair-mystical-400 rounded-lg p-3 mb-4 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-clair-mystical-400 mr-3"></div>
            <span className="font-sans text-clair-mystical-300">Loading inventory...</span>
          </div>
        )}

        {/* Gold Display Section */}
        <div className="bg-gradient-to-r from-yellow-600/20 to-yellow-500/20 border border-yellow-500 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Coins className="w-6 h-6 text-yellow-400 mr-3" />
              <div>
                <h3 className="font-serif text-yellow-400 font-bold">Gold Coins</h3>
                <p className="text-yellow-300 text-sm">Your current wealth</p>
              </div>
            </div>
            <div className="text-3xl font-bold text-yellow-300">
              {goldAmount}
            </div>
          </div>
        </div>

        {/* Inventory Items Section */}
        <div className="space-y-3">
          <div className="flex items-center mb-4">
            <h3 className="font-display text-lg font-bold text-clair-gold-400">
              Items ({inventory?.length || 0})
            </h3>
          </div>

          {!inventory || inventory.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-clair-shadow-400 mx-auto mb-3" />
              <p className="text-clair-gold-300 font-sans">No items in inventory</p>
              <p className="text-clair-shadow-300 font-sans text-sm mt-1">
                Your GM can add items to your inventory
              </p>
            </div>
          ) : (
            inventory.map((item) => (
              <div
                key={item.id}
                className="bg-clair-shadow-700 border border-clair-gold-600 rounded-lg p-4 hover:bg-clair-shadow-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-serif text-clair-gold-200 font-bold">
                    {item.name}
                  </h4>
                  {item.quantity > 1 && (
                    <span className="bg-clair-gold-600 text-clair-shadow-900 px-2 py-1 rounded-full text-xs font-bold">
                      x{item.quantity}
                    </span>
                  )}
                </div>
                
                {item.description && (
                  <div className="flex items-start">
                    <FileText className="w-4 h-4 text-clair-gold-400 mr-2 mt-0.5 flex-shrink-0" />
                    <p className="text-clair-gold-300 font-sans text-sm leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-6 pt-4 border-t border-clair-shadow-600">
          <p className="text-clair-gold-400 text-xs text-center opacity-75">
            Items and gold are managed by your GM
          </p>
        </div>
      </div>
    </div>
  );
}