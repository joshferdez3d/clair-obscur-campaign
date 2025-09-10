// src/components/BattleMap/Token.tsx - Updated with coordinate offset support and no name tags
import React from 'react';
import { User, Heart } from 'lucide-react';
import type { BattleToken, Position } from '../../types';

interface TokenProps {
  token: BattleToken;
  gridSize: number;
  isSelected?: boolean;
  isDragging?: boolean;
  isCurrentTurn?: boolean;
  isValidTarget?: boolean;
  onClick?: (token: BattleToken) => void;
  onDragStart?: (token: BattleToken, event: React.DragEvent) => void;
  onDragEnd?: (token: BattleToken) => void;
  coordinateOffset?: Position; // New prop for coordinate padding
}

export function Token({ 
  token, 
  gridSize, 
  isSelected = false, 
  isDragging = false,
  isCurrentTurn = false,
  isValidTarget = false,
  onClick,
  onDragStart,
  onDragEnd,
  coordinateOffset = { x: 0, y: 0 } // Default to no offset
}: TokenProps) {
  const tokenSize = gridSize * (token.size || 1);
  const left = (token.position.x * gridSize) + coordinateOffset.x;
  const top = (token.position.y * gridSize) + coordinateOffset.y;

  const getCharacterImage = (characterId: string) => {
    const imageMap: { [key: string]: string } = {
      'gustave': '/tokens/characters/gustave.jpg', // Image 2
      'lune': '/tokens/characters/lune.jpg',       // Image 3  
      'maelle': '/tokens/characters/maelle.jpg',   // Image 4
      'sciel': '/tokens/characters/sciel.jpg'      // Image 5
    };
    return imageMap[characterId?.toLowerCase()] || null;
  };

  const getTokenColor = () => {
    if (token.color) return token.color;
    
    switch (token.characterId?.toLowerCase()) {
      case 'maelle':
        return '#3B82F6'; // NEW: Royal blue (was #6B46C1 purple)
      case 'gustave':
        return '#800020'; // Burgundy
      case 'lune':
        return '#581C87'; // Deep purple (unchanged)
      case 'sciel':
        return '#355E3B'; // Forest green
      default:
        switch (token.type) {
          case 'player':
            return '#4f46e5';
          case 'enemy':
            return '#dc2626';
          case 'npc':
            return '#16a34a';
          default:
            return '#6b7280';
        }
    }
  };

  const getEnemyImage = (enemyName: string) => {
    // Normalize the enemy name to match your image file names
    const normalizedName = enemyName.toLowerCase().replace(/[^a-z]/g, '');
    
    const enemyImageMap: { [key: string]: string } = {
      'benisseur': '/tokens/enemies/Benisseur_Image.png',
      'bruler': '/tokens/enemies/Bruler_Image.png', 
      'lancelier': '/tokens/enemies/Lancelier_Image.png',
      'noirharbinger': '/tokens/enemies/Noir_Harbinger_Image.png',
      'portier': '/tokens/enemies/Portier_Image.png',
      'volester': '/tokens/enemies/Volester_Image.png'
    };
    
    return enemyImageMap[normalizedName] || null;
  };

  const getTokenBorder = () => {
    switch (token.characterId?.toLowerCase()) {
      case 'maelle':
        return 'border-clair-royal-400'; // NEW: Royal blue border (was clair-mystical-400)
      case 'gustave':
        return 'border-red-500';
      case 'lune':
        return 'border-clair-mystical-500'; // Unchanged - keeping purple
      case 'sciel':
        return 'border-green-500';
      default:
        return 'border-clair-gold-400';
    }
  };


  const getHPPercentage = () => {
    if (!token.hp || !token.maxHp) return 100;
    return (token.hp / token.maxHp) * 100;
  };

  const getHPColor = () => {
    const percentage = getHPPercentage();
    if (percentage > 60) return '#10b981';
    if (percentage > 30) return '#f59e0b';
    return '#ef4444';
  };

  const handleDragStart = (event: React.DragEvent) => {
    if (onDragStart) {
      onDragStart(token, event);
    }
    event.dataTransfer.setData('text/plain', token.id);
  };

  const handleClick = () => {
    if (onClick) {
      onClick(token);
    }
  };

const getTokenImage = () => {
    // For player characters, use character ID
    if (token.characterId) {
      return getCharacterImage(token.characterId);
    }
    
    // For enemy tokens, use enemy name
    if (token.type === 'enemy') {
      return getEnemyImage(token.name);
    }
    
    // For NPCs or other types, no image
    return null;
  };

  const tokenImage = getTokenImage();

  return (
    <div
      className={`absolute cursor-pointer transition-all duration-200 ${
        isSelected ? 'z-30 scale-110' : 'z-20'
      } ${isDragging ? 'opacity-60' : ''} ${
        isValidTarget ? 'ring-4 ring-purple-400 ring-opacity-80' : ''
      } ${isCurrentTurn ? 'ring-2 ring-yellow-400 ring-opacity-90' : ''}`}
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${tokenSize}px`,
        height: `${tokenSize}px`,
      }}
      onClick={handleClick}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={() => onDragEnd?.(token)}
    >
      {/* Token Base Circle */}
      <div
        className={`w-full h-full rounded-full border-4 ${getTokenBorder()} shadow-lg relative overflow-hidden ${
          isSelected ? 'ring-2 ring-white ring-opacity-60' : ''
        }`}
        style={{
          backgroundColor: getTokenColor(),
          boxShadow: isSelected
            ? '0 0 20px rgba(255, 255, 255, 0.5)'
            : '0 4px 8px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Character Image */}
        {tokenImage ? (
          <img
            src={tokenImage}
            alt={token.name}
            className="w-full h-full object-cover"
            style={{ imageRendering: 'crisp-edges' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="w-6 h-6 text-white" />
          </div>
        )}

        {/* Current Turn Indicator */}
        {isCurrentTurn && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border border-yellow-300 animate-pulse" />
        )}

        {/* Selection Indicator */}
        {isSelected && (
          <div className="absolute inset-0 rounded-full bg-white bg-opacity-20 border-2 border-white border-opacity-60" />
        )}
      </div>

      {/* HP Bar */}
      {token.hp !== undefined && token.maxHp !== undefined && (
        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-8 h-1.5 bg-gray-800 rounded-full border border-gray-600">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${getHPPercentage()}%`,
              backgroundColor: getHPColor(),
            }}
          />
        </div>
      )}

      {/* Name Label - REMOVED to save screen space */}
      {/* 
      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
        <div className="bg-gray-900 bg-opacity-80 text-white text-xs px-2 py-1 rounded border border-gray-600">
          {token.name}
        </div>
      </div>
      */}

      {/* Targeting Indicator */}
      {isValidTarget && (
        <div className="absolute inset-0 rounded-full bg-purple-400 bg-opacity-30 border-2 border-purple-400 animate-pulse" />
      )}
    </div>
  );
}