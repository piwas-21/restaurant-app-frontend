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

// Mirrors the real helper exactly, INCLUDING its null contract: it returns the server's own message
// or nothing at all. A double that still handed back 'An unexpected error occurred' would let every
// suite pass while the real thing had stopped producing it — which is what the agreement test below
// exists to catch, and did.
export function getErrorMessage(error: unknown): string | null {
  if (error instanceof ApiError) {
    const detail = error.errors?.filter((m) => m?.trim()).join(', ');
    return detail || error.message?.trim() || null;
  }

  return null;
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
