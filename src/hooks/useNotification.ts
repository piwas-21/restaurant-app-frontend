'use client';

import { useState, useCallback, useRef } from 'react';
import { NotificationSoundType } from '@/utils/notificationTones';
import { useNotificationSound } from './notification/useNotificationSound';

// Re-exported so existing imports (`@/hooks/useNotification`) keep working after the split.
export type { NotificationSoundType };

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  duration?: number; // in milliseconds, 0 = no auto-dismiss
  sound?: boolean; // play sound notification
}

/**
 * Cashier notifications: an in-memory toast list plus order-event helpers. The Web Audio
 * sound engine (context lifecycle, synthesis, preferences, repeat loop) lives in
 * {@link useNotificationSound}; this hook composes it and re-exposes the same flat API the
 * consumers (cashier page, NotificationCenter, CashierHeader, SoundSelector) already use.
 */
export function useNotification() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationIdRef = useRef(0);

  const {
    audioEnabled,
    audioReady,
    audioBlockedByPolicy,
    toggleAudio,
    resumeAudioContext,
    soundType,
    changeSoundType,
    repeatUntilMouseMoves,
    toggleRepeatSound,
    playNotificationSound,
    playSoundByType,
    playOrderUpdateSound,
    startRepeatingUntilMouseMoves,
  } = useNotificationSound();

  const addNotification = useCallback(
    (notification: Omit<Notification, 'id'>) => {
      const id = `notification-${++notificationIdRef.current}`;
      const newNotification: Notification = {
        ...notification,
        id,
        duration: notification.duration ?? 5000,
      };

      if (newNotification.sound) {
        playNotificationSound();
      }

      setNotifications((prev) => [newNotification, ...prev]);

      if (newNotification.duration && newNotification.duration > 0) {
        const timeoutId = setTimeout(() => {
          removeNotification(id);
        }, newNotification.duration);

        return { id, timeoutId };
      }

      return { id };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playNotificationSound],
  );

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const notifyNewOrder = useCallback(
    (orderNumber: string, customerName: string) => {
      addNotification({
        type: 'info',
        title: '🎉 New Order Received!',
        message: `Order #${orderNumber}${customerName ? ` from ${customerName}` : ''}`,
        duration: 8000,
        sound: true,
      });

      if (repeatUntilMouseMoves) {
        startRepeatingUntilMouseMoves();
      }
    },
    [addNotification, repeatUntilMouseMoves, startRepeatingUntilMouseMoves],
  );

  const notifyOrderReady = useCallback(
    (orderNumber: string) => {
      addNotification({
        type: 'success',
        title: '✅ Order Ready!',
        message: `Order #${orderNumber} is ready for pickup`,
        duration: 6000,
        sound: true,
      });
    },
    [addNotification],
  );

  const notifyOrderUpdate = useCallback(
    (orderNumber: string, status: string) => {
      addNotification({
        type: 'info',
        title: '🔔 Order Updated!',
        message: `Order #${orderNumber} status changed to ${status}`,
        duration: 6000,
        sound: true,
      });
    },
    [addNotification],
  );

  return {
    notifications,
    addNotification,
    removeNotification,
    notifyNewOrder,
    notifyOrderReady,
    notifyOrderUpdate,
    playOrderUpdateSound,
    audioEnabled,
    audioReady,
    audioBlockedByPolicy,
    toggleAudio,
    resumeAudioContext,
    soundType,
    changeSoundType,
    playNotificationSound,
    playSoundByType,
    repeatUntilMouseMoves,
    toggleRepeatSound,
  };
}
