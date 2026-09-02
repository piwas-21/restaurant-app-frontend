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
