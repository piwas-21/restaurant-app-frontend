'use client';

import React, { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_CODES, type LanguageCode } from '@/config/languageConfig';
import PageHeader from '@/components/admin/PageHeader';
import StatusBadge from '@/components/design-system/StatusBadge';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import CatalogueImportPreviewReview from './CatalogueImportPreviewReview';
import CatalogueImportCompletion from './CatalogueImportCompletion';
import CatalogueImportSelectionReview from './CatalogueImportSelectionReview';
import CatalogueRevisionChangesReview from './CatalogueRevisionChangesReview';
import { useCatalogueImportWorkspace } from '@/hooks/admin/useCatalogueImportWorkspace';
import { useCatalogueOptionPrices } from '@/hooks/admin/useCatalogueOptionPrices';
import { importStatusLabelKey, type CatalogueImportStatus } from '@/services/catalogueImportService';
import styles from './CatalogueImportWorkspace.module.css';

function resolveLocale(locale: string | null): LanguageCode {
  const normalized = locale?.toLowerCase();
  if (normalized && LANGUAGE_CODES.includes(normalized as LanguageCode)) return normalized as LanguageCode;
  return 'en';
}

function importStatusTone(status: CatalogueImportStatus): 'success' | 'danger' | 'info' {
  if (status === 'Imported') return 'success';
  if (status === 'Failed') return 'danger';
  return 'info';
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

  const session = flow.session;
  const canImport =
    Boolean(flow.preview) &&
    flow.preview?.version === flow.session.version &&
    !hasBlockers &&
    !flow.hasInvalidCustomOrderTypes &&
    flow.canManage &&
    !flow.isWorking &&
    !optionPrices.isLoading &&
    !optionPrices.error;
  return (
    <main className={styles.page}>
      <PageHeader title={t('catalogue_import_workspace_title')} />
      <p className={styles.intro}>{t('catalogue_import_workspace_intro')}</p>
      <div className={styles.sessionMeta}>
        <StatusBadge tone={importStatusTone(flow.session.status)}>
          {t(importStatusLabelKey(flow.session.status))}
        </StatusBadge>
        {flow.session.createNewCopy && <span>{t('catalogue_import_copy_mode')}</span>}
      </div>
      <p className={styles.localDataNotice}>{t('catalogue_import_local_data_notice')}</p>
      {!flow.canEditSelection && (
        <p className={styles.locked}>
          {t(flow.canManage ? 'catalogue_import_retry_scope_notice' : 'catalogue_import_selection_locked')}
        </p>
      )}
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
      <CatalogueImportSelectionReview
        session={session}
        selectedIds={flow.selectedIds}
        decisions={flow.decisions}
        priceRefsByOwner={optionPrices.byOwner}
        canEditSelection={flow.canEditSelection}
        canEditDecision={flow.canEditDecision}
        onToggleSelection={(item, selected) => flow.toggleSelection(item.templateId, selected)}
        onDecisionChange={(item, patch) => flow.updateDecision(`${item.templateId}@${item.revision}`, patch)}
      />
      <h2 className={styles.stepHeading}>{t('catalogue_import_step_check')}</h2>
      <CatalogueImportPreviewReview
        preview={flow.preview}
        canChooseCandidate={(templateId, rev) => {
          const item = session.items.find((entry) => entry.templateId === templateId && entry.revision === rev);
          return item ? flow.canEditDecision(item) : false;
        }}
        onChooseCandidate={chooseCandidate}
      />
      {flow.result && <CatalogueImportCompletion result={flow.result} />}
      {flow.result && (
        <CatalogueRevisionChangesReview
          changes={flow.revisionChanges}
          isWorking={flow.isWorking || flow.revisionChangesState.isLoading}
          error={flow.error}
          revisionChangesError={flow.revisionChangesState.error}
          onApply={(item, paths) => void flow.applyRevisionFields(item, paths)}
          onRetry={() => void flow.revisionChangesState.retry()}
        />
      )}
      <div className={styles.actions}>
        <button
          type="button"
          disabled={
            !flow.canManage ||
            flow.isWorking ||
            optionPrices.isLoading ||
            Boolean(optionPrices.error) ||
            flow.hasInvalidCustomOrderTypes
          }
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
