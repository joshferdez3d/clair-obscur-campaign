// src/components/BattleMap/Token.tsx - Fixed version
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
  onDragStart?: (token: BattleToken, event: React.DragEvent | React.TouchEvent) => void;  // ← CHANGE THIS LINE
  onDragEnd?: (token: BattleToken) => void;
  coordinateOffset?: Position;
  isHighlighted?: boolean;
  isStormTarget?: boolean;
  isEnemyGroupActive?: boolean;
  session?: any; // Add this for lamp state
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
  isEnemyGroupActive = false,
  coordinateOffset = { x: 0, y: 0 },
  session // Add this
}: TokenProps) {
  if (!token) {
    console.error('Token component received undefined token');
    return null;
  }

  const safePosition = token.position || { x: 0, y: 0 };
  const isLampToken = token.id.startsWith('lamp-');
  
  // Extract lamp index from token ID if it's a lamp
  const lampIndex = isLampToken ? parseInt(token.id.split('-')[1]) : undefined;
  const lampGlowState = session?.lampGlowState?.[lampIndex || 0] || false;
  const lampFeedback = session?.lampFeedback?.[lampIndex || 0] || null;

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
        return '#4f46e5';
      case 'enemy':
        return '#dc2626';
      case 'npc':
        return '#16a34a';
      default:
        return '#6b7280';
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

  const handleTouchStart = (event: React.TouchEvent) => {
    // Prevent default to stop scrolling
    event.preventDefault();
    if (onDragStart) {
      onDragStart(token, event);
    }
  };
  
  const handleClick = () => {
    if (onClick) {
      onClick(token);
    }
  };


  const getTokenImage = (token: BattleToken): string | null => {
    if (token.type === 'player' && token.characterId) {
      return `/tokens/characters/${token.characterId}.jpg`;
    }
    
    if (token.type === 'enemy' && token.name) {
      const enemyImageMap: { [key: string]: string } = {
        'Bénisseur': 'Benisseur_Image.png',
        'Brûler': 'Bruler_Image.png',
        'Lancelier': 'Lancelier_Image.png',
        'Noir Harbinger': 'Noir_Harbinger_Image.png',
        'Portier': 'Portier_Image.png',
        'Volester': 'Volester_Image.png',
        'Demineur': 'Demineur_Image.png',
        'Sentinel Luster': 'Luster_Image.png',
        'Lampmaster': 'Lampmaster_Image.png'  // ADD THIS LINE
      };
      
      const filename = enemyImageMap[token.name];
      if (filename) {
        return `/tokens/enemies/${filename}`;
      }
      return '/tokens/enemies/default-enemy.png';
    }
    
    if (token.type === 'npc' && token.name) {
      const npcImageMap: { [key: string]: string } = {
        'The Child': 'childofgommage.png',
        'The Farmhand': 'farmhand-fighter.png',
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

  // Build className string properly
  let className = `absolute cursor-pointer transition-all duration-200`;
  if (isSelected) className += ' z-30 scale-110';
  else className += ' z-20';
  if (isDragging) className += ' opacity-60';
  if (isValidTarget) className += ' ring-4 ring-purple-400 ring-opacity-80';
  if (isCurrentTurn) className += ' ring-2 ring-yellow-400 ring-opacity-90';
  if (isHighlighted) className += ' ring-4 ring-red-500 ring-opacity-100 animate-pulse';
  if (isStormTarget) className += ' storm-target';
  if (isEnemyGroupActive) className += ' animate-pulse ring-2 ring-orange-500 shadow-lg shadow-orange-500/50';
  if (isLampToken && lampGlowState) className += ' lamp-glowing';
  if (isLampToken && lampFeedback === 'correct') className += ' lamp-correct';
  if (isLampToken && lampFeedback === 'incorrect') className += ' lamp-incorrect';

  return (
    <div
      className={className}
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${tokenSize}px`,
        height: `${tokenSize}px`,
      }}
      onClick={handleClick}
      draggable={!isLampToken}
      onDragStart={handleDragStart}
      onDragEnd={() => onDragEnd?.(token)}
      onTouchStart={!isLampToken ? handleTouchStart : undefined}  // ← ADD THIS LINE
      onTouchEnd={() => !isLampToken && onDragEnd?.(token)} 
    >
      {/* Special rendering for lamp tokens */}
      {isLampToken ? (
        <div className="w-full h-full relative">
          <div
            className={`w-full h-full rounded-full border-4 shadow-lg relative overflow-hidden ${
              lampGlowState ? 'border-yellow-300' : 'border-orange-600'
            }`}
            style={{
              backgroundColor: lampGlowState ? '#FFD700' : '#FFA500',
              boxShadow: lampGlowState
                ? '0 0 40px rgba(255, 215, 0, 1)'
                : lampFeedback === 'correct'
                ? '0 0 30px rgba(0, 255, 0, 0.8)'
                : lampFeedback === 'incorrect'
                ? '0 0 30px rgba(255, 0, 0, 0.8)'
                : '0 4px 8px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-2xl">
                {lampGlowState ? '💡' : '🏮'}
              </span>
            </div>
            <div className="absolute bottom-1 right-1 bg-black bg-opacity-50 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {(lampIndex || 0) + 1}
            </div>
          </div>
          {lampGlowState && (
            <div className="absolute inset-0 rounded-full animate-pulse-glow-lamp pointer-events-none" />
          )}
          {lampFeedback && (
            <div className={`absolute inset-0 rounded-full pointer-events-none ${
              lampFeedback === 'correct' ? 'bg-green-500' : 'bg-red-500'
            } bg-opacity-30 animate-ping`} />
          )}
        </div>
      ) : (
        /* Regular token rendering */
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
          {tokenImage ? (
            <img
              src={tokenImage}
              alt={token.name}
              className={`w-full h-full object-cover ${
                (token.hp ?? 0) <= 0 && (token.type === 'player' || token.type === 'npc') 
                  ? 'grayscale opacity-40' 
                  : ''
              }`}
              style={{ imageRendering: 'crisp-edges' }}
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${
              (token.hp ?? 0) <= 0 && (token.type === 'player' || token.type === 'npc')
                ? 'grayscale opacity-40' 
                : ''
            }`}>
              <User className="w-6 h-6 text-white" />
            </div>
          )}

          {isCurrentTurn && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border border-yellow-300 animate-pulse" />
          )}

          {isSelected && (
            <div className="absolute inset-0 rounded-full bg-white bg-opacity-20 border-2 border-white border-opacity-60" />
          )}
        </div>
      )}

      {/* Status indicators and other overlays go here */}
      {isValidTarget && (
        <div className="absolute inset-0 rounded-full bg-purple-400 bg-opacity-30 border-2 border-purple-400 animate-pulse" />
      )}

      {/* Status Effect Indicators - simplified for brevity */}
      {token.statusEffects && (
        <div className="absolute -top-2 -left-2 flex gap-1">
          {/* Add your status effect indicators here */}
        </div>
      )}
    </div>
  );
}