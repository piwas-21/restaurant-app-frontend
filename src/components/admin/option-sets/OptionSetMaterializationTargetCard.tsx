'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { describeOptionSetField } from '@/components/admin/product-editor/describeOptionSetField';
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
const settingNames: Readonly<Record<string, NumericSetting>> = {
  minSelection: 'minSelection',
  MinSelection: 'minSelection',
  maxSelection: 'maxSelection',
  MaxSelection: 'maxSelection',
  includedFree: 'includedFree',
  IncludedFree: 'includedFree',
  displayOrder: 'displayOrder',
  DisplayOrder: 'displayOrder',
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

function hasExpectedVersion(target: OptionSetMaterializationTarget): boolean {
  switch (target.role) {
    case 'bundleChoice':
      return target.expectedMenuAuthoringVersion !== undefined;
    case 'productChoice':
      return target.expectedCustomizationGroupVersion !== undefined;
    default:
      return true;
  }
}

function settingFieldsForRole(role: OptionSetMaterializationTarget['role']): NumericSetting[] {
  switch (role) {
    case 'sauce':
      return ['minSelection', 'maxSelection', 'includedFree'];
    case 'bundleChoice':
      return ['minSelection', 'maxSelection', 'displayOrder'];
    case 'productChoice':
      return ['minSelection', 'maxSelection', 'includedFree', 'displayOrder'];
    default:
      return [];
  }
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
  const validVersion = hasExpectedVersion(target);
  const settingFields = settingFieldsForRole(target.role);
  const overrideFields = optionSetOverrideFields(kind);
  const targetLabel = target.contextName
    ? `${target.targetProductName} · ${target.contextName}`
    : target.targetProductName;

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
          label={targetLabel}
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
          <details className={styles.advanced}>
            <summary>{t('editor_section_advanced')}</summary>
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
          </details>
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
                {previewTarget.changedSettings.map((changedSetting) => {
                  const setting = settingNames[changedSetting];
                  if (!setting) return null;
                  return (
                    <li key={`setting-${changedSetting}`}>
                      {t('option_set_setting_diff', {
                        setting: t(settingLabels[setting]),
                        current: previewTarget.currentSettings[setting] ?? '—',
                        proposed: previewTarget.proposedSettings[setting] ?? '—',
                      })}
                    </li>
                  );
                })}
                {previewTarget.changes.map((change) => (
                  <li key={`${change.entryId}-${change.action}`}>
                    {t(`option_set_change_${change.action}`)} ·{' '}
                    {entries.find((entry) => entry.id === change.entryId)?.name ?? change.entryId}
                    {change.changedFields.length > 0 && (
                      <small>
                        {' '}
                        · {change.changedFields.map((field) => describeOptionSetField(field, undefined, t)).join(' · ')}
                      </small>
                    )}
                    {change.preservedFields.length > 0 && (
                      <small>
                        {' '}
                        ·{' '}
                        {t('option_set_preserved_fields', {
                          fields: change.preservedFields
                            .map((field) => describeOptionSetField(field, undefined, t))
                            .join(' · '),
                        })}
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
