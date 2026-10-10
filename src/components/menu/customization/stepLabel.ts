import type { CustomizationStep } from '@/utils/customizationSteps';
import type { SauceGroupRule } from '@/types/menu';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * A step's visible name. Tenant-authored text (a bundle section's own name) wins over the platform
 * key, because the restaurant already said what that section is called and translating over it
 * would replace their words with ours.
 */
export function stepLabel(step: CustomizationStep, t: Translate): string {
  if (step.title) return step.title;
  return step.titleKey ? t(step.titleKey) : '';
}

export function stepHint(step: CustomizationStep, t: Translate): string | undefined {
  if (step.kind !== 'group' || !step.group) return undefined;
  return groupHint(t, {
    min: step.group.minSelection,
    max: step.group.maxSelection,
    includedFree: step.group.includedFreeUnits,
  });
}
/**
 * The group hint — the min/max as text under the legend, never a tooltip (WCAG: a rule the guest
 * must satisfy has to be readable without hovering anything), plus what the allowance gives.
 */
export function groupHint(t: Translate, rule: SauceGroupRule): string {
  const clauses: string[] = [];

  if (rule.max === null) {
    if (rule.min > 0) clauses.push(t('sauces_hint_at_least', { min: rule.min }));
  } else if (rule.min === rule.max) {
    clauses.push(t('sauces_hint_exactly', { amount: rule.max }));
  } else if (rule.min > 0) {
    clauses.push(t('sauces_hint_between', { min: rule.min, max: rule.max }));
  } else {
    clauses.push(t('sauces_hint_up_to', { max: rule.max }));
  }

  if (rule.includedFree === 1) clauses.push(t('sauces_hint_first_free'));
  else if (rule.includedFree > 1) clauses.push(t('sauces_hint_n_free', { amount: rule.includedFree }));

  return clauses.join(' ');
}

/** The collapsed one-liner: what the guest is choosing between, before they open anything. */
export function groupSummary(t: Translate, rule: SauceGroupRule, selectedCount: number, available: number): string {
  if (selectedCount > 0) return t('sauces_summary_selected', { selected: selectedCount });
  return rule.includedFree > 0
    ? t('sauces_summary_free', { included: rule.includedFree, available })
    : t('sauces_summary_available', { available });
}
