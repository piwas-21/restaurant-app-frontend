'use client';

import React from 'react';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { Control, FieldErrors, FieldValues, UseFormRegister } from 'react-hook-form';
import FormField from '@/components/design-system/FormField';
import { INTEGER_INPUT_PROPS } from './numberInputProps';
import styles from './SauceGroupRules.module.css';

/**
 * The three product-level sauce rules (SHARED-MODIFIERS-AND-SAUCES-PLAN D9; Stitch:
 * `recipe_dietary_details_split_view`).
 *
 * **There is no tenant default here, and that is the point.** The owner's answer to §7 Q3 is that
 * "one free sauce" is a rule a restaurant TYPES, not one this code assumes — so nothing in this
 * file, the schema or the form defaults seeds anything but 0 / no-limit / 0. Q2 still holds too:
 * these are three numbers on the product, not a general min/max-select engine.
 *
 * `sauceMax` empty means NO LIMIT and must reach the API as `null`. `0` is a different and legal
 * rule ("no sauce may be picked"), and `Number('')` is `0`, so the empty input is converted here
 * rather than left to `z.coerce.number()` — which would silently turn "no limit" into "none".
 *
 * DEVIATION from the screen, stated in the plan: the screen writes the rules as one sentence with
 * inputs inside it ("Guests choose min [0] max [3], first [1] free"). A sentence cut into four
 * fragments cannot be translated — the bundle carries ten locales including RTL Arabic, whose word
 * order puts those fragments elsewhere. The three inputs are labelled instead, and the sentence
 * survives as the DERIVED hint below them, which is one translatable string per case.
 */
interface SauceGroupRulesProps {
  // readonly: S6759 — component props are never mutated.
  readonly register: UseFormRegister<FieldValues>;
  readonly control: Control<FieldValues>;
  readonly errors: FieldErrors<FieldValues>;
}

/** Empty stays empty (`null` = no cap); anything else is an integer >= 0. */
const asOptionalCount = (value: unknown): number | null => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
};

export default function SauceGroupRules({ register, control, errors }: SauceGroupRulesProps) {
  const { t } = useTranslation();
  const [min, max, includedFree] = useWatch({
    control,
    name: ['sauceMin', 'sauceMax', 'sauceIncludedFree'],
  }) as [number | undefined, number | null | undefined, number | undefined];

  const cap = asOptionalCount(max);
  const hint = [
    cap === null ? t('sauce_rules_hint_any') : t('sauce_rules_hint_limit', { max: cap }),
    Number(min) > 0 ? t('sauce_rules_hint_min', { min: Number(min) }) : '',
    Number(includedFree) > 0 ? t('sauce_rules_hint_free', { free: Number(includedFree) }) : t('sauce_rules_hint_paid'),
  ]
    .filter(Boolean)
    .join(' ');

  const errorOf = (field: 'sauceMin' | 'sauceMax' | 'sauceIncludedFree') =>
    errors[field]?.message as string | undefined;

  return (
    <fieldset className={styles.rules}>
      <legend className={styles.legend}>{t('sauce_rules_title')}</legend>
      <div className={styles.fields}>
        <FormField label={t('sauce_min_label')} error={errorOf('sauceMin')} className={styles.field}>
          {/* The shared count convention (S8). It is spread BEFORE `register` here only because
              `register` contributes no input attributes these three name; the convention's rule is
              that whichever wins must be the deliberate one, and there is no overlap. */}
          <input {...INTEGER_INPUT_PROPS} {...register('sauceMin', { valueAsNumber: true })} />
        </FormField>
        <FormField label={t('sauce_max_label')} error={errorOf('sauceMax')} className={styles.field}>
          <input
            {...INTEGER_INPUT_PROPS}
            placeholder={t('sauce_max_placeholder')}
            {...register('sauceMax', { setValueAs: asOptionalCount })}
          />
        </FormField>
        <FormField label={t('sauce_included_free_label')} error={errorOf('sauceIncludedFree')} className={styles.field}>
          <input {...INTEGER_INPUT_PROPS} {...register('sauceIncludedFree', { valueAsNumber: true })} />
        </FormField>
      </div>
      <p className={styles.hint}>{hint}</p>
    </fieldset>
  );
}
