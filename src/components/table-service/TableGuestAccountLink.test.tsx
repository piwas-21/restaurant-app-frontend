import { render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import { TableGuestFeatureProvider } from '@/contexts/TableGuestFeatureContext';
import { TableGuestVisitProvider } from '@/contexts/TableGuestVisitProvider';
import TableGuestAccountLink from './TableGuestAccountLink';

jest.mock('next/navigation', () => ({ usePathname: () => '/ar/menu' }));

describe('TableGuestAccountLink', () => {
  beforeEach(() => sessionStorage.clear());

  it('offers the account entry on enabled guest routes with a localized destination', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <TableGuestFeatureProvider features={{ tableGuestVisitsV1: true }}>
          <TableGuestVisitProvider>
            <TableGuestAccountLink />
          </TableGuestVisitProvider>
        </TableGuestFeatureProvider>
      </I18nextProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Table account' })).toHaveAttribute('href', '/ar/table-account'),
    );
  });

  it('does not add account navigation when the feature is disabled and no visit exists', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <TableGuestFeatureProvider features={{ tableGuestVisitsV1: false }}>
          <TableGuestVisitProvider>
            <TableGuestAccountLink />
          </TableGuestVisitProvider>
        </TableGuestFeatureProvider>
      </I18nextProvider>,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
