'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/admin/PageHeader';
import FormField from '@/components/design-system/FormField';
import { LANGUAGE_CODES, SUPPORTED_LANGUAGES, type LanguageCode } from '@/config/languageConfig';
import { OPTION_SET_KINDS } from '@/types/optionSet';
import type { OptionSetKind } from '@/types/optionSet';
import { useOptionSetEditor } from '@/hooks/admin/useOptionSetEditor';
import { useOptionSetEditorFormValidation } from '@/hooks/admin/useOptionSetEditorFormValidation';
import { optionSetEntryReferenceKey } from '@/utils/optionSetEditorModel';
import { OPTION_SET_KIND_LABEL_KEYS } from '@/utils/optionSetLabels';
import OptionSetEntryRow from './OptionSetEntryRow';
import OptionSetAttachmentManager from './OptionSetAttachmentManager';
import styles from './OptionSetEditorWorkspace.module.css';

export default function OptionSetEditorWorkspace({
  id,
  initialKind,
}: {
  readonly id?: string;
  readonly initialKind?: OptionSetKind;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const editor = useOptionSetEditor(id, initialKind);
  const { validate: validateForm, showError: showFormError } = useOptionSetEditorFormValidation(editor);
  const saveOptionSet = editor.save;
  const save = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!validateForm()) return;
      const saved = await saveOptionSet();
      if (saved && !id) router.replace(`/admin/option-sets/${encodeURIComponent(saved.id)}`);
    },
    [saveOptionSet, id, router, validateForm],
  );

  if (editor.isLoading)
    return (
      <main className={styles.page}>
        <output>{t('option_set_references_loading')}</output>
      </main>
    );
  if (editor.error === 'load')
    return (
      <main className={styles.page}>
        <p role="alert" className={styles.error}>
          {editor.errorMessage ?? t('option_set_load_error')}
        </p>
      </main>
    );

  const title = editor.detail ? t('option_set_edit_title') : t('option_set_new_title');
  return (
    <main className={styles.page}>
      <PageHeader title={title}>
        <div className={styles.headerActions}>
          <Link href="/admin/option-sets">{t('back')}</Link>
        </div>
      </PageHeader>
      {editor.detail && <p className={styles.notice}>{t('option_set_version', { version: editor.detail.version })}</p>}
      <p className={styles.notice}>{t('option_sets_description')}</p>
      {editor.referencesError && (
        <p role="alert" className={styles.error}>
          {t('option_set_load_error')}{' '}
          <button type="button" onClick={() => void editor.reloadReferences()}>
            {t('retry')}
          </button>
        </p>
      )}
      <form className={styles.form} onSubmit={(event) => void save(event)}>
        <FormField label={t('option_set_name')}>
          <input
            value={editor.name}
            maxLength={200}
            onChange={(event) => editor.setName(event.target.value)}
            required
          />
        </FormField>
        <FormField label={t('option_set_source_locale')}>
          <select
            value={editor.sourceLocale}
            onChange={(event) => editor.setSourceLocale(event.target.value as LanguageCode)}
            required
          >
            {SUPPORTED_LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>
                {language.nativeName}
              </option>
            ))}
          </select>
        </FormField>
        <details className={styles.translations}>
          <summary>{t('option_set_translations')}</summary>
          {LANGUAGE_CODES.filter((locale) => locale !== editor.sourceLocale).map((locale) => {
            const language = SUPPORTED_LANGUAGES.find((row) => row.code === locale);
            return (
              <FormField
                key={locale}
                label={t('option_set_translation_locale', { language: language?.nativeName ?? locale })}
              >
                <input
                  value={editor.translations[locale] ?? ''}
                  maxLength={200}
                  onChange={(event) => editor.setTranslation(locale, event.target.value)}
                />
              </FormField>
            );
          })}
        </details>
        <FormField label={t('option_set_kind')}>
          <select
            value={editor.kind}
            disabled={Boolean(editor.detail) || editor.entries.length > 0}
            onChange={(event) => editor.setKind(event.target.value as OptionSetKind)}
            required
          >
            <option value="">{t('select_option')}</option>
            {OPTION_SET_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(OPTION_SET_KIND_LABEL_KEYS[kind])}
              </option>
            ))}
          </select>
        </FormField>
        <section aria-labelledby="option-set-entries-heading">
          <h2 id="option-set-entries-heading">{t('option_set_entries')}</h2>
          {!editor.kind && <p className={styles.entryHelp}>{t('option_set_kind_filter')}</p>}
          {editor.kind && editor.entries.length === 0 && (
            <p className={styles.entryHelp}>
              {editor.kind === 'ingredient' || editor.kind === 'sauce'
                ? t('option_set_library_empty')
                : t('option_set_products_empty')}
            </p>
          )}
          <ol className={styles.entries}>
            {editor.entries.map((entry, index) => {
              const usedReferences = editor.entries
                .filter((_, rowIndex) => rowIndex !== index)
                .map((row) => (editor.kind ? optionSetEntryReferenceKey(editor.kind, row) : null))
                .filter((value): value is string => value !== null)
                .map((value) => value.slice(value.indexOf(':') + 1));
              const referenceId =
                editor.kind === 'ingredient' || editor.kind === 'sauce' ? entry.globalIngredientId : entry.productId;
              return (
                <li key={entry.id ?? `new-${index}`}>
                  <OptionSetEntryRow
                    kind={editor.kind as OptionSetKind}
                    entry={entry}
                    index={index}
                    entryKey={entry.id ?? `new-${index}`}
                    selectedReferenceAvailable={
                      !referenceId || Boolean(editor.kind && editor.referenceIsAvailable(editor.kind, referenceId))
                    }
                    usedReferences={usedReferences}
                    onChange={(patch) => editor.updateEntry(index, patch)}
                    onReferenceSelected={(candidate) => {
                      if (editor.kind) editor.markReferenceVerified(editor.kind, candidate);
                    }}
                    onVariationValidityChange={editor.markVariationValidity}
                    onRemove={() => editor.removeEntry(index)}
                    onMove={(delta) => editor.moveEntry(index, delta)}
                    canMoveUp={index > 0}
                    canMoveDown={index < editor.entries.length - 1}
                  />
                </li>
              );
            })}
          </ol>
          {editor.kind && (
            <button type="button" className={`${styles.secondaryAction} ${styles.addButton}`} onClick={editor.addEntry}>
              {t('option_set_add_entry')}
            </button>
          )}
        </section>
        {(editor.error === 'save' || showFormError) && (
          <p role="alert" className={styles.error}>
            {showFormError ? t('option_set_validation_error') : (editor.errorMessage ?? t('option_set_save_error'))}
          </p>
        )}
        {editor.saved && (
          <p role="status" className={styles.success}>
            {t('option_set_save_success')}
          </p>
        )}
        <button className={styles.primaryAction} type="submit" disabled={!editor.canSave || editor.isSaving}>
          {t(editor.isSaving ? 'option_set_saving' : 'option_set_save')}
        </button>
      </form>
      {editor.detail && (
        <OptionSetAttachmentManager
          detail={editor.detail}
          isDirty={editor.isDirty}
          onApplied={() => void editor.reload()}
        />
      )}
    </main>
  );
}
