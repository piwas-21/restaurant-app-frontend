'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import CheckboxField from '@/components/design-system/CheckboxField';
import FormField from '@/components/design-system/FormField';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { OptionSetEntry, OptionSetKind } from '@/types/optionSet';
import type { OptionSetMaterializationPreview, OptionSetTargetSettings } from '@/types/optionSetMaterialization';
import type { OptionSetMaterializationTarget } from '@/utils/optionSetMaterialization';
import OptionSetMaterializationOverrides, { optionSetOverrideFields } from './OptionSetMaterializationOverrides';
import styles from './OptionSetMaterializationTargetCard.module.css';

type NumericSetting = Exclude<keyof OptionSetTargetSettings, 'clearMaxSelection'>;

const settingLabels: Record<NumericSetting, string> = {
  minSelection: 'minimum_selection',
  maxSelection: 'maximum_selection',
  includedFree: 'sauce_included_free_label',
  displayOrder: 'display_order',
};
interface Props {
  readonly target: OptionSetMaterializationTarget;
  readonly kind: OptionSetKind;
  readonly entries: readonly OptionSetEntry[];
  readonly preview: OptionSetMaterializationPreview | null;
  readonly onUpdate: (patch: Partial<OptionSetMaterializationTarget>, keepPreview?: boolean) => void;
  readonly onRemove?: () => void;
}

function numberValue(value: string): number | undefined {
  return value.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined;
}

function statusTone(status?: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ready' || status === 'applied') return 'success';
  if (status === 'conflict') return 'danger';
  if (status === 'unchanged') return 'neutral';
  return 'warning';
}

export default function OptionSetMaterializationTargetCard({
  target,
  kind,
  entries,
  preview,
  onUpdate,
  onRemove,
}: Props) {
  const { t } = useTranslation();
  const previewTarget = preview?.targets.find((row) => row.targetKey === target.targetKey);
  const requiredReasons =
    preview?.relatedOfferWarnings.filter(
      (warning) => warning.targetKey === target.targetKey && warning.reasonRequired,
    ) ?? [];
  const validVersion =
    target.role === 'bundleChoice'
      ? target.expectedMenuAuthoringVersion !== undefined
      : target.role === 'productChoice'
        ? target.expectedCustomizationGroupVersion !== undefined
        : true;
  const settingFields: NumericSetting[] =
    target.role === 'sauce'
      ? ['minSelection', 'maxSelection', 'includedFree']
      : target.role === 'bundleChoice'
        ? ['minSelection', 'maxSelection', 'displayOrder']
        : target.role === 'productChoice'
          ? ['minSelection', 'maxSelection', 'includedFree', 'displayOrder']
          : [];
  const overrideFields = optionSetOverrideFields(kind);

  const updateSetting = (field: NumericSetting, value: string) => {
    const settings = { ...target.settings };
    const parsed = numberValue(value);
    if (field === 'maxSelection' && target.role === 'sauce') {
      if (parsed === undefined) {
        delete settings.maxSelection;
        settings.clearMaxSelection = true;
      } else {
        settings.maxSelection = parsed;
        delete settings.clearMaxSelection;
      }
    } else if (parsed === undefined) delete settings[field];
    else settings[field] = parsed;
    onUpdate({ settings });
  };

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <CheckboxField
          label={`${target.targetProductName}${target.contextName ? ` · ${target.contextName}` : ''}`}
          checked={target.selected}
          disabled={!validVersion}
          description={!validVersion ? t('option_set_target_version_missing') : undefined}
          onChange={(selected) => onUpdate({ selected })}
        />
        <div className={styles.badges}>
          <StatusBadge tone={target.attachment ? 'info' : 'neutral'}>
            {t(target.attachment ? 'option_set_target_attached' : 'option_set_target_new')}
          </StatusBadge>
          {previewTarget && (
            <StatusBadge tone={statusTone(previewTarget.status)}>
              {t(`option_set_preview_${previewTarget.status}`)}
            </StatusBadge>
          )}
          {onRemove && (
            <button type="button" className={styles.remove} onClick={onRemove}>
              {t('option_set_target_remove')}
            </button>
          )}
        </div>
      </header>
      {target.selected && (
        <div className={styles.configuration}>
          {settingFields.length > 0 && (
            <fieldset className={styles.settings}>
              <legend>{t('option_set_target_rules')}</legend>
              {settingFields.map((field) => (
                <FormField key={field} label={t(settingLabels[field])}>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={target.settings[field] ?? ''}
                    onChange={(event) => updateSetting(field, event.target.value)}
                  />
                </FormField>
              ))}
            </fieldset>
          )}
          <FormField label={t('option_set_conflict_policy')}>
            <select
              value={target.conflictPolicy}
              onChange={(event) =>
                onUpdate({ conflictPolicy: event.target.value as OptionSetMaterializationTarget['conflictPolicy'] })
              }
            >
              <option value="preserveLocal">{t('option_set_policy_preserve_local')}</option>
              <option value="useSetValues">{t('option_set_policy_use_set')}</option>
              {overrideFields.length > 0 && <option value="useOverrides">{t('option_set_policy_overrides')}</option>}
            </select>
          </FormField>
          {target.conflictPolicy === 'useOverrides' && overrideFields.length > 0 && (
            <OptionSetMaterializationOverrides
              kind={kind}
              entries={entries}
              overrides={target.overrides}
              onChange={(overrides) => onUpdate({ overrides })}
            />
          )}
          {requiredReasons.length > 0 && (
            <div>
              <FormField label={t('option_set_difference_reason')}>
                <textarea
                  maxLength={500}
                  value={target.intentionalDifferenceReason}
                  onChange={(event) => onUpdate({ intentionalDifferenceReason: event.target.value }, true)}
                  rows={2}
                />
              </FormField>
              <small>
                {t('option_set_difference_reason_help', {
                  related: requiredReasons.map((warning) => warning.relatedProductName).join(', '),
                })}
              </small>
            </div>
          )}
          {previewTarget && (
            <div className={styles.preview}>
              {previewTarget.conflicts.map((conflict, index) => (
                <p className={styles.conflict} key={`${conflict.code}-${index}`}>
                  {conflict.message}
                </p>
              ))}
              <ul>
                {previewTarget.changes.map((change) => (
                  <li key={`${change.entryId}-${change.action}`}>
                    {t(`option_set_change_${change.action}`)} ·{' '}
                    {change.changedFields.join(', ') || t('option_set_no_field_changes')}
                    {change.preservedFields.length > 0 && (
                      <small>
                        {' '}
                        · {t('option_set_preserved_fields', { fields: change.preservedFields.join(', ') })}
                      </small>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
