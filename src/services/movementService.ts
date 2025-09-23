// src/services/movementService.ts
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Position, BattleToken } from '../types';

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