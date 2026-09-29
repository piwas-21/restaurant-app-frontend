'use client';

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import BaseModal from '@/components/design-system/BaseModal';
import FormField from '@/components/design-system/FormField';
import { useOptionSetMaterializationFeature } from '@/hooks/admin/useOptionSetMaterializationFeature';
import { applyOptionSetAttachments, previewOptionSetAttachments } from '@/services/optionSetService';
import type { OptionSetDetail } from '@/types/optionSet';
import type {
  OptionSetMaterializationPreview,
  OptionSetMaterializationRequest,
} from '@/types/optionSetMaterialization';
import { getErrorMessage } from '@/utils/apiClient';
import { targetFromAttachment, targetsForProduct } from '@/utils/optionSetMaterialization';
import {
  createOptionSetIdempotencyKey,
  makeOptionSetMaterializationRequest,
} from '@/utils/optionSetMaterializationRequest';
import styles from './EditorOptionSetPicker.module.css';
import {
  describeOptionSetField,
  optionSetDifferenceReasonSchema,
  optionSetSettingLabel,
  optionSetSettingValue,
} from './describeOptionSetField';

interface Props {
  readonly set: OptionSetDetail;
  readonly product: ProductDetails;
  readonly isDirty: boolean;
  readonly onApplied: () => void;
}

