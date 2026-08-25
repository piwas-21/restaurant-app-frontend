import { parseProblemFieldErrors, problemFieldMessages, problemFieldName, PROBLEM_BODY_KEY } from './problemDetails';

/**
 * The parser for the SECOND failure shape (`backend/docs/api/mobile-client-contracts.md` §0.2).
 *
 * Every body below is quoted from that contract, not invented: the two that matter are a
 * DataAnnotation refusal keyed by C# property name, and a `[JsonRequired]` refusal keyed `"$"`.
 * The discriminator under test is `errors` being an OBJECT — the `ApiResponse` envelope has an
 * `errors` member too, and it is an ARRAY.
 */
describe('parseProblemFieldErrors', () => {
  it('reads a DataAnnotation refusal keyed by field name', () => {
    expect(
      parseProblemFieldErrors({
        type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1',
        title: 'One or more validation errors occurred.',
        status: 400,
        errors: { CustomerEmail: ['The CustomerEmail field is not a valid e-mail address.'] },
      }),
    ).toEqual({ CustomerEmail: ['The CustomerEmail field is not a valid e-mail address.'] });
  });

  it('reads a `[JsonRequired]` refusal keyed `"$"`', () => {
    const blob =
      "JSON deserialization for type 'UpdateMyReservationDto' was missing required properties including: 'endTime'.";

    expect(
      parseProblemFieldErrors({ title: 'One or more validation errors occurred.', errors: { $: [blob] } }),
    ).toEqual({ $: [blob] });
  });

  it('refuses the ApiResponse envelope, whose `errors` is an array', () => {
    expect(
      parseProblemFieldErrors({ success: false, message: 'Operation failed', errors: ['Table 5 is gone'] }),
    ).toBeNull();
  });

  it('returns null for a body with no errors member, and for a non-object', () => {
    expect(parseProblemFieldErrors({ message: 'Boom' })).toBeNull();
    expect(parseProblemFieldErrors(null)).toBeNull();
    expect(parseProblemFieldErrors('nope')).toBeNull();
    expect(parseProblemFieldErrors({ errors: null })).toBeNull();
  });

  it('accepts a scalar value as a one-message entry', () => {
    expect(parseProblemFieldErrors({ errors: { StartTime: 'must be earlier than endTime' } })).toEqual({
      StartTime: ['must be earlier than endTime'],
    });
  });

  it('drops blanks and non-strings rather than rendering `[object Object]` to a guest', () => {
    expect(parseProblemFieldErrors({ errors: { A: ['', '   '], B: [{ nested: true }], C: ['real reason'] } })).toEqual({
      C: ['real reason'],
    });
  });

  it('returns null — never `{}` — when nothing in the object is usable', () => {
    expect(parseProblemFieldErrors({ errors: { A: [''], B: [] } })).toBeNull();
  });
});

describe('problemFieldMessages', () => {
  it('flattens every field`s messages, in body order', () => {
    expect(problemFieldMessages({ Email: ['Already in use'], Password: ['Too short', 'No digit'] })).toEqual([
      'Already in use',
      'Too short',
      'No digit',
    ]);
  });
});

describe('problemFieldName', () => {
  it('lower-cases the C# property name', () => {
    expect(problemFieldName('NumberOfGuests')).toBe('numberofguests');
  });

  it('reduces a JSON path to its last segment', () => {
    // What a TYPE mismatch produces (`"$.numberOfGuests": ["The JSON value could not be converted…"]`).
    expect(problemFieldName('$.numberOfGuests')).toBe('numberofguests');
  });

  it('leaves the body key alone — it names no field', () => {
    expect(problemFieldName(PROBLEM_BODY_KEY)).toBe('$');
  });
});
