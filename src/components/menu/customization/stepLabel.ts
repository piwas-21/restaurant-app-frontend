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
/**
 * The footer's action when the guest has left an OPTIONAL step untouched: "Sans …" (partner
 * feedback 2026-09-06 — on a sauces row the generic verb reads like a dead end, where "Sans
 * sauce" reads as the answer it is). Mirrors `stepLabel`'s rule in reverse: a step carrying a
 * TENANT-authored `title` cannot be declined into every language, so it keeps the generic verb.
 * The keys are per KIND, not one interpolated template, because the noun inflects per language
 * ("Sans sauce" / "No sauce" / "بدون صلصة" share no word order).
 *
 * The sauces step reads `sauce_none` — the SAME key the group's built-in row is labelled with —
 * so the button and the row it answers are one string with one writer (partner feedback
 * 2026-09: the press should read as the answer it commits, and the answer already has a name).
 * The old `step_skip_sauces` twin was byte-identical in all ten bundles and is deleted; keeping
 * two keys for one noun is how they drift.
 */
export function stepSkipLabel(step: CustomizationStep | undefined, t: Translate): string {
  // The sheet renders before a step exists (flow.step is undefined at open), and an absent step
  // cannot have a noun — the generic verb is the only honest wording there.
  if (!step || step.title) return t('step_skip');
  switch (step.kind) {
    case 'sauces':
      return t('sauce_none');
    case 'ingredients':
      return t('step_skip_ingredients');
    case 'drinks':
      return t('step_skip_drinks');
    case 'sides':
      return t(step.sideGroup ? `step_skip_sides_${step.sideGroup}` : 'step_skip');
    default:
      // variations answer "which size", review is never skippable, sections are tenant-worded.
      return t('step_skip');
  }
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
