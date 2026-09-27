'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import { useOptionSetMaterialization } from '@/hooks/admin/useOptionSetMaterialization';
import type { OptionSetDetail } from '@/types/optionSet';
import OptionSetAttachmentTargetPicker from './OptionSetAttachmentTargetPicker';
import OptionSetMaterializationTargetCard from './OptionSetMaterializationTargetCard';
import styles from './OptionSetAttachmentManager.module.css';

interface Props {
  readonly detail: OptionSetDetail;
  readonly isDirty: boolean;
  readonly onApplied: () => void;
}

export default function OptionSetAttachmentManager({ detail, isDirty, onApplied }: Props) {
  const { t } = useTranslation();
  const workflow = useOptionSetMaterialization(detail, isDirty, onApplied);
  const previewsReady = workflow.preview?.targets.filter((target) => target.status === 'ready').length ?? 0;
  const resultApplied = workflow.result?.targets.filter((target) => target.status === 'applied').length ?? 0;

  return (
    <section className={styles.manager} aria-labelledby="option-set-materialization-heading">
      <header className={styles.heading}>
        <div>
          <h2 id="option-set-materialization-heading">{t('option_set_materialization_title')}</h2>
          <p>{t('option_set_materialization_help')}</p>
        </div>
        <StatusBadge tone={workflow.feature.enabled ? 'success' : 'warning'}>
          {t(
            workflow.feature.isLoading
              ? 'loading'
              : workflow.feature.enabled
                ? 'option_set_materialization_enabled'
                : 'option_set_materialization_disabled_badge',
          )}
        </StatusBadge>
      </header>
      {workflow.feature.error && (
        <p role="alert" className={styles.error}>
          {t('option_set_materialization_flag_error')}
        </p>
      )}
      {!workflow.feature.enabled && !workflow.feature.isLoading && !workflow.feature.error && (
        <p className={styles.notice}>{t('option_set_materialization_disabled')}</p>
      )}
      {isDirty && <p className={styles.notice}>{t('option_set_materialization_save_first')}</p>}
      {detail.status === 'archived' && <p className={styles.notice}>{t('option_set_materialization_archived')}</p>}
      {!workflow.allEntriesPersisted && (
        <p role="alert" className={styles.error}>
          {t('option_set_materialization_unsaved_entries')}
        </p>
      )}
      {workflow.error && (
        <p role="alert" className={styles.error}>
          {workflow.error}
        </p>
      )}
      {workflow.targetErrors &&
        Object.entries(workflow.targetErrors).map(([productId, message]) => (
          <p role="alert" className={styles.error} key={productId}>
            {t('option_set_target_load_failed', { id: productId })}: {message}
          </p>
        ))}
      {workflow.isLoadingTargets ? (
        <output>{t('option_set_target_loading')}</output>
      ) : (
        <>
          {workflow.targets.length === 0 && detail.attachments.length === 0 && (
            <p className={styles.notice}>{t('option_set_target_none')}</p>
          )}
          {workflow.targets.length > 0 && (
            <div className={styles.targets}>
              {workflow.targets.map((target) => (
                <OptionSetMaterializationTargetCard
                  key={target.targetKey}
                  target={target}
                  kind={detail.kind}
                  entries={detail.entries}
                  preview={workflow.preview}
                  onUpdate={(patch, keepPreview) => workflow.updateTarget(target.targetKey, patch, keepPreview)}
                  onRemove={target.attachment ? undefined : () => workflow.removeTarget(target.targetKey)}
                />
              ))}
            </div>
          )}
          <OptionSetAttachmentTargetPicker kind={detail.kind} onAdd={workflow.addProduct} />
        </>
      )}
      {workflow.preview && (
        <div className={styles.preview} aria-live="polite">
          <h3>{t('option_set_preview_title')}</h3>
          <p>{t('option_set_preview_summary', { ready: previewsReady, total: workflow.preview.targets.length })}</p>
          {workflow.preview.relatedOfferWarnings.length > 0 && (
            <div>
              <h4>{t('option_set_related_offer_warnings')}</h4>
              <ul>
                {workflow.preview.relatedOfferWarnings.map((warning, index) => (
                  <li key={`${warning.targetKey}-${warning.relatedProductId}-${index}`}>
                    {t('option_set_related_offer_warning', {
                      name: warning.relatedProductName,
                      type: t(`option_set_related_offer_${warning.relatedOfferType}`),
                    })}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {workflow.missingReasonTargets.length > 0 && (
            <p role="alert" className={styles.error}>
              {t('option_set_difference_reason_required')}
            </p>
          )}
        </div>
      )}
      {workflow.result && (
        <div className={styles.result} role="status">
          <p>{t('option_set_apply_summary', { applied: resultApplied, total: workflow.result.targets.length })}</p>
          <ul>
            {workflow.result.targets.map((target) => (
              <li key={target.targetKey}>
                <StatusBadge
                  tone={target.status === 'applied' ? 'success' : target.status === 'conflict' ? 'danger' : 'neutral'}
                >
                  {t(`option_set_apply_${target.status}`)}
                </StatusBadge>
                {target.conflicts.map((conflict, index) => (
                  <span key={`${conflict.code}-${index}`}> {conflict.message}</span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondaryAction}
          disabled={!workflow.canPreview || workflow.isWorking}
          onClick={() => void workflow.runPreview()}
        >
          {t(workflow.isWorking ? 'option_set_materialization_working' : 'option_set_preview_action')}
        </button>
        <button
          type="button"
          className={styles.primaryAction}
          disabled={!workflow.canApply}
          onClick={() => void workflow.runApply()}
        >
          {t(workflow.isWorking ? 'option_set_materialization_working' : 'option_set_apply_action')}
        </button>
        {(Object.keys(workflow.targetErrors).length > 0 || workflow.feature.error) && (
          <button
            type="button"
            className={styles.secondaryAction}
            disabled={workflow.isWorking}
            onClick={() => {
              workflow.reloadTargets();
              void workflow.feature.reload();
            }}
          >
            {t('retry')}
          </button>
        )}
      </div>
    </section>
  );
}
