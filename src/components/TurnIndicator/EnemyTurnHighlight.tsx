// src/components/TurnIndicator/EnemyTurnHighlight.tsx

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Sword } from 'lucide-react';

interface EnemyTurnHighlightProps {
  enemyName: string;
  enemyType?: 'basic' | 'mini-boss' | 'boss';
  onDismiss?: () => void;
}

export const EnemyTurnHighlight: React.FC<EnemyTurnHighlightProps> = ({
  enemyName,
  enemyType = 'basic',
  onDismiss
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 500);
    return () => clearTimeout(timer);
  }, [enemyName]);

  const getHighlightColor = () => {
    switch(enemyType) {
      case 'boss': return 'from-purple-600 to-red-600';
      case 'mini-boss': return 'from-blue-600 to-purple-600';
      default: return 'from-orange-600 to-red-600';
    }
  };

  const getIcon = () => {
    switch(enemyType) {
      case 'boss': return <AlertTriangle className="w-6 h-6" />;
      default: return <Sword className="w-5 h-5" />;
    }
  };

  return (
    <div className={`
      fixed top-20 left-1/2 transform -translate-x-1/2 z-50
      ${isAnimating ? 'animate-pulse' : ''}
      transition-all duration-300 ease-in-out
    `}>
      <div className={`
        bg-gradient-to-r ${getHighlightColor()}
        text-white px-6 py-3 rounded-lg shadow-2xl
        border-2 border-white/20
        backdrop-blur-sm
      `}>
        <div className="flex items-center gap-3">
          <div className="animate-pulse">
            {getIcon()}
          </div>
          <div>
            <p className="text-sm font-semibold opacity-90">Enemy Turn</p>
            <p className="text-xl font-bold">{enemyName}</p>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="ml-4 text-white/70 hover:text-white transition-colors"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Enhanced Token component for enemy highlighting on the map
export const EnemyTokenHighlight: React.FC<{
  isActive: boolean;
  enemyType?: 'basic' | 'mini-boss' | 'boss';
  children: React.ReactNode;
}> = ({ isActive, enemyType = 'basic', children }) => {
  if (!isActive) return <>{children}</>;

  const getPulseColor = () => {
    switch(enemyType) {
      case 'boss': return 'shadow-purple-500/50';
      case 'mini-boss': return 'shadow-blue-500/50';
      default: return 'shadow-red-500/50';
    }
  };

  return (
    <div className={`
      relative
      ${isActive ? 'animate-pulse' : ''}
    `}>
      {/* Outer glow effect */}
      <div className={`
        absolute -inset-2 rounded-full
        ${isActive ? `shadow-2xl ${getPulseColor()} animate-ping` : ''}
        opacity-75
      `} />
      
      {/* Inner highlight ring */}
      <div className={`
        absolute -inset-1 rounded-full
        ${isActive ? 'ring-4 ring-red-400 ring-opacity-50' : ''}
      `} />
      
      {children}
    </div>
  );
};