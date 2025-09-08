// Create src/components/GM/ResetButton.tsx
import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, Check, X } from 'lucide-react';

interface ResetButtonProps {
  onReset: () => Promise<void>;
  disabled?: boolean;
}

export function ResetButton({ onReset, disabled = false }: ResetButtonProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await onReset();
      setShowConfirmation(false);
    } catch (error) {
      console.error('Reset failed:', error);
      // Keep confirmation open on error so user can try again
    }
    setIsResetting(false);
  };

  if (showConfirmation) {
    return (
      <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
        <div className="flex items-center mb-3">
          <AlertTriangle className="w-5 h-5 text-red-400 mr-2" />
          <h4 className="font-bold text-red-200">Reset Battle Session?</h4>
        </div>
        
        <div className="text-sm text-red-300 mb-4">
          <p className="mb-2">This will:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Remove all enemies, NPCs, and turrets</li>
            <li>End combat and clear initiative</li>
            <li>Reset all players to full HP</li>
            <li>Clear all pending actions</li>
            <li>Reset storm system</li>
          </ul>
          <p className="mt-2 font-bold">This cannot be undone!</p>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={handleReset}
            disabled={isResetting}
            className={`flex-1 px-3 py-2 rounded font-bold text-sm flex items-center justify-center ${
              isResetting 
                ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {isResetting ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full mr-2" />
                Resetting...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Confirm Reset
              </>
            )}
          </button>
          
          <button
            onClick={() => setShowConfirmation(false)}
            disabled={isResetting}
            className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-bold text-sm flex items-center"
          >
            <X className="w-4 h-4 mr-1" />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirmation(true)}
      disabled={disabled}
      className={`w-full px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center transition-colors ${
        disabled 
          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
          : 'bg-orange-600 hover:bg-orange-700 text-white border border-orange-500'
      }`}
    >
      <RotateCcw className="w-4 h-4 mr-2" />
      Reset Session
    </button>
  );
}
