'use client';
import { useCallback, useEffect, useRef } from 'react';
import type { NotificationSoundType } from '@/utils/notificationTones';
const intervals: Record<NotificationSoundType, number> = {
  bell: 1500,
  melody: 2200,
  ping: 600,
  alert: 1000,
  chime: 1200,
};
const interactions = ['mousemove', 'pointerdown', 'keydown'] as const;
export function useNotificationSoundRepeat(
  enabled: boolean,
  repeat: boolean,
  type: NotificationSoundType,
  play: () => void,
) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRepeating = useCallback(() => {
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
    interactions.forEach((event) => document.removeEventListener(event, stopRepeating));
  }, []);
  const startRepeatingUntilMouseMoves = useCallback(() => {
    stopRepeating();
    if (!enabled || !repeat) return;
    play();
    timer.current = setInterval(play, intervals[type]);
    interactions.forEach((event) => document.addEventListener(event, stopRepeating, { once: true }));
  }, [enabled, repeat, play, stopRepeating, type]);
  useEffect(() => {
    if (!enabled || !repeat) stopRepeating();
    return stopRepeating;
  }, [enabled, repeat, stopRepeating]);
  return { stopRepeating, startRepeatingUntilMouseMoves };
}
