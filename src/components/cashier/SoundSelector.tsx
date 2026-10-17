import React from 'react';
import { useTranslation } from 'react-i18next';
import { NotificationSoundType } from '@/hooks/useNotification';
import styles from './SoundSelector.module.css';
import BaseModal from '@/components/design-system/BaseModal';
import CheckboxField from '@/components/design-system/CheckboxField';

interface SoundSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  soundType: NotificationSoundType;
  onSoundTypeChange: (type: NotificationSoundType) => void;
  onTestSound: (type: NotificationSoundType) => void;
  repeatUntilMouseMoves: boolean;
  onToggleRepeat: () => void;
}

const SOUND_OPTIONS: readonly { value: NotificationSoundType; key: string }[] = [
  { value: 'chime', key: 'staffSound.chime' },
  { value: 'bell', key: 'staffSound.bell' },
  { value: 'ping', key: 'staffSound.ping' },
  { value: 'alert', key: 'staffSound.alert' },
  { value: 'melody', key: 'staffSound.melody' },
];

export default function SoundSelector({
  isOpen,
  onClose,
  soundType,
  onSoundTypeChange,
  onTestSound,
  repeatUntilMouseMoves,
  onToggleRepeat,
}: SoundSelectorProps) {
  const { t } = useTranslation();

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={t('select_notification_sound')} size="sm">
      <div className={styles.options}>
        {SOUND_OPTIONS.map((sound) => (
          <div className={styles.soundOption} key={sound.value}>
            <button
              type="button"
              className={styles.choice}
              aria-pressed={soundType === sound.value}
              onClick={() => {
                onSoundTypeChange(sound.value);
                onClose();
              }}
            >
              {t(sound.key)}
            </button>
            <button
              type="button"
              className={styles.testButton}
              onClick={() => onTestSound(sound.value)}
              aria-label={t('staffSound.testNamed', { sound: t(sound.key) })}
            >
              {t('staffSound.test')}
            </button>
          </div>
        ))}
        <CheckboxField
          label={t('repeat_until_mouse_moves')}
          checked={repeatUntilMouseMoves}
          onChange={onToggleRepeat}
        />
        <p className={styles.hint}>{t('staffSound.repeatHint')}</p>
      </div>
    </BaseModal>
  );
}
