'use client';

import dynamic from 'next/dynamic';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { RefreshCw, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StaffButton from '@/components/design-system/StaffButton';
import FormField from '@/components/design-system/FormField';
import { useKitchenBoardView } from '@/hooks/kitchenBoard/useKitchenBoardView';
import styles from './KitchenBoardTools.module.css';

const SoundSelector = dynamic(() => import('@/components/cashier/SoundSelector'));
type View = ReturnType<typeof useKitchenBoardView>;

export default function KitchenBoardTools({
  view,
  refresh,
  loading,
  navigation,
}: Readonly<{
  view: View;
  refresh: () => void;
  loading: boolean;
  navigation?: ReactNode;
}>) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!filters) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setFilters(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFilters(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [filters]);
  const sound = view.sound;
  return (
    <header className={styles.toolbar}>
      {navigation}
      <div className={styles.tools} ref={root}>
        <button
          ref={trigger}
          type="button"
          className={styles.icon}
          aria-label={t('filters')}
          aria-expanded={filters}
          aria-controls={id}
          onClick={() => setFilters((value) => !value)}
        >
          <SlidersHorizontal size={22} aria-hidden="true" />
        </button>
        {filters && (
          <div id={id} className={styles.flyout}>
            <FormField label={t('search')}>
              <input type="search" value={view.search} onChange={(e) => view.setSearch(e.target.value)} />
            </FormField>
            <FormField label={t('status')}>
              <select value={view.status} onChange={(e) => view.setStatus(e.target.value)}>
                <option value="all">{t('all_statuses')}</option>
                {['Confirmed', 'Preparing', 'Ready', 'Completed', 'Delivered'].map((s) => (
                  <option key={s} value={s}>
                    {t(`order_status_${s.toLowerCase()}`)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label={t('order_type')}>
              <select value={view.type} onChange={(e) => view.setType(e.target.value)}>
                <option value="all">{t('all_order_types')}</option>
                <option value="DineIn">{t('order_type_dine_in')}</option>
                <option value="Takeaway">{t('takeaway')}</option>
                <option value="Delivery">{t('delivery')}</option>
              </select>
            </FormField>
          </div>
        )}
      </div>
      <div className={styles.views} aria-label={t('kitchenView.work')}>
        <StaffButton
          aria-pressed={view.view === 'active'}
          variant={view.view === 'active' ? 'primary' : 'secondary'}
          onClick={() => view.setView('active')}
        >
          {t('kitchenView.active')} ({view.activeCount})
        </StaffButton>
        <StaffButton
          aria-pressed={view.view === 'completed'}
          variant={view.view === 'completed' ? 'primary' : 'secondary'}
          onClick={() => view.setView('completed')}
        >
          {t('kitchenView.completed')} ({view.completedCount})
        </StaffButton>
      </div>
      <span className={styles.today}>{t('today')}</span>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.icon}
          aria-label={t('sound')}
          aria-pressed={sound.audioEnabled}
          onClick={sound.toggleAudio}
        >
          {sound.audioEnabled ? <Volume2 size={22} aria-hidden="true" /> : <VolumeX size={22} aria-hidden="true" />}
        </button>
        <StaffButton onClick={() => setSoundOpen(true)}>{t('cashier.workspace.more_sound')}</StaffButton>
        <StaffButton disabled={loading} onClick={refresh}>
          <RefreshCw size={19} aria-hidden="true" />
          {t('nativeKitchenBoard.refresh')}
        </StaffButton>
      </div>
      {sound.audioEnabled && sound.audioBlockedByPolicy && (
        <StaffButton onClick={() => void sound.resumeAudioContext()}>{t('kitchenView.enableAudio')}</StaffButton>
      )}
      {soundOpen && (
        <SoundSelector
          isOpen
          onClose={() => setSoundOpen(false)}
          soundType={sound.soundType}
          onSoundTypeChange={sound.changeSoundType}
          onTestSound={sound.playSoundByType}
          repeatUntilMouseMoves={sound.repeatUntilMouseMoves}
          onToggleRepeat={sound.toggleRepeatSound}
        />
      )}
    </header>
  );
}
