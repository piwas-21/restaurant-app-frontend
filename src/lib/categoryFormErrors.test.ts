import { applyCategoryFailure, reasonOr, type CategoryFormField } from './categoryFormErrors';
import { ApiError } from '@/utils/apiClient';

// `routeApiError` logs every failure as the only operator signal there is; keep the run quiet.
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

/**
 * The exact envelope the Categories feature emits.
 *
 * Built from `ApiResponse.cs:55-63` rather than from what the frontend expected: every handler
 * under `Features/Categories/Commands/` uses the ONE-argument `Failure(reason)`, which fills
 * `Errors[0]` and leaves `Message` at the default literal. Constructing it by hand with the reason
 * in `message` — the shape the old code read — is what let a wrong contract survive five slices in
 * `getErrorMessage` (#408). These tests fail if anything starts preferring `message`.
 */
const wrapped = (reason: string) => ({
  success: false,
  message: 'Operation failed',
  errors: [reason],
});

const collect = () => {
  const written: Array<[CategoryFormField | 'root', string]> = [];
  const setError = (field: CategoryFormField | 'root', message: string) => written.push([field, message]);
  return { written, setError };
};

const FALLBACK = 'Failed to create the category';

describe('applyCategoryFailure — the 200-wrapped refusal', () => {
  it('routes the reason from errors[0], never the "Operation failed" wrapper', () => {
    const { written, setError } = collect();

    applyCategoryFailure(wrapped('Category with this name already exists'), FALLBACK, setError);

    expect(written).toEqual([['name', 'Category with this name already exists']]);
    expect(written.map(([, message]) => message).join()).not.toContain('Operation failed');
  });

  it('sends a reason that names no field to the form, not to `name`', () => {
    const { written, setError } = collect();

    applyCategoryFailure(wrapped('Duplicate display orders found: 3'), FALLBACK, setError);

    expect(written).toEqual([['root', 'Duplicate display orders found: 3']]);
  });

  it.each([
    'Category not found',
    'One or more categories not found',
    // The limit is interpolated from `FileStorageSettings.MaxFileSizeBytes`, which
    // `appsettings.json` binds to 10485760 — the 5MB in the C# field initialiser is a default the
    // deployment overrides, and a fixture asserting 5MB would be asserting a string no server sends.
    'File size exceeds maximum allowed size of 10MB',
    'File type not allowed. Allowed types: .jpg, .jpeg, .png, .webp',
  ])('does not mis-route %s onto the name field', (reason) => {
    const { written, setError } = collect();

    applyCategoryFailure(wrapped(reason), FALLBACK, setError);

    expect(written).toEqual([['root', reason]]);
  });

  it('does not also print the fallback when the message reached a field', () => {
    const { written, setError } = collect();

    applyCategoryFailure(wrapped('Another category with this name already exists'), FALLBACK, setError);

    expect(written).toHaveLength(1);
    expect(written[0][0]).toBe('name');
  });
});

describe('applyCategoryFailure — the transport arm', () => {
  it('uses the translated fallback when the server authored nothing', () => {
    const { written, setError } = collect();

    // What `apiClient.request` emits since #408 for a network failure: an ApiError with an EMPTY
    // message. Constructing one with prose here would make the fallback untestable.
    applyCategoryFailure(new ApiError(0, ''), FALLBACK, setError);

    expect(written).toEqual([['root', FALLBACK]]);
  });

  it('prefers a thrown ApiError’s own errors[] over its message', () => {
    const { written, setError } = collect();

    applyCategoryFailure(new ApiError(400, 'Operation failed', ['Category not found']), FALLBACK, setError);

    expect(written).toEqual([['root', 'Category not found']]);
  });

  it('treats a blank server message as absence rather than rendering an empty error line', () => {
    const { written, setError } = collect();

    applyCategoryFailure({ success: false, message: '   ', errors: [] }, FALLBACK, setError);

    expect(written).toEqual([['root', FALLBACK]]);
  });
});

describe('reasonOr', () => {
  it('returns errors[0] for a partial-success step, not "Operation failed"', () => {
    expect(reasonOr(wrapped('File size exceeds maximum allowed size of 10MB'), 'the image was rejected')).toBe(
      'File size exceeds maximum allowed size of 10MB',
    );
  });

  it('falls back when the response carries no reason at all', () => {
    expect(reasonOr({ success: false }, 'the image was rejected')).toBe('the image was rejected');
  });

  it('falls back for the id-missing sentinel the create modal builds', () => {
    // `CreateCategoryModal` synthesises `{ success: false }` when a create reports success without
    // a `data.id`, so that a missing id reports as a failed upload instead of silently skipping it.
    expect(reasonOr({ success: false }, 'the image was rejected')).toBe('the image was rejected');
  });
});
