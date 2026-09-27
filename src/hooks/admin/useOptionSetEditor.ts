'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LanguageCode } from '@/config/languageConfig';
import { createOptionSet, getOptionSet, updateOptionSet } from '@/services/optionSetService';
import { getErrorMessage } from '@/utils/apiClient';
import type { OptionSetDetail, OptionSetEntry, OptionSetKind } from '@/types/optionSet';
import type { TranslationOwnerMetadataWrite } from '@/types/translationMetadata';
import {
  buildOptionSetWriteRequest,
  createEmptyOptionSetEntry,
  isOptionSetDraftSavable,
  moveOptionSetEntry,
  optionSetLocaleOrDefault,
} from '@/utils/optionSetEditorModel';
import { useOptionSetReferences } from './useOptionSetReferences';

export function useOptionSetEditor(id?: string, initialKind?: OptionSetKind) {
  const { i18n } = useTranslation();
  const [detail, setDetail] = useState<OptionSetDetail | null>(null);
  const [kind, setKind] = useState<OptionSetKind | ''>(initialKind ?? '');
  const [name, setName] = useState('');
  const [sourceLocale, setSourceLocale] = useState<LanguageCode>(() =>
    optionSetLocaleOrDefault(i18n.resolvedLanguage ?? i18n.language),
  );
  const [translations, setTranslations] = useState<Partial<Record<LanguageCode, string>>>({});
  const [entries, setEntries] = useState<OptionSetEntry[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(Boolean(id));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<'load' | 'save' | null>(null);
  const [saved, setSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [variationValidity, setVariationValidity] = useState<Record<string, boolean | null>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const references = useOptionSetReferences(kind, entries, detail?.kind === kind ? detail.entries : []);
  const resetConfirmedReferences = references.resetConfirmed;

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setIsLoadingDetail(true);
    setError(null);
    setErrorMessage(null);
    try {
      const loaded = await getOptionSet(id);
      resetConfirmedReferences();
      setDetail(loaded);
      setKind(loaded.kind);
      setName(loaded.name);
      setSourceLocale(optionSetLocaleOrDefault(loaded.sourceLocale ?? 'en'));
      setTranslations(loaded.translations ?? {});
      setEntries(loaded.entries);
      setVariationValidity({});
      setIsDirty(false);
    } catch (loadError) {
      setError('load');
      setErrorMessage(getErrorMessage(loadError));
    } finally {
      setIsLoadingDetail(false);
    }
  }, [id, resetConfirmedReferences]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const updateEntry = useCallback((index: number, patch: Partial<OptionSetEntry>) => {
    setEntries((current) => current.map((entry, rowIndex) => (rowIndex === index ? { ...entry, ...patch } : entry)));
    setSaved(false);
    setIsDirty(true);
  }, []);
  const addEntry = useCallback(() => {
    setEntries((current) => [...current, createEmptyOptionSetEntry(current.length)]);
    setSaved(false);
    setIsDirty(true);
  }, []);
  const removeEntry = useCallback((index: number) => {
    setEntries((current) =>
      current.filter((_, rowIndex) => rowIndex !== index).map((entry, displayOrder) => ({ ...entry, displayOrder })),
    );
    setSaved(false);
    setIsDirty(true);
  }, []);
  const moveEntry = useCallback((index: number, delta: -1 | 1) => {
    setEntries((current) => moveOptionSetEntry(current, index, delta));
    setSaved(false);
    setIsDirty(true);
  }, []);
  const updateName = useCallback((value: string) => {
    setName(value);
    setSaved(false);
    setIsDirty(true);
  }, []);
  const updateKind = useCallback(
    (value: OptionSetKind | '') => {
      resetConfirmedReferences();
      setKind(value);
      setSaved(false);
      setIsDirty(true);
    },
    [resetConfirmedReferences],
  );
  const updateSourceLocale = useCallback((value: LanguageCode) => {
    setSourceLocale(value);
    setSaved(false);
    setIsDirty(true);
  }, []);
  const setTranslation = useCallback((locale: LanguageCode, value: string) => {
    setTranslations((current) => ({ ...current, [locale]: value }));
    setSaved(false);
    setIsDirty(true);
  }, []);
  const markReferenceVerified = references.markReferenceVerified;
  const markVariationValidity = useCallback((entryKey: string, valid: boolean | null) => {
    setVariationValidity((current) => (current[entryKey] === valid ? current : { ...current, [entryKey]: valid }));
  }, []);
  const referenceIsAvailable = references.isReferenceAvailable;

  const canSaveDraft = isOptionSetDraftSavable(kind, name, entries, referenceIsAvailable, variationValidity);

  const save = useCallback(
    async (translationMetadata?: TranslationOwnerMetadataWrite) => {
      if (!kind || !canSaveDraft) return null;
      setIsSaving(true);
      setError(null);
      setErrorMessage(null);
      try {
        const localized: Record<string, string> = Object.fromEntries(
          Object.entries({ ...translations, [sourceLocale]: name.trim() }).filter(([, value]) =>
            Boolean(value?.trim()),
          ),
        );
        const request = buildOptionSetWriteRequest(
          kind,
          name,
          entries,
          detail,
          sourceLocale,
          localized,
          translationMetadata,
        );
        const updated = detail
          ? await updateOptionSet(detail.id, detail.version, request)
          : await createOptionSet(request);
        resetConfirmedReferences();
        setDetail(updated);
        setKind(updated.kind);
        setName(updated.name);
        setSourceLocale(optionSetLocaleOrDefault(updated.sourceLocale ?? sourceLocale));
        setTranslations(updated.translations ?? localized);
        setEntries(updated.entries);
        setVariationValidity({});
        setSaved(true);
        setIsDirty(false);
        return updated;
      } catch (saveError) {
        setError('save');
        setErrorMessage(getErrorMessage(saveError));
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [detail, entries, kind, name, canSaveDraft, resetConfirmedReferences, sourceLocale, translations],
  );

  return {
    detail,
    kind,
    setKind: updateKind,
    name,
    setName: updateName,
    sourceLocale,
    setSourceLocale: updateSourceLocale,
    translations,
    setTranslation,
    entries,
    isLoading: isLoadingDetail,
    error,
    errorMessage,
    saved,
    isDirty,
    isSaving,
    canSave: Boolean(canSaveDraft && !isLoadingDetail),
    addEntry,
    updateEntry,
    removeEntry,
    moveEntry,
    markReferenceVerified,
    markVariationValidity,
    referenceIsAvailable,
    save,
    reload: loadDetail,
  };
}
