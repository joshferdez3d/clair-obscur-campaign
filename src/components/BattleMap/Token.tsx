// src/components/BattleMap/Token.tsx - Fixed with defensive programming
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
  coordinateOffset?: Position;
  isHighlighted?: boolean;
  isStormTarget?: boolean;
  isEnemyGroupActive?: boolean;  // ADD THIS
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
  isHighlighted = false,
  isStormTarget,
  isEnemyGroupActive = false,  // ADD THIS with default value
  coordinateOffset = { x: 0, y: 0 }
}: TokenProps) {
  // DEFENSIVE PROGRAMMING: Ensure token has valid position
  if (!token) {
    console.error('Token component received undefined token');
    return null;
  }

  // Provide default position if missing
  const safePosition = token.position || { x: 0, y: 0 };
  
  // Validate position properties
  if (typeof safePosition.x !== 'number' || typeof safePosition.y !== 'number') {
    console.error('Token has invalid position:', token.id, safePosition);
    return null;
  }

  const tokenSize = gridSize * (token.size || 1);
  const left = (safePosition.x * gridSize) + coordinateOffset.x;
  const top = (safePosition.y * gridSize) + coordinateOffset.y;

  const getTokenColor = (token: BattleToken): string => {
    if (token.color) return token.color;
    
    switch (token.type) {
      case 'player':
        return '#4f46e5'; // Blue
      case 'enemy':
        return '#dc2626'; // Red
      case 'npc':
        return '#16a34a'; // Green
      default:
        return '#6b7280'; // Gray
    }
  };

  const getTokenBorder = () => {
    switch (token.characterId?.toLowerCase()) {
      case 'maelle':
        return 'border-clair-royal-400';
      case 'gustave':
        return 'border-red-500';
      case 'lune':
        return 'border-clair-mystical-500';
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

  const getTokenImage = (token: BattleToken): string | null => {
    // For player tokens
    if (token.type === 'player' && token.characterId) {
      const imagePath = `/tokens/characters/${token.characterId}.jpg`;
      return imagePath;
    }
    
    // For enemy tokens - Manual mapping
    if (token.type === 'enemy' && token.name) {
      const enemyImageMap: { [key: string]: string } = {
        'Bénisseur': 'Benisseur_Image.png',
        'Brûler': 'Bruler_Image.png',
        'Lancelier': 'Lancelier_Image.png',
        'Noir Harbinger': 'Noir_Harbinger_Image.png',
        'Portier': 'Portier_Image.png',
        'Volester': 'Volester_Image.png',
        'Demineur': 'Demineur_Image.png',
        'Luster': 'Luster_Image.png'
      };
      
      const filename = enemyImageMap[token.name];
      if (filename) {
        return `/tokens/enemies/${filename}`;
      }
      
      return '/tokens/enemies/default-enemy.png';
    }
    
    // For NPC tokens - Manual mapping
    if (token.type === 'npc' && token.name) {
      const npcImageMap: { [key: string]: string } = {
        'The Child': 'childofgommage.png', // Changed from 'The Child of the Gommage'
        'The Farmhand': 'farmhand-fighter.png', // Changed from 'The Farmhand Turned Fighter'
        'The Child of the Gommage': 'childofgommage.png',
        'The Farmhand Turned Fighter': 'farmhand-fighter.png',
        'The Gambler': 'gambler.png',
        'The New Recruit': 'new-recruit.png',
        'The Zealot': 'zealot.png',
        'The Veteran': 'veteran.png',
        'The Scholar\'s Apprentice': 'apprentice.png',
        'The Lost Lover': 'lover.png',
        "Gustave's Turret": 'turret.png',
        "Brother's Sword": 'sword.png',
      };
      
      const filename = npcImageMap[token.name];
      if (filename) {
        return `/tokens/npc/${filename}`;
      }
      
      return '/tokens/npc/default-npc.png';
    }
    
    return null;
  };

  const tokenImage = getTokenImage(token);

  return (
    <div
      className={`absolute cursor-pointer transition-all duration-200 ${
        isSelected ? 'z-30 scale-110' : 'z-20'
      } ${isDragging ? 'opacity-60' : ''} ${
        isValidTarget ? 'ring-4 ring-purple-400 ring-opacity-80' : ''
      } ${isCurrentTurn ? 'ring-2 ring-yellow-400 ring-opacity-90' : ''} 
        ${isHighlighted ? 'ring-4 ring-red-500 ring-opacity-100 animate-pulse' : ''}
        ${isStormTarget ? 'storm-target' : ''}
        ${isEnemyGroupActive ? 'animate-pulse ring-2 ring-orange-500 shadow-lg shadow-orange-500/50' : ''}`} 
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
          } ${isHighlighted ? 'border-red-500 border-opacity-100' : ''}`}
        style={{
          backgroundColor: getTokenColor(token),
          boxShadow: isHighlighted
            ? '0 0 30px rgba(239, 68, 68, 0.8)'
            : isSelected
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

      {/* Targeting Indicator */}
      {isValidTarget && (
        <div className="absolute inset-0 rounded-full bg-purple-400 bg-opacity-30 border-2 border-purple-400 animate-pulse" />
      )}

      {/* Status Effect Indicators */}
      {token.statusEffects && (
        <div className="absolute -top-2 -left-2 flex gap-1">
          {token.statusEffects.fire && (
            <div className="w-3 h-3 bg-red-500 rounded-full border border-red-400 flex items-center justify-center">
              <span className="text-xs text-white font-bold">🔥</span>
            </div>
          )}
          
          {token.statusEffects.ice && (
            <div className="w-3 h-3 bg-blue-500 rounded-full border border-blue-400 flex items-center justify-center">
              <span className="text-xs text-white font-bold">❄️</span>
            </div>
          )}
          
          {token.statusEffects.blind && (
            <div className="w-3 h-3 bg-gray-700 rounded-full border border-gray-600 flex items-center justify-center">
              <span className="text-xs text-white font-bold">👁️</span>
            </div>
          )}
          
          {token.statusEffects.advantage && (
            <div className="w-3 h-3 bg-green-500 rounded-full border border-green-400 flex items-center justify-center">
              <span className="text-xs text-white font-bold">+</span>
            </div>
          )}
          
          {token.statusEffects.disadvantage && (
            <div className="w-3 h-3 bg-red-600 rounded-full border border-red-500 flex items-center justify-center">
              <span className="text-xs text-white font-bold">-</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}