import { enqueueSnackbar } from 'notistack';
import type { TFunction } from 'i18next';
import { reportProductImageUploadFailure } from './productImageFailure';

jest.mock('notistack', () => ({ enqueueSnackbar: jest.fn() }));

const mockEnqueue = enqueueSnackbar as jest.Mock;

// The real `t` interpolates; this one renders `key(options)` so the assertions can read BOTH the
// key that was chosen and the reason that was put in it — a component test's `(key) => key` stub
// would hide the second half, which is the whole point of the sentence.
const t = ((key: string, _default?: unknown, options?: Record<string, unknown>) =>
  options ? `${key}|${JSON.stringify(options)}` : key) as unknown as TFunction;

describe('reportProductImageUploadFailure', () => {
  beforeEach(() => mockEnqueue.mockReset());

  it('names the create case and carries the server reason', () => {
    reportProductImageUploadFailure(t, 'create', "'blob' — File type not allowed");

    expect(mockEnqueue).toHaveBeenCalledWith(
      'product_created_image_failed|{"reason":"\'blob\' — File type not allowed"}',
      expect.objectContaining({ variant: 'error' }),
    );
  });

  it('names the edit case', () => {
    reportProductImageUploadFailure(t, 'edit', 'File too large');

    expect(mockEnqueue.mock.calls[0][0]).toContain('product_updated_image_failed');
  });

  // The reason the reporter takes `string | null` rather than a pre-written sentence: only here,
  // where `t` is in scope, can "the server said nothing" become translated prose.
  it('substitutes the translated generic when the server described nothing', () => {
    reportProductImageUploadFailure(t, 'create', null);

    expect(mockEnqueue.mock.calls[0][0]).toContain('product_image_failed_generic');
  });

  // It outlives the redirect to the list (create) and must survive being read: the editor's own
  // error slot cannot do the first, and the provider's 4 s default is not enough for the second.
  it('persists until dismissed', () => {
    reportProductImageUploadFailure(t, 'create', 'nope');

    expect(mockEnqueue.mock.calls[0][1]).toEqual({ variant: 'error', persist: true });
  });
});
