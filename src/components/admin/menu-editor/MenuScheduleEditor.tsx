'use client';

import React from 'react';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';

import styles from './MenuEditor.module.css';
import { MenuDefinition } from '@/types/menu';
import { useTranslation } from 'react-i18next';

interface MenuScheduleEditorProps {
  menuDefinition: MenuDefinition;
  onChange: (menuDefinition: MenuDefinition) => void;
}

const DAYS_OF_WEEK = [
  { key: 'availableMonday', label: 'monday' },
  { key: 'availableTuesday', label: 'tuesday' },
  { key: 'availableWednesday', label: 'wednesday' },
  { key: 'availableThursday', label: 'thursday' },
  { key: 'availableFriday', label: 'friday' },
  { key: 'availableSaturday', label: 'saturday' },
  { key: 'availableSunday', label: 'sunday' },
] as const;

const MenuScheduleEditor: React.FC<MenuScheduleEditorProps> = ({ menuDefinition, onChange }) => {
  const { t } = useTranslation();

  // Controlled/live (slice 7 PR2e): every edit propagates straight to the page's form state,
  // whose single Save is the only commit point (owner call). This used to buffer locally behind
  // its OWN Save/Cancel — on the unified editor that stranded a schedule edit unless the nested
  // Save was clicked, and stood a second commit point next to the page's. Now BundlePanel-only
  // (the bundle modals + MenuBundleDetails that also used it are gone), so no flag is needed.
  const patch = (updates: Partial<MenuDefinition>) => onChange({ ...menuDefinition, ...updates });

  return (
    <div className={styles.scheduleEditor}>
      <h3 className={styles.sectionTitle}>{t('menu_availability_schedule')}</h3>

      {/* Availability Mode Selection */}
      <div className={modalStyles.formGroup}>
        <label>{t('availability_mode')}</label>
        <div className={styles.chipGroup}>
          <div className={styles.chip}>
            {/* The radio's own onChange drives the toggle, and the label is associated via
                htmlFor — replacing the old no-op onChange + label onClick (unreachable by
                keyboard). */}
            <input
              type="radio"
              id="always-available"
              name="availability-mode"
              checked={menuDefinition.isAlwaysAvailable}
              onChange={() => patch({ isAlwaysAvailable: true })}
            />
            <label htmlFor="always-available">{t('always_available')}</label>
          </div>
          <div className={styles.chip}>
            <input
              type="radio"
              id="custom-schedule"
              name="availability-mode"
              checked={!menuDefinition.isAlwaysAvailable}
              onChange={() => patch({ isAlwaysAvailable: false })}
            />
            <label htmlFor="custom-schedule">{t('custom_schedule')}</label>
          </div>
        </div>
        <p className={styles.helpText}>
          {menuDefinition.isAlwaysAvailable
            ? t('always_available_help')
            : t('custom_schedule_help', { defaultValue: 'Set specific days and times when this menu is available' })}
        </p>
      </div>

      {/* Time Range */}
      {!menuDefinition.isAlwaysAvailable && (
        <>
          <div className={styles.timeRange}>
            <div className={modalStyles.formGroup}>
              <label htmlFor="startTime">{t('start_time')}</label>
              <input
                id="startTime"
                type="time"
                value={menuDefinition.startTime || ''}
                onChange={(e) => patch({ startTime: e.target.value })}
                className={styles.timeInput}
              />
            </div>

            <div className={modalStyles.formGroup}>
              <label htmlFor="endTime">{t('end_time')}</label>
              <input
                id="endTime"
                type="time"
                value={menuDefinition.endTime || ''}
                onChange={(e) => patch({ endTime: e.target.value })}
                className={styles.timeInput}
              />
            </div>
          </div>

          {/* Days of Week */}
          <div className={modalStyles.formGroup}>
            <label>{t('available_days')}</label>
            <div className={modalStyles.chipGroup}>
              {DAYS_OF_WEEK.map(({ key, label }) => (
                <div key={key} className={modalStyles.chip}>
                  <input
                    type="checkbox"
                    id={`day-${key}`}
                    checked={menuDefinition[key as keyof MenuDefinition] as boolean}
                    onChange={() =>
                      patch({ [key]: !menuDefinition[key as keyof MenuDefinition] } as Partial<MenuDefinition>)
                    }
                  />
                  <label htmlFor={`day-${key}`}>{t(label)}</label>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MenuScheduleEditor;
