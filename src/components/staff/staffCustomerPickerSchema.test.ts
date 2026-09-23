import { staffCustomerPickerSchema } from './staffCustomerPickerSchema';

describe('staffCustomerPickerSchema', () => {
  const schema = staffCustomerPickerSchema(120);

  it('accepts optional contact details and an in-range whole-point value', () => {
    expect(
      schema.safeParse({ customerName: '', customerEmail: '', customerPhone: '', pointsToRedeem: '120' }).success,
    ).toBe(true);
  });

  it.each([
    ['customerName', 'x'.repeat(101)],
    ['customerEmail', 'not-an-email'],
    ['customerPhone', '1'.repeat(21)],
    ['pointsToRedeem', '121'],
    ['pointsToRedeem', '1.5'],
  ])('rejects invalid %s input', (field, value) => {
    const candidate = { customerName: '', customerEmail: '', customerPhone: '', pointsToRedeem: '0', [field]: value };
    expect(schema.safeParse(candidate).success).toBe(false);
  });
});
