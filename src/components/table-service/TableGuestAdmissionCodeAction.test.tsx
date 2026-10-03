import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import tableGuestEnglish from '@/locales/table-guest/en.json';
import { createTableGuestAdmissionCode } from '@/services/tableGuestAdmissionCodeService';
import TableGuestAdmissionCodeAction from './TableGuestAdmissionCodeAction';

jest.mock('@/services/tableGuestAdmissionCodeService', () => ({ createTableGuestAdmissionCode: jest.fn() }));

describe('TableGuestAdmissionCodeAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    i18n.addResourceBundle('en', 'translation', tableGuestEnglish, true, true);
  });

  it('requests and displays a short-lived code for the selected service session', async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    jest.mocked(createTableGuestAdmissionCode).mockResolvedValue({ admissionCode: 'CODE123456', expiresAt });

    render(
      <I18nextProvider i18n={i18n}>
        <TableGuestAdmissionCodeAction enabled serviceSessionId="session-7" />
      </I18nextProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Generate new visit code' }));

    expect(await screen.findByText('CODE123456')).toBeInTheDocument();
    expect(screen.getByText(/Valid until/)).toBeInTheDocument();
    expect(createTableGuestAdmissionCode).toHaveBeenCalledWith('session-7');
  });

  it('does not replay an uncertain issuance and requires a deliberate replacement click', async () => {
    let rejectRequest: ((reason?: unknown) => void) | undefined;
    jest.mocked(createTableGuestAdmissionCode).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectRequest = reject;
        }),
    );
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    jest.mocked(createTableGuestAdmissionCode).mockResolvedValueOnce({ admissionCode: 'REPL123456', expiresAt });

    render(
      <I18nextProvider i18n={i18n}>
        <TableGuestAdmissionCodeAction enabled serviceSessionId="session-8" />
      </I18nextProvider>,
    );

    const action = await screen.findByRole('button', { name: 'Generate new visit code' });
    fireEvent.click(action);
    fireEvent.click(action);
    expect(createTableGuestAdmissionCode).toHaveBeenCalledTimes(1);
    rejectRequest?.(new Error('response lost'));

    const replacement = await screen.findByRole('button', { name: 'Generate replacement code' });
    expect(screen.getByRole('alert')).toHaveTextContent('We could not confirm whether a code was created.');
    expect(createTableGuestAdmissionCode).toHaveBeenCalledTimes(1);
    fireEvent.click(replacement);

    expect(await screen.findByText('REPL123456')).toBeInTheDocument();
    await waitFor(() => expect(createTableGuestAdmissionCode).toHaveBeenCalledTimes(2));
  });

  it('does not render a feature-disabled guest tool', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <TableGuestAdmissionCodeAction enabled={false} serviceSessionId="session-9" />
      </I18nextProvider>,
    );

    expect(screen.queryByRole('button', { name: 'Generate new visit code' })).not.toBeInTheDocument();
  });
});
