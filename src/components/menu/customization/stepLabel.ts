import type { CustomizationStep } from '@/utils/customizationSteps';

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
 */
export function stepSkipLabel(step: CustomizationStep | undefined, t: Translate): string {
  // The sheet renders before a step exists (flow.step is undefined at open), and an absent step
  // cannot have a noun — the generic verb is the only honest wording there.
  if (!step || step.title) return t('step_skip');
  switch (step.kind) {
    case 'sauces':
      return t('step_skip_sauces');
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
