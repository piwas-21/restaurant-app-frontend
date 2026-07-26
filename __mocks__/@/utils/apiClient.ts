// Mock apiClient for tests.
//
// This file SHADOWS the real module for every `@/utils/apiClient` import in the tree, so an export
// omitted here reads as `undefined` in code under test — an `error instanceof ApiError` then throws
// "Right-hand side of 'instanceof' is not an object" instead of running. Only the HTTP surface is a
// stub; the error type and its predicates are re-declared to match `src/utils/apiClient.ts`.
//
// Deliberately NOT `jest.requireActual`: pulling the real module in from here re-enters this mock
// through its own import graph and leaves the re-exports unassigned.
export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public errors?: string[],
    public errorCode?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.errors && error.errors.length > 0) {
      return error.errors.join(', ');
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

export function isErrorStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status;
}

export function isAuthError(error: unknown): boolean {
  return isErrorStatus(error, 401);
}

export function isValidationError(error: unknown): boolean {
  return isErrorStatus(error, 400);
}

export function isNotFoundError(error: unknown): boolean {
  return isErrorStatus(error, 404);
}

export const apiClient = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
};
