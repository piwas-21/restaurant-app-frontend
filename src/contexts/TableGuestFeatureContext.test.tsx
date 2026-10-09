import { StrictMode, type ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import { getPublicTableGuestFeature } from '@/services/publicTableGuestFeatureService';
import { loadTableGuestLocale } from '@/services/tableGuestLocaleService';
import { TableGuestFeatureProvider, useTableGuestFeature } from './TableGuestFeatureContext';

jest.mock('@/services/publicTableGuestFeatureService', () => ({ getPublicTableGuestFeature: jest.fn() }));
jest.mock('@/services/tableGuestLocaleService', () => ({ loadTableGuestLocale: jest.fn() }));

function Probe() {
  const { tableGuestVisitsV1, tableGuestFeatureStatus } = useTableGuestFeature();
  return (
    <output role="status" data-feature-status={tableGuestFeatureStatus}>
      {`${String(tableGuestVisitsV1)}:${tableGuestFeatureStatus}`}
    </output>
  );
}

function renderFeature(children: ReactNode) {
  return render(<I18nextProvider i18n={i18n}>{children}</I18nextProvider>);
}

describe('TableGuestFeatureContext', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(loadTableGuestLocale).mockResolvedValue();
    sessionStorage.clear();
  });

  it('provides a server-injected enabled feature after its locale is ready', async () => {
    renderFeature(
      <TableGuestFeatureProvider features={{ tableGuestVisitsV1: true }}>
        <Probe />
      </TableGuestFeatureProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('true:loading');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('true:ready'));
    expect(loadTableGuestLocale).toHaveBeenCalledTimes(1);
  });

  it('keeps a disabled public rollout dormant when no visit is stored', async () => {
    jest.mocked(getPublicTableGuestFeature).mockResolvedValue({ available: true, enabled: false });
    renderFeature(
      <TableGuestFeatureProvider readPublicTableGuestFeature>
        <Probe />
      </TableGuestFeatureProvider>,
    );

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('false:ready'));
    expect(loadTableGuestLocale).not.toHaveBeenCalled();
  });

  it('loads safe-departure translations for a stored visit when the feature is off', async () => {
    sessionStorage.setItem('rumi_table_guest_visit_blocked_v1', 'ended');
    jest.mocked(getPublicTableGuestFeature).mockResolvedValue({ available: true, enabled: false });
    renderFeature(
      <TableGuestFeatureProvider readPublicTableGuestFeature>
        <Probe />
      </TableGuestFeatureProvider>,
    );

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('false:ready'));
    expect(loadTableGuestLocale).toHaveBeenCalledTimes(1);
  });

  it('loads localized disabled-state copy on the explicit account route', async () => {
    jest.mocked(getPublicTableGuestFeature).mockResolvedValue({ available: true, enabled: false });
    renderFeature(
      <TableGuestFeatureProvider readPublicTableGuestFeature loadTableGuestLocaleForRoute>
        <Probe />
      </TableGuestFeatureProvider>,
    );

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('false:ready'));
    expect(loadTableGuestLocale).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the feature endpoint is unavailable', async () => {
    jest.mocked(getPublicTableGuestFeature).mockResolvedValue({ available: false, enabled: false });
    renderFeature(
      <TableGuestFeatureProvider readPublicTableGuestFeature>
        <Probe />
      </TableGuestFeatureProvider>,
    );

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('false:unavailable'));
    expect(loadTableGuestLocale).not.toHaveBeenCalled();
  });

  it('fails closed when localized strings fail to load', async () => {
    jest.mocked(getPublicTableGuestFeature).mockResolvedValue({ available: true, enabled: true });
    jest.mocked(loadTableGuestLocale).mockRejectedValue(new Error('locale unavailable'));
    renderFeature(
      <TableGuestFeatureProvider readPublicTableGuestFeature>
        <Probe />
      </TableGuestFeatureProvider>,
    );

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('true:unavailable'));
  });

  it('deduplicates the anonymous rollout read under Strict Mode', async () => {
    jest.mocked(getPublicTableGuestFeature).mockResolvedValue({ available: true, enabled: true });
    renderFeature(
      <StrictMode>
        <TableGuestFeatureProvider readPublicTableGuestFeature>
          <Probe />
        </TableGuestFeatureProvider>
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('true:ready'));
    expect(getPublicTableGuestFeature).toHaveBeenCalledTimes(1);
  });
});
