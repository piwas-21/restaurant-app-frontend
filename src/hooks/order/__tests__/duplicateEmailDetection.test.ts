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
});
