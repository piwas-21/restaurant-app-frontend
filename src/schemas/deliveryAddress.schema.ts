import { z } from 'zod';

// Allow various postal code formats: 4 digits (CH), alphanumeric (NL, DE, etc.)
const POSTAL_CODE_PATTERN = /^[A-Z0-9\s\-]{2,10}$/i;

/**
 * Schema for the checkout delivery-address form. Error keys match the
 * i18n strings the page used pre-extraction so translations don't need
 * to change. The hook calls `safeParse` and surfaces the first issue.
 */
export const deliveryAddressSchema = z.object({
  street: z.string().trim().min(1, 'street_required'),
  city: z.string().trim().min(1, 'city_required'),
  postalCode: z.string().trim().min(1, 'postal_code_required').regex(POSTAL_CODE_PATTERN, 'postal_code_invalid'),
  country: z.string().trim().min(1, 'street_required').optional().or(z.string()),
  additionalInfo: z.string().optional(),
});

export type DeliveryAddressInput = z.infer<typeof deliveryAddressSchema>;