/** A saved editor target can attach a versioned set after the server shows its exact row diff. */
export default function EditorOptionSetLink({ set, product, isDirty, onApplied }: Props) {
  const { t } = useTranslation();
  const feature = useOptionSetMaterializationFeature();
  const targets = useMemo(() => {
    const attached = set.attachments
      .filter((attachment) => attachment.targetProductId === product.id)
      .flatMap((attachment) => {
        const target = targetFromAttachment(attachment, product);
        return target ? [target] : [];
      });
    return targetsForProduct(product, set.kind).map(
      (target) => attached.find((candidate) => candidate.targetKey === target.targetKey) ?? target,
    );
  }, [product, set.attachments, set.kind]);
  const [selectedKey, setSelectedKey] = useState(targets[0]?.targetKey ?? '');
  const [preview, setPreview] = useState<OptionSetMaterializationPreview | null>(null);
  const [request, setRequest] = useState<OptionSetMaterializationRequest | null>(null);
  const [differenceReason, setDifferenceReason] = useState('');
  const [working, setWorking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = targets.find((candidate) => candidate.targetKey === selectedKey);
  const previewTarget = preview?.targets.find((candidate) => candidate.targetKey === selectedKey);
  const needsReason = preview?.relatedOfferWarnings.some(
    (warning) => warning.targetKey === selectedKey && warning.reasonRequired,
  );
  const parsedReason = optionSetDifferenceReasonSchema.safeParse(differenceReason);
  const validReason = parsedReason.success && (!needsReason || parsedReason.data.length > 0);
  const entryIds = set.entries.flatMap((entry) => (entry.id ? [entry.id] : []));
  const canPreview = Boolean(
    feature.enabled &&
    set.status === 'active' &&
    !isDirty &&
    target?.selected &&
    entryIds.length === set.entries.length &&
    entryIds.length,
  );
  const canApply = Boolean(!isDirty && feature.enabled && previewTarget?.status === 'ready' && request && validReason);

  if (!feature.enabled) return null;

  const runPreview = async () => {
    if (!canPreview || !target) return;
    const nextRequest = makeOptionSetMaterializationRequest(
      set.version,
      createOptionSetIdempotencyKey(),
      [target],
      entryIds,
    );
    if (!nextRequest) return;
    setWorking(true);
    setError(null);
    setPreview(null);
    setRequest(null);
    try {
      setPreview(await previewOptionSetAttachments(set.id, nextRequest));
      setRequest(nextRequest);
    } catch (requestError) {
      setError(getErrorMessage(requestError) ?? t('option_set_materialization_error'));
    } finally {
      setWorking(false);
    }
  };

  const runApply = async () => {
    if (!canApply || !request || !target || !parsedReason.success) return;
    setWorking(true);
    setApplying(true);
    setError(null);
    try {
      const withReason = parsedReason.data
        ? {
            ...request,
            targets: request.targets.map((row) => ({
              ...row,
              intentionalDifferenceReason: parsedReason.data,
            })),
          }
        : request;
      const result = await applyOptionSetAttachments(set.id, withReason);
      const applied = result.targets.find((row) => row.targetKey === target.targetKey);
      if (applied?.status !== 'applied') {
        setError(
          applied?.conflicts.map((conflict) => conflict.message).join('; ') || t('option_set_materialization_error'),
        );
        return;
      }
      onApplied();
    } catch (requestError) {
      setError(getErrorMessage(requestError) ?? t('option_set_materialization_error'));
    } finally {
      setWorking(false);
      setApplying(false);
    }
  };

  return (
    <details className={styles.linkFlow}>
      <summary>{t('editor_option_set_link_title')}</summary>
      <p>{t('editor_option_set_link_help')}</p>
      {targets.length > 1 && (
        <FormField label={t('editor_option_set_link_target')}>
          <select
            value={selectedKey}
            onChange={(event) => {
              setSelectedKey(event.target.value);
              setPreview(null);
              setRequest(null);
              setDifferenceReason('');
            }}
          >
            {targets.map((candidate) => (
              <option key={candidate.targetKey} value={candidate.targetKey}>
                {candidate.contextName ?? candidate.targetProductName}
              </option>
            ))}
          </select>
        </FormField>
      )}
      {targets.length === 0 && <p>{t('editor_option_set_link_no_target')}</p>}
      {target && !target.selected && <p>{t('option_set_target_version_missing')}</p>}
      {isDirty && <p>{t('editor_option_set_link_save_first')}</p>}
      {target?.attachment && (
        <p>{t('editor_option_set_link_version', { version: target.attachment.appliedSetVersion })}</p>
      )}
      <button type="button" disabled={!canPreview || working} onClick={() => void runPreview()}>
        {t('option_set_preview_title')}
      </button>
      {previewTarget && (
        <div aria-live="polite">
          <p>{t(`option_set_preview_${previewTarget.status}`)}</p>
          {previewTarget.conflicts.map((conflict, index) => (
            <p role="alert" key={`${conflict.code}-${index}`}>
              {conflict.message}
            </p>
          ))}
          {preview?.relatedOfferWarnings
            .filter((warning) => warning.targetKey === selectedKey)
            .map((warning) => (
              <p key={`${warning.targetKey}-${warning.relatedProductId}`}>
                {t('option_set_related_offer_warning', {
                  name: warning.relatedProductName,
                  type: t(`option_set_related_offer_${warning.relatedOfferType}`),
                })}
              </p>
            ))}
          <ul>
            {previewTarget.changedSettings.map((setting) => (
              <li key={`setting-${setting}`}>
                {t('option_set_setting_diff', {
                  setting: t(optionSetSettingLabel(setting)),
                  current: optionSetSettingValue(previewTarget.currentSettings, setting),
                  proposed: optionSetSettingValue(previewTarget.proposedSettings, setting),
                })}
              </li>
            ))}
            {previewTarget.changes.map((change) => (
              <li key={`${change.entryId}-${change.action}`}>
                {t(`option_set_change_${change.action}`)} ·{' '}
                {set.entries.find((entry) => entry.id === change.entryId)?.name ?? change.entryId}
                {change.action === 'update' && change.changedFields.length > 0 && (
                  <small>
                    {change.changedFields
                      .map((field) =>
                        describeOptionSetField(
                          field,
                          set.entries.find((entry) => entry.id === change.entryId),
                          t,
                        ),
                      )
                      .join(' · ')}
                  </small>
                )}
                {change.preservedFields.length > 0 && (
                  <small>
                    {t('editor_option_set_link_preserved')}:{' '}
                    {change.preservedFields.map((field) => describeOptionSetField(field, undefined, t)).join(' · ')}
                  </small>
                )}
              </li>
            ))}
          </ul>
          {needsReason && (
            <FormField
              label={t('option_set_difference_reason')}
              error={!validReason ? t('option_set_difference_reason_required') : undefined}
            >
              <textarea
                value={differenceReason}
                maxLength={500}
                onChange={(event) => setDifferenceReason(event.target.value)}
              />
            </FormField>
          )}
          <button type="button" disabled={!canApply || working} onClick={() => void runApply()}>
            {t('editor_option_set_link_title')}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <BaseModal isOpen={applying} onClose={() => {}} title={t('editor_option_set_link_title')} size="sm" isPending>
        <p role="status">{t('option_set_materialization_working')}</p>
      </BaseModal>
    </details>
  );
}
