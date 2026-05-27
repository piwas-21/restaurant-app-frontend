import { isDuplicateEmailError, isDuplicateEmailResponse } from '../duplicateEmailDetection';

describe('isDuplicateEmailResponse', () => {
  it('returns false for null/undefined/empty', () => {
    expect(isDuplicateEmailResponse(null)).toBe(false);
    expect(isDuplicateEmailResponse(undefined)).toBe(false);
    expect(isDuplicateEmailResponse({})).toBe(false);
  });

  it('returns false on a success envelope', () => {
    expect(isDuplicateEmailResponse({ success: true, message: 'User already exists' })).toBe(false);
  });

  it('detects duplicate via errors[] (the current backend wire shape)', () => {
    expect(
      isDuplicateEmailResponse({
        success: false,
        message: 'Registration failed',
        errors: ['User with this email already exists'],
      }),
    ).toBe(true);
  });

  it('detects duplicate via message (forward-compat / legacy)', () => {
    expect(
      isDuplicateEmailResponse({
        success: false,
        message: 'Email already registered',
      }),
    ).toBe(true);
  });

  it('does not match generic failures', () => {
    expect(
      isDuplicateEmailResponse({
        success: false,
        message: 'Registration failed',
        errors: ['Password too weak'],
      }),
    ).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(
      isDuplicateEmailResponse({
        success: false,
        errors: ['USER WITH THIS EMAIL ALREADY EXISTS'],
      }),
    ).toBe(true);
  });

  it('detects duplicate inside an ASP.NET Core ModelState envelope (nested object)', () => {
    // {errors: {Email: [...]}} — what ASP.NET Core's automatic
    // ModelState 400 response actually emits. Previous walker missed
    // this because it only recursed into arrays/strings.
    expect(
      isDuplicateEmailResponse({
        success: false,
        errors: { Email: ['user with this email already exists'] } as unknown as unknown[],
      }),
    ).toBe(true);
  });

  it('detects duplicate in a doubly-nested envelope', () => {
    // {response: {data: {errors: {Email: [...]}}}} — depth 4, well
    // within the recursion cap.
    expect(
      isDuplicateEmailResponse({
        success: false,
        errors: {
          response: { data: { errors: { Email: ['User already registered'] } } },
        } as unknown as unknown[],
      }),
    ).toBe(true);
  });

  it('does not crash on a cyclic reference', () => {
    type Cyclic = { self?: Cyclic; errors?: unknown };
    const a: Cyclic = {};
    a.self = a;
    // Should return false (no duplicate string anywhere) without
    // exhausting the call stack.
    expect(() => isDuplicateEmailResponse({ success: false, errors: a as unknown as unknown[] })).not.toThrow();
    expect(isDuplicateEmailResponse({ success: false, errors: a as unknown as unknown[] })).toBe(false);
  });
});

describe('isDuplicateEmailError', () => {
  it('returns false for non-objects', () => {
    expect(isDuplicateEmailError(null)).toBe(false);
    expect(isDuplicateEmailError(undefined)).toBe(false);
    expect(isDuplicateEmailError('boom')).toBe(false);
    expect(isDuplicateEmailError(500)).toBe(false);
  });

  it('detects via {status: 409, body: <ApiResponse failure>}', () => {
    expect(
      isDuplicateEmailError({
        status: 409,
        body: { success: false, errors: ['User with this email already exists'] },
      }),
    ).toBe(true);
  });

  it('detects via {response: {status, data}} (axios-like)', () => {
    expect(
      isDuplicateEmailError({
        response: {
          status: 400,
          data: { success: false, errors: ['user already exists'] },
        },
      }),
    ).toBe(true);
  });

  it('detects via {statusCode, data}', () => {
    expect(
      isDuplicateEmailError({
        statusCode: 409,
        data: { success: false, message: 'Email already registered' },
      }),
    ).toBe(true);
  });

  it('falls back to body-only inspection when no status is present', () => {
    expect(
      isDuplicateEmailError({
        body: { success: false, errors: ['User with this email already exists'] },
      }),
    ).toBe(true);
  });

  it('returns false on 4xx with unrelated body (e.g. validation error)', () => {
    expect(
      isDuplicateEmailError({
        status: 400,
        body: { success: false, errors: ['Password too weak'] },
      }),
    ).toBe(false);
  });

  it('returns false on 500-class errors', () => {
    expect(isDuplicateEmailError({ status: 500, body: { message: 'boom' } })).toBe(false);
  });

  it('returns false on network errors with no body', () => {
    expect(isDuplicateEmailError(new TypeError('Failed to fetch'))).toBe(false);
  });

  it('falls back to Error.message when no status/body is attached', () => {
    // Future-proofs against a refactored apiClient that throws
    // `new Error("Email already registered")` directly.
    expect(isDuplicateEmailError(new Error('Email already registered'))).toBe(true);
  });

  it('Error.message fallback does not false-positive on unrelated messages', () => {
    expect(isDuplicateEmailError(new Error('Server error'))).toBe(false);
    // "already" without an "exist|registered|duplicate" companion must not match.
    expect(isDuplicateEmailError(new Error('Registration already attempted'))).toBe(false);
    expect(isDuplicateEmailError(new Error('Item exists in cart'))).toBe(false);
  });
});
