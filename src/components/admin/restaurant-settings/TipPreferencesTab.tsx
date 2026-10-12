'use client';

import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import StaffButton from '@/components/design-system/StaffButton';
import { useTipPreferencesEditor } from '@/hooks/admin/useTipPreferencesEditor';
import { MAX_TIP_PRESETS } from './tipPreferencesSchema';
import styles from './TipPreferencesTab.module.css';

export default function TipPreferencesTab() {
  const { t, i18n } = useTranslation();
  const editor = useTipPreferencesEditor();
  if (editor.reader.isLoading && !editor.reader.info) return <output>{t('loading')}</output>;
  if (editor.reader.error || !editor.reader.info)
    return <StaffButton onClick={() => void editor.reader.refetch()}>{t('retry')}</StaffButton>;
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        void editor.save();
      }}
    >
      <h2>{t('tip_preferences.title')}</h2>
      <p>{t('tip_preferences.description')}</p>
      <fieldset disabled={editor.busy}>
        <legend>{t('tip_preferences.display')}</legend>
        {(['percentage', 'fixed'] as const).map((mode) => (
          <label key={mode} className={styles.choice}>
            <input
              type="radio"
              name="tip-preset-mode"
              checked={editor.mode === mode}
              onChange={() => editor.changeMode(mode)}
            />
            {t(mode === 'fixed' ? 'tip_preferences.fixed' : 'tip_preferences.percentage')}
          </label>
        ))}
      </fieldset>
      {editor.mode === 'fixed' && !editor.currency && <p role="alert">{t('tip_preferences.currency_required')}</p>}
      <div className={styles.values}>
        {Array.from({ length: MAX_TIP_PRESETS }, (_, index) => (
          <FormField
            key={index}
            label={`${t('tip_preferences.amount')} ${index + 1} · ${editor.mode === 'fixed' ? (editor.currency ?? '') : '%'}`}
          >
            <input
              inputMode={editor.mode === 'fixed' ? 'decimal' : 'numeric'}
              value={editor.inputs[index] ?? ''}
              disabled={editor.busy}
              onChange={(event) =>
                editor.setInputs((values) => {
                  const next = [...values];
                  next[index] = event.target.value;
                  return next;
                })
              }
            />
          </FormField>
        ))}
      </div>
      <p>{t('tip_preferences.values_hint')}</p>
      <div className={styles.preview} aria-label={t('tip_preferences.preview')}>
        <span>{t('no_tip')}</span>
        {editor.preferences.values.map((value) => (
          <span key={value}>
            {editor.mode === 'fixed'
              ? new Intl.NumberFormat(i18n.language || 'en', {
                  style: 'currency',
                  currency: editor.currency ?? 'EUR',
                }).format(value / 100)
              : `${value}%`}
          </span>
        ))}
        <span>{t('custom_tip')}</span>
      </div>
      {editor.message && <output aria-live="polite">{editor.message}</output>}
      <StaffButton type="submit" variant="primary" disabled={!editor.valid || editor.busy}>
        {t('save')}
      </StaffButton>
    </form>
  );
}
