import { render, screen } from '@testing-library/react';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import KitchenStaffLayout from './layout';

const mockGetTenantFeatures = jest.fn();
jest.mock('@/services/tenantFeaturesService', () => ({
  getTenantFeatures: () => mockGetTenantFeatures(),
}));

function KitchenFeatureConsumer() {
  const { tableAccountV1, orderAmendmentsV1 } = useTenantFeatures();
  return <output>{tableAccountV1 || orderAmendmentsV1 ? 'native' : 'legacy'}</output>;
}

describe('Kitchen staff route feature context', () => {
  beforeEach(() => mockGetTenantFeatures.mockReset());

  it.each([
    [{ tableAccountV1: true, orderAmendmentsV1: false }, 'native'],
    [{ tableAccountV1: false, orderAmendmentsV1: true }, 'native'],
    [{ tableAccountV1: false, orderAmendmentsV1: false }, 'legacy'],
  ])('passes the fetched route flags to the real context consumer', async (features, expected) => {
    mockGetTenantFeatures.mockResolvedValue(features);
    render(await KitchenStaffLayout({ children: <KitchenFeatureConsumer /> }));
    expect(screen.getByRole('status')).toHaveTextContent(expected);
    expect(mockGetTenantFeatures).toHaveBeenCalledTimes(1);
  });
});
