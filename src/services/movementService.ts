// src/services/movementService.ts
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Position, BattleToken } from '../types';
import { MineService } from './MineService';

export class MovementService {
  /**
   * Validate if a movement is legal
   */
  static validateMovement(
    token: BattleToken,
    destination: Position,
    maxRange: number,
    occupiedPositions: Position[]
  ): { valid: boolean; reason?: string } {
    // Check if destination is occupied
    const isOccupied = occupiedPositions.some(
      pos => pos.x === destination.x && pos.y === destination.y
    );
    
    if (isOccupied) {
      return { valid: false, reason: 'Square is occupied' };
    }

    // Calculate distance (Chebyshev distance for D&D movement)
    const dx = Math.abs(token.position.x - destination.x);
    const dy = Math.abs(token.position.y - destination.y);
    const distance = Math.max(dx, dy);
    const maxSquares = maxRange / 5; // Convert feet to squares

    if (distance > maxSquares) {
      return { 
        valid: false, 
        reason: `Movement exceeds range (${distance} > ${maxSquares} squares)` 
      };
    }

    return { valid: true };
  }

  /**
   * Move a token to a new position
   * NOW WITH MINE CHECKING!
   */
  static async moveToken(
    sessionId: string,
    tokenId: string,
    newPosition: Position
  ): Promise<boolean> {
    try {
      const sessionRef = doc(db, 'battleSessions', sessionId);
      const sessionDoc = await getDoc(sessionRef);
      
      if (!sessionDoc.exists()) {
        console.error('Session not found');
        return false;
      }

      const sessionData = sessionDoc.data();
      const tokens = sessionData.tokens || {};
      const token = tokens[tokenId];

      if (!token) {
        console.error('Token not found');
        return false;
      }

      // Store the original position before moving
      const originalPosition = { ...token.position };

      // === MINE CHECKING LOGIC ===
      // Check if there's a mine at the destination
      const mine = MineService.hasMineAtPosition(sessionData, newPosition);
      
      if (mine && !mine.isDetected) {
        console.log(`💥 ${token.name} stepped on a mine at (${newPosition.x}, ${newPosition.y})!`);
        
        // First, move the token to the mine position briefly so they "step on it"
        await updateDoc(sessionRef, {
          [`tokens.${tokenId}.position`]: newPosition,
          lastUpdated: new Date()
        });

        // Trigger the mine (this handles damage and spawning enemies)
        await MineService.triggerMine(sessionId, mine.id, tokenId);
        
        // Wait a brief moment for the explosion to register
        await new Promise(resolve => setTimeout(resolve, 300));

        // Move the player BACK to their original position
        await updateDoc(sessionRef, {
          [`tokens.${tokenId}.position`]: originalPosition,
          lastUpdated: new Date()
        });

        console.log(`⬅️ ${token.name} moved back to (${originalPosition.x}, ${originalPosition.y}) after mine explosion`);

        // Alert the player about the mine (only for players, not enemies)
        if (token.type !== 'enemy') {
          setTimeout(() => {
            alert(`💥 MINE TRIGGERED!\n${token.name} stepped on a mine!\n${mine.damage} damage dealt to nearby tokens!\nA Demineur has spawned!\n\nYou've been moved back to your previous position.`);
          }, 500);
        }
        
        return true; // Return true because the action completed (even though they didn't stay at destination)
      }

      // === NO MINE - PROCEED WITH NORMAL MOVEMENT ===
      
      // Only reveal squares during combat when mines are present
      if (sessionData.combatState?.isActive && sessionData.mines && sessionData.mines.length > 0) {
        const posKey = `${newPosition.x}-${newPosition.y}`;
        if (!sessionData.revealedSquares?.[posKey]) {
          // Reveal this square
          await MineService.revealSquare(sessionId, newPosition);
        }
      }

      // Update token position
      await updateDoc(sessionRef, {
        [`tokens.${tokenId}.position`]: newPosition,
        lastUpdated: new Date()
      });

      console.log(`Token ${tokenId} moved to (${newPosition.x}, ${newPosition.y})`);
      return true;
    } catch (error) {
      console.error('Error moving token:', error);
      return false;
    }
  }

  /**
   * Get movement range for a character
   */
  static getMovementRange(characterName: string): number {
    // Special movement ranges
    const movementRanges: { [key: string]: number } = {
      'maelle': 15, // 3 squares
      'default': 10  // 2 squares
    };

    return movementRanges[characterName.toLowerCase()] || movementRanges.default;
  }

  /**
   * Convert grid position to chess notation
   */
  static toChessNotation(position: Position): string {
    const letter = String.fromCharCode(65 + position.x);
    const number = position.y + 1;
    return `${letter}${number}`;
  }

  /**
   * Parse chess notation to grid position
   */
  static fromChessNotation(notation: string): Position | null {
    const cleaned = notation.trim().toUpperCase();
    const match = cleaned.match(/^([A-Z])(\d+)$/);
    
    if (!match) return null;
    
    const x = match[1].charCodeAt(0) - 65;
    const y = parseInt(match[2]) - 1;
    
    return { x, y };
  }
}