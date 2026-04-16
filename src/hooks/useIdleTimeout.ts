'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

const IDLE_MS      = 15 * 60 * 1000;  // 15 min sin actividad → cierre de sesión
const WARN_BEFORE_MS = 2 * 60 * 1000; // aviso 2 min antes del cierre

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
] as const;

export function useIdleTimeout(onTimeout: () => void, enabled: boolean) {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown]     = useState(0);

  const logoutTimerRef   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const warnTimerRef     = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const countdownRef     = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const onTimeoutRef     = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const clearAll = useCallback(() => {
    clearTimeout(logoutTimerRef.current);
    clearTimeout(warnTimerRef.current);
    clearInterval(countdownRef.current);
  }, []);

  const reset = useCallback(() => {
    clearAll();
    setShowWarning(false);

    warnTimerRef.current = setTimeout(() => {
      const totalSecs = Math.floor(WARN_BEFORE_MS / 1000);
      setShowWarning(true);
      setCountdown(totalSecs);

      let remaining = totalSecs;
      countdownRef.current = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
      }, 1000);
    }, IDLE_MS - WARN_BEFORE_MS);

    logoutTimerRef.current = setTimeout(() => {
      clearInterval(countdownRef.current);
      setShowWarning(false);
      onTimeoutRef.current();
    }, IDLE_MS);
  }, [clearAll]);

  useEffect(() => {
    if (!enabled) {
      clearAll();
      setShowWarning(false);
      return;
    }

    ACTIVITY_EVENTS.forEach((e) =>
      window.addEventListener(e, reset, { passive: true })
    );
    reset();

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
      clearAll();
    };
  }, [enabled, reset, clearAll]);

  return { showWarning, countdown, stayActive: reset };
}
