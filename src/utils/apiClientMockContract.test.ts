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
