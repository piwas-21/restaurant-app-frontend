import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import PartnerCredit from './PartnerCredit';
import { getTenantPartner } from '@/services/tenantPartnerService';
import { invalidateTenantPartnerCache } from '@/hooks/useTenantPartner';

jest.mock('@/services/tenantPartnerService', () => ({ getTenantPartner: jest.fn() }));

// Interpolate against the REAL en.json value, as TableBanner.test.tsx does: echoing the key
// back would leave nothing to interpolate, and every assertion below would pass whether or not
// the partner's name ever reached the string a diner reads.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, arg?: Record<string, unknown>) => {
      // Required lazily: a jest.mock factory may not close over an out-of-scope import.
      const bundle = jest.requireActual<Record<string, string>>('@/locales/en.json');
      const source = bundle[key] ?? key;
      if (!arg) return source;
      return Object.entries(arg).reduce<string>(
        (acc, [name, value]) => acc.replaceAll(`{{${name}}}`, String(value)),
        source,
      );
    },
  }),
}));

const mockGet = getTenantPartner as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  invalidateTenantPartnerCache();
});

describe('PartnerCredit', () => {
  it('links the credit to the partner site when both name and url are served', async () => {
    // The backend normalises through Uri.AbsoluteUri, so the served url carries a trailing
    // slash that the partner never typed. It is an href and nothing else — never compared.
    mockGet.mockResolvedValue({ success: true, data: { name: 'Solution Eva', url: 'https://solutioneva.com/' } });

    render(<PartnerCredit />);

    const link = await screen.findByRole('link', { name: 'Site by Solution Eva' });
    expect(link).toHaveAttribute('href', 'https://solutioneva.com/');
    // A partner-supplied URL on a public page.
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders the name as plain text — with NO anchor — when the url is withheld', async () => {
    // A real state, not an edge case: the backend serves the name and withholds a non-https url.
    mockGet.mockResolvedValue({ success: true, data: { name: 'Solution Eva', url: null } });

    const { container } = render(<PartnerCredit />);

    expect(await screen.findByText('Site by Solution Eva')).toBeInTheDocument();
    // Assert on the ELEMENT, not only on the role. An <a> with no href has role `generic`, not
    // `link`, so `queryByRole('link')` stays null for exactly the output this test forbids — an
    // anchor that looks like a link and goes nowhere. Measured: a mutant that always renders the
    // anchor survived a role-only assertion.
    expect(container.querySelector('a')).toBeNull();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders NOTHING when the tenant has no attribution (200 with null name, not a 404)', async () => {
    mockGet.mockResolvedValue({ success: true, data: { name: null, url: null } });

    const { container } = render(<PartnerCredit />);

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    // The negative control: assert the element is ABSENT, not that it is empty. Every tenant
    // provisioned before the registry keys existed is in this branch, so a stray wrapper or a
    // dangling "Site by" would ship to all of them.
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/Site by/)).not.toBeInTheDocument();
  });

  it('renders nothing rather than throwing when the API is unreachable', async () => {
    // The hook leaves a console trace for whoever provisions the tenant — there is no message to
    // put in front of a diner about a footer line they were never told to expect. Spied here so
    // the deliberate ignore is asserted rather than merely muted.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGet.mockRejectedValue(new Error('network down'));

    const { container } = render(<PartnerCredit />);

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('ignores a name that is only whitespace', async () => {
    mockGet.mockResolvedValue({ success: true, data: { name: '   ', url: 'https://solutioneva.com/' } });

    const { container } = render(<PartnerCredit />);

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('asks the backend once for the four footers that can mount over one session', async () => {
    mockGet.mockResolvedValue({ success: true, data: { name: 'Solution Eva', url: 'https://solutioneva.com/' } });

    render(<PartnerCredit />);
    await screen.findByRole('link', { name: 'Site by Solution Eva' });
    render(<PartnerCredit />);
    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(2));

    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});
