'use client';

import { useTranslation } from 'react-i18next';
import { Volume2, Unlock } from 'lucide-react';
import styles from '../CashierDiagnostics.module.css';

interface AudioStatusSectionProps {
  audioEnabled: boolean;
  audioReady: boolean;
  audioBlockedByPolicy: boolean;
  onEnableAudio: () => void;
  onTestSound: () => void;
}

/**
 * Notification-sound diagnostics: status dot + sound-enabled row + audio-status
 * badge + Enable/Test Sound actions. Presentational — audio state and the
 * action handlers come from the parent's diagnostics props.
 */
export default function AudioStatusSection({
  audioEnabled,
  audioReady,
  audioBlockedByPolicy,
  onEnableAudio,
  onTestSound,
}: Readonly<AudioStatusSectionProps>) {
  const { t } = useTranslation();

  const getAudioStatusClass = () => {
    if (!audioEnabled) return '';
    if (audioReady) return styles.badgeConnected;
    if (audioBlockedByPolicy) return styles.badgeConnecting;
    return '';
  };

  const getAudioDotClass = () => {
    if (audioReady) return styles.dotConnected;
    if (audioBlockedByPolicy) return styles.dotConnecting;
    return styles.dotInactive;
  };

  const getAudioStatusText = () => {
    if (audioReady) return 'Ready';
    if (audioBlockedByPolicy) return 'Blocked';
    return 'Disabled';
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={`${styles.dot} ${getAudioDotClass()}`} />
        <h4 className={styles.sectionTitle}>{t('notification_sound') || 'Notification Sound'}</h4>
      </div>

      <div className={styles.infoCard}>
        <div className={styles.row}>
          <span className={styles.label}>{t('sound_enabled') || 'Sound Enabled'}</span>
          <span className={styles.value}>{audioEnabled ? 'Yes' : 'No'}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('audio_status') || 'Audio Status'}</span>
          <span className={`${styles.badge} ${getAudioStatusClass()}`}>{getAudioStatusText()}</span>
        </div>
      </div>

      <div className={styles.buttonGroup}>
        {audioBlockedByPolicy && (
          <button onClick={onEnableAudio} className={`${styles.actionButton} ${styles.warningButton}`}>
            <Unlock size={16} />
            {t('enable_sound') || 'Enable Sound'}
          </button>
        )}
        <button
          onClick={onTestSound}
          disabled={!audioReady}
          className={`${styles.actionButton} ${styles.secondaryButton}`}
        >
          <Volume2 size={16} />
          {t('test_sound') || 'Test Sound'}
        </button>
      </div>
    </div>
  );
}
