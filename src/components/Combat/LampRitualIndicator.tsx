import React, { useEffect, useState } from 'react';
import { Clock, Zap, Shield } from 'lucide-react';

interface LampRitualIndicatorProps {
  ritual: {
    isActive: boolean;
    sequence: number[];
    playerAttempt: number[];
    damageReduction: number;
    willTriggerOnRound: number;
  } | null;
  currentRound: number;
}

export const LampRitualIndicator: React.FC<LampRitualIndicatorProps> = ({ 
  ritual, 
  currentRound 
}) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    if (!ritual || !ritual.isActive) return;

    const timer = setInterval(() => {
      const remaining = (ritual.willTriggerOnRound - currentRound) * 30; // Assume 30s per round
      setTimeRemaining(Math.max(0, remaining));
    }, 1000);

    return () => clearInterval(timer);
  }, [ritual, currentRound]);

  if (!ritual) return null;

  const getDamageText = () => {
    if (ritual.damageReduction === 100) return 'CANCELED';
    if (ritual.damageReduction === 0) return 'FULL DAMAGE';
    return `${100 - ritual.damageReduction}% DAMAGE`;
  };

  const getColorClass = () => {
    if (ritual.damageReduction >= 75) return 'text-green-400';
    if (ritual.damageReduction >= 50) return 'text-yellow-400';
    if (ritual.damageReduction >= 25) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-gray-900 bg-opacity-95 border-2 border-yellow-500 rounded-lg p-4 shadow-2xl">
        <div className="flex items-center space-x-2 mb-2">
          <Zap className="w-5 h-5 text-yellow-400 animate-pulse" />
          <h3 className="text-yellow-400 font-bold text-lg">LAMP RITUAL ACTIVE</h3>
          <Zap className="w-5 h-5 text-yellow-400 animate-pulse" />
        </div>
        
        {ritual.isActive ? (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-gray-300 text-sm">
                Attack lamps in sequence!
              </span>
            </div>
            
            {/* Sequence progress */}
            <div className="flex space-x-1">
              {ritual.sequence.map((_, index) => (
                <div
                  key={index}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                    index < ritual.playerAttempt.length
                      ? ritual.playerAttempt[index] === ritual.sequence[index]
                        ? 'bg-green-600 border-green-400'
                        : 'bg-red-600 border-red-400'
                      : 'bg-gray-700 border-gray-500'
                  }`}
                >
                  <span className="text-xs text-white">
                    {index + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-gray-400" />
              <span className="text-gray-300 text-sm">
                Damage on next turn:
              </span>
            </div>
            <div className={`text-2xl font-bold ${getColorClass()}`}>
              {getDamageText()}
            </div>
            <div className="text-xs text-gray-400">
              {ritual.playerAttempt.filter((lamp, idx) => 
                lamp === ritual.sequence[idx]
              ).length}/4 lamps correct
            </div>
          </div>
        )}
      </div>
    </div>
  );
};