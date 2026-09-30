import { reportBrowserStorageFailure } from './browserStorageDiagnostics';

describe('reportBrowserStorageFailure', () => {
  it('reports the operation and error type without exposing exception details', () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    reportBrowserStorageFailure('read locale preference', new Error('private token value'));

    expect(warning).toHaveBeenCalledWith(
      'Browser storage could not read locale preference (Error); continuing without persistence.',
    );
    expect(warning.mock.calls.flat().join(' ')).not.toContain('private token value');
    warning.mockRestore();
  });
});
