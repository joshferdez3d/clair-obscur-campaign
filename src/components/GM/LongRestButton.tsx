// src/components/GM/LongRestButton.tsx
import React, { useState } from 'react';
import { Moon, Check, X } from 'lucide-react';
import { LongRestService } from '../../services/LongRestService';

export function LongRestButton() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isResting, setIsResting] = useState(false);
  
  const handleLongRest = async () => {
    setIsResting(true);
    try {
      await LongRestService.longRestParty();
      alert('✅ Long rest completed! All characters restored.');
      setShowConfirm(false);
    } catch (error) {
      console.error('Failed:', error);
      alert('❌ Failed to complete long rest.');
    } finally {
      setIsResting(false);
    }
  };
  
  if (showConfirm) {
    return (
      <div className="bg-blue-900 border-2 border-blue-500 rounded-lg p-4">
        <h3 className="font-bold text-blue-100 mb-2">Confirm Long Rest</h3>
        <p className="text-sm text-blue-200 mb-4">
          This will restore all characters to full HP and reset abilities.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleLongRest}
            disabled={isResting}
            className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded"
          >
            {isResting ? 'Resting...' : 'Confirm'}
          </button>
          <button
            onClick={() => setShowConfirm(false)}
            disabled={isResting}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded flex items-center justify-center gap-2"
    >
      <Moon className="w-5 h-5" />
      <span>Long Rest (GM)</span>
    </button>
  );
}