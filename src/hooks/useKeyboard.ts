import { useEffect, useCallback } from 'react';

export function useKeyboard(keyHandlers: { [key: string]: () => void }) {
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    const handler = keyHandlers[event.key.toLowerCase()];
    if (handler) {
      event.preventDefault();
      handler();
    }
  }, [keyHandlers]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);
}