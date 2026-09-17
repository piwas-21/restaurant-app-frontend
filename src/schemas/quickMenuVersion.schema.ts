import { z } from 'zod';
import { MENU_VERSION_NAME_MAX_LENGTH } from '@/utils/quickMenuVersionPayload';

export const QUICK_MENU_VERSION_CONFIRMATION_FIELDS = [
  'sectionsConfirmed',
  'priceConfirmed',
  'categoriesConfirmed',
  'scheduleConfirmed',
  'channelsConfirmed',
] as const;

export type QuickMenuVersionConfirmationField = (typeof QUICK_MENU_VERSION_CONFIRMATION_FIELDS)[number];

export interface QuickMenuVersionValidationMessages {
  readonly nameRequired: string;
  readonly nameTooLong: string;
  readonly priceRequired: string;
  readonly priceInvalid: string;
  readonly priceMustBePositive: string;
  readonly variationRequired: string;
  readonly confirmationRequired: Readonly<Record<QuickMenuVersionConfirmationField, string>>;
}

type QuickMenuVersionTranslator = (key: string, options?: { readonly fieldName?: string }) => string;

export function buildQuickMenuVersionValidationMessages(
  t: QuickMenuVersionTranslator,
  activeVariationCount: number,
): QuickMenuVersionValidationMessages {
  const required = (key: string) => t('field_required_error', { fieldName: t(key) });
  return {
    nameRequired: t('menu_bundle_name_required'),
    nameTooLong: t('menu_bundle_name_too_long'),
    priceRequired: required('base_price'),
    priceInvalid: t('admin_edit_price_invalid'),
    priceMustBePositive: t('admin_edit_price_invalid'),
    variationRequired: activeVariationCount === 0 ? t('no_active_variations') : required('product_variations'),
    confirmationRequired: {
      sectionsConfirmed: required('menu_sections'),
      priceConfirmed: required('base_price'),
      categoriesConfirmed: required('category'),
      scheduleConfirmed: required('menu_availability_schedule'),
      channelsConfirmed: required('product_order_types'),
    },
  };
}

interface QuickMenuVersionSchemaOptions {
  readonly activeVariationIds: readonly string[];
  readonly requiresVariation: boolean;
  readonly messages: QuickMenuVersionValidationMessages;
}

/**
 * Validation for the handoff form, kept separate from the full bundle schema because this form
 * does not write anything. The parsed output is the only input to the prefill builder, so a
 * disabled button cannot be the form's validation boundary by itself.
 */
export const quickMenuVersionSchema = ({
  activeVariationIds,
  requiresVariation,
  messages,
}: QuickMenuVersionSchemaOptions) =>
  z.object({
    name: z.string().trim().min(1, messages.nameRequired).max(MENU_VERSION_NAME_MAX_LENGTH, messages.nameTooLong),
    price: z
      .string()
      .trim()
      .min(1, messages.priceRequired)
      .refine((value) => Number.isFinite(Number(value)), messages.priceInvalid)
      .refine((value) => Number(value) > 0, messages.priceMustBePositive)
      .transform(Number),
    variationId: z
      .string()
      .refine((value) => !requiresVariation || activeVariationIds.includes(value), messages.variationRequired),
    sectionsConfirmed: z.boolean().refine(Boolean, messages.confirmationRequired.sectionsConfirmed),
    priceConfirmed: z.boolean().refine(Boolean, messages.confirmationRequired.priceConfirmed),
    categoriesConfirmed: z.boolean().refine(Boolean, messages.confirmationRequired.categoriesConfirmed),
    scheduleConfirmed: z.boolean().refine(Boolean, messages.confirmationRequired.scheduleConfirmed),
    channelsConfirmed: z.boolean().refine(Boolean, messages.confirmationRequired.channelsConfirmed),
  });

export type QuickMenuVersionFormSchema = ReturnType<typeof quickMenuVersionSchema>;
export type QuickMenuVersionFormInput = z.input<QuickMenuVersionFormSchema>;
export type QuickMenuVersionFormValues = z.output<QuickMenuVersionFormSchema>;
