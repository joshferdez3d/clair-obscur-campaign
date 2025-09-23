// src/components/Combat/MovementInput.tsx
import React, { useState, useEffect } from 'react';
import { Move, Check, X, AlertCircle } from 'lucide-react';
import type { Position, BattleToken } from '../../types';

interface MovementInputProps {
  token: BattleToken | null;
  currentPosition: Position;
  maxRange: number; // in feet
  gridSize: { width: number; height: number };
  onMove: (newPosition: Position) => Promise<boolean>;
  isMyTurn: boolean;
  characterName: string;
}

export function MovementInput({
  token,
  currentPosition,
  maxRange,
  gridSize,
  onMove,
  isMyTurn,
  characterName
}: MovementInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<string | null>(null);

  // Convert position to chess notation (A1, B2, etc.)
  const positionToChessNotation = (pos: Position): string => {
    const letter = String.fromCharCode(65 + pos.x); // A, B, C...
    const number = pos.y + 1; // 1, 2, 3...
    return `${letter}${number}`;
  };

  // Parse chess notation to position
  const parseChessNotation = (notation: string): Position | null => {
    const cleaned = notation.trim().toUpperCase();
    const match = cleaned.match(/^([A-Z])(\d+)$/);
    
    if (!match) return null;
    
    const x = match[1].charCodeAt(0) - 65; // Convert letter to x coordinate
    const y = parseInt(match[2]) - 1; // Convert number to y coordinate
    
    // Validate bounds
    if (x < 0 || x >= gridSize.width || y < 0 || y >= gridSize.height) {
      return null;
    }
    
    return { x, y };
  };

  // Calculate Chebyshev distance (D&D 5e diagonal movement)
  const calculateDistance = (from: Position, to: Position): number => {
    const dx = Math.abs(from.x - to.x);
    const dy = Math.abs(from.y - to.y);
    return Math.max(dx, dy); // Diagonal counts as 1 square
  };

  // Get movement range in squares based on character
  const getMovementSquares = (): number => {
    // Convert feet to squares (5 feet = 1 square)
    const baseSquares = maxRange / 5;
    
    // Special case for Maelle
    if (characterName.toLowerCase() === 'maelle') {
      return 3; // Maelle gets 3 squares (15ft)
    }
    
    return Math.min(baseSquares, 2); // Default 2 squares (10ft)
  };

  // Validate move
  const validateMove = (destination: Position): { valid: boolean; reason?: string } => {
    if (!isMyTurn) {
      return { valid: false, reason: "It's not your turn!" };
    }

    if (!token) {
      return { valid: false, reason: "No token to move!" };
    }

    const distance = calculateDistance(currentPosition, destination);
    const maxSquares = getMovementSquares();

    if (distance > maxSquares) {
      return { 
        valid: false, 
        reason: `Too far! You can move ${maxSquares} squares (${maxSquares * 5}ft), but that's ${distance} squares away.` 
      };
    }

    return { valid: true };
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setInputValue(value);
    setError(null);
    
    // Auto-validate as user types
    if (value.length >= 2) {
      const position = parseChessNotation(value);
      if (!position) {
        setError('Invalid coordinate format (use A1, B2, etc.)');
      } else {
        const validation = validateMove(position);
        if (!validation.valid) {
          setError(validation.reason || 'Invalid move');
        }
      }
    }
  };

  // Handle move submission
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!inputValue) {
      setError('Enter a coordinate (e.g., E7)');
      return;
    }

    const destination = parseChessNotation(inputValue);
    if (!destination) {
      setError('Invalid coordinate format');
      return;
    }

    const validation = validateMove(destination);
    if (!validation.valid) {
      setError(validation.reason || 'Invalid move');
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const success = await onMove(destination);
      if (success) {
        setLastMove(inputValue);
        setInputValue('');
        setError(null);
      } else {
        setError('Move failed - square may be occupied');
      }
    } catch (err) {
      setError('Failed to move token');
      console.error('Movement error:', err);
    } finally {
      setIsValidating(false);
    }
  };

  // Current position display
  const currentPos = positionToChessNotation(currentPosition);
  const maxSquares = getMovementSquares();

  return (
    <div className="bg-clair-shadow-700 rounded-lg p-4 border border-clair-gold-600">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-clair-gold-400 flex items-center">
          <Move className="w-4 h-4 mr-2" />
          Grid Movement
        </h3>
        <span className="text-xs text-clair-gold-300">
          {maxSquares} squares ({maxSquares * 5}ft)
        </span>
      </div>

      {/* Current Position Display */}
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="text-clair-gold-300">Current Position:</span>
        <span className="font-bold text-white bg-clair-shadow-600 px-2 py-1 rounded">
          {currentPos}
        </span>
      </div>

      {/* Movement Input Form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Enter coordinate (e.g., E7)"
            disabled={!isMyTurn || isValidating}
            className={`
              w-full px-3 py-2 bg-clair-shadow-600 border rounded-lg
              text-white placeholder-gray-400 font-mono text-sm
              focus:outline-none focus:ring-2 transition-colors
              ${error 
                ? 'border-red-500 focus:ring-red-500' 
                : 'border-clair-gold-600 focus:ring-clair-gold-500 focus:border-clair-gold-500'
              }
              ${!isMyTurn ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            maxLength={3}
          />
          
          {/* Validation Icon */}
          {inputValue && (
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
              {error ? (
                <X className="w-4 h-4 text-red-500" />
              ) : inputValue.length >= 2 && parseChessNotation(inputValue) ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : null}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-start space-x-2 p-2 bg-red-900 bg-opacity-30 border border-red-500 rounded text-xs">
            <AlertCircle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
            <span className="text-red-300">{error}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isMyTurn || !inputValue || !!error || isValidating}
          className={`
            w-full py-2 px-4 rounded-lg font-bold text-sm transition-colors
            flex items-center justify-center
            ${!isMyTurn || !inputValue || !!error
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-clair-gold-600 hover:bg-clair-gold-700 text-clair-shadow-900'
            }
          `}
        >
          {isValidating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-clair-shadow-900 border-t-transparent mr-2" />
              Moving...
            </>
          ) : (
            <>
              <Move className="w-4 h-4 mr-2" />
              Move to {inputValue || '...'}
            </>
          )}
        </button>
      </form>

      {/* Last Move Display */}
      {lastMove && (
        <div className="mt-2 text-xs text-green-400 text-center">
          ✓ Moved to {lastMove}
        </div>
      )}

      {/* Movement Guide */}
      {!isMyTurn && (
        <div className="mt-3 p-2 bg-yellow-900 bg-opacity-30 border border-yellow-600 rounded text-xs text-yellow-300">
          Wait for your turn to move
        </div>
      )}
    </div>
  );
}