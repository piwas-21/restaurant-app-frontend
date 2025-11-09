'use client';

import { useState, useCallback, useRef } from 'react';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  duration?: number; // in milliseconds, 0 = no auto-dismiss
  sound?: boolean; // play sound notification
}

export function useNotification() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationIdRef = useRef(0);

  // Play notification sound using Web Audio API
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioContext.currentTime;

      // Create oscillator for beep sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Double beep pattern: high-low
      oscillator.frequency.setValueAtTime(800, now); // High frequency
      gainNode.gain.setValueAtTime(0.3, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

      oscillator.start(now);
      oscillator.stop(now + 0.1);

      // Second beep
      const osc2 = audioContext.createOscillator();
      osc2.connect(gainNode);
      osc2.frequency.setValueAtTime(600, now + 0.15); // Lower frequency
      gainNode.gain.setValueAtTime(0.3, now + 0.15);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

      osc2.start(now + 0.15);
      osc2.stop(now + 0.25);
    } catch (error) {
      // Silently fail if audio context not available
      console.error('Could not play notification sound:', error);
    }
  }, []);

  const addNotification = useCallback(
    (notification: Omit<Notification, 'id'>) => {
      const id = `notification-${++notificationIdRef.current}`;
      const newNotification: Notification = {
        ...notification,
        id,
        duration: notification.duration ?? 5000, // Default 5 seconds
      };

      // Play sound if requested
      if (newNotification.sound) {
        playNotificationSound();
      }

      setNotifications((prev) => [newNotification, ...prev]);

      // Auto-dismiss if duration is set
      if (newNotification.duration && newNotification.duration > 0) {
        const timeoutId = setTimeout(() => {
          removeNotification(id);
        }, newNotification.duration);

        return { id, timeoutId };
      }

      return { id };
    },
    [playNotificationSound]
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
    },
    [addNotification]
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
    [addNotification]
  );

  return {
    notifications,
    addNotification,
    removeNotification,
    notifyNewOrder,
    notifyOrderReady,
  };
}
