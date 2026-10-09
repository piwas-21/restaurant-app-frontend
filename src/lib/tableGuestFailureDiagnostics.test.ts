import { reportTableGuestFailure } from './tableGuestFailureDiagnostics';

describe('reportTableGuestFailure', () => {
  it('reports only an allowlisted error class and never the message', () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = new Error('participant-token-and-private-message');

    reportTableGuestFailure('read visit state', error);

    expect(warning).toHaveBeenCalledWith(
      'Table guest read visit state failed (Error); the safe recovery state is retained.',
    );
    expect(warning.mock.calls.flat().join(' ')).not.toContain('participant-token-and-private-message');
    warning.mockRestore();
  });

  it('does not trust a caller-controlled Error.name', () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = new Error('private text');
    error.name = 'participant-token';

    reportTableGuestFailure('join visit', error);

    expect(warning).toHaveBeenCalledWith(
      'Table guest join visit failed (OtherError); the safe recovery state is retained.',
    );
    warning.mockRestore();
  });
});
