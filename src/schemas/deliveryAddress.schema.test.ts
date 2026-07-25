import { buildDeliveryAddressSchema, deliveryAddressSchema } from './deliveryAddress.schema';
import { DEFAULT_FORM_FIELD_RULES, FORM_KEYS, type FormFieldRules } from '@/types/formFieldConfig';

const DEFAULTS = DEFAULT_FORM_FIELD_RULES[FORM_KEYS.deliveryAddress];

const rulesWith = (overrides: FormFieldRules): FormFieldRules => ({ ...DEFAULTS, ...overrides });

const VALID_ADDRESS = {
  street: 'Rue du Rhône 1',
  city: 'Genève',
  postalCode: '1204',
  country: 'Switzerland',
  additionalInfo: '',
};

const firstIssue = (result: ReturnType<ReturnType<typeof buildDeliveryAddressSchema>['safeParse']>) =>
  result.success ? undefined : result.error.issues[0]?.message;

describe('deliveryAddressSchema (default rules — today’s behaviour)', () => {
  it('accepts a complete Swiss address', () => {
    expect(deliveryAddressSchema.safeParse(VALID_ADDRESS).success).toBe(true);
  });

  it('keeps the locked fields required (street/city/postalCode)', () => {
    expect(firstIssue(deliveryAddressSchema.safeParse({ ...VALID_ADDRESS, street: ' ' }))).toBe('street_required');
    expect(firstIssue(deliveryAddressSchema.safeParse({ ...VALID_ADDRESS, city: '' }))).toBe('city_required');
    expect(firstIssue(deliveryAddressSchema.safeParse({ ...VALID_ADDRESS, postalCode: '' }))).toBe(
      'postal_code_required',
    );
  });

  it('still rejects malformed postal codes', () => {
    expect(firstIssue(deliveryAddressSchema.safeParse({ ...VALID_ADDRESS, postalCode: '!!' }))).toBe(
      'postal_code_invalid',
    );
  });

  it('leaves country and additionalInfo optional (empty passes)', () => {
    expect(deliveryAddressSchema.safeParse({ ...VALID_ADDRESS, country: '', additionalInfo: '' }).success).toBe(true);
  });

  it('build without arguments ≡ the default export (safe fallback when the config fetch fails)', () => {
    const fallback = buildDeliveryAddressSchema();
    expect(fallback.safeParse({ ...VALID_ADDRESS, country: '' }).success).toBe(true);
    expect(firstIssue(fallback.safeParse({ ...VALID_ADDRESS, street: '' }))).toBe('street_required');
  });
});

describe('buildDeliveryAddressSchema — config-required fields', () => {
  it('enforces a config-required country (min 1, existing i18n key)', () => {
    const schema = buildDeliveryAddressSchema(rulesWith({ country: { isVisible: true, isRequired: true } }));
    expect(firstIssue(schema.safeParse({ ...VALID_ADDRESS, country: '  ' }))).toBe('validation_field_required');
    expect(schema.safeParse(VALID_ADDRESS).success).toBe(true);
  });

  it('enforces a config-required additionalInfo', () => {
    const schema = buildDeliveryAddressSchema(rulesWith({ additionalInfo: { isVisible: true, isRequired: true } }));
    expect(firstIssue(schema.safeParse(VALID_ADDRESS))).toBe('validation_field_required');
    expect(schema.safeParse({ ...VALID_ADDRESS, additionalInfo: 'Floor 2' }).success).toBe(true);
  });
});

describe('buildDeliveryAddressSchema — hidden fields', () => {
  it('a hidden country is not enforced; the hook-preserved Switzerland default stays valid', () => {
    const schema = buildDeliveryAddressSchema(rulesWith({ country: { isVisible: false, isRequired: false } }));
    // The form never renders the field — the state default ('Switzerland') is what gets parsed.
    expect(schema.safeParse(VALID_ADDRESS).success).toBe(true);
    // Even an empty value passes: hidden can never block the submit.
    expect(schema.safeParse({ ...VALID_ADDRESS, country: '' }).success).toBe(true);
  });

  it('never enforces a hidden-but-required field (defensive: a hidden field cannot be filled in)', () => {
    const schema = buildDeliveryAddressSchema(rulesWith({ additionalInfo: { isVisible: false, isRequired: true } }));
    expect(schema.safeParse({ ...VALID_ADDRESS, additionalInfo: '' }).success).toBe(true);
  });
});
