// Web Audio tone synthesis for cashier notification sounds. Pure functions — they take an
// AudioContext and schedule oscillators on it; no React, no state. Extracted verbatim from
// useNotification (Sprint 4/6 god-file decomposition) so the playback hook stays focused.

export type NotificationSoundType =
  | 'chime' // Default: Pleasant 3-note chime (medium)
  | 'bell' // Loud & Long: Classic bell sound
  | 'ping' // Soft & Short: Gentle single ping
  | 'alert' // Loud & Short: Urgent alert
  | 'melody'; // Soft & Long: Calming melody

// Schedules a single oscillator note with a short attack and exponential release.
function playNote(
  audioContext: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number,
  waveType: OscillatorType = 'sine',
): void {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.type = waveType;
  oscillator.frequency.setValueAtTime(frequency, startTime);

  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

// Plays the note sequence for a given notification sound type.
export function playToneSequence(audioContext: AudioContext, type: NotificationSoundType): void {
  const now = audioContext.currentTime;

  switch (type) {
    case 'chime':
      playNote(audioContext, 659.25, now, 0.3, 0.2);
      playNote(audioContext, 830.61, now + 0.1, 0.4, 0.15);
      playNote(audioContext, 1318.51, now + 0.2, 0.6, 0.1);
      break;
    case 'bell':
      playNote(audioContext, 1046.5, now, 0.8, 0.3);
      playNote(audioContext, 1318.51, now + 0.05, 0.85, 0.25);
      playNote(audioContext, 1568, now + 0.1, 0.9, 0.2);
      playNote(audioContext, 2093, now + 0.15, 1.0, 0.15);
      break;
    case 'ping':
      playNote(audioContext, 880, now, 0.15, 0.12);
      playNote(audioContext, 1760, now + 0.05, 0.2, 0.08);
      break;
    case 'alert':
      playNote(audioContext, 987.77, now, 0.15, 0.35, 'square');
      playNote(audioContext, 987.77, now + 0.2, 0.15, 0.35, 'square');
      playNote(audioContext, 987.77, now + 0.4, 0.15, 0.35, 'square');
      break;
    case 'melody':
      playNote(audioContext, 523.25, now, 0.4, 0.12);
      playNote(audioContext, 659.25, now + 0.3, 0.4, 0.1);
      playNote(audioContext, 783.99, now + 0.6, 0.4, 0.08);
      playNote(audioContext, 1046.5, now + 0.9, 0.6, 0.1);
      playNote(audioContext, 783.99, now + 1.3, 0.5, 0.08);
      break;
  }
}

// A distinct, lower/softer 3-note sequence used for order-update notifications.
export function playOrderUpdateTone(audioContext: AudioContext): void {
  const now = audioContext.currentTime;
  playNote(audioContext, 261.63, now, 0.25, 0.15);
  playNote(audioContext, 329.63, now + 0.08, 0.3, 0.12);
  playNote(audioContext, 392, now + 0.16, 0.5, 0.08);
}
