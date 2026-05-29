'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Owns the Web Audio `AudioContext` lifecycle and the browser autoplay-policy dance:
 * lazy creation, resume-on-user-gesture, resume-on-tab-visible, and the enable toggle.
 * Extracted verbatim from useNotification (Sprint 4/6 god-file decomposition); the playback
 * hook consumes the returned `audioContextRef` + state rather than re-implementing this.
 */
export function useAudioContext() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  const [audioBlockedByPolicy, setAudioBlockedByPolicy] = useState(false);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasUserInteractedRef = useRef(false);

  // Initialize AudioContext on first user interaction
  const initializeAudio = useCallback(() => {
    if (audioContextRef.current) {
      return;
    }

    try {
      // Safari exposes the constructor as webkitAudioContext; cast to the shape (not `any`)
      // so the legacy fallback stays type-safe.
      const AudioContextClass: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();

      const state = audioContextRef.current.state;

      if (state === 'running') {
        setAudioReady(true);
        setAudioBlockedByPolicy(false);
      } else if (state === 'suspended') {
        setAudioBlockedByPolicy(true);
        console.warn('⚠️ AudioContext is suspended - user interaction required');
      }

      setAudioEnabled(true);
    } catch (error) {
      console.error('❌ Could not initialize audio context:', error);
      setAudioBlockedByPolicy(true);
    }
  }, []);

  // Resume audio context (requires user gesture on Firefox)
  const resumeAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      initializeAudio();
      return;
    }

    try {
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        setAudioReady(true);
        setAudioBlockedByPolicy(false);
        hasUserInteractedRef.current = true;
      } else {
        setAudioReady(audioContextRef.current.state === 'running');
      }
    } catch (error) {
      console.error('❌ Failed to resume AudioContext:', error);
      setAudioBlockedByPolicy(true);
    }
  }, [initializeAudio]);

  // Auto-initialize audio on mount
  useEffect(() => {
    if (audioEnabled && !audioContextRef.current) {
      requestAnimationFrame(() => {
        initializeAudio();
      });
    }
  }, [audioEnabled, initializeAudio]);

  // Set up event listeners for user interaction to resume audio
  useEffect(() => {
    const handleUserInteraction = () => {
      if (!hasUserInteractedRef.current) {
        hasUserInteractedRef.current = true;
        // resumeAudioContext has its own try/catch (logs and sets
        // audioBlockedByPolicy on failure); fire-and-forget here.
        void resumeAudioContext();
      }
    };

    const events = ['click', 'touchstart', 'keydown'];
    events.forEach((event) => {
      document.addEventListener(event, handleUserInteraction, { once: true });
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleUserInteraction);
      });
    };
  }, [resumeAudioContext]);

  // Resume audio context when tab becomes visible (important for Firefox/Chrome)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && audioContextRef.current) {
        const state = audioContextRef.current.state;

        if (state === 'suspended' && hasUserInteractedRef.current) {
          audioContextRef.current
            .resume()
            .then(() => {
              setAudioReady(audioContextRef.current?.state === 'running');
              setAudioBlockedByPolicy(audioContextRef.current?.state !== 'running');
            })
            .catch((err) => {
              console.warn('⚠️ Failed to resume audio on visibility change:', err);
            });
        } else if (state === 'running') {
          setAudioReady(true);
          setAudioBlockedByPolicy(false);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Clear any pending audio-resume timeout on unmount so the deferred
  // setState in resumeAudioContext doesn't fire on an unmounted component.
  useEffect(() => {
    return () => {
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
        resumeTimeoutRef.current = null;
      }
    };
  }, []);

  // Toggle audio on/off
  const toggleAudio = useCallback(async () => {
    if (!audioContextRef.current) {
      initializeAudio();
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = setTimeout(() => {
        // resumeAudioContext has its own try/catch (logs and sets
        // audioBlockedByPolicy on failure); fire-and-forget here.
        void resumeAudioContext();
      }, 100);
    } else {
      const newEnabled = !audioEnabled;
      setAudioEnabled(newEnabled);

      if (newEnabled && audioContextRef.current.state === 'suspended') {
        await resumeAudioContext();
      }
    }
  }, [initializeAudio, resumeAudioContext, audioEnabled]);

  return {
    audioContextRef,
    audioEnabled,
    audioReady,
    audioBlockedByPolicy,
    setAudioReady,
    setAudioBlockedByPolicy,
    initializeAudio,
    resumeAudioContext,
    toggleAudio,
  };
}
