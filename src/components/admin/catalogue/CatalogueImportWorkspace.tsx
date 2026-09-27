'use client';

import React, { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_CODES, type LanguageCode } from '@/config/languageConfig';
import PageHeader from '@/components/admin/PageHeader';
import StatusBadge from '@/components/design-system/StatusBadge';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import CatalogueImportItemReview from './CatalogueImportItemReview';
import CatalogueImportPreviewReview from './CatalogueImportPreviewReview';
import CatalogueImportCompletion from './CatalogueImportCompletion';
import { useCatalogueImportWorkspace } from '@/hooks/admin/useCatalogueImportWorkspace';
import { useCatalogueOptionPrices } from '@/hooks/admin/useCatalogueOptionPrices';
import { importStatusLabelKey } from '@/services/catalogueImportService';
import styles from './CatalogueImportWorkspace.module.css';

function resolveLocale(locale: string | null): LanguageCode {
  const normalized = locale?.toLowerCase();
  if (normalized && LANGUAGE_CODES.includes(normalized as LanguageCode)) return normalized as LanguageCode;
  return 'en';
}

function ImportRoute() {
  const { t } = useTranslation();
  const params = useSearchParams();
  const router = useRouter();
  const sessionId = params.get('sessionId') ?? undefined;
  const templateId = params.get('templateId') ?? '';
  const revision = Number(params.get('revision'));
  const locale = resolveLocale(params.get('locale'));
  const selectedTemplateIds = params.getAll('selected');
  const createNewCopy = params.get('createNewCopy') === 'true';
  const validRoute = Boolean(sessionId) || (templateId.length > 0 && Number.isInteger(revision) && revision > 0);
  const onSessionCreated = useCallback(
    (id: string) => {
      const next = new URLSearchParams(params.toString());
      next.set('sessionId', id);
      router.replace(`/admin/menu-management/catalogue/import?${next.toString()}`);
    },
    [params, router],
  );
  const flow = useCatalogueImportWorkspace({
    templateId,
    revision,
    locale,
    selectedTemplateIds,
    createNewCopy,
    sessionId,
    onSessionCreated,
  });
  const updateDecision = flow.updateDecision;
  const selectedItems = useMemo(
    () => flow.session?.items.filter((item) => flow.selectedIds.includes(item.templateId)) ?? [],
    [flow.selectedIds, flow.session],
  );
  const optionPrices = useCatalogueOptionPrices(selectedItems, locale);
  const hasBlockers = flow.preview?.items.some((item) => item.isSelected && item.blockingIssues.length > 0) ?? true;

  const chooseCandidate = useCallback(
    (id: string, rev: number, candidate: { id: string }) => {
      updateDecision(`${id}@${rev}`, { resolution: 'Reuse', localEntityId: candidate.id });
    },
    [updateDecision],
  );

  if (!validRoute)
    return (
      <main className={styles.page}>
        <p role="alert">{t('catalogue_import_invalid_link')}</p>
      </main>
    );
  if (flow.isLoading)
    return (
      <main className={styles.page}>
        <output>{t('catalogue_import_loading')}</output>
      </main>
    );
  if (!flow.session)
    return (
      <main className={styles.page}>
        <p role="alert">{t(flow.error ?? 'catalogue_import_load_error')}</p>
      </main>
    );

  const canImport =
    Boolean(flow.preview) &&
    flow.preview?.version === flow.session.version &&
    !hasBlockers &&
    !flow.isWorking &&
    !optionPrices.isLoading &&
    !optionPrices.error;
  return (
    <main className={styles.page}>
      <PageHeader title={t('catalogue_import_workspace_title')} />
      <p className={styles.intro}>{t('catalogue_import_workspace_intro')}</p>
      <div className={styles.sessionMeta}>
        <StatusBadge
          tone={flow.session.status === 'Imported' ? 'success' : flow.session.status === 'Failed' ? 'danger' : 'info'}
        >
          {t(importStatusLabelKey(flow.session.status))}
        </StatusBadge>
        <span>{t('catalogue_import_version', { version: flow.session.version })}</span>
        <span>{t(flow.session.createNewCopy ? 'catalogue_import_copy_mode' : 'catalogue_import_reuse_mode')}</span>
      </div>
      <p className={styles.localDataNotice}>{t('catalogue_import_local_data_notice')}</p>
      {flow.error && (
        <p className={styles.error} role="alert">
          {t(flow.error)}
        </p>
      )}
      {optionPrices.error && (
        <p className={styles.error} role="alert">
          {t(
            optionPrices.error === 'tooMany'
              ? 'catalogue_import_price_detail_limit'
              : 'catalogue_import_price_detail_error',
          )}
          {optionPrices.error === 'failed' && (
            <button type="button" onClick={optionPrices.retry}>
              {t('catalogue_retry')}
            </button>
          )}
        </p>
      )}
      {optionPrices.isLoading && <output>{t('catalogue_import_price_details_loading')}</output>}
      <section className={styles.itemList} aria-label={t('catalogue_import_template_items')}>
        {flow.session.items.map((item) => {
          const key = `${item.templateId}@${item.revision}`;
          const decision = flow.decisions[key] ?? {
            templateId: item.templateId,
            revision: item.revision,
            resolution: 'Create' as const,
          };
          return (
            <CatalogueImportItemReview
              key={key}
              item={item}
              decision={decision}
              selected={flow.selectedIds.includes(item.templateId)}
              priceRefs={optionPrices.byOwner[key] ?? []}
              onSelectedChange={(selected) => flow.toggleSelection(item.templateId, selected)}
              onDecisionChange={(patch) => flow.updateDecision(key, patch)}
            />
          );
        })}
      </section>
      <CatalogueImportPreviewReview preview={flow.preview} onChooseCandidate={chooseCandidate} />
      {flow.result && <CatalogueImportCompletion result={flow.result} changes={flow.revisionChanges} />}
      <div className={styles.actions}>
        <button
          type="button"
          disabled={flow.isWorking || optionPrices.isLoading || Boolean(optionPrices.error)}
          onClick={() => void flow.checkPreview()}
        >
          {t(flow.isWorking ? 'catalogue_import_working' : 'catalogue_import_check_preview')}
        </button>
        <button type="button" disabled={!canImport} onClick={() => void flow.runImport()}>
          {t('catalogue_import_apply')}
        </button>
      </div>
    </main>
  );
}

export default function CatalogueImportWorkspace() {
  return (
    <AdminAuthGuard>
      <Suspense
        fallback={
          <main className={styles.page}>
            <output>Loading…</output>
          </main>
        }
      >
        <ImportRoute />
      </Suspense>
    </AdminAuthGuard>
  );
}
