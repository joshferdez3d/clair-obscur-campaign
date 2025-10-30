// src/services/inventoryService.ts

import { doc, updateDoc, getDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { Character, InventoryItem } from '../types';

interface AddItemData {
  name: string;
  description: string;
  quantity: number;
}

export class InventoryService {
  /**
   * Add an item to a character's inventory
   */
  static async addItem(characterId: string, itemData: AddItemData): Promise<void> {
    try {
      const newItem: InventoryItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: itemData.name,
        description: itemData.description,
        quantity: itemData.quantity,
        addedBy: 'GM', // You could track which GM added it if needed
        addedAt: new Date(),
      };

      const characterRef = doc(db, 'characters', characterId);
      
      await updateDoc(characterRef, {
        inventory: arrayUnion(newItem),
        updatedAt: serverTimestamp(),
      });

      console.log(`✅ Added item "${newItem.name}" to character ${characterId}`);
    } catch (error) {
      console.error('❌ Failed to add item to inventory:', error);
      throw new Error('Failed to add item to inventory');
    }
  }

  /**
   * Remove an item from a character's inventory
   */
  static async removeItem(characterId: string, itemId: string): Promise<void> {
    try {
      // First, get the current character data to find the item
      const character = await this.getCharacterInventory(characterId);
      if (!character || !character.inventory) {
        throw new Error('Character or inventory not found');
      }

      // Find the item to remove
      const itemToRemove = character.inventory.find(item => item.id === itemId);
      if (!itemToRemove) {
        throw new Error('Item not found in inventory');
      }

      const characterRef = doc(db, 'characters', characterId);
      
      await updateDoc(characterRef, {
        inventory: arrayRemove(itemToRemove),
        updatedAt: serverTimestamp(),
      });

      console.log(`✅ Removed item "${itemToRemove.name}" from character ${characterId}`);
    } catch (error) {
      console.error('❌ Failed to remove item from inventory:', error);
      throw new Error('Failed to remove item from inventory');
    }
  }

  /**
   * Update item quantity (for stackable items)
   */
  static async updateItemQuantity(characterId: string, itemId: string, newQuantity: number): Promise<void> {
    try {
      if (newQuantity <= 0) {
        await this.removeItem(characterId, itemId);
        return;
      }

      // Get current character data
      const character = await this.getCharacterInventory(characterId);
      if (!character || !character.inventory) {
        throw new Error('Character or inventory not found');
      }

      // Update the inventory array
      const updatedInventory = character.inventory.map(item => 
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      );

      const characterRef = doc(db, 'characters', characterId);
      
      await updateDoc(characterRef, {
        inventory: updatedInventory,
        updatedAt: serverTimestamp(),
      });

      console.log(`✅ Updated item quantity for character ${characterId}`);
    } catch (error) {
      console.error('❌ Failed to update item quantity:', error);
      throw new Error('Failed to update item quantity');
    }
  }

  static async getCharacterGold(characterId: string): Promise<number> {
    try {
      const characterRef = doc(db, 'characters', characterId);
      const characterSnap = await getDoc(characterRef);
      
      if (!characterSnap.exists()) {
        console.warn(`Character ${characterId} not found`);
        return 0;
      }

      const data = characterSnap.data();
      return data.gold ?? 0; // Default to 0 if gold field doesn't exist
    } catch (error) {
      console.error(`Error getting gold for character ${characterId}:`, error);
      return 0;
    }
  }

    static async setCharacterGold(characterId: string, goldAmount: number): Promise<void> {
      try {
        if (goldAmount < 0) {
          throw new Error('Gold amount cannot be negative');
        }

        const characterRef = doc(db, 'characters', characterId);
        await updateDoc(characterRef, {
          gold: goldAmount,
          updatedAt: serverTimestamp()
        });

        console.log(`✅ Set ${characterId} gold to ${goldAmount}`);
      } catch (error) {
        console.error(`❌ Error setting gold for character ${characterId}:`, error);
        throw error;
      }
    }

    static async addGold(characterId: string, amount: number): Promise<number> {
      try {
        if (amount <= 0) {
          throw new Error('Gold amount to add must be positive');
        }

        const currentGold = await this.getCharacterGold(characterId);
        const newGold = currentGold + amount;
        
        await this.setCharacterGold(characterId, newGold);
        
        console.log(`💰 Added ${amount} gold to ${characterId} (total: ${newGold})`);
        return newGold;
      } catch (error) {
        console.error(`❌ Error adding gold to character ${characterId}:`, error);
        throw error;
      }
    }

    static async removeGold(characterId: string, amount: number): Promise<number> {
      try {
        if (amount <= 0) {
          throw new Error('Gold amount to remove must be positive');
        }

        const currentGold = await this.getCharacterGold(characterId);
        
        if (currentGold < amount) {
          throw new Error(`Insufficient gold. Character has ${currentGold}, trying to remove ${amount}`);
        }

        const newGold = currentGold - amount;
        await this.setCharacterGold(characterId, newGold);
        
        console.log(`💸 Removed ${amount} gold from ${characterId} (remaining: ${newGold})`);
        return newGold;
      } catch (error) {
        console.error(`❌ Error removing gold from character ${characterId}:`, error);
        throw error;
      }
    }

    static async transferGold(fromCharacterId: string, toCharacterId: string, amount: number): Promise<void> {
      try {
        if (amount <= 0) {
          throw new Error('Transfer amount must be positive');
        }

        // Remove from source character first (this will check if they have enough)
        await this.removeGold(fromCharacterId, amount);
        
        // Add to destination character
        await this.addGold(toCharacterId, amount);
        
        console.log(`💰 Transferred ${amount} gold from ${fromCharacterId} to ${toCharacterId}`);
      } catch (error) {
        console.error(`❌ Error transferring gold:`, error);
        throw error;
      }
    }

// src/services/inventoryService.ts - Fix the getAllCharacterInventories method

  static async getAllCharacterInventories(characterIds: string[]): Promise<Character[]> {
    try {
      const characters: Character[] = [];

      for (const characterId of characterIds) {
        const characterRef = doc(db, 'characters', characterId);
        const characterSnap = await getDoc(characterRef);

        if (characterSnap.exists()) {
          const data = characterSnap.data();
          characters.push({
            id: characterId,
            name: data.name || 'Unknown',
            role: data.role || 'Unknown',
            inventory: data.inventory || [],
            gold: data.gold ?? 0, // Include gold with default of 0
            // Use ONLY the properties that exist in Character interface
            currentHP: data.currentHP || data.hp || 100,
            maxHP: data.maxHP || data.maxHp || 100,
            stats: data.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            abilities: data.abilities || [], // Required field
            level: data.level || 1, // Required field
            stance: data.stance,
            charges: data.charges,
            maxCharges: data.maxCharges,
            portraitUrl: data.portraitUrl,
            backgroundColor: data.backgroundColor
          });
        }
      }

      return characters;
    } catch (error) {
      console.error('❌ Error getting character inventories:', error);
      throw error;
    }
  }

    static async initializeGoldForAllCharacters(defaultGold: number = 0): Promise<void> {
      try {
        const characterIds = ['maelle', 'gustave', 'lune', 'sciel', 'verso']; // Your character IDs
        
        for (const characterId of characterIds) {
          const characterRef = doc(db, 'characters', characterId);
          const characterSnap = await getDoc(characterRef);
          
          if (characterSnap.exists()) {
            const data = characterSnap.data();
            
            // Only set gold if it doesn't already exist
            if (data.gold === undefined) {
              await updateDoc(characterRef, {
                gold: defaultGold,
                updatedAt: serverTimestamp()
              });
              console.log(`🪙 Initialized gold (${defaultGold}) for ${characterId}`);
            }
          }
        }
        
        console.log('✅ Gold initialization complete');
      } catch (error) {
        console.error('❌ Error initializing gold:', error);
        throw error;
      }
    }

  /**
   * Get a character's full data including inventory
   */
  static async getCharacterInventory(characterId: string): Promise<Character | null> {
    try {
      const characterRef = doc(db, 'characters', characterId);
      const characterSnap = await getDoc(characterRef);

      if (!characterSnap.exists()) {
        console.warn(`Character ${characterId} not found`);
        return null;
      }

      const data = characterSnap.data();
      return {
        id: characterSnap.id,
        ...data,
        inventory: data.inventory || [], // Ensure inventory exists
      } as Character;
    } catch (error) {
      console.error('❌ Failed to get character inventory:', error);
      return null;
    }
  }

  /**
   * Initialize empty inventory for a character (useful for existing characters)
   */
  static async initializeInventory(characterId: string): Promise<void> {
    try {
      const characterRef = doc(db, 'characters', characterId);
      
      await updateDoc(characterRef, {
        inventory: [],
        updatedAt: serverTimestamp(),
      });

      console.log(`✅ Initialized empty inventory for character ${characterId}`);
    } catch (error) {
      console.error('❌ Failed to initialize inventory:', error);
      throw new Error('Failed to initialize inventory');
    }
  }

  /**
   * Clear all items from a character's inventory
   */
  static async clearInventory(characterId: string): Promise<void> {
    try {
      const characterRef = doc(db, 'characters', characterId);
      
      await updateDoc(characterRef, {
        inventory: [],
        updatedAt: serverTimestamp(),
      });

      console.log(`✅ Cleared inventory for character ${characterId}`);
    } catch (error) {
      console.error('❌ Failed to clear inventory:', error);
      throw new Error('Failed to clear inventory');
    }
  }
}