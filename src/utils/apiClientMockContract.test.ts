/**
 * `__mocks__/@/utils/apiClient.ts` SHADOWS the real module for every `@/utils/apiClient` import in
 * the tree, and it re-declares `ApiError` and the predicates by hand (it cannot `requireActual`
 * itself without re-entering its own import graph). That hand copy can drift: the real module
 * could gain a field or change `getErrorMessage`'s precedence and every test would keep passing
 * against a stale contract while production diverged.
 *
 * This is the guard. It compares the mock against the real module, which it reaches by relative
 * path — the alias is what the mock intercepts.
 */

import * as mock from '@/utils/apiClient';
import * as real from './apiClient';

describe('apiClient test double', () => {
  it('exports exactly what the real module does', () => {
    expect(Object.keys(mock).sort()).toEqual(Object.keys(real).sort());
  });

  it('stubs the HTTP surface with the same method set', () => {
    expect(Object.keys(mock.apiClient).every((method) => method in real.apiClient)).toBe(true);
    Object.values(mock.apiClient).forEach((method) => expect(jest.isMockFunction(method)).toBe(true));
  });

  it('constructs an ApiError with the same fields', () => {
    const args: [number, string, string[], string] = [400, 'Blocked', ['detail'], 'OrderTypeNotAvailable'];
    const fromMock = new mock.ApiError(...args);
    const fromReal = new real.ApiError(...args);

    expect({ ...fromMock, name: fromMock.name, message: fromMock.message }).toEqual({
      ...fromReal,
      name: fromReal.name,
      message: fromReal.message,
    });
    expect(fromMock).toBeInstanceOf(Error);
  });

  it('agrees with the real getErrorMessage, including its errors-before-message precedence', () => {
    const cases: unknown[][] = [
      [new mock.ApiError(400, 'Message', ['First', 'Second']), new real.ApiError(400, 'Message', ['First', 'Second'])],
      [new mock.ApiError(400, 'Message'), new real.ApiError(400, 'Message')],
      [new Error('plain'), new Error('plain')],
      ['not an error', 'not an error'],
    ];

    cases.forEach(([mockError, realError]) => {
      expect(mock.getErrorMessage(mockError)).toBe(real.getErrorMessage(realError));
    });
  });

  it('agrees with the real status predicates', () => {
    [400, 401, 404, 500].forEach((status) => {
      const mockError = new mock.ApiError(status, 'x');
      const realError = new real.ApiError(status, 'x');

      expect(mock.isAuthError(mockError)).toBe(real.isAuthError(realError));
      expect(mock.isValidationError(mockError)).toBe(real.isValidationError(realError));
      expect(mock.isNotFoundError(mockError)).toBe(real.isNotFoundError(realError));
      expect(mock.isErrorStatus(mockError, status)).toBe(real.isErrorStatus(realError, status));
    });
  });
});

/**
 * `getErrorMessage` returns the SERVER's account of a failure, or nothing.
 *
 * It used to end `return 'An unexpected error occurred';` — a hardcoded English literal, and
 * verbatim the string BUGS-IMPROVEMENTS-PLAN E9 was reported for. Every caller got a generic for
 * free, in English, without ever deciding to use one. These cases pin the absence, because that is
 * the whole change: a caller must now supply its own translated sentence.
 */
describe('getErrorMessage — the null contract', () => {
  it("returns the server's per-rule messages, joined, ahead of the summary", () => {
    expect(real.getErrorMessage(new real.ApiError(400, 'Validation failed', ['Too short', 'No digit']))).toBe(
      'Too short, No digit',
    );
  });

  it("falls back to the server's summary when there are no per-rule messages", () => {
    expect(real.getErrorMessage(new real.ApiError(409, 'That slug is taken'))).toBe('That slug is taken');
  });

  it('returns null for a CLIENT-authored throw, rather than showing it to a user', () => {
    // `TypeError` from a dead network and `SyntaxError` from `response.json()` on an HTML 502
    // mid-deploy are the two that actually reach these catches. Passing them through put
    // "Failed to fetch" and `Unexpected token '<'` in front of users.
    expect(real.getErrorMessage(new TypeError('Failed to fetch'))).toBeNull();
    expect(real.getErrorMessage(new SyntaxError(`Unexpected token '<'`))).toBeNull();
  });

  it('returns null for a non-Error throw', () => {
    expect(real.getErrorMessage('a string')).toBeNull();
    expect(real.getErrorMessage(undefined)).toBeNull();
  });

  it('treats blank server text as absence, not as a message', () => {
    // An error line with nothing in it says the operation failed for no reason — worse than the
    // generic, because it looks like the app is broken rather than the request.
    expect(real.getErrorMessage(new real.ApiError(400, '   '))).toBeNull();
    expect(real.getErrorMessage(new real.ApiError(400, 'Summary', ['', '  ']))).toBe('Summary');
  });

  it('no longer produces the English literal it was reported for, for ANY input', () => {
    const inputs: unknown[] = [
      new real.ApiError(500, ''),
      new TypeError('boom'),
      null,
      42,
      {},
      new real.ApiError(400, 'Real message'),
    ];
    for (const input of inputs) {
      expect(real.getErrorMessage(input)).not.toBe('An unexpected error occurred');
    }
  });
});
