'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import { getProductById } from '@/services/menuService';
import type { CatalogueImportResult } from '@/services/catalogueImportService';
import type { DetailedProduct, DetailedProductResponse, MenuDefinition, MenuSection } from '@/types/menu';
import { serverMessage } from '@/utils/apiFormErrors';
import BundleGuestStepPreview from '@/components/admin/product-editor/BundleGuestStepPreview';
import CatalogueImportedItemPreview from './CatalogueImportedItemPreview';
import styles from './CatalogueImportGuestReview.module.css';

type ImportedLocalItem = CatalogueImportResult['items'][number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readProductDetail(response: unknown): DetailedProduct | null {
  if (!isRecord(response) || response.success !== true || !isRecord(response.data)) {
    return null;
  }
  const detail = response as unknown as DetailedProductResponse;
  if (
    typeof detail.data.id !== 'string' ||
    typeof detail.data.name !== 'string' ||
    typeof detail.data.isActive !== 'boolean' ||
    typeof detail.data.isAvailable !== 'boolean' ||
    typeof detail.data.basePrice !== 'number'
  ) {
    return null;
  }
  return detail.data;
}

function localizedMenuDefinition(definition: MenuDefinition, locale: string): MenuDefinition {
  const language = locale.split('-')[0];
  return {
    ...definition,
    sections: definition.sections.map((section) => {
      const dto = section as MenuSection & { displayName?: string; displayDescription?: string | null };
      const translation = section.translations?.[locale] ?? section.translations?.[language];
      return {
        ...section,
        name: dto.displayName || translation?.name || section.name,
        description:
          dto.displayDescription !== undefined
            ? (dto.displayDescription ?? undefined)
            : (translation?.description ?? section.description),
      };
    }),
  };
}

export default function CatalogueImportGuestReview({ items }: { readonly items: readonly ImportedLocalItem[] }) {
  const { t, i18n } = useTranslation();
  const records = useMemo(() => {
    const unique = new Map<string, ImportedLocalItem>();
    items.forEach((item) => {
      if (item.localEntityId) unique.set(item.localEntityId, item);
    });
    return [...unique.values()];
  }, [items]);
  const [selectedId, setSelectedId] = useState(records[0]?.localEntityId ?? '');
  const [detail, setDetail] = useState<DetailedProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const locale = i18n.resolvedLanguage || i18n.language || 'en';

  useEffect(() => {
    if (!selectedId) return undefined;
    const controller = new AbortController();
    setDetail(null);
    setError(null);
    setLoading(true);
    getProductById(selectedId, controller.signal, undefined, locale)
      .then((response: unknown) => {
        const product = readProductDetail(response);
        if (product) setDetail(product);
        else {
          const refusal = isRecord(response) && response.success !== true ? serverMessage(response) : null;
          setError(refusal ?? t('catalogue_import_guest_preview_error'));
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(serverMessage(reason) ?? t('catalogue_import_guest_preview_error'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [selectedId, reloadCount, locale, t]);

  const selected = records.find((item) => item.localEntityId === selectedId);
  const menuDefinition = detail?.menuDefinition;

  return (
    <section className={styles.review} aria-labelledby="catalogue-import-guest-review-title">
      <div>
        <h3 id="catalogue-import-guest-review-title">{t('catalogue_import_guest_review_title')}</h3>
        <p className={styles.description}>{t('catalogue_import_guest_review_description')}</p>
      </div>
      <FormField label={t('catalogue_import_guest_review_select')}>
        <select className={styles.select} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          {records.map((item) => (
            <option key={item.localEntityId} value={item.localEntityId ?? ''}>
              {item.templateId}@{item.revision}
            </option>
          ))}
        </select>
      </FormField>
      {loading && <p role="status">{t('loading')}…</p>}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
          {selected && (
            <button type="button" onClick={() => setReloadCount((count) => count + 1)}>
              {t('retry')}
            </button>
          )}
        </p>
      )}
      {detail && menuDefinition && (
        <BundleGuestStepPreview
          menuDefinition={localizedMenuDefinition(menuDefinition, locale)}
          availability={detail.availability}
          quoteContext={{
            productId: detail.id,
            isDirty: false,
            isActive: detail.isActive,
            isAvailable: detail.isAvailable,
          }}
        />
      )}
      {detail && !menuDefinition && detail.type === 'menu' && (
        <p role="alert" className={styles.error}>
          {t('catalogue_import_guest_missing_menu')}
        </p>
      )}
      {detail && !menuDefinition && detail.type !== 'menu' && (
        <CatalogueImportedItemPreview key={detail.id} product={detail} locale={locale} />
      )}
    </section>
  );
}
