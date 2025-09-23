import { useEffect, useCallback } from 'react';

interface UseBrowserWarningOptions {
  enabled?: boolean;
  message?: string;
  onWarning?: () => void;
}

export function useBrowserWarning(options: UseBrowserWarningOptions = {}) {
  const {
    enabled = true,
    message = 'Are you sure you want to leave? Your game session will be interrupted.',
    onWarning
  } = options;

  const handleBeforeUnload = useCallback((event: BeforeUnloadEvent) => {
    if (!enabled) return;
    
    if (onWarning) onWarning();
    
    event.preventDefault();
    event.returnValue = message;
    return message;
  }, [enabled, message, onWarning]);

  const handlePopState = useCallback((event: PopStateEvent) => {
    if (!enabled) return;
    
    const confirmLeave = window.confirm(message);
    
    if (!confirmLeave) {
      window.history.pushState(null, '', window.location.href);
    } else if (onWarning) {
      onWarning();
    }
  }, [enabled, message, onWarning]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    window.history.pushState(null, '', window.location.href);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [enabled, handleBeforeUnload, handlePopState]);

  return {
    enableWarning: () => {
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('popstate', handlePopState);
    },
    disableWarning: () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    }
  };
}