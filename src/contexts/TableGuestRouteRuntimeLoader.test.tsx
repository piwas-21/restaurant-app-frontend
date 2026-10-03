import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import { TableGuestFeatureProvider } from '@/contexts/TableGuestFeatureContext';
import { useTableGuestVisit } from '@/contexts/TableGuestVisitContext';
import TableGuestVisitBoundary from '@/contexts/TableGuestVisitBoundary';
import { getPublicTableGuestFeature } from '@/services/publicTableGuestFeatureService';
import { loadTableGuestLocale } from '@/services/tableGuestLocaleService';
import TableGuestRouteRuntimeLoader from './TableGuestRouteRuntimeLoader';

jest.mock('@/services/publicTableGuestFeatureService', () => ({ getPublicTableGuestFeature: jest.fn() }));
jest.mock('@/services/tableGuestLocaleService', () => ({ loadTableGuestLocale: jest.fn() }));

jest.mock('./TableGuestRouteRuntime', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    default: ({ children }: { readonly children: import('react').ReactNode }) =>
      React.createElement('div', { 'data-testid': 'guest-runtime' }, children),
  };
});

function StoredVisitProbe() {
  const { phase, pendingRound } = useTableGuestVisit();
  return <output>{`${phase}:${pendingRound?.operationId ?? 'none'}`}</output>;
}

describe('TableGuestRouteRuntimeLoader', () => {
  it('leaves children visible immediately when no public guest context is requested', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <TableGuestRouteRuntimeLoader readPublicTableGuestFeature={false}>
          <p>Legacy route</p>
        </TableGuestRouteRuntimeLoader>
      </I18nextProvider>,
    );

    expect(screen.getByText('Legacy route')).toBeInTheDocument();
    expect(screen.queryByTestId('guest-runtime')).not.toBeInTheDocument();
  });

  it('holds route children behind the lazy runtime until its chunk loads', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <TableGuestRouteRuntimeLoader readPublicTableGuestFeature>
          <p>Guest route</p>
        </TableGuestRouteRuntimeLoader>
      </I18nextProvider>,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Guest route')).not.toBeInTheDocument();
    expect(await screen.findByTestId('guest-runtime')).toHaveTextContent('Guest route');
  });

  it('loads the real visit provider for a stored operation even when the feature is off', async () => {
    sessionStorage.clear();
    jest.mocked(getPublicTableGuestFeature).mockResolvedValue({ available: true, enabled: false });
    jest.mocked(loadTableGuestLocale).mockResolvedValue();
    const visit = JSON.stringify({
      serviceSessionId: 'visit-1',
      participantToken: 'x'.repeat(40),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const pendingRound = JSON.stringify({
      serviceSessionId: 'visit-1',
      operationId: 'lost-response-operation',
      expectedAccountRevision: 3,
      expectedBasketFingerprint: 'A'.repeat(64),
    });
    sessionStorage.setItem('rumi_table_guest_visit_v1', visit);
    sessionStorage.setItem('rumi_table_guest_round_attempt_v1', pendingRound);

    render(
      <I18nextProvider i18n={i18n}>
        <TableGuestFeatureProvider readPublicTableGuestFeature>
          <TableGuestVisitBoundary>
            <StoredVisitProbe />
          </TableGuestVisitBoundary>
        </TableGuestFeatureProvider>
      </I18nextProvider>,
    );

    expect(await screen.findByText('unavailable:lost-response-operation')).toBeInTheDocument();
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBe(visit);
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBe(pendingRound);
    expect(sessionStorage.getItem('rumi_table_guest_visit_blocked_v1')).toBeNull();
    expect(getPublicTableGuestFeature).toHaveBeenCalledTimes(1);
    expect(loadTableGuestLocale).toHaveBeenCalledTimes(1);
  });
});
