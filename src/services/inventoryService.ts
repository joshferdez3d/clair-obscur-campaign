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

  /**
   * Get all characters with their inventories (useful for GM overview)
   */
  static async getAllCharacterInventories(characterIds: string[]): Promise<Character[]> {
    try {
      const characters: Character[] = [];
      
      for (const characterId of characterIds) {
        const character = await this.getCharacterInventory(characterId);
        if (character) {
          characters.push(character);
        }
      }
      
      return characters;
    } catch (error) {
      console.error('❌ Failed to get all character inventories:', error);
      return [];
    }
  }
}