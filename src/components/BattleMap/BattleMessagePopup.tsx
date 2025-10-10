// src/components/BattleMap/BattleMessagePopup.tsx
import React, { useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Zap, Shield } from 'lucide-react';

interface BattleMessagePopupProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  isVisible: boolean;
  autoClose?: boolean;
  duration?: number;
  onClose: () => void;
}

export const BattleMessagePopup: React.FC<BattleMessagePopupProps> = ({
  message,
  type = 'info',
  isVisible,
  autoClose = true,
  duration = 5000,
  onClose
}) => {
  useEffect(() => {
    if (isVisible && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, autoClose, duration, onClose]);

  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-8 h-8 text-green-400" />;
      case 'warning':
        return <AlertCircle className="w-8 h-8 text-yellow-400" />;
      case 'error':
        return <Shield className="w-8 h-8 text-red-400" />;
      default:
        return <Zap className="w-8 h-8 text-blue-400" />;
    }
  };

  const getColorClasses = () => {
    switch (type) {
      case 'success':
        return 'border-green-500 bg-green-900';
      case 'warning':
        return 'border-yellow-500 bg-yellow-900';
      case 'error':
        return 'border-red-500 bg-red-900';
      default:
        return 'border-blue-500 bg-blue-900';
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50 pointer-events-auto" onClick={onClose} />
      
      {/* Message Box */}
      <div 
        className={`relative pointer-events-auto bg-opacity-95 border-4 rounded-2xl p-8 shadow-2xl max-w-2xl mx-4 transform transition-all duration-300 ${getColorClasses()}`}
        style={{
          animation: 'slideDown 0.3s ease-out'
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Content */}
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0 animate-pulse">
            {getIcon()}
          </div>
          <div className="flex-1">
            <p className="text-white text-2xl font-bold leading-relaxed">
              {message}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideDown {
          from {
            transform: translateY(-100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};