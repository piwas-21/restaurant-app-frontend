import { mergeContactFieldRules } from './contactFieldRules';
import { DEFAULT_FORM_FIELD_RULES, FORM_KEYS, type FieldRule, type FormFieldRules } from '@/types/formFieldConfig';
import type { CustomerInfoField } from '@/components/order/GuestCustomerInfoFields';

// Per-order-type floors (mirroring the modal constants).
const DINEIN: ReadonlyArray<CustomerInfoField> = ['name', 'email'];
const TAKEAWAY: ReadonlyArray<CustomerInfoField> = ['name', 'email', 'phone'];
const DELIVERY: ReadonlyArray<CustomerInfoField> = ['name', 'email', 'phone'];

const DEFAULTS = DEFAULT_FORM_FIELD_RULES[FORM_KEYS.checkoutContact];

const withPhone = (phone: FieldRule): FormFieldRules => ({ ...DEFAULTS, phone });

const HIDDEN: FieldRule = { isVisible: false, isRequired: false };
const OPTIONAL: FieldRule = { isVisible: true, isRequired: false };
const REQUIRED: FieldRule = { isVisible: true, isRequired: true };

describe('mergeContactFieldRules — phone matrix (config × order-type floor)', () => {
  // effective-required = config-required OR order-type-required
  // shown              = config-visible  OR effective-required
  const matrix: Array<{
    label: string;
    phone: FieldRule;
    floor: ReadonlyArray<CustomerInfoField>;
    expectShown: boolean;
    expectRequired: boolean;
  }> = [
    {
      label: 'hidden × DineIn → not shown, not required',
      phone: HIDDEN,
      floor: DINEIN,
      expectShown: false,
      expectRequired: false,
    },
    {
      label: 'hidden × Takeaway → floor wins: shown + required',
      phone: HIDDEN,
      floor: TAKEAWAY,
      expectShown: true,
      expectRequired: true,
    },
    {
      label: 'hidden × Delivery → floor wins: shown + required',
      phone: HIDDEN,
      floor: DELIVERY,
      expectShown: true,
      expectRequired: true,
    },
    {
      label: 'optional × DineIn → shown, optional',
      phone: OPTIONAL,
      floor: DINEIN,
      expectShown: true,
      expectRequired: false,
    },
    {
      label: 'optional × Takeaway → shown + required (floor)',
      phone: OPTIONAL,
      floor: TAKEAWAY,
      expectShown: true,
      expectRequired: true,
    },
    {
      label: 'optional × Delivery → shown + required (floor)',
      phone: OPTIONAL,
      floor: DELIVERY,
      expectShown: true,
      expectRequired: true,
    },
    {
      label: 'required × DineIn → config adds requiredness',
      phone: REQUIRED,
      floor: DINEIN,
      expectShown: true,
      expectRequired: true,
    },
    {
      label: 'required × Takeaway → shown + required',
      phone: REQUIRED,
      floor: TAKEAWAY,
      expectShown: true,
      expectRequired: true,
    },
    {
      label: 'required × Delivery → shown + required',
      phone: REQUIRED,
      floor: DELIVERY,
      expectShown: true,
      expectRequired: true,
    },
  ];

  it.each(matrix)('$label', ({ phone, floor, expectShown, expectRequired }) => {
    const merged = mergeContactFieldRules(floor, withPhone(phone));
    expect(merged.fields.includes('phone')).toBe(expectShown);
    expect(merged.requiredFields.includes('phone')).toBe(expectRequired);
  });

  it('a config-required phone can never end up hidden (defensive isVisible:false + isRequired:true)', () => {
    const merged = mergeContactFieldRules(DINEIN, withPhone({ isVisible: false, isRequired: true }));
    expect(merged.fields).toContain('phone');
    expect(merged.requiredFields).toContain('phone');
  });
});

describe('mergeContactFieldRules — locked fields + floor precedence', () => {
  it('name/email stay shown + required even if a rogue config hides them (floor is the safety net)', () => {
    const rogue: FormFieldRules = {
      name: { isVisible: false, isRequired: false },
      email: { isVisible: false, isRequired: false },
      phone: OPTIONAL,
    };
    const merged = mergeContactFieldRules(DINEIN, rogue);
    expect(merged.fields).toEqual(['name', 'email', 'phone']);
    expect(merged.requiredFields).toEqual(['name', 'email']);
  });

  it('preserves the canonical field order regardless of floor order', () => {
    const merged = mergeContactFieldRules(['phone', 'email', 'name'], DEFAULTS);
    expect(merged.fields).toEqual(['name', 'email', 'phone']);
    expect(merged.requiredFields).toEqual(['name', 'email', 'phone']);
  });
});

describe('mergeContactFieldRules — fallback (config fetch fails → DEFAULT rules)', () => {
  // The checkout_contact phone default is HIDDEN (backend seed #208) — DineIn
  // must show only name+email, exactly today's behaviour. Takeaway/Delivery
  // still get a required phone because the order-type floor forces it.
  it("Takeaway/Delivery keep exactly today's behaviour: all three fields shown + required", () => {
    const merged = mergeContactFieldRules(TAKEAWAY, DEFAULTS);
    expect(merged.fields).toEqual(['name', 'email', 'phone']);
    expect(merged.requiredFields).toEqual(['name', 'email', 'phone']);
  });

  it('DineIn shows only name+email (the hidden phone default is never surfaced)', () => {
    const merged = mergeContactFieldRules(DINEIN, DEFAULTS);
    expect(merged.fields).toEqual(['name', 'email']);
    expect(merged.requiredFields).toEqual(['name', 'email']);
  });

  it('config-fetch failure: DineIn → no phone, Takeaway & Delivery → required phone', () => {
    // Both order types resolve against the same DEFAULT (hidden phone).
    expect(mergeContactFieldRules(DINEIN, DEFAULTS).fields).not.toContain('phone');
    for (const floor of [TAKEAWAY, DELIVERY]) {
      const merged = mergeContactFieldRules(floor, DEFAULTS);
      expect(merged.fields).toContain('phone');
      expect(merged.requiredFields).toContain('phone');
    }
  });
});
