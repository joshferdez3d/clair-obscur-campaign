import React from 'react';
import { Users, AlertCircle } from 'lucide-react';

interface NPCTurnIndicatorProps {
  npcName: string;
  isActive: boolean;
  controller: 'maelle' | 'sciel' | 'gm';
  onSwitchToTab?: () => void;
}

export function NPCTurnIndicator({ 
  npcName, 
  isActive, 
  controller,
  onSwitchToTab 
}: NPCTurnIndicatorProps) {
  if (!isActive) return null;

  const getControllerColor = () => {
    switch (controller) {
      case 'maelle': return 'from-clair-royal-600 to-clair-royal-800';
      case 'sciel': return 'from-green-600 to-green-800';
      default: return 'from-gray-600 to-gray-800';
    }
  };

  return (
    <div className={`fixed top-20 right-4 z-50 animate-pulse`}>
      <div className={`bg-gradient-to-br ${getControllerColor()} rounded-lg p-4 shadow-xl border-2 border-clair-gold-500`}>
        <div className="flex items-center space-x-3">
          <Users className="w-6 h-6 text-white" />
          <div>
            <p className="text-white font-bold text-lg">{npcName}'s Turn!</p>
            <p className="text-clair-gold-200 text-sm">
              {controller === 'maelle' && 'Controlled by Maelle'}
              {controller === 'sciel' && 'Controlled by Sciel'}
              {controller === 'gm' && 'GM Controlled'}
            </p>
          </div>
        </div>
        {onSwitchToTab && (
          <button
            onClick={onSwitchToTab}
            className="mt-3 w-full bg-clair-gold-600 hover:bg-clair-gold-700 text-clair-shadow-900 px-3 py-2 rounded font-bold transition-colors"
          >
            Switch to {npcName} Tab
          </button>
        )}
      </div>
    </div>
  );
}