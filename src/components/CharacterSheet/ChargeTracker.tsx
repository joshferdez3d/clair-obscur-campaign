import React from 'react';
import { Battery, Plus, Minus } from 'lucide-react';

interface ChargeTrackerProps {
  currentCharges: number;
  maxCharges: number;
  chargeName: string;
  onChargeChange: (delta: number) => void;
  isLoading?: boolean;
  color?: string;
}

export function ChargeTracker({ 
  currentCharges, 
  maxCharges, 
  chargeName,
  onChargeChange, 
  isLoading = false,
  color = 'blue'
}: ChargeTrackerProps) {
  const getColorClasses = () => {
    switch (color) {
      case 'blue':
        return {
          bg: 'bg-blue-500',
          text: 'text-blue-500',
          button: 'bg-blue-500 hover:bg-blue-600',
          border: 'border-blue-500'
        };
      case 'red':
        return {
          bg: 'bg-clair-danger',
          text: 'text-red-500',
          button: 'bg-clair-danger hover:bg-red-600',
          border: 'border-red-500'
        };
      case 'green':
        return {
          bg: 'bg-clair-success',
          text: 'text-green-500',
          button: 'bg-clair-success hover:bg-green-600',
          border: 'border-green-500'
        };
      case 'purple':
        return {
          bg: 'bg-clair-mystical-500',
          text: 'text-clair-mystical-500',
          button: 'bg-clair-mystical-500 hover:bg-clair-mystical-600',
          border: 'border-clair-mystical-500'
        };
      case 'yellow':
        return {
          bg: 'bg-clair-warning',
          text: 'text-yellow-500',
          button: 'bg-clair-warning hover:bg-yellow-600',
          border: 'border-yellow-500'
        };
      case 'royal':
        return {
          bg: 'bg-clair-royal-500',
          text: 'text-clair-royal-500',
          button: 'bg-clair-royal-500 hover:bg-clair-royal-600',
          border: 'border-clair-royal-500'
        };
      default:
        return {
          bg: 'bg-blue-500',
          text: 'text-blue-500',
          button: 'bg-blue-500 hover:bg-blue-600',
          border: 'border-blue-500'
        };
    }
  };

  const colorClasses = getColorClasses();

  return (
    <div className="bg-clair-shadow-600 rounded-lg shadow-shadow p-4 mb-4 border border-clair-gold-600">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <Battery className={`w-6 h-6 ${colorClasses.text} mr-2`} />
          <h3 className="font-display text-lg font-bold text-clair-gold-400">{chargeName}</h3>
        </div>
        <div className="font-serif text-2xl font-bold text-clair-gold-50">
          {currentCharges} / {maxCharges}
        </div>
      </div>
      
      {/* Charge Indicators */}
      <div className="flex justify-center space-x-2 mb-4">
        {Array.from({ length: maxCharges }).map((_, index) => (
          <div
            key={index}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
              index < currentCharges 
                ? `${colorClasses.bg} border-transparent shadow-lg` 
                : 'bg-clair-shadow-800 border-clair-shadow-400'
            }`}
          />
        ))}
      </div>
      
      {/* Charge Control Buttons */}
      <div className="flex justify-center space-x-4">
        <button
          onClick={() => onChargeChange(-1)}
          disabled={isLoading || currentCharges <= 0}
          className="flex items-center justify-center w-12 h-12 bg-clair-danger hover:bg-red-600 text-white rounded-full shadow-lg active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-sans"
          style={{ minHeight: '48px', minWidth: '48px' }}
        >
          <Minus className="w-6 h-6" />
        </button>
        
        <button
          onClick={() => onChargeChange(1)}
          disabled={isLoading || currentCharges >= maxCharges}
          className={`flex items-center justify-center w-12 h-12 ${colorClasses.button} text-white rounded-full shadow-lg active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-sans`}
          style={{ minHeight: '48px', minWidth: '48px' }}
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}