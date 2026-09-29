'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LanguageCode } from '@/config/languageConfig';
import type { useCatalogueImportWorkspace } from '@/hooks/admin/useCatalogueImportWorkspace';
import type { useCatalogueOptionPrices } from '@/hooks/admin/useCatalogueOptionPrices';
import CatalogueImportPreviewReview from './CatalogueImportPreviewReview';
import CatalogueImportSelectionReview from './CatalogueImportSelectionReview';
import styles from './CatalogueImportWorkspace.module.css';
import reviewStyles from './CatalogueImportGuidedReview.module.css';

interface Props {
  readonly flow: ReturnType<typeof useCatalogueImportWorkspace>;
  readonly optionPrices: ReturnType<typeof useCatalogueOptionPrices>;
  readonly locale: LanguageCode;
}

type ReviewStep = 'selection' | 'details' | 'check';
const stepLabelKeys: Record<ReviewStep, string> = {
  selection: 'catalogue_import_step_offers',
  details: 'catalogue_import_step_details',
  check: 'catalogue_import_step_check',
};

export default function CatalogueImportGuidedReview({ flow, optionPrices, locale }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<ReviewStep>('selection');
  const [activeItemKey, setActiveItemKey] = useState<string>();
  const session = flow.session;
  if (!session) return null;

  const selectedItems = session.items.filter((item) => flow.selectedIds.includes(item.templateId));
  const blockers = flow.preview?.items.some((item) => item.isSelected && item.blockingIssues.length > 0) ?? true;
  const canImport =
    Boolean(flow.preview) &&
    flow.preview?.version === session.version &&
    !blockers &&
    !flow.hasInvalidCustomOrderTypes &&
    flow.canManage &&
    !flow.isWorking &&
    !optionPrices.isLoading &&
    !optionPrices.error;
  const chooseCandidate = (templateId: string, revision: number, candidate: { id: string }) => {
    flow.updateDecision(`${templateId}@${revision}`, { resolution: 'Reuse', localEntityId: candidate.id });
    setActiveItemKey(`${templateId}@${revision}`);
    setStep('details');
  };
  const editItem = (templateId: string, revision: number) => {
    setActiveItemKey(`${templateId}@${revision}`);
    setStep('details');
  };
  const check = () => {
    setStep('check');
    void flow.checkPreview();
  };

  return (
    <section className={reviewStyles.reviewFlow} aria-label={t('catalogue_import_workspace_title')}>
      <nav className={reviewStyles.reviewSteps} aria-label={t('catalogue_import_workspace_title')}>
        {(['selection', 'details', 'check'] as const).map((reviewStep, index) => (
          <button
            key={reviewStep}
            type="button"
            aria-current={step === reviewStep ? 'step' : undefined}
            disabled={reviewStep !== 'selection' && selectedItems.length === 0}
            onClick={() => setStep(reviewStep)}
          >
            <span aria-hidden="true">{index + 1}</span>
            {t(stepLabelKeys[reviewStep])}
          </button>
        ))}
      </nav>
      {step !== 'check' ? (
        <CatalogueImportSelectionReview
          session={session}
          selectedIds={flow.selectedIds}
          decisions={flow.decisions}
          priceRefsByOwner={optionPrices.byOwner}
          detailsByKey={optionPrices.detailsByKey}
          canEditSelection={flow.canEditSelection}
          canEditDecision={flow.canEditDecision}
          onToggleSelection={(item, selected) => flow.toggleSelection(item.templateId, selected)}
          onDecisionChange={(item, patch) => flow.updateDecision(`${item.templateId}@${item.revision}`, patch)}
          mode={step}
          activeItemKey={activeItemKey}
          onActiveItemChange={setActiveItemKey}
        />
      ) : (
        <>
          <h2 className={styles.stepHeading}>{t('catalogue_import_step_check')}</h2>
          {!flow.preview && !flow.isWorking && (
            <p className={styles.referenceText}>{t('catalogue_import_check_preview')}</p>
          )}
          {flow.isWorking && <output>{t('catalogue_import_working')}</output>}
          <CatalogueImportPreviewReview
            preview={flow.preview}
            locale={locale}
            detailsByKey={optionPrices.detailsByKey}
            decisions={flow.decisions}
            canChooseCandidate={(templateId, revision) => {
              const item = session.items.find(
                (entry) => entry.templateId === templateId && entry.revision === revision,
              );
              return item ? flow.canEditDecision(item) : false;
            }}
            onChooseCandidate={chooseCandidate}
            onEditItem={editItem}
          />
        </>
      )}
      <div className={styles.actions}>
        {step !== 'selection' && (
          <button type="button" onClick={() => setStep(step === 'check' ? 'details' : 'selection')}>
            {t('back')}
          </button>
        )}
        {step === 'selection' && (
          <button type="button" disabled={selectedItems.length === 0} onClick={() => setStep('details')}>
            {t('next')}
          </button>
        )}
        {step === 'details' && (
          <button
            type="button"
            disabled={
              !flow.canManage ||
              flow.isWorking ||
              optionPrices.isLoading ||
              Boolean(optionPrices.error) ||
              flow.hasInvalidCustomOrderTypes
            }
            onClick={check}
          >
            {t(flow.isWorking ? 'catalogue_import_working' : 'catalogue_import_check_preview')}
          </button>
        )}
        {step === 'check' && (
          <>
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
          </>
        )}
      </div>
    </section>
  );
}
