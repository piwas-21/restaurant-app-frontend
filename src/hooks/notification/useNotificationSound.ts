'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { NotificationSoundType, playToneSequence, playOrderUpdateTone } from '@/utils/notificationTones';
import { useAudioContext } from './useAudioContext';

/**
 * Cashier notification sound engine: builds on {@link useAudioContext} and the pure
 * {@link playToneSequence}/{@link playOrderUpdateTone} synthesizers to expose playback,
 * the selected sound-type preference (persisted), and the repeat-until-mouse-moves loop.
 * Extracted verbatim from useNotification (Sprint 4/6 god-file decomposition).
 */
export function useNotificationSound() {
  const {
    audioContextRef,
    audioEnabled,
    audioReady,
    audioBlockedByPolicy,
    setAudioReady,
    setAudioBlockedByPolicy,
    initializeAudio,
    resumeAudioContext,
    toggleAudio,
  } = useAudioContext();

  const [soundType, setSoundType] = useState<NotificationSoundType>('chime');
  const [repeatUntilMouseMoves, setRepeatUntilMouseMoves] = useState(false);
  const repeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load sound type preference from localStorage
  useEffect(() => {
    const savedSoundType = localStorage.getItem('cashier_notification_sound');
    if (savedSoundType && ['chime', 'bell', 'ping', 'alert', 'melody'].includes(savedSoundType)) {
      setSoundType(savedSoundType as NotificationSoundType);
    }

    const savedRepeatSetting = localStorage.getItem('cashier_repeat_sound');
    if (savedRepeatSetting === 'true') {
      setRepeatUntilMouseMoves(true);
    }
  }, []);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (!audioEnabled) {
      return;
    }

    if (!audioContextRef.current) {
      console.warn('⚠️ AudioContext not initialized');
      setAudioBlockedByPolicy(true);
      initializeAudio();
      return;
    }

    const audioContext = audioContextRef.current;

    // Resume context if suspended
    if (audioContext.state === 'suspended') {
      console.warn('⚠️ AudioContext suspended, attempting resume...');
      audioContext
        .resume()
        .then(() => {
          if (audioContext.state === 'running') {
            setAudioReady(true);
            setAudioBlockedByPolicy(false);
            playToneSequence(audioContext, soundType);
          }
        })
        .catch((err) => {
          console.error('Failed to resume AudioContext:', err);
          setAudioBlockedByPolicy(true);
        });
      return;
    }

    try {
      playToneSequence(audioContext, soundType);
    } catch (error) {
      console.error('Could not play notification sound:', error);
    }
  }, [audioEnabled, soundType, initializeAudio, audioContextRef, setAudioReady, setAudioBlockedByPolicy]);

  const playSoundByType = useCallback(
    (type: NotificationSoundType) => {
      if (!audioContextRef.current || !audioEnabled) {
        return;
      }

      try {
        const audioContext = audioContextRef.current;

        if (audioContext.state === 'suspended') {
          void audioContext.resume();
        }

        playToneSequence(audioContext, type);
      } catch (error) {
        console.error('Could not play notification sound:', error);
      }
    },
    [audioEnabled, audioContextRef],
  );

  // Play a different notification sound for order updates
  const playOrderUpdateSound = useCallback(() => {
    if (!audioContextRef.current || !audioEnabled) return;

    try {
      const audioContext = audioContextRef.current;

      if (audioContext.state === 'suspended') {
        void audioContext.resume();
      }

      playOrderUpdateTone(audioContext);
    } catch (error) {
      console.error('Could not play order update sound:', error);
    }
  }, [audioEnabled, audioContextRef]);

  const stopRepeating = useCallback(() => {
    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
  }, []);

  // Start repeating sound until mouse moves
  const startRepeatingUntilMouseMoves = useCallback(() => {
    if (!repeatUntilMouseMoves || !audioEnabled) return;

    stopRepeating();
    playNotificationSound();

    const getRepeatInterval = () => {
      switch (soundType) {
        case 'bell':
          return 1500;
        case 'melody':
          return 2200;
        case 'ping':
          return 600;
        case 'alert':
          return 1000;
        case 'chime':
        default:
          return 1200;
      }
    };

    repeatIntervalRef.current = setInterval(() => {
      playNotificationSound();
    }, getRepeatInterval());

    const handleMouseMove = () => {
      stopRepeating();
      document.removeEventListener('mousemove', handleMouseMove);
    };

    document.addEventListener('mousemove', handleMouseMove, { once: true });
  }, [repeatUntilMouseMoves, audioEnabled, playNotificationSound, stopRepeating, soundType]);

  // Clean up repeat interval on unmount
  useEffect(() => {
    return () => {
      stopRepeating();
    };
  }, [stopRepeating]);

  // Change notification sound type
  const changeSoundType = useCallback((newType: NotificationSoundType) => {
    setSoundType(newType);
    localStorage.setItem('cashier_notification_sound', newType);
  }, []);

  const toggleRepeatSound = useCallback(() => {
    const newValue = !repeatUntilMouseMoves;
    setRepeatUntilMouseMoves(newValue);
    localStorage.setItem('cashier_repeat_sound', newValue.toString());
  }, [repeatUntilMouseMoves]);

  return {
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
    stopRepeating,
  };
}
